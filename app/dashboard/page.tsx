import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
import UserAvatar from '@/components/UserAvatar'
import ThemeToggle from '@/components/ThemeToggle'
import LogoutButton from '@/components/LogoutButton'
import ActivityChecklist from '@/components/dashboard/ActivityChecklist'
import ConsecrationMatrix from '@/components/dashboard/ConsecrationMatrix'
import {
  Flame,
  BookOpen,
  Sparkles,
  Hourglass,
  Trophy,
  Users,
  Eye,
  ArrowLeft,
  History,
  Layers,
  Lock,
  CheckCircle2,
} from 'lucide-react'
import { getEffectiveChallenge, SELECTED_CHALLENGE_COOKIE } from '@/lib/challenge-session'
import type {
  Profile,
  ChallengeDayWithActivities,
  Activity,
  MemberStats,
} from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function getGreeting(timezone = 'Africa/Lagos'): string {
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    }).format(new Date()),
    10
  )
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getNextMilestone(
  currentDay: number,
  durationDays = 40
): { day: number; daysLeft: number } | null {
  const count = Math.min(6, Math.max(1, Math.floor(durationDays / 7)))
  const step = Math.max(1, Math.floor(durationDays / count))
  const milestones: number[] = []
  for (let i = 1; i < count; i++) {
    milestones.push(i * step)
  }
  milestones.push(durationDays)

  const next = milestones.find((m) => m > currentDay)
  if (!next) return null
  return { day: next, daysLeft: next - currentDay }
}

// ─────────────────────────────────────────
// Edge state views
// ─────────────────────────────────────────

function UpcomingChallengeView({
  profile,
  challengeTitle,
  startDate,
}: {
  profile: Profile
  challengeTitle: string
  startDate: string | null
}) {
  const firstName = profile.full_name.split(' ')[0]
  const formattedDate = startDate
    ? new Date(startDate + 'T00:00:00Z').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'a date designated by pastoral leadership'

  return (
    <div className="px-4 py-16 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--flame-accent)] shadow-2xs">
        <Hourglass size={24} strokeWidth={1.75} />
      </div>
      <h1 className="text-xl font-bold text-[var(--text-ink)] mb-2 font-serif">
        {challengeTitle}
      </h1>
      <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto leading-relaxed">
        Peace be with you, {firstName}. This consecration commences on <strong className="text-[var(--text-ink)]">{formattedDate}</strong>.
      </p>
      <p className="text-xs text-[var(--flame-accent)] font-semibold mt-3">
        Disciplines and day devotionals are locked until the cycle begins.
      </p>
      <div className="mt-6">
        <Link
          href="/hub"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-90 px-4 py-2 rounded-xl shadow-xs transition"
        >
          <Layers size={13} />
          <span>Return to Challenge Hub</span>
        </Link>
      </div>
    </div>
  )
}

