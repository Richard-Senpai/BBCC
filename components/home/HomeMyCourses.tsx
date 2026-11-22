'use client'

import Link from 'next/link'
import { BookOpen, ChevronRight, Clock, ArrowRight } from 'lucide-react'
import type { HubCourseItem } from '@/lib/types'

interface HomeMyCoursesProps {
  courses: HubCourseItem[]
}

export default function HomeMyCourses({ courses }: HomeMyCoursesProps) {
  if (courses.length === 0) return null

  return (
    <section className="mt-5">
      <div className="px-4 flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-[var(--course-accent)]" />
          <h3 className="text-xs font-bold text-[var(--text-ink)] uppercase tracking-wider">
            My Courses
          </h3>
          <span className="text-[10px] font-semibold text-[var(--course-accent)] bg-[var(--course-subtle)] px-1.5 py-0.5 rounded-full">
            {courses.length}
          </span>
        </div>
        <Link
          href="/challenges?filter=my"
          className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-ink)] flex items-center gap-0.5"
        >
          <span>View all</span>
          <ChevronRight size={12} />
        </Link>
      </div>

      {/* Horizontal scroll container */}
      <div className="px-4 flex gap-3 overflow-x-auto no-scrollbar pb-1 snap-x">
        {courses.map((course) => {
          const targetUrl = course.next_uncompleted_lesson_id
            ? `/courses/${course.id}/lessons/${course.next_uncompleted_lesson_id}`
            : `/courses/${course.id}`

          const isExpiringSoon =
            course.days_until_expiry !== null &&
            course.days_until_expiry !== undefined &&
            course.days_until_expiry <= 7

          return (
            <div
              key={course.id}
              className="snap-start shrink-0 w-[240px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-4 shadow-2xs flex flex-col justify-between transition-colors"
            >
              <div>
                {/* Expiring soon badge */}
                {isExpiringSoon && (
                  <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md mb-2">
                    <Clock size={10} />
                    <span>
                      {course.days_until_expiry === 0
                        ? 'Access ends today'
                        : `Access ends in ${course.days_until_expiry}d`}
                    </span>
                  </div>
                )}

                <h4 className="text-sm font-bold text-[var(--text-ink)] font-serif line-clamp-2 leading-snug">
                  {course.name}
                </h4>

                <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                  {course.lessons_completed} of {course.total_lessons} lessons ({course.progress_pct}%)
                </p>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border-hairline)] mt-2">
                  <div
                    className="h-full bg-[var(--course-accent)] rounded-full transition-all duration-200"
                    style={{ width: `${course.progress_pct}%` }}
                  />
                </div>
              </div>

              <div className="mt-3.5 pt-2 border-t border-[var(--border-hairline)]">
                <Link
                  href={targetUrl}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold text-white bg-[var(--course-accent)] hover:opacity-90 transition shadow-2xs"
                >
                  <span>Continue</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
