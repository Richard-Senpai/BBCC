import { NextResponse, type NextRequest } from 'next/server'
import { checkAndDispatchNewDayPush } from '@/lib/push-server'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // If no secret configured in environment, allow only in development
    return process.env.NODE_ENV === 'development'
  }

  // 1. Check Bearer Authorization Header
  const authHeader = req.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token === cronSecret) return true
  }

  // 2. Check query parameter fallback (?secret=...)
  const { searchParams } = new URL(req.url)
  const secretParam = searchParams.get('secret')
  if (secretParam === cronSecret) return true

  return false
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized: invalid or missing cron secret' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const force = searchParams.get('force') === 'true'

  const result = await checkAndDispatchNewDayPush({ force })
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized: invalid or missing cron secret' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  let force = searchParams.get('force') === 'true'

  try {
    const body = await req.json().catch(() => ({}))
    if (body.force === true) {
      force = true
    }
  } catch {
    // Body is optional
  }

  const result = await checkAndDispatchNewDayPush({ force })
  return NextResponse.json(result)
}
