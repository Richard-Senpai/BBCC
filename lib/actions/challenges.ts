'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SELECTED_CHALLENGE_COOKIE } from '@/lib/challenge-session'
import type { ChallengeStatus, EnrollmentMode, EnrollmentStatus } from '@/lib/types'

export interface HubChallengeItem {
  id: string
  name: string
  duration_days: number
  start_date: string
  end_date: string
  timezone: string
  status: ChallengeStatus
  current_day: number
  enrollment_mode: EnrollmentMode
  user_enrollment_status: 'none' | 'pending' | 'approved' | 'rejected'
  can_access: boolean
  // Member's stats
  participated: boolean
  user_total_activities: number
  user_completed_days: number
  user_streak: number
  user_longest_run: number
  user_rank: number | null
  total_participants: number
  progress_pct: number
}

export interface HubDataResponse {
  activeChallenge: HubChallengeItem | null
  upcomingChallenges: HubChallengeItem[]
  completedChallenges: HubChallengeItem[]
  betweenChallenges: boolean
  nextUpcomingStartDate: string | null
  nextUpcomingChallengeName: string | null
}

/**
 * Server action to set the member's selected challenge in session cookie.
 */
export async function setSessionChallenge(challengeId: string) {
  const cookieStore = await cookies()
  cookieStore.set(SELECTED_CHALLENGE_COOKIE, challengeId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax',
  })
  return { success: true }
}

/**
 * Fetch challenge hub data for the current authenticated member.
 */
