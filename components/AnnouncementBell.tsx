'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { markAnnouncementsAsSeen } from '@/lib/actions/announcements'

interface AnnouncementBellProps {
  unreadCount?: number
  className?: string
}

export default function AnnouncementBell({
  unreadCount = 0,
  className = '',
}: AnnouncementBellProps) {
  const router = useRouter()
  const [cleared, setCleared] = useState(false)

  const showBadge = unreadCount > 0 && !cleared

  async function handleClick() {
    if (showBadge) {
      setCleared(true)
      markAnnouncementsAsSeen().catch((err) => {
        console.error('Failed to mark announcements as seen:', err)
      })
    }

    router.push('/dashboard/profile#announcements')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={showBadge ? `${unreadCount} unread announcement${unreadCount === 1 ? '' : 's'}` : 'Pastoral Announcements'}
      aria-label="Announcements"
      className={`relative w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-ink)] transition shadow-2xs cursor-pointer ${className}`}
    >
      <Bell size={15} strokeWidth={1.75} />

      {showBadge && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--flame-accent)] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-surface)] leading-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
