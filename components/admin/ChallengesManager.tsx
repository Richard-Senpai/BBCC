'use client'

import { useState, useTransition, useEffect } from 'react'
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
  Sparkles,
  Trash2,
  Edit3,
  Download,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  AlertTriangle,
  X,
  Loader2,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import {
  createChallenge,
  updateChallenge,
  getGrandfatheredParticipantsCount,
  getChallengeEnrollments,
  decideChallengeEnrollment,
  decideAllPendingEnrollments,
  removeEnrolledMember,
  getChallengeDeleteSummary,
  deleteChallenge,
  getChallengeExportCsv,
} from '@/lib/actions/admin'
import type {
  ChallengeWithStats,
  EnrollmentMode,
  ChallengeEnrollmentWithUser,
  ChallengeDeleteSummary,
} from '@/lib/types'

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

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  } catch {
    return dateStr
  }
}

export default function ChallengesManager({
  challenges,
  selectedChallengeId,
  onSelectChallenge,
}: ChallengesManagerProps) {
  const router = useRouter()

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<ChallengeWithStats | null>(null)
  const [requestsChallenge, setRequestsChallenge] = useState<ChallengeWithStats | null>(null)
  const [deletingChallenge, setDeletingChallenge] = useState<ChallengeWithStats | null>(null)

  function handleSelect(id: string) {
    if (onSelectChallenge) onSelectChallenge(id)
    router.push(`/admin?challenge=${id}#curriculum-architect`)
  }

  function handleOpenCreate() {
    setShowCreateModal(true)
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
                Oversee corporate challenges, configure enrollment modes, and manage join requests.
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
      {challenges.length === 0 ? (
        <div className="mt-6 p-8 rounded-xl border border-dashed border-[var(--border-subtle)] text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-muted)] mx-auto flex items-center justify-center mb-3 border border-[var(--border-hairline)]">
            <Layers size={20} strokeWidth={1.75} />
          </div>
          <h4 className="text-sm font-semibold text-[var(--text-ink)]">No Consecration Challenges Found</h4>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
            There are currently no active, upcoming, or completed challenges in the sanctuary system. Create one to begin.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus size={14} strokeWidth={2} />
            <span>Create First Challenge</span>
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {challenges.map((c) => {
            const isSelected = c.id === selectedChallengeId
            const statusBadge =
              c.status === 'active' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  Active (Day {c.current_day})
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

            const modeBadge =
              c.enrollment_mode === 'approval' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/25">
                  <Lock size={10} strokeWidth={2} />
                  Requires Approval
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                  <Unlock size={10} strokeWidth={2} />
                  Open Access
                </span>
              )

            const pendingBadge =
              c.enrollment_mode === 'approval' && (c.pending_requests_count ?? 0) > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRequestsChallenge(c)
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer"
                  title="View pending join requests"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-ping" />
                  {c.pending_requests_count} Pending
                </button>
              ) : null

            return (
              <div
                key={c.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-[var(--flame-accent)] bg-[var(--flame-subtle)]/40 shadow-xs ring-1 ring-[var(--flame-accent)]/20'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]/40 hover:bg-[var(--bg-subtle)]/60'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1.5 mb-2.5 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {statusBadge}
                      {modeBadge}
                    </div>
                    {pendingBadge}
                  </div>

                  <h4
                    onClick={() => handleSelect(c.id)}
                    className="text-sm font-semibold text-[var(--text-ink)] leading-snug cursor-pointer hover:text-[var(--flame-accent)] transition"
                  >
                    {c.name}
                  </h4>

                  <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-1.5 mb-3">
                    <Calendar size={12} strokeWidth={1.75} className="shrink-0 text-[var(--text-muted)]" />
                    <span>
                      {formatDateRange(c.start_date, c.duration_days)} ({c.duration_days} Days)
                    </span>
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-[var(--border-hairline)]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)] font-medium text-[11px]">
                      <Users size={12} strokeWidth={1.75} className="text-[var(--flame-accent)]" />
                      <span>{c.participant_count} member{c.participant_count === 1 ? '' : 's'} participated</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleSelect(c.id)}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer ${
                        isSelected ? 'text-[var(--flame-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
                      }`}
                    >
                      <span>{isSelected ? 'Curriculum Selected' : 'Curriculum'}</span>
                      <ChevronRight size={12} strokeWidth={2} />
                    </button>
                  </div>

                  {/* Card Admin Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-hairline)] text-xs">
                    <div className="flex items-center gap-1">
                      {c.enrollment_mode === 'approval' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRequestsChallenge(c)
                          }}
                          className="px-2 py-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-md border border-indigo-500/20 transition flex items-center gap-1 cursor-pointer"
                        >
                          <UserCheck size={12} />
                          <span>Requests {(c.pending_requests_count ?? 0) > 0 ? `(${c.pending_requests_count})` : ''}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingChallenge(c)
                        }}
                        className="px-2 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] rounded-md border border-transparent hover:border-[var(--border-hairline)] transition flex items-center gap-1 cursor-pointer"
                        title="Edit challenge settings"
                      >
                        <Edit3 size={12} />
                        <span>Edit</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingChallenge(c)
                      }}
                      className="px-2 py-1 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-md transition flex items-center gap-1 cursor-pointer"
                      title="Permanently delete challenge"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── CREATE CHALLENGE MODAL ────────────────────────────── */}
      {showCreateModal && (
        <CreateChallengeModal
          challenges={challenges}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newId) => {
            setShowCreateModal(false)
            if (onSelectChallenge) onSelectChallenge(newId)
            router.push(`/admin?challenge=${newId}#curriculum-architect`)
            router.refresh()
          }}
        />
      )}

      {/* ── EDIT CHALLENGE MODAL ──────────────────────────────── */}
      {editingChallenge && (
        <EditChallengeModal
          challenge={editingChallenge}
          onClose={() => setEditingChallenge(null)}
          onUpdated={() => {
            setEditingChallenge(null)
            router.refresh()
          }}
        />
      )}

      {/* ── JOIN REQUESTS MODAL ───────────────────────────────── */}
      {requestsChallenge && (
        <JoinRequestsModal
          challenge={requestsChallenge}
          onClose={() => setRequestsChallenge(null)}
          onUpdate={() => {
            router.refresh()
          }}
        />
      )}

      {/* ── DELETE CHALLENGE MODAL ────────────────────────────── */}
      {deletingChallenge && (
        <DeleteChallengeModal
          challenge={deletingChallenge}
          onClose={() => setDeletingChallenge(null)}
          onDeleted={(deletedId) => {
            setDeletingChallenge(null)
            if (selectedChallengeId === deletedId) {
              const remaining = challenges.filter((c) => c.id !== deletedId)
              const nextId = remaining[0]?.id || ''
              if (onSelectChallenge) onSelectChallenge(nextId)
              router.push(nextId ? `/admin?challenge=${nextId}` : '/admin')
            }
            router.refresh()
          }}
        />
      )}
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   CREATE CHALLENGE MODAL
   ───────────────────────────────────────────────────────────── */