function NoActiveChallengeView({ profile }: { profile: Profile }) {
  const firstName = profile.full_name.split(' ')[0]
  return (
    <div className="px-4 py-16 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--flame-accent)] shadow-2xs">
        <Hourglass size={24} strokeWidth={1.75} />
      </div>
      <h1 className="text-xl font-bold text-[var(--text-ink)] mb-2 font-serif">
        Between Consecration Cycles
      </h1>
      <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto leading-relaxed">
        Welcome, {firstName}. There is no active consecration running right now. You can revisit past challenges or preview upcoming cycles from the Hub.
      </p>
      <div className="mt-6">
        <Link
          href="/hub"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-90 px-4 py-2 rounded-xl shadow-xs transition"
        >
          <Layers size={13} />
          <span>Open Consecration Hub</span>
        </Link>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────

interface DashboardPageProps {
  searchParams?: Promise<{
    day?: string
    challenge?: string
    as_member?: string
    preview?: string
  }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient()
  const resolvedParams = searchParams ? await searchParams : {}

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Save session cookie if challenge was explicitly requested via search params
  if (resolvedParams.challenge) {
    try {
      const cookieStore = await cookies()
      cookieStore.set(SELECTED_CHALLENGE_COOKIE, resolvedParams.challenge, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      })
    } catch {
      // Ignored in read-only phase
    }
  }

  // ── Fetch current logged-in user profile ────────────────────
  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as { data: Profile | null; error: unknown }

  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'admin'
  if (!isAdmin && (profile.status === 'pending' || profile.status === 'rejected')) {
    redirect('/pending')
  }

  // ── Resolve Effective Challenge Context ─────────────────────
  const challengeCtx = await getEffectiveChallenge(resolvedParams.challenge)
  const {
    targetChallenge,
    targetChallengeId,
    durationDays,
    challengeName,
    challengeTitle,
    timezone,
    status: challengeStatus,
    currentDay,
    startDate,
  } = challengeCtx

  let effectiveMemberId = user.id
  let displayProfile = profile

  // If pastoral admin is previewing a specific member
  if (isAdmin && resolvedParams.as_member) {
    const { data: memberProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', resolvedParams.as_member)
      .maybeSingle()
    if (memberProfile) {
      displayProfile = memberProfile
      effectiveMemberId = memberProfile.id
    }
  }

  // ── Handle Edge Case: Non-enrolled in Approval Challenge ───────
  if (!isAdmin && !challengeCtx.canAccess) {
    redirect('/hub')
  }

  // ── Handle Edge Case: Upcoming Challenge ───────────────────
  if (challengeStatus === 'upcoming') {
    return (
      <>
        <DashboardHeader
          profile={displayProfile}
          streak={0}
          challengeTitle={challengeTitle}
        />
        <UpcomingChallengeView
          profile={displayProfile}
          challengeTitle={challengeTitle}
          startDate={startDate}
        />
      </>
    )
  }

  // ── Handle Edge Case: No Challenge Configured ───────────────
  if (!targetChallenge && !targetChallengeId) {
    return (
      <>
        <DashboardHeader
          profile={displayProfile}
          streak={0}
          challengeTitle="BBCC Consecration"
        />
        <NoActiveChallengeView profile={displayProfile} />
      </>
    )
  }

  const isCompletedChallenge = challengeStatus === 'completed'

  // ── Calculate Active Day ────────────────────────────────────
  // For completed challenge: default to day 1 (or requested ?day=)
  // For active challenge: default to currentDay (or requested ?day=)
  const parsedDay = resolvedParams.day ? parseInt(resolvedParams.day, 10) : null
  const hasSpecificDay = parsedDay !== null && !isNaN(parsedDay) && parsedDay > 0 && parsedDay <= durationDays

  let activeDayNum: number
  if (isCompletedChallenge) {
    activeDayNum = hasSpecificDay ? parsedDay : 1
  } else {
    activeDayNum = hasSpecificDay
      ? parsedDay
      : currentDay > 0 && currentDay <= durationDays
      ? currentDay
      : 1
  }

  const isToday = !isCompletedChallenge && currentDay > 0 && currentDay <= durationDays && activeDayNum === currentDay
  const isPastDayView = !isCompletedChallenge && hasSpecificDay && parsedDay !== currentDay

  // ── Fetch active day & effective member data in parallel ───
  let dayQuery = supabase
    .from('challenge_days')
    .select('*')
    .eq('day_number', activeDayNum)

  if (targetChallengeId) {
    dayQuery = dayQuery.eq('challenge_id', targetChallengeId)
  }

  const [
    challengeRes,
    activityCompRes,
    statsRes,
    completedDaysRes,
    allActsForChallengeRes,
    leaderboardRes,
  ] = await Promise.all([
    dayQuery.maybeSingle(),
    supabase
      .from('activity_completions')
      .select('activity_id')
      .eq('user_id', effectiveMemberId),
    targetChallengeId
      ? supabase.rpc('get_member_stats', { member_id: effectiveMemberId, target_challenge_id: targetChallengeId })
      : supabase.rpc('get_member_stats', { member_id: effectiveMemberId }),
    supabase
      .from('completions')
      .select('challenge_days!inner(day_number, challenge_id)')
      .eq('user_id', effectiveMemberId),
    targetChallengeId
      ? supabase
          .from('activity_completions')
          .select('activity_id, activities!inner(challenge_days!inner(challenge_id))', {
            count: 'exact',
            head: true,
          })
          .eq('user_id', effectiveMemberId)
          .eq('activities.challenge_days.challenge_id', targetChallengeId)
      : supabase
          .from('activity_completions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', effectiveMemberId),
    isCompletedChallenge && targetChallengeId
      ? supabase.rpc('get_leaderboard', { target_challenge_id: targetChallengeId })
      : Promise.resolve({ data: null }),
  ])

  const dayRow = challengeRes.data
  let activities: Activity[] = []

  if (dayRow?.id) {
    const { data: actData, error: actError } = await supabase
      .from('activities')
      .select('id, challenge_day_id, description, sort_order, video_url')
      .eq('challenge_day_id', dayRow.id)
      .order('sort_order', { ascending: true })

    if (actError) {
      console.error(`[Dashboard] Error loading activities for day ${activeDayNum} (${dayRow.id}):`, actError)
    } else {
      activities = actData ?? []
    }
  }

  // Fetch active day's journal note for user if day exists (strictly private)
  let initialJournalNote = ''
  if (dayRow?.id && (!isAdmin || effectiveMemberId === user.id)) {
    try {
      const { data: journalData } = await supabase
        .from('journal_entries')
        .select('content')
        .eq('user_id', effectiveMemberId)
        .eq('challenge_day_id', dayRow.id)
        .maybeSingle()
      if (journalData?.content) {
        initialJournalNote = journalData.content
      }
    } catch {
      // Safe fallback if table is not yet populated
    }
  }

  const todayChallenge: ChallengeDayWithActivities | null = dayRow
    ? {
        ...dayRow,
        activities,
      }
    : null

  const completedActivityIds = (activityCompRes.data ?? []).map((c) => c.activity_id)

  const stats: MemberStats = (statsRes.data as MemberStats[] | null)?.[0] ?? {
    current_streak: 0,
    longest_run: 0,
    total_completed: 0,
  }

  // Extract completed day numbers for this specific challenge's matrix
  const completedDayNumbers: number[] = (completedDaysRes.data ?? [])
    .map((c: Record<string, unknown>) => {
      const cd = c.challenge_days as { day_number?: number; challenge_id?: string } | null
      if (targetChallengeId && cd?.challenge_id && cd.challenge_id !== targetChallengeId) {
        return null
      }
      return cd?.day_number ?? null
    })
    .filter((n): n is number => typeof n === 'number')

  const isDayComplete = completedDayNumbers.includes(activeDayNum)
  const pct = Math.round((stats.total_completed / durationDays) * 100 * 10) / 10
  const nextMilestone = isCompletedChallenge ? null : getNextMilestone(currentDay, durationDays)
  const greeting = getGreeting(timezone)
  const firstName = displayProfile.full_name.split(' ')[0]

  // Completed challenge archive stats
  const userActivitiesCount = allActsForChallengeRes.count ?? 0
  const lbData = leaderboardRes.data as { my_rank?: number | null } | null
  const userFinalRank = lbData?.my_rank != null ? Number(lbData.my_rank) : null

  return (
    <>
      {/* ── Pastoral Preview Mode Banner ───────────────────── */}
      {isAdmin && (
        <aside className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--flame-accent)]/30 px-4 py-2 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[var(--flame-accent)] animate-pulse shrink-0" />
            <span className="font-bold text-[var(--flame-accent)] flex items-center gap-1.5 shrink-0">
              <Eye size={13} strokeWidth={2} />
              Pastoral Preview Mode
            </span>
            <span className="text-[var(--text-muted)] text-[11px] truncate hidden sm:inline">
              — Viewing {effectiveMemberId !== user.id ? `disciple: ${displayProfile.full_name}` : 'member dashboard experience'}
            </span>
          </div>
          <Link
            href="/admin"
            className="text-[11px] font-semibold text-white bg-[var(--flame-accent)] hover:opacity-90 px-2.5 py-1 rounded-md transition shadow-2xs flex items-center gap-1 shrink-0"
          >
            <ArrowLeft size={11} strokeWidth={2} />
            <span>Return to Admin</span>
          </Link>
        </aside>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <DashboardHeader
        profile={profile}
        streak={stats.current_streak}
        challengeTitle={challengeTitle}
      />

      {/* ── COMPLETED CHALLENGE: View-Only Archive Banner ───── */}
      {isCompletedChallenge && (
        <div className="mx-4 mt-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
              <Lock size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Completed Challenge — View-Only Archive
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 truncate">
                All {durationDays} days are unlocked for devotional study. Checklists &amp; notes are read-only.
              </p>
            </div>
          </div>
          <Link
            href="/hub"
            className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1 rounded-lg shrink-0 transition"
          >
            Hub
          </Link>
        </div>
      )}

      {/* ── COMPLETED CHALLENGE: Personal Summary Records ────── */}
      {isCompletedChallenge && (
        <section className="px-4 mt-3">
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-subtle)] transition-colors shadow-2xs">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-[var(--flame-accent)] uppercase tracking-wider flex items-center gap-1.5">
                <Trophy size={14} />
                <span>Your Consecration Record</span>
              </span>
              <span className="text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
                Final Archive
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <span className="text-base font-bold text-[var(--text-ink)] leading-none block">
                  {userActivitiesCount}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] mt-1 block">Activities</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <span className="text-base font-bold text-[var(--covenant-accent)] leading-none block">
                  {stats.total_completed}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] mt-1 block">Full Days</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <span className="text-base font-bold text-[var(--flame-accent)] leading-none block">
                  {stats.longest_run}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] mt-1 block">Best Streak</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <span className="text-base font-bold text-[var(--text-ink)] leading-none block">
                  {userFinalRank ? `#${userFinalRank}` : '—'}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] mt-1 block">Final Rank</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── ACTIVE CHALLENGE: Past Day Historical Review Banner ─ */}
      {isPastDayView && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <History size={14} strokeWidth={2} className="text-[var(--flame-accent)] shrink-0" />
            <p className="text-xs font-semibold text-[var(--text-ink)]">
              Viewing Day {activeDayNum} Historical Record
            </p>
          </div>
          <Link
            href={`/dashboard${targetChallengeId ? `?challenge=${targetChallengeId}` : ''}${effectiveMemberId !== user.id ? `&as_member=${effectiveMemberId}` : ''}`}
            className="text-[11px] font-semibold text-[var(--flame-accent)] hover:underline flex items-center gap-1"
          >
            <span>Return to Today (Day {currentDay})</span>
          </Link>
        </div>
      )}

      {/* ── Greeting with Avatar ────────────────────────────── */}
      <section className="px-4 mt-2">
        <div className="flex items-center gap-3 py-2">
          <UserAvatar
            avatarUrl={displayProfile.avatar_url}
            name={displayProfile.full_name}
            size="md"
          />
          <div className="min-w-0 flex-1">
            {displayProfile.fellowship_unit && (
              <p className="text-[11px] font-semibold text-[var(--covenant-accent)] tracking-tight truncate">
                {displayProfile.fellowship_unit}
              </p>
            )}
            <h1 className="text-lg font-bold text-[var(--text-ink)] leading-snug truncate font-serif">
              {greeting}, {firstName}
            </h1>
          </div>
        </div>
      </section>

      {/* ── Progress bar ────────────────────────────────────── */}
      <section className="px-4 mt-2">
        <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-subtle)] transition-colors">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[var(--text-muted)]">
              {isCompletedChallenge ? (
                <>
                  <strong className="text-[var(--text-ink)] font-bold">{durationDays}</strong> Days Course Concluded
                </>
              ) : (
                <>
                  Day <strong className="text-[var(--text-ink)] font-bold">{currentDay}</strong> of {durationDays}
                </>
              )}
            </span>
            <span className="font-semibold text-[var(--flame-accent)]">{pct}% completed</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--flame-accent)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>
              {stats.total_completed} of {durationDays} days completed
            </span>
            {nextMilestone && (
              <span className="text-[var(--flame-accent)] font-medium flex items-center gap-1">
                <Sparkles size={11} strokeWidth={2} />
                Day {nextMilestone.day} ({nextMilestone.daysLeft}d left)
              </span>
            )}
            {isCompletedChallenge && (
              <span className="text-[var(--covenant-accent)] font-medium flex items-center gap-1">
                <CheckCircle2 size={11} strokeWidth={2} />
                Archived Course
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Day's Devotion Card ────────────────────────────── */}
      <section className="px-4 mt-3">
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden transition-colors">
          {/* Card header */}
          <div className="px-4 pt-4 pb-3.5 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--flame-accent)]">
                {isToday
                  ? "Today's Devotional Focus"
                  : `Day ${activeDayNum} Devotional Focus${isCompletedChallenge ? ' (Archive)' : ''}`}
              </span>
              <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2.5 py-0.5 rounded-full border border-[var(--border-subtle)]">
                Day {activeDayNum}
              </span>
            </div>

            {todayChallenge ? (
              <>
                <h2 className="text-base font-bold text-[var(--text-ink)] leading-snug font-serif">
                  {todayChallenge.title}
                </h2>
                {todayChallenge.scripture_reference && (
                  <p className="text-xs text-[var(--flame-accent)] font-serif italic mt-1 flex items-center gap-1.5">
                    <BookOpen size={13} strokeWidth={1.75} className="shrink-0" />
                    <span>{todayChallenge.scripture_reference}</span>
                  </p>
                )}
                {todayChallenge.description && (
                  <div className="mt-2.5 bg-[var(--bg-subtle)] border-l-2 border-[var(--flame-accent)] rounded-r-xl p-3">
                    <p className="text-xs text-[var(--text-ink)]/90 leading-relaxed font-serif italic">
                      &ldquo;{todayChallenge.description}&rdquo;
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)] italic mt-2">
                Content for Day {activeDayNum} is being prepared by church pastoral leadership.
              </p>
            )}
          </div>

          {/* Checklist */}
          <div className="px-4 py-4">
            {todayChallenge?.activities && todayChallenge.activities.length > 0 ? (
              <ActivityChecklist
                dayId={todayChallenge.id}
                dayNumber={activeDayNum}
                activities={todayChallenge.activities}
                initialCompletedIds={completedActivityIds}
                isDayComplete={isDayComplete}
                isToday={isToday}
                currentDay={currentDay}
                initialJournalContent={initialJournalNote}
                isPastoralPreview={isAdmin && effectiveMemberId !== user.id}
                isCompletedChallenge={isCompletedChallenge}
              />
            ) : (
              <p className="text-sm text-[var(--text-muted)] text-center py-4">
                Disciplines for Day {activeDayNum} will appear here.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Consecration Matrix ────────────────────────────── */}
      <section className="px-4 mt-3">
        <ConsecrationMatrix
          currentDay={currentDay > 0 && currentDay <= durationDays ? currentDay : null}
          selectedDay={activeDayNum}
          completedDayNumbers={completedDayNumbers}
          totalCompleted={stats.total_completed}
          durationDays={durationDays}
          challengeName={challengeName}
          challengeId={targetChallengeId}
          isCompletedChallenge={isCompletedChallenge}
          asMemberId={effectiveMemberId !== user.id ? effectiveMemberId : undefined}
        />
      </section>

      {/* ── Corporate Prayer Watch Banner ───────────────────── */}
      <section className="px-4 mt-3">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--covenant-subtle)] border border-[var(--covenant-accent)]/20 flex items-center justify-center text-[var(--covenant-accent)] shrink-0">
              <Users size={16} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--text-ink)]">Corporate Prayer Watch</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Believers praying in agreement across Ile-Ife
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-[var(--covenant-accent)] bg-[var(--covenant-subtle)] hover:bg-[var(--covenant-accent)] hover:text-white px-3 py-1.5 rounded-lg border border-[var(--covenant-accent)]/25 transition-colors"
          >
            Join Watch
          </button>
        </div>
      </section>
    </>
  )
}

