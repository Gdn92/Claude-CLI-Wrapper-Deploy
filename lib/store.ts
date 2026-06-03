import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, Thread, Message } from './types'

interface AppStore {
  // UI state
  sidebarOpen: boolean
  diffPanelOpen: boolean
  diffStyle: 'unified' | 'split'
  activeProjectId: string | null
  activeThreadId: string | null
  isRunning: boolean
  currentDiff: unknown | null

  // Data
  projects: Project[]
  threads: Thread[]
  messages: Message[]

  // Team
  teamId: string | null
  sessionId: string | null
  teamSessions: Array<{ sessionId: string; alive: boolean; label: string; color: string }>
  teamPanelOpen: boolean

  // Actions
  setSidebarOpen: (v: boolean) => void
  setDiffPanelOpen: (v: boolean) => void
  setDiffStyle: (v: 'unified' | 'split') => void
  setActiveProject: (id: string) => void
  setActiveThread: (id: string) => void
  setRunning: (v: boolean) => void
  setCurrentDiff: (d: unknown) => void
  setProjects: (p: Project[]) => void
  setThreads: (t: Thread[]) => void
  setMessages: (m: Message[]) => void
  appendMessage: (m: Message) => void
  setTeamId: (id: string) => void
  setSessionId: (id: string) => void
  setTeamSessions: (s: AppStore['teamSessions']) => void
  setTeamPanelOpen: (v: boolean) => void
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      diffPanelOpen: false,
      diffStyle: 'unified',
      activeProjectId: null,
      activeThreadId: null,
      isRunning: false,
      currentDiff: null,
      projects: [],
      threads: [],
      messages: [],
      teamId: null,
      sessionId: null,
      teamSessions: [],
      teamPanelOpen: false,

      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      setDiffPanelOpen: (v) => set({ diffPanelOpen: v }),
      setDiffStyle: (v) => set({ diffStyle: v }),
      setActiveProject: (id) => set({ activeProjectId: id }),
      setActiveThread: (id) => set({ activeThreadId: id }),
      setRunning: (v) => set({ isRunning: v }),
      setCurrentDiff: (d) => set({ currentDiff: d }),
      setProjects: (projects) => set({ projects }),
      setThreads: (threads) => set({ threads }),
      setMessages: (messages) => set({ messages }),
      appendMessage: (m) => set(s => ({ messages: [...s.messages, m] })),
      setTeamId: (id) => set({ teamId: id }),
      setSessionId: (id) => set({ sessionId: id }),
      setTeamSessions: (s) => set({ teamSessions: s }),
      setTeamPanelOpen: (v) => set({ teamPanelOpen: v }),
    }),
    {
      name: 'ccw-ui',
      // Only persist layout preferences, not data (data comes from server)
      partialize: (s) => ({
        sidebarOpen: s.sidebarOpen,
        diffStyle: s.diffStyle,
        activeProjectId: s.activeProjectId,
        activeThreadId: s.activeThreadId,
      }),
    }
  )
)
