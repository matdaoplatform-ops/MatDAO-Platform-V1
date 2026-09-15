-- =============================================================================
-- MatDAO platform fixes — migration 0001
--
-- Safe to run repeatedly in the Supabase SQL editor on an EXISTING project
-- (every statement is guarded with IF NOT EXISTS / DROP ... IF EXISTS /
-- CREATE OR REPLACE). Also run it after `supabase-schema.sql` on a fresh
-- project: the schema file only creates the base tables, this file installs
-- all functions, triggers, policies, extra tables and the storage bucket.
--
-- What it fixes:
--   * RLS policies that selected from `profiles` inside a `profiles` policy
--     (infinite recursion, SQLSTATE 42P17) -> replaced by public.is_staff().
--   * No profile was ever created at sign-up -> auth.users AFTER INSERT trigger.
--   * profiles.id had no FK to auth.users, no INSERT policy.
--   * Self-service privilege escalation (role = 'staff') -> blocked by trigger
--     and by the sign-up trigger (metadata role is coerced to 'researcher').
--   * projects: submission/review workflow columns (status, review_notes, ...),
--     documents, is_raising; public read only for approved rows.
--   * verification_tasks matched by display name -> submitted_by_id uuid.
--   * New tables: notifications, project_reviews.
--   * Private storage bucket `project-documents` with per-user folders.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Helper functions (SECURITY DEFINER so they can read profiles without
--    re-entering the profiles RLS policies).
-- -----------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'staff' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.is_staff() from public;
revoke all on function public.user_role() from public;
-- `anon` needs EXECUTE too: the public SELECT policy on projects calls
-- is_staff() for anonymous readers (it simply returns false for them).
grant execute on function public.is_staff() to authenticated, anon, service_role;
grant execute on function public.user_role() to authenticated, anon, service_role;

-- Security: an older helper `get_profile` (if present) must not be callable
-- by anonymous clients.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_profile'
  loop
    execute format('revoke all on function %s from anon', r.sig);
    execute format('revoke all on function %s from public', r.sig);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 2. profiles
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;

-- FK to auth.users (cascade delete). Skipped (with a NOTICE) when orphan rows
-- exist so the rest of the migration still applies. To clean orphans first:
--   delete from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id);
-- then re-run this migration.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_id_fkey' and conrelid = 'public.profiles'::regclass
  ) then
    if exists (
      select 1 from public.profiles p
      where not exists (select 1 from auth.users u where u.id = p.id)
    ) then
      raise notice 'profiles_id_fkey NOT added: orphan profile rows exist (see cleanup statement in migration comments).';
    else
      alter table public.profiles
        add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
    end if;
  end if;
end $$;

-- Block self-service staff role. Service-role / SQL-editor sessions have
-- auth.uid() = null and are allowed (that is how staff are promoted).
-- Researcher <-> investor changes by the user themselves stay allowed
-- (needed by /onboarding for Google sign-ups).
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'staff' then
      raise exception 'Only staff can create a staff profile' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role and (new.role = 'staff' or old.role = 'staff') then
    raise exception 'Only staff can grant or revoke the staff role' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id and role in ('researcher', 'investor'));

drop policy if exists "Staff can view all profiles" on public.profiles;
create policy "Staff can view all profiles" on public.profiles
  for select using (public.is_staff());

-- -----------------------------------------------------------------------------
-- 3. Auto-create a profile for every new auth user
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_role text;
  v_university text;
  v_avatar text;
  v_email text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'New user'
  );
  -- Never trust a role coming from client-supplied metadata: staff is only
  -- ever granted via SQL (update profiles set role = 'staff' where email = ...).
  v_role := lower(coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'researcher'));
  if v_role not in ('researcher', 'investor') then
    v_role := 'researcher';
  end if;
  v_university := nullif(trim(new.raw_user_meta_data ->> 'university'), '');
  v_avatar := coalesce(
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'picture', '')
  );

  v_email := coalesce(new.email, new.id::text || '@no-email.local');

  begin
    insert into public.profiles (id, email, name, role, university, avatar_url)
    values (new.id, v_email, v_name, v_role, v_university, v_avatar)
    on conflict (id) do nothing;
  exception when unique_violation then
    -- profiles.email is unique. A collision means a stale profile row with
    -- this email exists under another id. Drop it if it is an orphan (no
    -- auth user), otherwise fall back to a per-user placeholder email so the
    -- new account still gets a profile (the app shows auth.users.email).
    delete from public.profiles p
    where p.email = v_email
      and p.id <> new.id
      and not exists (select 1 from auth.users u where u.id = p.id);
    begin
      insert into public.profiles (id, email, name, role, university, avatar_url)
      values (new.id, v_email, v_name, v_role, v_university, v_avatar)
      on conflict (id) do nothing;
    exception when unique_violation then
      insert into public.profiles (id, email, name, role, university, avatar_url)
      values (new.id, new.id::text || '@duplicate-email.local', v_name, v_role, v_university, v_avatar)
      on conflict (id) do nothing;
    end;
  end;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: existing auth users that never got a profile.
