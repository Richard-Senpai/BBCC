export type UserRole = 'member' | 'admin'
export type UserStatus = 'pending' | 'approved' | 'rejected'

export type Profile = {
  id: string
  full_name: string
  email: string
  phone: string
  fellowship_unit: string
  role: UserRole
  status: UserStatus
  display_tag?: string | null
  avatar_url?: string | null
  last_seen_announcements_at?: string | null
  last_seen_chat_at?: string | null
  new_day_enabled?: boolean
  announcements_enabled?: boolean
  chat_enabled?: boolean
  created_at: string
}

export type ChallengeStatus = 'upcoming' | 'active' | 'completed'
export type EnrollmentMode = 'open' | 'approval'
export type EnrollmentStatus = 'pending' | 'approved' | 'rejected'

export type ChallengeEnrollment = {
  id: string
  challenge_id: string
  user_id: string
  status: EnrollmentStatus
  requested_at: string
  decided_at?: string | null
  decided_by?: string | null
}

export type ChallengeEnrollmentWithUser = ChallengeEnrollment & {
  profiles: {
    id: string
    full_name: string
    email: string
    avatar_url?: string | null
    display_tag?: string | null
    fellowship_unit?: string | null
  } | null
  course_member_state?: {
    started_at: string | null
    access_override_until: string | null
    completed_at: string | null
    completed_lessons_count?: number
    total_lessons_count?: number
  } | null
}


export type ChallengeType = 'daily' | 'course'
export type CourseAccessMode = 'unlimited' | 'fixed_end' | 'per_member_days'

export type ChallengeDeleteSummary = {
  id: string
  name: string
  type?: ChallengeType
  status: ChallengeStatus | 'course'
  days_count: number
  activities_count: number
  participants_count: number
  completions_count: number
  activity_completions_count: number
  journal_entries_count: number
  enrollments_count: number
  // Course-specific counts
  lessons_count?: number
  blocks_count?: number
  members_started?: number
}

export type Challenge = {
  id: string
  name: string
  type: ChallengeType
  duration_days: number | null
  start_date: string | null
  timezone: string
  enrollment_mode: EnrollmentMode
  is_published?: boolean
  description?: string | null
  access_mode?: CourseAccessMode | null
  access_end_date?: string | null
  access_days?: number | null
  last_notified_challenge_day?: number
  created_at: string
}

export type ChallengeWithStatus = Challenge & {
  status: ChallengeStatus | 'course'
  current_day: number
  end_date: string
}

export type ChallengeWithStats = ChallengeWithStatus & {
  participant_count: number
  pending_requests_count?: number
  lesson_count?: number
  members_started?: number
  members_completed?: number
}

export type CourseBlockType = 'rich_text' | 'image_text' | 'image' | 'video' | 'link'

export type CourseLesson = {
  id: string
  challenge_id: string
  position: number
  title: string
  summary: string | null
  created_at: string
  updated_at: string
  block_count?: number
  completed_count?: number
}

// ─────────────────────────────────────────────────────────────
// COURSE BLOCK CONTENT SHAPES (Stored in course_blocks.content jsonb)
// Documented for shared use between Admin Editor and Member View
// ─────────────────────────────────────────────────────────────

/**
 * 1. Rich Text Block Content
 * Contains sanitized HTML supporting headings (h2, h3), bold, italic,
 * bullet & numbered lists, blockquote (scripture), and links.
 */
export type RichTextBlockContent = {
  html: string
}

/**
 * 2. Image + Text Block Content
 * Renders an image alongside rich text. On mobile, always stacks image above text.
 */
export type ImageTextBlockContent = {
  image_url: string
  storage_path?: string | null // e.g. "courses/<courseId>/<filename>" for storage cleanup
  alt_text: string
  caption?: string | null
  image_position: 'left' | 'right' | 'top'
  html: string
}

/**
 * 3. Full-Width Image Block Content
 */
export type ImageBlockContent = {
  image_url: string
  storage_path?: string | null
  alt_text: string
  caption?: string | null
}

/**
 * 4. Video Block Content
 * YouTube video embed using privacy-friendly youtube-nocookie.com domain.
 */
export type VideoBlockContent = {
  video_id: string // 11-character YouTube video ID
  original_url: string
  title?: string | null
  start_seconds?: number | null
}

/**
 * 5. Link Button Block Content
 * Action button opening external resource in a new tab.
 * Note: 'required' flag is stored on the course_blocks.required boolean column.
 */
export type LinkBlockContent = {
  url: string // http:// or https:// only
  label: string
  description?: string | null
}

export type CourseBlockContent =
  | RichTextBlockContent
  | ImageTextBlockContent
  | ImageBlockContent
  | VideoBlockContent
  | LinkBlockContent

export type CourseBlock = {
  id: string
  lesson_id: string
  position: number
  type: CourseBlockType
  content: Record<string, unknown> // Shape conforms to CourseBlockContent
  required: boolean
  created_at: string
  updated_at: string
}

