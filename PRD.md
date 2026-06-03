# PRD: Claude Code CLI Wrapper

**GitHub (org):** https://github.com/Suru-DevLabs/Claude-CLI-Wrapper
**Mirror (personal → Vercel):** personal repo, auto-synced via GitHub Action

---

## Problem Statement

Claude Code's CLI is powerful but exposes raw terminal output — no persistent thread history, no visual diff review, no project-scoped session management. Developers lose context between sessions, can't compare diffs alongside the agent conversation, and have no way to switch between multiple projects without starting fresh.

---

## Solution

A PWA (Progressive Web App) that submits tasks to a local/cloud Node.js process server. The user sends a message and can immediately close the tab. The server spawns `claude --output-format stream-json` in a pty, runs the task to completion, then fires a Web Push notification to all subscribed devices. Tapping the notification opens the PWA to the completed thread. If the tab is open during execution, live streaming events appear in real time as a bonus — but closing the tab does not cancel the task.

**Primary flow:** Send → close tab → Claude executes → push notification → tap to view result
**Secondary flow (tab stays open):** Send → live stream events → turn ends

---

## User Stories

1. As a developer, I want to open the app and see all my recent project threads, so that I can resume work without re-explaining context.
2. As a developer, I want to create a new thread scoped to a local project directory, so that agent tool calls automatically run in the right working directory.
3. As a developer, I want to send a message to Claude Code and see streaming output rendered in real time, so that I get instant feedback without waiting for the full response.
4. As a developer, I want tool calls (file reads, edits, searches, bash commands) displayed inline in the conversation with status indicators (pending / success / error), so that I can follow the agent's reasoning step by step.
5. As a developer, I want file edit tool calls to open a diff panel on the right, so that I can review exactly what changed without leaving the app.
6. As a developer, I want the diff panel to support unified and split views, so that I can choose the review style that suits me.
7. As a developer, I want to expand or collapse unchanged lines in the diff, so that I can focus on what actually changed.
8. As a developer, I want the diff panel to show the branch name and file count, so that I have context without opening a terminal.
9. As a developer, I want to switch between multiple projects in the sidebar, so that I can work on several codebases in one window.
10. As a developer, I want to create, rename, and delete threads, so that I can keep my session history organised.
11. As a developer, I want threads to persist between app restarts, so that I never lose a conversation.
12. As a developer, I want to search across thread history by keyword, so that I can find previous decisions quickly.
13. As a developer, I want to cancel a running agent turn, so that I can stop an incorrect or runaway operation immediately.
14. As a developer, I want the app to display token usage per turn (e.g. "14%"), so that I can gauge context consumption.
15. As a developer, I want keyboard shortcuts for common actions (new thread, send message, toggle sidebar, toggle diff panel), so that I rarely need the mouse.
16. As a developer, I want the diff panel to be closeable and reopenable, so that I can reclaim screen space when not reviewing changes.
17. As a developer, I want search tool calls shown with the query and match count, so that I can see what the agent found without running the search myself.
18. As a developer, I want bash/shell tool calls shown with the command and truncated output, so that I can audit what ran without scrolling through walls of text.
19. As a developer, I want the app to remember panel proportions between sessions, so that my layout is preserved.
20. As a developer, I want light and dark themes, so that the app matches my system preference.
21. As a developer, I want the sidebar to be collapsible, so that I get more horizontal space.
22. As a developer, I want error states shown inline (e.g. tool call failed, process crash), so that I know what went wrong without checking a separate log.
23. As a developer, I want the conversation pane to auto-scroll to the latest message with a pin/unpin toggle, so that I can read earlier output without losing the live tail.
24. As a developer, I want to copy any message or tool output to clipboard, so that I can paste results elsewhere.
25. As a developer, I want thread titles auto-generated from the first message (editable), so that I can identify threads at a glance.
26. As a developer, I want to export a thread as markdown, so that I can share session context in a PR or doc.
27. As a developer, I want diff navigation arrows (prev/next hunk), so that I can step through changes without scrolling.
28. As a developer, I want to open a new browser tab as an independent agent session, so that I can run parallel workstreams without switching threads.
29. As a developer, I want to group open sessions into a named team, so that I can logically organise agents working on the same goal.
30. As a developer, I want a team status panel showing all sessions (idle / running / waiting), so that I can monitor all agents at a glance.
31. As a developer, I want to forward one agent's output as input to another with a single click, so that I can chain agents without copy-paste.
32. As a developer, I want team configurations saved and reloadable, so that I can spin up a known multi-agent setup instantly.
33. As a developer, I want each session in a team to have a distinct colour label, so that I can distinguish agents visually.
34. As a developer, I want cross-session message links stored in thread history, so that I can trace the full agent-team run after the fact.
35. As a developer, I want to access the app from outside my laptop via a Vercel URL with password protection, so that I can use it on any device.

