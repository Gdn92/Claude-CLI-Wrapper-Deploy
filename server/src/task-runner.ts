import { ProcessManager } from './process-manager'
import type { PushService } from './push-service'
import type { ThreadStore } from './thread-store'
import type { TurnEvent } from './types'

// Runs claude tasks asynchronously — survives browser tab close.
// On completion, fires Web Push to all subscribed devices.
export class TaskRunner {
  constructor(private store: ThreadStore, private push: PushService) {}

  run(taskId: string, threadId: string, projectPath: string, content: string) {
    this.store.updateTaskStatus(taskId, 'running')
    let fullText = ''

    const pm = new ProcessManager({
      command: 'claude',
      args: ['--output-format', 'stream-json', '--print', content],
      cwd: projectPath,
      onEvent: (event: TurnEvent) => {
        if (event.type === 'text') {
          fullText += event.content
          this.store.appendMessage(threadId, 'assistant', 'text', event.content, {})
        } else if (event.type === 'tool_call_start') {
          this.store.appendMessage(threadId, 'assistant', 'tool_call_start', event.label, {
            id: event.id, toolType: event.toolType, params: event.params,
          })
        } else if (event.type === 'turn_end') {
          this.store.updateTaskStatus(taskId, 'done')
          const preview = fullText.slice(0, 80).replace(/\n/g, ' ')
          this.push.notifyAll('Claude finished', preview || 'Task complete', `/threads/${threadId}`)
        }
      },
    })

    pm.on('exit', () => {
      const task = this.store.getTask(taskId)
      // Only mark failed if turn_end never arrived (crash, kill, etc.)
      if (task?.status === 'running') {
        this.store.updateTaskStatus(taskId, 'failed')
        this.push.notifyAll('Claude task failed', 'Check the thread for details', `/threads/${threadId}`)
      }
    })
  }
}
