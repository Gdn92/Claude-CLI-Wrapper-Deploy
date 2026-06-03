export function StatusBadge({ status }: { status: 'pending' | 'success' | 'error' }) {
  const styles = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    success: 'bg-green-500/20 text-green-400',
    error: 'bg-red-500/20 text-red-400',
  }
  const labels = { pending: '●', success: '✓', error: '✕' }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