// ─────────────────────────────────────────
// Header Sub-Component
// ─────────────────────────────────────────

function DashboardHeader({
  profile,
  streak,
  challengeTitle,
}: {
  profile: Profile
  streak: number
  challengeTitle?: string
}) {
  return (
    <header className="px-4 pt-5 pb-2 flex items-center justify-between">
      {/* Left: logo + app name */}
      <div className="flex items-center gap-2.5">
        <BBCCLogo size="sm" />
        <div className="leading-tight">
          <p className="text-xs font-bold text-[var(--text-ink)] tracking-tight">
            {challengeTitle ?? 'BBCC Consecration'}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Believers&apos; Banquet</p>
        </div>
      </div>

      {/* Right: Switch Challenge button + streak pill + theme toggle + sign-out */}
      <div className="flex items-center gap-2">
        <Link
          href="/hub"
          title="Switch Challenge Hub"
          className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-ink)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full transition shadow-2xs"
        >
          <Layers size={12} className="text-[var(--flame-accent)]" />
          <span>Hub</span>
        </Link>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 bg-[var(--flame-subtle)] text-[var(--flame-accent)] border border-[var(--flame-accent)]/25 text-xs font-bold px-2.5 py-1 rounded-full">
            <Flame size={13} strokeWidth={2.2} className="text-[var(--flame-accent)]" />
            <span>
              {streak} {streak === 1 ? 'Day' : 'Days'}
            </span>
          </div>
        )}
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  )
}
