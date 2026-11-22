'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  GraduationCap,
  Clock,
  Lock,
  CheckCircle2,
  ArrowRight,
  UserPlus,
  Loader2,
  AlertCircle,
  Play,
  RotateCcw,
} from 'lucide-react'
import { requestChallengeEnrollment } from '@/lib/actions/challenges'
import type { HubCourseItem, Profile } from '@/lib/types'

interface MemberCoursesSectionProps {
  courses: HubCourseItem[]
  profile: Profile
  onEnrollmentRequested?: (courseId: string) => void
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

export default function MemberCoursesSection({
  courses,
  profile,
  onEnrollmentRequested,
}: MemberCoursesSectionProps) {
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestedMap, setRequestedMap] = useState<Record<string, boolean>>({})

  async function handleRequestEnrollment(courseId: string) {
    setRequestingId(courseId)
    setRequestError(null)

    const res = await requestChallengeEnrollment(courseId)
    if (!res.success) {
      setRequestError(res.error || 'Failed to submit request to join course.')
    } else {
      setRequestedMap((prev) => ({ ...prev, [courseId]: true }))
      if (onEnrollmentRequested) {
        onEnrollmentRequested(courseId)
      }
    }
    setRequestingId(null)
  }

  // If there are no published courses, show friendly single-line note or hide gracefully
  if (!courses || courses.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[var(--text-ink)] uppercase tracking-wider flex items-center gap-1.5">
            <GraduationCap size={15} className="text-purple-600 dark:text-purple-400" />
            <span>Self-Paced Courses</span>
          </h2>
        </div>
        <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-dashed border-[var(--border-subtle)] text-center">
          <p className="text-xs text-[var(--text-muted)] italic">
            No self-paced courses are currently available. Check back soon for new curriculum offerings.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-[var(--text-ink)] uppercase tracking-wider flex items-center gap-1.5">
          <GraduationCap size={15} className="text-purple-600 dark:text-purple-400" />
          <span>Self-Paced Courses</span>
        </h2>
        <span className="text-[11px] font-medium text-[var(--text-muted)]">
          {courses.length} Course{courses.length === 1 ? '' : 's'} Available
        </span>
      </div>

      {requestError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{requestError}</span>
        </div>
      )}

      {/* Course Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map((course) => {
          const isOptimisticPending = requestedMap[course.id]
          const cardState = isOptimisticPending ? 'awaiting_approval' : course.card_state

          // Access Expiry Notice: If within 7 days and not expired, show gentle notice
          let gentleExpiryNotice: string | null = null
          if (!course.is_access_expired && course.access_mode !== 'unlimited') {
            if (course.days_until_expiry !== null && course.days_until_expiry <= 7) {
              if (course.days_until_expiry === 0) {
                gentleExpiryNotice = 'Access ends today'
              } else if (course.days_until_expiry === 1) {
                gentleExpiryNotice = 'Access ends tomorrow'
              } else {
                gentleExpiryNotice = `Access ends in ${course.days_until_expiry} days`
              }
            }
          }

          return (
            <div
              key={course.id}
              className={`bg-[var(--bg-surface)] rounded-2xl p-5 border shadow-2xs flex flex-col justify-between transition-all duration-200 ${
                cardState === 'completed'
                  ? 'border-emerald-500/30 dark:border-emerald-500/20'
                  : cardState === 'continue'
                  ? 'border-purple-500/40 dark:border-purple-500/30'
                  : 'border-[var(--border-hairline)]'
              }`}
            >
              <div>
                {/* Badges Bar */}
                <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                      <BookOpen size={10} strokeWidth={2.2} />
                      <span>{course.total_lessons} Lessons</span>
                    </span>