insert into public.profiles (id, email, name, role, university, avatar_url)
select
  u.id,
  coalesce(u.email, u.id::text || '@no-email.local'),
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'New user'
  ),
  case
    when lower(coalesce(u.raw_user_meta_data ->> 'role', '')) = 'investor' then 'investor'
    else 'researcher'
  end,
  nullif(trim(u.raw_user_meta_data ->> 'university'), ''),
  coalesce(nullif(u.raw_user_meta_data ->> 'avatar_url', ''), nullif(u.raw_user_meta_data ->> 'picture', ''))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 4. projects: review workflow + submission metadata
-- -----------------------------------------------------------------------------
alter table public.projects add column if not exists status text not null default 'pending_review';
alter table public.projects add column if not exists review_notes text;
alter table public.projects add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.projects add column if not exists reviewed_at timestamptz;
alter table public.projects add column if not exists submitter_email text;
alter table public.projects add column if not exists institution text;
alter table public.projects add column if not exists working_field text;
alter table public.projects add column if not exists documents jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists is_raising boolean not null default false;

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('draft', 'pending_review', 'under_review', 'approved', 'rejected', 'changes_requested'));

-- Rows approved by the old ai-auditor flow (phase = 'approved') keep working.
update public.projects set status = 'approved'
where phase = 'approved' and status = 'pending_review';

create index if not exists idx_projects_status on public.projects(status);

-- Non-staff (the submitting researcher) may only create/keep a project in
-- draft/pending_review, may never set phase = 'approved', and may never touch
-- the review columns, ip_status (mint record), funding_raised or is_raising.
create or replace function public.protect_project_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is null or new.status not in ('draft', 'pending_review') then
      raise exception 'New projects must be submitted as draft or pending_review' using errcode = '42501';
    end if;
    if new.phase = 'approved' then
      raise exception 'Only staff can approve a project' using errcode = '42501';
    end if;
    new.review_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.ip_status := '{"type": "", "status": "", "details": ""}'::jsonb;
    new.funding_raised := 0;
    new.is_raising := false;
    return new;
  end if;

  if new.review_notes is distinct from old.review_notes
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'Only staff can edit review fields' using errcode = '42501';
  end if;

  if new.status is distinct from old.status and new.status not in ('draft', 'pending_review') then
    raise exception 'Only staff can set project status to %', new.status using errcode = '42501';
  end if;

  if new.phase is distinct from old.phase and new.phase = 'approved' then
    raise exception 'Only staff can approve a project' using errcode = '42501';
  end if;

  if new.ip_status is distinct from old.ip_status then
    raise exception 'Only staff can change the IP status' using errcode = '42501';
  end if;

  if new.funding_raised is distinct from old.funding_raised or new.is_raising is distinct from old.is_raising then
    raise exception 'Only staff can change funding fields' using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists protect_project_review_fields on public.projects;
create trigger protect_project_review_fields
  before insert or update on public.projects
  for each row execute function public.protect_project_review_fields();

drop policy if exists "Everyone can view projects" on public.projects;
drop policy if exists "Approved projects are public" on public.projects;
create policy "Approved projects are public" on public.projects
  for select using (
    status = 'approved'
    or researcher_id = auth.uid()
    or public.is_staff()
  );

