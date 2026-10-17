# 会話のアセンブリ

日本語 | [English](conversation.en.md) | [中文](conversation.zh.md)

会話は、Client の `SessionEventLikeEntry` ウィンドウとブラウザービューの間にあるターゲット中立のアセンブリ層である。[`ui-conversation`](../../packages/client/ui-conversation/README.md) は、イベントレジストリとビューレジストリ、`SessionBinding` ごとに 1 つの同一性安定なバインディング、Turn/Step ロケーション、インクリメンタルな Context アセンブリ、ターゲットソース、共有シェル、入力オーケストレーションを所有する。[`ui-chat`](../../packages/client/ui-chat/README.md) や [`ui-trajectory`](../../packages/client/ui-trajectory/README.md) などのターゲットパッケージは、自身の Definition、最終スナップショット、レンダリングを所有する。

このページは、ビジネスが所有する会話ノードのデータモデルと拡張パスを定義する。[Web クライアントアーキテクチャ](web-client.md)はこのサブシステムを Client モデルとスロットの間に位置づけ、その根拠は[会話ノードアセンブリの決定](../../.agents/notes/implemented/architecture/2026-08-09-client-conversation-node-assembly.md)が所有する。

## データモデルと所有権

Session コントローラーは、連続してロードされた論理イベントウィンドウを所有する。各 `SessionEventLikeEntry` は、1 つの永続イベントに対する `{ type: 'event', event: SessionEvent }` か、Client 専用の `assistant/live-chunk` プレゼンテーション 1 つに対する `{ type: 'transient', event: AssistantLiveChunkEvent }` のいずれかである。両方の内側のイベントは `type`、`seq`、`time`、`data` を公開する。`ui-conversation` は第 2 の履歴ストリームを開くことなく、これらのエントリーをアセンブラーに渡す。Session ごとに 1 つの `ConversationNodeAssembler` が、登録されたすべての Definition を適用し、登録されたビューターゲットごとに独立したソースを発行する。

| 概念 | 所有者と目的 |
|---|---|
| イベント Definition | ビジネスパッケージが、永続または Client 専用の一時イベントを 1 度に 1 つマッチし、安定した `(kind, id)` で相関付け、決定的な State を畳み込み、任意で 1 つのターゲットノードを実体化する。 |
| Context | 1 つの `(kind, id)` に対するエンジン所有の順序付き Match と現在の State。永続イベントと一時イベントは開始になり得る。最も早くロードされた開始が State を初期化し、以降の Match がそれを更新する。更新のみの証拠は、その開始がロードされるまで保留のままである。 |
| Location | 永続的な境界イベントから導出される、エンジン所有の Session、Turn、または Step 座標。Definition は型付きデータを 1 つの Turn または Step に発行できる。 |
| View Definition | ターゲットパッケージが Session ごとに 1 つのインクリメンタルビルダーを作成し、そのターゲットの最終スナップショット型を所有する。 |
| Group Definition | ビジネスパッケージが、実体化された Node からあるターゲットのルート参照とグループスナップショットを導出する。メンバーシップ、セグメンテーション、サマリー、インクリメンタルキャッシュを所有する。 |
| View | Chat や Trajectory のようなスロットエントリーが、自身のターゲットスナップショットだけを読み、ターゲット所有のノードをレンダリングする。 |

Chat と Trajectory は同じ永続イベントファミリーを認識することがあるが、それぞれが自身の Definition State と最終ノードペイロードを保つ。共有されるターゲット中立の機構は、同一性ルーティング、順序付きリプレイ、Location データ、先行依存関係、発行ケイデンスに限られる。

## ターゲットのアクティブ化

各 Session はアクティブターゲットの単調な集合を保持する。ターゲットソースを作成または読むだけではアクティブ化されない。シェルは永続化された、または新しく選択された View を明示的にアクティブ化し、別のコンシューマーは最初のソースサブスクリプションを通じてターゲットをアクティブ化する。最初のアクティブ化がそのターゲットのビルダーを作成し、現在のターゲットインデックス付き Context から `replace()` を 1 回呼ぶ。以降のフラッシュはすべてのアクティブターゲットに対して `apply()` を呼び、サブスクリプション解除はターゲットを除去しない。

