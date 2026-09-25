import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
import LogoutButton from '@/components/LogoutButton'
import ActivityChecklist from '@/components/dashboard/ActivityChecklist'
import ConsecrationMatrix from '@/components/dashboard/ConsecrationMatrix'
import type {
  Profile,
  ChallengeSettings,
  ChallengeDayWithActivities,
  MemberStats,
} from '@/lib/types'

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
  currentDay: number
): { day: number; daysLeft: number } | null {
  const milestones = [7, 14, 21, 28, 35, 40]
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
}: {
  profile: Profile
  settings: ChallengeSettings | null
}) {
  const firstName = profile.full_name.split(' ')[0]
  return (
    <div className="px-4 py-12 text-center">
      <div className="text-6xl mb-4">⏳</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Challenge not started yet
      </h1>
      <p className="text-gray-500 text-sm mb-1">
        Welcome, {firstName}! The 40-Day Consecration will begin once your
        pastor sets the start date.
      </p>
      {settings?.start_date && (
        <p className="text-amber-700 font-semibold text-sm mt-3">
          Starting:{' '}
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

function CompletedView({ profile }: { profile: Profile }) {
  const firstName = profile.full_name.split(' ')[0]
  return (
    <div className="px-4 py-12 text-center">
      <div className="text-6xl mb-4">🏆</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Glory to God, {firstName}!
      </h1>
      <p className="text-gray-600 text-sm">
        You have completed the 40-Day Consecration Challenge. Your certificate
        of consecration will be issued soon.
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

  // ── Determine phase ────────────────────────────────────────
  if (currentDay === 0) {
    return (
      <>
        <DashboardHeader profile={profile} streak={0} />
        <NotStartedView profile={profile} settings={settings} />
      </>
    )
  }
  if (currentDay === 41) {
    return (
      <>
        <DashboardHeader profile={profile} streak={0} />
        <CompletedView profile={profile} />
      </>
    )
  }

  // ── Active phase: fetch all dashboard data in parallel ─────
  const [challengeRes, activityCompRes, statsRes, completedDaysRes] =
    await Promise.all([
      supabase
        .from('challenge_days')
        .select('*, activities(id, challenge_day_id, description, sort_order)')
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

  const todayChallenge = challengeRes.data
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
  const pct = Math.round((stats.total_completed / 40) * 100 * 10) / 10
  const nextMilestone = getNextMilestone(currentDay)
  const greeting = getGreeting(timezone)
  const dayOfWeek = getDayOfWeek(timezone)
  const firstName = profile.full_name.split(' ')[0]

  return (
    <>
      {/* ── Header ─────────────────────────────────────────── */}
      <DashboardHeader profile={profile} streak={stats.current_streak} />

      {/* ── Greeting ────────────────────────────────────────── */}
      <section className="px-4 mt-3">
        {profile.fellowship_unit && (
          <p className="text-xs font-semibold text-green-700 flex items-center gap-1 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            {profile.fellowship_unit.toUpperCase()}
          </p>
        )}
        <h1 className="text-2xl font-black text-gray-950 leading-tight">
          {greeting}, {firstName}{' '}
          <span aria-hidden="true">
            {greeting.startsWith('Good m') ? '☀️' : greeting.startsWith('Good a') ? '🌤️' : '🌙'}
          </span>
        </h1>
      </section>

      {/* ── Progress bar ────────────────────────────────────── */}
      <section className="px-4 mt-3">
        <div className="flex items-center justify-between text-sm font-semibold mb-1.5">
          <span className="text-gray-800">
            Day <span className="text-amber-600">{currentDay}</span> of 40
          </span>
          <span className="text-amber-600">{pct}% Completed</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1 flex-wrap">
          <span>{stats.total_completed} of 40 days completed</span>
          {nextMilestone && (
            <>
              <span>·</span>
              <span className="text-amber-600 font-medium">
                ⚡ Milestone: Day {nextMilestone.day} in{' '}
                {nextMilestone.daysLeft}{' '}
                {nextMilestone.daysLeft === 1 ? 'day' : 'days'}
              </span>
            </>
          )}
        </p>
      </section>

      {/* ── Today's Devotion card ────────────────────────────── */}
      <section className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                  Today&apos;s Devotion
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  {dayOfWeek} Consecration
                </p>
              </div>
              <div className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                Day {currentDay}
              </div>
            </div>

            {todayChallenge ? (
              <>
                <h2 className="text-base font-bold text-gray-900 mt-2 leading-snug">
                  {todayChallenge.title}
                </h2>
                {todayChallenge.description && (
                  <div className="mt-2 bg-amber-50 rounded-xl p-3">
                    <p className="text-xs text-gray-700 leading-relaxed italic">
                      &ldquo;{todayChallenge.description}&rdquo;
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic mt-2">
                Content for Day {currentDay} is being prepared — check back
                soon.
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
              <p className="text-sm text-gray-400 text-center py-4">
                Activities for Day {currentDay} will appear here.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── 40-Day Matrix ────────────────────────────────────── */}
      <section className="px-4 mt-4">
        <ConsecrationMatrix
          currentDay={currentDay}
          completedDayNumbers={completedDayNumbers}
          totalCompleted={stats.total_completed}
        />
      </section>

      {/* ── Prayer Chain banner (placeholder) ───────────────── */}
      <section className="px-4 mt-4">
        <div className="bg-amber-900 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center">
              <span className="text-sm">🙏</span>
            </div>
            <div>
              <p className="text-xs font-bold text-white">Prayer Chain Active</p>
              <p className="text-[10px] text-amber-300">
                Believers praying in unity now
              </p>
            </div>
          </div>
          <button className="text-xs font-bold text-amber-400 bg-amber-800 px-3 py-1.5 rounded-lg">
            Join · Watch
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
}: {
  profile: Profile
  streak: number
}) {
  return (
    <header className="px-4 pt-5 pb-2 flex items-center justify-between">
      {/* Left: logo + app name */}
      <div className="flex items-center gap-2">
        <BBCCLogo size="sm" />
        <div className="leading-tight">
          <p className="text-xs font-black text-gray-900">BBCC 40-Day</p>
          <p className="text-[10px] text-gray-500">Believers&apos; Banquet</p>
        </div>
      </div>

      {/* Right: streak pill + sign-out */}
      <div className="flex items-center gap-2">
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm shadow-amber-200">
            🔥 {streak} {streak === 1 ? 'Day' : 'Days'}
          </div>
        )}
        <LogoutButton />
      </div>
    </header>
  )
}
