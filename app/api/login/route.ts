import { NextRequest, NextResponse } from 'next/server'
import { computeAuthCookieValue } from '@/lib/auth-cookie'

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10

// In-memory per-IP attempt counter. Resets on redeploy — acceptable for a
// single-instance Hobby/free-tier deployment; not a distributed rate limit.
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_ATTEMPTS
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 })
  }

  const { password } = await req.json()
  const sitePassword = process.env.SITE_PASSWORD
  if (!sitePassword || password !== sitePassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth', await computeAuthCookieValue(sitePassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
