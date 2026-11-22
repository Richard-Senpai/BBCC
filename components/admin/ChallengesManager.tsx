'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  Plus,
  Flame,
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
  Layers,
  ChevronRight,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import { createChallenge } from '@/lib/actions/admin'
import type { ChallengeWithStats } from '@/lib/types'

interface ChallengesManagerProps {
  challenges: ChallengeWithStats[]
  selectedChallengeId: string
  onSelectChallenge?: (challengeId: string) => void
}

function formatDateRange(startStr: string, durationDays: number): string {
  try {
    const s = new Date(startStr + 'T00:00:00Z')
    const e = new Date(s.getTime() + (durationDays - 1) * 86400000)
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
    return `${s.toLocaleDateString('en-US', options)} – ${e.toLocaleDateString('en-US', options)}`
  } catch {
    return startStr
  }
}

export default function ChallengesManager({
  challenges,
  selectedChallengeId,
  onSelectChallenge,
}: ChallengesManagerProps) {
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [durationDays, setDurationDays] = useState(40)
  const [startDate, setStartDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSelect(id: string) {
    if (onSelectChallenge) onSelectChallenge(id)
    router.push(`/admin?challenge=${id}#curriculum-architect`)
  }

  function handleOpenCreate() {
    setName('')
    setDurationDays(40)
    // Suggest day after latest challenge ends
    if (challenges.length > 0) {
      const sorted = [...challenges].sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())
      const latestEnd = new Date(sorted[0].end_date + 'T00:00:00Z')
      const nextStart = new Date(latestEnd.getTime() + 86400000)
      setStartDate(nextStart.toISOString().split('T')[0])
    } else {
      setStartDate(new Date().toISOString().split('T')[0])
    }
    setError(null)
    setShowCreateModal(true)
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please provide a challenge title.')
      return
    }
    if (!startDate) {
      setError('Please select a start date.')
      return
    }

    startTransition(async () => {
      const res = await createChallenge({
        name: name.trim(),
        durationDays,
        startDate,
      })

      if (!res.success) {
        setError(res.error || 'Failed to create challenge.')
        return
      }

      setShowCreateModal(false)
      if (res.challengeId) {
        if (onSelectChallenge) onSelectChallenge(res.challengeId)
        router.push(`/admin?challenge=${res.challengeId}#curriculum-architect`)
        // Scroll to curriculum architect
        const el = document.getElementById('curriculum-architect')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }
    })
  }

  return (
    <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-xs p-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] text-[var(--flame-accent)] flex items-center justify-center border border-[var(--border-hairline)]">
              <Layers size={16} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-[var(--text-ink)]">
                Challenges &amp; Consecration Cycles
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Oversee historical, current, and upcoming church challenges across Ile-Ife.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 rounded-lg shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <Plus size={14} strokeWidth={2} />
          <span>Create New Challenge</span>
        </button>
      </div>

      {/* Challenges Grid */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {challenges.map((c) => {
          const isSelected = c.id === selectedChallengeId
          const statusBadge =
            c.status === 'active' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Active Challenge (Day {c.current_day})
              </span>
            ) : c.status === 'upcoming' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                <Clock size={11} strokeWidth={2} />
                Upcoming
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hairline)]">
                <CheckCircle2 size={11} strokeWidth={2} />
                Completed
              </span>
            )

          return (
            <div
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-[var(--flame-accent)] bg-[var(--flame-subtle)]/40 shadow-xs ring-1 ring-[var(--flame-accent)]/20'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]/40 hover:bg-[var(--bg-subtle)]/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-[var(--text-ink)] leading-snug">
                    {c.name}
                  </h4>
                  {statusBadge}
                </div>

                <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-3">
                  <Calendar size={12} strokeWidth={1.75} className="shrink-0 text-[var(--text-muted)]" />
                  <span>
                    {formatDateRange(c.start_date, c.duration_days)} ({c.duration_days} Days)
                  </span>
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)] font-medium text-[11px]">
                  <Users size={12} strokeWidth={1.75} className="text-[var(--flame-accent)]" />
                  <span>{c.participant_count} member{c.participant_count === 1 ? '' : 's'} participated</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                    isSelected ? 'text-[var(--flame-accent)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  <span>{isSelected ? 'Editing Curriculum' : 'Select'}</span>
                  <ChevronRight size={12} strokeWidth={2} />
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Create Challenge Modal ────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-2xl border border-[var(--border-subtle)] shadow-xl p-6 transition-colors">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-hairline)]">
              <div className="w-9 h-9 rounded-xl bg-[var(--flame-subtle)] text-[var(--flame-accent)] flex items-center justify-center border border-[var(--flame-accent)]/20">
                <Sparkles size={18} strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--text-ink)] font-serif">
                  Initiate New Consecration Challenge
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Define challenge timeline and initialize curriculum day slots.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2 leading-relaxed">
                  <AlertCircle size={15} strokeWidth={2} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1">
                  Challenge Title / Spiritual Theme
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dominion in Prayer or Challenge 2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    required
                    value={durationDays}
                    onChange={(e) => setDurationDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-muted)] space-y-1">
                <p className="font-semibold text-[var(--text-ink)]">Consecration Setup Policy:</p>
                <p>• Date ranges cannot overlap with any other challenge.</p>
                <p>• Generates day slots 1 to {durationDays} with devotional templates and 3 daily disciplines.</p>
                <p>• You will immediately be taken into the curriculum architect to review and customize days.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isPending ? 'Generating Days...' : 'Create Challenge & Days'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
