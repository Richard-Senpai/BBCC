import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BBCCLogo from '@/components/BBCCLogo'
import ThemeToggle from '@/components/ThemeToggle'
import ConsecrationMatrix from '@/components/dashboard/ConsecrationMatrix'
import type { Profile, MemberStats } from '@/lib/types'

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
            <h1 className="text-base font-black text-gray-900 dark:text-zinc-100">
              My Progress
            </h1>
            <p className="text-[10px] text-gray-500 dark:text-zinc-400">
              {profile.full_name} · {durationDays} Days of {challengeName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Stat cards */}
      <section className="px-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              value: stats.current_streak,
              label: 'Current Streak',
              color: 'text-amber-600 dark:text-amber-400',
              bg: 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40',
              suffix: stats.current_streak === 1 ? 'Day' : 'Days',
            },
            {
              value: stats.longest_run,
              label: 'Longest Run',
              color: 'text-orange-600 dark:text-orange-400',
              bg: 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200/50 dark:border-orange-900/40',
              suffix: stats.longest_run === 1 ? 'Day' : 'Days',
            },
            {
              value: `${stats.total_completed}/${durationDays}`,
              label: 'Disciplines',
              color: 'text-green-600 dark:text-green-400',
              bg: 'bg-green-50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-900/40',
              suffix: '',
            },
          ].map(({ value, label, color, bg, suffix }) => (
            <div key={label} className={`${bg} rounded-2xl p-3 text-center transition-colors`}>
              <p className={`text-xl font-black ${color} leading-none`}>
                {value}
              </p>
              {suffix && (
                <p className={`text-[10px] font-bold ${color} mt-0.5`}>
                  {suffix}
                </p>
              )}
              <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-1 leading-tight font-medium">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Overall progress bar */}
      <section className="px-4 mt-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 transition-colors">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">
              Consecration Journey
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {pct}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-gray-400 dark:text-zinc-500">
            <span>Day 1</span>
            <span>
              {currentDay > 0 && currentDay <= durationDays
                ? `Day ${currentDay} of ${durationDays}`
                : `Day ${durationDays}`}
            </span>
          </div>

          {/* Milestone markers */}
          <div className="flex justify-between mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
            {milestones.map((milestone) => {
              const reached = stats.total_completed >= milestone
              return (
                <div key={milestone} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      reached
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'
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
      <section className="px-4 mt-4">
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
        <section className="px-4 mt-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-dashed border-amber-300 dark:border-amber-600/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900/40 flex items-center justify-center text-xl">
                🎖️
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                  BBCC Certificate of Consecration
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                  Available upon Day {durationDays} completion
                </p>
              </div>
              <div className="ml-auto">
                <span className="text-xs text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-lg font-medium">
                  🔒 Locked
                </span>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
