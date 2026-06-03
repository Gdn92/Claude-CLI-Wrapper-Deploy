import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { Project, Thread, Message, Task } from './types'

export class ThreadStore {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    // WAL mode: concurrent reads don't block writes
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

      CREATE INDEX IF NOT EXISTS idx_threads_project ON threads(project_id);
      CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);
    `)
  }

  close() {
    this.db.close()
  }

  // --- Projects ---

  createProject(path: string, name: string): Project {
    const project: Project = { id: randomUUID(), path, name, createdAt: Date.now() }
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

  // --- Threads ---

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

  // --- Messages ---

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
    // bump thread updated_at so sidebar sorts correctly
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

  // --- Push subscriptions ---

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

  // --- Tasks (async execution queue) ---

  createTask(threadId: string, projectPath: string, content: string): string {
    const id = randomUUID()
    const now = Date.now()
    this.db.prepare(
      'INSERT INTO tasks (id, thread_id, project_path, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, threadId, projectPath, content, 'pending', now, now)
    return id
  }

  getTask(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any
    if (!row) return null
    return {
      id: row.id, threadId: row.thread_id, projectPath: row.project_path,
      content: row.content, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    }
  }

  updateTaskStatus(id: string, status: Task['status']) {
    this.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), id)
  }
}
