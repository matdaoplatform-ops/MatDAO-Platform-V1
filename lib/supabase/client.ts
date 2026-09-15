import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Browser Supabase client.
 *
 * - PKCE flow so Google OAuth returns `?code=` to /auth/callback (the implicit
 *   flow only put tokens in the URL hash, which a server route never saw).
 * - No global `Content-Type: application/json` header: it broke multipart
 *   uploads to Storage.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type UserRole = 'researcher' | 'staff' | 'investor'

export type ProjectStatus =
  | 'draft'
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
}

export interface ProjectDocument {
  name: string
  path: string
  size: number
  type: string
  kind: 'pitchDeck' | 'prototype' | 'additionalDocs' | string
}

export interface KeyValue {
  key: string
  value: string
}

export interface IpStatus {
  type: string
  status: string
  details: string
  txHash?: string
  tokenId?: string
  legalHash?: string
  contractAddress?: string
  mintedAt?: string
}

export type NotificationType = 'project_submitted' | 'project_reviewed' | 'milestone_verified' | string

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          role: UserRole
          wallet_address: string | null
          university: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role?: UserRole
          wallet_address?: string | null
          university?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: UserRole
          wallet_address?: string | null
          university?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          title: string
          slug: string
          researcher_id: string
          trl: number
          phase: string
          funding_goal: number
          funding_raised: number
          description: KeyValue[]
          technical_specs: KeyValue[]
          market_applications: string[]
          development_timeline: Record<string, unknown>[]
          team: { name: string; role: string; institution: string }[]
          risk_factors: string[]
          competitive_advantage: string[]
          ip_status: IpStatus
          status: ProjectStatus
          review_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          submitter_email: string | null
          institution: string | null
          working_field: string | null
          documents: ProjectDocument[]
          is_raising: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          researcher_id: string
          trl: number
          phase: string
          funding_goal: number
          funding_raised?: number
          description?: KeyValue[]
          technical_specs?: KeyValue[]
          market_applications?: string[]
          development_timeline?: Record<string, unknown>[]
          team?: { name: string; role: string; institution: string }[]
          risk_factors?: string[]
          competitive_advantage?: string[]
          ip_status?: IpStatus
          status?: ProjectStatus
          review_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          submitter_email?: string | null
          institution?: string | null
          working_field?: string | null
          documents?: ProjectDocument[]
          is_raising?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          researcher_id?: string
          trl?: number
          phase?: string
          funding_goal?: number
          funding_raised?: number
          description?: KeyValue[]
          technical_specs?: KeyValue[]
          market_applications?: string[]
          development_timeline?: Record<string, unknown>[]
          team?: { name: string; role: string; institution: string }[]
          risk_factors?: string[]
          competitive_advantage?: string[]
          ip_status?: IpStatus
          status?: ProjectStatus
          review_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          submitter_email?: string | null
          institution?: string | null
          working_field?: string | null
          documents?: ProjectDocument[]
          is_raising?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      assessments: {
        Row: {
          id: string
          user_id: string
          project_id: string
          title: string
          author: string
          category: string
          trl: number
          ip_score: number
          valuation_usd: number | null
          due_diligence_score: number | null
          investment_tier: string | null
          trl_project: any
          ip_report: any
          due_diligence_report: any
          summary: any
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          title: string
          author: string
          category: string
          trl: number
          ip_score: number
          valuation_usd?: number | null
          due_diligence_score?: number | null
          investment_tier?: string | null
          trl_project?: any
          ip_report?: any
          due_diligence_report?: any
          summary?: any
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          title?: string
          author?: string
          category?: string
          trl?: number
          ip_score?: number
          valuation_usd?: number | null
          due_diligence_score?: number | null
          investment_tier?: string | null
          trl_project?: any
          ip_report?: any
          due_diligence_report?: any
          summary?: any
          created_at?: string
        }
        Relationships: []
      }
      verification_tasks: {
        Row: {
          id: string
          title: string
          milestone_name: string
          project_id: string
          project_title: string
          proof_text: string
          submitted_by: string
          submitted_by_id: string | null
          submitted_at: string
          ai_passed: boolean
          ai_plagiarism_score: number
          ai_consistency_report: string
          human_voted: boolean
          human_passed: boolean | null
          human_notes: string | null
          status: 'pending' | 'verified' | 'rejected' | 'flagged'
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          milestone_name: string
          project_id: string
          project_title: string
          proof_text: string
          submitted_by: string
          submitted_by_id?: string | null
          submitted_at?: string
          ai_passed?: boolean
          ai_plagiarism_score?: number
          ai_consistency_report?: string
          human_voted?: boolean
          human_passed?: boolean | null
          human_notes?: string | null
          status?: 'pending' | 'verified' | 'rejected' | 'flagged'
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          milestone_name?: string
          project_id?: string
          project_title?: string
          proof_text?: string
          submitted_by?: string
          submitted_by_id?: string | null
          submitted_at?: string
          ai_passed?: boolean
          ai_plagiarism_score?: number
          ai_consistency_report?: string
          human_voted?: boolean
          human_passed?: boolean | null
          human_notes?: string | null
          status?: 'pending' | 'verified' | 'rejected' | 'flagged'
          created_at?: string
        }
        Relationships: []
      }
      submitted_milestones: {
        Row: {
          id: string
          user_id: string
          project_id: string
          project_title: string
          milestone_key: string
          milestone_label: string
          description: string
          timeline: string
          status: 'completed' | 'current' | 'future'
          submitted_at: string
          submitted_by: string
          verification_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          project_title: string
          milestone_key: string
          milestone_label: string
          description: string
          timeline: string
          status: 'completed' | 'current' | 'future'
          submitted_at?: string
          submitted_by: string
          verification_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          project_title?: string
          milestone_key?: string
          milestone_label?: string
          description?: string
          timeline?: string
          status?: 'completed' | 'current' | 'future'
          submitted_at?: string
          submitted_by?: string
          verification_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          type: NotificationType
          recipient_role: UserRole | null
          recipient_id: string | null
          project_id: string | null
          payload: Record<string, unknown>
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          type: NotificationType
          recipient_role?: UserRole | null
          recipient_id?: string | null
          project_id?: string | null
          payload?: Record<string, unknown>
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          type?: NotificationType
          recipient_role?: UserRole | null
          recipient_id?: string | null
          project_id?: string | null
          payload?: Record<string, unknown>
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      project_reviews: {
        Row: {
          id: string
          project_id: string
          reviewer_id: string | null
          decision: 'approved' | 'rejected' | 'changes_requested' | 'under_review'
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          reviewer_id?: string | null
          decision: 'approved' | 'rejected' | 'changes_requested' | 'under_review'
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          reviewer_id?: string | null
          decision?: 'approved' | 'rejected' | 'changes_requested' | 'under_review'
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      /** Approved projects + researcher display name; readable by anon (security-definer view). */
      approved_projects: {
        Row: {
          id: string
          slug: string
          title: string
          trl: number
          phase: string
          working_field: string | null
          institution: string | null
          funding_goal: number
          funding_raised: number
          is_raising: boolean
          description: KeyValue[]
          technical_specs: KeyValue[]
          market_applications: string[]
          development_timeline: Record<string, unknown>[]
          team: { name: string; role: string; institution: string }[]
          risk_factors: string[]
          competitive_advantage: string[]
          ip_status: IpStatus
          created_at: string
          updated_at: string
          researcher_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_staff: { Args: Record<string, never>; Returns: boolean }
      user_role: { Args: Record<string, never>; Returns: string | null }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type ProjectRow = Database['public']['Tables']['projects']['Row']
export type VerificationTaskRow = Database['public']['Tables']['verification_tasks']['Row']
export type NotificationRow = Database['public']['Tables']['notifications']['Row']
export type ApprovedProjectRow = Database['public']['Views']['approved_projects']['Row']