                    {course.enrollment_mode === 'approval' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                        <Lock size={10} />
                        <span>Approval Required</span>
                      </span>
                    )}

                    {cardState === 'completed' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
                        <CheckCircle2 size={11} strokeWidth={2.2} />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>

                  {/* Gentle 7-day expiry notice (hidden for unlimited) */}
                  {gentleExpiryNotice && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <Clock size={10} strokeWidth={2} />
                      <span>{gentleExpiryNotice}</span>
                    </span>
                  )}
                </div>

                {/* Course Title & Description */}
                <h3 className="text-base font-bold text-[var(--text-ink)] font-serif leading-snug">
                  {course.name}
                </h3>
                {course.description && (
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                    {course.description}
                  </p>
                )}

                {/* Progress / Status Area */}
                <div className="mt-4 pt-3 border-t border-[var(--border-hairline)]">
                  {/* State 1: Continue or Completed with progress */}
                  {(cardState === 'continue' || cardState === 'start') && course.can_access && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)] font-medium">
                          {course.lessons_completed} of {course.total_lessons} lessons completed
                        </span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          {course.progress_pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden border border-[var(--border-hairline)]">
                        <div
                          className="h-full rounded-full bg-purple-600 dark:bg-purple-500 transition-all duration-300"
                          style={{ width: `${course.progress_pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {cardState === 'completed' && (
                    <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20 font-medium">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} strokeWidth={2} />
                        All {course.total_lessons} lessons finished
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Done</span>
                    </div>
                  )}

                  {/* State: Access Ended */}
                  {cardState === 'access_ended' && (
                    <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-1 text-xs">
                      <p className="font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                        <Lock size={12} className="text-stone-500" />
                        <span>Access ended on {formatExpiryDate(course.access_expiry_date)}</span>
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                        Your completion record is safely preserved ({course.lessons_completed} of {course.total_lessons} lessons). Contact church admin to extend access.
                      </p>
                    </div>
                  )}

                  {/* State: Awaiting Approval */}
                  {cardState === 'awaiting_approval' && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                      <Clock size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>Request submitted. Awaiting pastoral approval.</span>
                    </div>
                  )}

                  {/* State: Rejected */}
                  {cardState === 'rejected' && (
                    <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[var(--text-muted)] text-xs flex items-center gap-2">
                      <Lock size={14} className="shrink-0" />
                      <span>Enrollment closed for this cycle.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3">
                {/* 1. Start or Continue */}
                {course.can_access && cardState === 'start' && (
                  <Link
                    href={`/courses/${course.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition shadow-2xs cursor-pointer active:scale-[0.99]"
                  >
                    <Play size={13} fill="currentColor" />
                    <span>Start Course</span>
                  </Link>
                )}

                {course.can_access && cardState === 'continue' && (
                  <Link
                    href={`/courses/${course.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition shadow-2xs cursor-pointer active:scale-[0.99]"
                  >
                    <span>Continue Course</span>
                    <ArrowRight size={13} strokeWidth={2.2} />
                  </Link>
                )}

                {/* 2. Completed: Review Course */}
                {course.can_access && cardState === 'completed' && (
                  <Link
                    href={`/courses/${course.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-hairline)] text-[var(--text-ink)] font-semibold text-xs border border-[var(--border-subtle)] transition cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Review Lessons</span>
                  </Link>
                )}

                {/* 3. Request to join (approval mode) */}
                {cardState === 'request_join' && (
                  <button
                    type="button"
                    disabled={requestingId === course.id}
                    onClick={() => handleRequestEnrollment(course.id)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-2xs cursor-pointer active:scale-[0.99] disabled:opacity-50"
                  >
                    {requestingId === course.id ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={13} strokeWidth={2} />
                        <span>Request to Join Course</span>
                      </>
                    )}
                  </button>
                )}

                {/* 4. Access ended or rejected */}
                {(cardState === 'access_ended' || cardState === 'rejected') && (
                  <button
                    type="button"
                    disabled
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)] text-xs font-semibold border border-[var(--border-hairline)] opacity-70 cursor-not-allowed"
                  >
                    <Lock size={12} />
                    <span>Access Closed</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
