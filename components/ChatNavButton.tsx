'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getChatUnreadStatus, markChatAsSeen } from '@/lib/actions/messages'

interface ChatNavButtonProps {
  className?: string
}

export default function ChatNavButton({ className = '' }: ChatNavButtonProps) {
  const pathname = usePathname()
  const [hasUnread, setHasUnread] = useState(false)
  const currentUserIdRef = useRef<string | null>(null)
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  const checkUnread = useCallback(async () => {
    if (pathnameRef.current.startsWith('/community')) {
      setHasUnread(false)
      return
    }

    try {
      const res = await getChatUnreadStatus()
      setHasUnread(res.unread)
    } catch (err) {
      console.error('[ChatNavButton] Failed to check unread chat status:', err)
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

  // 2. Realtime listener for live incoming messages
  useEffect(() => {
    const supabase = createClient()
    let isMounted = true

    async function initUserAndStatus() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!isMounted || !user) return

        currentUserIdRef.current = user.id

        if (!pathnameRef.current.startsWith('/community')) {
          const res = await getChatUnreadStatus()
          if (isMounted) {
            setHasUnread(res.unread)
          }
        }
      } catch (err) {
        console.error('[ChatNavButton] Failed to initialize user and unread state:', err)
      }
    }

    initUserAndStatus()

    const channel = supabase
      .channel('topbar_chat_unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as { id: string; user_id: string | null }

          // If currently inside community chat, don't show the dot
          if (pathnameRef.current.startsWith('/community')) {
            return
          }

          // If own message, don't trigger unread dot
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

  const handleClick = () => {
    if (hasUnread) {
      setHasUnread(false)
      markChatAsSeen().catch((err) => {
        console.error('[ChatNavButton] Failed to mark chat seen:', err)
      })
    }
  }

  return (
    <Link
      href="/community"
      onClick={handleClick}
      title={hasUnread ? 'Unread messages on Fellowship Wall' : 'Fellowship Wall'}
      aria-label="Community Chat"
      className={`relative w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-ink)] transition shadow-2xs cursor-pointer select-none ${className}`}
    >
      <MessageSquare size={15} strokeWidth={1.75} />

      {/* Unread chat indicator: small solid orange dot on the community chat icon */}
      {hasUnread && (
        <span
          data-testid="chat-unread-dot"
          aria-label="Unread chat messages"
          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--flame-accent)] ring-2 ring-[var(--bg-surface)]"
        />
      )}
    </Link>
  )
}
