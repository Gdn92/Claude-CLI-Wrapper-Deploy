// Shared by app/api/login/route.ts (Node runtime) and middleware.ts (Edge
// runtime) — Web Crypto (globalThis.crypto.subtle) works in both, unlike
// node:crypto, so this stays runtime-agnostic.
const FIXED_MESSAGE = 'ccw-authenticated'

async function hmacHex(key: string, message: string): Promise<string> {
  const keyData = new TextEncoder().encode(key)
  const msgData = new TextEncoder().encode(message)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// The cookie never holds the raw password — only an HMAC (key = SITE_PASSWORD)
// of a fixed message, so a leaked cookie never discloses the password itself.
export function computeAuthCookieValue(sitePassword: string): Promise<string> {
  return hmacHex(sitePassword, FIXED_MESSAGE)
}

// Constant-time-ish compare: length check first, then XOR every char
// regardless of where a mismatch occurs (no early return on content).
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
