'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SELECTED_CHALLENGE_COOKIE } from '@/lib/challenge-session'
import type { ChallengeStatus } from '@/lib/types'

export interface HubChallengeItem {
  id: string
  name: string
  duration_days: number
  start_date: string
  end_date: string
  timezone: string
  status: ChallengeStatus
  current_day: number
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

  // 1. Fetch all challenges from public.challenges (or challenges_with_status)
  let { data: challenges, error } = await supabase
    .from('challenges')
    .select('*')
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

  // 2. Process each challenge and gather stats
  const now = new Date()

  const items: HubChallengeItem[] = await Promise.all(
    challenges.map(async (c) => {
      const tz = c.timezone || 'Africa/Lagos'
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)
      const startStr = c.start_date
      const endDateTime = new Date(new Date(c.start_date + 'T00:00:00Z').getTime() + (c.duration_days - 1) * 86400000)
      const endStr = endDateTime.toISOString().split('T')[0]

      let status: ChallengeStatus = 'upcoming'
      let currentDay = 0

      if (todayStr < startStr) {
        status = 'upcoming'
        currentDay = 0
      } else if (todayStr > endStr) {
        status = 'completed'
        currentDay = c.duration_days + 1
      } else {
        status = 'active'
        const diffDays = Math.floor(
          (new Date(todayStr + 'T00:00:00Z').getTime() - new Date(startStr + 'T00:00:00Z').getTime()) /
            86400000
        )
        currentDay = diffDays + 1
      }

      // If upcoming, RLS blocks days and member has no activities yet
      if (status === 'upcoming') {
        return {
          id: c.id,
          name: c.name,
          duration_days: c.duration_days,
          start_date: c.start_date,
          end_date: endStr,
          timezone: tz,
          status,
          current_day: 0,
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

      // For active or completed challenges, fetch member's stats scoped to this challenge
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

      const pct = Math.min(100, Math.round((stats.total_completed / c.duration_days) * 100))

      return {
        id: c.id,
        name: c.name,
        duration_days: c.duration_days,
        start_date: c.start_date,
        end_date: endStr,
        timezone: tz,
        status,
        current_day: currentDay,
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
