import { redirect } from 'next/navigation'
import { Flame, TrendingUp, CheckCheck, Award, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
import ThemeToggle from '@/components/ThemeToggle'
import ConsecrationMatrix from '@/components/dashboard/ConsecrationMatrix'
import type { MemberStats } from '@/lib/types'

export default async function ProgressPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, settingsRes, currentDayRes, statsRes, completedDaysRes] =
    await Promise.all([
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
      supabase.rpc('get_member_stats', { member_id: user.id }),
      supabase
        .from('completions')
        .select('challenge_days!inner(day_number)')
        .eq('user_id', user.id),
    ])

  const profile = profileRes.data
  if (!profile) redirect('/login')

  const settings = settingsRes.data
  const durationDays = settings?.duration_days ?? 40
  const challengeName = settings?.challenge_name ?? 'Overcomer'
  const currentDay = (currentDayRes.data as number) ?? 0
  const stats: MemberStats = (statsRes.data as MemberStats[] | null)?.[0] ?? {
    current_streak: 0,
    longest_run: 0,
    total_completed: 0,
  }

  const completedDayNumbers: number[] = (completedDaysRes.data ?? [])
    .map((c: Record<string, unknown>) => {
      const cd = c.challenge_days as { day_number?: number } | null
      return cd?.day_number ?? null
    })
    .filter((n): n is number => typeof n === 'number')

  const pct = Math.round((stats.total_completed / durationDays) * 1000) / 10

  // Dynamic milestones up to durationDays
  const milestoneCount = Math.min(6, Math.max(1, Math.floor(durationDays / 7)))
  const step = Math.max(1, Math.floor(durationDays / milestoneCount))
  const milestones: number[] = []
  for (let i = 1; i < milestoneCount; i++) {
    milestones.push(i * step)
  }
  milestones.push(durationDays)

  return (
    <>
      {/* Header */}
      <header className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BBCCLogo size="sm" />
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-[var(--text-ink)]">
              Personal Consecration Progress
            </h1>
            <p className="text-[11px] text-[var(--text-muted)]">
              {profile.full_name} / {durationDays} Days of {challengeName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Stat cards */}
      <section className="px-4 mt-1">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-3 text-center">
            <div className="flex items-center justify-center text-[var(--flame-accent)] mb-1">
              <Flame size={16} strokeWidth={1.75} />
            </div>
            <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] leading-none">
              {stats.current_streak}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
              Current Streak
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-3 text-center">
            <div className="flex items-center justify-center text-[var(--text-muted)] mb-1">
              <TrendingUp size={16} strokeWidth={1.75} />
            </div>
            <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] leading-none">
              {stats.longest_run}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
              Longest Run
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-3 text-center">
            <div className="flex items-center justify-center text-[var(--olive-accent)] mb-1">
              <CheckCheck size={16} strokeWidth={1.75} />
            </div>
            <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] leading-none">
              {stats.total_completed}
              <span className="text-xs font-normal text-[var(--text-muted)]">/{durationDays}</span>
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
              Disciplines
            </p>
          </div>
        </div>
      </section>

      {/* Overall progress bar */}
      <section className="px-4 mt-3">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--text-ink)]">
              Consecration Milestone
            </span>
            <span className="text-xs font-semibold text-[var(--flame-accent)]">
              {pct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--flame-accent)] transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-[var(--text-muted)]">
            <span>Day 1</span>
            <span>
              {currentDay > 0 && currentDay <= durationDays
                ? `Day ${currentDay} of ${durationDays}`
                : `Day ${durationDays}`}
            </span>
          </div>

          {/* Milestone markers */}
          <div className="flex justify-between mt-3 pt-3 border-t border-[var(--border-hairline)]">
            {milestones.map((milestone) => {
              const reached = stats.total_completed >= milestone
              return (
                <div key={milestone} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-colors ${
                      reached
                        ? 'bg-[var(--flame-accent)] text-white'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hairline)]'
                    }`}
                  >
                    {milestone}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Full Consecration Matrix */}
      <section className="px-4 mt-3">
        <ConsecrationMatrix
          currentDay={currentDay > 0 && currentDay <= durationDays ? currentDay : null}
          completedDayNumbers={completedDayNumbers}
          totalCompleted={stats.total_completed}
          durationDays={durationDays}
          challengeName={challengeName}
        />
      </section>

      {/* Certificate preview */}
      {stats.total_completed < durationDays && (
        <section className="px-4 mt-3 mb-4">
          <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-dashed border-[var(--border-hairline)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-subtle)] text-[var(--flame-accent)] flex items-center justify-center shrink-0 border border-[var(--border-hairline)]">
                <Award size={18} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--text-ink)]">
                  BBCC Certificate of Consecration
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Conferred upon completion of Day {durationDays}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1 text-[11px] text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-1 rounded-md border border-[var(--border-hairline)]">
                <Lock size={12} strokeWidth={1.75} />
                <span>Locked</span>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
