'use client'
import { useStore } from '@/lib/store'
import { Sidebar } from '@/components/Sidebar'
import { ConversationPane } from '@/components/ConversationPane'
import { DiffPanel } from '@/components/DiffPanel'

export default function Home() {
  const { sidebarOpen, setSidebarOpen } = useStore()

  return (
    <div className="flex h-screen relative">
      {sidebarOpen ? (
        <Sidebar />
      ) : (
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-8 flex-shrink-0 flex items-center justify-center text-neutral-500 hover:text-neutral-200 border-r border-neutral-800"
          aria-label="Expand sidebar"
        >
          →
        </button>
      )}
      <main className="flex flex-1 min-w-0">
        <ConversationPane />
        <DiffPanel />
      </main>
    </div>
  )
}
