export function TextBubble({ content, role }: { content: string; role: 'user' | 'assistant' }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-xl bg-neutral-700 text-white px-3 py-2 rounded-xl text-sm whitespace-pre-wrap">
          {content}
        </div>
      </div>
    )
  }
  return (
    <div className="mb-3">
      <div className="text-neutral-200 text-sm whitespace-pre-wrap leading-relaxed">{content}</div>
    </div>
  )
}
