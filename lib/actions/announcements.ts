'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Announcement } from '@/lib/types'

/**
 * Broadcast a new church announcement (Admin only).
 */
export async function createAnnouncement(
  title: string,
  body: string
): Promise<{ success: boolean; error?: string; announcement?: Announcement }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthenticated: please sign in.' }
    }

    // Verify admin permissions
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profError || profile?.role !== 'admin') {
      return { success: false, error: 'Only administrators can publish announcements.' }
    }

    const cleanTitle = title.trim()
    const cleanBody = body.trim()

    if (!cleanTitle) {
      return { success: false, error: 'Announcement title cannot be empty.' }
    }
    if (cleanTitle.length > 120) {
      return { success: false, error: 'Announcement title cannot exceed 120 characters.' }
    }

    if (!cleanBody) {
      return { success: false, error: 'Announcement body cannot be empty.' }
    }
    if (cleanBody.length > 2000) {
      return { success: false, error: 'Announcement body cannot exceed 2000 characters.' }
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
      console.error('[createAnnouncement] Error creating announcement:', error)
      return { success: false, error: error.message || 'Failed to post announcement.' }
    }

    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard/progress')
    revalidatePath('/leaderboard')
    revalidatePath('/admin')

    return { success: true, announcement: data as Announcement }
  } catch (err) {
    console.error('[createAnnouncement] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to publish announcement.',
    }
  }
}

/**
 * Delete an announcement (Admin only).
 */
export async function deleteAnnouncement(
  announcementId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthenticated: please sign in.' }
    }

    // Verify admin permissions
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profError || profile?.role !== 'admin') {
      return { success: false, error: 'Only administrators can delete announcements.' }
    }

    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementId)

    if (error) {
      console.error('[deleteAnnouncement] Error deleting announcement:', error)
      return { success: false, error: error.message || 'Failed to delete announcement.' }
    }

    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard/progress')
    revalidatePath('/leaderboard')
    revalidatePath('/admin')

    return { success: true }
  } catch (err) {
    console.error('[deleteAnnouncement] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete announcement.',
    }
  }
}

/**
 * Update member's last seen timestamp for announcements.
 * Clears the unread notification bell indicator.
 */
export async function markAnnouncementsAsSeen(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthenticated' }
    }

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('profiles')
      .update({ last_seen_announcements_at: now })
      .eq('id', user.id)

    if (error) {
      console.error('[markAnnouncementsAsSeen] Error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard/progress')
    revalidatePath('/leaderboard')

    return { success: true }
  } catch (err) {
    console.error('[markAnnouncementsAsSeen] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark announcements as seen.',
    }
  }
}
