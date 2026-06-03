# Claude-CLI-Wrapper — Claude Reference

**Org repo:** https://github.com/Suru-DevLabs/Claude-CLI-Wrapper
**Mirror → Vercel:** personal repo auto-synced via GitHub Action on push to `main`

---

## Session Behavior

- Caveman mode active. Drop articles, filler, pleasantries, hedging. Fragments OK. Technical terms exact. Code blocks unchanged.
- Pattern: `[thing] [action] [reason]. [next step].`
- No sycophantic openers or closing fluff. No emojis. No em-dashes — plain hyphens only.
- Auto-clarity override: write normally for security warnings, irreversible actions, multi-step sequences where fragment order risks misread. Resume caveman after.

## Token Efficiency

- Read existing files before writing. Don't re-read unless changed.
- Do not guess APIs, versions, flags, or package names — verify first.
- Never invent file paths, function names, or field names. Return null or "UNKNOWN" for unknowns.
- State the bug. Show the fix. Stop. No scope creep.

## Code Rules

- Simplest working solution. No over-engineering. No Tauri, no Electron — not warranted for v1 (see `docs/tauri-option.md` if native binary ever needed).
- No abstractions for single-use operations. Three similar lines beats premature abstraction.
- No speculative features. No comments unless WHY is non-obvious. No docstrings.
- No error handling for impossible scenarios. Trust internal guarantees.

## Architecture Rules

- **Never skip the pty.** `claude` detects TTY. `child_process.spawn` without `node-pty` = no tool call JSON emitted. Do not shortcut this.
- **`OutputParser` is pure.** No sockets, no DB, no Zustand inside it. Input: raw string. Output: typed event. Testable with fixture strings.
- **Diff panel is lazy.** `DiffService` called only on user click — not on every tool call.
- **`AgentBus` is the only cross-session channel.** No direct socket-to-socket messaging outside the bus.
- **`ThreadStore` is source of truth.** Don't duplicate thread/message state beyond what Zustand needs for current view.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| State | Zustand |
| Process server | Node.js + Fastify + `node-pty` + `ws` |
| Persistence | `better-sqlite3` (local) / Neon Postgres (cloud) |
| Diff | `diff2html` |
| Testing | Vitest |

## Key Modules (do not rename without updating this file)

| Module | Where | Responsibility |
|--------|-------|----------------|
| `ProcessManager` | server | Spawn `claude` via pty, expose write/kill |
| `OutputParser` | server | Raw pty bytes → typed events (pure) |
| `ThreadStore` | server | SQLite/Postgres CRUD for projects, threads, messages |
| `DiffService` | server | `git diff` → structured metadata |
| `AgentBus` | server | Cross-session WebSocket pub/sub |
| `ConversationPane` | React | Thread message list + input |
| `ToolCallCard` | React | Inline tool call, status badge, "View Diff" |
| `DiffPanel` | React | Lazy diff viewer, unified/split, hunk nav |
| `Sidebar` | React | Project + thread list, collapsible |
| `TeamPanel` | React | Multi-agent status overlay |

## Hosting

- Org repo (source of truth) → GitHub Action mirrors to personal repo on push to `main`
- Vercel (Hobby, free) watches personal repo → auto-deploys Next.js frontend
- Password protection: Next.js middleware, `SITE_PASSWORD` env var, no Vercel Pro needed
- Process server: runs locally alongside Next.js for local use. For remote, deploy to Render free tier or Railway; set `PROCESS_SERVER_URL` env var on Vercel

## Testing Rules

- Test external behavior, not implementation details. Never mock what you can run for real.
- `OutputParser`: unit tests with fixture strings, one per tool call type
- `ThreadStore`: integration tests against temp SQLite file
- `DiffService`: integration tests against real temp git repo (created in test setup)
- `ProcessManager`: integration test with mock echo process, assert events emitted
- React components: no tests — verify visually by running the app

## Before Shipping

```bash
npx tsc --noEmit && npm run test && npm run build
```

All three must pass before merge to `main`.

## Never Commit

`.env*`, `*.pem`, `*.key`, `node_modules/`, `.next/`

## Context Management

When context window near full: run `/compact` immediately. Resume from compact summary without re-reading files already in context.
