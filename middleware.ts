import { NextRequest, NextResponse } from 'next/server'
import { computeAuthCookieValue, timingSafeEqualHex } from '@/lib/auth-cookie'

export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get('auth')
  const sitePassword = process.env.SITE_PASSWORD
  if (cookie?.value && sitePassword) {
    const expected = await computeAuthCookieValue(sitePassword)
    if (timingSafeEqualHex(cookie.value, expected)) {
      return NextResponse.next()
    }
  }
  const url = req.nextUrl.clone()
  if (url.pathname === '/login' || url.pathname === '/api/login') return NextResponse.next()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|manifest.json|sw.js).*)'],
}
