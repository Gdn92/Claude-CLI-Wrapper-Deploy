import { describe, it, expect, afterEach } from 'vitest'
import { ProcessManager } from '../src/process-manager'
import type { TurnEvent } from '../src/types'

const managers: ProcessManager[] = []

afterEach(() => {
  managers.forEach(m => m.kill())
  managers.length = 0
})

describe('ProcessManager', () => {
  it('spawns a process and emits events via callback', async () => {
    const events: TurnEvent[] = []
    // echo a valid stream-json result line — ProcessManager should parse and emit turn_end
    const pm = new ProcessManager({
      command: 'echo',
      args: ['{"type":"result","subtype":"success","cost_usd":0,"duration_ms":100,"session_id":"x","total_cost_usd":0}'],
      cwd: process.cwd(),
      onEvent: (e) => events.push(e),
    })
    managers.push(pm)

    await new Promise<void>((resolve) => {
      pm.on('exit', resolve)
      setTimeout(resolve, 3000)
    })

    expect(events.some(e => e.type === 'turn_end')).toBe(true)
  })

  it('kill() terminates the process', async () => {
    const pm = new ProcessManager({
      command: 'sleep',
      args: ['60'],
      cwd: process.cwd(),
      onEvent: () => {},
    })
    managers.push(pm)
    expect(pm.isAlive()).toBe(true)
    pm.kill()
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(pm.isAlive()).toBe(false)
  })

  it('write() sends data to process stdin without crash', async () => {
    // cat echoes stdin back — non-JSON so no TurnEvents, but process shouldn't crash
    const pm = new ProcessManager({
      command: 'cat',
      args: [],
      cwd: process.cwd(),
      onEvent: () => {},
    })
    managers.push(pm)
    pm.write('hello\n')
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(pm.isAlive()).toBe(true)
    pm.kill()
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(pm.isAlive()).toBe(false)
  })
})
