# Client リソース

日本語 | [English](client-resources.en.md) | [中文](client-resources.zh.md)

クライアントリソースモデルはアドレスを任意 Web Client コンポーネント向けライブデータに変える。[`dsh-client-resources`](../../packages/client/resources/README.md) が `ctx.resources` サービスと `useResource` 全体標準フックを提供する。内容種を所有するパッケージはその**プロトコル**に **provider** を 1 件登録し、コンポーネントは所有者ランタイムのインポートなしに**アドレス**で内容の現行状態を読む。右 Sidebar の方法がモデルの最初のコンシューマーである ([Right Sidebar](sidebar-right.md))。決定記録は [client resource model Agent Note](../../.agents/notes/implemented/architecture/2026-09-05-client-resource-model.md) である。

このページは開発者リファレンスである。アドレスの書き方、provider の登録法、リソースの読み方、状態と失敗の意味、モデルがリソースを保持・解放する方法を扱う。

## アドレス

リソースアドレスは `dsh-resource://<type>/…` URL である。ホストはプロトコルを名指しし、`ResourceProtocolMap` のキーでなければならない。パスはプロトコル独自であり、その所有者は各 segment をパーセント符号化する。スコープを要するプロトコルはパスに置く。`file` プロトコルのアドレスは `dsh-resource://file/session/<sessionId>/<path>` と読み、`path` はワークスペース相対または先頭スラッシュ保持の絶対であり、[`dsh-util-workspace-path`](../../packages/util/workspace-path/README.md) の `fileAddressFor(sessionId, cwd, path)` で構築して `parseFileAddress(address)` で読み戻す。モデル自体は scheme とホストのみ読む。`protocolOf(address)` は `dsh-resource://` URL の小文字ホストを返し、それ以外は `undefined` を返す。他 scheme 配下のアドレス — Sidebar の `sidebar://guide` — はリソースを名指さず `none` と読まれる。

| アドレス | プロトコルキー | 読み方 |
|---|---|---|
| `dsh-resource://file/session/s1/notes/a.md` | `file` | `file` provider 登録時にセッション `s1` のワークスペースルート配下 `notes/a.md` のメタデータ |
| `dsh-resource://file/absolute/home/me/notes.md` | `file` | パース可能だが `workspace-file/unknown-workspace` で失敗する。認可 Session なしであり、現行も方法 Session も借りない |
| `DSH-RESOURCE://File/session/s1/a` | `file` | 別記録。アドレスは文字列比較であり、`openResource` は `fileAddressFor` が発する正準小文字綴りのみ受理する |
| `dsh-resource://subagentchat/session/c1?parent=p1&mode=continuable` | `subagentchat` | アドレス付きサブエージェント Conversation であり、その値はリソース終了まで `SessionReference` を所有する |
| `sidebar://guide` | — | `none`。ナビゲーションアドレス |
| `/home/me/notes.md` | — | `none`。URL ではない |

## provider の登録

