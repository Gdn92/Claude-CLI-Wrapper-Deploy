import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get('auth')
  if (cookie?.value === process.env.SITE_PASSWORD) {
    return NextResponse.next()
  }
  const url = req.nextUrl.clone()
  if (url.pathname === '/login') return NextResponse.next()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|manifest.json|sw.js).*)'],
}