---

## Implementation Decisions

### Stack

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | Next.js 14 + TypeScript + Tailwind | PWA-capable; runs locally and on Vercel |
| PWA | `next-pwa` + Web App Manifest + Service Worker | Push notifications require service worker |
| Push | Web Push API (VAPID) + `web-push` npm | Standard; works in all modern browsers |
| Process server | Node.js + Fastify + `node-pty` + `ws` | pty required for Claude Code TTY detection |
| Task queue | SQLite table (`tasks`, status: pending/running/done/failed) | Survives server restart; no extra infra |
| Persistence | `better-sqlite3` locally; Neon Postgres for cloud | SQLite = zero config local |
| State | Zustand | Lightweight |
| Diff rendering | `diff2html` | Small, no heavy deps |

**Not used:** Tauri, Electron, MUI/Chakra. See `docs/tauri-option.md` if native binary ever needed.

### Hosting / Mirror Setup

```
Suru-DevLabs/Claude-CLI-Wrapper  (org, source of truth)
         │
         │  GitHub Action: on push to main →
         ▼
gdnkei0/Claude-CLI-Wrapper-mirror  (personal, free Hobby)
         │
         │  Vercel: auto-deploy on push
         ▼
       Vercel (Next.js frontend, password-protected)
```

- Vercel Hobby is free for personal accounts. Org accounts require Pro (paid). Mirror avoids this.
- Mirror action: `git push --mirror` to personal repo via deploy key. Runs on every push to `main`.
- Password protection: Next.js middleware (simple secret env var check on every request). Free, no Vercel Pro needed.
- Process server runs on the machine where `claude` is installed (laptop for local, cheap VPS or Render for remote). The Vercel frontend connects to it via WebSocket URL set in an env var.

### Modules

**1. `ProcessManager` (Node.js server)**
Spawns and manages one `claude` process per session via `node-pty`. Handles stdin writes, stdout streaming, kill, crash detection. Emits typed events to connected WebSocket clients. No UI concern.

**2. `OutputParser` (Node.js server)**
Consumes raw pty output from `ProcessManager`. Emits typed events: `text`, `tool-call`, `tool-result`, `token-usage`, `turn-end`. Strips ANSI, extracts tool call JSON, buffers incomplete lines. Pure function — testable with fixture strings, no process or socket dependency.

**3. `ThreadStore` (Node.js server, SQLite/Postgres)**
CRUD for projects, threads, messages. Schema: `projects(id, path, name)`, `threads(id, projectId, title, createdAt)`, `messages(id, threadId, role, type, content, metadata, createdAt)`. Swappable adapter: SQLite for local, Postgres (Neon) for cloud.

**4. `DiffService` (Node.js server)**
Given `cwd` + optional ref, runs `git diff`, returns structured metadata (files, hunks, additions, deletions). Called only on explicit client request, not on every tool call.

