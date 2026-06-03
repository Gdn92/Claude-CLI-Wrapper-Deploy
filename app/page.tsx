'use client'
import { useStore } from '@/lib/store'
import { Sidebar } from '@/components/Sidebar'
import { ConversationPane } from '@/components/ConversationPane'
import { DiffPanel } from '@/components/DiffPanel'
import { TeamPanel } from '@/components/TeamPanel'

export default function Home() {
  const { sidebarOpen, setSidebarOpen } = useStore()

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950">
      {/* Mobile: full-screen overlay sidebar with backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        md:relative fixed inset-y-0 left-0 z-40 flex-shrink-0
        transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:-translate-x-full'}
      `}>
        {sidebarOpen && <Sidebar />}
      </div>

      {/* Hamburger — always in layout flow so content takes full width on mobile */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex-shrink-0 w-10 flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 border-r border-neutral-800 transition-colors"
          aria-label="Open sidebar"
        >
          ☰
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
