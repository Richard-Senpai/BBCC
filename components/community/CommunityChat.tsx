'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { postMessage, deleteMessage } from '@/lib/actions/messages'
import UserAvatar from '@/components/UserAvatar'
import BBCCLogo from '@/components/BBCCLogo'
import ThemeToggle from '@/components/ThemeToggle'
import type { MessageWithSender, Profile } from '@/lib/types'

interface CommunityChatProps {
  initialMessages: MessageWithSender[]
  currentUserId: string
  isAdmin: boolean
  currentUserProfile: Profile | null
  currentDay: number
  durationDays?: number
  challengeName?: string
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()

    const timeStr = date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    if (isToday) return timeStr
    if (isYesterday) return `Yesterday ${timeStr}`
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${timeStr}`
  } catch {
    return ''
  }
}

export default function CommunityChat({
  initialMessages,
  currentUserId,
  isAdmin,
  currentUserProfile,
  currentDay,
  durationDays = 40,
  challengeName = 'Overcomer',
}: CommunityChatProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages)
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // Scroll to bottom on initial mount
  useEffect(() => {
    scrollToBottom('auto')
  }, [])

  // Subscribe to Supabase Realtime for live messages and deletions
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newRow = payload.new as {
            id: string
            user_id: string | null
            content: string
            created_at: string
          }

          // Check if already in state (e.g. from optimistic update)
          setMessages((prev) => {
            if (prev.some((m) => m.id === newRow.id)) {
              return prev
            }

            // If it belongs to current user, use known currentUserProfile
            if (newRow.user_id === currentUserId && currentUserProfile) {
              const ownMessage: MessageWithSender = {
                ...newRow,
                profiles: {
                  id: currentUserProfile.id,
                  full_name: currentUserProfile.full_name,
                  avatar_url: currentUserProfile.avatar_url,
                  fellowship_unit: currentUserProfile.fellowship_unit,
                  role: currentUserProfile.role,
                },
              }
              return [...prev, ownMessage]
            }

            // Otherwise, fetch sender profile asynchronously
            if (newRow.user_id) {
              supabase
                .from('profiles')
                .select('id, full_name, avatar_url, fellowship_unit, role')
                .eq('id', newRow.user_id)
                .single()
                .then(({ data: profileData }) => {
                  const incomingMsg: MessageWithSender = {
                    ...newRow,
                    profiles: profileData ?? null,
                  }
                  setMessages((currentList) => {
                    const idx = currentList.findIndex((m) => m.id === newRow.id)
                    if (idx >= 0) {
                      const updated = [...currentList]
                      updated[idx] = incomingMsg
                      return updated
                    }
                    return [...currentList, incomingMsg]
                  })
                  scrollToBottom()
                })
            }

            // Temporarily append without profile until query finishes
            const placeholderMsg: MessageWithSender = {
              ...newRow,
              profiles: null,
            }
            return [...prev, placeholderMsg]
          })

          setTimeout(() => scrollToBottom(), 50)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, currentUserProfile])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const content = text.trim()
    if (!content || isSubmitting) return

    if (content.length > 500) {
      setErrorMsg('Message exceeds 500 characters.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    // Temporary optimistic ID
    const optimisticId = `temp-${Date.now()}`
    const optimisticMessage: MessageWithSender = {
      id: optimisticId,
      user_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      profiles: currentUserProfile
        ? {
            id: currentUserProfile.id,
            full_name: currentUserProfile.full_name,
            avatar_url: currentUserProfile.avatar_url,
            fellowship_unit: currentUserProfile.fellowship_unit,
            role: currentUserProfile.role,
          }
        : null,
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setTimeout(() => scrollToBottom(), 20)

    try {
      const res = await postMessage(content)
      if (res.success && res.message) {
        // Replace optimistic entry with saved row
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? {
                  ...res.message,
                  profiles: optimisticMessage.profiles,
                }
              : m
          )
        )
      }
    } catch (err: unknown) {
      console.error('Failed to post message:', err)
      // Remove optimistic message and restore text
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setText(content)
      setErrorMsg(err instanceof Error ? err.message : 'Failed to post message.')
    } finally {
      setIsSubmitting(false)
      scrollToBottom()
    }
  }

  const handleDelete = async (messageId: string) => {
    if (!window.confirm('Delete this message from the fellowship wall?')) {
      return
    }

    setDeletingId(messageId)
    // Optimistic delete
    const previousMessages = [...messages]
    setMessages((prev) => prev.filter((m) => m.id !== messageId))

    try {
      await deleteMessage(messageId)
    } catch (err: unknown) {
      console.error('Failed to delete message:', err)
      setMessages(previousMessages)
      alert(err instanceof Error ? err.message : 'Failed to delete message.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    // Auto adjust height up to 120px
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  const charsLeft = 500 - text.length

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Top App Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#FAF6EC]/90 dark:bg-zinc-950/90 backdrop-blur-md px-4 pt-4 pb-3 border-b border-amber-200/50 dark:border-zinc-800 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BBCCLogo size="sm" />
            <div className="leading-tight">
              <h1 className="text-sm font-black text-gray-900 dark:text-zinc-100 flex items-center gap-1.5">
                Fellowship Wall
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
              </h1>
              <p className="text-[10px] text-gray-500 dark:text-zinc-400">
                Day {currentDay > 0 ? currentDay : 1} of {durationDays} · Corporate Encouragement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/50 hover:bg-amber-200/80 px-2.5 py-1 rounded-lg transition"
            >
              Today
            </Link>
          </div>
        </div>
      </header>

      {/* ── Fellowship Scripture / Welcome Prompt ─────────────── */}
      <div className="px-4 pt-3 pb-1">
        <div className="bg-white/80 dark:bg-zinc-900/80 rounded-xl p-2.5 border border-amber-200/60 dark:border-zinc-800 flex items-center justify-between text-xs text-gray-600 dark:text-zinc-300 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">🕊️</span>
            <span className="text-[11px] leading-tight">
              <strong className="text-amber-700 dark:text-amber-400">1 Thess. 5:11:</strong> &ldquo;Encourage one another and build each other up.&rdquo;
            </span>
          </div>
          <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 shrink-0 ml-2">
            {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
          </span>
        </div>
      </div>

      {/* ── Error Banner ───────────────────────────────────────── */}
      {errorMsg && (
        <div className="mx-4 mt-2 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-500 font-bold ml-2 text-sm leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Messages Feed (Scrollable) ────────────────────────── */}
      <div className="flex-1 px-4 py-3 space-y-3.5 pb-36">
        {messages.length === 0 ? (
          <div className="my-12 text-center py-10 px-6 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-amber-200 dark:border-zinc-800 shadow-xs">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl mb-3">
              💬
            </div>
            <h2 className="text-sm font-black text-gray-900 dark:text-zinc-100">
              Welcome to the Fellowship Wall!
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5 leading-relaxed max-w-xs mx-auto">
              No messages yet. Share a prayer request, testimony, or note of encouragement with the brethren as we journey through the {durationDays} days together.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.user_id === currentUserId
            const canDelete = isOwn || isAdmin
            const senderName = msg.profiles?.full_name || (msg.user_id ? 'Believer' : 'Deleted Believer')
            const senderUnit = msg.profiles?.fellowship_unit
            const senderRole = msg.profiles?.role
            const isSenderAdmin = senderRole === 'admin'

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isOwn ? 'justify-end' : 'justify-start'} group`}
              >
                {/* Avatar for other senders */}
                {!isOwn && (
                  <div className="mt-1 shrink-0">
                    <UserAvatar
                      avatarUrl={msg.profiles?.avatar_url}
                      name={senderName}
                      size="sm"
                    />
                  </div>
                )}

                {/* Message Bubble Container */}
                <div className={`flex flex-col max-w-[82%] ${isOwn ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name & Details Header */}
                  {!isOwn && (
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-xs font-bold text-gray-900 dark:text-zinc-100">
                        {senderName}
                      </span>
                      {isSenderAdmin && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.2 rounded">
                          Pastor / Admin
                        </span>
                      )}
                      {senderUnit && !isSenderAdmin && (
                        <span className="text-[10px] text-gray-400 dark:text-zinc-500 truncate max-w-[130px]">
                          · {senderUnit}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bubble Content */}
                  <div
                    className={`relative px-3.5 py-2.5 rounded-2xl text-xs break-words shadow-xs transition-colors ${
                      isOwn
                        ? 'bg-amber-500 text-white rounded-br-xs'
                        : 'bg-white dark:bg-zinc-800/90 text-gray-900 dark:text-zinc-100 border border-gray-200/80 dark:border-zinc-700/80 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed select-text font-normal">
                      {msg.content}
                    </p>

                    {/* Footer inside bubble: timestamp & delete button */}
                    <div
                      className={`flex items-center justify-end gap-2 mt-1.5 text-[10px] ${
                        isOwn
                          ? 'text-amber-100'
                          : 'text-gray-400 dark:text-zinc-500'
                      }`}
                    >
                      <span>{formatTime(msg.created_at)}</span>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(msg.id)}
                          disabled={deletingId === msg.id}
                          title={isAdmin && !isOwn ? 'Admin Moderation: Delete message' : 'Delete my message'}
                          className={`opacity-70 hover:opacity-100 transition p-0.5 rounded cursor-pointer ${
                            isOwn
                              ? 'text-amber-200 hover:text-white'
                              : 'text-red-500 hover:text-red-700'
                          }`}
                        >
                          {deletingId === msg.id ? (
                            <span className="inline-block animate-spin text-[10px]">⌛</span>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Avatar for own messages */}
                {isOwn && (
                  <div className="mt-1 shrink-0">
                    <UserAvatar
                      avatarUrl={currentUserProfile?.avatar_url}
                      name={currentUserProfile?.full_name || 'You'}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Fixed Chat Input Bar (Above BottomNav) ────────────── */}
      <div className="fixed bottom-[56px] left-0 right-0 z-40 bg-[#FAF6EC]/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-amber-200/60 dark:border-zinc-800 transition-colors">
        <form
          onSubmit={handleSend}
          className="max-w-md mx-auto px-4 py-2.5 flex items-end gap-2"
        >
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Share a word, prayer, or testimony..."
              maxLength={500}
              rows={1}
              className="w-full resize-none rounded-2xl bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 px-3.5 py-2 text-xs text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-xs leading-normal max-h-32"
            />
            {text.length > 350 && (
              <span
                className={`absolute right-2.5 bottom-1 text-[9px] font-bold ${
                  charsLeft < 20 ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500'
                }`}
              >
                {charsLeft}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!text.trim() || isSubmitting || text.length > 500}
            className={`h-9 px-4 rounded-2xl flex items-center justify-center font-bold text-xs transition shadow-sm shrink-0 cursor-pointer ${
              !text.trim() || isSubmitting || text.length > 500
                ? 'bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 text-gray-950 active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <span className="w-4 h-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="flex items-center gap-1">
                <span>Send</span>
                <svg className="w-3.5 h-3.5 rotate-45 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
