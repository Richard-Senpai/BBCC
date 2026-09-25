export type UserRole = 'member' | 'admin'

export type Profile = {
  id: string
  full_name: string
  email: string
  phone: string
  fellowship_unit: string
  role: UserRole
  created_at: string
}

export type ChallengeSettings = {
  id: 1
  start_date: string | null
  timezone: string
  updated_at: string
}

export type ChallengeDay = {
  id: string
  day_number: number
  title: string
  description: string | null
  scripture_reference?: string
  created_at: string
  updated_at: string
}

export type Activity = {
  id: string
  challenge_day_id: string
  description: string
  sort_order: number
}

export type Completion = {
  id: string
  user_id: string
  challenge_day_id: string
  completed_at: string
}

export type ActivityCompletion = {
  id: string
  user_id: string
  activity_id: string
  completed_at: string
}

export type MemberStats = {
  current_streak: number
  longest_run: number
  total_completed: number
}

export type LeaderboardEntry = {
  rank: number
  id: string
  full_name: string
  fellowship_unit: string
  current_streak: number
  total_completed: number
  last_completed_at: string | null
}

export type DayCompletionCount = {
  day_number: number
  completion_count: number
}

export type ChallengeDayWithActivities = ChallengeDay & {
  activities: Activity[]
}

// ─────────────────────────────────────────
// Supabase Database type map
// ─────────────────────────────────────────
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          full_name?: string
          email?: string
          phone?: string
          fellowship_unit?: string
          role?: UserRole
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          phone?: string
          fellowship_unit?: string
          role?: UserRole
          created_at?: string
        }
        Relationships: []
      }
      challenge_settings: {
        Row: ChallengeSettings
        Insert: {
          id?: 1
          start_date?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          id?: 1
          start_date?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      challenge_days: {
        Row: ChallengeDay
        Insert: {
          id?: string
          day_number: number
          title?: string
          description?: string | null
          scripture_reference?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          day_number?: number
          title?: string
          description?: string | null
          scripture_reference?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      activities: {
        Row: Activity
        Insert: {
          id?: string
          challenge_day_id: string
          description?: string
          sort_order?: number
        }
        Update: {
          id?: string
          challenge_day_id?: string
          description?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'activities_challenge_day_id_fkey'
            columns: ['challenge_day_id']
            isOneToOne: false
            referencedRelation: 'challenge_days'
            referencedColumns: ['id']
          }
        ]
      }
      completions: {
        Row: Completion
        Insert: {
          id?: string
          user_id: string
          challenge_day_id: string
          completed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          challenge_day_id?: string
          completed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'completions_challenge_day_id_fkey'
            columns: ['challenge_day_id']
            isOneToOne: false
            referencedRelation: 'challenge_days'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'completions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      activity_completions: {
        Row: ActivityCompletion
        Insert: {
          id?: string
          user_id: string
          activity_id: string
          completed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          activity_id?: string
          completed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activity_completions_activity_id_fkey'
            columns: ['activity_id']
            isOneToOne: false
            referencedRelation: 'activities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activity_completions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      get_current_challenge_day: { Args: Record<string, never>; Returns: number }
      get_member_streak: { Args: { member_id: string }; Returns: number }
      get_member_stats: {
        Args: { member_id: string }
        Returns: MemberStats[]
      }
      get_leaderboard: {
        Args: { limit_count?: number }
        Returns: LeaderboardEntry[]
      }
      get_day_completion_counts: {
        Args: Record<string, never>
        Returns: DayCompletionCount[]
      }
      seed_default_40_days: {
        Args: Record<string, never>
        Returns: void
      }
    }
  }
}

// ─────────────────────────────────────────
// Fellowship unit list (matches church units)
// ─────────────────────────────────────────
export const FELLOWSHIP_UNITS = [
  'General Assembly',
  'Media & Tech Ministry',
  'Choir / Music Ministry',
  'Ushering & Protocol',
  'Youth Department',
  "Children's Church",
  "Women's Fellowship",
  "Men's Fellowship",
  'Prayer & Intercession Unit',
  'Evangelism & Outreach',
  'Finance & Administration',
  'Campus Ministry (OAU/Poly)',
  'Guest Services',
] as const
