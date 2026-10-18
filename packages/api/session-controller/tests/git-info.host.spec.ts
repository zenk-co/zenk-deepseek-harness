/** Session working-directory git identity resolution and list attachment. */
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import SessionStore, { SESSION_FORMAT_VERSION, type SessionId } from '@deepseek-ai/dsh-session'
import type { SessionHeader } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { describe, expect, it, vi } from 'vitest'
import {
  defaultGitExecSync, GIT_INFO_TIMEOUT_MS, SessionGitInfoResolver, type GitExecSync,
} from '../src/git-info.ts'
import type { SessionGitInfo } from '../src/types.ts'
import { ApiSessionList } from '../src/list.ts'

const sid = (value: string): SessionId => value as SessionId

function header(id: string, cwd?: string): SessionHeader {
  return {
    version: SESSION_FORMAT_VERSION,
    id: sid(id),
    createdAt: 100,
    isSeeded: false,
    ...(cwd === undefined ? {} : { cwd }),
  }
}

async function listContext(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SessionProjectionRegistry)
  return ctx
}

describe('SessionGitInfoResolver', () => {
  it('returns undefined without spawning for absent directories', () => {
    const exec = vi.fn<GitExecSync>(() => '/repo')
    const resolver = new SessionGitInfoResolver(exec)
    expect(resolver.resolve(undefined)).toBeUndefined()
    expect(resolver.resolve('')).toBeUndefined()
    expect(exec).not.toHaveBeenCalled()
  })

  it('resolves basename and branch and caches per cwd', () => {
    const exec = vi.fn<GitExecSync>((_file, args) => {
      if (args[1] === '--show-toplevel') return '/work/myrepo\n'
      return '  feature-x\n'
    })
    const resolver = new SessionGitInfoResolver(exec)
    expect(resolver.resolve('/work/myrepo/sub')).toEqual({ repo: 'myrepo', branch: 'feature-x' })
    expect(exec).toHaveBeenCalledTimes(2)
    expect(exec.mock.calls[0]?.[0]).toBe('git')
    expect(exec.mock.calls[0]?.[2]).toMatchObject({ cwd: '/work/myrepo/sub', timeout: GIT_INFO_TIMEOUT_MS })
    expect(resolver.resolve('/work/myrepo/sub')).toEqual({ repo: 'myrepo', branch: 'feature-x' })
    expect(exec).toHaveBeenCalledTimes(2)
  })

  it('returns undefined when the top level is empty', () => {
    const exec = vi.fn<GitExecSync>(() => '\n')
    const resolver = new SessionGitInfoResolver(exec)
    expect(resolver.resolve('/work/empty')).toBeUndefined()
    expect(exec).toHaveBeenCalledOnce()
    expect(resolver.resolve('/work/empty')).toBeUndefined()
    expect(exec).toHaveBeenCalledOnce()
  })

  it('returns undefined when the repository basename is empty', () => {
    const exec = vi.fn<GitExecSync>(() => '/\n')
    const resolver = new SessionGitInfoResolver(exec)
    expect(resolver.resolve('/')).toBeUndefined()
    expect(exec).toHaveBeenCalledOnce()
  })

  it('returns undefined for a detached branch', () => {
    const exec = vi.fn<GitExecSync>((_file, args) => {
      if (args[1] === '--show-toplevel') return '/work/myrepo\n'
      return '\n'
    })
    const resolver = new SessionGitInfoResolver(exec)
    expect(resolver.resolve('/work/myrepo')).toBeUndefined()
    expect(exec).toHaveBeenCalledTimes(2)
  })

  it('returns undefined when either git call throws', () => {
    const failingToplevel = vi.fn<GitExecSync>(() => {
      throw new Error('not a git repository')
    })
    expect(new SessionGitInfoResolver(failingToplevel).resolve('/nope')).toBeUndefined()
    const failingBranch = vi.fn<GitExecSync>((_file, args) => {
      if (args[1] === '--show-toplevel') return '/work/myrepo\n'
      throw new Error('branch failed')
    })
    expect(new SessionGitInfoResolver(failingBranch).resolve('/work/myrepo')).toBeUndefined()
  })

  it('drops cached entries on clear', () => {
    // First resolution consumes two calls (toplevel + branch) with alternating stub values.
    const firstExec = vi.fn<GitExecSync>((_file, args) => {
      if (args[1] === '--show-toplevel') return '/work/a\n'
      return 'main\n'
    })
    const caching = new SessionGitInfoResolver(firstExec)
    expect(caching.resolve('/work/a')).toEqual({ repo: 'a', branch: 'main' })
    expect(firstExec).toHaveBeenCalledTimes(2)
    caching.clear()
    expect(caching.resolve('/work/a')).toEqual({ repo: 'a', branch: 'main' })
    expect(firstExec).toHaveBeenCalledTimes(4)
  })

  it('runs real git without a shell', () => {
    const output = defaultGitExecSync('git', ['--version'], { cwd: '/tmp', timeout: GIT_INFO_TIMEOUT_MS })
    expect(output).toContain('git version')
  })
})

