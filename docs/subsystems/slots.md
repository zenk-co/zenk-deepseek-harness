# Web Client スロット

日本語 | [English](slots.en.md) | [中文](slots.zh.md)

スロットは Web Client の型付き React 構成システムである。[`dsh-client-ui-slots`](../../packages/client/ui-slots/README.md) が React 非依存のレジストリと型代数を定義し、[`dsh-client-ui-renderer`](../../packages/client/ui-renderer/README.md) が監視可能なソースをフックに束縛し、ツリーをレンダリングし、React コンテキストを内部で所有する。機能プラグインは `ctx.slots.register()` を通じて UI を貢献し、他の機能プラグインのコンポーネントを決してインポートしない。

このページはスロットの所有権、コンポーネント入力、拡張 API、同梱の階層を文書化する。周辺の boot、Remote、Client モデル、Conversation の経路は [Web Client アーキテクチャ](web-client.md)にある。

`plugins.bundle.config` は npm パッケージ名でキー付けされたバンドル詳細設定を供給する。`plugins.bundle.activation` はユーザー要求の有効化の後にオプションのガイダンスをレンダリングし、そのバンドルの詳細を閉じるまたは開くオーナーコールバックを持つ。`conversation.input.activity` はモデルセレクターと Send の間の 1 つのアクションを供給し、ツールバーの展開はアンマウント時に解放される。

プラグインカタログは `plugins.add.actions` を宣言する。これは Add plugin メニューでのインストール後の `MenuItemButton` 行のためのルートスコープのリストである。そのオーナーは、アクションを開始する前にメニューを閉じる `onDismiss()` を供給する。スロットは所有する Plugins ページの宣言ライフタイムに従う。

## 宣言とライフサイクル

`SlotMap` はコンパイル時のレジストリである。パッケージがキー、カーディナリティ、スコープ、オーナー props、keyed props、およびオプションのスロットレベル inject フェイスを宣言マージする。実行時宣言は、レンダリング位置を所有するコンポーネント上の対応する `children` エントリーである。

子を宣言することには 3 つの効果がある: 子キーを有効にし、その親エントリーの `renderSlot` または `renderSlotChain` 呼び出しを認可し、実行時ディスパッチ仕様を記録する。1 つのライブエントリーが各宣言を所有する。宣言されていないスロットへの登録、またはすでに他所で所有されている子の宣言は、プラグインのアクティベーション中に失敗する。

`root` は唯一の組み込み宣言であり、Cordis サービス自体を通じてレンダリングされる唯一のキーである。`ui-renderer` は `ctx.slots.renderSlot('root', {})` を呼ぶ。すべての子孫は、それを宣言したエントリーの `renderSlot` または `renderSlotChain` prop を通じてレンダリングされる。

登録と宣言は Cordis のエフェクトライフタイムに従う。エントリーを破棄するとその貢献が除去され、それが宣言した子スロットが再帰的に折り畳まれる。したがって、別のパッケージのスロットへ貢献する機能は `ctx.slots.inject(key, callback)` を使う: コールバックは宣言ライフタイムごとに実行され、そのエフェクトはオーナーが折り畳まれると除去され、オーナーが再びマウントされると再び実行される。

```tsx ignore-check
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

type HeaderActionProps = PropsRuntime<'conversation.session.header.actions'>

function HeaderAction({ useSession }: HeaderActionProps) {
  const running = useSession(snapshot => snapshot.running)
  return <button disabled={running}>Review</button>
}

export const inject = ['slots']

export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'review',
      order: 100,
    }, HeaderAction))
}
```

## カーディナリティとスコープ

スロット宣言は 2 つの独立した軸を固定する。

