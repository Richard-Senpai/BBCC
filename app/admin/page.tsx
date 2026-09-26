import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Eye,
  ShieldCheck,
  BarChart3,
  Megaphone,
  Users,
  Flame,
  Calendar,
} from 'lucide-react'
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

  const durationDays = settings?.duration_days ?? 40
  const challengeName = settings?.challenge_name ?? 'Overcomer'

  // ── Stat calculations ──────────────────────────────────────
  const readyDaysCount = days.filter((d) => (d.activities?.length ?? 0) > 0).length
  const readinessPct = Math.round((readyDaysCount / durationDays) * 100)
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
    d.setDate(d.getDate() + (durationDays - 1))
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  })()

  return (
    <main className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-ink)] pb-20 transition-colors">
      {/* ── Top Admin Bar ───────────────────────────────────── */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] sticky top-0 z-40 transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BBCCLogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs font-semibold text-[var(--text-ink)] leading-tight">
                  Believers&apos; Banquet Christian Centre
                </h1>
                <span className="text-[10px] bg-[var(--bg-subtle)] text-[var(--flame-accent)] font-medium px-2 py-0.5 rounded-full border border-[var(--border-hairline)]">
                  Ile-Ife Assembly
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {durationDays} Days of {challengeName} — Pastoral Administration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard?preview=true"
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] border border-[var(--border-hairline)] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-2xs"
              title="Preview member dashboard experience"
            >
              <Eye size={13} strokeWidth={1.75} className="text-[var(--flame-accent)]" />
              <span>Member View</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium bg-[var(--bg-subtle)] text-[var(--text-ink)] px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)]">
              <ShieldCheck size={13} strokeWidth={1.75} className="text-[var(--flame-accent)]" />
              <span>{profile.full_name}</span>
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
            <span className="inline-flex items-center gap-1.5 bg-[var(--bg-subtle)] text-[var(--olive-accent)] text-xs font-medium px-2.5 py-0.5 rounded-full mb-1.5 border border-[var(--border-hairline)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--olive-accent)] inline-block" />
              Corporate Consecration &amp; Dominion
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--text-ink)]">
              Curriculum &amp; Fellowship Management
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Supervising devotional milestones, prayer adherence, and daily spiritual nourishment across Ile-Ife fellowships.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              className="text-xs font-medium text-[var(--text-ink)] bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 size={13} strokeWidth={1.75} />
              <span>Export Analytics</span>
            </button>
            <button
              type="button"
              className="text-xs font-medium text-white bg-[var(--flame-accent)] hover:opacity-95 px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Megaphone size={13} strokeWidth={1.75} />
              <span>Broadcast Notice</span>
            </button>
          </div>
        </div>

        {/* ── 4 Stat Summary Cards ────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Curriculum Readiness */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-xs border border-[var(--border-hairline)] flex items-center justify-between transition-colors">
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Curriculum Readiness
              </p>
              <p className="text-lg font-bold tracking-tight text-[var(--text-ink)] mt-1">
                {readyDaysCount} / {durationDays} <span className="text-xs font-normal text-[var(--text-muted)]">Days</span>
              </p>
              <p className="text-[10px] text-[var(--olive-accent)] font-medium mt-0.5">
                {readinessPct}% Complete ({Math.max(0, durationDays - readyDaysCount)} Remaining)
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-hairline)] flex items-center justify-center font-bold text-[var(--flame-accent)] text-xs">
              {readinessPct}%
            </div>
          </div>

          {/* Card 2: Active Members */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-xs border border-[var(--border-hairline)] flex items-center justify-between transition-colors">
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Active Church Members
              </p>
              <p className="text-lg font-bold tracking-tight text-[var(--text-ink)] mt-1">
                {totalEnrolled} <span className="text-xs font-normal text-[var(--text-muted)]">Enrolled</span>
              </p>
              <p className="text-[10px] text-[var(--olive-accent)] font-medium mt-0.5">
                All Active in Cohort
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] flex items-center justify-center border border-[var(--border-hairline)]">
              <Users size={16} strokeWidth={1.75} />
            </div>
          </div>

          {/* Card 3: Collective Streak */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-xs border border-[var(--border-hairline)] flex items-center justify-between transition-colors">
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Collective Church Streak
              </p>
              <p className="text-lg font-bold tracking-tight text-[var(--text-ink)] mt-1">
                {avgStreak} <span className="text-xs font-normal text-[var(--text-muted)]">Days Avg.</span>
              </p>
              <p className="text-[10px] text-[var(--flame-accent)] font-medium mt-0.5">
                High Spiritual Adherence
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[var(--bg-subtle)] text-[var(--flame-accent)] flex items-center justify-center border border-[var(--border-hairline)]">
              <Flame size={16} strokeWidth={1.75} />
            </div>
          </div>

          {/* Card 4: Challenge Timeline */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-xs border border-[var(--border-hairline)] flex items-center justify-between transition-colors">
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Challenge Timeline
              </p>
              <p className="text-lg font-bold tracking-tight text-[var(--text-ink)] mt-1">
                Day {currentDay > 0 ? currentDay : 0}{' '}
                <span className="text-xs font-normal text-[var(--text-muted)]">of {durationDays}</span>
              </p>
              <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">
                Ends {endDateStr}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] flex items-center justify-center border border-[var(--border-hairline)]">
              <Calendar size={16} strokeWidth={1.75} />
            </div>
          </div>
        </section>

        {/* ── Section 1: Schedule Settings ────────────────────── */}
        <div className="mt-6">
          <ScheduleSettingsCard
            settings={settings}
            hasChallengeDays={days.length > 0}
            existingDaysCount={days.length}
          />
        </div>

        {/* ── Section 2: Curriculum Matrix & Architect ─── */}
        <div className="mt-6">
          <CurriculumArchitect
            days={days}
            completionCounts={completionCounts}
            startDate={settings?.start_date ?? null}
            durationDays={durationDays}
            challengeName={challengeName}
          />
        </div>

        {/* ── Section 3: Fellowship Member Roster ──────────────── */}
        <div className="mt-6">
          <MemberRosterTable
            members={rosterItems}
            durationDays={durationDays}
          />
        </div>
      </div>
    </main>
  )
}
