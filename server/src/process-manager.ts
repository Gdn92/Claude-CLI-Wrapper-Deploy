import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { parseLines } from './output-parser'
import type { TurnEvent } from './types'

interface ProcessManagerOptions {
  command: string
  args: string[]
  cwd: string
  onEvent: (event: TurnEvent) => void
}

export class ProcessManager extends EventEmitter {
  private ptyProcess: pty.IPty | null = null
  private alive = false

  constructor(private opts: ProcessManagerOptions) {
    super()
    this.spawn()
  }

  private spawn() {
    this.ptyProcess = pty.spawn(this.opts.command, this.opts.args, {
      name: 'xterm-color',
      cwd: this.opts.cwd,
      env: { ...process.env } as Record<string, string>,
      // Wide terminal so long JSON lines don't get wrapped and broken
      cols: 220,
      rows: 50,
    })
    this.alive = true

    this.ptyProcess.onData((data: string) => {
      const events = parseLines(data)
      for (const event of events) {
        this.opts.onEvent(event)
      }
    })

    this.ptyProcess.onExit(() => {
      this.alive = false
      this.emit('exit')
    })
  }

  write(data: string) {
    if (this.alive && this.ptyProcess) {
      this.ptyProcess.write(data)
    }
  }

  kill() {
    if (this.alive && this.ptyProcess) {
      this.ptyProcess.kill()
      this.alive = false
    }
  }

  isAlive(): boolean {
    return this.alive
  }
}
