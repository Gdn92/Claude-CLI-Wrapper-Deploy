const SERVER = process.env.NEXT_PUBLIC_PROCESS_SERVER_URL ?? 'http://localhost:3001'

let tokenPromise: Promise<string | null> | null = null

// Fetches PROCESS_SERVER_TOKEN once (via the password-gated /api/process-token
// route) and caches it for the life of the page. Never put this token in a
// NEXT_PUBLIC_ var — it must not ship in the client bundle.
function getToken(): Promise<string | null> {
  if (!tokenPromise) {
    tokenPromise = fetch('/api/process-token')
      .then((r) => r.json())
      .then((data) => data.token ?? null)
      .catch(() => null)
  }
  return tokenPromise
}

// fetch() wrapper that talks to the process server with the bearer token
// attached. Path should start with '/', e.g. serverFetch('/projects').
export async function serverFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`${SERVER}${path}`, { ...init, headers })
}

// Builds the /ws URL with ?token= appended (browsers can't set WS headers).
export async function getProcessServerWsUrl(): Promise<string> {
  const token = await getToken()
  const base = SERVER.replace(/^http/, 'ws') + '/ws'
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}
