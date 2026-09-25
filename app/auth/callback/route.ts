import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

/**
 * Supabase email confirmation callback.
 * Supabase redirects here after the user clicks the confirmation link in their email.
 * We exchange the code for a session, then route based on role.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // next=<path> can be passed to redirect somewhere specific after login
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Determine role and redirect to the right place
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single() as { data: Pick<Profile, 'role'> | null; error: unknown }

        const destination =
          profile?.role === 'admin' ? '/admin' : next
        return NextResponse.redirect(`${origin}${destination}`)
      }
    }
  }

  // If something went wrong, redirect to login with an error hint
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
