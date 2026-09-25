import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

/**
 * Root page — redirects authenticated users based on role,
 * and unauthenticated users to the login page.
 */
export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role'> | null; error: unknown }

  if (profile?.role === 'admin') {
    redirect('/admin')
  }

  redirect('/dashboard')
}
