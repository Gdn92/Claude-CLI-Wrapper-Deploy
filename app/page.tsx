'use client'
import { useStore } from '@/lib/store'
import { Sidebar } from '@/components/Sidebar'
import { ConversationPane } from '@/components/ConversationPane'
import { DiffPanel } from '@/components/DiffPanel'
import { TeamPanel } from '@/components/TeamPanel'

export default function Home() {
  const { sidebarOpen, setSidebarOpen } = useStore()

  return (
    <div className="flex h-screen relative overflow-hidden">
      {sidebarOpen ? (
        <Sidebar />
      ) : (
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-10 flex-shrink-0 flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 border-r border-neutral-800 transition-colors"
          aria-label="Expand sidebar"
          title="Open sidebar"
        >
          <span className="text-xs">☰</span>
        </button>
      )}
      <main className="flex flex-1 min-w-0 overflow-hidden">
        <ConversationPane />
        <DiffPanel />
      </main>
      <TeamPanel />
    </div>
  )
}
