'use client'

import Link from 'next/link'
import { Bell, ArrowRight } from 'lucide-react'
import type { HomeLatestAnnouncement } from '@/lib/actions/home'

interface HomeAnnouncementCardProps {
  announcement: HomeLatestAnnouncement | null
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'Recently'
  }
}

export default function HomeAnnouncementCard({
  announcement,
}: HomeAnnouncementCardProps) {
  if (!announcement) return null

  const timeAgo = formatRelativeTime(announcement.created_at)

  return (
    <section className="px-4 mt-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-[var(--flame-accent)]" />
          <h3 className="text-xs font-bold text-[var(--text-ink)] uppercase tracking-wider">
            Pastoral Announcement
          </h3>
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">{timeAgo}</span>
      </div>

      <Link
        href="/profile#announcements"
        className="block bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-4 shadow-2xs hover:border-[var(--flame-accent)]/30 transition-colors group"
      >
        <h4 className="text-sm font-bold text-[var(--text-ink)] font-serif group-hover:text-[var(--flame-accent)] transition-colors mb-1">
          {announcement.title}
        </h4>
        <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
          {announcement.body}
        </p>

        <div className="mt-3 flex items-center justify-end text-[11px] font-semibold text-[var(--flame-accent)] gap-1">
          <span>Read bulletin</span>
          <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    </section>
  )
}
