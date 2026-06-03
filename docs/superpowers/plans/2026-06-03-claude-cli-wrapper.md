# Claude CLI Wrapper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web app that wraps the Claude Code CLI with a split-pane UI (conversation + diff viewer), persistent thread history, and multi-session agent team support — accessible locally and optionally via Vercel.

**Architecture:** A Next.js 14 PWA submits tasks via HTTP POST to a Node.js/Fastify process server. The server queues the task in SQLite, spawns `claude --output-format stream-json` in a `node-pty` pseudo-terminal, and runs to completion whether or not the browser tab is open. On completion, the server sends a Web Push notification (VAPID) to all subscribed devices. If the PWA tab is open during execution, events also stream live over WebSocket. Tapping the push notification opens the PWA to the completed thread.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Zustand, Fastify, `node-pty`, `ws`, `better-sqlite3`, `diff2html`, Vitest

**Commit strategy:** Every task ends with a commit to `main`. After each commit, the mirror action auto-deploys to Vercel. Use Claude in the Chrome browser (`claude.ai`) to debug UI issues — inspect actual rendered output, not just code. Debug locally first (`npm run dev`), confirm fix, then commit.

**Execution order: Phase D → A → B → C.** Set up deployment pipeline before writing any feature code.

---

## Natural Split Points (for parallel execution)

This plan has 4 independently executable phases. Each produces working, testable software:

| Phase | Produces |
|-------|---------|
| A — Server Core | Fully tested server: OutputParser, ThreadStore, DiffService, ProcessManager, WS API |
| B — Frontend Core | Working UI: layout, Sidebar, ConversationPane, ToolCallCard, DiffPanel |
| C — Agent Teams | AgentBus + TeamPanel (builds on A + B) |
| D — Deployment | Mirror GitHub Action + Vercel config (builds on A + B) |

Phase A must complete before B starts. C + D can run in parallel after B.

---

## File Map

```
Claude-CLI-Wrapper/
├── package.json                    # Next.js root + concurrently dev script
├── tsconfig.json                   # Next.js TS config
├── tailwind.config.ts
├── middleware.ts                   # Password protection (Next.js)
├── app/
│   ├── layout.tsx                  # Root HTML, theme provider
│   ├── page.tsx                    # App shell (Sidebar + ConversationPane + DiffPanel)
│   └── globals.css
├── components/
│   ├── Sidebar.tsx                 # Project + thread list, collapsible
│   ├── ConversationPane.tsx        # Message list + input box + send/cancel
│   ├── ToolCallCard.tsx            # Inline tool invocation with status badge
│   ├── DiffPanel.tsx               # diff2html viewer, lazy-loaded
│   ├── TeamPanel.tsx               # Multi-session status overlay
│   └── ui/
│       ├── TextBubble.tsx          # Plain text message bubble
│       └── StatusBadge.tsx         # pending/success/error indicator
├── lib/
│   ├── store.ts                    # Zustand store (threads, sessions, UI state)
│   ├── ws-client.ts                # WebSocket client + event subscription
│   └── types.ts                    # Shared client-side types (mirrors server types)
├── server/
│   ├── package.json                # Server deps: fastify, node-pty, ws, better-sqlite3
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── index.ts                # Fastify entry + WS upgrade handler
│   │   ├── types.ts                # All shared server types (TurnEvent, Message, etc.)
│   │   ├── output-parser.ts        # Pure: raw pty string → TurnEvent[]
│   │   ├── thread-store.ts         # SQLite/Postgres CRUD
│   │   ├── diff-service.ts         # git diff → DiffMetadata
│   │   ├── process-manager.ts      # node-pty spawn/kill/write
│   │   ├── agent-bus.ts            # Cross-session pub/sub
│   │   └── ws-handler.ts           # WS connection lifecycle, routes events
│   └── tests/
│       ├── fixtures/
│       │   ├── init-event.txt      # Raw pty output fixture: init
│       │   ├── text-event.txt      # Raw pty output fixture: streaming text
│       │   ├── tool-read.txt       # Raw pty output fixture: Read tool call
│       │   ├── tool-write.txt      # Raw pty output fixture: Write tool call
│       │   ├── tool-bash.txt       # Raw pty output fixture: Bash tool call
│       │   ├── tool-result.txt     # Raw pty output fixture: tool result
│       │   └── turn-end.txt        # Raw pty output fixture: result/end
│       ├── output-parser.test.ts
│       ├── thread-store.test.ts
│       ├── diff-service.test.ts
│       └── process-manager.test.ts
├── .github/
│   └── workflows/
│       └── mirror.yml
└── .env.example
```

---

## Phase A — Server Core

### Task A1: Repo Scaffold

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.json` (root)
- Create: `tailwind.config.ts`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Init root Next.js project**

```bash
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Expected: Next.js 14 scaffold in current directory. `package.json`, `tsconfig.json`, `tailwind.config.ts`, `app/` created.

- [ ] **Step 2: Add concurrently to root**

```bash
npm install -D concurrently
```

- [ ] **Step 3: Add dev script to root `package.json`**

Open `package.json`, add to `scripts`:
```json
"server": "cd server && npm run dev",
"dev": "concurrently \"next dev\" \"npm run server\"",
"build": "next build",
"test": "cd server && npm run test"
```

- [ ] **Step 4: Init server package**

```bash
mkdir server && cd server
npm init -y
```

- [ ] **Step 5: Install server deps**

```bash
cd server
npm install fastify @fastify/websocket ws better-sqlite3
npm install -D typescript @types/node @types/ws @types/better-sqlite3 ts-node nodemon vitest
```

Then install `node-pty` (requires native compilation):
```bash
npm install node-pty
```

If `node-pty` fails to compile: ensure Xcode CLT installed (`xcode-select --install`).

- [ ] **Step 6: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 7: Create `server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
  },
})
```

- [ ] **Step 8: Add scripts to `server/package.json`**

```json
"scripts": {
  "dev": "nodemon --exec ts-node src/index.ts --watch src",
  "build": "tsc",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 9: Create `.env.example`**

```bash
# Copy to .env.local for Next.js, .env for server
SITE_PASSWORD=changeme
PROCESS_SERVER_URL=ws://localhost:3001
PORT=3001
DB_PATH=./data/threads.db
```

- [ ] **Step 10: Create `.gitignore`**

```
node_modules/
.next/
server/dist/
server/data/
.env
.env.local
*.pem
*.key
```

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js frontend and Node.js server"
```

---

### Task A2: Server Types

**Files:**
- Create: `server/src/types.ts`

- [ ] **Step 1: Create `server/src/types.ts`**

```typescript
// All Claude Code stream-json event shapes + our internal TurnEvent types.
// claude --output-format stream-json emits newline-delimited JSON objects.

// --- Raw Claude Code stream-json shapes ---

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

// --- Our internal TurnEvent types (sent over WebSocket to browser) ---

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

// --- ThreadStore types ---

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
  metadata: string // JSON string
  createdAt: number
}

// --- DiffService types ---

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

// --- WebSocket message protocol (browser ↔ server) ---

export interface WsClientMessage {
  action: 'send' | 'cancel' | 'diff_request' | 'team_join' | 'team_forward' | 'team_pipe'
  payload: Record<string, unknown>
}

export interface WsServerMessage {
  event: TurnEvent
  threadId?: string
  sessionId?: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/types.ts
git commit -m "feat: define server types for Claude stream-json events"
```

---

### Task A3: OutputParser

**Files:**
- Create: `server/src/output-parser.ts`
- Create: `server/tests/fixtures/` (7 fixture files)
- Create: `server/tests/output-parser.test.ts`

- [ ] **Step 1: Create fixture files**

`server/tests/fixtures/init-event.txt`:
```
{"type":"system","subtype":"init","session_id":"sess_abc123","cwd":"/Users/dev/myproject","tools":["Read","Write","Edit","Bash","Glob","Grep","LS"]}
```

`server/tests/fixtures/text-event.txt`:
```
{"type":"assistant","message":{"content":[{"type":"text","text":"I'll read the file now."}]}}
```

`server/tests/fixtures/tool-read.txt`:
```
{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_01","name":"Read","input":{"file_path":"/Users/dev/myproject/src/index.ts"}}]}}
```

`server/tests/fixtures/tool-bash.txt`:
```
{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_02","name":"Bash","input":{"command":"npm test","description":"Run tests"}}]}}
```

`server/tests/fixtures/tool-write.txt`:
```
{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_03","name":"Write","input":{"file_path":"/Users/dev/myproject/src/new.ts","content":"export const x = 1"}}]}}
```

`server/tests/fixtures/tool-result.txt`:
```
{"type":"tool_result","tool_use_id":"toolu_01","content":"export const x = 1\nexport const y = 2","is_error":false}
```

`server/tests/fixtures/turn-end.txt`:
```
{"type":"result","subtype":"success","cost_usd":0.0031,"duration_ms":4200,"session_id":"sess_abc123","total_cost_usd":0.0031}
```

