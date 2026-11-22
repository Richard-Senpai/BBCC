import { Flame, CheckCheck, Trophy } from 'lucide-react'
import type { HomeQuickStats } from '@/lib/actions/home'

interface HomeQuickStatsProps {
  stats: HomeQuickStats
}

export default function HomeQuickStatsComponent({ stats }: HomeQuickStatsProps) {
  return (
    <section className="px-4 mt-3">
      <div className="grid grid-cols-3 gap-2.5">
        {/* Streak */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-3 text-center transition-colors shadow-2xs">
          <div className="flex items-center justify-center text-[var(--flame-accent)] mb-1">
            <Flame size={17} strokeWidth={2} />
          </div>
          <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] leading-none">
            {stats.streak}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
            Day Streak
          </p>
        </div>

        {/* Total Activities */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-3 text-center transition-colors shadow-2xs">
          <div className="flex items-center justify-center text-[var(--covenant-accent)] mb-1">
            <CheckCheck size={17} strokeWidth={2} />
          </div>
          <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] leading-none">
            {stats.totalActivitiesCompleted}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
            Activities Done
          </p>
        </div>

        {/* Completed Challenges & Courses */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-3 text-center transition-colors shadow-2xs">
          <div className="flex items-center justify-center text-[var(--flame-accent)] mb-1">
            <Trophy size={17} strokeWidth={1.75} />
          </div>
          <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] leading-none">
            {stats.completedCount}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
            Completed
          </p>
        </div>
      </div>
    </section>
  )
}
