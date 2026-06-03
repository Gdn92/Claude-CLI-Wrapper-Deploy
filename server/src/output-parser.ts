import type {
  TurnEvent,
  ClaudeStreamEvent,
  ToolCallType,
} from './types'

// Matches all ANSI CSI escape sequences (color, cursor movement, etc.)
const ANSI_RE = /\x1b\[[0-9;]*[mGKHFJA-Z]/g

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

function toolLabel(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return `${name} ${input.file_path ?? ''}`
    case 'Bash':
      return `Bash: ${input.command ?? ''}`
    case 'Glob':
      return `Glob: ${input.pattern ?? ''}`
    case 'Grep':
      return `Grep: ${input.pattern ?? ''}`
    case 'LS':
      return `LS ${input.path ?? '.'}`
    default:
      return name
  }
}

function mapEvent(raw: ClaudeStreamEvent): TurnEvent[] {
  if (raw.type === 'system' && raw.subtype === 'init') {
    return [{ type: 'session_init', sessionId: raw.session_id, cwd: raw.cwd }]
  }

  if (raw.type === 'assistant') {
    const events: TurnEvent[] = []
    for (const content of raw.message.content) {
      if (content.type === 'text' && content.text) {
        events.push({ type: 'text', content: content.text })
      } else if (content.type === 'tool_use') {
        events.push({
          type: 'tool_call_start',
          id: content.id,
          toolType: content.name as ToolCallType,
          label: toolLabel(content.name, content.input),
          params: content.input,
        })
      }
    }
    return events
  }

  if (raw.type === 'tool_result') {
    return [{
      type: 'tool_call_end',
      id: raw.tool_use_id,
      status: raw.is_error ? 'error' : 'success',
      output: raw.content,
    }]
  }

  if (raw.type === 'result') {
    return [{
      type: 'turn_end',
      costUsd: raw.cost_usd,
      durationMs: raw.duration_ms,
    }]
  }

  return []
}

// Pure. Accepts raw string chunk from node-pty stdout.
// Returns all TurnEvents parsed from complete JSON lines.
// Non-JSON lines (ANSI, plain text) silently skipped.
export function parseLines(chunk: string): TurnEvent[] {
  const cleaned = stripAnsi(chunk).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = cleaned.split('\n').filter(l => l.trim().length > 0)
  const events: TurnEvent[] = []

  for (const line of lines) {
    try {
      const raw = JSON.parse(line) as ClaudeStreamEvent
      events.push(...mapEvent(raw))
    } catch {
      // not JSON - pty noise, skip
    }
  }

  return events
}
