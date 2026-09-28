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
