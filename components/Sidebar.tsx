'use client'
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/lib/store'
import type { Project, Thread } from '@/lib/types'

const SERVER = process.env.NEXT_PUBLIC_PROCESS_SERVER_URL ?? 'http://localhost:3001'

export function Sidebar() {
  const {
    projects, threads, activeProjectId, activeThreadId,
    setProjects, setThreads, setActiveProject, setActiveThread,
    setSidebarOpen,
  } = useStore()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${SERVER}/projects`)
      .then(r => r.json())
      .then(setProjects)
      .catch(() => {})
  }, [setProjects])

  useEffect(() => {
    if (!activeProjectId) return
    fetch(`${SERVER}/projects/${activeProjectId}/threads`)
      .then(r => r.json())
      .then(setThreads)
      .catch(() => {})
  }, [activeProjectId, setThreads])

  // Close menu on outside click
  useEffect(() => {
    if (!menuId) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuId])

  async function newProject() {
    const path = prompt('Project directory path (absolute):')
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

  function startRename(id: string, title: string) {
    setMenuId(null)
    setRenamingId(id)
    setRenameValue(title)
    setTimeout(() => renameRef.current?.select(), 0)
  }

  async function commitRename(id: string) {
    const title = renameValue.trim()
    if (!title) { setRenamingId(null); return }
    await fetch(`${SERVER}/threads/${id}/title`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).catch(() => {})
    setThreads(threads.map(t => t.id === id ? { ...t, title } : t))
    setRenamingId(null)
  }

  async function deleteThread(id: string) {
    setMenuId(null)
    if (!confirm('Delete this thread?')) return
    await fetch(`${SERVER}/threads/${id}`, { method: 'DELETE' })
    setThreads(threads.filter(t => t.id !== id))
    if (activeThreadId === id) setActiveThread('')
  }

  return (
    <aside className="w-56 border-r border-neutral-800 flex flex-col h-full bg-neutral-950 text-sm flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-3 border-b border-neutral-800">
        <span className="text-neutral-400 font-medium text-xs uppercase tracking-wider">Projects</span>
        <button
          onClick={() => setSidebarOpen(false)}
          className="text-neutral-500 hover:text-neutral-200 text-xs"
          aria-label="Collapse sidebar"
        >
          ←
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {projects.map(p => (
          <div key={p.id}>
            <button
              onClick={() => setActiveProject(p.id)}
              className={`w-full text-left px-3 py-2 text-xs font-medium truncate transition-colors ${
                activeProjectId === p.id
                  ? 'text-white bg-neutral-800'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              {p.name}
            </button>
            {activeProjectId === p.id && (
              <div className="ml-3">
                {threads.map(t => (
                  <div key={t.id}>
                    <div
                      onClick={() => setActiveThread(t.id)}
                      className={`group flex items-center gap-1 px-2 py-1 cursor-pointer rounded-sm transition-colors ${
                        activeThreadId === t.id
                          ? 'bg-neutral-700 text-white'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                      }`}
                    >
                      {renamingId === t.id ? (
                        <input
                          ref={renameRef}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => commitRename(t.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitRename(t.id)
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 bg-neutral-600 text-white text-xs px-1 rounded outline-none min-w-0"
                        />
                      ) : (
                        <span className="truncate text-xs flex-1">{t.title}</span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setMenuId(menuId === t.id ? null : t.id) }}
                        className="opacity-0 group-hover:opacity-100 shrink-0 text-neutral-500 hover:text-neutral-200 text-xs px-0.5"
                        aria-label="Thread options"
                      >
                        •••
                      </button>
                    </div>
                    {menuId === t.id && (
                      <div ref={menuRef} className="mx-2 mb-1 bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => startRename(t.id, t.title)}
                          className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => deleteThread(t.id)}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-700 transition-colors border-t border-neutral-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={newThread}
                  className="w-full text-left px-2 py-1 text-neutral-500 hover:text-neutral-200 text-xs transition-colors"
                >
                  + New thread
                </button>
              </div>
            )}
          </div>
        ))}
        {projects.length === 0 && (
          <p className="px-3 py-4 text-neutral-600 text-xs">No projects yet</p>
        )}
      </div>

      <div className="border-t border-neutral-800 p-2">
        <button
          onClick={newProject}
          className="w-full text-xs text-neutral-500 hover:text-neutral-200 py-1 transition-colors"
        >
          + Add project
        </button>
      </div>
    </aside>
  )
}
