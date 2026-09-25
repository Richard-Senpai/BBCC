import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
import ThemeToggle from '@/components/ThemeToggle'
import LogoutButton from '@/components/LogoutButton'
import ScheduleSettingsCard from '@/components/admin/ScheduleSettingsCard'
import CurriculumArchitect from '@/components/admin/CurriculumArchitect'
import MemberRosterTable, { type MemberRosterItem } from '@/components/admin/MemberRosterTable'
import type {
  Profile,
  ChallengeSettings,
  ChallengeDayWithActivities,
  DayCompletionCount,
} from '@/lib/types'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Double-check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  // Fetch all admin data in parallel
  const [
    settingsRes,
    daysRes,
    countsRes,
    currentDayRes,
    membersRes,
    completionsRes,
  ] = await Promise.all([
    supabase.from('challenge_settings').select('*').eq('id', 1).single(),
    supabase
      .from('challenge_days')
      .select('*, activities(id, challenge_day_id, description, sort_order)')
      .order('day_number', { ascending: true }),
    supabase.rpc('get_day_completion_counts'),
    supabase.rpc('get_current_challenge_day'),
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'member')
      .order('created_at', { ascending: false }),
    supabase
      .from('completions')
      .select('user_id, challenge_day_id, completed_at'),
  ])

  const settings: ChallengeSettings | null = settingsRes.data
  const rawDays = daysRes.data ?? []
  const days: ChallengeDayWithActivities[] = rawDays.map((d) => ({
    ...d,
    activities: (d.activities ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }))

  const completionCounts: DayCompletionCount[] = (countsRes.data as DayCompletionCount[] | null) ?? []
  const currentDay = (currentDayRes.data as number) ?? 0
  const members: Profile[] = membersRes.data ?? []
  const allCompletions = completionsRes.data ?? []

  // Calculate Member Roster details
  const rosterItems: MemberRosterItem[] = await Promise.all(
    members.map(async (m) => {
      const userComps = allCompletions.filter((c) => c.user_id === m.id)
      const lastComp = userComps.sort(
        (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      )[0]

      const statsRes = await supabase.rpc('get_member_stats', { member_id: m.id })
      const stats = (statsRes.data as { current_streak: number; longest_run: number }[] | null)?.[0] ?? {
        current_streak: 0,
        longest_run: 0,
      }

      return {
        id: m.id,
        full_name: m.full_name || 'Anonymous Believer',
        email: m.email,
        fellowship_unit: m.fellowship_unit || 'General Assembly',
        avatar_url: m.avatar_url ?? null,
        current_streak: stats.current_streak,
        longest_run: stats.longest_run,
        total_completed: userComps.length,
        last_activity_date: lastComp?.completed_at ?? null,
      }
    })
  )

  // ── Stat calculations ──────────────────────────────────────
  const readyDaysCount = days.filter((d) => (d.activities?.length ?? 0) > 0).length
  const readinessPct = Math.round((readyDaysCount / 40) * 100)
  const totalEnrolled = members.length

  const avgStreak =
    rosterItems.length > 0
      ? Math.round(
          rosterItems.reduce((acc, curr) => acc + curr.current_streak, 0) /
            rosterItems.length
        )
      : 0

  const endDateStr = (() => {
    if (!settings?.start_date) return 'Not set'
    const d = new Date(settings.start_date)
    d.setDate(d.getDate() + 39)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  })()

  return (
    <main className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 pb-20 transition-colors">
      {/* ── Top Admin Bar ───────────────────────────────────── */}
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-40 transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BBCCLogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs font-black text-gray-900 dark:text-zinc-100 leading-tight">
                  Believers&apos; Banquet Christian Centre
                </h1>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.2 rounded-full border border-amber-200/50 dark:border-amber-900/40">
                  Ile-Ife Assembly
                </span>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                BBCC 40-Day Challenge — Pastoral &amp; Admin Console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-bold text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
            >
              👁️ Member View
            </Link>
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-lg border border-amber-200/50 dark:border-amber-900/40">
              👑 {profile.full_name}
            </div>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* ── Main Container ──────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 text-xs font-bold px-2.5 py-0.5 rounded-full mb-1.5 border border-green-200/50 dark:border-green-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Cohort 2025: Consecration &amp; Dominion
            </span>
            <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-50 tracking-tight">
              Curriculum &amp; Fellowship Management
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
              Supervising devotional milestones, prayer adherence, and daily spiritual nourishment across Ile-Ife fellowships.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              className="text-xs font-bold text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 px-3 py-2 rounded-xl shadow-sm transition"
            >
              📊 Export Analytics
            </button>
            <button
              type="button"
              className="text-xs font-bold text-white bg-gray-950 dark:bg-zinc-800 hover:bg-gray-800 dark:hover:bg-zinc-700 px-3.5 py-2 rounded-xl shadow transition"
            >
              📢 Broadcast Notice
            </button>
          </div>
        </div>

        {/* ── 4 Stat Summary Cards ────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Curriculum Readiness */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-zinc-800 flex items-center justify-between transition-colors">
            <div>
              <p className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                Curriculum Readiness
              </p>
              <p className="text-xl font-black text-gray-900 dark:text-zinc-100 mt-1">
                {readyDaysCount} / 40 <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">Days</span>
              </p>
              <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold mt-0.5">
                ✓ {readinessPct}% Complete ({40 - readyDaysCount} Remaining)
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 flex items-center justify-center font-black text-amber-700 dark:text-amber-300 text-xs">
              {readinessPct}%
            </div>
          </div>

          {/* Card 2: Active Members */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-zinc-800 flex items-center justify-between transition-colors">
            <div>
              <p className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                Active Church Members
              </p>
              <p className="text-xl font-black text-gray-900 dark:text-zinc-100 mt-1">
                {totalEnrolled} <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">Enrolled</span>
              </p>
              <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold mt-0.5">
                ● {totalEnrolled} Active In Cohort
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex items-center justify-center text-lg">
              👥
            </div>
          </div>

          {/* Card 3: Collective Streak */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-zinc-800 flex items-center justify-between transition-colors">
            <div>
              <p className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                Collective Church Streak
              </p>
              <p className="text-xl font-black text-gray-900 dark:text-zinc-100 mt-1">
                {avgStreak} <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">Days Avg.</span>
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                🔥 High Spiritual Adherence
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">
              ⚡
            </div>
          </div>

          {/* Card 4: Challenge Timeline */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-zinc-800 flex items-center justify-between transition-colors">
            <div>
              <p className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                Challenge Timeline
              </p>
              <p className="text-xl font-black text-gray-900 dark:text-zinc-100 mt-1">
                Day {currentDay > 0 ? currentDay : 0}{' '}
                <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">of 40</span>
              </p>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-semibold mt-0.5">
                Ends {endDateStr}
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg">
              📅
            </div>
          </div>
        </section>

        {/* ── Section 1: Schedule Settings ────────────────────── */}
        <div className="mt-6">
          <ScheduleSettingsCard
            settings={settings}
            hasChallengeDays={days.length > 0}
          />
        </div>

        {/* ── Section 2: 40-Day Curriculum Matrix & Architect ─── */}
        <div className="mt-6">
          <CurriculumArchitect
            days={days}
            completionCounts={completionCounts}
            startDate={settings?.start_date ?? null}
          />
        </div>

        {/* ── Section 3: Fellowship Member Roster ──────────────── */}
        <div className="mt-6">
          <MemberRosterTable members={rosterItems} />
        </div>
      </div>
    </main>
  )
}
