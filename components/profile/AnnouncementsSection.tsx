'use client'

import { useEffect, useRef } from 'react'
import { Megaphone, Calendar } from 'lucide-react'
import { markAnnouncementsAsSeen } from '@/lib/actions/announcements'
import type { AnnouncementWithAuthor } from '@/lib/types'

interface AnnouncementsSectionProps {
  announcements: AnnouncementWithAuthor[]
  lastSeenAt?: string | null
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function AnnouncementsSection({
  announcements,
  lastSeenAt,
}: AnnouncementsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)

  // Auto-clear unread badge when user visits the profile page
  useEffect(() => {
    const hasUnread = announcements.some(
      (a) => !lastSeenAt || new Date(a.created_at) > new Date(lastSeenAt)
    )

    if (hasUnread) {
      markAnnouncementsAsSeen().catch((err) => {
        console.error('Failed to mark announcements seen on mount:', err)
      })
    }

    // If navigated via #announcements hash, smooth scroll into view
    if (window.location.hash === '#announcements') {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }, [announcements, lastSeenAt])

  return (
    <section ref={sectionRef} id="announcements" className="px-4 mt-4 scroll-mt-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--flame-accent)]">
            <Megaphone size={15} strokeWidth={1.75} />
          </span>
          <h3 className="text-xs font-semibold text-[var(--text-ink)] uppercase tracking-wider">
            Pastoral Announcements
          </h3>
        </div>
        {announcements.length > 0 && (
          <span className="text-[10px] font-medium text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-full border border-[var(--border-hairline)]">
            {announcements.length} {announcements.length === 1 ? 'Notice' : 'Notices'}
          </span>
        )}
      </div>

      {announcements.length === 0 ? (
        <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-dashed border-[var(--border-hairline)] text-center shadow-xs">
          <div className="w-9 h-9 mx-auto rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] flex items-center justify-center mb-2 border border-[var(--border-hairline)]">
            <Megaphone size={16} strokeWidth={1.75} />
          </div>
          <p className="text-xs font-semibold text-[var(--text-ink)]">
            No Announcements Yet
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-xs mx-auto leading-relaxed">
            Pastoral notices, challenge updates, and corporate fellowship messages will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {announcements.map((item) => {
            const isUnread = !lastSeenAt || new Date(item.created_at) > new Date(lastSeenAt)

            return (
              <div
                key={item.id}
                className={`bg-[var(--bg-surface)] rounded-xl p-4 border transition-colors shadow-xs ${
                  isUnread
                    ? 'border-[var(--flame-accent)]/50 ring-1 ring-[var(--flame-accent)]/20'
                    : 'border-[var(--border-hairline)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-semibold text-xs text-[var(--text-ink)] leading-snug">
                      {item.title}
                    </h4>
                    {isUnread && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--flame-accent)] bg-[var(--flame-accent)]/10 px-1.5 py-0.5 rounded">
                        New
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] shrink-0 flex items-center gap-1 font-medium">
                    <Calendar size={10} strokeWidth={1.5} />
                    {formatRelativeTime(item.created_at)}
                  </span>
                </div>

                <p className="text-xs text-[var(--text-muted)] mt-2 whitespace-pre-wrap leading-relaxed select-text font-normal">
                  {item.body}
                </p>

                {item.profiles?.full_name && (
                  <div className="mt-2.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                    <span className="font-medium text-[var(--text-ink)]">
                      {item.profiles.full_name}
                    </span>
                    <span className="text-[9px] text-[var(--flame-accent)] font-semibold uppercase tracking-wider">
                      Church Leadership
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