シェルは View の選択を所有し、バインディングが作成されたとき、または現在として選択されたときにレンダリングの前に、また View ロスターの変更後に、登録された優先 View または Chat フォールバックを解決する。アセンブラーは解決されたターゲット id だけを受け取り、Chat や他のデフォルトターゲットを選択しない。サードパーティの View は同じ選択とアクティブ化の操作を通じて参加する。View Definition は `toolCallFocus(callId)` を公開できる。シェルはこのケイパビリティを宣言する可視ターゲットに対してのみ Inspect を提供し、ターゲットは call id を自身のフォーカス同一性にマップする。

<a id="group-definitions"></a>
## Group Definition

省略可能な `ctx.uiConversation.groups.register(definition)` コントリビューションは、イベントおよびビューの登録と同じエフェクト所有のレジストリライフサイクルを使う。既存の View ターゲットを必要とし、Builder を構築せずにターゲットの重複登録を拒否する。各 Session はそのターゲットがアクティブ化されたときにのみ、自身の Group context を作成する。登録の置換は古い context を破棄し、既存のレジストリ再構築の中でその観測済みグループをクリアする。

[グループ型](../../packages/client/ui-conversation/src/client/contract/groups.ts)が完全なプロトコルを定義する:

| 型 | 意味 |
|---|---|
| `ConversationGroupDefinition<Node, State, Data>` | `create()` は Session ローカルの State を初期化する。`update(context, input)` は次の State を返す。`buildGroups(context)` は保留中の出力または `null` を返す。置換入力は entries と完全なグループ置換を要求する。 |
| `ConversationGroupInput<Node>` | `replace` はターゲット順序、タイムライン、および同期の `readNode`、`readTurn`、`readPosition` リーダーを提供する。`apply` は投影された `previous/current` Node 変更、ライフサイクルの `changedTurns`、`changedTurnOrders` を加える。State にリーダーを保持してはならない。 |
| `GroupNodePosition` | 所有する Turn (存在する場合) と、直前/直後の可視 Node キー。隣接は、Turn のみのキーリストが省略してしまう中断を保つ。 |
| `NodeReference` / `GroupReference` | ブランド付きの `NodeKey` または `GroupKey` で、`kind` によって区別される。Node 参照はレンダラー所有の `groupPart` を選択できる。省略すると Node 全体を選択する。 |
| `GroupSnapshot<Data>` | 不変のグループキー、ビジネスデータ、順序付き Node 参照。グループは他のグループを含むことも、ソース Node データを所有することもできない。 |
| `GroupUpdate<Data>` | `entries` は完全なルートシーケンスを置き換える。シーケンスを保つために省略できるのは apply 入力のみである。置換入力は `entries` と `groups.replace` の両方を要求する。`groups.replace.snapshots` はすべてのグループを置き換え、`groups.apply.upserts/removes` は指名されたグループレコードだけを更新する。除去は Node を削除しない。 |
| `ConversationGroupDataMap` | 宣言マージされたターゲット→データの対応で、登録と `views.grouped(target)` が共有する。宣言されていないターゲットはグループペイロード型を持たない。 |
| `ConversationGroupedView<Data>` | 安定したルート `entries` とキー付きの `groupSource(key)` リーダー。除去されたグループは `undefined` として読める。 |

Builder はグループ化が登録されている場合に `groupInput()` を公開する。入力が欠けていると最初のアクティブ化で失敗する。Builder は自身の投影の後の Node 値を記録し、コンテンツのみの順序同一性を保つ。アセンブラーは更新ごとに変更された Turn を提供する。直接の非グループ化 Builder 呼び出し元はそれらを省略できる。独立したソースを持つ Builder は通知を `publish()` まで遅らせる。最初のアクティブ化と通常のフラッシュは同じシーケンスを共有する: Location データと Node を実体化し、Builder を更新し、Group Definition を呼び、グループ化を検証してインストールし、その後、影響を受けるすべてのターゲットと Location ソースを発行する。グループフェーズは既存の発行ケイデンスを再利用する。

ターゲット位置インデックスがリーダーを供給し、可視キーまたは隣接が変わった Turn を識別する。`changedTurnOrders` には、移動した Node の両方の所有者と、挿入または除去されたスコープ外 Node に隣接する Turn が含まれる。ライフサイクルのみの変更は `changedTurns` に残る。ビジネス Definition はそれらの Turn を再セグメント化し、変更されたコンテンツを含むグループだけを更新できる。構造出力は依然として完全なルート参照配列を置き換えるが、変更されていない Node のコンテンツを読み直す必要はない。

