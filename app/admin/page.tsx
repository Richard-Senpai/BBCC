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
  UserCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
import ThemeToggle from '@/components/ThemeToggle'
import LogoutButton from '@/components/LogoutButton'
import ScheduleSettingsCard from '@/components/admin/ScheduleSettingsCard'
import CurriculumArchitect from '@/components/admin/CurriculumArchitect'
import MemberRosterTable, { type MemberRosterItem } from '@/components/admin/MemberRosterTable'
import AnnouncementManager from '@/components/admin/AnnouncementManager'
import PendingApprovalsSection from '@/components/admin/PendingApprovalsSection'
import type {
  Profile,
  ChallengeSettings,
  ChallengeDayWithActivities,
  DayCompletionCount,
  AnnouncementWithAuthor,
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
    announcementsRes,
  ] = await Promise.all([
    supabase.from('challenge_settings').select('*').eq('id', 1).single(),
    supabase
      .from('challenge_days')
      .select('*, activities(id, challenge_day_id, description, sort_order, video_url)')
      .order('day_number', { ascending: true }),
    supabase.rpc('get_day_completion_counts'),
    supabase.rpc('get_current_challenge_day'),
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('completions')
      .select('user_id, challenge_day_id, completed_at'),
    supabase
      .from('announcements')
      .select('id, title, body, created_by, created_at, profiles(full_name, avatar_url, role)')
      .order('created_at', { ascending: false }),
  ])

  const settings: ChallengeSettings | null = settingsRes.data
  const rawDays = daysRes.data ?? []
  const days: ChallengeDayWithActivities[] = rawDays.map((d) => ({
    ...d,
    activities: (d.activities ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }))

  const completionCounts: DayCompletionCount[] = (countsRes.data as DayCompletionCount[] | null) ?? []
  const currentDay = (currentDayRes.data as number) ?? 0
  const allMembers: Profile[] = membersRes.data ?? []
  const pendingMembers = allMembers.filter((m) => m.role !== 'admin' && m.status === 'pending')
  const approvedMembers = allMembers.filter((m) => m.role === 'admin' || m.status === 'approved' || !m.status)
  const rejectedMembers = allMembers.filter((m) => m.role !== 'admin' && m.status === 'rejected')
  const allCompletions = completionsRes.data ?? []
  const announcements: AnnouncementWithAuthor[] = (announcementsRes.data as unknown as AnnouncementWithAuthor[]) ?? []

  // Calculate Member Roster details for active approved members
  const rosterItems: MemberRosterItem[] = await Promise.all(
    approvedMembers.map(async (m) => {
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
        display_tag: m.display_tag ?? null,
        role: m.role,
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
  const totalEnrolled = approvedMembers.length

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
            <Link
              href="/admin/analytics"
              className="text-xs font-medium text-[var(--text-ink)] bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 size={13} strokeWidth={1.75} />
              <span>Export Analytics</span>
            </Link>
            {pendingMembers.length > 0 && (
              <a
                href="#pending-approvals"
                className="text-xs font-semibold text-[var(--flame-accent)] bg-[var(--flame-subtle)] border border-[var(--flame-accent)]/30 hover:bg-[var(--flame-accent)]/15 px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer animate-pulse"
                title="Review pending member signups"
              >
                <UserCheck size={13} strokeWidth={2} />
                <span>{pendingMembers.length} Pending Approval{pendingMembers.length > 1 ? 's' : ''}</span>
              </a>
            )}
            <a
              href="#announcement-manager"
              className="text-xs font-medium text-white bg-[var(--flame-accent)] hover:opacity-95 px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Megaphone size={13} strokeWidth={1.75} />
              <span>Broadcast Notice</span>
            </a>
          </div>
        </div>

        {/* ── Pending Approvals Alert Banner ─────────────────────── */}
        {pendingMembers.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--flame-subtle)] border border-[var(--flame-accent)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--flame-accent)] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <UserCheck size={20} strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-[var(--text-ink)]">
                    {pendingMembers.length} New Membership Application{pendingMembers.length > 1 ? 's' : ''} Awaiting Approval
                  </p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--flame-accent)] text-white">
                    Action Required
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Confirm these disciples belong to the BBCC congregation before granting access to dashboard, chat, and challenge milestones.
                </p>
              </div>
            </div>
            <a
              href="#pending-approvals"
              className="text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 px-3.5 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
            >
              <span>Review Applications</span>
              <span>&darr;</span>
            </a>
          </div>
        )}

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

        {/* ── Section: Church Announcements & Broadcasts ────────── */}
        <div className="mt-6">
          <AnnouncementManager initialAnnouncements={announcements} />
        </div>

        {/* ── Section: Pending Membership Approvals ─────────────── */}
        <div className="mt-6">
          <PendingApprovalsSection
            initialPendingMembers={pendingMembers}
            initialRejectedMembers={rejectedMembers}
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
