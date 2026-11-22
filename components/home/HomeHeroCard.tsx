'use client'

import Link from 'next/link'
import { Flame, Trophy, ArrowRight, BookOpen, Layers, CheckCircle2, Sparkles } from 'lucide-react'
import type { HomeHeroData } from '@/lib/actions/home'

interface HomeHeroCardProps {
  heroData: HomeHeroData
}

export default function HomeHeroCard({ heroData }: HomeHeroCardProps) {
  // 1. Priority 1: Active Daily Challenge
  if (heroData.type === 'daily' && heroData.dailyChallenge) {
    const daily = heroData.dailyChallenge
    const progressPct =
      daily.activitiesTotal > 0
        ? Math.round((daily.activitiesDone / daily.activitiesTotal) * 100)
        : 0

    return (
      <section className="px-4 mt-3">
        <div className="relative overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-5 shadow-xs transition-colors">
          {/* Subtle accent backdrop glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--flame-subtle)] rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

          {/* Top Pill Row */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--flame-subtle)] text-[var(--flame-accent)] border border-[var(--flame-accent)]/25">
              <Flame size={13} strokeWidth={2.2} />
              <span>Day {daily.currentDay} of {daily.durationDays}</span>
            </div>

            <div className="flex items-center gap-2">
              {daily.streak > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--bg-subtle)] text-[var(--text-ink)] border border-[var(--border-hairline)]">
                  <Flame size={11} className="text-[var(--flame-accent)]" />
                  <span>{daily.streak}d streak</span>
                </div>
              )}
              {daily.rank !== null && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--bg-subtle)] text-[var(--text-ink)] border border-[var(--border-hairline)]">
                  <Trophy size={11} className="text-[var(--flame-accent)]" />
                  <span>#{daily.rank}</span>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold text-[var(--text-ink)] tracking-tight font-serif mb-1">
            {daily.name}
          </h2>

          {/* Progress description */}
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mt-2.5 mb-1.5 font-medium">
            <span>
              {daily.activitiesTotal > 0
                ? `${daily.activitiesDone} of ${daily.activitiesTotal} activities done today`
                : 'Today’s spiritual disciplines ready'}
            </span>
            <span className="font-semibold text-[var(--text-ink)]">{progressPct}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border-hairline)] mb-4">
            <div
              className="h-full bg-[var(--flame-accent)] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Action button */}
          <Link
            href={`/dashboard?challenge=${daily.id}`}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 active:scale-[0.99] transition shadow-xs"
          >
            <span>Continue Today</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    )
  }

  // 2. Priority 2: In-Progress Course
  if (heroData.type === 'course' && heroData.course) {
    const course = heroData.course
    const lessonTargetUrl = course.nextLessonId
      ? `/courses/${course.id}/lessons/${course.nextLessonId}`
      : `/courses/${course.id}`

    return (
      <section className="px-4 mt-3">
        <div className="relative overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-5 shadow-xs transition-colors">
          {/* Subtle teal backdrop glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--course-subtle)] rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

          {/* Top Pill Row */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--course-subtle)] text-[var(--course-accent)] border border-[var(--course-accent)]/25">
              <BookOpen size={13} strokeWidth={2} />
              <span>In-Progress Course</span>
            </div>

            <span className="text-[11px] font-semibold text-[var(--text-muted)]">
              {course.lessonsCompleted} / {course.totalLessons} Lessons
            </span>
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold text-[var(--text-ink)] tracking-tight font-serif mb-1">
            {course.name}
          </h2>

          {/* Next Lesson snippet */}
          {course.nextLessonTitle && (
            <p className="text-xs text-[var(--course-accent)] font-semibold mt-1">
              Next: Lesson {course.nextLessonPosition ?? ''} · {course.nextLessonTitle}
            </p>
          )}

          {/* Progress bar */}
          <div className="w-full h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border-hairline)] mt-3 mb-4">
            <div
              className="h-full bg-[var(--course-accent)] rounded-full transition-all duration-300"
              style={{ width: `${course.progressPct}%` }}
            />
          </div>

          {/* Action button */}
          <Link
            href={lessonTargetUrl}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[var(--course-accent)] hover:opacity-95 active:scale-[0.99] transition shadow-xs"
          >
            <span>Continue Lesson</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    )
  }

  // 3. Fallback: Prompt to Explore Challenges & Courses
  return (
    <section className="px-4 mt-3">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-5 shadow-xs text-center transition-colors">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[var(--flame-subtle)] text-[var(--flame-accent)] flex items-center justify-center border border-[var(--flame-accent)]/20 shadow-2xs">
          <Sparkles size={22} strokeWidth={1.75} />
        </div>
        <h2 className="text-base font-bold text-[var(--text-ink)] font-serif mb-1">
          Spiritual Consecration Awaits
        </h2>
        <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed mb-4">
          Discover daily challenges and self-paced courses designed to deepen your spiritual walk.
        </p>
        <Link
          href="/challenges"
          className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-xs font-semibold text-white bg-[var(--flame-accent)] hover:opacity-95 active:scale-[0.99] transition shadow-xs"
        >
          <Layers size={14} />
          <span>Explore Challenges &amp; Courses</span>
        </Link>
      </div>
    </section>
  )
}
