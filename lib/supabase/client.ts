import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types'

/**
 * Browser-side Supabase client.
 * Safe to use in Client Components and event handlers.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
