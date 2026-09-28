'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateAvatarUrl(
  avatarUrl: string
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

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)

    if (error) {
      console.error('[updateAvatarUrl] Error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/profile')
    revalidatePath('/leaderboard')
    revalidatePath('/admin')

    return { success: true }
  } catch (err) {
    console.error('[updateAvatarUrl] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update avatar.',
    }
  }
}
