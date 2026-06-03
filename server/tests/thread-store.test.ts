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

  describe('tasks', () => {
    it('creates and retrieves a task', () => {
      const p = store.createProject('/path', 'P')
      const t = store.createThread(p.id, 'T')
      const taskId = store.createTask(t.id, '/path', 'do something')
      const task = store.getTask(taskId)
      expect(task).not.toBeNull()
      expect(task?.status).toBe('pending')
      expect(task?.content).toBe('do something')
    })

    it('updates task status', () => {
      const p = store.createProject('/path', 'P')
      const t = store.createThread(p.id, 'T')
      const taskId = store.createTask(t.id, '/path', 'work')
      store.updateTaskStatus(taskId, 'running')
      expect(store.getTask(taskId)?.status).toBe('running')
      store.updateTaskStatus(taskId, 'done')
      expect(store.getTask(taskId)?.status).toBe('done')
    })
  })

  describe('push subscriptions', () => {
    it('upserts and lists push subscriptions', () => {
      const sub = { endpoint: 'https://push.example.com/sub1', keys: { p256dh: 'key1', auth: 'auth1' } }
      store.upsertPushSubscription(sub)
      const subs = store.listPushSubscriptions()
      expect(subs).toHaveLength(1)
      expect(subs[0].endpoint).toBe('https://push.example.com/sub1')
    })

    it('deletes a push subscription', () => {
      const sub = { endpoint: 'https://push.example.com/sub2', keys: { p256dh: 'k', auth: 'a' } }
      store.upsertPushSubscription(sub)
      store.deletePushSubscription(sub.endpoint)
      expect(store.listPushSubscriptions()).toHaveLength(0)
    })

    it('upserts (replaces) duplicate endpoint', () => {
      const sub = { endpoint: 'https://push.example.com/sub3', keys: { p256dh: 'k1', auth: 'a1' } }
      store.upsertPushSubscription(sub)
      store.upsertPushSubscription({ ...sub, keys: { p256dh: 'k2', auth: 'a2' } })
      const subs = store.listPushSubscriptions()
      expect(subs).toHaveLength(1)
      expect(subs[0].keys.p256dh).toBe('k2')
    })
  })
})