プロトコルの所有者は `ResourceProtocolMap` 上に値型を宣言し、独自 `ctx.effect` 内に provider 1 件を登録するため、プロトコルはプラグインと正確に同じ寿命で生きる ([provider を提供する](../../packages/client/resources/README.md#provide-a-protocol))。`open(address, { signal })` は `RemoteResult` フレームのストリームを返す — 現行状態を先に、次に変更ごとに 1 フレーム — `signal` abort で止まらなければならない。失敗は `RemoteFailure` を運ぶ `ok: false` フレームである。ストリーム内の throw はプログラミング誤りであり捕捉されない。

```ts ignore-check
import type { Context } from '@deepseek-ai/cordis'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-client-resources/client'

interface NoteView { readonly title: string; readonly updatedAt: string }

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap { note: NoteView }
}

export const inject = ['resources', 'remote']

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.resources.register<'note'>({
    protocol: 'note',
    async *open(address, { signal }): AsyncIterable<RemoteResult<NoteView>> {
      const id = new URL(address).pathname.slice(1)
      yield await ctx.remote.notes.read(id, signal)
      for await (const change of ctx.remote.notes.follow(id, signal)) yield change
    },
  }), 'my-notes: note resource provider')
}
```

1 プロトコルに provider はちょうど 1 件であり、2 件目の登録は投げる。プロトコルのアドレスが既に保持される中での登録はそのストリームを一斉に開き、provider 破棄はそれらストリームを終え、provider 復帰までアドレスは `none` と読まれる。

## リソースの読み取り

すべてのスロットコンポーネントはスコープを問わず props に `useResource` を受け取る ([Slots](slots.md))。`useResource<P>(address)` は型引数でプロトコルを名指し、アドレスの現行スナップショットを返す。購読することがリソースを開いたままにし、別保持者がリソースを生かす間にマウントしたコンポーネントはストリーム再開なしに最新値を一斉に読む ([リソースを読む](../../packages/client/resources/README.md#read-a-resource))。

| `status` | 意味 | `value` | `failure` |
|---|---|---|---|
| `none` | アドレスのプロトコルに provider 登録なし、またはアドレスがリソースアドレスではない | `undefined` | `undefined` |
| `loading` | provider ストリームは開いており、まだ yield していない | `undefined` | `undefined` |
| `live` | 最新フレーム成功 | 最新 `ok` 値 | `undefined` |
| `failed` | 最新フレームが失敗を報告 | 最後の `ok` 値、保持 | フレームの `RemoteFailure` |

```tsx ignore-check
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-api-workspace-files/client'

type Props = PropsRuntime<'sidebar.right.pane.tab'>

export function FileHeader({ useTabInfo, useResource, t }: Props) {
  const { tab } = useTabInfo()
  const meta = useResource<'file'>(tab.contentId)
  if (meta.status === 'failed') return <p role="alert">{t('failed', { code: meta.failure.code })}</p>
  return (
    <header>
      {tab.title}
    </header>
  )
}
```

コンシューマーは `failed` を自ら表示する。モデルは失敗脇に最終値を保持するため、本体は空白ではなく古い内容に注意書きで示すことができ、次の `ok` フレームは失敗を消す。モデル内の何ものもユーザー可視文を生まない。

## 保持と解放

リソースは保持者ある限り生きる。購読 `useResource`、またはピンである。`ctx.resources.pin(address, signal)` は `signal` abort まで購読なしにリソースを開いたままにし、既 abort 信号は何もピンしない。右 Sidebar は開いた方法記録すべてのアドレスを記録寿命の間ピンするため、方法切り替えは本体をアンマウントしてもストリームを閉じない。最初の保持者が provider ストリームを開き、最後の解放がそれを abort し、値を捨て、スナップショットを `loading` (provider あり) または `none` (不在) に戻す。その解放後に provider が yield したフレームは落とされ、イテレーターは終了される。`ctx.resources.source(address)` はフック背後の素オブザーバブルであり、アドレス単位に参照安定であり、React 外呼び出し元向けである。そのスナップショット読み取りはリソースを保持しない ([ライフサイクル](../../packages/client/resources/README.md#lifecycle))。

大半ストリームは内容ではなくメタデータを運ぶ。`file` provider の値は `WorkspaceFileStat { absolutePath, version, bytes? }` である。最初のフレームは Host `stat` 由来であり、後の観測は版を更新する。コンシューマーは Workspace Files Remote 名前空間経由で内容を読む。Preview は方法単位に独立更新を所有する ([`dsh-api-workspace-files`](../../packages/api/workspace-files/README.md))。`subagentchat` provider はアドレス指定 Session を保持してその `SessionReference` を yield し、リソース信号 abort でその参照を解放する。

## 制限

記録はページ寿命で生きる。アドレスの記録は最終保持者退出後も残り、ストリームも値も保持しないため、メモリは読み取った相異アドレス数と共に増える。`signal` を無視する provider は次フレームまで動き続ける。失敗型は Remote 面の `RemoteFailure` のため、情報源が Remote 呼び出しでない provider はそれを発行する。綴り違いプロトコルや不正アドレスは他診断なしに `none` と読まれる。