export type CourseMemberState = {
  id: string
  challenge_id: string
  user_id: string
  started_at: string
  access_override_until: string | null
  completed_at: string | null
}

export type CourseLessonCompletion = {
  id: string
  user_id: string
  lesson_id: string
  completed_at: string
}

export type CourseBlockConfirmation = {
  id: string
  user_id: string
  block_id: string
  confirmed_at: string
}

export type ChallengeSettings = {
  id: 1
  start_date: string | null
  timezone: string
  duration_days: number
  challenge_name: string
  last_notified_challenge_day?: number
  updated_at: string
}

export type PushSubscriptionRecord = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export type PushCategory = 'new_day' | 'announcements' | 'chat'

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
  badge?: string
}

export type PushDispatchResult = {
  success: boolean
  error?: string
  eligibleUsers: number
  sent: number
  failed: number
  cleaned: number
}

export type ChallengeDay = {
  id: string
  challenge_id: string
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
  video_url?: string | null
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
  user_id: string
  id?: string
  full_name: string
  fellowship_unit?: string | null
  avatar_url?: string | null
  display_tag?: string | null
  current_streak: number
  total_activities_completed: number
  total_completed?: number
  last_completed_at?: string | null
}

export type LeaderboardPayload = {
  members: LeaderboardEntry[]
  top_members?: LeaderboardEntry[]
  total_ranked_members: number
  my_rank: number | null
  my_total_activities: number
}

export type DayCompletionCount = {
  day_number: number
  completion_count: number
}

export type ChallengeDayWithActivities = ChallengeDay & {
  activities: Activity[]
}

export type Message = {
  id: string
  user_id: string | null
  content: string | null
  image_url?: string | null
  created_at: string
}

export type MessageWithSender = Message & {
  profiles: {
    id: string
    full_name: string
    avatar_url?: string | null
    fellowship_unit: string
    role: UserRole
    display_tag?: string | null
  } | null
}

export type Announcement = {
  id: string
  title: string
  body: string
  created_by: string | null
  created_at: string
}

export type AnnouncementWithAuthor = Announcement & {
  profiles?: {
    full_name: string
    avatar_url?: string | null
    role?: UserRole
  } | null
}

export type JournalEntry = {
  id: string
  user_id: string
  challenge_day_id: string
  content: string
  created_at: string
  updated_at: string
}

