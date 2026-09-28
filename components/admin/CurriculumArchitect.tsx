'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import {
  BookOpen,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  Users,
  Video,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { saveChallengeDay, getChallengeDay } from '@/lib/actions/admin'
import type { ChallengeDayWithActivities, DayCompletionCount } from '@/lib/types'

interface ActivityItem {
  id?: string
  challenge_day_id?: string
  description: string
  sort_order: number
  video_url?: string | null
}

interface DayData {
  id?: string
  day_number: number
  title: string
  description: string
  scripture_reference: string
  activities: ActivityItem[]
}

interface CurriculumArchitectProps {
  days: ChallengeDayWithActivities[]
  completionCounts: DayCompletionCount[]
  startDate: string | null
  durationDays?: number
  challengeName?: string
}

function isValidUrl(val: string): boolean {
  if (!val || !val.trim()) return true
  try {
    const u = new URL(val.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function getDefaultDayData(dayNum: number, durationDays: number, challengeName: string): DayData {
  return {
    day_number: dayNum,
    title: `Day ${dayNum}: Consecration & Spiritual Discipline`,
    description: `Daily devotional focus and prayer alignment for Day ${dayNum} of the ${durationDays} Days of ${challengeName} Challenge.`,
    scripture_reference: 'Galatians 5:16-25 & Romans 8:1-14',
    activities: [
      { description: 'Morning Prayer Watch (30 mins personal devotion)', sort_order: 1, video_url: '' },
      { description: 'Scripture Meditation & Journaling', sort_order: 2, video_url: '' },
      { description: 'Midday Fasting & Fellowship Consecration', sort_order: 3, video_url: '' },
    ],
  }
}

export default function CurriculumArchitect({
  days: initialDays,
  completionCounts,
  startDate,
  durationDays = 40,
  challengeName = 'Overcomer',
}: CurriculumArchitectProps) {
  // ── 1. Local Cache of all Days ─────────────────────────────
  // Initialized from server-passed days; updated immediately on edit and on save.
  const [daysCache, setDaysCache] = useState<Map<number, DayData>>(() => {
    const map = new Map<number, DayData>()
    initialDays.forEach((d) => {
      map.set(d.day_number, {
        id: d.id,
        day_number: d.day_number,
        title: d.title,
        description: d.description ?? '',
        scripture_reference: d.scripture_reference ?? 'Galatians 5:16-25 & Romans 8:1-14',
        activities: (d.activities ?? []).map((a) => ({
          id: a.id,
          challenge_day_id: a.challenge_day_id,
          description: a.description,
          sort_order: a.sort_order,
          video_url: a.video_url ?? '',
        })),
      })
    })
    return map
  })

  // Completion counts map
  const countMap = new Map<number, number>()
  completionCounts.forEach((c) => countMap.set(c.day_number, c.completion_count))

  // ── 2. Editor State ────────────────────────────────────────
  const [selectedDayNum, setSelectedDayNum] = useState<number>(1)
  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved')
  const [isDirty, setIsDirty] = useState<boolean>(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Initial load for Day 1
  const initialDay1 = daysCache.get(1) ?? getDefaultDayData(1, durationDays, challengeName)
  const [title, setTitle] = useState(initialDay1.title)
  const [scripture, setScripture] = useState(initialDay1.scripture_reference)
  const [description, setDescription] = useState(initialDay1.description)
  const [activities, setActivities] = useState<ActivityItem[]>(initialDay1.activities)

  // Use refs to avoid stale closures in event handlers and auto-save
  const currentSnapshotRef = useRef<DayData>({
    day_number: 1,
    title: initialDay1.title,
    scripture_reference: initialDay1.scripture_reference,
    description: initialDay1.description,
    activities: initialDay1.activities,
  })

  // Keep snapshot ref updated
  useEffect(() => {
    currentSnapshotRef.current = {
      day_number: selectedDayNum,
      title,
      scripture_reference: scripture,
      description,
      activities,
    }
  }, [selectedDayNum, title, scripture, description, activities])

  // Mark dirty and update local cache whenever user edits
  const notifyChange = useCallback((updated: Partial<DayData>) => {
    setIsDirty(true)
    setSaveStatus('unsaved')
    setFeedback(null)

    setDaysCache((prev) => {
      const nextMap = new Map(prev)
      const existing = nextMap.get(selectedDayNum) ?? getDefaultDayData(selectedDayNum, durationDays, challengeName)
      nextMap.set(selectedDayNum, {
        ...existing,
        ...updated,
      })
      return nextMap
    })
  }, [selectedDayNum, durationDays, challengeName])

  // ── 3. Core Save Routine (Stale-Closure Proof) ──────────────
  const executeSave = useCallback(
    async (dayNum: number, snapshot: DayData): Promise<boolean> => {
      // Validate URLs first
      for (let i = 0; i < snapshot.activities.length; i++) {
        const vUrl = snapshot.activities[i].video_url
        if (vUrl && vUrl.trim() && !isValidUrl(vUrl)) {
          setFeedback({
            type: 'error',
            text: `Activity #${i + 1} has an invalid video link "${vUrl}". Must start with http:// or https://`,
          })
          setSaveStatus('error')
          return false
        }
      }

      setSaveStatus('saving')

      try {
        const result = await saveChallengeDay({
          dayNumber: dayNum,
          title: snapshot.title,
          description: snapshot.description,
          scriptureReference: snapshot.scripture_reference,
          activities: snapshot.activities,
        })

        if (!result.success) {
          setSaveStatus('error')
          setFeedback({
            type: 'error',
            text: result.error || `Failed to save Day ${dayNum}`,
          })
          return false
        }

        if (result && result.day) {
          const savedDay: DayData = {
            id: result.day.id,
            day_number: result.day.day_number,
            title: result.day.title,
            description: result.day.description ?? '',
            scripture_reference: result.day.scripture_reference ?? '',
            activities: result.day.activities.map((a) => ({
              id: a.id,
              challenge_day_id: a.challenge_day_id,
              description: a.description,
              sort_order: a.sort_order,
              video_url: a.video_url ?? '',
            })),
          }

          // Update cache with fresh DB IDs
          setDaysCache((prev) => {
            const nextMap = new Map(prev)
            nextMap.set(dayNum, savedDay)
            return nextMap
          })

          // If the user is still on this day, update activities state with DB IDs
          // so next save performs an UPDATE instead of an INSERT (no duplicates)
          if (currentSnapshotRef.current.day_number === dayNum) {
            setActivities(savedDay.activities)
            setIsDirty(false)
            setSaveStatus('saved')
          }
        }

        return true
      } catch (err) {
        console.error(`Failed to save Day ${dayNum}:`, err)
        setSaveStatus('error')
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : `Failed to save Day ${dayNum}`,
        })
        return false
      }
    },
    []
  )

  // ── 4. Day Switching (Auto-save on switch + Fetch ground truth) ─
  const handleSelectDay = useCallback(
    async (targetDayNum: number) => {
      if (targetDayNum === selectedDayNum) return

      // Step A: If current day has unsaved changes, auto-save its snapshot synchronously
      if (isDirty) {
        const snapshotToFlush = { ...currentSnapshotRef.current }
        // Fire and don't block the switch transition, but ensure it completes
        executeSave(selectedDayNum, snapshotToFlush)
      }

      // Step B: Switch to target day immediately from cache (no blank/reset flicker)
      setSelectedDayNum(targetDayNum)
      setFeedback(null)
      setIsDirty(false)
      setSaveStatus('saved')

      const cached = daysCache.get(targetDayNum)
      if (cached) {
        setTitle(cached.title)
        setScripture(cached.scripture_reference)
        setDescription(cached.description)
        setActivities(cached.activities)
      } else {
        const fallback = getDefaultDayData(targetDayNum, durationDays, challengeName)
        setTitle(fallback.title)
        setScripture(fallback.scripture_reference)
        setDescription(fallback.description)
        setActivities(fallback.activities)
      }

      // Step C: Fetch fresh ground truth from DB in background to ensure video links & latest DB updates
      try {
        const dbDay = await getChallengeDay(targetDayNum)
        if (dbDay) {
          const freshData: DayData = {
            id: dbDay.id,
            day_number: dbDay.day_number,
            title: dbDay.title,
            description: dbDay.description ?? '',
            scripture_reference: dbDay.scripture_reference ?? '',
            activities: (dbDay.activities ?? []).map((a) => ({
              id: a.id,
              challenge_day_id: a.challenge_day_id,
              description: a.description,
              sort_order: a.sort_order,
              video_url: a.video_url ?? '',
            })),
          }

          // Update cache
          setDaysCache((prev) => {
            const next = new Map(prev)
            next.set(targetDayNum, freshData)
            return next
          })

          // If user hasn't started typing on target day yet, sync with fresh DB data
          if (currentSnapshotRef.current.day_number === targetDayNum && !isDirty) {
            setTitle(freshData.title)
            setScripture(freshData.scripture_reference)
            setDescription(freshData.description)
            setActivities(freshData.activities)
          }
        }
      } catch (fetchErr) {
        console.warn(`Could not re-fetch Day ${targetDayNum} from DB:`, fetchErr)
      }
    },
    [selectedDayNum, isDirty, daysCache, durationDays, challengeName, executeSave]
  )

  // ── 5. Field Update Handlers ───────────────────────────────
  function handleTitleChange(newTitle: string) {
    setTitle(newTitle)
    notifyChange({ title: newTitle })
  }

  function handleScriptureChange(newScripture: string) {
    setScripture(newScripture)
    notifyChange({ scripture_reference: newScripture })
  }

  function handleDescriptionChange(newDesc: string) {
    setDescription(newDesc)
    notifyChange({ description: newDesc })
  }

  function handleAddActivity() {
    const updated = [
      ...activities,
      {
        description: 'New devotional activity prompt',
        sort_order: activities.length + 1,
        video_url: '',
      },
    ]
    setActivities(updated)
    notifyChange({ activities: updated })
  }

  function handleUpdateActivityDescription(idx: number, newDesc: string) {
    const updated = [...activities]
    updated[idx] = { ...updated[idx], description: newDesc }
    setActivities(updated)
    notifyChange({ activities: updated })
  }

  function handleUpdateActivityVideoUrl(idx: number, newUrl: string) {
    const updated = [...activities]
    updated[idx] = { ...updated[idx], video_url: newUrl }
    setActivities(updated)
    notifyChange({ activities: updated })
  }

  function handleDeleteActivity(idx: number) {
    const updated = activities
      .filter((_, i) => i !== idx)
      .map((a, i) => ({ ...a, sort_order: i + 1 }))
    setActivities(updated)
    notifyChange({ activities: updated })
  }

  function handleMoveActivity(idx: number, direction: 'up' | 'down') {
    if (
      (direction === 'up' && idx === 0) ||
      (direction === 'down' && idx === activities.length - 1)
    ) {
      return
    }
    const updated = [...activities]
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    const temp = updated[idx]
    updated[idx] = updated[targetIdx]
    updated[targetIdx] = temp
    const reordered = updated.map((a, i) => ({ ...a, sort_order: i + 1 }))
    setActivities(reordered)
    notifyChange({ activities: reordered })
  }

  // ── 6. Manual Save & Publish Button ────────────────────────
  function handleManualPublish(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)

    startTransition(async () => {
      const currentSnapshot = {
        day_number: selectedDayNum,
        title,
        description,
        scripture_reference: scripture,
        activities,
      }
      const ok = await executeSave(selectedDayNum, currentSnapshot)
      if (ok) {
        setFeedback({
          type: 'success',
          text: `Day ${selectedDayNum} content published successfully!`,
        })
      }
    })
  }

  // Target date calculation
  const targetDateStr = (() => {
    if (!startDate) return null
    const d = new Date(startDate)
    d.setDate(d.getDate() + (selectedDayNum - 1))
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  })()

  // Calculate published count from cache
  const publishedCount = Array.from({ length: durationDays }, (_, i) => i + 1).filter(
    (n) => daysCache.has(n) && (daysCache.get(n)?.activities?.length ?? 0) > 0
  ).length

  return (
    <section className="bg-[var(--bg-surface)] rounded-xl p-5 shadow-xs border border-[var(--border-hairline)] mt-6 transition-colors">
      {/* Title & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-hairline)] gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[var(--flame-accent)]">
            <BookOpen size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-ink)]">
              {durationDays}-Day Curriculum Matrix &amp; Content Architect
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Select any day node to inspect details or preview publishing readiness for {durationDays} Days of {challengeName}.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium flex-wrap">
          <span className="flex items-center gap-1.5 text-[var(--olive-accent)]">
            <span className="w-2 h-2 rounded-full bg-[var(--olive-accent)] inline-block" />
            Published ({publishedCount})
          </span>
          <span className="flex items-center gap-1.5 text-[var(--flame-accent)]">
            <span className="w-2 h-2 rounded-full bg-[var(--flame-accent)] inline-block" />
            Selected (Day {selectedDayNum})
          </span>
          <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-full border border-dashed border-[var(--text-muted)] inline-block" />
            Needs Content ({Math.max(0, durationDays - publishedCount)})
          </span>
        </div>
      </div>

      {/* Main Grid: Roadmap on left, Editor on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* ── Left / Top: Roadmap Matrix (5 cols) ── */}
        <div className="lg:col-span-5 bg-[var(--bg-subtle)] rounded-xl p-4 border border-[var(--border-hairline)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-[var(--text-ink)] uppercase tracking-wider">
              Roadmap (Days 1 — {durationDays})
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">Auto-saves on day switch</span>
          </div>

          {/* Grid nodes */}
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
            {Array.from({ length: durationDays }, (_, i) => i + 1).map((num) => {
              const day = daysCache.get(num)
              const hasContent = day && (day.activities?.length ?? 0) > 0
              const isSelected = num === selectedDayNum
              const compCount = countMap.get(num) ?? 0

              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleSelectDay(num)}
                  className={`
                    relative flex flex-col items-center justify-center p-1.5 rounded-lg text-center transition cursor-pointer
                    ${
                      isSelected
                        ? 'bg-[var(--flame-accent)] text-white shadow-xs font-bold scale-105 z-10'
                        : hasContent
                        ? 'bg-[var(--bg-surface)] border border-[var(--olive-accent)]/50 text-[var(--text-ink)] hover:border-[var(--flame-accent)]'
                        : 'bg-[var(--bg-surface)]/50 border border-dashed border-[var(--border-hairline)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                    }
                  `}
                >
                  <span className="text-xs font-semibold leading-none">{num}</span>
                  <span
                    className={`text-[8px] font-medium mt-1 leading-none ${
                      isSelected
                        ? 'text-white/90'
                        : hasContent
                        ? 'text-[var(--olive-accent)]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {hasContent ? 'Ready' : 'Empty'}
                  </span>
                  {compCount > 0 && (
                    <span
                      title={`${compCount} members completed`}
                      className={`text-[7px] font-medium mt-0.5 px-1 rounded flex items-center gap-0.5 ${
                        isSelected
                          ? 'bg-black/20 text-white'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                      }`}
                    >
                      <Users size={8} />
                      {compCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>{publishedCount} Published</span>
            <span>{Math.max(0, durationDays - publishedCount)} drafts needed</span>
          </div>
        </div>

        {/* ── Right / Bottom: Selected Day Content Editor (7 cols) ── */}
        <div className="lg:col-span-7 bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border-hairline)] shadow-xs transition-colors">
          <form onSubmit={handleManualPublish} className="space-y-3.5">
            {/* Day Header with Status Indicators */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[var(--border-hairline)] gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--flame-accent)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded border border-[var(--border-hairline)]">
                    Day {selectedDayNum}
                  </span>

                  {/* ── Prominent Save Status Indicator ── */}
                  {saveStatus === 'saving' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <Loader2 size={11} className="animate-spin" />
                      <span>Saving changes...</span>
                    </span>
                  )}
                  {saveStatus === 'unsaved' && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>Unsaved changes (auto-saves on day switch)</span>
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--olive-accent)] bg-[var(--olive-accent)]/10 px-2 py-0.5 rounded-full border border-[var(--olive-accent)]/20">
                      <CheckCircle2 size={11} />
                      <span>Saved</span>
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                      <AlertCircle size={11} />
                      <span>Save error</span>
                    </span>
                  )}

                  {targetDateStr && (
                    <span className="text-xs text-[var(--text-muted)]">
                      · {targetDateStr}
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-semibold text-[var(--text-ink)] mt-1">
                  Day {selectedDayNum}: Edit Devotional, Video Links &amp; Activities
                </h3>
              </div>

              {countMap.get(selectedDayNum) !== undefined && (
                <div className="text-right">
                  <span className="text-xs font-medium text-[var(--olive-accent)] bg-[var(--bg-subtle)] border border-[var(--border-hairline)] px-2 py-0.5 rounded-full">
                    {countMap.get(selectedDayNum)} Completed
                  </span>
                </div>
              )}
            </div>

            {/* Day Title */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Day Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Day 14: Walking in the Spirit — Consecrated Morning Prayer"
                className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition shadow-xs placeholder:text-[var(--text-muted)]"
              />
            </div>

            {/* Scripture Reference */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Scripture Reference
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={scripture}
                  onChange={(e) => handleScriptureChange(e.target.value)}
                  placeholder="e.g. Galatians 5:16-25 & Romans 8:1-14"
                  className="w-full px-3 py-1.5 pr-8 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition shadow-xs placeholder:text-[var(--text-muted)]"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <BookOpen size={13} strokeWidth={1.75} />
                </span>
              </div>
            </div>

            {/* Devotional Exhortation */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-ink)] mb-1">
                Daily Devotional Summary &amp; Exhortation
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="Beloved BBCC family, today our focus deepens into true yieldedness..."
                className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] resize-none transition shadow-xs placeholder:text-[var(--text-muted)]"
              />
            </div>

            {/* Daily Required Activities Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-medium text-[var(--text-ink)]">
                  Required Activities ({activities.length})
                </label>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Includes optional video links · Reorder or customize
                </span>
              </div>

              <div className="space-y-2">
                {activities.map((act, idx) => {
                  const hasInvalidUrl = Boolean(act.video_url && !isValidUrl(act.video_url))
                  return (
                    <div
                      key={act.id ?? idx}
                      className="bg-[var(--bg-subtle)] p-2.5 rounded-lg border border-[var(--border-hairline)] space-y-2 transition-colors"
                    >
                      {/* Row 1: Reorder Buttons, Number, Description, Delete */}
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => handleMoveActivity(idx, 'up')}
                            disabled={idx === 0}
                            aria-label="Move activity up"
                            className="text-[var(--text-muted)] hover:text-[var(--text-ink)] disabled:opacity-20 cursor-pointer"
                          >
                            <ChevronUp size={11} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveActivity(idx, 'down')}
                            disabled={idx === activities.length - 1}
                            aria-label="Move activity down"
                            className="text-[var(--text-muted)] hover:text-[var(--text-ink)] disabled:opacity-20 cursor-pointer"
                          >
                            <ChevronDown size={11} strokeWidth={2} />
                          </button>
                        </div>

                        <span className="w-5 h-5 rounded-full bg-[var(--olive-accent)] text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>

                        <input
                          type="text"
                          required
                          placeholder="Activity description (e.g. Morning Prayer Watch)"
                          value={act.description}
                          onChange={(e) => handleUpdateActivityDescription(idx, e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] shadow-xs"
                        />

                        <button
                          type="button"
                          onClick={() => handleDeleteActivity(idx)}
                          title="Remove activity"
                          className="w-6 h-6 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition cursor-pointer shrink-0"
                        >
                          <Trash2 size={12} strokeWidth={1.75} />
                        </button>
                      </div>

                      {/* Row 2: Optional Video Link input with inline validation & test link */}
                      <div className="pl-7">
                        <div className="flex items-center gap-1.5">
                          <div className="relative flex-1">
                            <input
                              type="url"
                              placeholder="Optional video link (e.g. https://youtu.be/...)"
                              value={act.video_url ?? ''}
                              onChange={(e) => handleUpdateActivityVideoUrl(idx, e.target.value)}
                              className={`w-full px-2.5 py-1 pl-7 text-[11px] font-medium bg-[var(--bg-surface)] text-[var(--text-ink)] border rounded-md focus:outline-none focus:ring-1 shadow-xs transition ${
                                hasInvalidUrl
                                   ? 'border-red-500 focus:ring-red-500'
                                  : 'border-[var(--border-hairline)] focus:ring-[var(--flame-accent)]'
                              }`}
                            />
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                              <Video size={11} strokeWidth={1.75} />
                            </span>
                          </div>
                          {act.video_url && isValidUrl(act.video_url) && (
                            <a
                              href={act.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-[var(--flame-accent)] hover:underline flex items-center gap-1 shrink-0 px-2 py-1 rounded bg-[var(--flame-subtle)] border border-[var(--flame-accent)]/20"
                            >
                              <span>Test Link</span>
                              <ExternalLink size={10} strokeWidth={1.75} />
                            </a>
                          )}
                        </div>
                        {hasInvalidUrl && (
                          <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                            <span>⚠ Invalid URL. Please enter a valid web link starting with http:// or https://</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={handleAddActivity}
                className="mt-2 w-full py-1.5 border border-dashed border-[var(--border-hairline)] hover:border-[var(--flame-accent)] text-[var(--text-muted)] hover:text-[var(--flame-accent)] font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus size={12} strokeWidth={1.75} />
                <span>Add Activity Prompt</span>
              </button>
            </div>

            {feedback && (
              <div
                className={`text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-green-500/10 text-[var(--olive-accent)] border border-green-500/25'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25'
                }`}
              >
                {feedback.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                <span>{feedback.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || saveStatus === 'saving'}
              className="w-full py-2.5 bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {isPending || saveStatus === 'saving' ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Publishing Day {selectedDayNum}…</span>
                </>
              ) : (
                <>
                  <Check size={13} strokeWidth={2} />
                  <span>Save &amp; Publish Day {selectedDayNum}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