| 軸 | 値 | 意味 |
|---|---|---|
| カーディナリティ | `single` | 1 つのセル。アクティブな優先度の勝者がレンダリングする。これを追加リストとして扱うのではなく、子スロットを使う。 |
| カーディナリティ | `list` | セルは必須の `id` でアドレス指定され、`order`、次に登録順で並べられる。 |
| カーディナリティ | `keyed` | オーナーが `entryKey` をディスパッチし、一致するセルがキー固有の props とともにレンダリングされる。 |
| カーディナリティ | `chain` | 各エントリーが純粋な `select(owner)` 関数を供給する。優先度順で最初の非 null の結果がレンダリングされ、その結果を `matched` として受け取る。そうでなければオーナーのフォールバックがレンダリングする。 |
| スコープ | `root` | 1 つのルートスコープのコンポーネントとストアインスタンス。 |
| スコープ | `session-maybe` | 周囲の Provider バインディングを継承するが、それがなくてもレンダリング可能なままである。Session 値はオプションである。 |
| スコープ | `session` | 解決された周囲の Provider バインディングを必要とし、確定した Session 値を受け取る。 |

`priority` は `single`、`list`、`keyed` セルのシャドーイングランクであり、`chain` の選出順である。低い値が先に実行またはレンダリングされる。通常の追加的な貢献は新しい list の `id` または keyed の `key` を選ぶべきである。同梱のセルを意図的に再利用するとそのプレゼンテーションが置き換わる。

## コンポーネント入力

登録されたコンポーネントは、そのバインディングサイトで組み立てられた入力を受け取る。コンポーネントはメンバーをコピーするのではなく、これらの型を導出する。

| 入力 | 宣言元 | コンポーネント型 |
|---|---|---|
| オーナー値と標準スコープ値 | `SlotMap` の行とインストールされたスコープアダプター | `PropsRuntime<K>` |
| 認可された子レンダラー | 登録の `children` キー | `PropsRenderSlots<S>` |
| 共有ビュー状態のためのセレクターフックと変更コールバック | 登録の `store` | `PropsStore<H>` |
| プライベートデータ、コールバック、監視可能なフック | 登録の `inject` ファクトリー | `InjectFace<I>` |
| ローカライズされた `t` 関数 | 登録の `locale` 名前空間 | `PropsLocale<N>` |
| 選択された chain の値 | 登録の `select` 結果 | `ComposedProps` を通じた `matched` |

エントリーが `session` または `session-maybe` の子を宣言する場合、`SessionProvider` も `PropsRenderSlots` に存在する。`session` prop がない場合は周囲のバインディングを継承し、明示的な `SessionReference` または `undefined` はそのサブツリーのみを上書きする。Provider は本体全体をキー付けしない。厳密な `session` エントリーはバインディング世代が変わると再マウントする。空の `session-maybe` エントリーは再マウントせずに最初のバインディングを採用し、後の世代または不在への復帰で再マウントする。

コンポーネントは `ctx` を決して受け取らない。親が所有する時点値は `renderSlot` のオーナー引数を通じて入る。共有ビュー状態は宣言されたストアを使う。サービスとモデルオブジェクトは `apply` クロージャにとどまり、コールバックまたは監視可能なソースに射影される。

## フレームワーク提供のフック

同梱のアダプターがこれらの標準 props を追加する。それらはコンポーネントを登録したパッケージに関係なく、ターゲットスロットのスコープに応じて利用できる。

| 可用性 | Props | オーナー |
|---|---|---|
| すべてのスコープ | `useSessions`、`useSessionStatus`、`useSessionRetainInfo`、`useSessionAccess` | `ui-session` |
| すべてのスコープ | `useWorkspaces`、`useWorkspaceAccess` | `ui-workspace` |
| すべてのスコープ | `useRemoteAccess` (the `global` resource) | `api-remote-access` |
| すべてのスコープ | `usePanelInfo` | `ui-layout` |
| `session` | `sessionId`、`useSession`、`useProjection`、`useAccess` (バインドされた Session の答え) | `ui-session` |
| `session-maybe` | オプションの `sessionId`、`useSession`、`useProjection`、`useAccess` の結果 | `ui-session` |
| `session` | `useConversation`、`useInput`、`inputActions` | `ui-conversation` |
| `session-maybe` | オプションの `useConversation`、`useInput`、`inputActions` の結果 | `ui-conversation` |
| `session` | `useChat` | `ui-chat` |
| `session` | `useTrajectory` | `ui-trajectory` |

