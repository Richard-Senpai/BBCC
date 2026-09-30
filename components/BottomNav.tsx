'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarCheck2,
  TrendingUp,
  MessageSquare,
  Trophy,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getChatUnreadStatus, markChatAsSeen } from '@/lib/actions/messages'

const tabs = [
  {
    label: 'Today',
    href: '/dashboard',
    Icon: CalendarCheck2,
  },
  {
    label: 'Progress',
    href: '/dashboard/progress',
    Icon: TrendingUp,
  },
  {
    label: 'Community',
    href: '/community',
    Icon: MessageSquare,
  },
  {
    label: 'Leaderboard',
    href: '/leaderboard',
    Icon: Trophy,
  },
  {
    label: 'Profile',
    href: '/dashboard/profile',
    Icon: User,
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [hasUnread, setHasUnread] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  const currentUserIdRef = useRef<string | null>(null)
  currentUserIdRef.current = currentUserId

  const checkUnread = useCallback(async () => {
    if (pathnameRef.current.startsWith('/community')) {
      setHasUnread(false)
      return
    }

    try {
      const res = await getChatUnreadStatus()
      setHasUnread(res.unread)
    } catch (err) {
      console.error('[BottomNav] Failed to check unread chat status:', err)
    }
  }, [])

  // 1. Re-evaluate unread state whenever navigating across pages
  useEffect(() => {
    if (pathname.startsWith('/community')) {
      setHasUnread(false)
    } else {
      checkUnread()
    }
  }, [pathname, checkUnread])

  // 2. Realtime listener for live incoming messages from other members
  useEffect(() => {
    const supabase = createClient()
    let isMounted = true

    async function initUserAndStatus() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!isMounted || !user) return

        setCurrentUserId(user.id)
        currentUserIdRef.current = user.id

        if (!pathnameRef.current.startsWith('/community')) {
          const res = await getChatUnreadStatus()
          if (isMounted) {
            setHasUnread(res.unread)
          }
        }
      } catch (err) {
        console.error('[BottomNav] Failed to initialize user and unread state:', err)
      }
    }

    initUserAndStatus()

    const channel = supabase
      .channel('bottom_nav_chat_unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as { id: string; user_id: string | null }

          // If currently inside the community chat, don't show the nav unread dot
          if (pathnameRef.current.startsWith('/community')) {
            return
          }

          // If current user is not yet known, verify against server state
          if (!currentUserIdRef.current) {
            checkUnread()
            return
          }

          // Exclude own messages: sending your own message never triggers the unread dot
          if (newMsg.user_id && newMsg.user_id === currentUserIdRef.current) {
            return
          }

          setHasUnread(true)
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [checkUnread])

  const handleTabClick = (tabHref: string) => {
    if (tabHref === '/community' && hasUnread) {
      setHasUnread(false)
      markChatAsSeen().catch((err) => {
        console.error('[BottomNav] Failed to mark chat as seen on click:', err)
      })
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] safe-area-pb transition-colors shadow-xs">
      <div className="max-w-md mx-auto flex items-center h-16 px-1">
        {tabs.map((tab) => {
          const active =
            tab.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(tab.href)

          const isCommunity = tab.href === '/community'
          const IconComponent = tab.Icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => handleTabClick(tab.href)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-colors relative ${
                active
                  ? 'text-[var(--flame-accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
              }`}
            >
              <div className="relative">
                <IconComponent
                  size={20}
                  strokeWidth={active ? 2.2 : 1.75}
                  className="transition-transform duration-150"
                />

                {/* Active tab bottom indicator dot */}
                {active && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--flame-accent)]" />
                )}

                {/* Unread chat indicator: small solid orange dot on the community chat icon */}
                {isCommunity && hasUnread && (
                  <span
                    data-testid="chat-unread-dot"
                    aria-label="Unread chat messages"
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--flame-accent)] ring-2 ring-[var(--bg-surface)]"
                  />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium tracking-tight ${
                  active ? 'font-semibold text-[var(--flame-accent)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