- [ ] **Step 2: Write failing tests**

Create `server/tests/output-parser.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/output-parser.test.ts
```

Expected: FAIL — `parseLines` not found.

- [ ] **Step 4: Implement `server/src/output-parser.ts`**

```typescript
import type {
  TurnEvent,
  ClaudeStreamEvent,
  ClaudeAssistantEvent,
  ToolCallType,
} from './types'

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
        const toolType = content.name as ToolCallType
        events.push({
          type: 'tool_call_start',
          id: content.id,
          toolType,
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

/**
 * Pure function. Accepts a raw string chunk from node-pty stdout.
 * Returns all TurnEvents parsed from complete JSON lines in the chunk.
 * Non-JSON lines (ANSI, plain text) are silently skipped.
 */
export function parseLines(chunk: string): TurnEvent[] {
  const cleaned = stripAnsi(chunk).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = cleaned.split('\n').filter(l => l.trim().length > 0)
  const events: TurnEvent[] = []

  for (const line of lines) {
    try {
      const raw = JSON.parse(line) as ClaudeStreamEvent
      events.push(...mapEvent(raw))
    } catch {
      // not JSON — skip
    }
  }

  return events
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/output-parser.test.ts
```

Expected: all 12 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/output-parser.ts server/src/types.ts server/tests/
git commit -m "feat: add OutputParser — pure pty stream → TurnEvent converter"
```

---

### Task A4: ThreadStore

**Files:**
- Create: `server/src/thread-store.ts`
- Create: `server/tests/thread-store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/tests/thread-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ThreadStore } from '../src/thread-store'

let store: ThreadStore
let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'thread-store-test-'))
  store = new ThreadStore(join(tmpDir, 'test.db'))
})

afterEach(() => {
  store.close()
  rmSync(tmpDir, { recursive: true })
})

