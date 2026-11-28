'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Flame,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Layers,
  Sparkles,
  Globe,
  Radio,
} from 'lucide-react'
import type { ChallengeWithStats } from '@/lib/types'

interface AdminChallengeSelectorProps {
  challenges: ChallengeWithStats[]
  selectedChallengeId: string
}

export default function AdminChallengeSelector({
  challenges,
  selectedChallengeId,
}: AdminChallengeSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const selectedChallenge =
    challenges.find((c) => c.id === selectedChallengeId) ||
    challenges.find((c) => c.status === 'active') ||
    challenges[0] ||
    null

  const handleSelect = (id: string) => {
    if (!id || id === selectedChallengeId) return
    startTransition(() => {
      router.push(`/admin?challenge=${id}`)
      router.refresh()
    })
  }

  // Calculate live synchronization metadata for the selected challenge
  const isCourse = selectedChallenge?.type === 'course'
  const timezone = selectedChallenge?.timezone || 'Africa/Lagos'

  // Current time in the challenge's timezone
  const todayInTimezone = (() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date())
    } catch {
      return new Date().toLocaleDateString()
    }
  })()

  // Daily synchronization details
  const dailyStatus = selectedChallenge?.status // 'active' | 'upcoming' | 'completed' | 'course'
  const currentDay = selectedChallenge?.current_day ?? 0
  const durationDays = selectedChallenge?.duration_days ?? 40
  const daysRemaining = Math.max(0, durationDays - currentDay)

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-hairline)] shadow-xs overflow-hidden transition-colors">
      {/* ── Top Bar: Selector Dropdown & Switcher ─────────────── */}
      <div className="p-4 sm:p-5 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)]/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--flame-accent)] bg-[var(--flame-subtle)] px-2 py-0.5 rounded border border-[var(--flame-accent)]/20 flex items-center gap-1">
              <Layers size={11} strokeWidth={2.5} />
              <span>Challenge Configuration Scope</span>
            </span>
            {isPending && (
              <span className="text-[11px] text-[var(--text-muted)] animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--flame-accent)] inline-block animate-ping" />
                Switching scope…
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-ink)] font-serif flex items-center gap-2">
            <span>Administering:</span>
            <span className="text-[var(--flame-accent)]">{selectedChallenge?.name || 'All Challenges'}</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Everything below (settings, schedule, curriculum, roster, completions, analytics) is scoped to this challenge.
          </p>
        </div>

        {/* Challenge Dropdown Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="admin-challenge-select" className="sr-only">
            Select Challenge or Course
          </label>
          <div className="relative w-full sm:w-auto min-w-[260px]">
            <select
              id="admin-challenge-select"
              value={selectedChallenge?.id || ''}
              onChange={(e) => handleSelect(e.target.value)}
              disabled={isPending}
              className="w-full appearance-none bg-[var(--bg-surface)] text-[var(--text-ink)] text-xs font-semibold rounded-xl pl-9 pr-8 py-2.5 border border-[var(--border-hairline)] hover:border-[var(--flame-accent)]/50 focus:border-[var(--flame-accent)] focus:ring-1 focus:ring-[var(--flame-accent)] outline-none shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              {challenges.map((c) => {
                const typeLabel = c.type === 'course' ? 'Course' : 'Daily'
                let statusLabel: string = c.status
                if (c.type === 'course') {
                  statusLabel = c.is_published ? 'published' : 'draft'
                }
                return (
                  <option key={c.id} value={c.id}>
                    [{typeLabel.toUpperCase()}] {c.name} ({statusLabel})
                  </option>
                )
              })}
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--flame-accent)]">
              {isCourse ? <BookOpen size={15} /> : <Flame size={15} />}
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Bar: Live Synchronization Readout ─────────── */}
      {selectedChallenge && (
        <div className="p-4 sm:p-5">
          {isCourse ? (
            /* ── Course Status Readout ────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Curriculum Status
                </span>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {selectedChallenge.is_published ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={13} strokeWidth={2.2} />
                      <span>Published &amp; Active</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full">
                      <AlertCircle size={13} strokeWidth={2.2} />
                      <span>Draft / Hidden</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Lesson Count */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Curriculum Depth
                </span>
                <p className="text-sm font-bold text-[var(--text-ink)] pt-0.5 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-[var(--course-accent)]" />
                  <span>{selectedChallenge.lesson_count ?? 0} Sequential Lessons</span>
                </p>
              </div>

              {/* Access Mode */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Access Rule
                </span>
                <p className="text-sm font-semibold text-[var(--text-ink)] pt-0.5 capitalize">
                  {selectedChallenge.access_mode === 'fixed_end'
                    ? `Fixed End: ${selectedChallenge.access_end_date || 'Not set'}`
                    : selectedChallenge.access_mode === 'per_member_days'
                    ? `${selectedChallenge.access_days || 30} Days per Member`
                    : 'Unlimited Lifelong Access'}
                </p>
              </div>

              {/* Enrolled / Started */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Enrolled Students
                </span>
                <p className="text-sm font-bold text-[var(--text-ink)] pt-0.5 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-600" />
                  <span>
                    {selectedChallenge.members_started ?? 0} Started ({selectedChallenge.members_completed ?? 0} Completed)
                  </span>
                </p>
              </div>
            </div>
          ) : (
            /* ── Daily Challenge Synchronization Readout ──────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Status Pill */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Cycle Temporal Status
                </span>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {dailyStatus === 'active' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full">
                      <Radio size={12} className="animate-pulse text-emerald-600" />
                      <span>Active Consecration</span>
                    </span>
                  )}
                  {dailyStatus === 'upcoming' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-400 bg-sky-500/10 border border-sky-500/25 px-2.5 py-1 rounded-full">
                      <Clock size={12} strokeWidth={2.2} />
                      <span>Upcoming Launch</span>
                    </span>
                  )}
                  {dailyStatus === 'completed' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 dark:text-stone-400 bg-stone-500/10 border border-stone-500/25 px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={12} strokeWidth={2.2} />
                      <span>Cycle Completed</span>
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Today's Day Number Synchronization */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Synchronized Timeline
                </span>
                <p className="text-sm font-bold text-[var(--text-ink)] pt-0.5 flex items-center gap-1.5">
                  <Flame size={14} className="text-[var(--flame-accent)]" />
                  {dailyStatus === 'active' ? (
                    <span>
                      Day {currentDay} <span className="text-xs font-normal text-[var(--text-muted)]">of {durationDays}</span>
                    </span>
                  ) : dailyStatus === 'upcoming' ? (
                    <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                      Day 0 of {durationDays} (Upcoming)
                    </span>
                  ) : (
                    <span>
                      Finished ({durationDays} of {durationDays} Days)
                    </span>
                  )}
                </p>
              </div>

              {/* 3. Days Remaining / Countdown */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Duration &amp; Days Remaining
                </span>
                <p className="text-xs font-medium text-[var(--text-ink)] pt-0.5 flex items-center gap-1.5">
                  <Calendar size={13} className="text-[var(--text-muted)]" />
                  {dailyStatus === 'active' ? (
                    <span>
                      <strong className="text-[var(--flame-accent)]">{daysRemaining}</strong> days left (Ends {selectedChallenge.end_date})
                    </span>
                  ) : dailyStatus === 'upcoming' ? (
                    <span>Starts {selectedChallenge.start_date || 'TBD'}</span>
                  ) : (
                    <span>Concluded on {selectedChallenge.end_date}</span>
                  )}
                </p>
              </div>

              {/* 4. Timezone & Local Date */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Assembly Timezone
                </span>
                <div className="pt-0.5 space-y-0.5">
                  <p className="text-xs font-semibold text-[var(--text-ink)] flex items-center gap-1">
                    <Globe size={12} className="text-[var(--text-muted)]" />
                    <span>{timezone}</span>
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Local: {todayInTimezone}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
