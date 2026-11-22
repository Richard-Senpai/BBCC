'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  GraduationCap,
  BookOpen,
  ArrowUp,
  ArrowDown,
  Globe,
  Eye,
  CalendarCheck,
  Check,
  ListOrdered,
  TrendingUp,
} from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import { LessonContentEditorModal } from '@/components/admin/course-editor/LessonContentEditorModal'
import CourseProgressModal from '@/components/admin/CourseProgressModal'
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
  toggleCoursePublished,
  getCourseLessons,
  createCourseLesson,
  updateCourseLesson,
  deleteCourseLesson,
  reorderCourseLessons,
  getCourseLessonProgressStats,
  extendMemberCourseAccess,
} from '@/lib/actions/admin'
import type {
  ChallengeWithStats,
  EnrollmentMode,
  ChallengeEnrollmentWithUser,
  ChallengeDeleteSummary,
  ChallengeType,
  CourseAccessMode,
  CourseLesson,
} from '@/lib/types'

interface ChallengesManagerProps {
  challenges: ChallengeWithStats[]
  selectedChallengeId: string
  onSelectChallenge?: (challengeId: string) => void
}

function formatDateRange(startStr?: string | null, durationDays?: number | null): string {
  if (!startStr || !durationDays) return ''
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

  // Type filter: All / Daily Challenges / Courses
  const [typeFilter, setTypeFilter] = useState<'all' | 'daily' | 'course'>('all')

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<ChallengeWithStats | null>(null)
  const [requestsChallenge, setRequestsChallenge] = useState<ChallengeWithStats | null>(null)
  const [deletingChallenge, setDeletingChallenge] = useState<ChallengeWithStats | null>(null)
  const [courseOutlineChallenge, setCourseOutlineChallenge] = useState<ChallengeWithStats | null>(null)
  const [progressCourse, setProgressCourse] = useState<ChallengeWithStats | null>(null)

  // Quick actions
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  const dailyCount = challenges.filter((c) => c.type !== 'course').length
  const courseCount = challenges.filter((c) => c.type === 'course').length

  const filteredChallenges = challenges.filter((c) => {
    if (typeFilter === 'daily') return c.type !== 'course'
    if (typeFilter === 'course') return c.type === 'course'
    return true
  })

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

      {/* ── Type Filter Tabs ───────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 pt-3 pb-1 border-b border-[var(--border-hairline)] flex-wrap">
        <button
          type="button"
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            typeFilter === 'all'
              ? 'bg-[var(--text-ink)] text-[var(--bg-surface)] shadow-2xs'
              : 'text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)]'
          }`}
        >
          All Challenges ({challenges.length})
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter('daily')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
            typeFilter === 'daily'
              ? 'bg-[var(--flame-accent)] text-white shadow-2xs'
              : 'text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)]'
          }`}
        >
          <Flame size={12} strokeWidth={2} />
          <span>Daily Challenges ({dailyCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter('course')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
            typeFilter === 'course'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)]'
          }`}
        >
          <GraduationCap size={13} strokeWidth={2} />
          <span>Self-Paced Courses ({courseCount})</span>
        </button>
      </div>

      {/* Global Publish Error Banner */}
      {publishError && (
        <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{publishError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPublishError(null)}
            className="p-1 hover:bg-red-500/20 rounded transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Challenges Grid */}
      {filteredChallenges.length === 0 ? (
        <div className="mt-6 p-8 rounded-xl border border-dashed border-[var(--border-subtle)] text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-muted)] mx-auto flex items-center justify-center mb-3 border border-[var(--border-hairline)]">
            <Layers size={20} strokeWidth={1.75} />
          </div>
          <h4 className="text-sm font-semibold text-[var(--text-ink)]">
            {typeFilter === 'course'
              ? 'No Self-Paced Courses Found'
              : typeFilter === 'daily'
              ? 'No Daily Consecration Challenges Found'
              : 'No Challenges Found'}
          </h4>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
            {typeFilter === 'course'
              ? 'Create a self-paced course to build modular, sequential spiritual curriculums.'
              : 'Create a challenge to start scheduling corporate prayer and fasting.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus size={14} strokeWidth={2} />
            <span>Create New Challenge</span>
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredChallenges.map((c) => {
            const isCourse = c.type === 'course'
            const isSelected = c.id === selectedChallengeId

            // Daily challenge status badge
            const statusBadge = isCourse ? null : c.status === 'active' ? (
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

            // Course badge
            const courseBadge = isCourse ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                <GraduationCap size={11} strokeWidth={2} />
                <span>Course</span>
              </span>
            ) : null

            // Course published badge
            const coursePublishedBadge = isCourse ? (
              c.is_published ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <span>Published</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 inline-block" />
                  <span>Draft</span>
                </span>
              )
            ) : null

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
                  isCourse
                    ? 'border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10'
                    : isSelected
                    ? 'border-[var(--flame-accent)] bg-[var(--flame-subtle)]/40 shadow-xs ring-1 ring-[var(--flame-accent)]/20'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]/40 hover:bg-[var(--bg-subtle)]/60'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1.5 mb-2.5 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isCourse ? (
                        <>
                          {courseBadge}
                          {coursePublishedBadge}
                          {modeBadge}
                        </>
                      ) : (
                        <>
                          {statusBadge}
                          {modeBadge}
                        </>
                      )}
                    </div>
                    {pendingBadge}
                  </div>

                  <h4
                    onClick={() => {
                      if (isCourse) {
                        setCourseOutlineChallenge(c)
                      } else {
                        handleSelect(c.id)
                      }
                    }}
                    className={`text-sm font-semibold text-[var(--text-ink)] leading-snug cursor-pointer transition ${
                      isCourse ? 'hover:text-purple-600' : 'hover:text-[var(--flame-accent)]'
                    }`}
                  >
                    {c.name}
                  </h4>

                  {isCourse ? (
                    <div className="text-xs text-[var(--text-muted)] mt-1.5 mb-3 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-medium text-[var(--text-ink)]">
                        <BookOpen size={12} strokeWidth={1.75} className="text-purple-600" />
                        <span>{c.lesson_count ?? 0} Lesson{(c.lesson_count ?? 0) === 1 ? '' : 's'}</span>
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Users size={12} strokeWidth={1.75} className="text-[var(--text-muted)]" />
                        <span>{c.members_started ?? 0} started · {c.members_completed ?? 0} completed</span>
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-1.5 mb-3">
                      <Calendar size={12} strokeWidth={1.75} className="shrink-0 text-[var(--text-muted)]" />
                      <span>
                        {formatDateRange(c.start_date, c.duration_days)} ({c.duration_days} Days)
                      </span>
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-3 border-t border-[var(--border-hairline)]">
                  <div className="flex items-center justify-between text-xs gap-2">
                    {isCourse ? (
                      <div className="flex items-center gap-2">
                        {/* Publish / Unpublish quick toggle */}
                        <button
                          type="button"
                          disabled={togglingPublishId === c.id}
                          onClick={async (e) => {
                            e.stopPropagation()
                            setTogglingPublishId(c.id)
                            setPublishError(null)
                            const res = await toggleCoursePublished(c.id)
                            if (!res.success) {
                              setPublishError(res.error || 'Failed to toggle course published status.')
                            } else {
                              router.refresh()
                            }
                            setTogglingPublishId(null)
                          }}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                            c.is_published
                              ? 'bg-zinc-500/15 hover:bg-zinc-500/25 text-zinc-700 dark:text-zinc-300 border border-zinc-500/25'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs'
                          }`}
                        >
                          {togglingPublishId === c.id ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : c.is_published ? (
                            <Eye size={11} />
                          ) : (
                            <Globe size={11} />
                          )}
                          <span>{c.is_published ? 'Unpublish' : 'Publish'}</span>
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)] font-medium text-[11px]">
                        <Users size={12} strokeWidth={1.75} className="text-[var(--flame-accent)]" />
                        <span>{c.participant_count} member{c.participant_count === 1 ? '' : 's'} participated</span>
                      </span>
                    )}

                    {isCourse ? (
                      <button
                        type="button"
                        onClick={() => setCourseOutlineChallenge(c)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-800 bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-1 rounded-lg border border-purple-500/20 transition cursor-pointer"
                      >
                        <ListOrdered size={12} strokeWidth={2} />
                        <span>Course Outline</span>
                        <ChevronRight size={12} strokeWidth={2} />
                      </button>
                    ) : (
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
                    )}
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

                      {isCourse && (
                        <>
                          <Link
                            href={`/courses/${c.id}?preview=true`}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-md border border-purple-500/20 transition flex items-center gap-1 cursor-pointer"
                            title="Preview course as member (no progress recorded)"
                          >
                            <Eye size={12} />
                            <span>Preview</span>
                          </Link>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setProgressCourse(c)
                            }}
                            className="px-2 py-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-md border border-purple-500/20 transition flex items-center gap-1 cursor-pointer"
                            title="View member progress, lesson drop-off, and CSV export"
                          >
                            <TrendingUp size={12} />
                            <span>Progress</span>
                          </button>
                        </>
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
          onCreated={(newId, type) => {
            setShowCreateModal(false)
            if (type === 'course') {
              router.refresh()
            } else {
              if (onSelectChallenge) onSelectChallenge(newId)
              router.push(`/admin?challenge=${newId}#curriculum-architect`)
              router.refresh()
            }
          }}
        />
      )}

      {/* ── COURSE OUTLINE MODAL ──────────────────────────────── */}
      {courseOutlineChallenge && (
        <CourseOutlineModal
          course={courseOutlineChallenge}
          onClose={() => setCourseOutlineChallenge(null)}
          onUpdated={() => {
            router.refresh()
          }}
        />
      )}

      {/* ── COURSE PROGRESS & ANALYTICS MODAL ─────────────────── */}
      {progressCourse && (
        <CourseProgressModal
          courseId={progressCourse.id}
          courseName={progressCourse.name}
          isOpen={Boolean(progressCourse)}
          onClose={() => setProgressCourse(null)}
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
   CREATE CHALLENGE MODAL (Multi-Type: Daily vs Course)
   ───────────────────────────────────────────────────────────── */
function CreateChallengeModal({
  challenges,
  onClose,
  onCreated,
}: {
  challenges: ChallengeWithStats[]
  onClose: () => void
  onCreated: (newId: string, type: 'daily' | 'course') => void
}) {
  // Step 1: Type selection
  const [challengeType, setChallengeType] = useState<'daily' | 'course'>('daily')

  // Daily Challenge fields
  const [name, setName] = useState('')
  const [durationDays, setDurationDays] = useState(40)
  const [startDate, setStartDate] = useState(() => {
    const dailyChallenges = challenges.filter((c) => c.type !== 'course')
    if (dailyChallenges.length > 0) {
      const sorted = [...dailyChallenges].sort(
        (a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
      )
      const latestEnd = new Date(sorted[0].end_date + 'T00:00:00Z')
      const nextStart = new Date(latestEnd.getTime() + 86400000)
      return nextStart.toISOString().split('T')[0]
    }
    return new Date().toISOString().split('T')[0]
  })
  const [enrollmentMode, setEnrollmentMode] = useState<EnrollmentMode>('open')

  // Course fields
  const [courseName, setCourseName] = useState('')
  const [courseDescription, setCourseDescription] = useState('')
  const [courseEnrollmentMode, setCourseEnrollmentMode] = useState<EnrollmentMode>('open')
  const [accessMode, setAccessMode] = useState<CourseAccessMode>('unlimited')
  const [accessEndDate, setAccessEndDate] = useState('')
  const [accessDays, setAccessDays] = useState(30)

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Dynamic plain-English summary for course access mode
  const accessSummary = (() => {
    if (accessMode === 'unlimited') {
      return 'Members have permanent, lifetime access to all lessons once enrolled.'
    }
    if (accessMode === 'fixed_end') {
      if (!accessEndDate) {
        return 'Access closes for all members on the selected date at midnight (Africa/Lagos).'
      }
      try {
        const formatted = new Date(accessEndDate + 'T00:00:00Z').toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
        return `Access closes for all members on ${formatted} at midnight (Africa/Lagos).`
      } catch {
        return `Access closes for all members on ${accessEndDate} at midnight (Africa/Lagos).`
      }
    }
    if (accessMode === 'per_member_days') {
      return `Each member has ${accessDays} days of access starting from the moment they begin Lesson 1.`
    }
    return ''
  })()

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (challengeType === 'daily') {
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
          type: 'daily',
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
          onCreated(res.challengeId, 'daily')
        }
      })
    } else {
      if (!courseName.trim()) {
        setError('Please provide a course name.')
        return
      }
      if (accessMode === 'fixed_end' && !accessEndDate) {
        setError('Please specify the fixed access expiration date.')
        return
      }
      if (accessMode === 'per_member_days' && (!accessDays || accessDays < 1)) {
        setError('Access days must be at least 1 day.')
        return
      }

      startTransition(async () => {
        const res = await createChallenge({
          type: 'course',
          name: courseName.trim(),
          description: courseDescription.trim() || undefined,
          enrollmentMode: courseEnrollmentMode,
          accessMode,
          accessEndDate: accessMode === 'fixed_end' ? accessEndDate : undefined,
          accessDays: accessMode === 'per_member_days' ? accessDays : undefined,
        })

        if (!res.success) {
          setError(res.error || 'Failed to create course.')
          return
        }

        if (res.challengeId) {
          onCreated(res.challengeId, 'course')
        }
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] shadow-xl p-6 transition-colors max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              challengeType === 'course'
                ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                : 'bg-[var(--flame-subtle)] text-[var(--flame-accent)] border-[var(--flame-accent)]/20'
            }`}>
              {challengeType === 'course' ? (
                <GraduationCap size={18} strokeWidth={2} />
              ) : (
                <Sparkles size={18} strokeWidth={1.75} />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-ink)] font-serif">
                {challengeType === 'course' ? 'Create Self-Paced Course' : 'Initiate New Consecration Cycle'}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {challengeType === 'course'
                  ? 'Build a sequential learning course with custom access rules.'
                  : 'Define calendar timeline, enrollment policy, and initialize daily slots.'}
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

        {/* ── Type Selector: Daily vs Course ────────────────────────── */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1.5">
            What type of challenge are you creating?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setChallengeType('daily')
                setError(null)
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                challengeType === 'daily'
                  ? 'border-[var(--flame-accent)] bg-[var(--flame-subtle)]/40 ring-1 ring-[var(--flame-accent)]/20'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-[var(--border-subtle)]'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--text-ink)]">
                  <Flame size={14} className="text-[var(--flame-accent)]" />
                  <span>Daily Consecration Cycle</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">
                  Fixed dates, daily releases, streaks, leaderboard, and daily morning push notices.
                </p>
              </div>
              <span className={`text-[10px] font-bold mt-2 inline-flex items-center gap-1 ${
                challengeType === 'daily' ? 'text-[var(--flame-accent)]' : 'text-[var(--text-muted)]'
              }`}>
                {challengeType === 'daily' ? '✓ Selected' : 'Select'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChallengeType('course')
                setError(null)
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                challengeType === 'course'
                  ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/20'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-[var(--border-subtle)]'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--text-ink)]">
                  <GraduationCap size={14} className="text-purple-600 dark:text-purple-400" />
                  <span>Self-Paced Course</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">
                  Sequential lessons, no calendar dates, no streaks, no daily push. Self-paced progression.
                </p>
              </div>
              <span className={`text-[10px] font-bold mt-2 inline-flex items-center gap-1 ${
                challengeType === 'course' ? 'text-purple-600 dark:text-purple-400' : 'text-[var(--text-muted)]'
              }`}>
                {challengeType === 'course' ? '✓ Selected' : 'Select'}
              </span>
            </button>
          </div>
        </div>

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2 leading-relaxed">
              <AlertCircle size={15} strokeWidth={2} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {challengeType === 'daily' ? (
            /* ── Daily Challenge Form ── */
            <>
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
                      name="create_daily_enrollment_mode"
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
                      name="create_daily_enrollment_mode"
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

              <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-muted)] space-y-1">
                <p className="font-semibold text-[var(--text-ink)]">Daily Challenge Policy:</p>
                <p>• Date ranges cannot overlap with another daily challenge.</p>
                <p>• Automatically initializes day slots 1 to {durationDays} with templates.</p>
              </div>
            </>
          ) : (
            /* ── Self-Paced Course Form ── */
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1">
                  Course Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. New Believers Foundations, Biblical Leadership"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1">
                  Short Description <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="A brief overview of what disciples will master through these lessons..."
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Course Enrollment Mode */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1.5">
                  Enrollment Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                      courseEnrollmentMode === 'open'
                        ? 'border-emerald-500 bg-emerald-500/10 text-[var(--text-ink)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="create_course_enrollment_mode"
                      value="open"
                      checked={courseEnrollmentMode === 'open'}
                      onChange={() => setCourseEnrollmentMode('open')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--text-ink)]">
                        <Unlock size={12} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Open for everyone</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                        Any approved account can start lessons right away.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                      courseEnrollmentMode === 'approval'
                        ? 'border-indigo-500 bg-indigo-500/10 text-[var(--text-ink)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="create_course_enrollment_mode"
                      value="approval"
                      checked={courseEnrollmentMode === 'approval'}
                      onChange={() => setCourseEnrollmentMode('approval')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--text-ink)]">
                        <Lock size={12} className="text-indigo-600 dark:text-indigo-400" />
                        <span>Requires approval</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                        Members submit a join request; admin approves enrollment.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Course Access Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1.5">
                  Access Window &amp; Expiration Rule
                </label>
                <div className="space-y-2">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                      accessMode === 'unlimited'
                        ? 'border-purple-500 bg-purple-500/10 text-[var(--text-ink)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="course_access_mode"
                      value="unlimited"
                      checked={accessMode === 'unlimited'}
                      onChange={() => setAccessMode('unlimited')}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="font-semibold text-xs text-[var(--text-ink)]">
                        Unlimited Access
                      </span>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                        Members retain permanent access to all course lessons and materials.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col gap-2 ${
                      accessMode === 'fixed_end'
                        ? 'border-purple-500 bg-purple-500/10 text-[var(--text-ink)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="course_access_mode"
                        value="fixed_end"
                        checked={accessMode === 'fixed_end'}
                        onChange={() => setAccessMode('fixed_end')}
                        className="mt-0.5 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="font-semibold text-xs text-[var(--text-ink)]">
                          Fixed End Date
                        </span>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                          Course closes for everyone simultaneously on a specific calendar date.
                        </p>
                      </div>
                    </div>
                    {accessMode === 'fixed_end' && (
                      <div className="pl-6 pt-1">
                        <label className="block text-[11px] font-semibold text-[var(--text-ink)] mb-1">
                          Expiration Date (Closes at midnight)
                        </label>
                        <input
                          type="date"
                          required
                          value={accessEndDate}
                          onChange={(e) => setAccessEndDate(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    )}
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col gap-2 ${
                      accessMode === 'per_member_days'
                        ? 'border-purple-500 bg-purple-500/10 text-[var(--text-ink)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="course_access_mode"
                        value="per_member_days"
                        checked={accessMode === 'per_member_days'}
                        onChange={() => setAccessMode('per_member_days')}
                        className="mt-0.5 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="font-semibold text-xs text-[var(--text-ink)]">
                          Per-Member Duration (Countdown)
                        </span>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                          Each disciple receives N days of access from the moment they start Lesson 1.
                        </p>
                      </div>
                    </div>
                    {accessMode === 'per_member_days' && (
                      <div className="pl-6 pt-1">
                        <label className="block text-[11px] font-semibold text-[var(--text-ink)] mb-1">
                          Access Duration (Days)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          required
                          value={accessDays}
                          onChange={(e) => setAccessDays(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    )}
                  </label>
                </div>

                {/* Dynamic One-Line Plain-English Summary */}
                <div className="mt-2.5 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200 font-medium flex items-center gap-2">
                  <Check size={14} className="text-purple-600 shrink-0" />
                  <span>{accessSummary}</span>
                </div>
              </div>
            </>
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
              className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                challengeType === 'course' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-[var(--flame-accent)] hover:opacity-95'
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : challengeType === 'course' ? (
                'Create Course'
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
   EDIT CHALLENGE MODAL (Daily & Course)
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
  const isCourse = challenge.type === 'course'

  const [name, setName] = useState(challenge.name)
  const [durationDays, setDurationDays] = useState(challenge.duration_days ?? 40)
  const [startDate, setStartDate] = useState(challenge.start_date ?? '')
  const [enrollmentMode, setEnrollmentMode] = useState<EnrollmentMode>(challenge.enrollment_mode || 'open')

  // Course fields
  const [description, setDescription] = useState(challenge.description ?? '')
  const [accessMode, setAccessMode] = useState<CourseAccessMode>(challenge.access_mode ?? 'unlimited')
  const [accessEndDate, setAccessEndDate] = useState(challenge.access_end_date ?? '')
  const [accessDays, setAccessDays] = useState(challenge.access_days ?? 30)

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

  const accessSummary = (() => {
    if (accessMode === 'unlimited') {
      return 'Members have permanent, lifetime access to all lessons once enrolled.'
    }
    if (accessMode === 'fixed_end') {
      if (!accessEndDate) return 'Access closes for all members on the selected date at midnight (Africa/Lagos).'
      try {
        const formatted = new Date(accessEndDate + 'T00:00:00Z').toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
        return `Access closes for all members on ${formatted} at midnight (Africa/Lagos).`
      } catch {
        return `Access closes for all members on ${accessEndDate} at midnight (Africa/Lagos).`
      }
    }
    if (accessMode === 'per_member_days') {
      return `Each member has ${accessDays} days of access starting from the moment they begin Lesson 1.`
    }
    return ''
  })()

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please provide a title.')
      return
    }

    startTransition(async () => {
      const payload: {
        name: string
        enrollmentMode: EnrollmentMode
        durationDays?: number
        startDate?: string
        description?: string
        accessMode?: CourseAccessMode
        accessEndDate?: string
        accessDays?: number
      } = {
        name: name.trim(),
        enrollmentMode,
      }

      if (isCourse) {
        payload.description = description.trim() || undefined
        payload.accessMode = accessMode
        payload.accessEndDate = accessMode === 'fixed_end' ? accessEndDate : undefined
        payload.accessDays = accessMode === 'per_member_days' ? accessDays : undefined
      } else {
        payload.durationDays = durationDays
        payload.startDate = startDate
      }

      const res = await updateChallenge(challenge.id, payload)

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
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isCourse
                ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                : 'bg-[var(--bg-subtle)] text-[var(--text-ink)] border-[var(--border-hairline)]'
            }`}>
              {isCourse ? <GraduationCap size={18} strokeWidth={2} /> : <Edit3 size={17} strokeWidth={1.75} />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-ink)] font-serif">
                {isCourse ? 'Edit Course Settings' : 'Edit Challenge Settings'}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {isCourse
                  ? 'Update course title, description, enrollment, and access rules.'
                  : 'Update name, duration, schedule, and enrollment mode.'}
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
              {isCourse ? 'Course Name' : 'Challenge Title'}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)]"
            />
          </div>

          {isCourse ? (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1">
                Course Description <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          ) : (
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
          )}

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

          {/* Course Access Mode Editing */}
          {isCourse && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-ink)] mb-1.5">
                Access Window &amp; Expiration Rule
              </label>
              <div className="space-y-2">
                <label
                  className={`p-2.5 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                    accessMode === 'unlimited'
                      ? 'border-purple-500 bg-purple-500/10 text-[var(--text-ink)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="edit_course_access_mode"
                    value="unlimited"
                    checked={accessMode === 'unlimited'}
                    onChange={() => setAccessMode('unlimited')}
                    className="mt-0.5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-semibold text-xs text-[var(--text-ink)]">
                      Unlimited Access
                    </span>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                      Permanent access to all course lessons.
                    </p>
                  </div>
                </label>

                <label
                  className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col gap-2 ${
                    accessMode === 'fixed_end'
                      ? 'border-purple-500 bg-purple-500/10 text-[var(--text-ink)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="edit_course_access_mode"
                      value="fixed_end"
                      checked={accessMode === 'fixed_end'}
                      onChange={() => setAccessMode('fixed_end')}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="font-semibold text-xs text-[var(--text-ink)]">
                        Fixed End Date
                      </span>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                        Course access closes for all members simultaneously on a calendar date.
                      </p>
                    </div>
                  </div>
                  {accessMode === 'fixed_end' && (
                    <div className="pl-6 pt-1">
                      <input
                        type="date"
                        required
                        value={accessEndDate}
                        onChange={(e) => setAccessEndDate(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  )}
                </label>

                <label
                  className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col gap-2 ${
                    accessMode === 'per_member_days'
                      ? 'border-purple-500 bg-purple-500/10 text-[var(--text-ink)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="edit_course_access_mode"
                      value="per_member_days"
                      checked={accessMode === 'per_member_days'}
                      onChange={() => setAccessMode('per_member_days')}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="font-semibold text-xs text-[var(--text-ink)]">
                        Per-Member Duration (Days)
                      </span>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                        Each member gets N days of access from the moment they begin Lesson 1.
                      </p>
                    </div>
                  </div>
                  {accessMode === 'per_member_days' && (
                    <div className="pl-6 pt-1">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        required
                        value={accessDays}
                        onChange={(e) => setAccessDays(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  )}
                </label>
              </div>

              {/* Dynamic summary */}
              <div className="mt-2.5 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200 font-medium flex items-center gap-2">
                <Check size={14} className="text-purple-600 shrink-0" />
                <span>{accessSummary}</span>
              </div>
            </div>
          )}

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

  // Extension states for courses
  const [extendingMemberId, setExtendingMemberId] = useState<string | null>(null)
  const [extendDate, setExtendDate] = useState<string>('')
  const [isExtending, setIsExtending] = useState(false)

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
              const isCourse = challenge.type === 'course'
              const memberState = item.course_member_state

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] space-y-2.5 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isCourse && (
                        <button
                          type="button"
                          onClick={() => {
                            if (extendingMemberId === item.user_id) {
                              setExtendingMemberId(null)
                            } else {
                              setExtendingMemberId(item.user_id)
                              setExtendDate(
                                memberState?.access_override_until
                                  ? memberState.access_override_until.split('T')[0]
                                  : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
                              )
                            }
                          }}
                          className="px-2.5 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition border border-purple-500/20 flex items-center gap-1 cursor-pointer"
                        >
                          <Clock size={12} />
                          <span>Extend Access</span>
                        </button>
                      )}

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
                  </div>

                  {/* Course Member Progress Badge & Details */}
                  {isCourse && (
                    <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2 text-xs flex-wrap">
                      <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <BookOpen size={12} className="text-purple-600" />
                          <span>
                            Progress: <strong>{memberState?.completed_lessons_count ?? 0}</strong> of{' '}
                            <strong>{memberState?.total_lessons_count ?? 0}</strong> lessons
                          </span>
                        </span>
                        <span>•</span>
                        <span>
                          {memberState?.started_at
                            ? `Started ${formatRelativeTime(memberState.started_at)}`
                            : 'Not started yet'}
                        </span>
                      </div>

                      {memberState?.access_override_until && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                          Override until {new Date(memberState.access_override_until).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Inline Access Extension Form */}
                  {extendingMemberId === item.user_id && (
                    <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <label className="font-semibold text-[var(--text-ink)] shrink-0">
                          New Expiration Date:
                        </label>
                        <input
                          type="date"
                          value={extendDate}
                          onChange={(e) => setExtendDate(e.target.value)}
                          className="px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setExtendingMemberId(null)}
                          className="px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-ink)] transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isExtending}
                          onClick={async () => {
                            if (!extendDate) return
                            setIsExtending(true)
                            const res = await extendMemberCourseAccess({
                              courseId: challenge.id,
                              userId: item.user_id,
                              overrideUntil: extendDate,
                            })
                            if (res.success) {
                              setExtendingMemberId(null)
                              await loadData()
                              onUpdate()
                            } else {
                              alert(res.error || 'Failed to extend access.')
                            }
                            setIsExtending(false)
                          }}
                          className="px-3 py-1 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-md shadow-2xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          {isExtending ? <Loader2 size={11} className="animate-spin" /> : null}
                          <span>Save Extension</span>
                        </button>
                      </div>
                    </div>
                  )}
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
  const isCourse = challenge.type === 'course' || summary?.type === 'course'

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
                {isCourse ? 'Permanently Delete Course' : 'Permanently Delete Challenge'}
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
          {isActive && !isCourse && (
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
                <span>Calculating {isCourse ? 'course' : 'challenge'} records...</span>
              </div>
            ) : summary ? (
              isCourse ? (
                /* Course Data Counts */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Lessons</span>
                    <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                      {summary.lessons_count ?? 0}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Content Blocks</span>
                    <p className="text-sm font-bold text-[var(--text-ink)] mt-0.5">
                      {summary.blocks_count ?? 0}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Members Started</span>
                    <p className="text-sm font-bold text-[var(--text-ink)] mt-0.5">
                      {summary.members_started ?? 0}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Completions</span>
                    <p className="text-sm font-bold text-[var(--text-ink)] mt-0.5">
                      {summary.completions_count ?? 0}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Enrollments</span>
                    <p className="text-sm font-bold text-[var(--text-ink)] mt-0.5">
                      {summary.enrollments_count ?? 0}
                    </p>
                  </div>
                </div>
              ) : (
                /* Daily Challenge Data Counts */
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
              )
            ) : null}

            {/* Warning statement */}
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs font-semibold leading-relaxed">
              {isCourse
                ? '⚠️ All member progress, confirmed checkpoint blocks, and lesson completion records for this course will be permanently removed.'
                : "⚠️ Members' private journal notes for this challenge will be permanently deleted and cannot be recovered."}
            </div>
          </div>

          {/* Download Results CSV First Shortcut (for daily challenges) */}
          {!isCourse && (
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
          )}

          {/* Type to confirm */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-semibold text-[var(--text-ink)]">
              To confirm, type <span className="font-mono text-red-600 dark:text-red-400 font-bold">&quot;{challenge.name}&quot;</span> below:
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Type exact title to confirm"
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
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 size={13} strokeWidth={2} />
                  <span>Permanently Delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   COURSE OUTLINE MANAGER MODAL (Mobile-First Up/Down Reordering)
   ───────────────────────────────────────────────────────────── */
function CourseOutlineModal({
  course,
  onClose,
  onUpdated,
}: {
  course: ChallengeWithStats
  onClose: () => void
  onUpdated: () => void
}) {
  const [lessons, setLessons] = useState<CourseLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add Lesson Form
  const [showAddLesson, setShowAddLesson] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newSummary, setNewSummary] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Edit Lesson Info
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Placeholder Lesson Content Modal
  const [contentLesson, setContentLesson] = useState<CourseLesson | null>(null)

  // Reorder / Delete state
  const [isReordering, setIsReordering] = useState(false)
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null)

  async function loadLessons() {
    setLoading(true)
    setError(null)
    const res = await getCourseLessons(course.id)
    if (!res.success) {
      setError(res.error || 'Failed to load course lessons.')
    } else {
      setLessons(res.lessons)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadLessons()
  }, [course.id])

  async function handleAddLesson(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setIsAdding(true)
    setError(null)

    const res = await createCourseLesson(course.id, {
      title: newTitle.trim(),
      summary: newSummary.trim() || undefined,
    })

    if (!res.success) {
      setError(res.error || 'Failed to add lesson.')
    } else {
      setNewTitle('')
      setNewSummary('')
      setShowAddLesson(false)
      await loadLessons()
      onUpdated()
    }
    setIsAdding(false)
  }

  async function handleSaveEditLesson(e: React.FormEvent) {
    e.preventDefault()
    if (!editingLesson || !editTitle.trim()) return
    setIsEditing(true)
    setError(null)

    const res = await updateCourseLesson(editingLesson.id, {
      title: editTitle.trim(),
      summary: editSummary.trim() || undefined,
    })

    if (!res.success) {
      setError(res.error || 'Failed to update lesson.')
    } else {
      setEditingLesson(null)
      await loadLessons()
      onUpdated()
    }
    setIsEditing(false)
  }

  async function handleReorder(index: number, direction: 'up' | 'down') {
    if (isReordering) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= lessons.length) return

    // Warn if members have started
    if ((course.members_started ?? 0) > 0) {
      const confirmed = window.confirm(
        `${course.members_started} member(s) are currently taking this course. Reordering will change their next unlocked lesson sequence. Continue?`
      )
      if (!confirmed) return
    }

    setIsReordering(true)
    setError(null)

    const newOrder = [...lessons]
    const temp = newOrder[index]
    newOrder[index] = newOrder[targetIndex]
    newOrder[targetIndex] = temp

    const lessonIds = newOrder.map((l) => l.id)
    const res = await reorderCourseLessons(course.id, lessonIds)

    if (!res.success) {
      setError(res.error || 'Failed to reorder lessons.')
    } else {
      await loadLessons()
      onUpdated()
    }
    setIsReordering(false)
  }

  async function handleDeleteLesson(lesson: CourseLesson) {
    setDeletingLessonId(lesson.id)
    setError(null)

    // Check member progress on this lesson
    const statsRes = await getCourseLessonProgressStats(lesson.id)
    if (statsRes.count > 0) {
      const confirmed = window.confirm(
        `${statsRes.count} member(s) have already completed "${lesson.title}". Deleting this lesson will permanently remove their completion records for it. Continue?`
      )
      if (!confirmed) {
        setDeletingLessonId(null)
        return
      }
    } else {
      const confirmed = window.confirm(`Delete lesson "${lesson.title}"? This cannot be undone.`)
      if (!confirmed) {
        setDeletingLessonId(null)
        return
      }
    }

    const res = await deleteCourseLesson(lesson.id)
    if (!res.success) {
      setError(res.error || 'Failed to delete lesson.')
    } else {
      await loadLessons()
      onUpdated()
    }
    setDeletingLessonId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--bg-surface)] w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] shadow-2xl p-5 sm:p-6 transition-colors max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
              <BookOpen size={20} strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--text-ink)] font-serif">
                  {course.name}
                </h3>
                {course.is_published ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    Published
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
                    Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Sequential Course Outline &amp; Lesson Management
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

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-2 mt-4 pb-3 border-b border-[var(--border-hairline)] shrink-0 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-ink)]">
              {lessons.length} Lesson{lessons.length === 1 ? '' : 's'}
            </span>
            <span>•</span>
            <span>
              {course.members_started ?? 0} started · {course.members_completed ?? 0} completed
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddLesson(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus size={13} strokeWidth={2} />
            <span>Add Lesson</span>
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-500/20 rounded transition cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Lesson List / Add Form */}
        <div className="mt-4 space-y-3 overflow-y-auto pr-1 flex-1">
          {showAddLesson && (
            <form
              onSubmit={handleAddLesson}
              className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus size={13} strokeWidth={2} />
                  <span>New Lesson (#{lessons.length + 1})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddLesson(false)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-ink)] rounded transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-ink)] mb-1">
                  Lesson Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lesson 1: The Spiritual Anatomy of Man"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-ink)] mb-1">
                  Summary / Objective <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Core devotional takeaway or scripture focus..."
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddLesson(false)}
                  className="px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-ink)] rounded-md transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding || !newTitle.trim()}
                  className="px-3.5 py-1 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-md shadow-2xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {isAdding ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>Save Lesson</span>
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
              <Loader2 size={18} className="animate-spin text-purple-600" />
              <span className="text-xs">Loading course outline...</span>
            </div>
          ) : lessons.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded-xl p-6">
              <BookOpen size={24} className="mx-auto text-purple-400 mb-2" />
              <p className="font-semibold text-[var(--text-ink)]">No Lessons in Course Outline Yet</p>
              <p className="mt-1 max-w-xs mx-auto">
                Add the first lesson to begin constructing the curriculum. Lessons unlock sequentially.
              </p>
              <button
                type="button"
                onClick={() => setShowAddLesson(true)}
                className="mt-3.5 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-2xs transition cursor-pointer"
              >
                <Plus size={13} strokeWidth={2} />
                <span>Add First Lesson</span>
              </button>
            </div>
          ) : (
            lessons.map((lesson, index) => {
              const isFirst = index === 0
              const isLast = index === lessons.length - 1
              const isDeletingThis = deletingLessonId === lesson.id

              return (
                <div
                  key={lesson.id}
                  className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] hover:border-[var(--border-subtle)] transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  {/* Left: Position & Title */}
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center border border-purple-500/25 shrink-0 mt-0.5">
                      #{index + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-ink)] leading-snug">
                        {lesson.title}
                      </h4>
                      {lesson.summary && (
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2">
                          {lesson.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-muted)]">
                        <span className="font-medium text-purple-600 dark:text-purple-400">
                          {lesson.block_count ?? 0} content block{(lesson.block_count ?? 0) === 1 ? '' : 's'}
                        </span>
                        <span>•</span>
                        <span>
                          {lesson.completed_count ?? 0} member{(lesson.completed_count ?? 0) === 1 ? '' : 's'} completed
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {/* Reorder Up / Down */}
                    <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        disabled={isFirst || isReordering}
                        onClick={() => handleReorder(index, 'up')}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-ink)] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || isReordering}
                        onClick={() => handleReorder(index, 'down')}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-ink)] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>

                    {/* Edit Content Button (Placeholder modal) */}
                    <button
                      type="button"
                      onClick={() => setContentLesson(lesson)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-md transition flex items-center gap-1 cursor-pointer"
                      title="Edit interactive content blocks"
                    >
                      <Edit3 size={11} />
                      <span>Edit Content</span>
                    </button>

                    {/* Edit Info */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLesson(lesson)
                        setEditTitle(lesson.title)
                        setEditSummary(lesson.summary || '')
                      }}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] rounded-md transition cursor-pointer"
                      title="Rename or update summary"
                    >
                      <Edit3 size={13} />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      disabled={isDeletingThis}
                      onClick={() => handleDeleteLesson(lesson)}
                      className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-md transition cursor-pointer disabled:opacity-50"
                      title="Delete lesson"
                    >
                      {isDeletingThis ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Edit Lesson Dialog ── */}
        {editingLesson && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-2xl border border-[var(--border-subtle)] shadow-xl p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
                <h4 className="text-sm font-bold text-[var(--text-ink)]">Edit Lesson Details</h4>
                <button
                  type="button"
                  onClick={() => setEditingLesson(null)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-ink)]"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveEditLesson} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-ink)] mb-1">
                    Lesson Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-ink)] mb-1">
                    Summary / Objective
                  </label>
                  <textarea
                    rows={2}
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingLesson(null)}
                    className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-ink)] rounded-md transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isEditing || !editTitle.trim()}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-md shadow-2xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {isEditing ? <Loader2 size={12} className="animate-spin" /> : null}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Real Lesson Content Editor Modal ── */}
        {contentLesson && (
          <LessonContentEditorModal
            courseId={course.id}
            lessonId={contentLesson.id}
            isOpen={Boolean(contentLesson)}
            onClose={() => setContentLesson(null)}
            onLessonSaved={() => {
              loadLessons()
              onUpdated()
            }}
            allLessons={lessons}
            onSelectLesson={(nextId) => {
              const next = lessons.find((l) => l.id === nextId)
              if (next) setContentLesson(next)
            }}
          />
        )}
      </div>
    </div>
  )
}