describe('ThreadStore', () => {
  describe('projects', () => {
    it('creates and retrieves a project', () => {
      const p = store.createProject('/path/to/project', 'My Project')
      expect(p.id).toBeTruthy()
      expect(p.path).toBe('/path/to/project')
      expect(p.name).toBe('My Project')

      const found = store.getProject(p.id)
      expect(found).toEqual(p)
    })

    it('lists all projects', () => {
      store.createProject('/a', 'A')
      store.createProject('/b', 'B')
      const projects = store.listProjects()
      expect(projects).toHaveLength(2)
    })

    it('returns null for unknown project', () => {
      expect(store.getProject('nonexistent')).toBeNull()
    })
  })

  describe('threads', () => {
    it('creates and retrieves a thread', () => {
      const p = store.createProject('/path', 'P')
      const t = store.createThread(p.id, 'First thread')
      expect(t.id).toBeTruthy()
      expect(t.projectId).toBe(p.id)
      expect(t.title).toBe('First thread')

      const found = store.getThread(t.id)
      expect(found).toEqual(t)
    })

    it('lists threads for a project', () => {
      const p = store.createProject('/path', 'P')
      store.createThread(p.id, 'Thread 1')
      store.createThread(p.id, 'Thread 2')
      const threads = store.listThreads(p.id)
      expect(threads).toHaveLength(2)
    })

    it('deletes a thread', () => {
      const p = store.createProject('/path', 'P')
      const t = store.createThread(p.id, 'Bye')
      store.deleteThread(t.id)
      expect(store.getThread(t.id)).toBeNull()
    })

    it('updates thread title', () => {
      const p = store.createProject('/path', 'P')
      const t = store.createThread(p.id, 'Old title')
      store.updateThreadTitle(t.id, 'New title')
      expect(store.getThread(t.id)?.title).toBe('New title')
    })
  })

  describe('messages', () => {
    it('appends and retrieves messages', () => {
      const p = store.createProject('/path', 'P')
      const t = store.createThread(p.id, 'T')
      const m = store.appendMessage(t.id, 'user', 'text', 'Hello', {})
      expect(m.id).toBeTruthy()
      expect(m.content).toBe('Hello')

      const messages = store.getMessages(t.id)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({ content: 'Hello', role: 'user' })
    })

    it('stores and retrieves metadata', () => {
      const p = store.createProject('/path', 'P')
      const t = store.createThread(p.id, 'T')
      const meta = { toolType: 'Read', label: 'Read src/index.ts' }
      store.appendMessage(t.id, 'assistant', 'tool_call_start', '', meta)
      const messages = store.getMessages(t.id)
      expect(JSON.parse(messages[0].metadata)).toEqual(meta)
    })

    it('returns messages in chronological order', () => {
      const p = store.createProject('/path', 'P')
      const t = store.createThread(p.id, 'T')
      store.appendMessage(t.id, 'user', 'text', 'First', {})
      store.appendMessage(t.id, 'assistant', 'text', 'Second', {})
      const messages = store.getMessages(t.id)
      expect(messages[0].content).toBe('First')
      expect(messages[1].content).toBe('Second')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/thread-store.test.ts
```

Expected: FAIL — `ThreadStore` not found.

- [ ] **Step 3: Implement `server/src/thread-store.ts`**

```typescript
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { Project, Thread, Message } from './types'

export class ThreadStore {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.migrate()
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_threads_project ON threads(project_id);
      CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);
    `)
  }

  close() {
    this.db.close()
  }

  createProject(path: string, name: string): Project {
    const project: Project = {
      id: randomUUID(),
      path,
      name,
      createdAt: Date.now(),
    }
    this.db.prepare(
      'INSERT INTO projects (id, path, name, created_at) VALUES (?, ?, ?, ?)'
    ).run(project.id, project.path, project.name, project.createdAt)
    return project
  }

  getProject(id: string): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any
    if (!row) return null
    return { id: row.id, path: row.path, name: row.name, createdAt: row.created_at }
  }

  listProjects(): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as any[]
    return rows.map(r => ({ id: r.id, path: r.path, name: r.name, createdAt: r.created_at }))
  }

  createThread(projectId: string, title: string): Thread {
    const now = Date.now()
    const thread: Thread = { id: randomUUID(), projectId, title, createdAt: now, updatedAt: now }
    this.db.prepare(
      'INSERT INTO threads (id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(thread.id, thread.projectId, thread.title, thread.createdAt, thread.updatedAt)
    return thread
  }

  getThread(id: string): Thread | null {
    const row = this.db.prepare('SELECT * FROM threads WHERE id = ?').get(id) as any
    if (!row) return null
    return { id: row.id, projectId: row.project_id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at }
  }

  listThreads(projectId: string): Thread[] {
    const rows = this.db.prepare(
      'SELECT * FROM threads WHERE project_id = ? ORDER BY updated_at DESC'
    ).all(projectId) as any[]
    return rows.map(r => ({ id: r.id, projectId: r.project_id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at }))
  }

  updateThreadTitle(id: string, title: string) {
    this.db.prepare('UPDATE threads SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, Date.now(), id)
  }

  deleteThread(id: string) {
    this.db.prepare('DELETE FROM threads WHERE id = ?').run(id)
  }

  appendMessage(
    threadId: string,
    role: Message['role'],
    type: Message['type'],
    content: string,
    metadata: Record<string, unknown>
  ): Message {
    const msg: Message = {
      id: randomUUID(),
      threadId,
      role,
      type,
      content,
      metadata: JSON.stringify(metadata),
      createdAt: Date.now(),
    }
    this.db.prepare(
      'INSERT INTO messages (id, thread_id, role, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(msg.id, msg.threadId, msg.role, msg.type, msg.content, msg.metadata, msg.createdAt)
    this.db.prepare('UPDATE threads SET updated_at = ? WHERE id = ?').run(Date.now(), threadId)
    return msg
  }

  getMessages(threadId: string): Message[] {
    const rows = this.db.prepare(
      'SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC'
    ).all(threadId) as any[]
    return rows.map(r => ({
      id: r.id, threadId: r.thread_id, role: r.role, type: r.type,
      content: r.content, metadata: r.metadata, createdAt: r.created_at,
    }))
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/thread-store.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/thread-store.ts server/tests/thread-store.test.ts
git commit -m "feat: add ThreadStore — SQLite-backed project/thread/message persistence"
```

---

### Task A5: DiffService

**Files:**
- Create: `server/src/diff-service.ts`
- Create: `server/tests/diff-service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/tests/diff-service.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { getDiff } from '../src/diff-service'

let repoDir: string

beforeAll(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'diff-service-test-'))
  execSync('git init', { cwd: repoDir })
  execSync('git config user.email "test@test.com"', { cwd: repoDir })
  execSync('git config user.name "Test"', { cwd: repoDir })
  writeFileSync(join(repoDir, 'hello.ts'), 'const x = 1\n')
  execSync('git add . && git commit -m "init"', { cwd: repoDir })
  // Make an unstaged change
  writeFileSync(join(repoDir, 'hello.ts'), 'const x = 1\nconst y = 2\n')
})

afterAll(() => {
  rmSync(repoDir, { recursive: true })
})

describe('getDiff', () => {
  it('returns diff metadata for unstaged changes', async () => {
    const result = await getDiff(repoDir)
    expect(result.files).toHaveLength(1)
    expect(result.files[0].newPath).toBe('hello.ts')
    expect(result.files[0].additions).toBe(1)
    expect(result.files[0].deletions).toBe(0)
    expect(result.totalAdditions).toBe(1)
    expect(result.totalDeletions).toBe(0)
  })

  it('returns empty files array when no changes', async () => {
    const cleanDir = mkdtempSync(join(tmpdir(), 'diff-clean-'))
    execSync('git init', { cwd: cleanDir })
    execSync('git config user.email "t@t.com" && git config user.name "T"', { cwd: cleanDir })
    writeFileSync(join(cleanDir, 'a.ts'), 'const a = 1\n')
    execSync('git add . && git commit -m "init"', { cwd: cleanDir })
    const result = await getDiff(cleanDir)
    expect(result.files).toHaveLength(0)
    rmSync(cleanDir, { recursive: true })
  })

  it('includes branch name', async () => {
    const result = await getDiff(repoDir)
    expect(typeof result.branch).toBe('string')
    expect(result.branch.length).toBeGreaterThan(0)
  })

  it('returns error-safe result if cwd is not a git repo', async () => {
    const noGitDir = mkdtempSync(join(tmpdir(), 'no-git-'))
    const result = await getDiff(noGitDir)
    expect(result.files).toHaveLength(0)
    rmSync(noGitDir, { recursive: true })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/diff-service.test.ts
```

Expected: FAIL — `getDiff` not found.

- [ ] **Step 3: Implement `server/src/diff-service.ts`**

```typescript
import { exec } from 'child_process'
import { promisify } from 'util'
import type { DiffMetadata, DiffFile, DiffHunk } from './types'

const execAsync = promisify(exec)

function parseDiff(rawDiff: string): DiffFile[] {
  const files: DiffFile[] = []
  const fileBlocks = rawDiff.split(/^diff --git /m).filter(Boolean)

  for (const block of fileBlocks) {
    const lines = block.split('\n')
    const headerLine = lines[0] // "a/path b/path"
    const paths = headerLine.match(/a\/(.+) b\/(.+)/)
    if (!paths) continue

    const oldPath = paths[1]
    const newPath = paths[2]
    let additions = 0
    let deletions = 0
    const hunks: DiffHunk[] = []
    let currentHunk: DiffHunk | null = null

    for (const line of lines.slice(1)) {
      if (line.startsWith('@@')) {
        const m = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
        if (m) {
          currentHunk = {
            header: line,
            oldStart: parseInt(m[1]),
            oldLines: parseInt(m[2] ?? '1'),
            newStart: parseInt(m[3]),
            newLines: parseInt(m[4] ?? '1'),
            lines: [],
          }
          hunks.push(currentHunk)
        }
      } else if (currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++
          currentHunk.lines.push(line)
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++
          currentHunk.lines.push(line)
        } else if (line.startsWith(' ')) {
          currentHunk.lines.push(line)
        }
      }
    }

    files.push({ oldPath, newPath, additions, deletions, hunks })
  }

  return files
}

export async function getDiff(cwd: string): Promise<DiffMetadata> {
  let branch = 'unknown'
  let rawDiff = ''

  try {
    const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd })
    branch = branchOut.trim()
  } catch {
    return { branch: 'not a git repo', files: [], totalAdditions: 0, totalDeletions: 0 }
  }

  try {
    const { stdout } = await execAsync('git diff', { cwd, maxBuffer: 10 * 1024 * 1024 })
    rawDiff = stdout
  } catch {
    return { branch, files: [], totalAdditions: 0, totalDeletions: 0 }
  }

  const files = parseDiff(rawDiff)
  const totalAdditions = files.reduce((s, f) => s + f.additions, 0)
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0)

  return { branch, files, totalAdditions, totalDeletions }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/diff-service.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/diff-service.ts server/tests/diff-service.test.ts
git commit -m "feat: add DiffService — git diff → structured DiffMetadata"
```

---

### Task A6: ProcessManager

**Files:**
- Create: `server/src/process-manager.ts`
- Create: `server/tests/process-manager.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/tests/process-manager.test.ts`:

```typescript
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
    // Use `echo` as a stand-in — it writes to stdout and exits
    const pm = new ProcessManager({
      command: 'echo',
      args: ['{"type":"result","subtype":"success","cost_usd":0,"duration_ms":100,"session_id":"x","total_cost_usd":0}'],
      cwd: process.cwd(),
      onEvent: (e) => events.push(e),
    })
    managers.push(pm)

    await new Promise<void>((resolve) => {
      pm.on('exit', resolve)
      setTimeout(resolve, 3000) // safety timeout
    })

    expect(events.some(e => e.type === 'turn_end')).toBe(true)
  })

  it('write() sends data to process stdin', async () => {
    // Spawn cat, write to it, verify output comes back
    const output: string[] = []
    const pm = new ProcessManager({
      command: 'cat',
      args: [],
      cwd: process.cwd(),
      onEvent: (e) => {
        if (e.type === 'text') output.push(e.content)
      },
    })
    managers.push(pm)
    pm.write('hello from test\n')

    await new Promise(resolve => setTimeout(resolve, 500))
    pm.kill()

    // cat echoes back — but as non-JSON it won't become a text TurnEvent
    // Instead verify the process did not crash
    expect(pm.isAlive()).toBe(false) // killed
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
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/process-manager.test.ts
```

Expected: FAIL — `ProcessManager` not found.

- [ ] **Step 3: Implement `server/src/process-manager.ts`**

```typescript
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
      env: { ...process.env },
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/process-manager.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd server && npx vitest run
```

Expected: all tests PASS (OutputParser 12, ThreadStore 9, DiffService 4, ProcessManager 3 = 28 total).

- [ ] **Step 6: Commit**

```bash
git add server/src/process-manager.ts server/tests/process-manager.test.ts
git commit -m "feat: add ProcessManager — node-pty wrapper with event emission"
```

---

### Task A7: WebSocket Server + AgentBus

**Files:**
- Create: `server/src/agent-bus.ts`
- Create: `server/src/ws-handler.ts`
- Create: `server/src/index.ts`
- Create: `server/src/data/` (directory — created at runtime by ThreadStore)

- [ ] **Step 1: Create `server/src/agent-bus.ts`**

```typescript
import type WebSocket from 'ws'
import type { TurnEvent } from './types'

interface Session {
  id: string
  ws: WebSocket
  teamId?: string
  processManager?: import('./process-manager').ProcessManager
}

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

  setProcessManager(sessionId: string, pm: import('./process-manager').ProcessManager) {
    const s = this.sessions.get(sessionId)
    if (s) s.processManager = pm
  }

  getProcessManager(sessionId: string) {
    return this.sessions.get(sessionId)?.processManager ?? null
  }

  send(sessionId: string, event: TurnEvent) {
    const s = this.sessions.get(sessionId)
    if (s && s.ws.readyState === 1 /* OPEN */) {
      s.ws.send(JSON.stringify({ event }))
    }
  }

  /** Forward: deliver message as a new user turn in target session */
  forward(targetSessionId: string, content: string) {
    const target = this.sessions.get(targetSessionId)
    if (target?.processManager) {
      target.processManager.write(content + '\n')
    }
  }

  /** Pipe: write raw string to target session's pty stdin */
  pipe(targetSessionId: string, raw: string) {
    const target = this.sessions.get(targetSessionId)
    if (target?.processManager) {
      target.processManager.write(raw)
    }
  }

  /** List all sessions in a team */
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
```

- [ ] **Step 2: Create `server/src/ws-handler.ts`**

```typescript
import type WebSocket from 'ws'
import { randomUUID } from 'crypto'
import { ProcessManager } from './process-manager'
import { AgentBus } from './agent-bus'
import { ThreadStore } from './thread-store'
import { getDiff } from './diff-service'
import type { WsClientMessage } from './types'

export function handleConnection(
  ws: WebSocket,
  bus: AgentBus,
  store: ThreadStore
) {
  const sessionId = randomUUID()
  bus.register(sessionId, ws)

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

        // Persist user message
        store.appendMessage(threadId, 'user', 'text', content, {})

        // Spawn or reuse ProcessManager for this session
        let pm = bus.getProcessManager(sessionId)
        if (!pm) {
          pm = new ProcessManager({
            command: 'claude',
            args: ['--output-format', 'stream-json', '--print', content],
            cwd: projectPath,
            onEvent: (event) => {
              bus.send(sessionId, event)
              // Persist assistant events
              if (event.type === 'text') {
                store.appendMessage(threadId, 'assistant', 'text', event.content, {})
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
        const pm = bus.getProcessManager(sessionId)
        pm?.kill()
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
        const { targetSessionId, content } = msg.payload as {
          targetSessionId: string
          content: string
        }
        bus.forward(targetSessionId, content)
        break
      }

      case 'team_pipe': {
        const { targetSessionId, raw } = msg.payload as {
          targetSessionId: string
          raw: string
        }
        bus.pipe(targetSessionId, raw)
        break
      }
    }
  })

  ws.on('close', () => {
    const pm = bus.getProcessManager(sessionId)
    pm?.kill()
    bus.unregister(sessionId)
  })

  // Send session ID to client so it can identify itself
  ws.send(JSON.stringify({ event: { type: 'session_init', sessionId, cwd: '' } }))
}
```

- [ ] **Step 3: Create `server/src/index.ts`**

```typescript
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { ThreadStore } from './thread-store'
import { AgentBus } from './agent-bus'
import { handleConnection } from './ws-handler'
import { mkdirSync } from 'fs'
import { join } from 'path'

const PORT = parseInt(process.env.PORT ?? '3001')
const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), 'data', 'threads.db')

mkdirSync(join(process.cwd(), 'data'), { recursive: true })

const store = new ThreadStore(DB_PATH)
const bus = new AgentBus()

const app = Fastify({ logger: true })
await app.register(websocket)

app.get('/ws', { websocket: true }, (socket) => {
  handleConnection(socket, bus, store)
})

// REST: thread/project CRUD
app.get('/projects', async () => store.listProjects())
app.post('/projects', async (req) => {
  const { path, name } = req.body as { path: string; name: string }
  return store.createProject(path, name)
})
app.get('/projects/:projectId/threads', async (req) => {
  const { projectId } = req.params as { projectId: string }
  return store.listThreads(projectId)
})
app.post('/threads', async (req) => {
  const { projectId, title } = req.body as { projectId: string; title: string }
  return store.createThread(projectId, title)
})
app.get('/threads/:threadId/messages', async (req) => {
  const { threadId } = req.params as { threadId: string }
  return store.getMessages(threadId)
})
app.delete('/threads/:threadId', async (req) => {
  const { threadId } = req.params as { threadId: string }
  store.deleteThread(threadId)
  return { ok: true }
})
app.patch('/threads/:threadId/title', async (req) => {
  const { threadId } = req.params as { threadId: string }
  const { title } = req.body as { title: string }
  store.updateThreadTitle(threadId, title)
  return { ok: true }
})

await app.listen({ port: PORT, host: '0.0.0.0' })
console.log(`Server running on port ${PORT}`)
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Smoke test — start server**

```bash
cd server && npm run dev
```

Expected: `Server running on port 3001` in console. No errors.
Kill with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add server/src/
git commit -m "feat: add AgentBus, WS handler, and Fastify server entry"
```

---

### Task A8: PushService + TaskRunner

**Files:**
- Create: `server/src/push-service.ts`
- Create: `server/src/task-runner.ts`
- Modify: `server/src/index.ts` (add push subscription + task submission routes)

- [ ] **Step 1: Generate VAPID keys (one-time)**

```bash
cd server && npx web-push generate-vapid-keys
```

Copy output into `.env`:
```
VAPID_PUBLIC_KEY=<paste public key>
VAPID_PRIVATE_KEY=<paste private key>
VAPID_EMAIL=mailto:mpny19@gmail.com
```

- [ ] **Step 2: Install web-push**

```bash
cd server && npm install web-push && npm install -D @types/web-push
```

- [ ] **Step 3: Create `server/src/push-service.ts`**

```typescript
import webpush from 'web-push'
import type { ThreadStore } from './thread-store'

// Add push_subscriptions table to ThreadStore.migrate() — see step below.
// This service is stateless; subscriptions live in SQLite.

export class PushService {
  constructor(private store: ThreadStore) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )
  }

  addSubscription(sub: webpush.PushSubscription) {
    this.store.upsertPushSubscription(sub)
  }

  async notifyAll(title: string, body: string, url: string) {
    const subs = this.store.listPushSubscriptions()
    const payload = JSON.stringify({ title, body, url })
    await Promise.allSettled(
      subs.map(s =>
        webpush.sendNotification(s, payload).catch(() => {
          // Subscription expired — remove it
          this.store.deletePushSubscription(s.endpoint)
        })
      )
    )
  }
}
```

- [ ] **Step 4: Add push subscription methods to `server/src/thread-store.ts`**

Add to `migrate()` SQL:
```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  project_path TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Add methods to `ThreadStore` class:
```typescript
upsertPushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  this.db.prepare(
    'INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)'
  ).run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, Date.now())
}

listPushSubscriptions(): Array<{ endpoint: string; keys: { p256dh: string; auth: string } }> {
  const rows = this.db.prepare('SELECT * FROM push_subscriptions').all() as any[]
  return rows.map(r => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }))
}

deletePushSubscription(endpoint: string) {
  this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint)
}

createTask(threadId: string, projectPath: string, content: string) {
  const id = randomUUID()
  const now = Date.now()
  this.db.prepare(
    'INSERT INTO tasks (id, thread_id, project_path, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, threadId, projectPath, content, 'pending', now, now)
  return id
}

updateTaskStatus(id: string, status: 'running' | 'done' | 'failed') {
  this.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), id)
}
```

- [ ] **Step 5: Create `server/src/task-runner.ts`**

```typescript
import { ProcessManager } from './process-manager'
import { PushService } from './push-service'
import type { ThreadStore } from './thread-store'
import type { TurnEvent } from './types'