Group ストアはインストールの前に、提出された結果全体を検証する: ルート Group 参照とレコードは 1 対 1 で対応し、参照されるすべての Node が存在し、各 `(NodeKey, groupPart)` は最大 1 つのルートまたはメンバー位置を占める。Node 全体とそのパーツの 1 つが共存することはできない。重複する upsert、重複する remove、および 1 つのグループの同時 upsert/remove は失敗する。データのみの upsert はルートとメンバーの配列を保ち、Node を読まず、変更されたグループソースだけに通知する。完全置換はすべての参照を再検証する。

レンダラーは 2 つの参照 kind で分岐し、グループデータ内のレンダラーフィールドではなく、所有する View 内でコンポーネントを選ぶ。ルート Node 参照と参照されたグループメンバーが完全なレンダーリストを形成する。参照されていないターゲット Node は保存されたままレンダリングされない。グループボディはサマリーデータとは別にメンバーを読む。表示モードはコンポーネント型、キー、メンバーの親を保たなければならず、データメンバーシップの変更は移動したメンバーを正当に再マウントさせることがある。フレームワークはパーツの完全性、セグメンテーション、表示ポリシーを解釈しない。

## 再生可能なイベントファミリー

Definition を書く前に、1 つの安定したビジネス id を選ぶ。同じ Node に寄与するすべてのイベントは、その id を運ぶか、自身のペイロードから独立に導出しなければならない。クライアントは更新を「最新の未完了」Context に割り当てては決してならない。

レビュージョブの場合、イベント契約は次のようになり得る:

| イベント | 役割 | 必要な永続ファクト |
|---|---|---|
| `review/start` | 一意な開始 | `reviewId`、Turn/Step 座標、タイトル |
| `review/progress` | 更新 | 同じ `reviewId`、座標、再生可能な進捗 |
| `review/end` | 更新 | 同じ `reviewId`、座標、最終サマリー |

プロセス境界を越えてプロデューサー所有のブランド付き id 型を使う。`SessionEventMap` マージとペイロード型をプロデューサーの型専用エクスポートに置き、そのエクスポートをクライアントパッケージから副作用のためにインポートする。各 `(kind, id)` は最大 1 つの開始イベントを持てる。単一イベントのビジネスは、`event.seq` のようなイベントの安定した同一性を Definition ローカル id として使える。

インクリメンタルイベントはサポートされる。プロデューサーが安価に発行できる場合は全体値のチェックポイントを優先する。開始がロード済みウィンドウの外にある場合でも有用だからである。各デルタは安定した id を運び、ログの `seq` 昇順で再生したときに決定的な State を生成しなければならず、ライブ専用のメモリーに依存してはならない。現在の履歴ウィンドウが更新のみを含む場合、アセンブラーは保留 Context を保持し、古いページが開始を供給するまで State を構築しない。製品が開始のロード前にレンダリングしなければならない場合、終端またはチェックポイントイベントは、Definition がその結果を直接構築するのに十分な全体フォールバック状態を運ばなければならない。無関係なイベントを走査してそれを回復してはならない。

ライブの Assistant デルタは Client 専用の `assistant/live-chunk` イベントとして到着する。再接続ベースラインは、アクティブなプロセスローカルのコンパクトストリームを同じ一時イベントに展開する。一方、永続的な `assistant/message` と `assistant/attempt` イベントは履歴再生用の完全なコンパクトストリームを埋め込む。一時イベントは Context を初期化できる。すべてのツールデルタと、その後の `tool/call` は、名前が届く前であっても同じ callId の下で開始としてマッチし得る。`start()` を呼ぶのは最も早いものだけで、以降の Match は `update()` を呼ぶ。準備中の Tool ノードは、名前が利用可能になってから初めて可視になる。履歴ページは確定済みメッセージをライブデルタに展開しない。Assistant 出力を消費する Definition は、同じマッチと更新のインターフェースを通じてライブチャンクと永続的な確定を扱う。一方、無関係な Definition はストリームを展開せずに `null` を返す。

## Definition と型付き Chat ペイロード

例では、全体の関係が見えるように、プロデューサーの宣言とクライアントのコントリビューションを 1 つのブロックにまとめている。パッケージファミリーでは、ブランド付き id と `SessionEventMap` 宣言をイベントプロデューサーに置き、Definition、Chat データマージ、レンダラーをクライアントプラグインに置く。

