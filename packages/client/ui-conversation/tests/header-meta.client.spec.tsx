// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import { createConversationStore } from '../src/client/stores.ts'
import { en, ja, zh } from '../src/client/locales.ts'
import { ConversationSessionHeader } from '../src/client/skeleton/ConversationSession.tsx'

const t = makeTranslate(zh, commonZh)
const sid = (id: string): SessionId => id as SessionId
const SID = sid('s1')

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function mountHeader(git: { repo: string; branch: string } | undefined) {
  const sessions = createSnapshotStore<SessionListState>({
    ids: [SID],
    byId: {
      [SID]: {
        id: SID,
        displayTitle: 'Child',
        running: false,
        retainedBy: {},
        blank: false,
        updatedAt: 3,
        cwd: '/work/myrepo',
        ...(git === undefined ? {} : { git }),
      },
    },
    phase: 'ready',
    projectionsBySession: {},
  })
  const store = createConversationStore().create()
  const view = render(
    <ConversationSessionHeader
      sessionId={SID}
      hideChrome={false}
      SessionProvider={({ children }) => children}
      useSession={() => undefined as never}
      useConversation={() => undefined as never}
      useAccess={() => true}
      useRemoteAccess={() => true}
      useSessionAccess={() => true}
      useWorkspaceAccess={() => true}
      useConversationViews={selector => selector([
        { id: 'chat', label: 'Chat' },
      ])}
      useChat={() => undefined as never}
      useTrajectory={() => undefined as never}
      useSessions={bindSnapshotSelector(sessions)}
      usePanelInfo={selector => selector({ activePanelId: null })}
      useResource={(() => ({ status: 'none' as const, value: undefined, failure: undefined })) as never}
      useSessionStatus={() => new Map() as never}
      useSessionRetainInfo={() => undefined as never}
      useWorkspaces={selector => selector({ items: [] } as never)}
      useProjection={(() => undefined) as never}
      useInput={(() => undefined) as never}
      inputActions={{} as never}
      useStore={bindSnapshotSelector(store)}
      actions={store.actions}
      renderSlot={(() => null) as never}
      open={() => {}}
      selectView={() => {}}
      t={t}
    />,
  )
  return view
}

describe('conversation header git and clock', () => {
  it('shows repository, branch, and current time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 17, 9, 5, 0))
    const view = mountHeader({ repo: 'zenk-deepseek-harness', branch: 'shiguredo-fixes' })
    expect(view.getByTestId('conversation-git').textContent).toBe('zenk-deepseek-harness / shiguredo-fixes')
    expect(view.getByTestId('conversation-clock').textContent).toMatch(/^\d{2}:\d{2}$/)
    expect(view.getByTestId('conversation-clock').textContent).toBe('09:05')
  })

  it('omits repository readout outside git while keeping the clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 17, 23, 59, 0))
    const view = mountHeader(undefined)
    expect(view.queryByTestId('conversation-git')).toBeNull()
    expect(view.getByTestId('conversation-clock').textContent).toBe('23:59')
  })

  it('uses English dictionary without new copy', () => {
    expect(en['session.hierarchy']).toBeTypeOf('string')
    expect(zh['session.hierarchy']).toBeTypeOf('string')
    expect(ja['session.hierarchy']).toBeTypeOf('string')
  })
})