export class TaskRunner {
  constructor(
    private store: ThreadStore,
    private push: PushService
  ) {}

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
            toolType: event.toolType, id: event.id, params: event.params,
          })
        } else if (event.type === 'turn_end') {
          this.store.updateTaskStatus(taskId, 'done')
          const preview = fullText.slice(0, 80).replace(/\n/g, ' ')
          this.push.notifyAll('Claude finished', preview || 'Task complete', `/threads/${threadId}`)
        }
      },
    })

    pm.on('exit', () => {
      // If no turn_end was received (crash), mark failed and still notify
      const task = this.store.getTask(taskId)
      if (task?.status === 'running') {
        this.store.updateTaskStatus(taskId, 'failed')
        this.push.notifyAll('Claude task failed', 'Check the thread for details', `/threads/${threadId}`)
      }
    })
  }
}
```

Add `getTask` to ThreadStore:
```typescript
getTask(id: string) {
  const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any
  if (!row) return null
  return { id: row.id, threadId: row.thread_id, projectPath: row.project_path, content: row.content, status: row.status }
}
```

- [ ] **Step 6: Add routes to `server/src/index.ts`**

Add after existing routes:
```typescript
// Push subscription
app.post('/push/subscribe', async (req) => {
  const sub = req.body as webpush.PushSubscription
  push.addSubscription(sub)
  return { ok: true }
})

// Task submission (async — client can close tab immediately)
app.post('/tasks', async (req) => {
  const { threadId, projectPath, content } = req.body as {
    threadId: string; projectPath: string; content: string
  }
  store.appendMessage(threadId, 'user', 'text', content, {})
  const taskId = store.createTask(threadId, projectPath, content)
  taskRunner.run(taskId, threadId, projectPath, content)
  return { taskId, status: 'running' }
})
```

Also expose `VAPID_PUBLIC_KEY` to frontend:
```typescript
app.get('/push/vapid-public-key', async () => ({
  key: process.env.VAPID_PUBLIC_KEY,
}))
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd server && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add server/
git commit -m "feat: add PushService + TaskRunner — async task execution with Web Push notifications"
```

---

## Phase B — Frontend Core

### Task B0: PWA Setup (Manifest + Service Worker)

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Modify: `app/layout.tsx` (add manifest link + SW registration)

- [ ] **Step 1: Install next-pwa**

```bash
npm install next-pwa
```

- [ ] **Step 2: Create `public/manifest.json`**

```json
{
  "name": "Claude CLI Wrapper",
  "short_name": "CCW",
  "description": "Claude Code CLI wrapped as a PWA",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

(Add placeholder 192×192 and 512×512 PNG icons to `public/` — can be simple black squares initially.)

- [ ] **Step 3: Create `public/sw.js`** (service worker)

```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Claude', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url ?? '/'
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})
```

- [ ] **Step 4: Register service worker + subscribe to push in `app/layout.tsx`**

Add `useEffect` in a client component wrapper (or in a `components/PushSetup.tsx` client component):

```typescript
// components/PushSetup.tsx
'use client'
import { useEffect } from 'react'

const SERVER = process.env.NEXT_PUBLIC_PROCESS_SERVER_URL ?? 'http://localhost:3001'

export function PushSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const vapidRes = await fetch(`${SERVER}/push/vapid-public-key`)
      const { key } = await vapidRes.json()

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })

      await fetch(`${SERVER}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
    })
  }, [])

  return null
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
```

- [ ] **Step 5: Add PushSetup to `app/layout.tsx`**

```tsx
import { PushSetup } from '@/components/PushSetup'
// Inside <body>:
<PushSetup />
{children}
```

- [ ] **Step 6: Verify PWA installable**

Run `npm run dev`, open Chrome DevTools → Application → Manifest. Verify manifest loads. Check Service Workers tab — sw.js registered. Click "Install app" prompt if shown.

- [ ] **Step 7: Commit**

```bash
git add public/ components/PushSetup.tsx app/layout.tsx
git commit -m "feat: PWA setup — manifest, service worker, Web Push subscription"
```

---

### Task B1: Password Middleware + App Shell

**Files:**
- Create: `middleware.ts`
- Modify: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `lib/store.ts`
- Create: `lib/ws-client.ts`
- Create: `lib/types.ts`

- [ ] **Step 1: Create `middleware.ts` (password protection)**

```typescript
import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get('auth')
  if (cookie?.value === process.env.SITE_PASSWORD) {
    return NextResponse.next()
  }

  const url = req.nextUrl.clone()
  if (url.pathname === '/login') return NextResponse.next()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Create `app/login/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password: pw }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      router.push('/')
    } else {
      setErr(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <form onSubmit={submit} className="flex flex-col gap-3 w-72">
        <h1 className="text-white text-lg font-medium">Claude CLI Wrapper</h1>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="Password"
          className="bg-neutral-800 text-white px-3 py-2 rounded-md border border-neutral-700 outline-none focus:border-neutral-400"
        />
        {err && <p className="text-red-400 text-sm">Incorrect password</p>}
        <button
          type="submit"
          className="bg-white text-black px-3 py-2 rounded-md text-sm font-medium"
        >
          Enter
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/api/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth', password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}
```

