import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLessonForMember } from '@/lib/actions/courses'
import LessonDetailView from '@/components/courses/LessonDetailView'
import { Lock, Clock, ArrowLeft, AlertCircle, Play } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string; lessonId: string }>
  searchParams: Promise<{ preview?: string }>
}

function formatExpiryDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
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

export default async function LessonPage({ params, searchParams }: PageProps) {
  const { id, lessonId } = await params
  const { preview } = await searchParams
  const isPreview = preview === 'true'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const result = await getLessonForMember(id, lessonId, isPreview)

  if (!result.success || !result.lesson || !result.course) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-hairline)] shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 mx-auto flex items-center justify-center">
            <AlertCircle size={22} />
          </div>
          <h2 className="text-base font-bold text-[var(--text-ink)] font-serif">Lesson Not Found</h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            {result.error || 'The requested lesson could not be loaded.'}
          </p>
          <Link
            href={`/courses/${id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold"
          >
            <ArrowLeft size={13} />
            <span>Back to Course Outline</span>
          </Link>
        </div>
      </div>
    )
  }

  // 1. Unpublished Course State
  if (result.status === 'unpublished') {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-hairline)] shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center">
            <Clock size={22} />
          </div>
          <h2 className="text-base font-bold text-[var(--text-ink)] font-serif">
            This Course is Temporarily Unavailable
          </h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Church administration is updating this curriculum. Please check back shortly.
          </p>
          <Link
            href="/challenges"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition"
          >
            <ArrowLeft size={13} />
            <span>Back to Challenges</span>
          </Link>
        </div>
      </div>
    )
  }

  // 2. Expired Access State
  if (result.status === 'expired') {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-hairline)] shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Lock size={22} />
          </div>
          <h2 className="text-base font-bold text-[var(--text-ink)] font-serif">
            Course Access Ended
          </h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Your access ended on {formatExpiryDate(result.expiryDate)}. Please reach out to church admin.
          </p>
          <Link
            href="/challenges"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-ink)] border border-[var(--border-subtle)] text-xs font-semibold transition"
          >
            <ArrowLeft size={13} />
            <span>Back to Challenges</span>
          </Link>
        </div>
      </div>
    )
  }

  // 3. Locked Lesson State (when directly accessed via URL)
  if (result.status === 'locked') {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-hairline)] shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Lock size={22} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Lesson {result.currentLessonNumber} of {result.totalLessons}
            </span>
            <h2 className="text-base font-bold text-[var(--text-ink)] font-serif">
              {result.lesson.title}
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Complete the previous lesson to unlock this lesson.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link
              href={`/courses/${id}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition"
            >
              <ArrowLeft size={13} />
              <span>Back to Course Outline</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <LessonDetailView
      course={result.course}
      lesson={result.lesson}
      blocks={result.blocks || []}
      initialConfirmedBlockIds={result.confirmedBlockIds || []}
      isCompleted={result.isCompleted || false}
      isLastLesson={result.isLastLesson || false}
      previousLessonId={result.previousLessonId || null}
      nextLessonId={result.nextLessonId || null}
      totalLessons={result.totalLessons || 1}
      currentLessonNumber={result.currentLessonNumber || 1}
      isAdmin={result.isAdmin || false}
      isPreview={result.isPreview || false}
    />
  )
}
