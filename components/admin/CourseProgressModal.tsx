'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Download,
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  Loader2,
  Lock,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Plus,
} from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import { getCourseProgressData, extendMemberCourseAccess } from '@/lib/actions/admin'
import type { CourseProgressSummary, CourseMemberProgressMember } from '@/lib/types'

interface CourseProgressModalProps {
  courseId: string
  courseName: string
  isOpen: boolean
  onClose: () => void
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatTimestamp(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export default function CourseProgressModal({
  courseId,
  courseName,
  isOpen,
  onClose,
}: CourseProgressModalProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<CourseProgressSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Extend access state
  const [extendingUserId, setExtendingUserId] = useState<string | null>(null)
  const [extendDate, setExtendDate] = useState<string>('')
  const [isSavingExtend, setIsSavingExtend] = useState(false)
  const [extendError, setExtendError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)

    const res = await getCourseProgressData(courseId)
    if (!res.success || !res.data) {
      setError(res.error || 'Failed to load course progress data.')
    } else {
      setData(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, courseId])

  if (!isOpen) return null

  // ── CSV Export ─────────────────────────────────────────────
  function handleExportCsv() {
    if (!data) return

    const headers = [
      'Member Name',
      'Email',
      'Started At',
      'Lessons Completed',
      'Total Lessons',
      'Completion Rate',
      'Course Completed',
      'Completed At',
      'Last Activity',
      'Access Override Until',
    ]

    const rows = data.members.map((m) => {
      const pct =
        data.total_lessons > 0
          ? Math.round((m.lessons_completed_count / data.total_lessons) * 100)
          : 0

      return [
        escapeCsv(m.full_name),
        escapeCsv(m.email),
        escapeCsv(formatDate(m.started_at)),
        escapeCsv(m.lessons_completed_count),
        escapeCsv(data.total_lessons),
        escapeCsv(`${pct}%`),
        escapeCsv(m.completed_at ? 'Yes' : 'No'),
        escapeCsv(m.completed_at ? formatDate(m.completed_at) : 'N/A'),
        escapeCsv(formatTimestamp(m.last_activity_at)),
        escapeCsv(m.access_override_until ? formatDate(m.access_override_until) : 'None'),
      ]
    })

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().split('T')[0]
    link.href = url
    link.setAttribute('download', `${data.course_name.replace(/[^a-zA-Z0-9_-]/g, '_')}_progress_${stamp}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // ── Extend Access Handler ──────────────────────────────────
  async function handleSaveExtend(userId: string) {
    if (!extendDate) return

    setIsSavingExtend(true)
    setExtendError(null)

    // Calculate ISO timestamp for end of specified date in UTC
    const dateObj = new Date(extendDate + 'T23:59:59Z')
    const res = await extendMemberCourseAccess({
      courseId,
      userId,
      overrideUntil: dateObj.toISOString(),
    })

    if (!res.success) {
      setExtendError(res.error || 'Failed to extend member access.')
    } else {
      setExtendingUserId(null)
      setExtendDate('')
      await loadData()
    }
    setIsSavingExtend(false)
  }

  const completionRate =
    data && data.started_count > 0
      ? Math.round((data.completed_count / data.started_count) * 100)
      : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--bg-surface)] w-full max-w-4xl rounded-2xl border border-[var(--border-subtle)] shadow-2xl p-5 sm:p-6 max-h-[92vh] flex flex-col transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)] shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Course Analytics &amp; Progress
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-ink)] font-serif">
              {courseName}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || !data || data.members.length === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] text-[var(--text-ink)] text-xs font-semibold border border-[var(--border-hairline)] transition cursor-pointer disabled:opacity-40"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto pt-4 space-y-6 pr-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
              <Loader2 size={22} className="animate-spin text-purple-600" />
              <span className="text-xs">Loading course progress metrics...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : data ? (
            <>
              {/* ── KPI Cards ─────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-1">
                  <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold">
                    <span>Members Started</span>
                    <Users size={14} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-2xl font-bold text-[var(--text-ink)]">
                    {data.started_count}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-1">
                  <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold">
                    <span>Members Completed</span>
                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold text-[var(--text-ink)]">
                    {data.completed_count}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-1">
                  <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold">
                    <span>Completion Rate</span>
                    <TrendingUp size={14} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-[var(--text-ink)]">
                    {completionRate}%
                  </p>
                </div>
              </div>

              {/* ── Per-Lesson Drop-off / Completion Breakdown ───────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--text-ink)] uppercase tracking-wider">
                    Lesson Completion &amp; Drop-off Analysis
                  </h4>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {data.lessons.length} Lessons Total
                  </span>
                </div>

                <div className="space-y-2">
                  {data.lessons.map((lesson, idx) => {
                    const pctOfStarted =
                      data.started_count > 0
                        ? Math.round((lesson.completed_count / data.started_count) * 100)
                        : 0

                    return (
                      <div
                        key={lesson.id}
                        className="p-3 rounded-xl bg-[var(--bg-subtle)]/70 border border-[var(--border-hairline)] space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--text-ink)] flex items-center gap-1.5">
                            <span className="text-[10px] text-stone-400">#{lesson.position}</span>
                            <span>{lesson.title}</span>
                          </span>
                          <span className="font-semibold text-purple-700 dark:text-purple-300">
                            {lesson.completed_count} member{lesson.completed_count === 1 ? '' : 's'} ({pctOfStarted}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--border-hairline)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-600 dark:bg-purple-500 transition-all"
                            style={{ width: `${pctOfStarted}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Per-Member Engagement Table ─────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--text-ink)] uppercase tracking-wider">
                    Enrolled Member Activity ({data.members.length})
                  </h4>
                </div>

                {extendError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                    {extendError}
                  </div>
                )}

                {data.members.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded-xl p-4">
                    No members have started this course yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[var(--border-hairline)] rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[var(--bg-subtle)] text-[var(--text-muted)] border-b border-[var(--border-hairline)]">
                          <th className="py-2.5 px-3 font-semibold">Member</th>
                          <th className="py-2.5 px-3 font-semibold">Lessons</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold">Last Active</th>
                          <th className="py-2.5 px-3 font-semibold">Access Expiry</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-hairline)]">
                        {data.members.map((member) => {
                          const isFinished = Boolean(member.completed_at)
                          const isExtending = extendingUserId === member.user_id

                          return (
                            <tr key={member.user_id} className="hover:bg-[var(--bg-subtle)]/40 transition">
                              {/* Member info */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <UserAvatar
                                    name={member.full_name}
                                    avatarUrl={member.avatar_url}
                                    size="sm"
                                  />
                                  <div>
                                    <p className="font-semibold text-[var(--text-ink)] line-clamp-1">
                                      {member.full_name}
                                    </p>
                                    <p className="text-[10px] text-[var(--text-muted)] line-clamp-1">
                                      {member.email}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Lessons count */}
                              <td className="py-2.5 px-3 font-medium">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold text-[11px]">
                                  {member.lessons_completed_count} / {data.total_lessons}
                                </span>
                              </td>

                              {/* Status */}
                              <td className="py-2.5 px-3">
                                {isFinished ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 size={10} strokeWidth={2.5} />
                                    <span>Finished</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                                    In Progress
                                  </span>
                                )}
                              </td>

                              {/* Last Active */}
                              <td className="py-2.5 px-3 text-[var(--text-muted)]">
                                {formatTimestamp(member.last_activity_at)}
                              </td>

                              {/* Access Expiry */}
                              <td className="py-2.5 px-3 text-[var(--text-muted)]">
                                {member.access_override_until ? (
                                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                                    Extended to {formatDate(member.access_override_until)}
                                  </span>
                                ) : data.access_mode === 'unlimited' ? (
                                  <span>Unlimited</span>
                                ) : data.access_mode === 'fixed_end' ? (
                                  <span>Until {formatDate(data.access_end_date)}</span>
                                ) : (
                                  <span>{data.access_days}d from start</span>
                                )}
                              </td>

                              {/* Action */}
                              <td className="py-2.5 px-3 text-right">
                                {isExtending ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <input
                                      type="date"
                                      value={extendDate}
                                      onChange={(e) => setExtendDate(e.target.value)}
                                      className="px-2 py-1 text-xs rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-ink)]"
                                    />
                                    <button
                                      type="button"
                                      disabled={!extendDate || isSavingExtend}
                                      onClick={() => handleSaveExtend(member.user_id)}
                                      className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs disabled:opacity-50 transition cursor-pointer"
                                    >
                                      {isSavingExtend ? '...' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setExtendingUserId(null)}
                                      className="p-1 rounded text-stone-400 hover:text-stone-600"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExtendingUserId(member.user_id)
                                      setExtendDate('')
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] text-[var(--text-ink)] text-xs font-semibold border border-[var(--border-hairline)] transition cursor-pointer"
                                  >
                                    Extend
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
