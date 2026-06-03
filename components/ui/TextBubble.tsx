'use client'
import ReactMarkdown from 'react-markdown'

export function TextBubble({ content, role }: { content: string; role: 'user' | 'assistant' }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] bg-neutral-700 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-3 mb-4">
      <div className="shrink-0 w-6 h-6 rounded-full bg-orange-500/80 flex items-center justify-center text-xs font-bold text-white mt-0.5">
        C
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="prose prose-invert prose-sm max-w-none
          prose-p:my-1 prose-p:leading-relaxed
          prose-headings:text-neutral-100 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
          prose-code:bg-neutral-800 prose-code:text-orange-300 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-700 prose-pre:rounded-lg prose-pre:p-3 prose-pre:text-xs
          prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
          prose-strong:text-neutral-100
          prose-blockquote:border-orange-500/50 prose-blockquote:text-neutral-400
          text-neutral-200">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