```ts ignore-check
import { createElement } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { Branded } from '@deepseek-ai/dsh-brand'
import type {
  ConversationLocation, ConversationNodeContext,
  ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChatNodeViewProps } from '@deepseek-ai/dsh-client-ui-chat/client'

type ReviewId = Branded<'ReviewId'>

interface ReviewStartData {
  readonly reviewId: ReviewId
  readonly turn: number
  readonly step: number
  readonly title: string
}

interface ReviewProgressData {
  readonly reviewId: ReviewId
  readonly turn: number
  readonly step: number
  readonly completed: number
}

interface ReviewEndData {
  readonly reviewId: ReviewId
  readonly turn: number
  readonly step: number
  readonly summary: string
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Opens one durable review job.
     * @mode emit
     * @param data - stable identity, location, and initial display state.
     */
    'review/start': ReviewStartData
    /**
     * Records replayable progress for one review job.
     * @mode emit
     * @param data - stable identity, location, and latest progress.
     */
    'review/progress': ReviewProgressData
    /**
     * Closes one review job with its final summary.
     * @mode emit
     * @param data - stable identity, location, and final display state.
     */
    'review/end': ReviewEndData
  }
}

interface ReviewChatData {
  readonly title: string
  readonly completed: number
  readonly status: 'running' | 'completed'
  readonly summary?: string
}

declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  interface ChatNodeDataMap {
    'review-job': ReviewChatData
  }
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationStepDataMap {
    'review-job': ReviewChatData
  }
}

interface ReviewState extends ReviewChatData {
  readonly turn: number
  readonly step: number
}

function locationOf(context: ConversationNodeContext): ConversationLocation {
  return context.start?.location ?? context.matches[0]?.location ?? { kind: 'unresolved' }
}

function viewData(state: ReviewState): ReviewChatData {
  return {
    title: state.title,
    completed: state.completed,
    status: state.status,
    ...state.summary === undefined ? {} : { summary: state.summary },
  }
}

const reviewDefinition: ConversationNodeDefinition<ReviewState> = {
  kind: 'review-job',
  target: 'chat',
  match: (event) => {
    if (event.type === 'review/start') {
      return { id: String(event.data.reviewId), role: 'start' }
    }
    if (event.type === 'review/progress' || event.type === 'review/end') {
      return { id: String(event.data.reviewId), role: 'update' }
    }
    return null
  },
  start: (_context, match) => {
    if (match.event.type !== 'review/start') throw new Error('review-job requires review/start')
    return {
      turn: match.event.data.turn,
      step: match.event.data.step,
      title: match.event.data.title,
      completed: 0,
      status: 'running',
    }
  },
  update: (context, match) => {
    if (match.event.type === 'review/progress') {
      return { ...context.state, completed: match.event.data.completed }
    }
    if (match.event.type === 'review/end') {
      return { ...context.state, completed: 100, status: 'completed', summary: match.event.data.summary }
    }
    return context.state
  },
  publication: match => match.event.type === 'review/progress'
    ? 'animation-frame'
    : 'immediate',
  buildLocationData: (context, scope) => {
    if (scope !== 'step' || context.state === undefined) return null
    return {
      kind: 'step',
      turn: context.state.turn,
      step: context.state.step,
      key: 'review-job',
      value: viewData(context.state),
    }
  },
  buildViewNode: (context) => {
    if (context.state === undefined) return null
    return {
      key: context.key,
      kind: 'review-job',
      id: context.id,
      target: 'chat',
      anchorSeq: context.start?.event.seq ?? context.matches[0]?.event.seq ?? 0,
      location: locationOf(context),
      visibility: 'visible',
      data: viewData(context.state),
    }
  },
}

function ReviewNodeView({ node }: ChatNodeViewProps<'review-job'>) {
  const text = node.data.summary ?? `${node.data.title}: ${node.data.completed}%`
  return createElement('p', null, text)
}

export const inject = ['uiConversation', 'slots']

export function apply(ctx: ClientContext): void {
  ctx.uiConversation.events.register(reviewDefinition)
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'review-job',
  }, ReviewNodeView))
}
```

`match(event)` は同一性抽出器であり、畳み込みではない: 現在の `SessionEventLike` だけを受け取り、Definition ローカルの id とライフサイクル役割を返す。マッチの後、アセンブラーは `(kind, id)` によって Context を突き止め、永続か一時かを問わず、最も早くロードされた開始から初期化する。以降のすべての Match は、別の開始であっても `update` を呼ぶ。一時 Match の除去は、残りの証拠から開始を再選択し、State を再計算する。開始が残らない場合、State は undefined のままになる。どちらの関数もエンジンが採用する State を返す。新しい不変値を返すのが好ましいが、同じオブジェクトを変更して返す関数も採用の意味論は同じである。

