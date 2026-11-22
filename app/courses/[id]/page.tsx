import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCourseWithMemberOutline } from '@/lib/actions/courses'
import CourseOutlineView from '@/components/courses/CourseOutlineView'
import { Lock, Clock, ArrowLeft, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
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

export default async function CoursePage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { preview } = await searchParams
  const isPreview = preview === 'true'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const result = await getCourseWithMemberOutline(id, isPreview)

  if (!result.success || !result.course) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-hairline)] shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 mx-auto flex items-center justify-center">
            <AlertCircle size={22} />
          </div>
          <h2 className="text-base font-bold text-[var(--text-ink)] font-serif">Course Not Found</h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            {result.error || 'The requested course does not exist or has been removed.'}
          </p>
          <Link
            href="/challenges"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold"
          >
            <ArrowLeft size={13} />
            <span>Back to Challenges</span>
          </Link>
        </div>
      </div>
    )
  }

  // 1. Unpublished Course State (if admin unpublishes while member is mid-way)
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
            Church administration is updating this curriculum. Please check back shortly or explore other active challenges on the hub.
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

  // 3. Not Enrolled in Approval Course
  if (result.status === 'not_enrolled') {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-hairline)] shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
            <Lock size={22} />
          </div>
          <h2 className="text-base font-bold text-[var(--text-ink)] font-serif">
            Enrollment Approval Required
          </h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            This course requires enrollment approval. Please return to the challenge hub to submit your join request.
          </p>
          <Link
            href="/challenges"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
          >
            <ArrowLeft size={13} />
            <span>Go to Challenges</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <CourseOutlineView
      course={result.course}
      lessons={result.lessons || []}
      isStarted={result.isStarted || false}
      completedAt={result.completedAt || null}
      startedAt={result.startedAt || null}
      accessDescription={result.accessDescription || null}
      nextLessonId={result.nextLessonId || null}
      isAdmin={result.isAdmin || false}
      isPreview={result.isPreview || false}
    />
  )
}
