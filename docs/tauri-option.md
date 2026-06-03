# Tauri Option (parked — not in v1 scope)

Deferred in favour of Next.js + Node.js stack. Revisit if a native desktop binary becomes a hard requirement.

## Why it was considered

- ~5 MB binary vs Electron's 150 MB+
- Cold-start < 1s on Apple Silicon
- No bundled Chromium
- Rust backend = memory safe, fast pty handling

## Stack (if revived)

| Layer | Tech |
|-------|------|
| Shell | Tauri v2 (Rust core + system WebView) |
| UI | React + TypeScript + Tailwind in WebView |
| State | Zustand |
| Persistence | SQLite via `tauri-plugin-sql` |
| Process mgmt | `portable-pty` (Rust crate) |
| Diff | `diff2html` |
| IPC | Tauri commands + events over `contextBridge` (no `nodeIntegration`) |

## Key module that differs from web stack

**`PtyBridge` (Rust/Tauri core)**
Wraps `portable-pty`. Spawns `claude` with correct `cwd` + env. Streams raw bytes to `OutputParser`. Exposes `write_stdin` and `kill` as Tauri commands. Decoupled from all UI state.

**`WindowManager` (Rust/Tauri core)**
Spawns + tracks additional `BrowserWindow` instances. Each window = unique `windowId` + optional `teamId`. Registry: `Map<windowId, {teamId?, processHandle, status}>`. Commands: `open_window`, `close_window`, `list_windows`, `assign_team`.

## Trade-offs vs web stack

| | Tauri | Next.js + Node |
|---|---|---|
| Binary size | ~5 MB | N/A (browser app) |
| Web hosting | Not possible | Vercel (free) |
| Build complexity | High (Rust toolchain) | Low |
| Codebase | Two languages (Rust + TS) | One (TypeScript) |
| Multi-window | Tauri `BrowserWindow` API | Browser tabs (free) |
| Pty | `portable-pty` Rust crate | `node-pty` npm package |

## Verdict

Web stack wins unless native binary is a hard requirement (e.g. app store distribution, offline-only use, no Node.js on target machine).
