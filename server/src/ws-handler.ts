import type WebSocket from 'ws'
import { randomUUID } from 'crypto'
import { ProcessManager } from './process-manager'
import type { AgentBus } from './agent-bus'
import type { ThreadStore } from './thread-store'
import { getDiff } from './diff-service'
import type { WsClientMessage } from './types'

export function handleConnection(ws: WebSocket, bus: AgentBus, store: ThreadStore) {
  const sessionId = randomUUID()
  bus.register(sessionId, ws)

  // Tell the client its session ID so it can identify itself in team routing
  ws.send(JSON.stringify({ event: { type: 'session_init', sessionId, cwd: '' } }))

  ws.on('message', async (raw) => {
    let msg: WsClientMessage
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    switch (msg.action) {
      case 'send': {
        const { content, threadId, projectPath } = msg.payload as {
          content: string
          threadId: string
          projectPath: string
        }
        store.appendMessage(threadId, 'user', 'text', content, {})

        let pm = bus.getProcessManager(sessionId)
        if (!pm) {
          pm = new ProcessManager({
            command: 'claude',
            args: ['--output-format', 'stream-json', '--print', content],
            cwd: projectPath,
            onEvent: (event) => {
              bus.send(sessionId, event)
              if (event.type === 'text') {
                store.appendMessage(threadId, 'assistant', 'text', event.content, {})
              } else if (event.type === 'tool_call_start') {
                store.appendMessage(threadId, 'assistant', 'tool_call_start', event.label, {
                  id: event.id, toolType: event.toolType, params: event.params,
                })
              }
            },
          })
          bus.setProcessManager(sessionId, pm)
        } else {
          pm.write(content + '\n')
        }
        break
      }

      case 'cancel': {
        bus.getProcessManager(sessionId)?.kill()
        break
      }

      case 'diff_request': {
        const { cwd } = msg.payload as { cwd: string }
        const diff = await getDiff(cwd)
        ws.send(JSON.stringify({ event: { type: 'diff_result', diff } }))
        break
      }

      case 'team_join': {
        const { teamId } = msg.payload as { teamId: string }
        bus.setTeam(sessionId, teamId)
        break
      }

      case 'team_forward': {
        const { targetSessionId, content } = msg.payload as { targetSessionId: string; content: string }
        bus.forward(targetSessionId, content)
        break
      }

      case 'team_pipe': {
        const { targetSessionId, raw: rawData } = msg.payload as { targetSessionId: string; raw: string }
        bus.pipe(targetSessionId, rawData)
        break
      }
    }
  })

  ws.on('close', () => {
    bus.getProcessManager(sessionId)?.kill()
    bus.unregister(sessionId)
  })
}
