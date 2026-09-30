'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Message } from '@/lib/types'

export type PostMessageInput =
  | string
  | {
      content?: string | null
      imageUrl?: string | null
    }

export type PostMessageResponse =
  | { success: true; message: Message; error?: never }
  | { success: false; error: string; message?: never }

export type DeleteMessageResponse =
  | { success: true; error?: never }
  | { success: false; error: string }

/**
 * Post a new message to the fellowship community wall.
 * Supports text, photo attachment, or both.
 */
export async function postMessage(
  input: PostMessageInput
): Promise<PostMessageResponse> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'You must be signed in to post a message.' }
    }

    let textContent: string | null = null
    let imageAttachmentUrl: string | null = null

    if (typeof input === 'string') {
      textContent = input.trim()
    } else {
      textContent = input.content ? input.content.trim() : null
      imageAttachmentUrl = input.imageUrl ? input.imageUrl.trim() : null
    }

    if (!textContent && !imageAttachmentUrl) {
      return {
        success: false,
        error: 'Message cannot be empty. Please enter text or attach an image.',
      }
    }

    if (textContent && textContent.length > 500) {
      return { success: false, error: 'Message cannot exceed 500 characters.' }
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        user_id: user.id,
        content: textContent || null,
        image_url: imageAttachmentUrl || null,
      })
      .select('id, user_id, content, image_url, created_at')
      .single()

    if (error) {
      console.error('[postMessage] Error posting message:', error)
      return { success: false, error: error.message || 'Failed to send message.' }
    }

    // Keep the author's own last_seen_chat_at up to date
    await supabase
      .from('profiles')
      .update({ last_seen_chat_at: new Date().toISOString() })
      .eq('id', user.id)

    revalidatePath('/community')
    return { success: true, message: data as Message }
  } catch (err) {
    console.error('[postMessage] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to post message.',
    }
  }
}

/**
 * Delete a message from the fellowship community wall.
 * Allowed if the caller is the author of the message or an administrator.
 * Automatically cleans up any attached photo from storage.
 */
export async function deleteMessage(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'You must be signed in to delete a message.' }
    }

    // Fetch user role for moderation check
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profError) {
      console.error('[deleteMessage] Error fetching profile:', profError)
    }

    const isAdmin = profile?.role === 'admin'

    // Fetch message to verify authorship & get image_url if present
    const { data: msg, error: msgError } = await supabase
      .from('messages')
      .select('user_id, image_url')
      .eq('id', messageId)
      .single()

    if (msgError || !msg) {
      return { success: false, error: 'Message not found.' }
    }

    if (msg.user_id !== user.id && !isAdmin) {
      return { success: false, error: 'You are not authorized to delete this message.' }
    }

    // Clean up attached image in chat-images storage bucket if present
    if (msg.image_url) {
      try {
        const parts = msg.image_url.split('/chat-images/')
        if (parts.length > 1) {
          const filePath = decodeURIComponent(parts[1])
          await supabase.storage.from('chat-images').remove([filePath])
        }
      } catch (storageErr) {
        console.error('[deleteMessage] Error cleaning up chat image from storage:', storageErr)
      }
    }

    const { error: delError } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)

    if (delError) {
      console.error('[deleteMessage] Error deleting message:', delError)
      return { success: false, error: delError.message || 'Failed to delete message.' }
    }

    revalidatePath('/community')
    return { success: true }
  } catch (err) {
    console.error('[deleteMessage] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete message.',
    }
  }
}

/**
 * Update member's last seen timestamp for community chat.
 * Clears the unread chat indicator across navigation.
 */
export async function markChatAsSeen(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthenticated: please sign in.' }
    }

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('profiles')
      .update({ last_seen_chat_at: now })
      .eq('id', user.id)

    if (error) {
      console.error('[markChatAsSeen] Error updating last_seen_chat_at:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/community')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/progress')
    revalidatePath('/leaderboard')
    revalidatePath('/dashboard/profile')

    return { success: true }
  } catch (err) {
    console.error('[markChatAsSeen] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark chat as seen.',
    }
  }
}

/**
 * Check if current member has unread community chat messages.
 * Unread = exists at least one message in the messages table with
 * created_at > the member's last_seen_chat_at, sent by someone other than themselves.
 */
export async function getChatUnreadStatus(): Promise<{ unread: boolean; lastSeenAt?: string | null }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { unread: false }
    }

    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('last_seen_chat_at')
      .eq('id', user.id)
      .single()

    if (profError || !profile || !profile.last_seen_chat_at) {
      return { unread: false }
    }

    // Query for any message newer than member's last_seen_chat_at sent by someone other than themselves
    const { data: unreadMsg, error: msgError } = await supabase
      .from('messages')
      .select('id')
      .gt('created_at', profile.last_seen_chat_at)
      .neq('user_id', user.id)
      .limit(1)

    if (msgError) {
      console.error('[getChatUnreadStatus] Error checking messages:', msgError)
      return { unread: false, lastSeenAt: profile.last_seen_chat_at }
    }

    return {
      unread: Boolean(unreadMsg && unreadMsg.length > 0),
      lastSeenAt: profile.last_seen_chat_at,
    }
  } catch (err) {
    console.error('[getChatUnreadStatus] Unexpected error:', err)
    return { unread: false }
  }
}