drop policy if exists "Researchers can create projects" on public.projects;
create policy "Researchers can create projects" on public.projects
  for insert with check (
    auth.uid() = researcher_id
    and public.user_role() in ('researcher', 'staff')
  );

drop policy if exists "Researchers can update their own projects" on public.projects;
create policy "Researchers can update their own projects" on public.projects
  for update using (researcher_id = auth.uid()) with check (researcher_id = auth.uid());

drop policy if exists "Staff can update any project" on public.projects;
create policy "Staff can update any project" on public.projects
  for update using (public.is_staff()) with check (public.is_staff());

-- -----------------------------------------------------------------------------
-- 5. assessments
-- -----------------------------------------------------------------------------
drop policy if exists "Staff can view all assessments" on public.assessments;
create policy "Staff can view all assessments" on public.assessments
  for select using (public.is_staff());

-- -----------------------------------------------------------------------------
-- 6. verification_tasks: match by user id, not by display name
-- -----------------------------------------------------------------------------
alter table public.verification_tasks
  add column if not exists submitted_by_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_verification_tasks_submitted_by_id on public.verification_tasks(submitted_by_id);

-- Backfill from the owning project (the display name is not unique).
update public.verification_tasks vt
set submitted_by_id = pr.researcher_id
from public.projects pr
where pr.id = vt.project_id and vt.submitted_by_id is null;

create or replace function public.owns_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p where p.id = p_project_id and p.researcher_id = auth.uid()
  );
$$;
revoke all on function public.owns_project(uuid) from public;
grant execute on function public.owns_project(uuid) to authenticated, service_role;

-- Non-staff can never set the human-review outcome. AI fields (ai_passed,
-- ai_plagiarism_score, ai_consistency_report) are written by the researcher's
-- browser after calling TRL Services and are therefore SELF-REPORTED — the
-- staff UI labels them as unverified.
create or replace function public.protect_verification_task_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;
  new.human_voted := false;
  new.human_passed := null;
  new.human_notes := null;
  if new.status is null or new.status not in ('pending', 'flagged') then
    new.status := 'pending';
  end if;
  if tg_op = 'UPDATE' and old.status in ('verified', 'rejected') then
    raise exception 'A reviewed verification task can no longer be edited' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists protect_verification_task_fields on public.verification_tasks;
create trigger protect_verification_task_fields
  before insert or update on public.verification_tasks
  for each row execute function public.protect_verification_task_fields();

drop policy if exists "Researchers can view their own verification tasks" on public.verification_tasks;
create policy "Researchers can view their own verification tasks" on public.verification_tasks
  for select using (submitted_by_id = auth.uid() or public.owns_project(project_id));

drop policy if exists "Researchers can create verification tasks" on public.verification_tasks;
create policy "Researchers can create verification tasks" on public.verification_tasks
  for insert with check (
    submitted_by_id = auth.uid()
    and public.owns_project(project_id)
  );

drop policy if exists "Researchers can update their pending verification tasks" on public.verification_tasks;
create policy "Researchers can update their pending verification tasks" on public.verification_tasks
  for update
  using (submitted_by_id = auth.uid() and public.owns_project(project_id) and status in ('pending', 'flagged'))
  with check (submitted_by_id = auth.uid() and public.owns_project(project_id));

drop policy if exists "Staff can view all verification tasks" on public.verification_tasks;
create policy "Staff can view all verification tasks" on public.verification_tasks
  for select using (public.is_staff());

drop policy if exists "Staff can update verification tasks" on public.verification_tasks;
create policy "Staff can update verification tasks" on public.verification_tasks
  for update using (public.is_staff()) with check (public.is_staff());

-- -----------------------------------------------------------------------------
-- 7. submitted_milestones: staff visibility
-- -----------------------------------------------------------------------------
drop policy if exists "Staff can view all submitted milestones" on public.submitted_milestones;
create policy "Staff can view all submitted milestones" on public.submitted_milestones
  for select using (public.is_staff());

-- -----------------------------------------------------------------------------
-- 8. notifications
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  recipient_role text check (recipient_role in ('researcher', 'staff', 'investor')),
  recipient_id uuid references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_id on public.notifications(recipient_id);
