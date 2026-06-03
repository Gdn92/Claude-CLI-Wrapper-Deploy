'use client'
import { useStore } from '@/lib/store'

export default function Home() {
  const { sidebarOpen, setSidebarOpen } = useStore()

  return (
    <div className="flex h-screen relative">
      {sidebarOpen ? (
        <aside className="w-56 border-r border-neutral-800 flex-shrink-0 bg-neutral-950" />
      ) : (
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-8 flex-shrink-0 flex items-center justify-center text-neutral-500 hover:text-neutral-200 border-r border-neutral-800"
        >
          -&gt;
        </button>
      )}
      <main className="flex flex-1 min-w-0">
        <div className="flex-1 min-w-0 flex items-center justify-center text-neutral-600 text-sm">
          Select or create a thread to start
        </div>
        <div className="w-96 border-l border-neutral-800 flex-shrink-0" />
      </main>
    </div>
  )
}
