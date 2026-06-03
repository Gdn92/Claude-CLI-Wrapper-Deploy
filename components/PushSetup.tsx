'use client'
import { useEffect } from 'react'

const SERVER = process.env.NEXT_PUBLIC_PROCESS_SERVER_URL ?? 'http://localhost:3001'

// Converts VAPID public key from base64url to Uint8Array for pushManager.subscribe
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

export function PushSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      try {
        const vapidRes = await fetch(`${SERVER}/push/vapid-public-key`)
        const { key } = await vapidRes.json()
        if (!key) return // VAPID not configured yet

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
        })

        await fetch(`${SERVER}/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
        })
      } catch {
        // Push not available (HTTP, no permission, etc.) - silent fail
      }
    })
  }, [])

  return null
}
