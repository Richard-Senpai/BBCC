'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateAvatarUrl(avatarUrl: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthenticated')

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  revalidatePath('/leaderboard')
  revalidatePath('/admin')

  return { success: true }
}
