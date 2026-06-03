import 'dotenv/config'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { ThreadStore } from './thread-store'
import { AgentBus } from './agent-bus'
import { handleConnection } from './ws-handler'
import { PushService } from './push-service'
import { TaskRunner } from './task-runner'
import type webpush from 'web-push'

const PORT = parseInt(process.env.PORT ?? '3001')
const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), 'data', 'threads.db')

mkdirSync(join(process.cwd(), 'data'), { recursive: true })

const store = new ThreadStore(DB_PATH)
const bus = new AgentBus()
const push = new PushService(store)
const taskRunner = new TaskRunner(store, push)

const app = Fastify({ logger: true })

async function main() {
  await app.register(websocket)

  // WebSocket endpoint — one connection per browser session
  app.get('/ws', { websocket: true }, (socket) => {
    handleConnection(socket as any, bus, store)
  })

  // --- REST: thread/project CRUD ---

  app.get('/projects', async () => store.listProjects())

  app.post<{ Body: { path: string; name: string } }>('/projects', async (req) => {
    return store.createProject(req.body.path, req.body.name)
  })

  app.get<{ Params: { projectId: string } }>('/projects/:projectId/threads', async (req) => {
    return store.listThreads(req.params.projectId)
  })

  app.post<{ Body: { projectId: string; title: string } }>('/threads', async (req) => {
    return store.createThread(req.body.projectId, req.body.title)
  })

  app.get<{ Params: { threadId: string } }>('/threads/:threadId/messages', async (req) => {
    return store.getMessages(req.params.threadId)
  })

  app.delete<{ Params: { threadId: string } }>('/threads/:threadId', async (req) => {
    store.deleteThread(req.params.threadId)
    return { ok: true }
  })

  app.patch<{ Params: { threadId: string }; Body: { title: string } }>('/threads/:threadId/title', async (req) => {
    store.updateThreadTitle(req.params.threadId, req.body.title)
    return { ok: true }
  })

  // Push subscription registration (browser calls this on first visit)
  app.post<{ Body: webpush.PushSubscription }>('/push/subscribe', async (req) => {
    push.addSubscription(req.body)
    return { ok: true }
  })

  // Expose public VAPID key so browser can construct push subscription
  app.get('/push/vapid-public-key', async () => ({
    key: process.env.VAPID_PUBLIC_KEY ?? '',
  }))

  // Async task submission — returns immediately, claude runs in background
  app.post<{ Body: { threadId: string; projectPath: string; content: string } }>('/tasks', async (req) => {
    const { threadId, projectPath, content } = req.body
    store.appendMessage(threadId, 'user', 'text', content, {})
    const taskId = store.createTask(threadId, projectPath, content)
    taskRunner.run(taskId, threadId, projectPath, content)
    return { taskId, status: 'running' }
  })

  await app.listen({ port: PORT, host: '0.0.0.0' })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
