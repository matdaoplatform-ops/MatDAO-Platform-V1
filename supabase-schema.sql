-- =============================================================================
-- MatDAO — fresh-install schema (base tables only)
--
-- Run this first in the Supabase SQL editor on a NEW project, then run
-- `supabase/migrations/0001_platform_fixes.sql`, which installs every
-- function, trigger, RLS policy, the notifications / project_reviews tables
-- and the `project-documents` storage bucket.
--
-- On an EXISTING project you only need the migration file — it adds the
-- columns below with `ADD COLUMN IF NOT EXISTS`.
--
-- Both files are idempotent.
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (id mirrors auth.users.id; the FK is added by the migration)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'researcher' CHECK (role IN ('researcher', 'staff', 'investor')),
  wallet_address TEXT UNIQUE,
  university TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  researcher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  trl INTEGER NOT NULL CHECK (trl >= 1 AND trl <= 9),
  phase TEXT NOT NULL,
  funding_goal INTEGER NOT NULL,
  funding_raised INTEGER DEFAULT 0,
  description JSONB NOT NULL DEFAULT '[]',
  technical_specs JSONB NOT NULL DEFAULT '[]',
  market_applications JSONB NOT NULL DEFAULT '[]',
  development_timeline JSONB NOT NULL DEFAULT '[]',
  team JSONB NOT NULL DEFAULT '[]',
  risk_factors JSONB NOT NULL DEFAULT '[]',
  competitive_advantage JSONB NOT NULL DEFAULT '[]',
  ip_status JSONB NOT NULL DEFAULT '{"type": "", "status": "", "details": ""}',
  -- Review workflow (see migration 0001 for the CHECK constraint and triggers)
  status TEXT NOT NULL DEFAULT 'pending_review',
  review_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  -- Submission metadata
  submitter_email TEXT,
  institution TEXT,
  working_field TEXT,
  documents JSONB NOT NULL DEFAULT '[]',   -- [{ name, path, size, type, kind }]
  is_raising BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assessments table
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  trl INTEGER NOT NULL,
  ip_score INTEGER NOT NULL,
  valuation_usd INTEGER,
  due_diligence_score INTEGER,
  investment_tier TEXT,
  trl_project JSONB,
  ip_report JSONB,
  due_diligence_report JSONB,
  summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create verification_tasks table
CREATE TABLE IF NOT EXISTS verification_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  milestone_name TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_title TEXT NOT NULL,
  proof_text TEXT NOT NULL,
  submitted_by TEXT NOT NULL,                                  -- display name
  submitted_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- used by RLS
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ai_passed BOOLEAN DEFAULT false,
  ai_plagiarism_score INTEGER DEFAULT 0,
  ai_consistency_report TEXT,
  human_voted BOOLEAN DEFAULT false,
  human_passed BOOLEAN,
  human_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'flagged')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create submitted_milestones table
CREATE TABLE IF NOT EXISTS submitted_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_title TEXT NOT NULL,
  milestone_key TEXT NOT NULL,
  milestone_label TEXT NOT NULL,
  description TEXT NOT NULL,
  timeline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'future' CHECK (status IN ('completed', 'current', 'future')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_by TEXT NOT NULL,
  verification_id UUID REFERENCES verification_tasks(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_projects_researcher ON projects(researcher_id);
CREATE INDEX IF NOT EXISTS idx_projects_trl ON projects(trl);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_assessments_user ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_project ON assessments(project_id);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_project ON verification_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_status ON verification_tasks(status);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_submitted_by_id ON verification_tasks(submitted_by_id);
CREATE INDEX IF NOT EXISTS idx_submitted_milestones_user ON submitted_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_submitted_milestones_project ON submitted_milestones(project_id);

-- Enable Row Level Security (policies are installed by the migration; until
-- then the tables are locked down for anon/authenticated clients)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE submitted_milestones ENABLE ROW LEVEL SECURITY;

-- Non-recursive policies that do not depend on helper functions.
-- (Everything involving the staff role lives in the migration via is_staff().)
DROP POLICY IF EXISTS "Users can view their own assessments" ON assessments;
CREATE POLICY "Users can view their own assessments" ON assessments
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own assessments" ON assessments;
CREATE POLICY "Users can create their own assessments" ON assessments
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own submitted milestones" ON submitted_milestones;
CREATE POLICY "Users can view their own submitted milestones" ON submitted_milestones
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create submitted milestones" ON submitted_milestones;
CREATE POLICY "Users can create submitted milestones" ON submitted_milestones
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own submitted milestones" ON submitted_milestones;
CREATE POLICY "Users can update their own submitted milestones" ON submitted_milestones
  FOR UPDATE USING (user_id = auth.uid());

-- =============================================================================
-- NEXT STEP: run supabase/migrations/0001_platform_fixes.sql
-- =============================================================================
