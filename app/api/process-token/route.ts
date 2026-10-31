import { NextResponse } from 'next/server'

// Sits behind the site-password middleware (see middleware.ts matcher — it
// is not in the public-path exemption list, so an unauthenticated caller
// never reaches this). Never expose PROCESS_SERVER_TOKEN via NEXT_PUBLIC_*.
export async function GET() {
  return NextResponse.json({ token: process.env.PROCESS_SERVER_TOKEN ?? null })
}