export type JournalEntryWithDay = JournalEntry & {
  challenge_days?: Pick<ChallengeDay, 'id' | 'day_number' | 'title' | 'scripture_reference'> | null
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
          status?: UserStatus
          display_tag?: string | null
          avatar_url?: string | null
          last_seen_announcements_at?: string | null
          last_seen_chat_at?: string | null
          new_day_enabled?: boolean
          announcements_enabled?: boolean
          chat_enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          phone?: string
          fellowship_unit?: string
          role?: UserRole
          status?: UserStatus
          display_tag?: string | null
          avatar_url?: string | null
          last_seen_announcements_at?: string | null
          last_seen_chat_at?: string | null
          new_day_enabled?: boolean
          announcements_enabled?: boolean
          chat_enabled?: boolean
          created_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: PushSubscriptionRecord
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
        }
        Relationships: []
      }
      challenges: {
        Row: Challenge
        Insert: {
          id?: string
          name: string
          duration_days?: number | null
          start_date?: string | null
          timezone?: string
          enrollment_mode?: EnrollmentMode
          type?: ChallengeType
          is_published?: boolean
          description?: string | null
          access_mode?: CourseAccessMode | null
          access_end_date?: string | null
          access_days?: number | null
          last_notified_challenge_day?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          duration_days?: number | null
          start_date?: string | null
          timezone?: string
          enrollment_mode?: EnrollmentMode
          type?: ChallengeType
          is_published?: boolean
          description?: string | null
          access_mode?: CourseAccessMode | null
          access_end_date?: string | null
          access_days?: number | null
          last_notified_challenge_day?: number
          created_at?: string
        }
        Relationships: []
      }
      course_lessons: {
        Row: CourseLesson
        Insert: {
          id?: string
          challenge_id: string
          position: number
          title: string
          summary?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          challenge_id?: string
          position?: number
          title?: string
          summary?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_blocks: {
        Row: CourseBlock
        Insert: {
          id?: string
          lesson_id: string
          position: number
          type: CourseBlockType
          content?: Record<string, unknown>
          required?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          position?: number
          type?: CourseBlockType
          content?: Record<string, unknown>
          required?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_member_state: {
        Row: CourseMemberState
        Insert: {
          id?: string
          challenge_id: string
          user_id: string
          started_at?: string
          access_override_until?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          challenge_id?: string
          user_id?: string
          started_at?: string
          access_override_until?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      course_lesson_completions: {
        Row: CourseLessonCompletion
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          completed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          completed_at?: string
        }
        Relationships: []
      }
      course_block_confirmations: {
        Row: CourseBlockConfirmation
        Insert: {
          id?: string
          user_id: string
          block_id: string
          confirmed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          block_id?: string
          confirmed_at?: string
        }
        Relationships: []
      }
      challenge_enrollments: {
        Row: ChallengeEnrollment
        Insert: {
          id?: string
          challenge_id: string
          user_id: string
          status: EnrollmentStatus
          requested_at?: string
          decided_at?: string | null
          decided_by?: string | null
        }
        Update: {
          id?: string
          challenge_id?: string
          user_id?: string
          status?: EnrollmentStatus
          requested_at?: string
          decided_at?: string | null
          decided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'challenge_enrollments_challenge_id_fkey'
            columns: ['challenge_id']
            isOneToOne: false
            referencedRelation: 'challenges'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'challenge_enrollments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      challenge_settings: {
        Row: ChallengeSettings
        Insert: {
          id?: 1
          start_date?: string | null
          timezone?: string
          duration_days?: number
          challenge_name?: string
          last_notified_challenge_day?: number
          updated_at?: string
        }
        Update: {
          id?: 1
          start_date?: string | null
          timezone?: string
          duration_days?: number
          challenge_name?: string
          last_notified_challenge_day?: number
          updated_at?: string
        }
        Relationships: []
      }
      challenge_days: {
        Row: ChallengeDay
        Insert: {
          id?: string
          challenge_id?: string
          day_number: number
          title?: string
          description?: string | null
          scripture_reference?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          challenge_id?: string
          day_number?: number
          title?: string
          description?: string | null
          scripture_reference?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'challenge_days_challenge_id_fkey'
            columns: ['challenge_id']
            isOneToOne: false
            referencedRelation: 'challenges'
            referencedColumns: ['id']
          }
        ]
      }
      activities: {
        Row: Activity
        Insert: {
          id?: string
          challenge_day_id: string
          description?: string
          sort_order?: number
          video_url?: string | null
        }
        Update: {
          id?: string
          challenge_day_id?: string
          description?: string
          sort_order?: number
          video_url?: string | null
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
      messages: {
        Row: Message
        Insert: {
          id?: string
          user_id?: string | null
          content?: string | null
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          content?: string | null
          image_url?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      announcements: {
        Row: Announcement
        Insert: {
          id?: string
          title: string
          body: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          body?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'announcements_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      journal_entries: {
        Row: JournalEntry
        Insert: {
          id?: string
          user_id: string
          challenge_day_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          challenge_day_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'journal_entries_challenge_day_id_fkey'
            columns: ['challenge_day_id']
            isOneToOne: false
            referencedRelation: 'challenge_days'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_entries_user_id_fkey'
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
      get_current_challenge_day: { Args: { target_challenge_id?: string }; Returns: number }
      get_member_streak: { Args: { member_id: string; target_challenge_id?: string }; Returns: number }
      get_member_stats: {
        Args: { member_id: string; target_challenge_id?: string }
        Returns: MemberStats[]
      }
      get_leaderboard: {
        Args: { target_challenge_id?: string }
        Returns: LeaderboardPayload | LeaderboardEntry[]
      }
      get_day_completion_counts: {
        Args: { target_challenge_id?: string }
        Returns: DayCompletionCount[]
      }
      get_challenge_status: {
        Args: { c_id: string }
        Returns: string
      }
      get_default_challenge_id: {
        Args: Record<string, never>
        Returns: string
      }
      get_table_counts: {
        Args: Record<string, never>
        Returns: Record<string, number>
      }
      seed_default_40_days: {
        Args: Record<string, never>
        Returns: void
      }
      delete_expired_push_subscription: {
        Args: { target_endpoint: string }
        Returns: void
      }
      can_access_challenge: {
        Args: { target_challenge_id: string }
        Returns: boolean
      }
      get_challenge_delete_summary: {
        Args: { target_challenge_id: string }
        Returns: ChallengeDeleteSummary
      }
      delete_challenge: {
        Args: { target_challenge_id: string; confirmed_name: string }
        Returns: { success: boolean; deleted_challenge_id: string; deleted_name: string }
      }
      grandfather_existing_participants: {
        Args: { target_challenge_id: string }
        Returns: number
      }
      can_access_course: {
        Args: { target_challenge_id: string }
        Returns: boolean
      }
      is_lesson_unlocked: {
        Args: { target_lesson_id: string; target_user_id: string }
        Returns: boolean
      }
      start_course: {
        Args: { target_challenge_id: string }
        Returns: { success: boolean }
      }
      confirm_block: {
        Args: { target_block_id: string }
        Returns: { success: boolean }
      }
      complete_lesson: {
        Args: { target_lesson_id: string }
        Returns: { success: boolean; lesson_id: string; completed_course: boolean }
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
