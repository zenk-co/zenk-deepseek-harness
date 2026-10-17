/** Session working-directory git identity for list summaries. */
import { execFileSync } from 'node:child_process'
import { basename } from 'node:path'
import type { SessionGitInfo } from './types.ts'

/** Milliseconds a git child may run before resolution fails silent. */
export const GIT_INFO_TIMEOUT_MS = 2_000

/** Synchronous git execution used by the resolver; injectable for tests. */
export type GitExecSync = (
  file: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly timeout: number },
) => string

/**
 * Default git execution without a shell.
 * @param file - executable name.
 * @param args - arguments, never shell-interpreted.
 * @param options - working directory and timeout.
 * @returns collected stdout.
 */
export function defaultGitExecSync(
  file: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly timeout: number },
): string {
  return execFileSync(file, [...args], {
    cwd: options.cwd,
    timeout: options.timeout,
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** Resolves repository basename and current branch per working directory with caching. */
export class SessionGitInfoResolver {
  private readonly cache = new Map<string, SessionGitInfo | undefined>()

  /**
   * @param exec - synchronous git execution, defaults to shell-free execFileSync.
   */
  constructor(private readonly exec: GitExecSync = defaultGitExecSync) {}

  /**
   * Resolve git identity for one working directory without throwing.
   * @param cwd - Session working directory, possibly absent.
   * @returns repository basename and branch, or undefined outside a git checkout or on any failure.
   */
  resolve(cwd: string | undefined): SessionGitInfo | undefined {
    if (cwd === undefined || cwd === '') return undefined
    if (this.cache.has(cwd)) return this.cache.get(cwd)
    const info = this.lookup(cwd)
    this.cache.set(cwd, info)
    return info
  }

  /** Drop all cached resolutions, primarily for tests. */
  clear(): void {
    this.cache.clear()
  }

  private lookup(cwd: string): SessionGitInfo | undefined {
    try {
      const toplevel = this.exec('git', ['rev-parse', '--show-toplevel'], {
        cwd, timeout: GIT_INFO_TIMEOUT_MS,
      }).trim()
      if (toplevel === '') return undefined
      const repo = basename(toplevel)
      if (repo === '') return undefined
      const branch = this.exec('git', ['branch', '--show-current'], {
        cwd, timeout: GIT_INFO_TIMEOUT_MS,
      }).trim()
      if (branch === '') return undefined
      return { repo, branch }
    } catch {
      return undefined
    }
  }
}