レンダラーはまた、宣言されたストアから `useStore` を、宣言された locale 名前空間から `t` を作成する。これらはグローバル標準 props ではなく登録由来の props である。

フレームワークとドメインアダプターのオーナーは、対応する `GlobalStandardProps`、`SessionStandardProps`、または `SessionMaybeStandardProps` の宣言マージとともに、`ctx.slots.provideRoot()` または `ctx.uiSession.provide()` を通じて標準セットを拡張してよい。機能コンポーネントは、React フック prop を自ら作成したり、エントリープライベートのデータのためにグローバル標準 prop を追加したりすべきではない。

## 開発者提供の注入

登録の `inject` オプションは、通常の機能所有の注入ポイントである。そのファクトリーはプラグインの `apply` ワールドで実行され、注入された Cordis サービスを閉じ込めてよく、コンポーネントが必要とするデータとコールバックのみを返す。`session` スロットでは `sessionId` を受け取り、`session-maybe` では `sessionId | undefined` を受け取り、ストアが宣言されている場合はストアのバインドされたアクションも受け取る。

その戻り値内の予約された `hooks` オブジェクトは、素の `getSnapshot`/`subscribe` ソースを受け入れる。レンダラーは `hooks: { status }` を `useStatus(selector)` コンポーネント prop に変換し、ソースの同一性でバインディングをキャッシュする。コンポーネントはソース自体を受け取らず、`useSyncExternalStore` を直接呼ばない。

スロットのオーナーは、すべての占有者が必要とする同じケイパビリティがある場合、子宣言に `inject` フェイスを置いてよい。プレーンなメンバーはすべての占有者に変更なしで届く。その `hooks` オブジェクト内の関数値メンバーはフックファクトリーである。それらはスロットの標準 props とオプションのレンダリングごとの `hookContext` を受け取り、占有者に公開される制約付きフックを返す。`conversation.chat.node` はこの機構を使って、現在レンダリングされているノードのための `useTurnData(key)` を提供する。

1 つのレンダリング時点ですでに知られている値にはオーナー props を、1 つのエントリーのコールバックとプライベートな監視可能値には登録 `inject` を、スロットオーナーが制御するケイパビリティにはスロットレベル `inject` を、エントリー間で共有されるまたは再マウントをまたいで保持される可変ビュー状態には宣言されたストアを使う。React ノードは注入された値ではなく、子スロットを通じて構成される。

<a id="current-hierarchy"></a>

## Conversation 階層

以下の Conversation 経路は、宣言のオーナーと再利用可能な Factory ルートを区別する。無関係なシェルの位置は省略する。エントリーは自身が宣言した子を所有し、Factory は登録された定義の寿命の間その子宣言を所有する。角括弧の名前はデフォルトの React コンポーネントを識別し、素の React 子孫がオーナーの Slot をレンダリングできる。Factory 呼び出しは独立した再利用可能な定義への参照であり、新しい Slot 宣言ではない。

