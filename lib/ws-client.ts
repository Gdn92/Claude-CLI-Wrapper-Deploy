import type { TurnEvent } from './types'

type EventHandler = (event: TurnEvent) => void

class WsClient {
  private ws: WebSocket | null = null
  private handlers: EventHandler[] = []

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    const url = (process.env.NEXT_PUBLIC_PROCESS_SERVER_URL ?? 'http://localhost:3001')
      .replace(/^http/, 'ws') + '/ws'
    this.ws = new WebSocket(url)
    this.ws.onmessage = (e) => {
      try {
        const { event } = JSON.parse(e.data)
        this.handlers.forEach(h => h(event))
      } catch {
        // malformed message - ignore
      }
    }
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
  }

  send(action: string, payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, payload }))
    }
  }

  on(handler: EventHandler): () => void {
    this.handlers.push(handler)
    return () => { this.handlers = this.handlers.filter(h => h !== handler) }
  }
}

export const wsClient = new WsClient()
