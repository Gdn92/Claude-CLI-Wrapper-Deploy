// Raw event shapes emitted by `claude --output-format stream-json` (newline-delimited JSON)

export interface ClaudeInitEvent {
  type: 'system'
  subtype: 'init'
  session_id: string
  cwd: string
  tools: string[]
}

export interface ClaudeTextContent {
  type: 'text'
  text: string
}

export interface ClaudeToolUseContent {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ClaudeAssistantEvent {
  type: 'assistant'
  message: {
    content: Array<ClaudeTextContent | ClaudeToolUseContent>
  }
}

export interface ClaudeToolResultEvent {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error: boolean
}

export interface ClaudeResultEvent {
  type: 'result'
  subtype: 'success' | 'error'
  cost_usd: number
  duration_ms: number
  session_id: string
  total_cost_usd: number
}

export type ClaudeStreamEvent =
  | ClaudeInitEvent
  | ClaudeAssistantEvent
  | ClaudeToolResultEvent
  | ClaudeResultEvent

// Internal event types sent over WebSocket to the browser

export type ToolCallType =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'LS'
  | 'Agent'
  | 'Task'
  | 'unknown'

export interface TextEvent {
  type: 'text'
  content: string
}

export interface ToolCallStartEvent {
  type: 'tool_call_start'
  id: string
  toolType: ToolCallType
  label: string
  params: Record<string, unknown>
}

export interface ToolCallEndEvent {
  type: 'tool_call_end'
  id: string
  status: 'success' | 'error'
  output: string
}

export interface TurnEndEvent {
  type: 'turn_end'
  costUsd: number
  durationMs: number
}

export interface SessionInitEvent {
  type: 'session_init'
  sessionId: string
  cwd: string
}

export interface ErrorEvent {
  type: 'error'
  message: string
}

export type TurnEvent =
  | TextEvent
  | ToolCallStartEvent
  | ToolCallEndEvent
  | TurnEndEvent
  | SessionInitEvent
  | ErrorEvent

// ThreadStore persistence types

export interface Project {
  id: string
  path: string
  name: string
  createdAt: number
}

export interface Thread {
  id: string
  projectId: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  threadId: string
  role: 'user' | 'assistant'
  type: 'text' | 'tool_call_start' | 'tool_call_end' | 'turn_end'
  content: string
  metadata: string // JSON-encoded metadata blob
  createdAt: number
}

// DiffService types

export interface DiffHunk {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}

export interface DiffFile {
  oldPath: string
  newPath: string
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

export interface DiffMetadata {
  branch: string
  files: DiffFile[]
  totalAdditions: number
  totalDeletions: number
}

// WebSocket message protocol (browser -> server / server -> browser)

export interface WsClientMessage {
  action: 'send' | 'cancel' | 'diff_request' | 'team_join' | 'team_forward' | 'team_pipe'
  payload: Record<string, unknown>
}

export interface WsServerMessage {
  event: TurnEvent
  threadId?: string
  sessionId?: string
}

// Task queue (async execution, survives tab close)

export interface Task {
  id: string
  threadId: string
  projectPath: string
  content: string
  status: 'pending' | 'running' | 'done' | 'failed'
  createdAt: number
  updatedAt: number
}