```text
root [AppFrame]
└─ main[key=conversation] [ConversationPanel]
   └─ main.conversation [ConversationRoot / ConversationMainPanel]
      ├─ conversation.header [ConversationHeader]
      │  ├─ conversation.header.leading
      │  └─ conversation.session.header [ConversationSessionHeader]
      │     ├─ conversation.session.header.lineage
      │     ├─ conversation.session.header.actions
      │     ├─ conversation.session.header.utilities
      │     └─ conversation.session.header.corner
      └─ calls Factory: conversation.content

Factory: conversation.content [ConversationContent]
├─ conversation.session [ConversationSession / DefaultConversationViews]
│  └─ conversation.view
│     ├─ id=chat [ChatView]
│     │  └─ conversation.chat.flow [ChatFlow]
│     │     └─ conversation.chat.node [ChatNodeSeat dispatch]
│     │        ├─ key=user,steering [UserMessageNodeView]
│     │        │  └─ calls Factory: conversation.chat.user.content
│     │        ├─ key=assistant-step [AssistantNodeView / AssistantMarkdown]
│     │        │  ├─ conversation.chat.message.images [MessageImages]
│     │        │  └─ conversation.chat.reasoning.body [DefaultReasoningBody]
│     │        │     └─ calls Factory: conversation.chat.reasoning.content
│     │        ├─ key=tool-call [ToolCallTree]
│     │        │  └─ tool.call.toolview
│     │        │     └─ key=read_image [ReadImageRow / ToolRow]
│     │        │        └─ tool.call.images [MessageImages]
│     │        ├─ key=command-input [GoalCommandInputView]
│     │        │  └─ calls Factory: conversation.user.text
│     │        ├─ key=command [CommandNodeView]
│     │        │  └─ conversation.chat.commandview
│     │        └─ key=turn-tail [TurnTailNodeView]
│     │           ├─ conversation.chat.turnTail
│     │           └─ conversation.chat.assistant-actions
│     └─ id=trajectory [TrajectoryView / TrajectoryTable]
│        └─ conversation.trajectory.images [MessageImages]
├─ conversation.composer
│  ├─ conversation.approval.detail
│  └─ conversation.plan-review.actions
├─ conversation.composer.bar [InputBar]
│  ├─ conversation.input.attachments
│  ├─ conversation.input.permission
│  ├─ conversation.input.plan
│  ├─ conversation.input.model
│  │  └─ conversation.input.model.label
│  ├─ conversation.input.overlay
│  ├─ conversation.composer.dock
│  ├─ conversation.input.left
│  └─ conversation.input.right
├─ conversation.input.dock
│  └─ id=queue [QueueDock]
│     └─ calls Factory: conversation.user.text
├─ conversation.hero.brand.mark
├─ conversation.hero.workspace
│  └─ conversation.hero.workspace.directoryFlow
├─ conversation.hero.agentPreset
└─ conversation.hero.options

Factory: conversation.chat.user.content [UserContent]
├─ conversation.chat.user.images [MessageImages]
└─ calls Factory: conversation.user.text

Factory: conversation.user.text [UserText]
└─ conversation.user.text.node [keyed, inline]

Factory: conversation.images.content [MessageImagesContent / ImageGallery]
Factory: conversation.chat.reasoning.content [ReasoningContent / MarkdownText]
```

4 つの画像 Slot はすべてデフォルトで `MessageImages` になり、呼び出し元の画像参照と認可されたローダーを伴って `conversation.images.content` を呼ぶ。ユーザー画像と出力画像の置き換えは独立している。`conversation.user.text` Factory はユーザーコンテンツ、Queue、Goal が共有する。その `inline: true` の keyed Slot は、ブロックラッパーではなく span アンカーとインラインエラープレースホルダーをレンダリングする。

生成された [Client inspect カタログ](../../packages/extensions/cordis-client-runner/src/client/slot-catalog.ts)はすべてのシェル分岐をカバーし、各キーの網羅的な契約である: カーディナリティ、スコープ、オーナー props、標準 props、現在の占有者、宣言オーナー、置き換えリスク。実行中の dynamic パッケージは `cordis_inspect what:"client"` でライブツリーと正確なキーを照会できる。ソースカタログは `SlotMap` 宣言と `slots.register()` 呼び出しサイトから `pnpm run gen-client-catalog` によって生成される。

## 拡張ルール

- 別の機能パッケージをインポートするのは `import type` での宣言のみにする。そのランタイム値を決してインポートまたは再エクスポートしない。
- 新しい子スロットは、その位置を所有してレンダリングするコンポーネントでのみ宣言する。他のパッケージは `ctx.slots.inject()` で待機し、`ctx.slots.register()` を通じて貢献する。
- ビジネス状態とトランスポート状態は、それを所有する Cordis サービスまたは Client モデルに置く。Slot ストアは共有の閲覧とインタラクションの状態のみを保持する。
- 監視可能なソースとスナップショットの同一性を変更間で安定に保つ。値が変わるたびに同じソースを通じて再公開する。
- UI ドメイン間では JSON 互換のデータとコールバックを渡す。`hooks` 区画は素の監視可能値のための唯一の例外である。React コンテンツはスロットを通じて移動する。
- `single` と占有された keyed セルは置き換えポイントとして扱う。追加的な拡張には list の id または未占有のキーを使う。
