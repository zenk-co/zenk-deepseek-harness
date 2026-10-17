# クックブック: Remote API の追加

日本語 | [English](adding-a-remote-api.en.md) | [中文](adding-a-remote-api.zh.md)

`ctx.remote` エンドポイントの追加または変更は、このページの 5 つのステップで行う: メソッドを宣言し、その失敗を宣言し、パッケージに登録し、Client で消費し、テストする。デコレーターのセマンティクス、ルックアップ解決、生成パイプライン、`/api` ルートはメカニズムであり、[API Gateway リファレンス](../api-gateway.md)に属する。このページは各ステップの行動と、それが満たさなければならない規約を示す。プログラミングインターフェースがなぜこのような形なのかは [Typert Remote メソッド呼び出し Agent Note](../../.agents/notes/implemented/architecture/2026-08-02-typert-remote-method-calls.md)に、失敗がなぜ 1 つの `RemoteError` とコードテーブルなのかは[失敗語彙 Agent Note](../../.agents/notes/implemented/architecture/2026-08-28-ctx-remote-failure-vocabulary.md)にある。

## 1. API を宣言する

オーナーは Host 側の Cordis サービスである。`TypertRemoteService` を拡張してサービスキーと wire 名前空間を結び付け、公開するメソッドを `@Remote` でマークする。シグネチャーがすでに wire の規約を満たしている場合はビジネスメソッド自体をマークし、形を変える必要がある場合（`signal` の追加、パラメーターの並べ替え、別名でのエクスポート）にだけ `remoteExport*` アダプターを書き、そのアダプターにリネームしていないビジネスメソッドを呼ばせる。ルックアップオブジェクト（`Agent`、`Session`）はトップレベルのパラメーター位置にのみ置け、協調的キャンセルをサポートするメソッドは `signal: AbortSignal` を最後のパラメーターに取る。

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

/** One stored note as a Client reads it. */
export interface NoteRow {
  readonly noteId: string
  readonly title: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    notesController: NotesController
  }
}

export class NotesController extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'notesController', { namespace: 'notes' })
  }

  /**
   * @param agent - lookup parameter the Gateway resolves from its wire identity.
   * @param signal - carrier cancellation, always the final parameter.
   * @returns the notes this Agent's session owns.
   */
  @Remote('list')
  async remoteExportList(agent: Agent, signal: AbortSignal): Promise<NoteRow[]> {
    return await this.list(agent, signal)
  }

  /** The in-process API the adapter above delegates to, unchanged by it. */
  async list(agent: Agent, signal: AbortSignal): Promise<NoteRow[]> {
    signal.throwIfAborted()
    return await Promise.resolve([{ noteId: `${agent.id}-1`, title: 'draft' }])
  }
}
```

## 2. 失敗を宣言する

Remote の失敗は 1 つのクラス `RemoteError` である。ドメインコードを宣言マージで `RemoteErrorDetailsMap` にマージし、失敗点で `throw new RemoteError(code, message, details)` する。ドメインエラークラスの一族を作らないこと。出口マッピング関数も書かないこと。このエンドポイントと無関係な例外は事前分類されない。ゲートウェイがそれを `gateway/internal` に畳み込むからである。`catch` を書くのは、任意のプロバイダー例外を 1 つのドメインコードに分類するときだけで、元の例外を `cause` として添付する。

コードは `<domain>/<reason>` と読み、その宣言には 4 つの配置ルールがある:

- プロデューサーが 1 つだけ: それを生成するパッケージの throw の隣に宣言する。
- 複数のパッケージが生成する: 両方が依存する最も下位のドメインパッケージに宣言する（`core/session` の `session/not-found`、`dsh-workspace` の `workspace/not-found`）。
- キャリアコード `gateway/bad-request`、`gateway/cancelled`、`gateway/internal` は protocol に宣言され、Gateway インフラストラクチャコードは gateway に宣言される。それらを使い、決してコピーしない。
- wire を越えないローカルな失敗はコードテーブルに入れない。呼び出し側自身の型で表現する。

```ts
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** No stored note carries that id. */
    'note/not-found': { readonly noteId: string }
    /** The store refused an otherwise valid write. */
    'note/rejected': { readonly noteId: string }
  }
}

declare const stored: ReadonlyMap<string, string>
declare function persist(noteId: string, title: string): Promise<void>

