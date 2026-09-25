import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Next.js 16 "proxy" — replaces the old middleware.ts convention.
 * Runs on every matched request: refreshes Supabase sessions and
 * enforces role-based route guards.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image  (image optimization)
     * - favicon.ico  (browser icon)
     * - /auth/callback (email confirm redirect — must be public)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
}
