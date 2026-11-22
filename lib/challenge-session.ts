import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { Challenge, ChallengeStatus, EnrollmentMode } from '@/lib/types'

export const SELECTED_CHALLENGE_COOKIE = 'bbcc_selected_challenge_id'

export interface ResolvedChallengeContext {
  targetChallenge: Challenge | null
  targetChallengeId: string | null
  durationDays: number
  challengeName: string
  challengeTitle: string
  startDate: string | null
  timezone: string
  status: ChallengeStatus
  currentDay: number
  enrollmentMode: EnrollmentMode
  canAccess: boolean
}

/**
 * Resolves the effective challenge for a member page:
 * 1. Checks explicit `overrideChallengeId` (e.g. from `searchParams.challenge`).
 * 2. If not specified, checks the session cookie `bbcc_selected_challenge_id`.
 * 3. If no cookie or challenge not found, defaults to the ACTIVE challenge.
 * 4. If no challenge is active (between challenges), defaults to the most recent challenge.
 */
export async function getEffectiveChallenge(
  overrideChallengeId?: string | null
): Promise<ResolvedChallengeContext> {
  const supabase = await createClient()
  const cookieStore = await cookies()

  // 1. Fetch all challenges ordered by start_date DESC (or challenges_with_status)
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
    // Fallback to legacy challenge_settings if challenges table is empty
    const { data: settings } = await supabase
      .from('challenge_settings')
      .select('*')
      .eq('id', 1)
      .single()

    const durationDays = settings?.duration_days ?? 40
    const challengeName = settings?.challenge_name ?? 'Overcomer'
    const startDate = settings?.start_date ?? null
    const timezone = settings?.timezone ?? 'Africa/Lagos'

    const { data: cDay } = await supabase.rpc('get_current_challenge_day')
    const currentDay = (cDay as number) ?? 0

    return {
      targetChallenge: null,
      targetChallengeId: null,
      durationDays,
      challengeName,
      challengeTitle: `${durationDays} Days of ${challengeName}`,
      startDate,
      timezone,
      status: currentDay > durationDays ? 'completed' : currentDay === 0 ? 'upcoming' : 'active',
      currentDay,
      enrollmentMode: 'open',
      canAccess: true,
    }
  }

  // Determine current active challenge based on dates
  const now = new Date()
  const challengesWithStatus = challenges.map((c) => {
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

    return {
      ...c,
      status,
      currentDay,
    }
  })

  const cookieChallengeId = cookieStore.get(SELECTED_CHALLENGE_COOKIE)?.value
  const candidateId = overrideChallengeId || cookieChallengeId

  let selected = candidateId
    ? challengesWithStatus.find((c) => c.id === candidateId)
    : null

  // If candidate was not found (or not provided), default to currently active challenge
  if (!selected) {
    selected = challengesWithStatus.find((c) => c.status === 'active') ?? null
  }

  // If still none (e.g. between challenges), default to the most recent completed challenge
  if (!selected && challengesWithStatus.length > 0) {
    selected = challengesWithStatus[0]
  }

  if (!selected) {
    return {
      targetChallenge: null,
      targetChallengeId: null,
      durationDays: 40,
      challengeName: 'Overcomer',
      challengeTitle: '40 Days of Overcomer',
      startDate: null,
      timezone: 'Africa/Lagos',
      status: 'active',
      currentDay: 1,
      enrollmentMode: 'open',
      canAccess: true,
    }
  }

  const durationDays = selected.duration_days
  const challengeName = selected.name
  const challengeTitle = `${durationDays} Days of ${challengeName}`
  const enrollmentMode: EnrollmentMode = (selected.enrollment_mode as EnrollmentMode) || 'open'

  let canAccess = true
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    const isApprovedAccount = profile?.status === 'approved'

    if (!isAdmin) {
      if (!isApprovedAccount) {
        canAccess = false
      } else if (enrollmentMode === 'approval') {
        const { data: enr } = await supabase
          .from('challenge_enrollments')
          .select('status')
          .eq('challenge_id', selected.id)
          .eq('user_id', user.id)
          .maybeSingle()
        canAccess = enr?.status === 'approved'
      }
    }
  } else {
    canAccess = false
  }

  return {
    targetChallenge: selected,
    targetChallengeId: selected.id,
    durationDays,
    challengeName,
    challengeTitle,
    startDate: selected.start_date,
    timezone: selected.timezone,
    status: selected.status,
    currentDay: selected.currentDay,
    enrollmentMode,
    canAccess,
  }
}
