import { Flame, TrendingUp, CheckCheck } from 'lucide-react'
import ConsecrationMatrix from '@/components/dashboard/ConsecrationMatrix'
import MyJournalSection from '@/components/dashboard/MyJournalSection'
import type { MemberStats, Profile } from '@/lib/types'

interface ChallengeProgressViewProps {
  profile: Profile
  challengeName: string
  challengeId?: string | null
  durationDays: number
  currentDay: number
  isCompletedChallenge: boolean
  stats: MemberStats
  completedDayNumbers: number[]
  effectiveMemberId?: string
}

export default function ChallengeProgressView({
  profile,
  challengeName,
  challengeId,
  durationDays,
  currentDay,
  isCompletedChallenge,
  stats,
  completedDayNumbers,
  effectiveMemberId,
}: ChallengeProgressViewProps) {
  const pct = Math.round((stats.total_completed / durationDays) * 1000) / 10

  return (
    <div className="space-y-4 pt-3 pb-8">
      {/* ── Stat Cards ────────────────────────────────────────── */}
      <section className="px-4">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-3 text-center shadow-2xs">
            <div className="flex items-center justify-center text-[var(--flame-accent)] mb-1">
              <Flame size={16} strokeWidth={2} />
            </div>
            <p className="text-xl font-bold tracking-tight text-[var(--text-ink)] leading-none">
              {stats.current_streak}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
              Current Streak
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-3 text-center shadow-2xs">
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

          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-3 text-center shadow-2xs">
            <div className="flex items-center justify-center text-[var(--covenant-accent)] mb-1">
              <CheckCheck size={16} strokeWidth={2} />
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

      {/* ── Overall Progress Milestone Bar ─────────────────────── */}
      <section className="px-4">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--text-ink)]">
              Consecration Milestone
            </span>
            <span className="text-xs font-bold text-[var(--flame-accent)]">
              {pct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden border border-[var(--border-hairline)]">
            <div
              className="h-full rounded-full bg-[var(--flame-accent)] transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-[var(--text-muted)]">
            <span>Day 1</span>
            <span>
              {isCompletedChallenge
                ? `Completed ${durationDays}-Day Cycle`
                : currentDay > 0 && currentDay <= durationDays
                ? `Day ${currentDay} of ${durationDays}`
                : `${durationDays} Days`}
            </span>
          </div>
        </div>
      </section>

      {/* ── Consecration Matrix ────────────────────────────────── */}
      <section className="px-4">
        <ConsecrationMatrix
          currentDay={currentDay > 0 && currentDay <= durationDays ? currentDay : null}
          selectedDay={currentDay > 0 && currentDay <= durationDays ? currentDay : 1}
          completedDayNumbers={completedDayNumbers}
          totalCompleted={stats.total_completed}
          durationDays={durationDays}
          challengeName={challengeName}
          challengeId={challengeId}
          isCompletedChallenge={isCompletedChallenge}
          asMemberId={effectiveMemberId}
        />
      </section>

      {/* ── My Spiritual Reflections (Journal) ─────────────────── */}
      <section className="px-4">
        <MyJournalSection />
      </section>
    </div>
  )
}
