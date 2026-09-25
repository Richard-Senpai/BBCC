'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Post a new message to the fellowship community wall.
 * Validates text length (1 to 500 characters) and authenticated session.
 */
export async function postMessage(content: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('You must be signed in to post a message.')
  }

  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('Message cannot be blank.')
  }
  if (trimmed.length > 500) {
    throw new Error('Message cannot exceed 500 characters.')
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      user_id: user.id,
      content: trimmed,
    })
    .select('id, user_id, content, created_at')
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

  // Fetch message to verify authorship
  const { data: msg } = await supabase
    .from('messages')
    .select('user_id')
    .eq('id', messageId)
    .single()

  if (!msg) {
    throw new Error('Message not found.')
  }

  if (msg.user_id !== user.id && !isAdmin) {
    throw new Error('You are not authorized to delete this message.')
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
