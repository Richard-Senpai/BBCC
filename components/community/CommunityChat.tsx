'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Sparkles, MessageSquare, Send, Trash2, Loader2, Image as ImageIcon, X } from 'lucide-react'
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
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} / ${timeStr}`
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, setIsUploadingImage] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // 1. Fetch complete message history from Supabase on mount (guarantees history persists across sessions)
  useEffect(() => {
    async function loadMessageHistory() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('messages')
        .select('id, user_id, content, image_url, created_at, profiles(id, full_name, avatar_url, fellowship_unit, role, display_tag)')
        .order('created_at', { ascending: true })
        .limit(200)

      if (data) {
        setMessages(data as unknown as MessageWithSender[])
        setTimeout(() => scrollToBottom('auto'), 50)
      } else if (error) {
        console.warn('Initial joined messages query returned error, trying fallback:', error.message)
        const fallbackRes = await supabase
          .from('messages')
          .select('id, user_id, content, image_url, created_at')
          .order('created_at', { ascending: true })
          .limit(200)
        if (fallbackRes.data) {
          setMessages(fallbackRes.data.map((m) => ({ ...m, profiles: null })) as unknown as MessageWithSender[])
          setTimeout(() => scrollToBottom('auto'), 50)
        }
      }
    }

    loadMessageHistory()
  }, [])

  // 2. Subscribe to Supabase Realtime for live messages and deletions
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
            content: string | null
            image_url: string | null
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
                  display_tag: currentUserProfile.display_tag ?? null,
                },
              }
              return [...prev, ownMessage]
            }

            // Otherwise, fetch sender profile asynchronously
            if (newRow.user_id) {
              supabase
                .from('profiles')
                .select('id, full_name, avatar_url, fellowship_unit, role, display_tag')
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image exceeds 5MB limit. Please choose a smaller photo.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WEBP, GIF).')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setSelectedImage(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setErrorMsg(null)
  }

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
    setSelectedImage(null)
    setImagePreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const content = text.trim()
    if ((!content && !selectedImage) || isSubmitting) return

    if (content.length > 500) {
      setErrorMsg('Message exceeds 500 characters.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    // Temporary optimistic ID
    const optimisticId = `temp-${Date.now()}`
    const previewUrl = imagePreviewUrl
    const fileToUpload = selectedImage

    const optimisticMessage: MessageWithSender = {
      id: optimisticId,
      user_id: currentUserId,
      content: content || null,
      image_url: previewUrl || null,
      created_at: new Date().toISOString(),
      profiles: currentUserProfile
        ? {
            id: currentUserProfile.id,
            full_name: currentUserProfile.full_name,
            avatar_url: currentUserProfile.avatar_url,
            fellowship_unit: currentUserProfile.fellowship_unit,
            role: currentUserProfile.role,
            display_tag: currentUserProfile.display_tag ?? null,
          }
        : null,
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setText('')
    handleRemoveImage()
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setTimeout(() => scrollToBottom(), 20)

    try {
      let finalImageUrl: string | null = null

      if (fileToUpload) {
        setIsUploadingImage(true)
        const supabase = createClient()
        const ext = fileToUpload.name.split('.').pop()?.toLowerCase() || 'jpg'
        const cleanName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
        const filePath = `${currentUserId}/${cleanName}`

        const { error: uploadErr } = await supabase.storage
          .from('chat-images')
          .upload(filePath, fileToUpload, {
            contentType: fileToUpload.type,
            upsert: false,
          })

        if (uploadErr) {
          throw new Error(`Photo upload failed: ${uploadErr.message}`)
        }

        const { data: urlData } = supabase.storage
          .from('chat-images')
          .getPublicUrl(filePath)

        finalImageUrl = urlData.publicUrl
      }

      const res = await postMessage({
        content: content || null,
        imageUrl: finalImageUrl,
      })

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
      setIsUploadingImage(false)
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
    <div className="flex flex-col min-h-screen bg-[var(--bg-canvas)] text-[var(--text-ink)]">
      {/* ── Top App Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[var(--bg-canvas)]/90 backdrop-blur-md px-4 pt-4 pb-3 border-b border-[var(--border-hairline)] transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BBCCLogo size="sm" />
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight text-[var(--text-ink)] flex items-center gap-1.5">
                Fellowship Wall
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--olive-accent)] inline-block" />
              </h1>
              <p className="text-[11px] text-[var(--text-muted)]">
                Day {currentDay > 0 ? currentDay : 1} of {durationDays} / Corporate Encouragement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-2.5 py-1 rounded-lg transition"
            >
              Today
            </Link>
          </div>
        </div>
      </header>

      {/* ── Fellowship Scripture / Welcome Prompt ─────────────── */}
      <div className="px-4 pt-3 pb-1">
        <div className="bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border-hairline)] flex items-center justify-between text-xs text-[var(--text-muted)] shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--flame-accent)] shrink-0">
              <Sparkles size={14} strokeWidth={1.75} />
            </span>
            <span className="text-[11px] leading-tight">
              <strong className="text-[var(--text-ink)] font-semibold">1 Thess. 5:11:</strong> &ldquo;Encourage one another and build each other up.&rdquo;
            </span>
          </div>
          <span className="text-[10px] font-medium text-[var(--text-muted)] shrink-0 ml-2">
            {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
          </span>
        </div>
      </div>

      {/* ── Error Banner ───────────────────────────────────────── */}
      {errorMsg && (
        <div className="mx-4 mt-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
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
      <div className="flex-1 px-4 py-3 space-y-3 pb-36">
        {messages.length === 0 ? (
          <div className="my-12 text-center py-10 px-6 bg-[var(--bg-surface)] rounded-2xl border border-dashed border-[var(--border-hairline)] shadow-xs">
            <div className="w-10 h-10 mx-auto rounded-full bg-[var(--bg-subtle)] text-[var(--flame-accent)] flex items-center justify-center mb-2.5 border border-[var(--border-hairline)]">
              <MessageSquare size={18} strokeWidth={1.75} />
            </div>
            <h2 className="text-sm font-semibold text-[var(--text-ink)]">
              Welcome to the Fellowship Wall
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed max-w-xs mx-auto">
              Share a prayer request, testimony, or note of spiritual encouragement as we journey through the {durationDays} days together.
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
                <div className={`flex flex-col max-w-[82%] sm:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name & Details Header - visible on EVERY message */}
                  <div className={`flex items-center gap-1.5 mb-1 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[11px] font-medium text-[var(--text-muted)] font-sans">
                      {isOwn ? 'You' : senderName}
                    </span>
                    {isSenderAdmin && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--flame-accent)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded border border-[var(--border-hairline)]">
                        Admin
                      </span>
                    )}
                    {msg.profiles?.display_tag && (
                      <span className="text-[9px] font-medium text-[var(--olive-accent)] bg-[var(--olive-accent)]/10 px-1.5 py-0.5 rounded border border-[var(--olive-accent)]/20">
                        {msg.profiles.display_tag}
                      </span>
                    )}
                    {!isOwn && senderUnit && (
                      <span className="text-[10px] text-[var(--text-muted)]/80 truncate max-w-[130px]">
                        · {senderUnit}
                      </span>
                    )}
                  </div>

                  {/* Bubble Content */}
                  <div
                    className={`relative px-3.5 py-2.5 rounded-2xl text-xs break-words shadow-xs transition-colors ${
                      isOwn
                        ? 'bg-[var(--flame-accent)] text-white rounded-br-xs'
                        : 'bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-hairline)] rounded-bl-xs'
                    }`}
                  >
                    {/* Inline Image Attachment */}
                    {msg.image_url && (
                      <div className="mb-2 overflow-hidden rounded-xl bg-black/5 dark:bg-black/20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={msg.image_url}
                          alt="Attached photo"
                          loading="lazy"
                          className="w-full max-h-72 object-cover rounded-xl cursor-pointer hover:opacity-95 transition"
                          onClick={() => window.open(msg.image_url!, '_blank', 'noopener,noreferrer')}
                        />
                      </div>
                    )}

                    {/* Text content if present */}
                    {msg.content && (
                      <p className="whitespace-pre-wrap leading-relaxed select-text font-normal">
                        {msg.content}
                      </p>
                    )}

                    {/* Footer inside bubble: timestamp & delete button */}
                    <div
                      className={`flex items-center justify-end gap-2 mt-1.5 text-[10px] ${
                        isOwn
                          ? 'text-white/80'
                          : 'text-[var(--text-muted)]'
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
                              ? 'text-white/80 hover:text-white'
                              : 'text-red-500 hover:text-red-600'
                          }`}
                        >
                          {deletingId === msg.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} strokeWidth={1.75} />
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
      <div className="fixed bottom-[56px] left-0 right-0 z-40 bg-[var(--bg-canvas)]/95 backdrop-blur-md border-t border-[var(--border-hairline)] transition-colors">
        <form
          onSubmit={handleSend}
          className="max-w-md mx-auto px-4 py-2.5 flex flex-col gap-2"
        >
          {/* Image Preview thumbnail if an image is selected */}
          {imagePreviewUrl && (
            <div className="flex items-center gap-2 p-1.5 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-hairline)] w-fit max-w-full">
              <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt="Attachment preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-[11px] leading-tight min-w-0 pr-1">
                <p className="font-medium text-[var(--text-ink)] truncate max-w-[150px]">
                  {selectedImage?.name || 'Photo attachment'}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {selectedImage ? `${(selectedImage.size / 1024).toFixed(0)} KB` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="p-1 rounded-full text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--bg-subtle)] transition cursor-pointer"
                title="Remove photo"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach photo"
              disabled={isSubmitting}
              className="h-8.5 w-8.5 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--flame-accent)] hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border-hairline)] transition shrink-0 cursor-pointer disabled:opacity-50"
            >
              <ImageIcon size={18} strokeWidth={1.75} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              onChange={handleImageSelect}
              className="hidden"
            />

            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder={selectedImage ? 'Add a caption (optional)...' : 'Share a word, prayer, or testimony...'}
                maxLength={500}
                rows={1}
                className="w-full resize-none rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3 py-2 text-xs text-[var(--text-ink)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--flame-accent)] transition-all shadow-xs leading-normal max-h-32"
              />
              {text.length > 350 && (
                <span
                  className={`absolute right-2.5 bottom-1 text-[9px] font-medium ${
                    charsLeft < 20 ? 'text-red-500' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {charsLeft}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={(!text.trim() && !selectedImage) || isSubmitting || text.length > 500}
              className={`h-8.5 px-3.5 rounded-xl flex items-center justify-center font-medium text-xs transition shadow-xs shrink-0 cursor-pointer ${
                (!text.trim() && !selectedImage) || isSubmitting || text.length > 500
                  ? 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hairline)] cursor-not-allowed'
                  : 'bg-[var(--flame-accent)] hover:opacity-95 text-white active:scale-95'
              }`}
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin text-white" />
              ) : (
                <span className="flex items-center gap-1.5">
                  <span>Send</span>
                  <Send size={12} strokeWidth={1.75} />
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