**5. `AgentBus` (Node.js server)**
WebSocket room router for cross-session communication. Sessions subscribe to a `teamId` channel. Supports two delivery modes — **forward** (message appears as new user turn in target) and **pipe** (written to target's pty stdin). Links cross-session messages in `ThreadStore` with `source_session_id`.

**6. `PushService` (Node.js server)**
Manages Web Push subscriptions (stored in SQLite: `push_subscriptions(id, endpoint, keys_p256dh, keys_auth, createdAt)`). Generates VAPID keys on first run (stored in env). Exposes `subscribe(sub)` and `notifyAll(title, body, url)`. Called by task runner on task completion. Uses `web-push` npm package.

**7. `TaskRunner` (Node.js server)**
Wraps `ProcessManager` for async execution. Accepts a task (threadId, projectPath, content), sets status `running` in SQLite, spawns claude, collects all output, on completion sets status `done` and calls `PushService.notifyAll`. On crash: sets status `failed`, still notifies. Decoupled from WebSocket — runs whether or not a client is connected.

**8. `ConversationPane` (React)**
Renders thread messages. Each message = `TextBubble`, `ToolCallCard`, or `ToolResultCard`. Auto-scroll with pin/unpin. Owns the input box and send/cancel controls.

**9. `ToolCallCard` (React)**
Renders one tool invocation: status badge, collapsible output, "View Diff" button for file edits. Lazy — does not trigger diff fetch itself.

**10. `DiffPanel` (React)**
Accepts `DiffMetadata`, renders with `diff2html`. Unified/split toggle, expand-unchanged toggle, hunk navigation. Open/closed state persists in Zustand.

**11. `Sidebar` (React)**
Project list + thread list. Collapsible. New-thread button.

**12. `TeamPanel` (React)**
Floating overlay showing all sessions in the current team: label, colour badge, status, "Pipe here" button.

---

## Testing Decisions

**Good test:** tests the contract of a module (inputs in, outputs out) — not internal implementation. Never mock what you can run for real.

**Tested modules:**
- `OutputParser` — unit tests with fixture pty output strings, one per tool call type.
- `ThreadStore` — integration tests against a temp SQLite file; covers CRUD and edge cases.
- `DiffService` — integration tests against a real temp git repo (created in test setup).
- `ProcessManager` — integration test that spawns a mock echo process and asserts events emitted.

**Not tested:** React components — verify visually by running the app.

---

## Deployment / CI

```yaml
# .github/workflows/mirror.yml
# Mirrors org repo to personal repo on every push to main.
# Vercel watches the personal repo and auto-deploys.
```

- Mirror action uses a deploy key (personal repo write access). Key stored as org repo secret.
- No separate CI gate needed for the mirror — Vercel builds are the gate.
- Before merging to `main`: `npx tsc --noEmit && npm run test && npm run build` (all green required).
- VAPID keys generated once via `npx web-push generate-vapid-keys`, stored as env vars `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` on both the process server and Vercel (public key only needed on Vercel for the service worker).
- Push subscriptions stored server-side in SQLite. Browser subscribes on first visit.
- Notification payload: `{ title: "Claude done", body: "first 80 chars of response", url: "/threads/:id" }`

---

## Out of Scope

- Tauri / Electron native binary
- Fully autonomous orchestrator logic (app routes messages; does not generate subtask prompts)
- Multi-user accounts or auth beyond a single password
- Mobile layout
- Windows/Linux process server support in v1 (macOS first)
- Plugin system

---

## Further Notes

- **Agentrove** (screenshot reference): three-column layout, inline tool call cards with checkmarks, token usage indicator in input bar, branch context in diff header.
- **Claude for Mac**: visual reference for typography, whitespace, sidebar feel — adapted, not cloned.
- **pty is non-negotiable.** Claude Code detects TTY. `child_process.spawn` without a pty = no tool call JSON emitted.
- **`OutputParser` must buffer partial lines.** pty writes are chunked — never assume a line arrives complete.
- **Diff panel is lazy.** `DiffService` called only when user clicks "View Diff".
- **Process server location:** for pure local use, it runs alongside Next.js (`npm run dev` starts both). For remote (Vercel) use, it runs on a separate host and its WebSocket URL is set as `PROCESS_SERVER_URL` env var on Vercel.
- **Render free tier** spins down after 15 min idle — acceptable for personal use but expect a 30s cold start. If unacceptable, use Railway ($5/month) or a $4/month Hetzner VPS.
