export type UserRole = 'member' | 'admin'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  created_at: string
}

export interface ChallengeSettings {
  id: 1
  start_date: string | null
  timezone: string
  updated_at: string
}

export interface ChallengeDay {
  id: string
  day_number: number
  title: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  challenge_day_id: string
  description: string
  sort_order: number
}

export interface Completion {
  id: string
  user_id: string
  challenge_day_id: string
  completed_at: string
}

// Supabase DB type map (for typed clients)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      challenge_settings: {
        Row: ChallengeSettings
        Insert: Omit<ChallengeSettings, 'id' | 'updated_at'>
        Update: Partial<Omit<ChallengeSettings, 'id' | 'updated_at'>>
      }
      challenge_days: {
        Row: ChallengeDay
        Insert: Omit<ChallengeDay, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ChallengeDay, 'id' | 'created_at' | 'updated_at'>>
      }
      activities: {
        Row: Activity
        Insert: Omit<Activity, 'id'>
        Update: Partial<Omit<Activity, 'id'>>
      }
      completions: {
        Row: Completion
        Insert: Omit<Completion, 'id' | 'completed_at'>
        Update: Partial<Omit<Completion, 'id' | 'completed_at'>>
      }
    }
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
  }
}
