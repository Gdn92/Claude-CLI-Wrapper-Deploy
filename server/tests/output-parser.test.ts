import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseLines } from '../src/output-parser'

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8').trim()

describe('parseLines', () => {
  it('emits session_init from system init event', () => {
    const events = parseLines(fixture('init-event.txt'))
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      type: 'session_init',
      sessionId: 'sess_abc123',
      cwd: '/Users/dev/myproject',
    })
  })

  it('emits text from assistant text content', () => {
    const events = parseLines(fixture('text-event.txt'))
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      type: 'text',
      content: "I'll read the file now.",
    })
  })

  it('emits tool_call_start for Read tool', () => {
    const events = parseLines(fixture('tool-read.txt'))
    expect(events).toHaveLength(1)
    const e = events[0] as any
    expect(e.type).toBe('tool_call_start')
    expect(e.toolType).toBe('Read')
    expect(e.id).toBe('toolu_01')
    expect(e.label).toBe('Read /Users/dev/myproject/src/index.ts')
    expect(e.params).toMatchObject({ file_path: '/Users/dev/myproject/src/index.ts' })
  })

  it('emits tool_call_start for Bash tool', () => {
    const events = parseLines(fixture('tool-bash.txt'))
    const e = events[0] as any
    expect(e.type).toBe('tool_call_start')
    expect(e.toolType).toBe('Bash')
    expect(e.label).toBe('Bash: npm test')
  })

  it('emits tool_call_start for Write tool', () => {
    const events = parseLines(fixture('tool-write.txt'))
    const e = events[0] as any
    expect(e.type).toBe('tool_call_start')
    expect(e.toolType).toBe('Write')
    expect(e.label).toBe('Write /Users/dev/myproject/src/new.ts')
  })

  it('emits tool_call_end from tool_result', () => {
    const events = parseLines(fixture('tool-result.txt'))
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      type: 'tool_call_end',
      id: 'toolu_01',
      status: 'success',
      output: 'export const x = 1\nexport const y = 2',
    })
  })

  it('emits tool_call_end with error status when is_error true', () => {
    const errLine = JSON.stringify({
      type: 'tool_result',
      tool_use_id: 'toolu_99',
      content: 'Permission denied',
      is_error: true,
    })
    const events = parseLines(errLine)
    const e = events[0] as any
    expect(e.status).toBe('error')
  })

  it('emits turn_end from result event', () => {
    const events = parseLines(fixture('turn-end.txt'))
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      type: 'turn_end',
      costUsd: 0.0031,
      durationMs: 4200,
    })
  })

  it('returns empty array for non-JSON lines (ANSI/plain text)', () => {
    const events = parseLines('\x1b[32msome colored output\x1b[0m')
    expect(events).toHaveLength(0)
  })

  it('handles multiple lines in one chunk', () => {
    const chunk = fixture('text-event.txt') + '\n' + fixture('turn-end.txt')
    const events = parseLines(chunk)
    expect(events).toHaveLength(2)
    expect(events[0].type).toBe('text')
    expect(events[1].type).toBe('turn_end')
  })

  it('strips ANSI escape codes before parsing', () => {
    const withAnsi = '\x1b[1m' + fixture('text-event.txt') + '\x1b[0m'
    const events = parseLines(withAnsi)
    expect(events[0].type).toBe('text')
  })

  it('handles \\r\\n line endings from pty', () => {
    const withCR = fixture('text-event.txt').replace('\n', '\r\n')
    const events = parseLines(withCR)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('text')
  })
})