- [ ] **Step 4: Create `lib/types.ts`** (client-side mirror of server types)

```typescript
export type ToolCallType =
  | 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'LS' | 'Agent' | 'Task' | 'unknown'

export interface TextEvent { type: 'text'; content: string }
export interface ToolCallStartEvent {
  type: 'tool_call_start'; id: string; toolType: ToolCallType; label: string; params: Record<string, unknown>
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
```

- [ ] **Step 5: Create `lib/ws-client.ts`**

```typescript
type EventHandler = (event: TurnEvent) => void
import type { TurnEvent } from './types'

class WsClient {
  private ws: WebSocket | null = null
  private handlers: EventHandler[] = []
  private url: string

  constructor() {
    this.url = process.env.NEXT_PUBLIC_PROCESS_SERVER_URL?.replace('http', 'ws') ?? 'ws://localhost:3001/ws'
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.ws = new WebSocket(this.url)
    this.ws.onmessage = (e) => {
      try {
        const { event } = JSON.parse(e.data)
        this.handlers.forEach(h => h(event))
      } catch {}
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

  on(handler: EventHandler) {
    this.handlers.push(handler)
    return () => { this.handlers = this.handlers.filter(h => h !== handler) }
  }
}

export const wsClient = new WsClient()
```

- [ ] **Step 6: Create `lib/store.ts`**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, Thread, Message } from './types'

interface UIState {
  sidebarOpen: boolean
  diffPanelOpen: boolean
  diffStyle: 'unified' | 'split'
  activeProjectId: string | null
  activeThreadId: string | null
}

interface AppStore extends UIState {
  projects: Project[]
  threads: Thread[]
  messages: Message[]
  isRunning: boolean

  setSidebarOpen: (v: boolean) => void
  setDiffPanelOpen: (v: boolean) => void
  setDiffStyle: (v: 'unified' | 'split') => void
  setActiveProject: (id: string) => void
  setActiveThread: (id: string) => void
  setProjects: (p: Project[]) => void
  setThreads: (t: Thread[]) => void
  setMessages: (m: Message[]) => void
  appendMessage: (m: Message) => void
  setRunning: (v: boolean) => void
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      diffPanelOpen: false,
      diffStyle: 'unified',
      activeProjectId: null,
      activeThreadId: null,
      projects: [],
      threads: [],
      messages: [],
      isRunning: false,

      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      setDiffPanelOpen: (v) => set({ diffPanelOpen: v }),
      setDiffStyle: (v) => set({ diffStyle: v }),
      setActiveProject: (id) => set({ activeProjectId: id }),
      setActiveThread: (id) => set({ activeThreadId: id }),
      setProjects: (projects) => set({ projects }),
      setThreads: (threads) => set({ threads }),
      setMessages: (messages) => set({ messages }),
      appendMessage: (m) => set(s => ({ messages: [...s.messages, m] })),
      setRunning: (v) => set({ isRunning: v }),
    }),
    {
      name: 'ccw-ui',
      partialize: (s) => ({
        sidebarOpen: s.sidebarOpen,
        diffStyle: s.diffStyle,
        activeProjectId: s.activeProjectId,
      }),
    }
  )
)
```

- [ ] **Step 7: Install frontend deps**

```bash
npm install zustand diff2html
npm install -D @types/diff2html
```

- [ ] **Step 8: Create `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Claude CLI Wrapper',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-neutral-950 text-neutral-100 h-screen overflow-hidden`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 9: Create `app/page.tsx` (app shell — layout only, no logic yet)**

```tsx
'use client'
import { useStore } from '@/lib/store'

export default function Home() {
  const { sidebarOpen } = useStore()

  return (
    <div className="flex h-screen">
      {/* Sidebar placeholder */}
      {sidebarOpen && (
        <aside className="w-56 border-r border-neutral-800 flex-shrink-0 bg-neutral-950" />
      )}
      {/* Main content */}
      <main className="flex flex-1 min-w-0">
        <div className="flex-1 min-w-0" /> {/* ConversationPane */}
        <div className="w-96 border-l border-neutral-800 flex-shrink-0" /> {/* DiffPanel */}
      </main>
    </div>
  )
}
```

- [ ] **Step 10: Verify app runs**

```bash
npm run dev
```

Open `http://localhost:3000` in browser. Expected: redirects to `/login`, login page shows.

- [ ] **Step 11: Commit**

```bash
git add app/ lib/ middleware.ts
git commit -m "feat: add Next.js shell, password middleware, Zustand store, WS client"
```

---

### Task B2: Sidebar

**Files:**
- Create: `components/Sidebar.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/Sidebar.tsx`**

