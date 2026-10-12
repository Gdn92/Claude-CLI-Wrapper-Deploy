import type { TurnEvent } from './types'
import { getProcessServerWsUrl } from './process-server'

type EventHandler = (event: TurnEvent) => void

class WsClient {
  private ws: WebSocket | null = null
  private handlers: EventHandler[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connecting = false

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING || this.connecting) return
    this.connecting = true
    const url = await getProcessServerWsUrl()
    this.connecting = false
    this.ws = new WebSocket(url)
    this.ws.onmessage = (e) => {
      try {
        const { event } = JSON.parse(e.data)
        this.handlers.forEach(h => h(event))
      } catch {
        // malformed message - ignore
      }
    }
    this.ws.onclose = () => {
      if (this.reconnectTimer) return
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        this.connect()
      }, 2000)
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
