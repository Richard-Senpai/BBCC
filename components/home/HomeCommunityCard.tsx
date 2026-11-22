'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { MessageSquare, ArrowRight, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getChatUnreadStatus } from '@/lib/actions/messages'

export default function HomeCommunityCard() {
  const [hasUnread, setHasUnread] = useState(false)
  const currentUserIdRef = useRef<string | null>(null)

  const checkUnread = useCallback(async () => {
    try {
      const res = await getChatUnreadStatus()
      setHasUnread(res.unread)
    } catch (err) {
      console.error('[HomeCommunityCard] Error checking unread:', err)
    }
  }, [])

  useEffect(() => {
    checkUnread()

    const supabase = createClient()
    let isMounted = true

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && isMounted) {
        currentUserIdRef.current = user.id
      }
    })

    const channel = supabase
      .channel('home_community_card_unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as { id: string; user_id: string | null }
          if (newMsg.user_id && newMsg.user_id === currentUserIdRef.current) return
          setHasUnread(true)
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [checkUnread])

  return (
    <section className="px-4 mt-5">
      <Link
        href="/community"
        className="block bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-4 shadow-2xs hover:border-[var(--flame-accent)]/30 transition-colors group relative overflow-hidden"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-[var(--flame-subtle)] border border-[var(--flame-accent)]/20 flex items-center justify-center text-[var(--flame-accent)] shrink-0">
              <MessageSquare size={18} strokeWidth={2} />
              {hasUnread && (
                <span
                  data-testid="home-chat-unread-dot"
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--flame-accent)] ring-2 ring-[var(--bg-surface)]"
                />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[var(--text-ink)] font-serif group-hover:text-[var(--flame-accent)] transition-colors">
                  Fellowship Wall
                </h4>
                {hasUnread && (
                  <span className="text-[10px] font-bold text-[var(--flame-accent)] bg-[var(--flame-subtle)] px-1.5 py-0.2 rounded-full">
                    New messages
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Pray in agreement and encourage brethren across Ile-Ife
              </p>
            </div>
          </div>

          <div className="shrink-0 p-2 rounded-xl text-[var(--text-muted)] group-hover:text-[var(--flame-accent)] group-hover:translate-x-0.5 transition">
            <ArrowRight size={16} />
          </div>
        </div>
      </Link>
    </section>
  )
}