export async function getMemberHubData(): Promise<HubDataResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthenticated')
  }

  // 1. Fetch member profile and enrollments
  const [profileRes, enrollmentsRes] = await Promise.all([
    supabase.from('profiles').select('id, role, status').eq('id', user.id).single(),
    supabase.from('challenge_enrollments').select('challenge_id, status').eq('user_id', user.id),
  ])

  const profile = profileRes.data
  const userEnrollments = enrollmentsRes.data ?? []

  // 2. Fetch all daily challenges from public.challenges (or challenges_with_status)
  let { data: challenges, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('type', 'daily')
    .order('start_date', { ascending: false })

  if (error || !challenges || challenges.length === 0) {
    const viewRes = await supabase
      .from('challenges_with_status')
      .select('*')
      .order('start_date', { ascending: false })
    if (viewRes.data && viewRes.data.length > 0) {
      challenges = viewRes.data as any
    }
  }

  if (!challenges || challenges.length === 0) {
    // Legacy fallback if challenges table has not been migrated yet
    const { data: settings } = await supabase
      .from('challenge_settings')
      .select('*')
      .eq('id', 1)
      .single()

    const durationDays = settings?.duration_days ?? 40
    const challengeName = settings?.challenge_name ?? 'Overcomer'
    const startDate = settings?.start_date ?? '2026-08-01'
    const timezone = settings?.timezone ?? 'Africa/Lagos'

    const { data: cDay } = await supabase.rpc('get_current_challenge_day')
    const currentDay = (cDay as number) ?? 0
    const isCompleted = currentDay > durationDays

    const sDate = new Date(startDate + 'T00:00:00Z')
    const eDate = new Date(sDate.getTime() + (durationDays - 1) * 86400000).toISOString().split('T')[0]

    const statsRes = await supabase.rpc('get_member_stats', { member_id: user.id })
    const stats = (statsRes.data as { current_streak: number; longest_run: number; total_completed: number }[] | null)?.[0] ?? {
      current_streak: 0,
      longest_run: 0,
      total_completed: 0,
    }

    const { count: actCount } = await supabase
      .from('activity_completions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const legacyItem: HubChallengeItem = {
      id: 'legacy-1',
      name: challengeName,
      duration_days: durationDays,
      start_date: startDate,
      end_date: eDate,
      timezone,
      status: isCompleted ? 'completed' : currentDay === 0 ? 'upcoming' : 'active',
      current_day: currentDay,
      enrollment_mode: 'open',
      user_enrollment_status: 'approved',
      can_access: true,
      participated: (actCount ?? 0) > 0,
      user_total_activities: actCount ?? 0,
      user_completed_days: stats.total_completed,
      user_streak: stats.current_streak,
      user_longest_run: stats.longest_run,
      user_rank: null,
      total_participants: 1,
      progress_pct: Math.min(100, Math.round((stats.total_completed / durationDays) * 100)),
    }

    return {
      activeChallenge: isCompleted ? null : legacyItem,
      upcomingChallenges: [],
      completedChallenges: isCompleted ? [legacyItem] : [],
      betweenChallenges: isCompleted,
      nextUpcomingStartDate: null,
      nextUpcomingChallengeName: null,
    }
  }

  // 3. Process each challenge and gather stats
  const now = new Date()

  const items: HubChallengeItem[] = await Promise.all(
    challenges.map(async (c) => {
      const cDuration = c.duration_days ?? 40
      const cStart = c.start_date || '2026-01-01'
      const tz = c.timezone || 'Africa/Lagos'
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)
      const startStr = cStart
      const endDateTime = new Date(new Date(cStart + 'T00:00:00Z').getTime() + (cDuration - 1) * 86400000)
      const endStr = endDateTime.toISOString().split('T')[0]

      let status: ChallengeStatus = 'upcoming'
      let currentDay = 0

      if (todayStr < startStr) {
        status = 'upcoming'
        currentDay = 0
      } else if (todayStr > endStr) {
        status = 'completed'
        currentDay = cDuration + 1
      } else {
        status = 'active'
        const diffDays = Math.floor(
          (new Date(todayStr + 'T00:00:00Z').getTime() - new Date(startStr + 'T00:00:00Z').getTime()) /
            86400000
        )
        currentDay = diffDays + 1
      }

      const enrollmentMode: EnrollmentMode = (c.enrollment_mode as EnrollmentMode) || 'open'
      const userEnrollment = userEnrollments.find((e) => e.challenge_id === c.id)
      const userEnrollmentStatus: 'none' | 'pending' | 'approved' | 'rejected' = userEnrollment
        ? (userEnrollment.status as 'pending' | 'approved' | 'rejected')
        : 'none'

      const isAdmin = profile?.role === 'admin'
      const isApprovedAccount = profile?.status === 'approved'
      const canAccess =
        isAdmin ||
        (isApprovedAccount &&
          (enrollmentMode === 'open' || userEnrollmentStatus === 'approved'))

      // If user cannot access this challenge, return basic info only with zero stats
      if (!canAccess) {
        return {
          id: c.id,
          name: c.name,
          duration_days: cDuration,
          start_date: cStart,
          end_date: endStr,
          timezone: tz,
          status,
          current_day: currentDay,
          enrollment_mode: enrollmentMode,
          user_enrollment_status: userEnrollmentStatus,
          can_access: false,
          participated: false,
          user_total_activities: 0,
          user_completed_days: 0,
          user_streak: 0,
          user_longest_run: 0,
          user_rank: null,
          total_participants: 0,
          progress_pct: 0,
        }
      }

      // If upcoming, RLS blocks days and member has no activities yet
      if (status === 'upcoming') {
        return {
          id: c.id,
          name: c.name,
          duration_days: cDuration,
          start_date: cStart,
          end_date: endStr,
          timezone: tz,
          status,
          current_day: 0,
          enrollment_mode: enrollmentMode,
          user_enrollment_status: userEnrollmentStatus,
          can_access: true,
          participated: false,
          user_total_activities: 0,
          user_completed_days: 0,
          user_streak: 0,
          user_longest_run: 0,
          user_rank: null,
          total_participants: 0,
          progress_pct: 0,
        }
      }

      // For active or completed challenges with access, fetch member's stats scoped to this challenge
      const [statsRes, actCompRes, leaderboardRes] = await Promise.all([
        supabase.rpc('get_member_stats', { member_id: user.id, target_challenge_id: c.id }),
        supabase
          .from('activity_completions')
          .select('activity_id, activities!inner(challenge_day_id, challenge_days!inner(challenge_id))', {
            count: 'exact',
            head: true,
          })
          .eq('user_id', user.id)
          .eq('activities.challenge_days.challenge_id', c.id),
        status === 'completed'
          ? supabase.rpc('get_leaderboard', { target_challenge_id: c.id })
          : Promise.resolve({ data: null }),
      ])

      const stats = (statsRes.data as { current_streak: number; longest_run: number; total_completed: number }[] | null)?.[0] ?? {
        current_streak: 0,
        longest_run: 0,
        total_completed: 0,
      }

      const userActCount = actCompRes.count ?? 0
      const lbData = leaderboardRes.data as { my_rank?: number | null; total_ranked_members?: number } | null
      const userRank = lbData?.my_rank != null ? Number(lbData.my_rank) : null
      const totalRanked = lbData?.total_ranked_members ?? 0

      const pct = Math.min(100, Math.round((stats.total_completed / cDuration) * 100))

      return {
        id: c.id,
        name: c.name,
        duration_days: cDuration,
        start_date: cStart,
        end_date: endStr,
        timezone: tz,
        status,
        current_day: currentDay,
        enrollment_mode: enrollmentMode,
        user_enrollment_status: userEnrollmentStatus,
        can_access: true,
        participated: userActCount > 0,
        user_total_activities: userActCount,
        user_completed_days: stats.total_completed,
        user_streak: stats.current_streak,
        user_longest_run: stats.longest_run,
        user_rank: userRank,
        total_participants: totalRanked,
        progress_pct: pct,
      }
    })
  )

  const activeChallenge = items.find((c) => c.status === 'active') ?? null
  const upcomingChallenges = items
    .filter((c) => c.status === 'upcoming')
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
  const completedChallenges = items
    .filter((c) => c.status === 'completed')
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())

  const betweenChallenges = activeChallenge === null

  const nextUpcoming = upcomingChallenges.length > 0 ? upcomingChallenges[0] : null

  return {
    activeChallenge,
    upcomingChallenges,
    completedChallenges,
    betweenChallenges,
    nextUpcomingStartDate: nextUpcoming?.start_date ?? null,
    nextUpcomingChallengeName: nextUpcoming?.name ?? null,
  }
}

