'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BookOpen, Check, Loader2, Lock, ShieldAlert } from 'lucide-react'
import { saveJournalEntry, getJournalEntry } from '@/lib/actions/journal'

interface JournalNoteBoxProps {
  dayId: string
  dayNumber: number
  currentDay: number
  initialContent?: string
  isPastoralPreview?: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function JournalNoteBox({
  dayId,
  dayNumber,
  currentDay,
  initialContent = '',
  isPastoralPreview = false,
}: JournalNoteBoxProps) {
  const [content, setContent] = useState<string>(initialContent)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Future day locked check: if currentDay is set and dayNumber > currentDay
  const isFutureDay = currentDay > 0 && dayNumber > currentDay

  // Keep track of the active day and latest content via refs to prevent stale closures
  const activeDayIdRef = useRef<string>(dayId)
  const contentRef = useRef<string>(content)
  const lastSavedContentRef = useRef<string>(initialContent)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef<boolean>(false)

  // Keep contentRef in sync
  contentRef.current = content

  // ── Core Save Executor ─────────────────────────────────────
  const executeSave = useCallback(async (targetDayId: string, textToSave: string) => {
    if (!targetDayId || isPastoralPreview || isFutureDay) return
    if (textToSave === lastSavedContentRef.current) {
      setSaveStatus('saved')
      return
    }

    try {
      isSavingRef.current = true
      setSaveStatus('saving')
      setErrorMessage(null)

      const result = await saveJournalEntry(targetDayId, textToSave)

      if (result.success) {
        lastSavedContentRef.current = textToSave
        setSaveStatus('saved')
      } else {
        setSaveStatus('error')
        setErrorMessage(result.error || 'Failed to save note')
      }
    } catch (err) {
      console.error('[JournalNoteBox] Save error:', err)
      setSaveStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      isSavingRef.current = false
    }
  }, [isPastoralPreview, isFutureDay])

  // ── Flush Pending Save ─────────────────────────────────────
  const flushPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    const currentTargetDayId = activeDayIdRef.current
    const currentText = contentRef.current
    if (currentTargetDayId && currentText !== lastSavedContentRef.current) {
      executeSave(currentTargetDayId, currentText)
    }
  }, [executeSave])

  // ── Handle Day Switching & Initial Mount ───────────────────
  useEffect(() => {
    // If day changed, flush any unsaved edits on the PREVIOUS day first
    if (activeDayIdRef.current !== dayId) {
      flushPendingSave()
      activeDayIdRef.current = dayId
    }

    // Set initial content or fetch note for the new day
    let isCancelled = false
    setContent(initialContent)
    contentRef.current = initialContent
    lastSavedContentRef.current = initialContent
    setSaveStatus(initialContent ? 'saved' : 'idle')
    setErrorMessage(null)

    // Load from database to ensure fresh content
    if (!isPastoralPreview && dayId) {
      getJournalEntry(dayId).then((res) => {
        if (!isCancelled && res.success && res.entry) {
          const fetchedContent = res.entry.content || ''
          setContent(fetchedContent)
          contentRef.current = fetchedContent
          lastSavedContentRef.current = fetchedContent
          setSaveStatus('saved')
        }
      })
    }

    return () => {
      isCancelled = true
    }
  }, [dayId, initialContent, isPastoralPreview, flushPendingSave])

  // ── Flush on Window Unload or Visibility Change ─────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingSave()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSave()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      flushPendingSave()
    }
  }, [flushPendingSave])

  // ── Handle Textarea Changes with Debounce ──────────────────
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setContent(newText)
    contentRef.current = newText
    setSaveStatus('saving')

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    const targetDayId = activeDayIdRef.current
    saveTimeoutRef.current = setTimeout(() => {
      executeSave(targetDayId, newText)
    }, 750)
  }

  // ── Handle Manual Blur (Immediate Flush) ───────────────────
  const handleBlur = () => {
    flushPendingSave()
  }

  // Pastoral Preview View: strictly private
  if (isPastoralPreview) {
    return (
      <div className="mt-4 p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-start gap-2.5 text-xs text-[var(--text-muted)]">
        <ShieldAlert size={16} strokeWidth={1.75} className="text-[var(--flame-accent)] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[var(--text-ink)] block mb-0.5">
            Pastoral Confidentiality Covenant
          </span>
          Member spiritual reflections and journal notes are strictly private between the believer and the Lord. They cannot be viewed in preview mode.
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4">
      {/* Header with Title and Saving Indicator */}
      <div className="flex items-center justify-between mb-1.5">
        <label
          htmlFor={`journal-note-${dayNumber}`}
          className="text-xs font-semibold text-[var(--text-ink)] flex items-center gap-1.5 cursor-pointer"
        >
          <BookOpen size={13} strokeWidth={1.75} className="text-[var(--flame-accent)]" />
          <span>Spiritual Reflections &amp; Journal Note</span>
          <span className="text-[10px] font-normal text-[var(--text-muted)]">
            (Day {dayNumber})
          </span>
        </label>

        {/* Live Saving Status Pill */}
        <div className="text-[11px] font-medium flex items-center gap-1">
          {saveStatus === 'saving' && (
            <span className="text-[var(--flame-accent)] flex items-center gap-1">
              <Loader2 size={11} strokeWidth={2} className="animate-spin" />
              <span>Saving…</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[var(--covenant-accent)] flex items-center gap-1 font-semibold">
              <Check size={11} strokeWidth={2.5} />
              <span>Saved</span>
            </span>
          )}
          {saveStatus === 'error' && (
            <span
              className="text-red-500 font-semibold cursor-pointer underline"
              title={errorMessage || 'Error saving'}
              onClick={flushPendingSave}
            >
              Retry Save
            </span>
          )}
        </div>
      </div>

      {/* Future Day Locked Notice */}
      {isFutureDay ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4 text-center">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-surface)] text-[var(--text-muted)] mb-2 border border-[var(--border-subtle)]">
            <Lock size={14} strokeWidth={1.75} />
          </div>
          <p className="text-xs font-semibold text-[var(--text-ink)]">
            Day {dayNumber} Journal Locked
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            This devotion journal will unlock when Day {dayNumber} begins. Past days remain open for reflection.
          </p>
        </div>
      ) : (
        <div className="relative">
          <textarea
            id={`journal-note-${dayNumber}`}
            value={content}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Record today's revelations, scripture insights, or prayers during devotion…"
            rows={4}
            className="bbcc-input resize-y min-h-[90px] leading-relaxed transition-all placeholder:text-[var(--text-faint)] focus:ring-2 focus:ring-[var(--flame-accent)]/20"
          />
          {dayNumber < currentDay && (
            <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
              <span>Past day reflection · Editable at any time</span>
              {content.length > 0 && <span>{content.length} characters</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
