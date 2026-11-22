'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Lock,
  Play,
  Clock,
  Sparkles,
  AlertCircle,
  Eye,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react'
import { startMemberCourse } from '@/lib/actions/courses'
import type { MemberLessonOutlineItem } from '@/lib/types'

interface CourseOutlineViewProps {
  course: {
    id: string
    name: string
    description: string | null
    access_mode: string | null
    access_end_date: string | null
    access_days: number | null
    timezone: string | null
    is_published: boolean
    enrollment_mode: string
  }
  lessons: MemberLessonOutlineItem[]
  isStarted: boolean
  completedAt: string | null
  startedAt: string | null
  accessDescription: string | null
  nextLessonId: string | null
  isAdmin?: boolean
  isPreview?: boolean
}

export default function CourseOutlineView({
  course,
  lessons,
  isStarted,
  completedAt,
  startedAt,
  accessDescription,
  nextLessonId,
  isAdmin = false,
  isPreview = false,
}: CourseOutlineViewProps) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockedNoticeLessonId, setLockedNoticeLessonId] = useState<string | null>(null)

  const completedCount = lessons.filter((l) => l.status === 'completed').length
  const totalCount = lessons.length
  const progressPct =
    totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0
  const isCourseFinished = Boolean(completedAt) || (totalCount > 0 && completedCount === totalCount)

  async function handleStartCourse() {
    if (isPreview) {
      if (nextLessonId) {
        router.push(`/courses/${course.id}/lessons/${nextLessonId}?preview=true`)
      }
      return
    }

    setStarting(true)
    setError(null)

    const res = await startMemberCourse(course.id)
    if (!res.success) {
      setError(res.error || 'Failed to start course.')
      setStarting(false)
    } else {
      if (nextLessonId) {
        router.push(`/courses/${course.id}/lessons/${nextLessonId}`)
      } else {
        router.refresh()
      }
    }
  }

  function handleLessonClick(lesson: MemberLessonOutlineItem) {
    if (lesson.status === 'locked' && !isPreview) {
      setLockedNoticeLessonId(lesson.id)
      return
    }

    const previewQuery = isPreview ? '?preview=true' : ''
    router.push(`/courses/${course.id}/lessons/${lesson.id}${previewQuery}`)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-ink)] pb-16 transition-colors">
      {/* ── Admin Preview Banner ─────────────────────────────── */}
      {isPreview && (
        <div className="bg-purple-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm sticky top-0 z-40">
          <div className="flex items-center gap-2 mx-auto max-w-4xl w-full">
            <Eye size={15} className="shrink-0 animate-pulse" />
            <span>
              Preview Mode — You are viewing this course as a member. All lessons are readable and no progress is recorded.
            </span>
          </div>
          <Link
            href="/admin"
            className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold shrink-0 transition"
          >
            Exit Preview
          </Link>
        </div>
      )}

      {/* ── Top Bar Navigation ──────────────────────────────── */}
      <header className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] sticky top-0 z-30 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/challenges"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-ink)] transition"
          >
            <ArrowLeft size={14} />
            <span>Back to Challenges</span>
          </Link>

          <div className="flex items-center gap-2">
            {isCourseFinished && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 size={12} strokeWidth={2.2} />
                <span>Completed</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Container ──────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Hero Card ──────────────────────────────────────── */}
        <section className="bg-[var(--bg-surface)] rounded-2xl p-6 sm:p-8 border border-[var(--border-hairline)] shadow-2xs space-y-5 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[11px]">
                <BookOpen size={11} strokeWidth={2.2} />
                <span>Self-Paced Course · {totalCount} Lessons</span>
              </span>

              {course.enrollment_mode === 'approval' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck size={10} strokeWidth={2} />
                  <span>Enrolled</span>
                </span>
              )}

              {/* Access Info Pill (Unlimited courses show nothing) */}
              {accessDescription && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] font-medium">
                  <Clock size={11} />
                  <span>{accessDescription}</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-ink)] font-serif">
              {course.name}
            </h1>

            {course.description && (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-2xl pt-1">
                {course.description}
              </p>
            )}
          </div>

          {/* Progress Bar (if started or completed) */}
          {isStarted && (
            <div className="space-y-1.5 pt-2 border-t border-[var(--border-hairline)]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)] font-medium">
                  {completedCount} of {totalCount} lessons completed
                </span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {progressPct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden border border-[var(--border-hairline)]">
                <div
                  className="h-full rounded-full bg-purple-600 dark:bg-purple-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Prominent Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
            {!isStarted ? (
              <button
                type="button"
                disabled={starting}
                onClick={handleStartCourse}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-xs transition cursor-pointer active:scale-[0.99] disabled:opacity-50"
              >
                <Play size={15} fill="currentColor" />
                <span>{starting ? 'Starting Course...' : 'Start Course'}</span>
              </button>
            ) : isCourseFinished ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
                <Link
                  href={nextLessonId ? `/courses/${course.id}/lessons/${nextLessonId}${isPreview ? '?preview=true' : ''}` : '#'}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] text-[var(--text-ink)] font-semibold text-sm border border-[var(--border-subtle)] transition cursor-pointer"
                >
                  <RotateCcw size={15} />
                  <span>Review from First Lesson</span>
                </Link>
                <Link
                  href={`/courses/${course.id}/completed`}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold text-sm border border-emerald-500/25 transition cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  <span>View Completion Certificate</span>
                </Link>
              </div>
            ) : (
              <Link
                href={nextLessonId ? `/courses/${course.id}/lessons/${nextLessonId}${isPreview ? '?preview=true' : ''}` : '#'}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-xs transition cursor-pointer active:scale-[0.99]"
              >
                <span>Continue Course</span>
                <ChevronRight size={15} strokeWidth={2.5} />
              </Link>
            )}
          </div>
        </section>

        {/* ── Lesson Outline Section ─────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[var(--text-ink)] uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen size={14} className="text-purple-600 dark:text-purple-400" />
              <span>Curriculum Outline</span>
            </h2>
            <span className="text-[11px] text-[var(--text-muted)]">
              Sequential Unlock
            </span>
          </div>

          <div className="space-y-2.5">
            {lessons.map((lesson, index) => {
              const isLocked = lesson.status === 'locked' && !isPreview
              const isCurrent = lesson.status === 'current'
              const isCompleted = lesson.status === 'completed'
              const showLockedNotice = lockedNoticeLessonId === lesson.id

              return (
                <div key={lesson.id} className="space-y-1">
                  <div
                    onClick={() => handleLessonClick(lesson)}
                    className={`p-4 rounded-xl border transition-all select-none flex items-start justify-between gap-4 ${
                      isLocked
                        ? 'bg-[var(--bg-subtle)]/60 border-[var(--border-hairline)] opacity-75 cursor-not-allowed'
                        : isCurrent
                        ? 'bg-[var(--bg-surface)] border-purple-500/50 shadow-xs cursor-pointer hover:border-purple-500'
                        : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] hover:border-stone-400 dark:hover:border-stone-600 cursor-pointer shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Status Icon */}
                      <div className="mt-0.5 shrink-0">
                        {isCompleted ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/25">
                            <CheckCircle2 size={16} strokeWidth={2.2} />
                          </div>
                        ) : isCurrent ? (
                          <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                            <Play size={14} fill="currentColor" className="ml-0.5" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[var(--bg-subtle)] text-stone-400 dark:text-stone-500 flex items-center justify-center border border-[var(--border-hairline)]">
                            <Lock size={14} />
                          </div>
                        )}
                      </div>

                      {/* Lesson Number & Title */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                            Lesson {index + 1}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                              Current
                            </span>
                          )}
                        </div>

                        <h3
                          className={`text-sm font-bold font-serif leading-snug ${
                            isLocked ? 'text-[var(--text-muted)]' : 'text-[var(--text-ink)]'
                          }`}
                        >
                          {lesson.title}
                        </h3>

                        {lesson.summary && (
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed pt-0.5 line-clamp-2">
                            {lesson.summary}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right Chevron / Indicator */}
                    <div className="mt-1 shrink-0">
                      {isLocked ? (
                        <Lock size={14} className="text-stone-400" />
                      ) : (
                        <ChevronRight
                          size={16}
                          className={isCurrent ? 'text-purple-600 dark:text-purple-400' : 'text-stone-400'}
                        />
                      )}
                    </div>
                  </div>

                  {/* Inline Friendly Locked Toast/Banner */}
                  {showLockedNotice && (
                    <div className="mx-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                      <div className="flex items-center gap-1.5">
                        <Lock size={12} className="shrink-0" />
                        <span>Complete the previous lesson to unlock this lesson.</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setLockedNoticeLessonId(null)
                        }}
                        className="text-[10px] font-semibold underline hover:opacity-80 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
