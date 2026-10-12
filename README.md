# Claude-CLI-Wrapper

## Security

- `SITE_PASSWORD` (Next.js, Vercel) — gates every page behind `/login` via `middleware.ts`. The auth cookie stores an HMAC of a fixed string, never the raw password.
- `PROCESS_SERVER_TOKEN` (process server, Render/local) — bearer token required on every `server/` route (`/projects`, `/threads`, `/tasks`, `/push/*`, `/ws`) once set. **Without it, the process server binds to `127.0.0.1` only** (local-only mode, no auth needed) and logs a warning. **In production (`NODE_ENV=production`) it is required — the server refuses to start without it.** Set it on Render, and the Next.js app reads the same value server-side to attach `Authorization: Bearer <token>` (REST) / `?token=<token>` (WebSocket) via `lib/process-server.ts`. Never put it in a `NEXT_PUBLIC_*` var.
- `ALLOWED_ORIGIN` (process server, Render) — restricts CORS to this origin. If unset, only `http://localhost:*` origins are allowed.

To keep a remote (Render) process server usable from the deployed Next.js app, set on Render: `PROCESS_SERVER_TOKEN` (any long random string) and optionally `ALLOWED_ORIGIN` (your Vercel deployment URL). Set the identical `PROCESS_SERVER_TOKEN` value on Vercel so `app/api/process-token` can hand it to the client.