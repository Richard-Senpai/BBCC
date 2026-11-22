import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CheckCircle2, Sparkles, ArrowLeft, RotateCcw, BookOpen } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CourseCompletedPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch course info
  const { data: course } = await supabase
    .from('challenges')
    .select('id, name, description')
    .eq('id', id)
    .single()

  // Fetch lessons count
  const { count: totalLessons } = await supabase
    .from('course_lessons')
    .select('*', { count: 'exact', head: true })
    .eq('challenge_id', id)

  const courseTitle = course?.name || 'Self-Paced Course'

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4 py-12 transition-colors">
      <div className="max-w-lg w-full bg-[var(--bg-surface)] rounded-3xl p-8 sm:p-10 border border-emerald-500/30 shadow-xl text-center space-y-6 relative overflow-hidden transition-colors">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-radial from-emerald-500/15 to-transparent pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Animated Celebration Badge */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30 shadow-xs animate-bounce">
            <Sparkles size={32} strokeWidth={2} />
          </div>

          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
              <CheckCircle2 size={13} strokeWidth={2.2} />
              <span>Course Completed</span>
            </span>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-ink)] font-serif pt-2">
              Congratulations!
            </h1>

            <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
              You have completed all {totalLessons ?? 0} lessons in{' '}
              <strong className="text-[var(--text-ink)]">{courseTitle}</strong>.
            </p>
          </div>

          {course?.description && (
            <div className="p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-muted)] text-left leading-relaxed">
              <span className="font-semibold text-[var(--text-ink)] block mb-1">
                About this Curriculum:
              </span>
              {course.description}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/challenges"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer active:scale-[0.99]"
            >
              <ArrowLeft size={14} />
              <span>Back to Challenges</span>
            </Link>

            <Link
              href={`/courses/${id}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] text-[var(--text-ink)] font-semibold text-xs border border-[var(--border-subtle)] transition cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Review Lessons</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
