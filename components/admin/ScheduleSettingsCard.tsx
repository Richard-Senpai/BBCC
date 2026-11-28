'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  Settings,
  Sparkles,
  Lock,
  AlertTriangle,
  Flame,
  BookOpen,
  Calendar,
  Globe,
  UserCheck,
  Eye,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import { updateChallenge, seedChallengeDays } from '@/lib/actions/admin'
import type { ChallengeWithStats, CourseAccessMode, EnrollmentMode } from '@/lib/types'

interface ScheduleSettingsCardProps {
  challenge: ChallengeWithStats | null
  allChallenges?: ChallengeWithStats[]
  hasChallengeDays?: boolean
  existingDaysCount?: number
}

function checkDateOverlap(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number
): boolean {
  const sA = new Date(startA + 'T00:00:00Z').getTime()
  const eA = sA + (durationA - 1) * 86400000
  const sB = new Date(startB + 'T00:00:00Z').getTime()
  const eB = sB + (durationB - 1) * 86400000

  return !(eA < sB || sA > eB)
}

export default function ScheduleSettingsCard({
  challenge,
  allChallenges = [],
  hasChallengeDays = false,
  existingDaysCount = 0,
}: ScheduleSettingsCardProps) {
  const isCourse = challenge?.type === 'course'

  // Daily Challenge State
  const [durationDays, setDurationDays] = useState<number>(challenge?.duration_days ?? 40)
  const [challengeName, setChallengeName] = useState<string>(challenge?.name ?? 'Overcomer')
  const [startDate, setStartDate] = useState(challenge?.start_date ?? '')
  const [timezone, setTimezone] = useState(challenge?.timezone ?? 'Africa/Lagos')
  const [enrollmentMode, setEnrollmentMode] = useState<EnrollmentMode>(challenge?.enrollment_mode ?? 'open')

  // Course State
  const [description, setDescription] = useState(challenge?.description ?? '')
  const [accessMode, setAccessMode] = useState<CourseAccessMode>(challenge?.access_mode ?? 'unlimited')
  const [accessEndDate, setAccessEndDate] = useState(challenge?.access_end_date ?? '')
  const [accessDays, setAccessDays] = useState<number>(challenge?.access_days ?? 30)
  const [isPublished, setIsPublished] = useState<boolean>(Boolean(challenge?.is_published))

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isSeeding, startSeedTransition] = useTransition()

  // Keep state in sync whenever selected challenge changes
  useEffect(() => {
    if (challenge) {
      setDurationDays(challenge.duration_days ?? 40)
      setChallengeName(challenge.name ?? 'Overcomer')
      setStartDate(challenge.start_date ?? '')
      setTimezone(challenge.timezone ?? 'Africa/Lagos')
      setEnrollmentMode(challenge.enrollment_mode ?? 'open')

      setDescription(challenge.description ?? '')
      setAccessMode(challenge.access_mode ?? 'unlimited')
      setAccessEndDate(challenge.access_end_date ?? '')
      setAccessDays(challenge.access_days ?? 30)
      setIsPublished(Boolean(challenge.is_published))
      setMsg(null)
    }
  }, [challenge?.id, challenge?.name, challenge?.start_date, challenge?.duration_days, challenge?.is_published])

  if (!challenge) {
    return (
      <section className="bg-[var(--bg-surface)] rounded-xl p-5 shadow-xs border border-[var(--border-hairline)]">
        <p className="text-xs text-[var(--text-muted)]">No challenge selected.</p>
      </section>
    )
  }

  const initialDuration = challenge.duration_days ?? 40
  const initialName = challenge.name ?? 'Overcomer'
  const initialStartDate = challenge.start_date ?? ''
  const isStarted = Boolean(challenge.start_date && new Date(challenge.start_date) <= new Date())

  // Save handler for Daily Challenge or Course
  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    if (!challenge) return

    if (!challengeName.trim()) {
      setMsg({ type: 'error', text: 'Challenge name cannot be empty.' })
      return
    }

    if (isCourse) {
      // Course validation
      if (accessMode === 'fixed_end' && !accessEndDate) {
        setMsg({ type: 'error', text: 'Please specify a valid fixed end date.' })
        return
      }
      if (accessMode === 'per_member_days' && (isNaN(accessDays) || accessDays < 1)) {
        setMsg({ type: 'error', text: 'Please specify valid access days (at least 1 day).' })
        return
      }

      startTransition(async () => {
        try {
          const res = await updateChallenge(challenge.id, {
            name: challengeName.trim(),
            description: description.trim() || undefined,
            accessMode,
            accessEndDate: accessMode === 'fixed_end' ? accessEndDate : undefined,
            accessDays: accessMode === 'per_member_days' ? accessDays : undefined,
            isPublished,
            enrollmentMode,
            timezone,
          })
          if (!res.success) {
            setMsg({ type: 'error', text: res.error || 'Update failed' })
            return
          }
          setMsg({ type: 'success', text: `Course "${challengeName.trim()}" settings saved successfully!` })
        } catch (err) {
          setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' })
        }
      })
      return
    }

    // Daily Challenge Date Overlap Check
    if (startDate && durationDays > 0) {
      const otherDaily = allChallenges.filter(
        (c) => c.id !== challenge.id && c.type === 'daily' && c.start_date && c.duration_days
      )
      for (const other of otherDaily) {
        const overlap = checkDateOverlap(startDate, durationDays, other.start_date!, other.duration_days!)
        if (overlap) {
          setMsg({
            type: 'error',
            text: `Date Conflict: This schedule overlaps with "${other.name}" (starts ${other.start_date} for ${other.duration_days} days). Daily challenges cannot overlap.`,
          })
          return
        }
      }
    }

    // Check if challenge is underway and critical temporal settings changed
    const hasActiveModifications =
      isStarted &&
      (startDate !== initialStartDate ||
        durationDays !== initialDuration ||
        challengeName.trim() !== initialName)

    if (hasActiveModifications) {
      const confirmed = window.confirm(
        `CRITICAL TEMPORAL WARNING:\n\n"${challenge.name}" is currently active! Modifying the duration (${initialDuration} -> ${durationDays} days), name, or start date will shift what day members are on today and adjust active streak calculations.\n\nDo you want to apply these changes?`
      )
      if (!confirmed) return
    }

    // Check if duration shortened below existing curriculum days
    if (existingDaysCount > 0 && durationDays < existingDaysCount) {
      const confirmed = window.confirm(
        `CURRICULUM WARNING:\n\nYou currently have ${existingDaysCount} challenge days created for this challenge. Shortening the duration to ${durationDays} days will hide days ${durationDays + 1} to ${existingDaysCount} from members.\n\nYour existing day content will NOT be deleted, but members will only be able to view and complete days 1 to ${durationDays}.\n\nProceed with shortening?`
      )
      if (!confirmed) return
    }

    startTransition(async () => {
      try {
        const res = await updateChallenge(challenge.id, {
          name: challengeName.trim(),
          durationDays,
          startDate: startDate || undefined,
          timezone,
          enrollmentMode,
        })
        if (!res.success) {
          setMsg({ type: 'error', text: res.error || 'Update failed' })
          return
        }
        setMsg({ type: 'success', text: `Challenge "${challengeName.trim()}" schedule updated successfully!` })
      } catch (err) {
        setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' })
      }
    })
  }

  function handleSeed() {
    if (!challenge) return
    if (
      !confirm(
        `This will populate days 1 to ${durationDays} with template titles and default activities for "${durationDays} Days of ${challengeName.trim()}". Proceed?`
      )
    ) {
      return
    }
    setMsg(null)
    startSeedTransition(async () => {
      try {
        const res = await seedChallengeDays(challenge.id)
        if (!res.success) {
          setMsg({ type: 'error', text: res.error || 'Initialization failed' })
          return
        }
        setMsg({ type: 'success', text: `All ${res.count ?? durationDays} days successfully initialized for ${challengeName}!` })
      } catch (err) {
        setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Initialization failed' })
      }
    })
  }

  const renderedPreview = isCourse
    ? `Course: ${challengeName.trim() || 'Untitled Course'}`
    : `${durationDays} Days of ${challengeName.trim() || 'Overcomer'}`

  return (
    <section className="bg-[var(--bg-surface)] rounded-xl p-5 shadow-xs border border-[var(--border-hairline)] transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--border-hairline)] gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[var(--flame-accent)]">
            <Settings size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-ink)] flex items-center gap-2">
              <span>{isCourse ? 'Course Configuration' : 'Challenge Configuration & Schedule'}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--flame-accent)] border border-[var(--border-hairline)]">
                {challenge.name}
              </span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {isCourse
                ? 'Manage curriculum title, description, enrollment approval, access windows, and visibility.'
                : 'Configure challenge theme, duration, calendar activation date, and fellowship clocks.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!isCourse && !hasChallengeDays && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={isSeeding}
              className="text-xs font-medium bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={12} strokeWidth={1.75} />
              <span>{isSeeding ? 'Initializing…' : `Initialize ${durationDays} Days`}</span>
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2.5 py-1 rounded-lg border border-[var(--border-hairline)]">
            <Lock size={12} strokeWidth={1.75} />
            <span>Pastoral Key Locked</span>
          </span>
        </div>
      </div>

      {/* Live Preview Badge */}
      <div className="mt-4 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded-xl p-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--flame-accent)] flex items-center gap-1">
            {isCourse ? <BookOpen size={12} /> : <Flame size={12} />}
            <span>Dynamic Branding Live Preview</span>
          </span>
          <p className="text-sm font-semibold text-[var(--text-ink)] mt-0.5 truncate">
            {renderedPreview}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {isCourse
              ? 'Members see this course in the Courses catalog and outline view.'
              : 'This title appears dynamically across member dashboards, login banners, and milestone matrices.'}
          </p>
        </div>
        <span className="text-xs font-medium text-[var(--flame-accent)] bg-[var(--bg-surface)] px-2.5 py-1 rounded-md border border-[var(--border-hairline)] shrink-0">
          Live Preview
        </span>
      </div>

      {/* Critical Temporal Modification Warning for Daily Challenges */}
      {!isCourse && isStarted && (
        <div className="mt-4 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3.5 flex items-start gap-2.5">
          <span className="text-[var(--flame-accent)] shrink-0 mt-0.5">
            <AlertTriangle size={15} strokeWidth={1.75} />
          </span>
          <div className="text-xs text-[var(--text-ink)] leading-relaxed">
            <p className="font-semibold text-[var(--flame-accent)]">Challenge Currently Active</p>
            <p className="mt-0.5 text-[var(--text-muted)]">
              Changing the duration, challenge name, or start date immediately shifts the synchronized day index
              for all participating members and recalculates active streaks.
            </p>
          </div>
        </div>
      )}

      {/* ── Form ────────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="mt-4 space-y-4">
        {isCourse ? (
          /* ── COURSE CONFIGURATION FIELDS ── */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Course Title */}
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                  Course Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={challengeName}
                  onChange={(e) => setChallengeName(e.target.value)}
                  placeholder="e.g. Foundations of Spiritual Warfare"
                  className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs"
                />
              </div>

              {/* Enrollment Mode */}
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                  Enrollment Access Mode
                </label>
                <select
                  value={enrollmentMode}
                  onChange={(e) => setEnrollmentMode(e.target.value as EnrollmentMode)}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs cursor-pointer"
                >
                  <option value="open">Open (Any approved member can start immediately)</option>
                  <option value="approval">Approval Required (Admin review before start)</option>
                </select>
              </div>
            </div>

            {/* Course Description */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Course Description / Curriculum Summary
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Overview of this curriculum, what members will learn, and requirements..."
                className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Access Mode */}
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                  Student Access Window
                </label>
                <select
                  value={accessMode}
                  onChange={(e) => setAccessMode(e.target.value as CourseAccessMode)}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs cursor-pointer"
                >
                  <option value="unlimited">Unlimited (No expiration)</option>
                  <option value="fixed_end">Fixed Calendar End Date</option>
                  <option value="per_member_days">Fixed Days Per Member (from start)</option>
                </select>
              </div>

              {/* Access End Date or Days */}
              {accessMode === 'fixed_end' && (
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                    Fixed Access End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={accessEndDate}
                    onChange={(e) => setAccessEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs"
                  />
                </div>
              )}

              {accessMode === 'per_member_days' && (
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                    Access Window (Days per Member) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    required
                    value={accessDays}
                    onChange={(e) => setAccessDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs"
                  />
                </div>
              )}

              {/* Timezone */}
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                  Assembly Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs cursor-pointer"
                >
                  <option value="Africa/Lagos">West Africa Time (WAT) - GMT+1</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="America/New_York">New York (EST/EDT)</option>
                </select>
              </div>
            </div>

            {/* Published Toggle */}
            <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded border-[var(--border-hairline)] text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-[var(--text-ink)] block">
                    Publish Course to Members
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] block">
                    When enabled, approved members can view, enroll in, and take lessons in this course.
                  </span>
                </div>
              </label>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                  isPublished
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
                }`}
              >
                {isPublished ? 'Published' : 'Draft / Unpublished'}
              </span>
            </div>
          </div>
        ) : (
          /* ── DAILY CHALLENGE CONFIGURATION FIELDS ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Duration Days */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Duration (Days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                required
                value={durationDays}
                onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs"
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">e.g. 21, 40, or 90 days</p>
            </div>

            {/* Challenge Name */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Challenge Theme Name
              </label>
              <input
                type="text"
                required
                value={challengeName}
                onChange={(e) => setChallengeName(e.target.value)}
                placeholder="e.g. Overcomer, Purpose"
                className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs"
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                Forms &quot;{durationDays} Days of {challengeName.trim() || '…'}&quot;
              </p>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs"
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Day 1 activation</p>
            </div>

            {/* Enrollment Mode */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Enrollment Mode
              </label>
              <select
                value={enrollmentMode}
                onChange={(e) => setEnrollmentMode(e.target.value as EnrollmentMode)}
                className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs cursor-pointer"
              >
                <option value="open">Open (Auto-enroll)</option>
                <option value="approval">Approval Required</option>
              </select>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Join permission</p>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs cursor-pointer"
              >
                <option value="Africa/Lagos">WAT (Ile-Ife)</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">London</option>
                <option value="America/New_York">New York</option>
              </select>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Master clock</p>
            </div>
          </div>
        )}

        {msg && (
          <div
            className={`text-xs px-3 py-2 rounded-lg font-medium ${
              msg.type === 'success'
                ? 'bg-green-500/10 text-[var(--olive-accent)] border border-green-500/25'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-[var(--text-muted)]">
            Targeting: <strong className="text-[var(--text-ink)] font-semibold">{challenge.name}</strong>
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-xs transition cursor-pointer"
          >
            {isPending ? 'Saving Changes…' : isCourse ? 'Save Course Settings' : 'Save Challenge Settings'}
          </button>
        </div>
      </form>
    </section>
  )
}
