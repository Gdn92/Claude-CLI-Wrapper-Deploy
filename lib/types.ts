export type ToolCallType =
  | 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'LS' | 'Agent' | 'Task' | 'unknown'

export interface TextEvent { type: 'text'; content: string }
export interface ToolCallStartEvent {
  type: 'tool_call_start'
  id: string
  toolType: ToolCallType
  label: string
  params: Record<string, unknown>
}
export interface ToolCallEndEvent { type: 'tool_call_end'; id: string; status: 'success' | 'error'; output: string }
export interface TurnEndEvent { type: 'turn_end'; costUsd: number; durationMs: number }
export interface SessionInitEvent { type: 'session_init'; sessionId: string; cwd: string }
export interface ErrorEvent { type: 'error'; message: string }
export type TurnEvent = TextEvent | ToolCallStartEvent | ToolCallEndEvent | TurnEndEvent | SessionInitEvent | ErrorEvent

export interface Project { id: string; path: string; name: string; createdAt: number }
export interface Thread { id: string; projectId: string; title: string; createdAt: number; updatedAt: number }
export interface Message {
  id: string; threadId: string; role: 'user' | 'assistant'; type: string
  content: string; metadata: string; createdAt: number
}
