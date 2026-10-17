# 会話とセッションのルール

日本語 | [English](conversation-and-session.en.md) | [中文](conversation-and-session.zh.md)

セッションを読み取り、保持し、会話ノードを計算して描画するためのルール。データモデルと型ごとのセマンティクスは [session-projection.md](../subsystems/session-projection.md) と [conversation.md](../subsystems/conversation.md) に記述されている。

## プロジェクションが唯一の読み取り・計算経路

セッションデータはプロジェクションを通じて読み取り、計算する。クライアントはセッションログを引く代わりにプロジェクション値を読み、セッションに属する計算は、オンデマンドで再計算される代わりに、結果を公開する登録済みプロジェクションユニットとして実行される。同じ問いへの 2 つの答え — 一方はプルされ、他方はプッシュされる — は乖離するため、レンダリングがセッションログの裏付けを失った値を表示することがある。

- 判定条件: クライアントが描画するすべてのセッション由来の値は、描画位置でのプロジェクション読み取りを通じて届き、セッション内で新たに行われる計算はすべて、結果が公開値としてクライアントに届くユニットとして登録される。コンポーネント自身がセッションデータを取得する場合、または読み手がオンデマンドで計算を起動する場合は違反である。
- 状態とビュー: ユニットはホスト側の State を畳み込み、その上にクライアント可視の View を宣言し、登録がその分担を表す。`ProjectionDefinition` のフィールドとそれらを駆動するレジストリは [session-projection.md](../subsystems/session-projection.md#ctxsessionprojections--sessionprojectionregistry) に属する。
- バージョン: `stateVersion` は 1 から始まり、シリアライズされた状態フィールドまたは畳み込みのセマンティクスが変わるたびに、互換かどうかに関わらず上げる。互換な変更が可能な場合はそれを優先するが、それでも上げる。同じキーを異なる `stateVersion` の値で二重登録することは、マージせずに throw する。
- 計算戦略: ユニットはデフォルトで全体を計算する。ユニットが計算する内容を絞り込むには、所有ドメインの専門家の確認が必要であり、実装者自身の判断で決めてはならない。
- 境界: 部分的なプロジェクションビューは、接続中のセッションが応答する前に描画されるキャッシュブロックのように、個々のキーのインターフェース可用性を担ってよい。それは外部から見える結果を決して決定せず、外部可視の結果は標準のプロジェクション値を待つ。

描画位置で読み取るコンポーネントと、プルされる代わりに登録する計算は、どちらも準拠している:

```tsx
// The client reads the published value; it never fetches Session data itself.
function PlanChip({ useProjection }: PlanChipProps) {
  const plan = useProjection('plan')
  return plan === undefined ? null : <Chip label={plan.label} />
}

// The computation is a registered unit; the registry drives it and publishes changes.
const planDefinition: ProjectionDefinition<'plan'> = {
  key: 'plan',
  stateVersion: 1,
  init: () => emptyPlan,
  apply: (state, event) => foldPlan(state, event),
  wire: { viewSchema: planSchema, view: planView },
}
```

同じ値自体のリクエストをプルするコンポーネントは単一の読み取り経路を破る:

```tsx
function PlanChip() {
  const [plan, setPlan] = useState<Plan>()
  useEffect(() => {
    void fetchSessionPlan(sessionId).then(setPlan)   // a second read path beside Projection
  }, [sessionId])
  return plan === undefined ? null : <Chip label={plan.label} />
}
```

プルされたコピーとプッシュされた値は食い違い、どちらをセッションが現在保持しているかをバージョンチェックで見分けることはできない。

## コールドリードは最後の手段

利用可能なキャッシュを元のログより先に読み、プロジェクションがデータをカバーしない場合にのみコールドリードに頼る。「小さなセッションは全体を読んでよい」という例外は削除済みであり、再検討しない。キャッシュされたデータと公式データが等価でない場合、行の欠落や陳腐化は、黙って低速経路へ切り替わる代わりに明示的な結果を生成する。

- 判定条件: セッション読み取りはまずプロジェクションキャッシュを参照し、行が存在しない場合は呼び出し元に明示的な状態を残す。`else` 分岐で完全なログを開くキャッシュテストは違反である。
- フォールバックのセマンティクス: ミスが何を意味するかは呼び出し元が決め、戻り値に明示する。キャッシュサイズやセッションサイズの例外はなく、その承認者もいない。
- 境界: この制限はクライアントのものである。ホスト側に「決してコールドリードをフォークしない」という絶対規則は要求しない。ホストはクライアントが開けないログを開く必要があるかもしれないからである。

保存されたプロジェクション行を先に読み、ミスは呼び出し元が描画する状態のままにする:

```ts ignore-check
// The listing reads stored projection rows; a miss remains an explicit state.
type ListingView =
  | { kind: 'cached'; snapshot: ProjectionSnapshot }
  | { kind: 'unknown' }

function readListing(header: SessionHeader, keys: readonly ProjectionKey[]): ListingView {
  const cached = ctx.sessionProjectionCache.cachedSnapshot(header, keys)
  return cached === undefined ? { kind: 'unknown' } : { kind: 'cached', snapshot: cached }
}
// Opening the complete log is a separate operation the caller names, never this fallback.
```

完全なログへフォールスルーするキャッシュテストは低速経路を通常経路にしてしまう:

```ts ignore-check
function readListing(header: SessionHeader, session: Session): ListingView {
  const cached = ctx.sessionProjectionCache.cachedSnapshot(header)
  if (cached !== undefined) return { kind: 'cached', snapshot: cached }
  return coldReadCompleteLog(session)   // every miss pays the full-log read
}
```

これでミスのたびにフォアグラウンドでログ全体を読むため、低速なセッションは、それを要求する経路だけでなく、あらゆるリスティングで低速になる。

## 保持は単一のライフサイクルルールに従う

クライアントはセッションを明示的な参照 (`SessionReference`) を通じて保持し、参照カウントが 0 になると解放する。アイドル回収は単一のライフサイクルルール — 参照がなく、処理中のものもない — に従い、ビジネス状態からどのセッションを回収可能かを列挙してはならない。そのリストは、セッションを追加するあらゆる機能が保守しなければならなくなるからである。暗黙の保持者は不可視であるため、回収側は誰がまだセッションを使用しているかを判別できない。

- 判定条件: 述語は `refCount == 0 && inflight == 0` である。コードは acquire → use の期間にわたり、retain と release を監査できる参照を通じてセッションを保持しているか？ モジュールレベルのセッションオブジェクトやグローバルな現在 id は違反である。
- 境界: 強制される部分は統一された述語とビジネス状態の列挙の不在である。解放トリガー自体は手動確認であり、手動確認のみを却下理由にはしない。
- 所有権: `retain`、`release`、`ready`、ティアダウンの順序は [セッションコントローラーのクライアント参照](../../packages/api/session-controller/README.md#client-references) に属する。メッセージに含まれるソースセッションの言及は別の型であり、[session-reference.md](../subsystems/session-reference.md) が所有する。

明示的な参照で保持し、ティアダウン時に解放するビューは準拠している:

```ts ignore-check
class SidebarSessionView implements Disposable {
  private readonly reference: SessionReference

  constructor(readonly id: SessionId, sessions: ISessions) {
    this.reference = sessions.retain(id, { source: 'sidebarView' })
    void this.reference.ready.catch((error: unknown) => { console.error('opening failed:', error) })
  }

  [Symbol.dispose](): void {
    this.reference.release()   // the last reference releases the Session
  }
}
```

セッションオブジェクトを保持し続けるモジュール状態は、すべての保持者を回収側から隠す:

```ts ignore-check
let currentSessionId: SessionId | undefined
const sessionCache = new Map<SessionId, Session>()

export function remember(session: Session): void {
  currentSessionId = session.id
  sessionCache.set(session.id, session)
}

export function reclaimIdle(): void {
  if (state === 'idle' || state === 'closed') reclaim()   // a newly added state is missed
}
```

誰もまだセッションを使用しているかを数えることができず、セッションに追加された次の状態は列挙をすり抜けて決して回収されない。

## ノード計算は増分的であり、ストリーミング公開はバッチ化される

新しいノード計算はその複雑性を明示し、高頻度のストリーミングチャンクは即時公開せず、全体を再計算しない。チャンクごとの全体再構築を一度に公開すると、ノードコレクション全体がフレーム予算に載り、トランスクリプトがストリームの後ろで詰まる。追加経路のコスト — `D` 個の登録済み Definition に対する `D` 回のマッチと 1 回の定数時間 Context キー参照 — と公開語彙 (`none`、`animation-frame`、`immediate`) は [conversation.md](../subsystems/conversation.md#definition-and-typed-chat-payload) が所有する。

- 判定条件: 1 つのチャンクが計算する量 — 影響を受けるサブツリーへの増分であり、イベントウィンドウではない — と、その結果を公開するタイミング — チャンクごとの 1 回の公開ではなくバッチ化ポリシー。
- 境界: このルールは実装を拘束する。ケイデンス単独を却下理由にはしないため、変更は明示されたケイデンスと使用する公開経路で判定する。
- 高頻度経路での禁止事項: `immediate` 公開、およびチャンクごとの完全再計算。
- 境界: 構造的変更や終端変更は `immediate` で公開してよい。ケイデンスは公開ごとに選ばれるからである。バッチ化に拘束されるのは高頻度のデルタ経路のみである。

1 つの Context を更新し、合体された公開を要求するチャンクは準拠している:

```ts ignore-check
const assistantDefinition: ConversationNodeDefinition<AssistantState> = {
  kind: 'assistant-step',
  target: 'chat',
  match: event => matchAssistant(event),
  start: (_context, match) => initialState(match),
  update: (context, match) => appendChunk(context.state, match.event),   // increment, not the window
  publication: () => 'animation-frame',   // high-frequency deltas coalesce; never immediate
  buildViewNode: context => assistantNode(context),
}
```

チャンクごとにノードコレクション全体を再構築し、即座に公開する:

```ts ignore-check
function onChunk(chunk: AssistantLiveChunk): void {
  const nodes = buildNodesFromCompleteWindow(session)   // full recompute per chunk
  target.publish(nodes, { publication: 'immediate' })   // and an immediate publish
}
```

各チャンクがフレーム予算内でウィンドウ全体の再構築を要するため、グルーピングとレンダリングがストリームの後ろで詰まる。

## ノード構築・グルーピングエンジンはビジネスルールを持たない

ビジネスルールがグルーピングエンジンに入ることはなく、ビジネス要件が構築済みペイロードを再形成することもない。`ProcessState`、グループプロダクト階層、`conversation-nodes/process-groups.ts` のグループセマンティクス群はインフラストラクチャである。エンジンは grouped、standalone、reply などの enum 配置値のみを理解し、どれが適用されるかは呼び出し元が計算する。エンジン内の特別扱いは、すべてのコンシューマーに対して生成される構造を変え、グループ計算経路にビジネス条件を載せることになる。

- 判定条件: エンジンにビジネス条件が含まれているか？ `ProcessState` フィールドを追加する差分、グループレベルを追加・削除する差分、1 つのビジネスのためにグループセマンティクスを変える差分は失敗とする。配置の決定は enum 値を計算する呼び出し元に属する。
- 境界: レイヤリング、そのコスト、既存のビジネス上の期待が、ビジネスがグルーピング設計を作り直さない理由である。
- 境界: 新しい配置の意味を持つ新しい enum 値が、サポートされる拡張である。それを呼び出し元がどこで計算するかは問わない。
- 例外と承認者: デフォルトではなし。このインフラストラクチャへの変更には、対応するドメイン専門家の確認が必要である。グループ Definition 型は [conversation.md](../subsystems/conversation.md#group-definitions) が所有する。

呼び出し元がビジネス上の意味を決め、エンジンが配置に使う配置 enum を渡す:

```ts ignore-check
// Business judgment stays in the caller.
function placementOf(command: CommandView): NodePlacement {
  return isHandoff(command) ? 'reply' : 'grouped'
}

// The engine consumes the enum as data; it reads no business condition.
function groupEntries(commands: readonly CommandView[]): readonly NodePlacement[] {
  return commands.map(placementOf)
}
```

エンジン自身の計算内のビジネス条件:

```ts ignore-check
// The grouping engine asks what a node means, not where it goes.
function placeProcessNode(node: ChatConversationViewNode): GroupPlacement {
  if (node.kind === 'command' && isRagMessage(node)) return 'rag'   // business special case
  return 'grouped'
}
```

生成される構造が 1 つのビジネスの意味を帯びるため、すべてのコンシューマーとグループ計算がその機能に追随する。

## ノードリストとシートコンポーネントはビジネス分岐を持たない

`ChatNodeList`、`ChatNodeSeat`、`ChatGroupSeat` はインフラストラクチャである。ビジネス条件もビジネス固有フィールドも持たず、単一のビジネスがリスト走査やシート選択を変えることはない。新しいノード形状は、その kind を `ChatNodeDataMap` に提供し、kind 登録サーフェスを通じてレンダラーを提供する。これにより、ビジネスセマンティクスをビジネスモジュールに留めたまま、リストは kind でのディスパッチを続けられる。1 つの機能のために追加された分岐は、すべてのノードのレンダリングをその機能に依存させる。

- 判定条件: リストまたはシートコンポーネント内のビジネス分岐、その props 上のビジネス専用フィールド、または 1 つのビジネスに奉仕する走査・シート選択の変更。
- 正しい出口: ビジネスパッケージは自身のキーを `ChatNodeDataMap` にマージし、ノード kind のレンダラーを登録する。シートはそのノードの kind に対し登録されたコンポーネントを描画する。登録の規律は [slots.md](../subsystems/slots.md#extension-rules) が所有する。
- 境界: すべてのビジネスに適用されるレンダリング変更 — 順序、仮想化、アクセシビリティ — はビジネス変更ではない。
- 例外と承認者: デフォルトではなし。例外はすべて対応するドメイン専門家が確認する。

自身の kind を宣言しレンダラーを登録するビジネスパッケージは、共有リストをそのままに保つ:

```tsx
// The business declares its kind and registers its renderer; the shared list is untouched.
declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  interface ChatNodeDataMap { handoff: HandoffData }
}

const HandoffNodeView = memo(function HandoffNodeView({ node, t }: ChatNodeOwnerProps<'handoff'>) {
  return <HandoffCard data={node.data} t={t} />
})

ctx.slots.inject('conversation.chat.node', () => ctx.slots.register(
  { name: 'conversation.chat.node', key: 'handoff', locale: NS }, HandoffNodeView))
```

共有シート内のビジネス分岐とビジネスフィールド:

```tsx
export const ChatNodeSeat = memo(function ChatNodeSeat({ node, handoffFlag }: ChatNodeSeatProps) {
  if (node.kind === 'user' && handoffFlag) return <HandoffSeat node={node} />   // business dispatch
  return <div data-handoff={handoffFlag}>{renderByKind(node)}</div>
})
```

ある機能の条件がすべてのノードの描画方法を決めるようになり、次の機能のためには共有シートを再び変更しなければならない。

## Markdown パイプラインはビジネス分岐を持たない

`AssistantMarkdown` とそのレンダリングパイプラインはインフラストラクチャである。ビジネス条件が Markdown 描画経路に入ることはなく、ビジネスがノードマッピングやスタイル注入ルールを書き換えることもない。表示上のニーズは既存チェーンへのレンダラー登録かデータでの表現で実現し、公式のデフォルトコンテンツも、ホスト側のインラインフォールバック付きのオプショナルレンダラーとして存在するのではなく、同じ登録サーフェスに参加する。ビジネスの特別扱いを抱え込んだパイプラインは、単独でレビューすることも最適化することもできなくなる。

- 判定条件: `AssistantMarkdown` またはそのブロックマッピング内のビジネス分岐 — 例えば `if (isXxxBusiness) renderXxx()` — や、1 つのビジネスをキーにしたスタイル注入ルール。
- 正しい出口: 既存チェーンに登録されたレンダラー、または汎用レンダラーが読むデータ内のセマンティックフィールド。Component Factory の登録は [ui-renderer README](../../packages/client/ui-renderer/README.md) が所有する。
- ラッピング: 標準レンダリングを必要とするラッパーは公式エントリーを呼び、自身のフォールバックを保つ。スロットを再レンダリングしてはならず、パッケージを跨いで非公開の React コンポーネントを import してもならない。
- 責務: 位置と起動はホストが所有し、プラグインは自身の状態・クリーンアップ・コントロールを所有する。公式ホストはコントリビューションのためのビジネスアクションを一切持たない。
- `labels`: オプションの完全な `MarkdownLabels` オブジェクトは全体として使用され、デフォルトとのフィールド単位のマージは行わない。省略時は公式デフォルトを使用する。`variant="compact"` は Factory が固定する。
- 境界: 汎用的な Markdown 機能 — 構文サポート、パフォーマンス — はビジネス変更ではない。
- 例外と承認者: デフォルトではなし。例外はすべて対応するドメイン専門家が確認する。

既存の単一シートに登録し、標準コンテンツを再レンダリングする代わりに公開済み Factory を再利用するコントリビューション:

```tsx
// The business contributes its own body into the seat the host already renders.
ctx.slots.inject('conversation.chat.reasoning.body', () => ctx.slots.register(
  { name: 'conversation.chat.reasoning.body', scope: 'session', locale: NS },
  TranslatedReasoningBody,
))

// The contribution keeps the standard rendering by calling the published Factory.
function TranslatedReasoningBody({ text, running, renderFactorySlot, t }: ReasoningBodyProps) {
  return (
    <>
      <p>{t('reasoning.translated')}</p>
      {renderFactorySlot('conversation.chat.reasoning.content', { text, running })}
    </>
  )
}
```

共有 Markdown パイプライン内のビジネス分岐:

```tsx
export const AssistantMarkdown = memo(function AssistantMarkdown({ blocks, ...props }: AssistantMarkdownProps) {
  return <>{blocks.map(block => (
    isHandoffBlock(block)
      ? <HandoffBlock block={block} />   // a business special case in the pipeline
      : renderBlock(block, props)
  ))}</>
})
```

すべてのビジネスの特別扱いが 1 つの共有パイプラインに集中し、Markdown レンダリングは、自らが抱え込むに至ったビジネス群なしには変更も計測もできなくなる。

## ユーザーメッセージモデルとレンダリングはビジネスフィールドを持たない

`UserMessage` と UI の `user` kind のレンダリングはインフラストラクチャである。メッセージモデルにビジネス専用フィールドはなく、ユーザーメッセージレンダラーにビジネス分岐もない。ビジネス上の差異はメッセージペイロード — 自身のマージ拡張可能なソース kind またはコンテンツフィールド — を通じて、あるいは登録されたレンダラーを通じて伝わる。1 つのビジネスのために追加されたフィールドはモデルのすべてのコンシューマーが扱うことになり、次のビジネスは同じ共有レンダラーにさらに分岐を追加する。

- 判定条件: `UserMessage` 上のビジネス名を冠したフィールド、または `user` kind のレンダリング内のビジネス条件。
- 正しい出口: ペイロードでの表現。`MessageSourceMap` は宣言マージで拡張可能なため、プロデューサーは `UserMessage` を広げるのではなく自身のソース kind を宣言する。メッセージモデルは [session.md](../subsystems/session.md) に記述されている。
- 境界: 汎用的なメッセージ機能 — 添付、引用、編集状態 — はビジネス変更ではない。
- 例外と承認者: デフォルトではなし。例外はすべて対応するドメイン専門家が確認する。

自身のソース kind を宣言するプロデューサーは、ビジネス上の差異をペイロードに留める:

```ts ignore-check
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    handoff: { kind: 'handoff'; sessionId: SessionId }
  }
}

const message = createUserMessage({
  role: 'user',
  content: [{ type: 'text', text: prompt }],
  source: { kind: 'handoff', sessionId: source.id },
})
```

共有モデル上のビジネスフィールドと、それが共有レンダラーに強いる分岐:

```ts ignore-check
interface UserMessage extends MessageBase {
  readonly role: 'user'
  readonly handoffKind?: 'handoff' | 'rag'   // one business's field on the shared model
}

// ...and the renderer branches on it.
if (message.handoffKind === 'handoff') return <HandoffBubble message={message} />
```

メッセージモデルのすべてのコンシューマーが 1 つのビジネスのフィールドを扱い、共有レンダラーは追随するビジネスごとに分岐を増やしていく。