/**
 * Request to join an approval-mode challenge.
 * Status is forced to 'pending', user_id = auth.uid().
 * Only allowed for non-completed approval challenges where no enrollment row exists.
 */
export async function requestChallengeEnrollment(challengeId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthenticated: please log in.' }
    }

    // 1. Verify user profile status
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.status !== 'approved') {
      return {
        success: false,
        error: 'Your church member account must be approved before requesting challenge entry.',
      }
    }

    // 2. Fetch challenge
    const { data: challenge } = await supabase
      .from('challenges')
      .select('id, name, start_date, duration_days, timezone, enrollment_mode, type, access_mode, access_end_date')
      .eq('id', challengeId)
      .single()

    if (!challenge) {
      return { success: false, error: 'Challenge not found' }
    }

    if (challenge.enrollment_mode !== 'approval') {
      return { success: false, error: 'This challenge has open enrollment; no request is needed.' }
    }

    const tz = challenge.timezone || 'Africa/Lagos'
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())

    if (challenge.type === 'course') {
      if (challenge.access_mode === 'fixed_end' && challenge.access_end_date && todayStr > challenge.access_end_date) {
        return { success: false, error: 'This course is closed for enrollment.' }
      }
    } else {
      const cDuration = challenge.duration_days ?? 40
      const cStart = challenge.start_date || '2026-01-01'
      const endStr = new Date(
        new Date(cStart + 'T00:00:00Z').getTime() + (cDuration - 1) * 86400000
      )
        .toISOString()
        .split('T')[0]

      if (todayStr > endStr) {
        return { success: false, error: 'This challenge is already completed. Join requests are closed.' }
      }
    }

    // 3. Check existing enrollment row
    const { data: existing } = await supabase
      .from('challenge_enrollments')
      .select('id, status')
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      if (existing.status === 'pending') {
        return { success: true } // Already requested
      }
      if (existing.status === 'approved') {
        return { success: true } // Already approved
      }
      if (existing.status === 'rejected') {
        return {
          success: false,
          error: 'Not enrolled in this challenge. Please reach out to church admin.',
        }
      }
    }

    // 4. Insert pending enrollment row
    const { error: insErr } = await supabase.from('challenge_enrollments').insert({
      challenge_id: challengeId,
      user_id: user.id,
      status: 'pending',
      requested_at: new Date().toISOString(),
    })

    if (insErr) {
      return { success: false, error: insErr.message }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to submit join request',
    }
  }
}

