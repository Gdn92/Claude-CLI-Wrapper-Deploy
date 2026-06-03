import { exec } from 'child_process'
import { promisify } from 'util'
import type { DiffMetadata, DiffFile, DiffHunk } from './types'

const execAsync = promisify(exec)

function parseDiff(rawDiff: string): DiffFile[] {
  const files: DiffFile[] = []
  const fileBlocks = rawDiff.split(/^diff --git /m).filter(Boolean)

  for (const block of fileBlocks) {
    const lines = block.split('\n')
    const paths = lines[0].match(/a\/(.+) b\/(.+)/)
    if (!paths) continue

    const oldPath = paths[1]
    const newPath = paths[2]
    let additions = 0
    let deletions = 0
    const hunks: DiffHunk[] = []
    let currentHunk: DiffHunk | null = null

    for (const line of lines.slice(1)) {
      if (line.startsWith('@@')) {
        const m = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
        if (m) {
          currentHunk = {
            header: line,
            oldStart: parseInt(m[1]),
            oldLines: parseInt(m[2] ?? '1'),
            newStart: parseInt(m[3]),
            newLines: parseInt(m[4] ?? '1'),
            lines: [],
          }
          hunks.push(currentHunk)
        }
      } else if (currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++
          currentHunk.lines.push(line)
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++
          currentHunk.lines.push(line)
        } else if (line.startsWith(' ')) {
          currentHunk.lines.push(line)
        }
      }
    }

    files.push({ oldPath, newPath, additions, deletions, hunks })
  }

  return files
}

export async function getDiff(cwd: string): Promise<DiffMetadata> {
  let branch = 'unknown'

  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd })
    branch = stdout.trim()
  } catch {
    // not a git repo
    return { branch: 'not a git repo', files: [], totalAdditions: 0, totalDeletions: 0 }
  }

  let rawDiff = ''
  try {
    const { stdout } = await execAsync('git diff', { cwd, maxBuffer: 10 * 1024 * 1024 })
    rawDiff = stdout
  } catch {
    return { branch, files: [], totalAdditions: 0, totalDeletions: 0 }
  }

  const files = parseDiff(rawDiff)
  return {
    branch,
    files,
    totalAdditions: files.reduce((s, f) => s + f.additions, 0),
    totalDeletions: files.reduce((s, f) => s + f.deletions, 0),
  }
}