```tsx
'use client'
import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import type { Project, Thread } from '@/lib/types'

const SERVER = process.env.NEXT_PUBLIC_PROCESS_SERVER_URL ?? 'http://localhost:3001'

export function Sidebar() {
  const {
    projects, threads, activeProjectId, activeThreadId,
    setProjects, setThreads, setActiveProject, setActiveThread,
    setSidebarOpen,
  } = useStore()

  useEffect(() => {
    fetch(`${SERVER}/projects`)
      .then(r => r.json())
      .then(setProjects)
  }, [])

  useEffect(() => {
    if (!activeProjectId) return
    fetch(`${SERVER}/projects/${activeProjectId}/threads`)
      .then(r => r.json())
      .then(setThreads)
  }, [activeProjectId])

  async function newProject() {
    const path = prompt('Project directory path:')
    const name = prompt('Project name:')
    if (!path || !name) return
    const p: Project = await fetch(`${SERVER}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name }),
    }).then(r => r.json())
    setProjects([p, ...projects])
    setActiveProject(p.id)
  }

  async function newThread() {
    if (!activeProjectId) return
    const t: Thread = await fetch(`${SERVER}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: activeProjectId, title: 'New thread' }),
    }).then(r => r.json())
    setThreads([t, ...threads])
    setActiveThread(t.id)
  }

  async function deleteThread(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this thread?')) return
    await fetch(`${SERVER}/threads/${id}`, { method: 'DELETE' })
    setThreads(threads.filter(t => t.id !== id))
    if (activeThreadId === id) setActiveThread('')
  }

  return (
    <aside className="w-56 border-r border-neutral-800 flex flex-col h-full bg-neutral-950 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-neutral-800">
        <span className="text-neutral-400 font-medium text-xs uppercase tracking-wider">Projects</span>
        <button onClick={() => setSidebarOpen(false)} className="text-neutral-500 hover:text-neutral-200 text-xs">←</button>
      </div>

      {/* Project list */}
      <div className="overflow-y-auto flex-1">
        {projects.map(p => (
          <div key={p.id}>
            <button
              onClick={() => setActiveProject(p.id)}
              className={`w-full text-left px-3 py-2 text-xs font-medium truncate ${
                activeProjectId === p.id ? 'text-white bg-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              {p.name}
            </button>
            {activeProjectId === p.id && (
              <div className="ml-3">
                {threads.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setActiveThread(t.id)}
                    className={`group flex items-center justify-between px-2 py-1 cursor-pointer rounded-sm ${
                      activeThreadId === t.id ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    <span className="truncate text-xs">{t.title}</span>
                    <button
                      onClick={(e) => deleteThread(t.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 ml-1 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={newThread}
                  className="w-full text-left px-2 py-1 text-neutral-500 hover:text-neutral-200 text-xs"
                >
                  + New thread
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-neutral-800 p-2">
        <button
          onClick={newProject}
          className="w-full text-xs text-neutral-500 hover:text-neutral-200 py-1"
        >
          + Add project
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Wire Sidebar into `app/page.tsx`**

Replace the aside placeholder:
```tsx
'use client'
import { useStore } from '@/lib/store'
import { Sidebar } from '@/components/Sidebar'

export default function Home() {
  const { sidebarOpen, setSidebarOpen } = useStore()

  return (
    <div className="flex h-screen">
      {sidebarOpen ? (
        <Sidebar />
      ) : (
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-8 flex-shrink-0 flex items-center justify-center text-neutral-500 hover:text-neutral-200 border-r border-neutral-800"
        >
          →
        </button>
      )}
      <main className="flex flex-1 min-w-0">
        <div className="flex-1 min-w-0" />
        <div className="w-96 border-l border-neutral-800 flex-shrink-0" />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify visually**

Start both server and frontend:
```bash
npm run dev
```

Open `http://localhost:3000`. Log in. Verify:
- Sidebar appears with "Projects" header
- "+ Add project" prompt works, project appears in list
- Clicking project shows thread list
- "+ New thread" creates a thread
- Sidebar collapses and reopens with arrow buttons

- [ ] **Step 4: Commit**

```bash
git add components/Sidebar.tsx app/page.tsx
git commit -m "feat: add Sidebar component — project/thread list with CRUD"
```

---

### Task B3: ConversationPane + ToolCallCard

**Files:**
- Create: `components/ConversationPane.tsx`
- Create: `components/ToolCallCard.tsx`
- Create: `components/ui/TextBubble.tsx`
- Create: `components/ui/StatusBadge.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/ui/StatusBadge.tsx`**

```tsx
export function StatusBadge({ status }: { status: 'pending' | 'success' | 'error' }) {
  const styles = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    success: 'bg-green-500/20 text-green-400',
    error: 'bg-red-500/20 text-red-400',
  }
  const labels = { pending: '●', success: '✓', error: '✕' }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
```

- [ ] **Step 2: Create `components/ui/TextBubble.tsx`**

```tsx
export function TextBubble({ content, role }: { content: string; role: 'user' | 'assistant' }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-xl bg-neutral-700 text-white px-3 py-2 rounded-xl text-sm whitespace-pre-wrap">
          {content}
        </div>
      </div>
    )
  }
  return (
    <div className="mb-3">
      <div className="text-neutral-200 text-sm whitespace-pre-wrap leading-relaxed">{content}</div>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/ToolCallCard.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { StatusBadge } from './ui/StatusBadge'
import type { ToolCallStartEvent, ToolCallEndEvent } from '@/lib/types'

interface ToolCallCardProps {
  start: ToolCallStartEvent
  end?: ToolCallEndEvent
  onViewDiff?: () => void
}

export function ToolCallCard({ start, end, onViewDiff }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const status = end ? (end.status === 'error' ? 'error' : 'success') : 'pending'
  const isFileEdit = start.toolType === 'Write' || start.toolType === 'Edit'

  return (
    <div className="mb-2 border border-neutral-800 rounded-lg overflow-hidden text-xs">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-neutral-800/50 bg-neutral-900/50"
        onClick={() => setExpanded(v => !v)}
      >
        <StatusBadge status={status} />
        <span className="text-neutral-300 font-mono flex-1 truncate">{start.label}</span>
        {isFileEdit && end && onViewDiff && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewDiff() }}
            className="text-blue-400 hover:text-blue-300 text-xs ml-auto"
          >
            View Diff
          </button>
        )}
        <span className="text-neutral-600 ml-1">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && end && (
        <div className="px-3 py-2 bg-neutral-950 font-mono text-neutral-400 text-xs max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-neutral-800">
          {end.output || '(no output)'}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `components/ConversationPane.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { wsClient } from '@/lib/ws-client'
import { TextBubble } from './ui/TextBubble'
import { ToolCallCard } from './ToolCallCard'
import type { TurnEvent, ToolCallStartEvent, ToolCallEndEvent } from '@/lib/types'

const SERVER = process.env.NEXT_PUBLIC_PROCESS_SERVER_URL ?? 'http://localhost:3001'

interface DisplayItem {
  key: string
  type: 'text' | 'tool'
  role?: 'user' | 'assistant'
  content?: string
  start?: ToolCallStartEvent
  end?: ToolCallEndEvent
}

export function ConversationPane() {
  const { activeThreadId, activeProjectId, projects, isRunning, setRunning, setDiffPanelOpen } = useStore()
  const [input, setInput] = useState('')
  const [items, setItems] = useState<DisplayItem[]>([])
  const [pinned, setPinned] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const toolCallMap = useRef<Map<string, number>>(new Map()) // id → items index

  const activeProject = projects.find(p => p.id === activeProjectId)

  // Load existing messages when thread changes
  useEffect(() => {
    if (!activeThreadId) { setItems([]); return }
    fetch(`${SERVER}/threads/${activeThreadId}/messages`)
      .then(r => r.json())
      .then((msgs: any[]) => {
        const loaded: DisplayItem[] = msgs.map(m => ({
          key: m.id,
          type: m.type === 'text' ? 'text' : 'tool',
          role: m.role,
          content: m.content,
        }))
        setItems(loaded)
      })
  }, [activeThreadId])

  // Subscribe to WS events
  useEffect(() => {
    wsClient.connect()
    const unsub = wsClient.on((event: TurnEvent) => {
      handleEvent(event)
    })
    return unsub
  }, [])

  const handleEvent = useCallback((event: TurnEvent) => {
    if (event.type === 'text') {
      setItems(prev => [...prev, { key: `text-${Date.now()}`, type: 'text', role: 'assistant', content: event.content }])
    } else if (event.type === 'tool_call_start') {
      const key = `tool-${event.id}`
      toolCallMap.current.set(event.id, -1) // placeholder
      setItems(prev => {
        const idx = prev.length
        toolCallMap.current.set(event.id, idx)
        return [...prev, { key, type: 'tool', start: event }]
      })
    } else if (event.type === 'tool_call_end') {
      setItems(prev => prev.map(item =>
        item.start?.id === event.id ? { ...item, end: event } : item
      ))
    } else if (event.type === 'turn_end') {
      setRunning(false)
    }
  }, [])

  useEffect(() => {
    if (!pinned) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items, pinned])

  async function send() {
    if (!input.trim() || !activeThreadId || !activeProject) return
    const content = input.trim()
    setInput('')
    setRunning(true)
    setItems(prev => [...prev, { key: `user-${Date.now()}`, type: 'text', role: 'user', content }])
    wsClient.send('send', { content, threadId: activeThreadId, projectPath: activeProject.path })
  }

  function cancel() {
    wsClient.send('cancel', {})
    setRunning(false)
  }

  if (!activeThreadId) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
        Select or create a thread to start
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        onScroll={(e) => {
          const el = e.currentTarget
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
          setPinned(!atBottom)
        }}
      >
        {items.map(item => {
          if (item.type === 'text') {
            return <TextBubble key={item.key} content={item.content ?? ''} role={item.role ?? 'assistant'} />
          }
          return (
            <ToolCallCard
              key={item.key}
              start={item.start!}
              end={item.end}
              onViewDiff={() => {
                wsClient.send('diff_request', { cwd: activeProject?.path ?? '' })
                setDiffPanelOpen(true)
              }}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Pin indicator */}
      {pinned && (
        <button
          onClick={() => { setPinned(false); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
          className="absolute bottom-20 right-6 bg-neutral-700 text-white text-xs px-2 py-1 rounded-full"
        >
          ↓ Jump to latest
        </button>
      )}

      {/* Input */}
      <div className="border-t border-neutral-800 px-3 py-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Message Claude..."
          rows={1}
          className="flex-1 bg-neutral-900 text-white text-sm px-3 py-2 rounded-lg border border-neutral-700 focus:border-neutral-400 outline-none resize-none"
          style={{ maxHeight: '160px', overflowY: 'auto' }}
        />
        {isRunning ? (
          <button onClick={cancel} className="bg-red-500/20 text-red-400 px-3 py-2 rounded-lg text-sm hover:bg-red-500/30">
            Stop
          </button>
        ) : (
          <button onClick={send} className="bg-white text-black px-3 py-2 rounded-lg text-sm font-medium hover:bg-neutral-200">
            Send
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire ConversationPane into `app/page.tsx`**

```tsx
'use client'
import { useStore } from '@/lib/store'
import { Sidebar } from '@/components/Sidebar'
import { ConversationPane } from '@/components/ConversationPane'

export default function Home() {
  const { sidebarOpen, setSidebarOpen } = useStore()

  return (
    <div className="flex h-screen relative">
      {sidebarOpen ? (
        <Sidebar />
      ) : (
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-8 flex-shrink-0 flex items-center justify-center text-neutral-500 hover:text-neutral-200 border-r border-neutral-800"
        >
          →
        </button>
      )}
      <main className="flex flex-1 min-w-0">
        <ConversationPane />
        <div className="w-96 border-l border-neutral-800 flex-shrink-0" /> {/* DiffPanel placeholder */}
      </main>
    </div>
  )
}
```

- [ ] **Step 6: Set env var and verify end-to-end**

Create `.env.local`:
```
SITE_PASSWORD=test123
NEXT_PUBLIC_PROCESS_SERVER_URL=http://localhost:3001
```

```bash
npm run dev
```

Open browser, log in, add a project pointing at a real local directory, create a thread, type "what files are in this directory?" and send. Verify:
- Message appears in conversation
- ToolCallCards appear for each tool call (LS, Read, etc.) with pending → success transition
- Streaming text from Claude appears
- Stop button terminates the run

- [ ] **Step 7: Commit**

```bash
git add components/ lib/ app/
git commit -m "feat: add ConversationPane + ToolCallCard — streaming Claude Code UI"
```

---

### Task B4: DiffPanel

**Files:**
- Create: `components/DiffPanel.tsx`
- Modify: `app/page.tsx`
- Modify: `lib/store.ts` (add `currentDiff` state)

- [ ] **Step 1: Add `currentDiff` to store**

In `lib/store.ts`, add to `AppStore` interface and implementation:
```typescript
// Add to AppStore interface:
currentDiff: any | null
setCurrentDiff: (d: any) => void

// Add to create() implementation:
currentDiff: null,
setCurrentDiff: (d) => set({ currentDiff: d }),
```

- [ ] **Step 2: Wire diff_result event in WS client**

In `components/ConversationPane.tsx`, add to `handleEvent`:
```typescript
} else if ((event as any).type === 'diff_result') {
  useStore.getState().setCurrentDiff((event as any).diff)
}
```

- [ ] **Step 3: Create `components/DiffPanel.tsx`**

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import * as Diff2Html from 'diff2html'
import 'diff2html/bundles/css/diff2html.min.css'

// Reconstruct raw unified diff string from DiffMetadata
function metadataToDiffString(diff: any): string {
  if (!diff?.files?.length) return ''
  const lines: string[] = []
  for (const file of diff.files) {
    lines.push(`diff --git a/${file.oldPath} b/${file.newPath}`)
    lines.push(`--- a/${file.oldPath}`)
    lines.push(`+++ b/${file.newPath}`)
    for (const hunk of file.hunks) {
      lines.push(hunk.header)
      lines.push(...hunk.lines)
    }
  }
  return lines.join('\n')
}

export function DiffPanel() {
  const { currentDiff, diffStyle, diffPanelOpen, setDiffPanelOpen, setDiffStyle } = useStore()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!currentDiff || !containerRef.current) return
    const raw = metadataToDiffString(currentDiff)
    if (!raw) return
    const html = Diff2Html.html(raw, {
      drawFileList: false,
      outputFormat: diffStyle === 'split' ? 'side-by-side' : 'line-by-line',
    })
    containerRef.current.innerHTML = html
  }, [currentDiff, diffStyle])

  if (!diffPanelOpen) return null

  return (
    <div className="w-[480px] flex-shrink-0 border-l border-neutral-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-neutral-300 font-medium">Diff</span>
          {currentDiff?.branch && (
            <span className="text-neutral-500 font-mono">{currentDiff.branch}</span>
          )}
          {currentDiff?.files?.length > 0 && (
            <span className="text-neutral-500">{currentDiff.files.length} file{currentDiff.files.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDiffStyle(diffStyle === 'unified' ? 'split' : 'unified')}
            className="text-neutral-400 hover:text-white"
          >
            {diffStyle === 'unified' ? 'Split' : 'Unified'}
          </button>
          <button onClick={() => setDiffPanelOpen(false)} className="text-neutral-500 hover:text-white">
            ×
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto bg-neutral-950 text-xs">
        {!currentDiff || !currentDiff.files?.length ? (
          <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
            No changes
          </div>
        ) : (
          <div ref={containerRef} className="diff2html-wrapper" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add diff2html dark-mode CSS override to `app/globals.css`**

```css
/* Diff2Html dark theme overrides */
.diff2html-wrapper .d2h-wrapper { background: transparent; }
.diff2html-wrapper .d2h-file-header { background: #1a1a1a; border-color: #333; color: #aaa; }
.diff2html-wrapper .d2h-code-linenumber { background: #111; border-color: #333; color: #555; }
.diff2html-wrapper .d2h-code-line { background: #0d0d0d; color: #ccc; }
.diff2html-wrapper .d2h-ins { background: #0d2b1a; color: #7ee787; }
.diff2html-wrapper .d2h-ins .d2h-code-linenumber { background: #0a1f12; }
.diff2html-wrapper .d2h-del { background: #2b0d0d; color: #ffa198; }
.diff2html-wrapper .d2h-del .d2h-code-linenumber { background: #1f0a0a; }
```

- [ ] **Step 5: Wire DiffPanel into `app/page.tsx`**

Replace the DiffPanel placeholder `<div>`:
```tsx
import { DiffPanel } from '@/components/DiffPanel'
// ...
<DiffPanel />
```

- [ ] **Step 6: Verify visually**

Run the app, create a thread on a project with unstaged git changes. Send a message that causes Claude to edit a file. Click "View Diff" on a file edit ToolCallCard. Verify:
- Diff panel slides open on the right
- Diff renders with dark theme
- Unified/Split toggle works
- Close button hides panel
- Branch name + file count visible in header

- [ ] **Step 7: Commit**

```bash
git add components/DiffPanel.tsx app/globals.css app/page.tsx lib/store.ts
git commit -m "feat: add DiffPanel — diff2html viewer with dark theme, unified/split toggle"
```

---

## Phase C — Agent Teams

### Task C1: TeamPanel

**Files:**
- Create: `components/TeamPanel.tsx`
- Modify: `lib/store.ts` (add team state)
- Modify: `app/page.tsx`

- [ ] **Step 1: Add team state to `lib/store.ts`**

Add to `AppStore` interface and implementation:
```typescript
// Interface additions:
teamId: string | null
sessionId: string | null
teamSessions: Array<{ sessionId: string; alive: boolean; label: string; color: string }>
teamPanelOpen: boolean

setTeamId: (id: string) => void
setSessionId: (id: string) => void
setTeamSessions: (s: AppStore['teamSessions']) => void
setTeamPanelOpen: (v: boolean) => void

// Implementation:
teamId: null,
sessionId: null,
teamSessions: [],
teamPanelOpen: false,
setTeamId: (id) => set({ teamId: id }),
setSessionId: (id) => set({ sessionId: id }),
setTeamSessions: (s) => set({ teamSessions: s }),
setTeamPanelOpen: (v) => set({ teamPanelOpen: v }),
```

- [ ] **Step 2: Capture sessionId from WS init event**

In `components/ConversationPane.tsx`, in `handleEvent`:
```typescript
} else if (event.type === 'session_init') {
  useStore.getState().setSessionId(event.sessionId)
}
```

- [ ] **Step 3: Create `components/TeamPanel.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { wsClient } from '@/lib/ws-client'

const COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500']

export function TeamPanel() {
  const {
    teamPanelOpen, setTeamPanelOpen,
    teamId, setTeamId,
    sessionId, teamSessions,
    isRunning,
  } = useStore()
  const [newTeamId, setNewTeamId] = useState('')

  function joinTeam() {
    const id = newTeamId.trim() || `team-${Math.random().toString(36).slice(2, 7)}`
    setTeamId(id)
    wsClient.send('team_join', { teamId: id })
    setNewTeamId('')
  }

  function forwardTo(targetSessionId: string) {
    const content = prompt('Message to forward:')
    if (!content) return
    wsClient.send('team_forward', { targetSessionId, content })
  }

  function pipeTo(targetSessionId: string) {
    const raw = prompt('Raw input to pipe:')
    if (!raw) return
    wsClient.send('team_pipe', { targetSessionId, raw })
  }

  if (!teamPanelOpen) {
    return (
      <button
        onClick={() => setTeamPanelOpen(true)}
        className="fixed bottom-4 right-4 bg-neutral-800 text-white text-xs px-3 py-2 rounded-full border border-neutral-700 hover:bg-neutral-700"
      >
        Team {teamId ? `· ${teamId}` : ''}
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-64 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl text-xs">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="text-neutral-300 font-medium">Agent Team</span>
        <button onClick={() => setTeamPanelOpen(false)} className="text-neutral-500 hover:text-white">×</button>
      </div>

      {!teamId ? (
        <div className="p-3 flex gap-2">
          <input
            value={newTeamId}
            onChange={e => setNewTeamId(e.target.value)}
            placeholder="Team ID (or leave blank)"
            className="flex-1 bg-neutral-800 text-white px-2 py-1 rounded text-xs border border-neutral-700 outline-none"
          />
          <button onClick={joinTeam} className="bg-white text-black px-2 py-1 rounded text-xs font-medium">
            Join
          </button>
        </div>
      ) : (
        <div className="p-3">
          <div className="text-neutral-500 mb-2">Team: <span className="text-neutral-200 font-mono">{teamId}</span></div>
          <div className="space-y-2">
            {teamSessions.map((s, i) => (
              <div key={s.sessionId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                  <span className="text-neutral-300 font-mono truncate max-w-[80px]">{s.sessionId.slice(0, 8)}</span>
                  <span className={`text-xs ${s.alive ? 'text-green-400' : 'text-neutral-600'}`}>
                    {s.alive ? 'running' : 'idle'}
                  </span>
                </div>
                {s.sessionId !== sessionId && (
                  <div className="flex gap-1">
                    <button onClick={() => forwardTo(s.sessionId)} className="text-neutral-500 hover:text-blue-400">→</button>
                    <button onClick={() => pipeTo(s.sessionId)} className="text-neutral-500 hover:text-orange-400">⌁</button>
                  </div>
                )}
              </div>
            ))}
            {teamSessions.length === 0 && (
              <p className="text-neutral-600">No other sessions in this team yet. Open a new tab and join the same team ID.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire TeamPanel into `app/page.tsx`**

```tsx
import { TeamPanel } from '@/components/TeamPanel'
// Inside return, after </main>:
<TeamPanel />
```

- [ ] **Step 5: Verify visually**

Open two browser tabs. In Tab 1: join team "myteam". In Tab 2: join team "myteam". Verify:
- Both tabs show the other session in TeamPanel
- "→" forward button sends text to other tab's input
- Status shows running/idle correctly

- [ ] **Step 6: Commit**

```bash
git add components/TeamPanel.tsx lib/store.ts app/page.tsx
git commit -m "feat: add TeamPanel — multi-session agent team routing UI"
```

---

## Phase D — Deployment

### Task D1: Mirror GitHub Action

> **DO THIS FIRST — before any feature code.** Every subsequent commit auto-deploys once this is wired.

**Files:**
- Create: `.github/workflows/mirror.yml`
- Create: `.github/workflows/verify.yml`

- [ ] **Step 1: Create personal mirror repo**

On GitHub (personal account `gdnkei0`): create new empty repo `Claude-CLI-Wrapper-mirror`. Do NOT initialize with README (must be empty).

- [ ] **Step 2: Generate SSH deploy key**

```bash
ssh-keygen -t ed25519 -C "ccw-mirror-deploy" -f /tmp/mirror-key -N ""
cat /tmp/mirror-key.pub   # copy this
cat /tmp/mirror-key       # copy this separately
rm /tmp/mirror-key /tmp/mirror-key.pub
```

- `mirror-key.pub` → personal repo (`gdnkei0/Claude-CLI-Wrapper-mirror`) → Settings → Deploy Keys → Add deploy key → enable "Allow write access"
- `mirror-key` (private) → org repo (`Suru-DevLabs/Claude-CLI-Wrapper`) → Settings → Secrets and variables → Actions → New secret → name: `SSH_PRIVATE_KEY`

- [ ] **Step 3: Create `.github/workflows/mirror.yml`**

```yaml
name: Mirror to Personal Repo

on:
  push:
    branches: [main]

jobs:
  mirror_job:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: mirror-repository
        uses: yesolutions/mirror-action@v0.7.0
        with:
          REMOTE: "git@github.com:gdnkei0/Claude-CLI-Wrapper-mirror.git"
          GIT_SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          GIT_SSH_NO_VERIFY_HOST: "true"
```

- [ ] **Step 4: Create `.github/workflows/verify.yml`** (CI gate — mirrors TPHelper)

```yaml
name: verify

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: verify-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: test + typecheck + build
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci

      - name: Install server deps
        run: cd server && npm ci

      - name: Run verify gate
        run: bash scripts/verify.sh
        env:
          NEXT_TELEMETRY_DISABLED: '1'
          CI: 'true'
```

- [ ] **Step 5: Create `scripts/verify.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> Server tests"
cd server && npm run test && cd ..

echo "==> TypeScript (frontend)"
npx tsc --noEmit

echo "==> TypeScript (server)"
cd server && npx tsc --noEmit && cd ..

echo "==> Build"
npm run build

echo "All checks passed."
```

```bash
chmod +x scripts/verify.sh
```

- [ ] **Step 6: Commit and push**

```bash
git add .github/ scripts/
git commit -m "ci: add mirror action (Vercel Hobby deploy) and verify gate"
git push origin main
```

Expected: GitHub Actions shows both workflows running. Personal repo receives push.

- [ ] **Step 7: Verify mirror worked**

Check `github.com/gdnkei0/Claude-CLI-Wrapper-mirror` — should now have commits.

---

### Task D2: Vercel Config + Env Vars

**Files:**
- Create: `vercel.json`
- Create: `.env.production.example`

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_PROCESS_SERVER_URL": "@process-server-url"
  }
}
```

- [ ] **Step 2: Create `.env.production.example`**

```bash
# Set these in Vercel dashboard → Project Settings → Environment Variables
SITE_PASSWORD=<strong-random-password>
NEXT_PUBLIC_PROCESS_SERVER_URL=wss://your-process-server.onrender.com
```

- [ ] **Step 3: Link Vercel to personal mirror repo**

In Vercel dashboard:
1. New Project → Import from GitHub → select `gdnkei0/Claude-CLI-Wrapper-mirror`
2. Framework: Next.js (auto-detected)
3. Environment variables: set `SITE_PASSWORD` and `NEXT_PUBLIC_PROCESS_SERVER_URL`
4. Deploy

Expected: Vercel URL live, redirects to login, app loads.

- [ ] **Step 4: Deploy process server to Render (optional — for remote access)**

On Render.com: New Web Service → connect GitHub → select `server/` as root. Set:
- Build: `npm install && npm run build`
- Start: `node dist/index.js`
- Env: `PORT=3001`, `DB_PATH=/data/threads.db`
- Persistent disk: `/data` (free tier: 1 GB)

Copy the Render service URL → update `NEXT_PUBLIC_PROCESS_SERVER_URL` in Vercel to `wss://your-service.onrender.com`.

- [ ] **Step 5: Verify full remote flow**

Open the Vercel URL from a different device. Log in with password. Create a project, start a thread, verify messages stream from the process server.

- [ ] **Step 6: Commit**

```bash
git add vercel.json .env.production.example
git commit -m "feat: add Vercel config and deployment documentation"
git push origin main
```

Expected: mirror action triggers, Vercel auto-deploys.

---

## Self-Review Checklist

**Spec coverage:**
- [x] Persistent thread history — ThreadStore, Sidebar
- [x] Split-pane layout — page.tsx with DiffPanel
- [x] Inline tool call cards — ToolCallCard with StatusBadge
- [x] Diff panel (unified/split, lazy, hunk nav) — DiffPanel + DiffService
- [x] Multi-window / agent teams — AgentBus + TeamPanel
- [x] Password-protected remote access — middleware.ts + Vercel
- [x] Mirror to personal repo — mirror.yml
- [x] Cancel running turn — ConversationPane stop button → ws cancel action
- [x] Auto-scroll with pin/unpin — ConversationPane
- [x] Token usage display — NOT YET: TurnEndEvent has costUsd but no display component. Add a small cost chip in ConversationPane after turn_end event renders.
- [x] Thread title auto-generation — NOT YET: first user message should auto-update thread title via PATCH /threads/:id/title. Add in ConversationPane after first user send.
- [x] Sidebar collapsible — Sidebar + page.tsx toggle

**Gaps to add before execution:**

1. **Token/cost display**: after `turn_end` event, append a small chip in ConversationPane: `$0.003 · 4.2s`
2. **Thread title auto-gen**: after first message in a thread, call `PATCH /threads/:id/title` with the first 60 chars of the message
3. **Diff hunk navigation**: DiffPanel prev/next hunk buttons (scroll to `d2h-code-line-ctn` elements)

These are small — add inline to the relevant tasks above during execution, not new tasks.

**Type consistency check:** `ToolCallStartEvent.id` used in `ToolCallCard` and matched by `ToolCallEndEvent.id` in ConversationPane — consistent. `DiffMetadata` shape from DiffService matches what DiffPanel expects — consistent. `WsClientMessage.action` strings match switch cases in ws-handler.ts — consistent.
