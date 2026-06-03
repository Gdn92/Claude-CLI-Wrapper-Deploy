import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { getDiff } from '../src/diff-service'

let repoDir: string

beforeAll(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'diff-service-test-'))
  execSync('git init', { cwd: repoDir })
  execSync('git config user.email "test@test.com"', { cwd: repoDir })
  execSync('git config user.name "Test"', { cwd: repoDir })
  writeFileSync(join(repoDir, 'hello.ts'), 'const x = 1\n')
  execSync('git add . && git commit -m "init"', { cwd: repoDir })
  // Unstaged change — adds a line
  writeFileSync(join(repoDir, 'hello.ts'), 'const x = 1\nconst y = 2\n')
})

afterAll(() => {
  rmSync(repoDir, { recursive: true })
})

describe('getDiff', () => {
  it('returns diff metadata for unstaged changes', async () => {
    const result = await getDiff(repoDir)
    expect(result.files).toHaveLength(1)
    expect(result.files[0].newPath).toBe('hello.ts')
    expect(result.files[0].additions).toBe(1)
    expect(result.files[0].deletions).toBe(0)
    expect(result.totalAdditions).toBe(1)
    expect(result.totalDeletions).toBe(0)
  })

  it('returns empty files array when no changes', async () => {
    const cleanDir = mkdtempSync(join(tmpdir(), 'diff-clean-'))
    execSync('git init', { cwd: cleanDir })
    execSync('git config user.email "t@t.com" && git config user.name "T"', { cwd: cleanDir })
    writeFileSync(join(cleanDir, 'a.ts'), 'const a = 1\n')
    execSync('git add . && git commit -m "init"', { cwd: cleanDir })
    const result = await getDiff(cleanDir)
    expect(result.files).toHaveLength(0)
    rmSync(cleanDir, { recursive: true })
  })

  it('includes branch name', async () => {
    const result = await getDiff(repoDir)
    expect(typeof result.branch).toBe('string')
    expect(result.branch.length).toBeGreaterThan(0)
  })

  it('returns empty result if cwd is not a git repo', async () => {
    const noGitDir = mkdtempSync(join(tmpdir(), 'no-git-'))
    const result = await getDiff(noGitDir)
    expect(result.files).toHaveLength(0)
    rmSync(noGitDir, { recursive: true })
  })
})
