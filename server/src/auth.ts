import { timingSafeEqual } from 'crypto'

// Accepts a bearer token (from header or ws query param) and the configured
// secret. Always compares equal-length buffers via timingSafeEqual; a length
// mismatch is rejected before any timing-sensitive compare runs. Every
// failure path returns false — callers must send an identical 401 regardless
// of which sub-condition failed.
export function isAuthorized(provided: string | undefined | null, token: string | undefined | null): boolean {
  if (!provided || !token) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(token)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function extractBearerToken(header: string | string[] | undefined | null): string | undefined {
  const value = Array.isArray(header) ? header[0] : header
  if (!value) return undefined
  const match = /^Bearer (.+)$/.exec(value)
  return match?.[1]
}
