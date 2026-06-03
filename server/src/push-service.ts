import webpush from 'web-push'
import type { ThreadStore } from './thread-store'

// VAPID keys must be set in env before starting server.
// Generate once with: npx web-push generate-vapid-keys
export class PushService {
  constructor(private store: ThreadStore) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL ?? 'mailto:mpny19@gmail.com',
      process.env.VAPID_PUBLIC_KEY ?? '',
      process.env.VAPID_PRIVATE_KEY ?? ''
    )
  }

  addSubscription(sub: webpush.PushSubscription) {
    this.store.upsertPushSubscription(sub)
  }

  async notifyAll(title: string, body: string, url: string) {
    const subs = this.store.listPushSubscriptions()
    if (!subs.length) return

    const payload = JSON.stringify({ title, body, url })
    await Promise.allSettled(
      subs.map(s =>
        webpush.sendNotification(s, payload).catch(() => {
          // Expired subscription — remove it so it doesn't accumulate
          this.store.deletePushSubscription(s.endpoint)
        })
      )
    )
  }
}
