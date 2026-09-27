import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/types'
import type { Profile } from '@/lib/types'

/**
 * Middleware Supabase client.
 * Used in middleware.ts to refresh the user's session on every request.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do NOT remove this await
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isProtectedMember =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/community') ||
    pathname.startsWith('/leaderboard')
  const isProtectedAdmin = pathname.startsWith('/admin')
  const isHoldingRoute = pathname.startsWith('/pending')
  const isAuthRoute =
    pathname.startsWith('/login') || pathname.startsWith('/signup')

  // Unauthenticated user hitting any protected or holding route → redirect to login
  if (!user && (isProtectedMember || isProtectedAdmin || isHoldingRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated user checks
  if (user) {
    const { data: profile } = (await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()) as { data: Pick<Profile, 'role' | 'status'> | null; error: unknown }

    const isAdmin = profile?.role === 'admin'
    // Status is considered pending or rejected if explicitly set as such.
    // Existing members without status (or status = 'approved') are approved.
    const isUnapproved =
      !isAdmin &&
      (profile?.status === 'pending' || profile?.status === 'rejected')

    // 1. Pending or Rejected members:
    if (isUnapproved) {
      // Allow them to stay on the holding page
      if (isHoldingRoute) {
        return supabaseResponse
      }
      // Redirect away from all other routes (dashboard, community, admin, login, etc.) to /pending
      const url = request.nextUrl.clone()
      url.pathname = '/pending'
      return NextResponse.redirect(url)
    }

    // 2. Approved members & admins:
    // If they hit /pending holding page, redirect to their home
    if (isHoldingRoute) {
      const url = request.nextUrl.clone()
      url.pathname = isAdmin ? '/admin' : '/dashboard'
      return NextResponse.redirect(url)
    }

    // If they hit an auth route (login/signup) → redirect to their home
    if (isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = isAdmin ? '/admin' : '/dashboard'
      return NextResponse.redirect(url)
    }

    // Admin-only area accessed by a non-admin → redirect to dashboard
    if (isProtectedAdmin && !isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