export async function rename(noteId: string, title: string): Promise<void> {
  if (!stored.has(noteId)) {
    throw new RemoteError('note/not-found', `no note "${noteId}"`, { noteId })
  }
  try {
    await persist(noteId, title)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new RemoteError('note/rejected', message, { noteId }, { cause: error })
  }
}
```

## 3. パッケージに登録する

`@Remote` は Loader エントリープラグインパッケージに置かなければならない。オーナーが抽象シームの場合、コントローラーは `packages/api/` の下の対応するパッケージに置く。マニフェストは 2 つの生成エントリーと protocol のピア依存を得る。Client 側では `@deepseek-ai/dsh-api-remotes` アセンブリがコントリビューションをマウントし、コンシューマーが必要とする型語彙を再エクスポートする。各エントリーがどの生成成果物を指すか、生成パイプラインがどう順序付けられるかは [API Gateway リファレンス](../api-gateway.md)にある。

```json
{
  "exports": {
    "./typert": { "types": "./lib/typert.host.d.ts", "default": "./lib/typert.host.js" },
    "./remote": { "types": "./lib/typert.remote-client.d.ts", "default": "./lib/typert.remote-client.js" }
  },
  "peerDependencies": { "@deepseek-ai/dsh-typert-protocol": "workspace:*" },
  "devDependencies": { "@deepseek-ai/dsh-typert-protocol": "workspace:*" }
}
```

シグネチャー、コードテーブル、名前空間、またはエクスポート名を変更した後は `pnpm run build:lib` を再実行する。これが Client に新しい宣言とコーデックを渡すものだからである。実装本体だけの変更は再生成を必要としない。

## 4. Client で消費する

呼び出す側のプラグインは `inject` に `remote` と `remote.<namespace>` の両方を宣言し、呼び出し箇所は `ctx.remote.<namespace>.<method>(...)` を直接書く。`Pick<ClientRemote, …>` の絞り込みも、手書きのメソッドシグネチャーも、wire リレーオブジェクトもない。結果は `RemoteResult<T>` なので、その場で `if (!result.ok)` で分岐し、`instanceof` ではなく `code` で判別する —— コード分岐はそれ自体で `details` を絞り込む。例外フローの箇所は `throw result.error` と書く（本物の Error である）。それを捕まえる側は `isRemoteFailure` を使い、Remote の失敗とローカルな欠陥を区別し、欠陥を再 throw する。防御的な catch は書かない。Remote 呼び出しは reject せず、アセンブリのミスはクラッシュすべきである。

固定の Host 事実は `ctx.remote.$host` から来る。`home` と `isLoopback` は購読も世代カウンターもない単純な読み取りであり、`home` は最初の ready フレームまで `undefined` である。再接続後は `ctx.on('connection/reset')` またはドメイン自身の remote イベントを通じて再読する。呼び出し側が unary 呼び出しを中断した場合、結果は throw ではなくエラー分岐上の `gateway/cancelled` である。

```ts ignore-check
import type { Context } from '@deepseek-ai/cordis'
import { isRemoteFailure } from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'

export const inject = ['remote', 'remote.notes']

declare const ctx: Context

/** Store-side read: the error branch is handled where the code is meaningful. */
export async function noteTitles(): Promise<readonly string[]> {
  const result = await ctx.remote.notes.list()
  if (!result.ok) {
    if (result.error.code === 'note/not-found') return []
    throw result.error
  }
  return result.value.map(row => row.title)
}

/** Action-side: a Remote failure becomes copy; a local fault keeps crashing. */
export async function renderTitles(): Promise<string> {
  try {
    return (await noteTitles()).join(', ')
  } catch (error: unknown) {
    if (!isRemoteFailure(error)) throw error
    return `unavailable (${error.code})`
  }
}

/** Fixed Host facts as plain reads. */
export function hostLabel(): string {
  const { home, isLoopback } = ctx.remote.$host
  return home ?? (isLoopback ? 'local host' : 'remote host')
}
```

## 5. テストする

オーナー側では、throw されたコードをアサートする。catch した後 `remoteErrorOf` で失敗を回収し、`toMatchObject` で `code` と関心のある details フィールドを比較する —— エラーオブジェクトを `toEqual` で深い比較したり、`instanceof` をアサートしたりは決してしない。

```ts
import { remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import { expect, it } from 'vitest'

declare function rename(noteId: string, title: string): Promise<void>

it('refuses an unknown note before writing', async () => {
  const failure = await rename('n-404', 'fresh title').catch((error: unknown) => error)

  expect(remoteErrorOf(failure)).toMatchObject({
    code: 'note/not-found',
    details: { noteId: 'n-404' },
  })
})
```

Client 側のダブルは本物のインスタンスを返す。`RemoteError` と `TestRemote` の値インポートは `@deepseek-ai/dsh-client-test-runtime` から取る。`api-remotes` ファサードからの値インポートは未ビルドのアセンブリチェーンをロードしてしまうからである。`TestRemote.$host` は spec が直接代入する単純なフィールドである。

```ts ignore-check
import { Context } from '@deepseek-ai/cordis'
import { RemoteError, TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { expect, it } from 'vitest'

it('renders the failure code the Host reported', async () => {
  const ctx = new Context()
  const remote = new TestRemote(ctx, {
    notes: {
      list: () => Promise.resolve({
        ok: false as const,
        error: new RemoteError('note/not-found', 'no note "n-404"', { noteId: 'n-404' }),
      }),
    },
  })
  remote.$host = { home: '/home/fixture', isLoopback: true }

  await expect(ctx.remote.notes.list()).resolves.toMatchObject({ error: { code: 'note/not-found' } })
})
```

## 検証

1. `pnpm run build:lib`: シグネチャー、コードテーブル、名前空間、またはエクスポート名を変更したら必須。Client の宣言とコーデックを生成するためである。
2. `pnpm run typecheck`: Host と Client 両方のプログラム。到達不能なパッケージにマージされたコードは赤になる。
3. 両側の spec を名前で実行する: `npx vitest run <owner spec> <client spec>`。
4. エンドポイントが製品可視のサーフェスに到達する場合は、[テストポリシー](../testing.md)に従って録画セッションスナップショットを追加する。
