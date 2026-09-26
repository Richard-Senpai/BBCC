'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Broadcast a new church announcement (Admin only).
 */
export async function createAnnouncement(title: string, body: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  // Verify admin permissions
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Only administrators can publish announcements.')
  }

  const cleanTitle = title.trim()
  const cleanBody = body.trim()

  if (!cleanTitle) {
    throw new Error('Announcement title cannot be empty.')
  }
  if (cleanTitle.length > 120) {
    throw new Error('Announcement title cannot exceed 120 characters.')
  }

  if (!cleanBody) {
    throw new Error('Announcement body cannot be empty.')
  }
  if (cleanBody.length > 2000) {
    throw new Error('Announcement body cannot exceed 2000 characters.')
  }

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: cleanTitle,
      body: cleanBody,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error creating announcement:', error)
    throw new Error(error.message || 'Failed to post announcement.')
  }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/progress')
  revalidatePath('/leaderboard')
  revalidatePath('/admin')

  return { success: true, announcement: data }
}

/**
 * Delete an announcement (Admin only).
 */
export async function deleteAnnouncement(announcementId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  // Verify admin permissions
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Only administrators can delete announcements.')
  }

  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId)

  if (error) {
    console.error('Error deleting announcement:', error)
    throw new Error(error.message || 'Failed to delete announcement.')
  }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/progress')
  revalidatePath('/leaderboard')
  revalidatePath('/admin')

  return { success: true }
}

/**
 * Update member's last seen timestamp for announcements.
 * Clears the unread notification bell indicator.
 */
export async function markAnnouncementsAsSeen() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .update({ last_seen_announcements_at: now })
    .eq('id', user.id)

  if (error) {
    console.error('Error marking announcements as seen:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/progress')
  revalidatePath('/leaderboard')

  return { success: true }
}
