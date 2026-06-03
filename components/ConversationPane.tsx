'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { wsClient } from '@/lib/ws-client'
import { TextBubble } from './ui/TextBubble'
import { ToolCallCard } from './ToolCallCard'
import type { TurnEvent, ToolCallStartEvent, ToolCallEndEvent, Message } from '@/lib/types'

const SERVER = process.env.NEXT_PUBLIC_PROCESS_SERVER_URL ?? 'http://localhost:3001'

interface DisplayItem {
  key: string
  type: 'text' | 'tool' | 'cost'
  role?: 'user' | 'assistant'
  content?: string
  start?: ToolCallStartEvent
  end?: ToolCallEndEvent
  costUsd?: number
  durationMs?: number
}

export function ConversationPane() {
  const {
    activeThreadId, activeProjectId, projects,
    isRunning, setRunning, setDiffPanelOpen, setCurrentDiff, setSessionId,
  } = useStore()
  const [input, setInput] = useState('')
  const [items, setItems] = useState<DisplayItem[]>([])
  const [pinned, setPinned] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const activeProject = projects.find(p => p.id === activeProjectId)

  // Load existing messages when thread changes
  useEffect(() => {
    if (!activeThreadId) { setItems([]); return }
    fetch(`${SERVER}/threads/${activeThreadId}/messages`)
      .then(r => r.json())
      .then((msgs: Message[]) => {
        setItems(msgs.map(m => ({
          key: m.id,
          type: m.type === 'text' ? 'text' : 'tool',
          role: m.role,
          content: m.content,
        })))
      })
      .catch(() => {})
  }, [activeThreadId])

  const handleEvent = useCallback((event: TurnEvent) => {
    if (event.type === 'session_init') {
      setSessionId(event.sessionId)
    } else if (event.type === 'text') {
      setItems(prev => [...prev, {
        key: `text-${Date.now()}-${Math.random()}`,
        type: 'text',
        role: 'assistant',
        content: event.content,
      }])
    } else if (event.type === 'tool_call_start') {
      setItems(prev => [...prev, {
        key: `tool-${event.id}`,
        type: 'tool',
        start: event,
      }])
    } else if (event.type === 'tool_call_end') {
      setItems(prev => prev.map(item =>
        item.start?.id === event.id ? { ...item, end: event } : item
      ))
    } else if (event.type === 'turn_end') {
      setRunning(false)
      setItems(prev => [...prev, {
        key: `cost-${Date.now()}`,
        type: 'cost',
        costUsd: event.costUsd,
        durationMs: event.durationMs,
      }])
    } else if ((event as unknown as { type: string; diff: unknown }).type === 'diff_result') {
      setCurrentDiff((event as unknown as { type: string; diff: unknown }).diff)
    }
  }, [setRunning, setSessionId, setCurrentDiff])

  useEffect(() => {
    wsClient.connect()
    return wsClient.on(handleEvent)
  }, [handleEvent])

  useEffect(() => {
    if (!pinned) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items, pinned])

  async function send() {
    if (!input.trim() || !activeThreadId || !activeProject) return
    const content = input.trim()
    setInput('')
    setRunning(true)
    setItems(prev => [...prev, {
      key: `user-${Date.now()}`,
      type: 'text',
      role: 'user',
      content,
    }])

    // Auto-title thread from first user message
    const userMessages = items.filter(i => i.role === 'user')
    if (userMessages.length === 0) {
      const title = content.slice(0, 60)
      fetch(`${SERVER}/threads/${activeThreadId}/title`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).catch(() => {})
    }

    wsClient.send('send', {
      content,
      threadId: activeThreadId,
      projectPath: activeProject.path,
    })
  }

  function cancel() {
    wsClient.send('cancel', {})
    setRunning(false)
  }

  if (!activeThreadId) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
        Select or create a thread to start
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 relative overflow-hidden">
      {/* Message list */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
        onScroll={(e) => {
          const el = e.currentTarget
          setPinned(el.scrollHeight - el.scrollTop - el.clientHeight > 50)
        }}
      >
        {items.map(item => {
          if (item.type === 'cost') {
            return (
              <div key={item.key} className="flex items-center gap-2 mb-4 ml-9">
                <div className="h-px flex-1 bg-neutral-800" />
                <span className="text-neutral-600 text-xs font-mono shrink-0">
                  ${item.costUsd?.toFixed(4)} · {((item.durationMs ?? 0) / 1000).toFixed(1)}s
                </span>
                <div className="h-px flex-1 bg-neutral-800" />
              </div>
            )
          }
          if (item.type === 'text') {
            return (
              <TextBubble key={item.key} content={item.content ?? ''} role={item.role ?? 'assistant'} />
            )
          }
          if (!item.start) {
            return (
              <div key={item.key} className="mb-2 ml-9 text-xs text-neutral-600 font-mono overflow-hidden">
                <span className="block truncate">{item.content ?? '(tool call)'}</span>
              </div>
            )
          }
          return (
            <ToolCallCard
              key={item.key}
              start={item.start}
              end={item.end}
              onViewDiff={() => {
                wsClient.send('diff_request', { cwd: activeProject?.path ?? '' })
                setDiffPanelOpen(true)
              }}
            />
          )
        })}
        {isRunning && (
          <div className="flex gap-3 mb-4 ml-9">
            <div className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {pinned && (
        <button
          onClick={() => { setPinned(false); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
          className="absolute bottom-20 right-4 bg-neutral-700 text-white text-xs px-2 py-1 rounded-full shadow-lg"
        >
          Jump to latest
        </button>
      )}

      {/* Input bar */}
      <div className="border-t border-neutral-800 px-4 py-3 flex gap-2 items-end bg-neutral-950 shrink-0">
        <textarea
          value={input}
          onChange={e => {
            setInput(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
          placeholder="Message Claude... (Shift+Enter for newline)"
          rows={1}
          className="flex-1 bg-neutral-900 text-white text-sm px-3 py-2 rounded-xl border border-neutral-700 focus:border-neutral-500 outline-none resize-none min-h-[38px] leading-relaxed"
          style={{ maxHeight: '160px', overflowY: 'auto' }}
        />
        {isRunning ? (
          <button
            onClick={cancel}
            className="bg-red-500/20 text-red-400 px-3 py-2 rounded-xl text-sm hover:bg-red-500/30 shrink-0 h-[38px]"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={send}
            className="bg-white text-black px-4 py-2 rounded-xl text-sm font-medium hover:bg-neutral-200 shrink-0 h-[38px]"
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}