create index if not exists idx_notifications_role_read on public.notifications(recipient_role, read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Staff can view all notifications" on public.notifications;
create policy "Staff can view all notifications" on public.notifications
  for select using (public.is_staff());

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications" on public.notifications
  for select using (recipient_id = auth.uid());

drop policy if exists "Authenticated users can create notifications" on public.notifications;
drop policy if exists "Staff can create notifications" on public.notifications;
create policy "Staff can create notifications" on public.notifications
  for insert with check (public.is_staff());

-- Owners can see the "submitted" notifications for their own projects (lets
-- the notify route de-duplicate without a service key).
drop policy if exists "Owners can view submission notifications" on public.notifications;
create policy "Owners can view submission notifications" on public.notifications
  for select using (type = 'project_submitted' and project_id is not null and public.owns_project(project_id));

-- Researchers may only notify staff about their own submission.
drop policy if exists "Owners can notify staff about their submission" on public.notifications;
create policy "Owners can notify staff about their submission" on public.notifications
  for insert with check (
    auth.uid() is not null
    and type = 'project_submitted'
    and recipient_role = 'staff'
    and recipient_id is null
    and project_id is not null
    and public.owns_project(project_id)
  );

drop policy if exists "Recipients can mark notifications read" on public.notifications;
create policy "Recipients can mark notifications read" on public.notifications
  for update
  using (recipient_id = auth.uid() or (recipient_role = 'staff' and public.is_staff()))
  with check (recipient_id = auth.uid() or (recipient_role = 'staff' and public.is_staff()));

grant select, insert, update on public.notifications to authenticated;

-- -----------------------------------------------------------------------------
-- 9. project_reviews (audit trail of staff decisions)
-- -----------------------------------------------------------------------------
create table if not exists public.project_reviews (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested', 'under_review')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_reviews_project on public.project_reviews(project_id);

alter table public.project_reviews enable row level security;

drop policy if exists "Staff can view project reviews" on public.project_reviews;
create policy "Staff can view project reviews" on public.project_reviews
  for select using (public.is_staff());

drop policy if exists "Staff can create project reviews" on public.project_reviews;
create policy "Staff can create project reviews" on public.project_reviews
  for insert with check (public.is_staff() and reviewer_id = auth.uid());

grant select, insert on public.project_reviews to authenticated;

-- -----------------------------------------------------------------------------
-- 10. Storage bucket for submission documents
--     Object keys are `<user id>/<project id>/<kind>-<filename>`.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-documents', 'project-documents', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "Owners can upload project documents" on storage.objects;
create policy "Owners can upload project documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners and staff can read project documents" on storage.objects;
create policy "Owners and staff can read project documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

drop policy if exists "Owners can update project documents" on storage.objects;
create policy "Owners can update project documents" on storage.objects
  for update to authenticated
  using (bucket_id = 'project-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'project-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners can delete project documents" on storage.objects;
create policy "Owners can delete project documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- 11. Public marketplace view
--     Runs with the owner's privileges (security_invoker = false), so it can
--     expose the researcher's display name from `profiles` — which is not
--     readable by anon/other users directly — for APPROVED projects only.
--     Intentionally a "security definer" view: keep the column list minimal.
-- -----------------------------------------------------------------------------
drop view if exists public.approved_projects;
create view public.approved_projects
with (security_invoker = false)
as
  select
    p.id,
    p.slug,
    p.title,
    p.trl,
    p.phase,
    p.working_field,
    p.institution,
    p.funding_goal,
    p.funding_raised,
    p.is_raising,
    p.description,
    p.technical_specs,
    p.market_applications,
    p.development_timeline,
    p.team,
    p.risk_factors,
    p.competitive_advantage,
    p.ip_status,
    p.created_at,
    p.updated_at,
    pr.name as researcher_name
  from public.projects p
  left join public.profiles pr on pr.id = p.researcher_id
  where p.status = 'approved';

grant select on public.approved_projects to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 12. updated_at triggers (idempotent re-create)
-- -----------------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_projects_updated_at on public.projects;
create trigger update_projects_updated_at before update on public.projects
  for each row execute function public.update_updated_at_column();

-- =============================================================================
-- Done. To promote a staff member:
--   update public.profiles set role = 'staff' where email = 'someone@example.org';
-- =============================================================================
