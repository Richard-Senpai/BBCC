'use client'

import { useState } from 'react'
import { Megaphone, Send, Trash2, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { createAnnouncement, deleteAnnouncement } from '@/lib/actions/announcements'
import type { AnnouncementWithAuthor } from '@/lib/types'

interface AnnouncementManagerProps {
  initialAnnouncements: AnnouncementWithAuthor[]
}

export default function AnnouncementManager({
  initialAnnouncements,
}: AnnouncementManagerProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementWithAuthor[]>(initialAnnouncements)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim() || isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const res = await createAnnouncement(title, body)
      if (res.success && res.announcement) {
        setAnnouncements((prev) => [res.announcement as AnnouncementWithAuthor, ...prev])
        setTitle('')
        setBody('')
        setSuccessMsg('Announcement published successfully! Members have been notified.')
        setTimeout(() => setSuccessMsg(null), 4000)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to publish announcement.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to retract and delete this announcement?')) {
      return
    }

    setDeletingId(id)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      await deleteAnnouncement(id)
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
      setSuccessMsg('Announcement deleted.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete announcement.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section id="announcement-manager" className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-hairline)] shadow-xs overflow-hidden scroll-mt-6">
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-subtle)]/50 transition border-b border-[var(--border-hairline)]"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] text-[var(--flame-accent)] flex items-center justify-center border border-[var(--border-hairline)]">
            <Megaphone size={16} strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-ink)]">
              Church Announcements &amp; Broadcasts
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Notify members with pastoral updates, fasting instructions, or fellowship notices
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-md border border-[var(--border-hairline)]">
            {announcements.length} {announcements.length === 1 ? 'Notice' : 'Notices'}
          </span>
          <button type="button" className="text-[var(--text-muted)] p-1">
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 space-y-5">
          {/* Alerts */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form to Post Announcement */}
          <form onSubmit={handlePublish} className="space-y-3 bg-[var(--bg-subtle)]/60 p-3.5 rounded-xl border border-[var(--border-hairline)]">
            <h3 className="text-xs font-semibold text-[var(--text-ink)]">
              Draft New Announcement
            </h3>

            <div>
              <label htmlFor="announcement-title" className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Title
              </label>
              <input
                id="announcement-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Day 14 Corporate Night Watch Prayer"
                maxLength={120}
                required
                className="w-full rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3 py-2 text-xs text-[var(--text-ink)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition shadow-2xs"
              />
            </div>

            <div>
              <label htmlFor="announcement-body" className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Message Body
              </label>
              <textarea
                id="announcement-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your pastoral announcement, scripture, or schedule update..."
                rows={3}
                maxLength={2000}
                required
                className="w-full rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3 py-2 text-xs text-[var(--text-ink)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition shadow-2xs resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[var(--text-muted)]">
                {title.length}/120 title · {body.length}/2000 body
              </span>

              <button
                type="submit"
                disabled={!title.trim() || !body.trim() || isSubmitting}
                className="px-4 py-2 bg-[var(--flame-accent)] hover:opacity-95 disabled:opacity-50 text-white font-medium text-xs rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Publishing…</span>
                  </>
                ) : (
                  <>
                    <Send size={13} strokeWidth={1.75} />
                    <span>Publish &amp; Broadcast</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Past Announcements List */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-ink)] mb-2.5 uppercase tracking-wider">
              Published Notices ({announcements.length})
            </h3>

            {announcements.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic p-3 text-center bg-[var(--bg-subtle)]/40 rounded-lg border border-[var(--border-hairline)]">
                No announcements have been published yet.
              </p>
            ) : (
              <div className="space-y-2">
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-hairline)] flex items-start justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-xs text-[var(--text-ink)]">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {new Date(item.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1 whitespace-pre-wrap leading-relaxed">
                        {item.body}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      title="Retract / Delete Announcement"
                      className="text-red-500 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-500/10 transition cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {deletingId === item.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