describe('ApiSessionList git attachment', () => {
  it('attaches git identity to live and cold summaries', async () => {
    const ctx = await listContext()
    try {
      const live = ctx.sessions.create(sid('live'), { meta: header('live', '/work/myrepo') })
      const exec = vi.fn<GitExecSync>((_file, args) => {
        if (args[1] === '--show-toplevel') return '/work/myrepo\n'
        return 'live-branch\n'
      })
      const list = new ApiSessionList(ctx, 8, new SessionGitInfoResolver(exec))
      expect(list.summaryFor(live)).toMatchObject({
        sessionId: 'live',
        cwd: '/work/myrepo',
        git: { repo: 'myrepo', branch: 'live-branch' },
      })
      ctx.provide('sessionQuery', {
        listSessions: () => Promise.resolve([
          { header: live.header, live: true, persisted: true },
          { header: header('cold', '/work/myrepo'), live: false, persisted: true },
        ]),
      } as never)
      ctx.provide('sessionProjectionCache', {
        cachedSnapshot: () => undefined,
        cachedPredecessorTitle: () => undefined,
      } as never)
      const items = await list.list()
      expect(items.find(item => item.sessionId === 'live')?.git).toEqual({
        repo: 'myrepo', branch: 'live-branch',
      })
      expect(items.find(item => item.sessionId === 'cold')?.git).toEqual({
        repo: 'myrepo', branch: 'live-branch',
      })
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('omits git when the resolver has none and survives resolver throws', async () => {
    const ctx = await listContext()
    try {
      const live = ctx.sessions.create(sid('plain'), { meta: header('plain', '/tmp') })
      const empty = new ApiSessionList(ctx, 8, new SessionGitInfoResolver(() => {
        throw new Error('no git')
      }))
      expect(empty.summaryFor(live)).not.toHaveProperty('git')
      class ThrowingResolver extends SessionGitInfoResolver {
        override resolve(_cwd: string | undefined): SessionGitInfo | undefined {
          throw new Error('resolver crashed')
        }
      }
      const throwing = new ThrowingResolver(() => '/repo')
      const resilient = new ApiSessionList(ctx, 8, throwing)
      expect(resilient.summaryFor(live)).not.toHaveProperty('git')
      ctx.provide('sessionQuery', {
        listSessions: () => Promise.resolve([{ header: live.header, live: true, persisted: true }]),
      } as never)
      ctx.provide('sessionProjectionCache', {
        cachedSnapshot: () => undefined,
        cachedPredecessorTitle: () => undefined,
      } as never)
      await expect(resilient.list()).resolves.toMatchObject([{ sessionId: 'plain' }])
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('omits git for sessions without a working directory', async () => {
    const ctx = await listContext()
    try {
      const live = ctx.sessions.create(sid('nocwd'), { meta: header('nocwd') })
      const list = new ApiSessionList(ctx, 8, new SessionGitInfoResolver(vi.fn<GitExecSync>(() => '/repo\n')))
      expect(list.summaryFor(live)).not.toHaveProperty('git')
      expect(list.summaryFor(live)).not.toHaveProperty('cwd')
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