`ConversationNodeDefinitionInput` は、この関数か、イベント型からマッチ関数への読み取り専用テーブルのいずれかを受け入れる。関数形式の登録はすべてのイベントを受け取り、テーブル登録は列挙された型だけを受け取る。レジストリはテーブルエントリーをコピーし、登録が変わったときに順序付き候補 Set を事前計算して、候補構築をイベントごとのディスパッチから外に保つ。テーブルを置き換えるには、登録解除して再登録する。解決された `ConversationNodeDefinition` 値は、どちらの場合も呼び出し可能な `match(event)` を保つ。

`exclusive: true` を持つマッチ結果は、Definition のターゲット上でそのイベントをクレームする。アセンブラーはどのマッチも受け入れる前にイベントのすべてのマッチを評価するため、結果は登録順に依存しない: クレームされたターゲットの他の Definition はそのイベントの Context を構築せず、そのターゲットの未マッチイベントフォールバックも実行されない。他のターゲットの Definition とターゲットを持たない Definition は依然としてそれを受け取る。1 つのターゲットへの 2 つのクレーム、またはターゲットを持たない Definition からのクレームはディスパッチ中に throw し、フォールバック自体が返したクレームは効果を持たない。ビジネス Definition は、同じターゲットの汎用 Definition がそうしなければ同様に提示してしまう種類のメッセージ — たとえば遅れて届いた質問への返信 — を提示するためにクレームを使う。

`buildLocationData(context, scope)` は任意で、Definition 所有のデータをエンジン所有の Turn または Step に発行する。宣言マージを使い、各キーに正確な値型を与える。同じ Location の別の Node は、Session を受け取ったり `snapshot.chat.nodes` を走査したりすることなく、`useTurnData(key)` のような制約付きスロットフックを通じてその値を消費できる。

`target` と `buildViewNode(context)` は、1 つのターゲット所有のレンダリングコントリビューションを宣言し、一緒に現れなければならない。`context.key` を React 向けの同一性として保ち、マッチしたイベントの順序から `anchorSeq` を選び、レンダラー対応のデータだけを返す。ターゲット Node が公開された後は、同じキーを返し続ける。可視フローから一時的に外す必要がある場合は、`null` で撤回するのではなく `visibility: 'hidden'` を使う。

Chat ノードは `groupTree` を通じて自身の行が立つ位置も選ぶ。位置は最も外側から内側へ順序付けられ、ある位置の Node はその内側のすべての効果も持つ。Chat のプロセスグループ化、ターン全体の折りたたみ、Turn 入力の検出はこの位置だけを読む。完全な契約は [group-tree.ts](../../packages/client/ui-chat/src/client/contract/group-tree.ts) にある。

| Node がこうである場合 | 宣言 |
|---|---|
| Step 1 でクレームされた人の入力。その Turn が交換を開く | `exchange` |
| その Turn の別の入力 (後続の人間入力やトリガー通知など)。プロセスの前では開始入力となり、後では Turn 全体が開いたままになる | `input` |
| ターン全体の折りたたみの外にとどまる Turn 通知 (エラーや完了ターンのフッターなど) | `turn` |
| ターン全体の折りたたみが依然として隠す独立した行 (モデルのリトライなど) | `process` |
| 周囲のステップランに加わる通常のプロセスコンテンツ | `groupTree` を省略 |

