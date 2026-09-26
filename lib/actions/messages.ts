'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PostMessageInput =
  | string
  | {
      content?: string | null
      imageUrl?: string | null
    }

/**
 * Post a new message to the fellowship community wall.
 * Supports text, photo attachment, or both.
 */
export async function postMessage(input: PostMessageInput) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('You must be signed in to post a message.')
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
    throw new Error('Message cannot be empty. Please enter text or attach an image.')
  }

  if (textContent && textContent.length > 500) {
    throw new Error('Message cannot exceed 500 characters.')
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
    console.error('Error posting message:', error)
    throw new Error(error.message || 'Failed to send message.')
  }

  revalidatePath('/community')
  return { success: true, message: data }
}

/**
 * Delete a message from the fellowship community wall.
 * Allowed if the caller is the author of the message or an administrator.
 * Automatically cleans up any attached photo from storage.
 */
export async function deleteMessage(messageId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('You must be signed in to delete a message.')
  }

  // Fetch user role for moderation check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Fetch message to verify authorship & get image_url if present
  const { data: msg } = await supabase
    .from('messages')
    .select('user_id, image_url')
    .eq('id', messageId)
    .single()

  if (!msg) {
    throw new Error('Message not found.')
  }

  if (msg.user_id !== user.id && !isAdmin) {
    throw new Error('You are not authorized to delete this message.')
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
      console.error('Error cleaning up chat image from storage:', storageErr)
    }
  }

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)

  if (error) {
    console.error('Error deleting message:', error)
    throw new Error(error.message || 'Failed to delete message.')
  }

  revalidatePath('/community')
  return { success: true }
}
