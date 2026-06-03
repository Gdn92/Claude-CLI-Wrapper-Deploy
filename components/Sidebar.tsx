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
      .catch(() => {}) // server may not be running yet
  }, [])

  useEffect(() => {
    if (!activeProjectId) return
    fetch(`${SERVER}/projects/${activeProjectId}/threads`)
      .then(r => r.json())
      .then(setThreads)
      .catch(() => {})
  }, [activeProjectId])

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

  async function deleteThread(id: string, e: React.MouseEvent) {
    e.stopPropagation()
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
                  <div
                    key={t.id}
                    onClick={() => setActiveThread(t.id)}
                    className={`group flex items-center justify-between px-2 py-1 cursor-pointer rounded-sm transition-colors ${
                      activeThreadId === t.id
                        ? 'bg-neutral-700 text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    <span className="truncate text-xs">{t.title}</span>
                    <button
                      onClick={(e) => deleteThread(t.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 ml-1 text-xs shrink-0"
                      aria-label="Delete thread"
                    >
                      x
                    </button>
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