[Chat ビジネスルール](../../packages/client/ui-chat/src/client/conversation-nodes/README.md#process-grouping)が、ビルトイン Node が宣言する位置を列挙している。同じターゲットの汎用 Definition もあなたの Node が提示するイベントにマッチする場合、上述のように `exclusive: true` でそのイベントをクレームする。

## 先行の読み取り

Definition によっては、別のビジネス kind の最新の以前の State を必要とする。`start` は `ConversationContextReader` を受け取る。Context 集合を受け取ったりイベントを走査したりする代わりに、そこで `reader.previous<State>(kind)` を呼ぶ。リーダーは、現在の開始 `seq` より前の最も近い開始済み Context を読み取り専用データとして返す。

アセンブラーはその依存関係を記録する。後に古いページの前置がより近い先行を供給した場合、以前は未知だったウィンドウのギャップを閉じた場合、または先行 State を改訂した場合、アセンブラーは依存する Context を `start` から再実行し、その更新を `seq` 昇順で再生する。問い合わせた Definition は有用な State を書く責任を引き続き負う。リーダーはビジネス固有のクエリメソッドを公開せず、別の Context に対する変更権限も与えない。

## ウィンドウ更新パス

履歴は末尾から 1 ページずつ過去へ要求できる。Session ジャーナルがまず重複しない論理シーケンス範囲を検証し、次にアセンブラーが受け入れられた入力を最初の `seq` で順序付けしてから State を再生する。

| パス | エンジンの作業 | Definition から見える挙動 |
|---|---|---|
| オープン、再同期、ギャップ修復時の置換 | ロード済みウィンドウを再構築し、すべての標準イベントまたはパック済みランを Definition ごとに 1 回マッチし、開始済みの各 Context を再生する | `start` と、それに続く論理 `seq` 昇順の更新。保留中の更新のみの Context は State なしのまま残る |
| 古いページを 1 つ前置 | 新たに加わった古い入力だけをマッチし、`(kind, id)` で Context にマージし、既存のキー付きノードを保ち、影響を受ける Context と依存関係だけを再生する | 新たに見つかったスカラーの開始が、収集済みのスカラー更新とパック済み更新をアクティブ化する。変更された Location または先行は Context を再実行することがある |
| ライブイベントを 1 つ追加 | 各 Definition の `match` を 1 回呼び、マッチした Context をキーで引き、その Context だけを更新する | 開始後のマッチするイベントに対して 1 つのスカラー `update` と要求された 1 回の発行。既存 Context の走査はない |

登録された Definition が `D` 個あるとき、1 つの受信スカラーイベントまたはパック済みランは、`D` 回の現入力マッチと、マッチ後の定数時間の Context キー照会を実行する。Definition のコードはこの性質を保たなければならない: 通常の追加パスで、完全なイベントウィンドウ、すべての Context、`context.matches`、またはレンダリング済み Node 集合を走査してはならない。蓄積されたファクトには State、同一 Turn/Step の共有には Location データ、インデックス付きの先行依存関係には `reader.previous()` を使う。

`publication` は、変更された State がいつ実体化されるかを制御する。構造的または終端的な変更には `immediate`、高頻度の可視デルタには `animation-frame`、State の変更が後の発行にのみ供給される場合は `none` を使う。エンジンはすべてのスカラー更新をログ順で適用し、すべてのパック済みランを 1 回のバッチ更新で適用する。ケイデンスはビューの発行を合流させるだけである。

## 検証の義務

次の結果を確立する焦点を絞ったテストを追加する:

1. replace を通して渡された完全なウィンドウが、期待される最終 State、Location データ、Node ペイロード、`anchorSeq` を生成する。
2. 更新のみの末尾は保留のままとなる。その開始を前置すると、完全な replace と同じ結果が得られる。
3. 初期履歴に続くライブ追加は、結合されたウィンドウを再生するのと同じ結果を生成する。
4. 古いページの前置は、データが変わっていない既存のキー付き Node 値を置き換えることなく、より前の行を追加する。
5. 繰り返しの可視デルタは `context.key` を保ち、要求された場合はアニメーションフレームごとに最大 1 回発行する。
6. キー付きレンダラーは `node.data` と制約付き Location フックだけを消費し、Session イベントウィンドウ、Context、Chat ノードを走査しない。
7. スカラーとパック済みの Assistant 履歴は同じ最終 State、タイミング境界、ターゲットスナップショットを生成し、1 つのパック済みランは replace、prepend、Location 再生、レジストリ再構築を通じて 1 つの Match のままである。
8. ターゲットソースの作成はビルダーの作業を行わない。明示的な選択または最初のサブスクリプションが 1 回の完全な置換を実行し、以降の更新はすべてのアクティブターゲットに届き、繰り返しのアクティブ化は置換を行わない。

ストリーミングと中断には [`packages/client/ui-chat/src/client/conversation-nodes/assistant.ts`](../../packages/client/ui-chat/src/client/conversation-nodes/assistant.ts) を、先行クエリには [`inbox.ts`](../../packages/client/ui-chat/src/client/conversation-nodes/inbox.ts) と [`message.ts`](../../packages/client/ui-chat/src/client/conversation-nodes/message.ts) を、自身の Node を作成せずに Turn データを発行する Definition には [`packages/client/ui-deliverables`](../../packages/client/ui-deliverables) を使う。
