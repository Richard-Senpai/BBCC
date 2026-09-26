import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Eye, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
import ThemeToggle from '@/components/ThemeToggle'
import LogoutButton from '@/components/LogoutButton'
import AnalyticsDashboard, {
  type MemberAnalyticsItem,
  type DayDetail,
} from '@/components/admin/AnalyticsDashboard'
import type { ChallengeSettings, Profile } from '@/lib/types'

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Double-check admin role strictly
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  // Parallel fetches for analytics
  const [
    settingsRes,
    daysRes,
    membersRes,
    activityCompletionsRes,
    dayCompletionsRes,
    currentDayRes,
  ] = await Promise.all([
    supabase.from('challenge_settings').select('*').eq('id', 1).single(),
    supabase
      .from('challenge_days')
      .select('id, day_number, title, description, activities(id, challenge_day_id, description, sort_order, video_url)')
      .order('day_number', { ascending: true }),
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'member')
      .order('created_at', { ascending: false }),
    supabase
      .from('activity_completions')
      .select('id, user_id, activity_id, completed_at'),
    supabase
      .from('completions')
      .select('id, user_id, challenge_day_id, completed_at'),
    supabase.rpc('get_current_challenge_day'),
  ])

  const settings: ChallengeSettings | null = settingsRes.data
  const durationDays = settings?.duration_days ?? 40
  const challengeName = settings?.challenge_name ?? 'Overcomer'
  const currentDay = (currentDayRes.data as number) ?? 0

  const rawDays = daysRes.data ?? []
  const days: DayDetail[] = rawDays.map((d) => ({
    id: d.id,
    day_number: d.day_number,
    title: d.title,
    description: d.description,
    activities: (d.activities ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
  }))

  const members: Profile[] = membersRes.data ?? []
  const allActivityCompletions = activityCompletionsRes.data ?? []
  const allDayCompletions = dayCompletionsRes.data ?? []

  // Compile per-member metrics with stats
  const memberItems: MemberAnalyticsItem[] = await Promise.all(
    members.map(async (m) => {
      const userActComps = allActivityCompletions.filter((ac) => ac.user_id === m.id)
      const userDayComps = allDayCompletions.filter((c) => c.user_id === m.id)

      const completedActivityMap: Record<string, string> = {}
      for (const ac of userActComps) {
        completedActivityMap[ac.activity_id] = ac.completed_at
      }

      const completedDayIds = userDayComps.map((c) => c.challenge_day_id)

      const lastComp = userActComps.sort(
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
        avatar_url: m.avatar_url ?? null,
        fellowship_unit: m.fellowship_unit || 'General Assembly',
        created_at: m.created_at,
        current_streak: stats.current_streak,
        longest_run: stats.longest_run,
        total_activities_completed: userActComps.length,
        total_days_completed: userDayComps.length,
        last_activity_date: lastComp?.completed_at ?? null,
        completedActivityMap,
        completedDayIds,
      }
    })
  )

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
                  Pastoral Analytics
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {durationDays} Days of {challengeName} — Member Discipline Audit
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

      {/* ── Main Analytics Container ────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <AnalyticsDashboard
          members={memberItems}
          days={days}
          durationDays={durationDays}
          challengeName={challengeName}
          currentDay={currentDay}
        />
      </div>
    </main>
  )
}
