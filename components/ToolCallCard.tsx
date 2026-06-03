'use client'
import { useState } from 'react'
import { StatusBadge } from './ui/StatusBadge'
import type { ToolCallStartEvent, ToolCallEndEvent } from '@/lib/types'

interface ToolCallCardProps {
  start: ToolCallStartEvent
  end?: ToolCallEndEvent
  onViewDiff?: () => void
}

export function ToolCallCard({ start, end, onViewDiff }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const status = !end ? 'pending' : end.status === 'error' ? 'error' : 'success'
  const isFileEdit = start.toolType === 'Write' || start.toolType === 'Edit'

  return (
    <div className="mb-2 border border-neutral-800 rounded-lg overflow-hidden text-xs">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-neutral-800/50 bg-neutral-900/50"
        onClick={() => setExpanded(v => !v)}
      >
        <StatusBadge status={status} />
        <span className="text-neutral-300 font-mono flex-1 truncate">{start.label}</span>
        {isFileEdit && end && onViewDiff && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewDiff() }}
            className="text-blue-400 hover:text-blue-300 text-xs ml-auto shrink-0"
          >
            View Diff
          </button>
        )}
        <span className="text-neutral-600 ml-1 shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && end && (
        <div className="px-3 py-2 bg-neutral-950 font-mono text-neutral-400 text-xs max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-neutral-800">
          {end.output || '(no output)'}
        </div>
      )}
    </div>
  )
}
