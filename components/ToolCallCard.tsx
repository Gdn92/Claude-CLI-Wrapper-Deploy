'use client'
import { useState } from 'react'
import type { ToolCallStartEvent, ToolCallEndEvent } from '@/lib/types'

interface ToolCallCardProps {
  start: ToolCallStartEvent
  end?: ToolCallEndEvent
  onViewDiff?: () => void
}

const TOOL_ICONS: Record<string, string> = {
  Read: '📄',
  Write: '✏️',
  Edit: '✏️',
  Bash: '⚡',
  Glob: '🔍',
  Grep: '🔍',
  LS: '📁',
  WebFetch: '🌐',
  WebSearch: '🌐',
}

const TOOL_COLORS: Record<string, string> = {
  Read: 'text-blue-400',
  Write: 'text-orange-400',
  Edit: 'text-orange-400',
  Bash: 'text-green-400',
  Glob: 'text-purple-400',
  Grep: 'text-purple-400',
  LS: 'text-blue-400',
  WebFetch: 'text-cyan-400',
  WebSearch: 'text-cyan-400',
}

export function ToolCallCard({ start, end, onViewDiff }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isPending = !end
  const isError = end?.status === 'error'
  const isFileEdit = start.toolType === 'Write' || start.toolType === 'Edit'
  const icon = TOOL_ICONS[start.toolType] ?? '🔧'
  const color = TOOL_COLORS[start.toolType] ?? 'text-neutral-400'

  return (
    <div className="mb-2 ml-9 rounded-lg border border-neutral-800 overflow-hidden text-xs bg-neutral-950 max-w-full">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-neutral-800/40 select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="text-sm">{icon}</span>
        <span className={`font-mono font-medium ${color} shrink-0`}>{start.toolType}</span>
        <span className="text-neutral-400 truncate flex-1 font-mono">
          {start.label.replace(start.toolType, '').trim()}
        </span>
        {isPending && (
          <span className="w-3 h-3 rounded-full border-2 border-neutral-500 border-t-white animate-spin shrink-0" />
        )}
        {!isPending && !isError && (
          <span className="text-green-500 shrink-0">✓</span>
        )}
        {isError && (
          <span className="text-red-400 shrink-0">✗</span>
        )}
        {isFileEdit && end && onViewDiff && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewDiff() }}
            className="text-blue-400 hover:text-blue-300 shrink-0 ml-1"
          >
            diff
          </button>
        )}
        <span className="text-neutral-700 shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="border-t border-neutral-800 bg-neutral-900/50">
          {Object.keys(start.params).length > 0 && (
            <div className="px-3 py-2 font-mono text-neutral-500 text-xs overflow-x-auto border-b border-neutral-800/50">
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(start.params, null, 2).slice(0, 500)}</pre>
            </div>
          )}
          {end?.output && (
            <div className="px-3 py-2 font-mono text-neutral-400 text-xs max-h-40 overflow-y-auto overflow-x-hidden">
              <pre className="whitespace-pre-wrap break-all">{String(end.output).slice(0, 1000) || '(no output)'}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
