'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Lock,
  Eye,
  AlertCircle,
  Loader2,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import { LessonBlockRenderer } from '@/components/courses/LessonBlockRenderer'
import { confirmMemberBlock, completeMemberLesson } from '@/lib/actions/courses'
import type { CourseBlock } from '@/lib/types'

interface LessonDetailViewProps {
  course: {
    id: string
    name: string
  }
  lesson: {
    id: string
    challenge_id: string
    position: number
    title: string
    summary: string | null
  }
  blocks: CourseBlock[]
  initialConfirmedBlockIds: string[]
  isCompleted: boolean
  isLastLesson: boolean
  previousLessonId: string | null
  nextLessonId: string | null
  totalLessons: number
  currentLessonNumber: number
  isAdmin?: boolean
  isPreview?: boolean
}

export default function LessonDetailView({
  course,
  lesson,
  blocks,
  initialConfirmedBlockIds,
  isCompleted: initialIsCompleted,
  isLastLesson,
  previousLessonId,
  nextLessonId,
  totalLessons,
  currentLessonNumber,
  isAdmin = false,
  isPreview = false,
}: LessonDetailViewProps) {
  const router = useRouter()
  const [confirmedBlockIds, setConfirmedBlockIds] = useState<Set<string>>(
    new Set(initialConfirmedBlockIds)
  )
  const [isConfirmingBlockId, setIsConfirmingBlockId] = useState<string | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(initialIsCompleted)

  // Identify required link blocks that are not yet confirmed
  const requiredLinkBlocks = blocks.filter((b) => b.type === 'link' && b.required)
  const unconfirmedRequiredBlocks = requiredLinkBlocks.filter(
    (b) => !confirmedBlockIds.has(b.id)
  )
  const hasUnconfirmedRequired = unconfirmedRequiredBlocks.length > 0 && !isPreview

  async function handleConfirmBlock(blockId: string) {
    if (isPreview) {
      setConfirmedBlockIds((prev) => new Set([...prev, blockId]))
      return
    }

    setIsConfirmingBlockId(blockId)
    setErrorMessage(null)

    const res = await confirmMemberBlock(blockId, isPreview)
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to confirm block completion.')
    } else {
      setConfirmedBlockIds((prev) => new Set([...prev, blockId]))
    }
    setIsConfirmingBlockId(null)
  }

  async function handleComplete() {
    if (isPreview) return
    if (hasUnconfirmedRequired) return

    setIsCompleting(true)
    setErrorMessage(null)

    const res = await completeMemberLesson(lesson.id, course.id, isPreview)

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to complete lesson.')
      setIsCompleting(false)
      return
    }

    setIsCompleted(true)

    if (isLastLesson || res.completedCourse) {
      router.push(`/courses/${course.id}/completed`)
    } else if (nextLessonId) {
      router.push(`/courses/${course.id}/lessons/${nextLessonId}`)
    } else {
      router.push(`/courses/${course.id}`)
    }
  }

  const previewQuery = isPreview ? '?preview=true' : ''

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-ink)] pb-32 transition-colors">
      {/* ── Admin Preview Banner ─────────────────────────────── */}
      {isPreview && (
        <div className="bg-purple-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm sticky top-0 z-50">
          <div className="flex items-center gap-2 mx-auto max-w-4xl w-full">
            <Eye size={15} className="shrink-0 animate-pulse" />
            <span>
              Preview Mode — You are viewing this lesson as a member. Complete buttons are disabled and no progress is recorded.
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

      {/* ── Top Bar Header ──────────────────────────────────── */}
      <header className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] sticky top-0 z-40 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link
            href={`/courses/${course.id}${previewQuery}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-ink)] transition shrink-0"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Course Outline</span>
            <span className="sm:hidden">Outline</span>
          </Link>

          {/* Subtle Progress Indicator */}
          <div className="flex items-center gap-2 text-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[var(--text-muted)]">
              <BookOpen size={11} className="text-purple-600 dark:text-purple-400" />
              <span>
                Lesson {currentLessonNumber} of {totalLessons}
              </span>
            </span>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 size={12} strokeWidth={2.2} />
                <span className="hidden sm:inline">Completed</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Lesson Content ─────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-xs font-bold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Lesson Header */}
        <div className="space-y-3 pb-6 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{course.name}</span>
            <span>•</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              Lesson {currentLessonNumber}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-ink)] font-serif leading-tight">
            {lesson.title}
          </h1>

          {lesson.summary && (
            <p className="text-sm text-[var(--text-muted)] leading-relaxed italic">
              {lesson.summary}
            </p>
          )}
        </div>

        {/* Render Blocks with Shared Renderer */}
        <LessonBlockRenderer
          blocks={blocks}
          isMemberView={!isPreview}
          confirmedBlockIds={confirmedBlockIds}
          onConfirmBlock={handleConfirmBlock}
          isConfirmingBlockId={isConfirmingBlockId}
        />
      </main>

      {/* ── Sticky Bottom Action Bar ─────────────────────────── */}
      <aside className="fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-hairline)] shadow-lg transition-colors">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Previous / Outline Navigation */}
          <div className="flex items-center gap-2">
            {previousLessonId ? (
              <Link
                href={`/courses/${course.id}/lessons/${previousLessonId}${previewQuery}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] border border-[var(--border-hairline)] transition"
              >
                <ChevronLeft size={14} />
                <span>Previous Lesson</span>
              </Link>
            ) : (
              <Link
                href={`/courses/${course.id}${previewQuery}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] border border-[var(--border-hairline)] transition"
              >
                <ArrowLeft size={13} />
                <span>Outline</span>
              </Link>
            )}
          </div>

          {/* Right Action: Mark Complete / Continue / Next */}
          <div className="flex flex-col sm:items-end gap-1">
            {isPreview ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] italic">
                  Preview mode (Completion disabled)
                </span>
                {nextLessonId && (
                  <Link
                    href={`/courses/${course.id}/lessons/${nextLessonId}?preview=true`}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition"
                  >
                    <span>Next Lesson</span>
                    <ChevronRight size={14} />
                  </Link>
                )}
              </div>
            ) : isCompleted ? (
              /* If already completed: show completed badge and navigation to next */
              <div className="flex items-center gap-2.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                  <CheckCircle2 size={14} strokeWidth={2.2} />
                  <span>Completed</span>
                </div>

                {nextLessonId ? (
                  <Link
                    href={`/courses/${course.id}/lessons/${nextLessonId}`}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition shadow-2xs"
                  >
                    <span>Next Lesson</span>
                    <ChevronRight size={14} />
                  </Link>
                ) : (
                  <Link
                    href={`/courses/${course.id}/completed`}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-2xs"
                  >
                    <span>Course Certificate</span>
                    <Sparkles size={14} />
                  </Link>
                )}
              </div>
            ) : (
              /* Incomplete Lesson: Mark Complete & Continue Button */
              <div className="flex flex-col sm:items-end gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={hasUnconfirmedRequired || isCompleting}
                  onClick={handleComplete}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-xs transition cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCompleting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Completing Lesson...</span>
                    </>
                  ) : isLastLesson ? (
                    <>
                      <span>Complete Course</span>
                      <Sparkles size={14} />
                    </>
                  ) : (
                    <>
                      <span>Mark complete &amp; continue</span>
                      <ChevronRight size={14} strokeWidth={2.2} />
                    </>
                  )}
                </button>

                {hasUnconfirmedRequired && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    Open the test link and confirm to continue
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
