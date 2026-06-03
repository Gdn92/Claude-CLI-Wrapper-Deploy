import type WebSocket from 'ws'
import type { TurnEvent } from './types'
import type { ProcessManager } from './process-manager'

interface Session {
  id: string
  ws: WebSocket
  teamId?: string
  processManager?: ProcessManager
}

// Single hub for all active WebSocket sessions.
// Cross-session routing (team forward/pipe) goes through here only.
export class AgentBus {
  private sessions = new Map<string, Session>()

  register(sessionId: string, ws: WebSocket) {
    this.sessions.set(sessionId, { id: sessionId, ws })
  }

  unregister(sessionId: string) {
    this.sessions.delete(sessionId)
  }

  setTeam(sessionId: string, teamId: string) {
    const s = this.sessions.get(sessionId)
    if (s) s.teamId = teamId
  }

  setProcessManager(sessionId: string, pm: ProcessManager) {
    const s = this.sessions.get(sessionId)
    if (s) s.processManager = pm
  }

  getProcessManager(sessionId: string): ProcessManager | null {
    return this.sessions.get(sessionId)?.processManager ?? null
  }

  send(sessionId: string, event: TurnEvent) {
    const s = this.sessions.get(sessionId)
    if (s && s.ws.readyState === 1 /* OPEN */) {
      s.ws.send(JSON.stringify({ event }))
    }
  }

  forward(targetSessionId: string, content: string) {
    const target = this.sessions.get(targetSessionId)
    target?.processManager?.write(content + '\n')
  }

  pipe(targetSessionId: string, raw: string) {
    const target = this.sessions.get(targetSessionId)
    target?.processManager?.write(raw)
  }

  teamSessions(teamId: string): string[] {
    return Array.from(this.sessions.values())
      .filter(s => s.teamId === teamId)
      .map(s => s.id)
  }

  teamStatus(teamId: string): Array<{ sessionId: string; alive: boolean }> {
    return this.teamSessions(teamId).map(id => ({
      sessionId: id,
      alive: this.sessions.get(id)?.processManager?.isAlive() ?? false,
    }))
  }
}