function CreateChallengeModal({
  challenges,
  onClose,
  onCreated,
}: {
  challenges: ChallengeWithStats[]
  onClose: () => void
  onCreated: (newId: string) => void
}) {
  const [name, setName] = useState('')
  const [durationDays, setDurationDays] = useState(40)
  const [startDate, setStartDate] = useState(() => {
    if (challenges.length > 0) {
      const sorted = [...challenges].sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())
      const latestEnd = new Date(sorted[0].end_date + 'T00:00:00Z')
      const nextStart = new Date(latestEnd.getTime() + 86400000)
      return nextStart.toISOString().split('T')[0]
    }
    return new Date().toISOString().split('T')[0]
  })
  const [enrollmentMode, setEnrollmentMode] = useState<EnrollmentMode>('open')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
        enrollmentMode,
      })

      if (!res.success) {
        setError(res.error || 'Failed to create challenge.')
        return
      }

      if (res.challengeId) {
        onCreated(res.challengeId)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] shadow-xl p-6 transition-colors max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--flame-subtle)] text-[var(--flame-accent)] flex items-center justify-center border border-[var(--flame-accent)]/20">
              <Sparkles size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-ink)] font-serif">
                Initiate New Consecration Challenge
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Define challenge timeline, enrollment policy, and initialize day slots.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] transition cursor-pointer"
          >
            <X size={16} />
          </button>
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
              placeholder="e.g. Dominion in Prayer or 40 Days of Consecration"
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

          {/* Enrollment Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1.5">
              Enrollment Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                  enrollmentMode === 'open'
                    ? 'border-emerald-500 bg-emerald-500/10 text-[var(--text-ink)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                }`}
              >
                <input
                  type="radio"
                  name="create_enrollment_mode"
                  value="open"
                  checked={enrollmentMode === 'open'}
                  onChange={() => setEnrollmentMode('open')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--text-ink)]">
                    <Unlock size={12} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Open for everyone</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                    Any approved church account can immediately join and track activities.
                  </p>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                  enrollmentMode === 'approval'
                    ? 'border-indigo-500 bg-indigo-500/10 text-[var(--text-ink)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                }`}
              >
                <input
                  type="radio"
                  name="create_enrollment_mode"
                  value="approval"
                  checked={enrollmentMode === 'approval'}
                  onChange={() => setEnrollmentMode('approval')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--text-ink)]">
                    <Lock size={12} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Requires approval</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                    Members must submit a join request; church admin approves per challenge.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-muted)] space-y-1">
            <p className="font-semibold text-[var(--text-ink)]">Challenge Setup Policy:</p>
            <p>• Date ranges cannot overlap with any other challenge.</p>
            <p>• Automatically initializes day slots 1 to {durationDays} with devotional templates.</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Generating Days...</span>
                </>
              ) : (
                'Create Challenge & Days'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   EDIT CHALLENGE MODAL
   ───────────────────────────────────────────────────────────── */
function EditChallengeModal({
  challenge,
  onClose,
  onUpdated,
}: {
  challenge: ChallengeWithStats
  onClose: () => void
  onUpdated: () => void
}) {
  const [name, setName] = useState(challenge.name)
  const [durationDays, setDurationDays] = useState(challenge.duration_days)
  const [startDate, setStartDate] = useState(challenge.start_date)
  const [enrollmentMode, setEnrollmentMode] = useState<EnrollmentMode>(challenge.enrollment_mode || 'open')
  const [grandfatherCount, setGrandfatherCount] = useState<number | null>(null)
  const [isLoadingGrandfather, setIsLoadingGrandfather] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // When switching Open -> Approval, fetch how many members would be grandfathered
  useEffect(() => {
    if (challenge.enrollment_mode === 'open' && enrollmentMode === 'approval') {
      setIsLoadingGrandfather(true)
      getGrandfatheredParticipantsCount(challenge.id).then((res) => {
        setGrandfatherCount(res.count)
        setIsLoadingGrandfather(false)
      })
    }
  }, [challenge.enrollment_mode, challenge.id, enrollmentMode])

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please provide a challenge title.')
      return
    }

    startTransition(async () => {
      const res = await updateChallenge(challenge.id, {
        name: name.trim(),
        durationDays,
        startDate,
        enrollmentMode,
      })

      if (!res.success) {
        setError(res.error || 'Failed to update challenge.')
        return
      }

      onUpdated()
    })
  }

  const isSwitchingToApproval = challenge.enrollment_mode === 'open' && enrollmentMode === 'approval'
  const isSwitchingToOpen = challenge.enrollment_mode === 'approval' && enrollmentMode === 'open'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] shadow-xl p-6 transition-colors max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-ink)] flex items-center justify-center border border-[var(--border-hairline)]">
              <Edit3 size={17} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-ink)] font-serif">
                Edit Challenge Settings
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Update name, duration, schedule, and enrollment mode.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2 leading-relaxed">
              <AlertCircle size={15} strokeWidth={2} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1">
              Challenge Title
            </label>
            <input
              type="text"
              required
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

          {/* Enrollment Selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1.5">
              Enrollment Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                  enrollmentMode === 'open'
                    ? 'border-emerald-500 bg-emerald-500/10 text-[var(--text-ink)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                }`}
              >
                <input
                  type="radio"
                  name="edit_enrollment_mode"
                  value="open"
                  checked={enrollmentMode === 'open'}
                  onChange={() => setEnrollmentMode('open')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--text-ink)]">
                    <Unlock size={12} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Open for everyone</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                    Any approved church account can immediately participate.
                  </p>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                  enrollmentMode === 'approval'
                    ? 'border-indigo-500 bg-indigo-500/10 text-[var(--text-ink)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                }`}
              >
                <input
                  type="radio"
                  name="edit_enrollment_mode"
                  value="approval"
                  checked={enrollmentMode === 'approval'}
                  onChange={() => setEnrollmentMode('approval')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--text-ink)]">
                    <Lock size={12} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Requires approval</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                    Members must request to join; admin approves per challenge.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Mode Switch Warnings */}
          {isSwitchingToApproval && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Notice: Switching to Approval Mode</span>
              </div>
              <p className="leading-relaxed">
                Everyone who already has at least one activity completion in this challenge will automatically be marked as{' '}
                <strong>approved</strong> so existing participants are not locked out mid-challenge.
              </p>
              {isLoadingGrandfather ? (
                <p className="text-[11px] italic flex items-center gap-1 text-[var(--text-muted)]">
                  <Loader2 size={11} className="animate-spin" /> Checking participant count...
                </p>
              ) : grandfatherCount !== null ? (
                <p className="font-semibold text-[11px] text-amber-900 dark:text-amber-200">
                  ⚡ {grandfatherCount} existing participant{grandfatherCount === 1 ? '' : 's'} will be grandfathered in as approved.
                </p>
              ) : null}
            </div>
          )}

          {isSwitchingToOpen && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Unlock size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Switching to Open Mode</span>
              </div>
              <p className="leading-relaxed">
                All approved church members will gain immediate access. Any pending join requests will become resolved.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   JOIN REQUESTS MODAL (Mobile-First)
   ───────────────────────────────────────────────────────────── */
function JoinRequestsModal({
  challenge,
  onClose,
  onUpdate,
}: {
  challenge: ChallengeWithStats
  onClose: () => void
  onUpdate: () => void
}) {
  const [activeTab, setActiveTab] = useState<'pending' | 'enrolled'>('pending')
  const [pending, setPending] = useState<ChallengeEnrollmentWithUser[]>([])
  const [enrolled, setEnrolled] = useState<ChallengeEnrollmentWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [isApprovingAll, setIsApprovingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    const res = await getChallengeEnrollments(challenge.id)
    if (!res.success) {
      setError(res.error || 'Failed to load enrollment data.')
    } else {
      setPending(res.pending)
      setEnrolled(res.enrolled)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [challenge.id])

  async function handleDecide(enrollmentId: string, status: 'approved' | 'rejected') {
    setActionId(enrollmentId)
    setError(null)
    const res = await decideChallengeEnrollment({ enrollmentId, status })
    if (!res.success) {
      setError(res.error || 'Failed to update request.')
    } else {
      await loadData()
      onUpdate()
    }
    setActionId(null)
  }

  async function handleApproveAll() {
    if (pending.length === 0) return
    setIsApprovingAll(true)
    setError(null)
    const res = await decideAllPendingEnrollments({ challengeId: challenge.id, status: 'approved' })
    if (!res.success) {
      setError(res.error || 'Failed to approve all requests.')
    } else {
      await loadData()
      onUpdate()
    }
    setIsApprovingAll(false)
  }

  async function handleRemove(enrollmentId: string, memberName: string) {
    if (!window.confirm(`Remove ${memberName} from this challenge? They will lose access to its curriculum and leaderboard.`)) {
      return
    }
    setActionId(enrollmentId)
    setError(null)
    const res = await removeEnrolledMember({ enrollmentId })
    if (!res.success) {
      setError(res.error || 'Failed to remove member.')
    } else {
      await loadData()
      onUpdate()
    }
    setActionId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--bg-surface)] w-full max-w-xl rounded-2xl border border-[var(--border-subtle)] shadow-xl p-5 sm:p-6 transition-colors max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <UserCheck size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-ink)] font-serif">
                Join Requests &amp; Enrollments
              </h3>
              <p className="text-xs text-[var(--text-muted)] truncate max-w-xs sm:max-w-md">
                {challenge.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between gap-2 mt-4 pb-3 border-b border-[var(--border-hairline)] shrink-0">
          <div className="flex items-center gap-1.5 bg-[var(--bg-canvas)] p-1 rounded-xl border border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
              }`}
            >
              <span>Pending Requests</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  pending.length > 0 ? 'bg-amber-500 text-white font-bold' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                }`}
              >
                {pending.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('enrolled')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'enrolled'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
              }`}
            >
              <span>Enrolled Members</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                {enrolled.length}
              </span>
            </button>
          </div>

          {activeTab === 'pending' && pending.length > 1 && (
            <button
              type="button"
              disabled={isApprovingAll}
              onClick={handleApproveAll}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isApprovingAll ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Approving...</span>
                </>
              ) : (
                <>
                  <UserCheck size={13} strokeWidth={2} />
                  <span>Approve All ({pending.length})</span>
                </>
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[var(--text-muted)] text-xs gap-2">
              <Loader2 size={20} className="animate-spin text-[var(--flame-accent)]" />
              <span>Loading requests...</span>
            </div>
          ) : activeTab === 'pending' ? (
            pending.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
                <p className="font-semibold text-[var(--text-ink)]">All Caught Up</p>
                <p className="mt-1">There are no pending join requests for this challenge.</p>
              </div>
            ) : (
              pending.map((item) => {
                const isItemLoading = actionId === item.id
                const profile = item.profiles

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        avatarUrl={profile?.avatar_url}
                        name={profile?.full_name || 'Member'}
                        size="md"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-[var(--text-ink)]">
                            {profile?.full_name || 'Church Member'}
                          </span>
                          {profile?.display_tag && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--flame-subtle)] text-[var(--flame-accent)] border border-[var(--flame-accent)]/20">
                              {profile.display_tag}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          {profile?.email || 'No email'} · Requested {formatRelativeTime(item.requested_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        disabled={isItemLoading}
                        onClick={() => handleDecide(item.id, 'rejected')}
                        className="px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg transition border border-transparent hover:border-red-500/20 cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={isItemLoading}
                        onClick={() => handleDecide(item.id, 'approved')}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isItemLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserCheck size={13} strokeWidth={2} />
                        )}
                        <span>Approve</span>
                      </button>
                    </div>
                  </div>
                )
              })
            )
          ) : enrolled.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              <Users size={24} className="mx-auto text-[var(--text-muted)] mb-2" />
              <p className="font-semibold text-[var(--text-ink)]">No Members Enrolled Yet</p>
              <p className="mt-1">Approve pending requests above to enroll church members.</p>
            </div>
          ) : (
            enrolled.map((item) => {
              const isItemLoading = actionId === item.id
              const profile = item.profiles

              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      avatarUrl={profile?.avatar_url}
                      name={profile?.full_name || 'Member'}
                      size="md"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-[var(--text-ink)]">
                          {profile?.full_name || 'Church Member'}
                        </span>
                        {profile?.display_tag && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--flame-subtle)] text-[var(--flame-accent)] border border-[var(--flame-accent)]/20">
                            {profile.display_tag}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        {profile?.email || 'No email'} · Enrolled
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isItemLoading}
                    onClick={() => handleRemove(item.id, profile?.full_name || 'this member')}
                    className="px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg transition border border-transparent hover:border-red-500/20 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Remove from challenge"
                  >
                    {isItemLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <UserX size={13} />
                    )}
                    <span>Remove</span>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   DELETE CHALLENGE CONFIRMATION MODAL
   ───────────────────────────────────────────────────────────── */
function DeleteChallengeModal({
  challenge,
  onClose,
  onDeleted,
}: {
  challenge: ChallengeWithStats
  onClose: () => void
  onDeleted: (deletedId: string) => void
}) {
  const [summary, setSummary] = useState<ChallengeDeleteSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [confirmName, setConfirmName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingSummary(true)
    getChallengeDeleteSummary(challenge.id).then((res) => {
      if (res.success && res.summary) {
        setSummary(res.summary)
      } else {
        setError(res.error || 'Failed to fetch challenge details.')
      }
      setLoadingSummary(false)
    })
  }, [challenge.id])

  async function handleDownloadCsv() {
    setIsExporting(true)
    setError(null)
    const res = await getChallengeExportCsv(challenge.id)
    if (!res.success || !res.csv) {
      setError(res.error || 'Failed to export challenge CSV.')
    } else {
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${challenge.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_results.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
    setIsExporting(false)
  }

  async function handleDelete() {
    if (confirmName.trim() !== challenge.name.trim()) return

    setIsDeleting(true)
    setError(null)
    const res = await deleteChallenge(challenge.id, confirmName.trim())
    if (!res.success) {
      setError(res.error || 'Failed to delete challenge.')
      setIsDeleting(false)
    } else {
      onDeleted(challenge.id)
    }
  }

  const isNameMatched = confirmName.trim() === challenge.name.trim()
  const isActive = challenge.status === 'active'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-2xl border border-red-500/30 shadow-2xl p-6 transition-colors max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/30">
              <ShieldAlert size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-ink)] font-serif">
                Permanently Delete Challenge
              </h3>
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                Irreversible Administrative Action
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-start gap-2 leading-relaxed">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Active Challenge Severe Warning */}
          {isActive && (
            <div className="p-4 rounded-xl bg-red-500/15 border-2 border-red-500/40 text-red-800 dark:text-red-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide">
                <AlertTriangle size={15} className="shrink-0 text-red-600 dark:text-red-400" />
                <span>Active Challenge Warning</span>
              </div>
              <p className="text-xs leading-relaxed font-medium">
                This challenge is <strong>currently LIVE</strong> and church members are participating right now (Day {challenge.current_day}). Deleting it will immediately interrupt ongoing consecration for all members.
              </p>
            </div>
          )}

          {/* Destroyed Data Counts Grid */}
          <div className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2.5">
            <p className="font-semibold text-[var(--text-ink)] text-xs">
              The following attached data will be permanently destroyed in a single cascade:
            </p>

            {loadingSummary ? (
              <div className="py-4 flex items-center justify-center gap-2 text-[var(--text-muted)]">
                <Loader2 size={15} className="animate-spin text-[var(--flame-accent)]" />
                <span>Calculating challenge records...</span>
              </div>
            ) : summary ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Days</span>
                  <p className="text-sm font-bold text-[var(--text-ink)] mt-0.5">{summary.days_count}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Activities</span>
                  <p className="text-sm font-bold text-[var(--text-ink)] mt-0.5">{summary.activities_count}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Participants</span>
                  <p className="text-sm font-bold text-[var(--text-ink)] mt-0.5">{summary.participants_count}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Completions</span>
                  <p className="text-sm font-bold text-[var(--text-ink)] mt-0.5">{summary.completions_count}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Journal Notes</span>
                  <p className="text-sm font-bold text-[var(--text-ink)] mt-0.5">{summary.journal_entries_count}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Enrollments</span>
                  <p className="text-sm font-bold text-[var(--text-ink)] mt-0.5">{summary.enrollments_count}</p>
                </div>
              </div>
            ) : null}

            {/* Plain statement about private journals */}
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs font-semibold leading-relaxed">
              ⚠️ Members&apos; private journal notes for this challenge will be permanently deleted and cannot be recovered.
            </div>
          </div>

          {/* Download Results CSV First Shortcut */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
            <div>
              <p className="font-semibold text-[var(--text-ink)]">Preserve Archive First?</p>
              <p className="text-[11px] text-[var(--text-muted)]">Download member scores and completion CSV before deletion.</p>
            </div>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadCsv}
              className="px-3 py-1.5 text-xs font-semibold text-[var(--text-ink)] bg-[var(--bg-surface)] hover:bg-[var(--border-hairline)] border border-[var(--border-subtle)] rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isExporting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} strokeWidth={2} />
              )}
              <span>Download CSV</span>
            </button>
          </div>

          {/* Type to confirm */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-semibold text-[var(--text-ink)]">
              To confirm, type <span className="font-mono text-red-600 dark:text-red-400 font-bold">&quot;{challenge.name}&quot;</span> below:
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Type exact challenge title"
              className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isNameMatched || isDeleting}
              onClick={handleDelete}
              className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Deleting Challenge...</span>
                </>
              ) : (
                <>
                  <Trash2 size={13} strokeWidth={2} />
                  <span>Permanently Delete Challenge</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
