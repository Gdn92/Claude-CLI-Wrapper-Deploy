'use client'
import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'

// Reconstruct unified diff string from our DiffMetadata for diff2html
function metadataToDiffString(diff: any): string {
  if (!diff?.files?.length) return ''
  const lines: string[] = []
  for (const file of diff.files) {
    lines.push(`diff --git a/${file.oldPath} b/${file.newPath}`)
    lines.push(`--- a/${file.oldPath}`)
    lines.push(`+++ b/${file.newPath}`)
    for (const hunk of file.hunks) {
      lines.push(hunk.header)
      lines.push(...hunk.lines)
    }
  }
  return lines.join('\n')
}

export function DiffPanel() {
  const { currentDiff, diffStyle, diffPanelOpen, setDiffPanelOpen, setDiffStyle } = useStore()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!currentDiff || !containerRef.current || !diffPanelOpen) return
    const raw = metadataToDiffString(currentDiff)
    if (!raw) return

    // Dynamic import keeps diff2html out of initial bundle
    import('diff2html').then(({ html }) => {
      containerRef.current!.innerHTML = html(raw, {
        drawFileList: false,
        outputFormat: diffStyle === 'split' ? 'side-by-side' : 'line-by-line',
      })
    })
  }, [currentDiff, diffStyle, diffPanelOpen])

  if (!diffPanelOpen) return null

  const fileCount = (currentDiff as any)?.files?.length ?? 0
  const branch = (currentDiff as any)?.branch ?? ''

  return (
    <div className="w-[480px] flex-shrink-0 border-l border-neutral-800 flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 text-xs flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-neutral-300 font-medium">Diff</span>
          {branch && <span className="text-neutral-500 font-mono">{branch}</span>}
          {fileCount > 0 && (
            <span className="text-neutral-500">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDiffStyle(diffStyle === 'unified' ? 'split' : 'unified')}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            {diffStyle === 'unified' ? 'Split' : 'Unified'}
          </button>
          <button
            onClick={() => setDiffPanelOpen(false)}
            className="text-neutral-500 hover:text-white transition-colors"
            aria-label="Close diff panel"
          >
            x
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-neutral-950 text-xs">
        {!currentDiff || fileCount === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
            No changes
          </div>
        ) : (
          <div ref={containerRef} className="diff2html-wrapper p-2" />
        )}
      </div>
    </div>
  )
}
