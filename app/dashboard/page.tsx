import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
import UserAvatar from '@/components/UserAvatar'
import ThemeToggle from '@/components/ThemeToggle'
import LogoutButton from '@/components/LogoutButton'
import ActivityChecklist from '@/components/dashboard/ActivityChecklist'
import ConsecrationMatrix from '@/components/dashboard/ConsecrationMatrix'
import { Flame, BookOpen, Sparkles, Hourglass, Trophy, Users } from 'lucide-react'
import type {
  Profile,
  ChallengeSettings,
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

function getDayOfWeek(timezone = 'Africa/Lagos'): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: timezone,
  }).format(new Date())
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

function NotStartedView({
  profile,
  settings,
  durationDays,
  challengeName,
}: {
  profile: Profile
  settings: ChallengeSettings | null
  durationDays: number
  challengeName: string
}) {
  const firstName = profile.full_name.split(' ')[0]
  return (
    <div className="px-4 py-16 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--flame-accent)] shadow-2xs">
        <Hourglass size={24} strokeWidth={1.75} />
      </div>
      <h1 className="text-xl font-bold text-[var(--text-ink)] mb-2 font-serif">
        Consecration Begins Soon
      </h1>
      <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto leading-relaxed">
        Welcome, {firstName}. The {durationDays} Days of {challengeName} will commence as designated by pastoral leadership.
      </p>
      {settings?.start_date && (
        <p className="text-[var(--flame-accent)] font-semibold text-xs mt-4">
          Starting on{' '}
          {new Date(settings.start_date).toLocaleDateString('en-NG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}

function CompletedView({
  profile,
  durationDays,
  challengeName,
}: {
  profile: Profile
  durationDays: number
  challengeName: string
}) {
  const firstName = profile.full_name.split(' ')[0]
  return (
    <div className="px-4 py-16 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--covenant-subtle)] border border-[var(--covenant-accent)]/30 flex items-center justify-center text-[var(--covenant-accent)] shadow-2xs">
        <Trophy size={24} strokeWidth={1.75} />
      </div>
      <h1 className="text-xl font-bold text-[var(--text-ink)] mb-2 font-serif">
        Glory to God, {firstName}
      </h1>
      <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto leading-relaxed">
        You have completed the full course of the {durationDays} Days of {challengeName} Challenge. May the grace of consecration remain steadfast.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────
// Main page
// ─────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Parallel fetches: profile, settings, current day ──────
  const [profileRes, settingsRes, currentDayRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('challenge_settings')
      .select('*')
      .eq('id', 1)
      .single(),
    supabase.rpc('get_current_challenge_day'),
  ])

  const profile = profileRes.data
  const settings = settingsRes.data
  const currentDay = (currentDayRes.data as number) ?? 0

  if (!profile) redirect('/login')
  if (profile.role === 'admin') redirect('/admin')

  const timezone = settings?.timezone ?? 'Africa/Lagos'

  const durationDays = settings?.duration_days ?? 40
  const challengeName = settings?.challenge_name ?? 'Overcomer'
  const challengeTitle = `${durationDays} Days of ${challengeName}`

  // ── Determine phase ────────────────────────────────────────
  if (currentDay === 0) {
    return (
      <>
        <DashboardHeader profile={profile} streak={0} challengeTitle={challengeTitle} />
        <NotStartedView
          profile={profile}
          settings={settings}
          durationDays={durationDays}
          challengeName={challengeName}
        />
      </>
    )
  }
  if (currentDay > durationDays) {
    return (
      <>
        <DashboardHeader profile={profile} streak={0} challengeTitle={challengeTitle} />
        <CompletedView
          profile={profile}
          durationDays={durationDays}
          challengeName={challengeName}
        />
      </>
    )
  }

  // ── Active phase: fetch all dashboard data in parallel ─────
  const [challengeRes, activityCompRes, statsRes, completedDaysRes] =
    await Promise.all([
      supabase
        .from('challenge_days')
        .select('*')
        .eq('day_number', currentDay)
        .maybeSingle(),
      supabase
        .from('activity_completions')
        .select('activity_id')
        .eq('user_id', user.id),
      supabase.rpc('get_member_stats', { member_id: user.id }),
      supabase
        .from('completions')
        .select('challenge_days!inner(day_number)')
        .eq('user_id', user.id),
    ])

  const dayRow = challengeRes.data
  let activities: Activity[] = []

  if (dayRow?.id) {
    const { data: actData, error: actError } = await supabase
      .from('activities')
      .select('id, challenge_day_id, description, sort_order')
      .eq('challenge_day_id', dayRow.id)
      .order('sort_order', { ascending: true })

    if (actError) {
      console.error(`[Dashboard] Error loading activities for day ${currentDay} (${dayRow.id}):`, actError)
    } else {
      activities = actData ?? []
    }
  }

  const todayChallenge: ChallengeDayWithActivities | null = dayRow
    ? {
        ...dayRow,
        activities,
      }
    : null
  const completedActivityIds = (activityCompRes.data ?? []).map(
    (c) => c.activity_id
  )
  const stats: MemberStats = (statsRes.data as MemberStats[] | null)?.[0] ?? {
    current_streak: 0,
    longest_run: 0,
    total_completed: 0,
  }

  // Extract completed day numbers for the matrix
  const completedDayNumbers: number[] = (completedDaysRes.data ?? [])
    .map((c: Record<string, unknown>) => {
      const cd = c.challenge_days as { day_number?: number } | null
      return cd?.day_number ?? null
    })
    .filter((n): n is number => typeof n === 'number')

  const isDayComplete = completedDayNumbers.includes(currentDay)
  const pct = Math.round((stats.total_completed / durationDays) * 100 * 10) / 10
  const nextMilestone = getNextMilestone(currentDay, durationDays)
  const greeting = getGreeting(timezone)
  const dayOfWeek = getDayOfWeek(timezone)
  const firstName = profile.full_name.split(' ')[0]

  return (
    <>
      {/* ── Header ─────────────────────────────────────────── */}
      <DashboardHeader profile={profile} streak={stats.current_streak} challengeTitle={challengeTitle} />

      {/* ── Greeting with Avatar ────────────────────────────── */}
      <section className="px-4 mt-2">
        <div className="flex items-center gap-3 py-2">
          <UserAvatar
            avatarUrl={profile.avatar_url}
            name={profile.full_name}
            size="md"
          />
          <div className="min-w-0 flex-1">
            {profile.fellowship_unit && (
              <p className="text-[11px] font-semibold text-[var(--covenant-accent)] tracking-tight truncate">
                {profile.fellowship_unit}
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
              Day <strong className="text-[var(--text-ink)] font-bold">{currentDay}</strong> of {durationDays}
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
            <span>{stats.total_completed} of {durationDays} days completed</span>
            {nextMilestone && (
              <span className="text-[var(--flame-accent)] font-medium flex items-center gap-1">
                <Sparkles size={11} strokeWidth={2} />
                Day {nextMilestone.day} ({nextMilestone.daysLeft}d left)
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Today's Devotion card ────────────────────────────── */}
      <section className="px-4 mt-3">
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden transition-colors">
          {/* Card header */}
          <div className="px-4 pt-4 pb-3.5 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--flame-accent)]">
                Today&apos;s Devotional Focus
              </span>
              <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2.5 py-0.5 rounded-full border border-[var(--border-subtle)]">
                Day {currentDay}
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
                Content for Day {currentDay} is being prepared by church pastoral leadership.
              </p>
            )}
          </div>

          {/* Checklist */}
          <div className="px-4 py-4">
            {todayChallenge?.activities &&
            todayChallenge.activities.length > 0 ? (
              <ActivityChecklist
                dayId={todayChallenge.id}
                dayNumber={currentDay}
                activities={todayChallenge.activities}
                initialCompletedIds={completedActivityIds}
                isDayComplete={isDayComplete}
                isToday={true}
              />
            ) : (
              <p className="text-sm text-[var(--text-muted)] text-center py-4">
                Disciplines for Day {currentDay} will appear here.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Consecration Matrix ────────────────────────────── */}
      <section className="px-4 mt-3">
        <ConsecrationMatrix
          currentDay={currentDay}
          completedDayNumbers={completedDayNumbers}
          totalCompleted={stats.total_completed}
          durationDays={durationDays}
          challengeName={challengeName}
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
// Header sub-component (reused in edge states)
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
          <p className="text-xs font-bold text-[var(--text-ink)] tracking-tight">{challengeTitle ?? 'BBCC Consecration'}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Believers&apos; Banquet</p>
        </div>
      </div>

      {/* Right: streak pill + theme toggle + sign-out */}
      <div className="flex items-center gap-2">
        {streak > 0 && (
          <div className="flex items-center gap-1.5 bg-[var(--flame-subtle)] text-[var(--flame-accent)] border border-[var(--flame-accent)]/25 text-xs font-bold px-2.5 py-1 rounded-full">
            <Flame size={13} strokeWidth={2.2} className="text-[var(--flame-accent)]" />
            <span>{streak} {streak === 1 ? 'Day' : 'Days'}</span>
          </div>
        )}
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  )
}
