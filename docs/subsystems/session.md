# セッション

日本語 | [English](session.en.md) | [中文](session.zh.md)

[dsh-session](../../packages/core/session) のインメモリでイベントソーシングされたモデル。`Session` は型付き `SessionEvent` の **追加専用ログ** であり、エージェントの全対話履歴の単一の信頼できる情報源である。LLM のメッセージ履歴はログから *導出* されるもので、別途保存されることはなく、リプレイは同じイベントからの再導出である。ログを **永続化** する方法（永続化シーム、バックエンド、クラッシュリカバリ）は姉妹関心事として [persistence.md](persistence.md) で扱う。

ソース: [`packages/core/session/src/types.ts`](../../packages/core/session/src/types.ts)

## `SessionEventMap` — イベントの語彙

追加専用イベントの型。マージ拡張可能である: プラグインは宣言マージを介して追加のイベント型を宣言する。たとえば [コンパクションシーム](compaction.md) は `compaction/start` / `compaction/summary` / `compaction/end` を追加し、`@deepseek-ai/dsh-hook-protocol` はフックブリッジのためにログ専用の `hook/invoked` / `hook/result` レコードを追加する。`compaction/*` と同様、これらは `SurfaceEventType` ではない（`surfaceOp` を持たない）。生成された [永続化ログイベントカタログ](../persistence-catalog.md) は、コアとマージ済みを含むすべてのメンバーをペイロード、サーフェスバッジ、宣言箇所とともに列挙する。

```ts type-equiv
/** A user-role specialization of the shared message representation. */
interface UserMessage extends MessageBase {
  readonly role: 'user'
}
```

```ts type-equiv
/**
 * The merge-extensible, append-only source of truth for an agent interaction.
 * Message history is derived from this log. Every event is lossless JSON and
 * sequence numbers stay contiguous. Assistant attempt events embed their exact
 * compact raw streams so persistence stores one durable settlement per attempt.
 */
interface SessionEventMap {
  /**
   * Opens turn `turn` before the loop claims queued input or runs pre-step.
   * Rejection, empty input, cancellation, or failure may close it with no
   * step; otherwise the following identified `user/message` event or batch
   * records the messages entering the step.
   */
  'turn/start': { turn: number }
  /**
   * Closes turn `turn` with the {@link TurnEndReason} that ended it. A turn
   * with no entered step has no `step/start` or `step/end`. The loop does not await a
   * flush at turn boundaries: `dsh-session-checkpoint-policy` owns the
   * per-request durability checkpoint, and consumers that read storage after
   * `whenIdle()` flush themselves. Success commits the turn; rejection is
   * reported live and does not prevent later work.
   */
  'turn/end': { turn: number; reason: TurnEndReason }
  /** Opens step `step` of turn `turn` — one model call plus the tool executions it requested. */
  'step/start': { turn: number; step: number }
  /** Closes step `step` of turn `turn`. */
  'step/end': { turn: number; step: number }
  /**
   * A user-role message on the model-visible surface: a direct human prompt
   * (the queued message claimed for this turn), a synthetic `agent.inject()`
   * context (file-change notices, subdir AGENTS.md, skill content, cron
   * notifications, …), or an entered goal continuation round. All three
   * project their `content` verbatim; `source` tells them apart.
   */
  'user/message': UserMessage
  /** An incremental agent session change admitted at the named turn and step. */
  'developer/message': {
    turn: number
    step: number
    message: DeveloperMessage
    /** Earlier request/header defining every tool addition; required exactly when additions are present. */
    headerSeq?: SessionSeq
  }
  /**
   * The rendered system prompt on the model-visible surface. The loop appends
   * the first one as surface node 0 before the step's first `user/message`.
   * A prepared in-history route can append nonempty changes in a continuing
   * series. An incapable route or new series normalizes text to the first system
   * node. Normalization empties nonempty later nodes, then rewrites the head if
   * needed, through logged per-node replacements. An empty rendering always
   * clears all active system nodes, leaving no older instructions model-visible.
   * Empty later nodes are dormant and project to no message; an empty head with
   * no active later node records "no system prompt". Restored nonempty text follows
   * the same route and series rule; empty nodes never restore older text.
   */
  'system/message': { turn: number; step: number; message: SystemMessage }
  /**
   * Assembled assistant message for one step (derived history uses this).
   * Carries the step's `usage` when the adapter reported token accounting, so
   * the model output and its accounting travel together (there is no separate
   * usage record). `usage` is absent when the adapter reported none. A turn
   * cancelled mid-stream finalizes its delivered text/reasoning prefix as this
   * event with `interrupted: true`; undispatched tool calls are absent. The
   * marker distinguishes that prefix without re-deriving interruption from turn
   * boundaries. An aborted turn with no such event streamed no visible content.
   */
  'assistant/message': {
    turn: number
    step: number
    message: AssistantMessage
    /** Exact timed model stream, compacted without joining delta boundaries. */
    stream: AssistantStreamRecord[]
    usage?: TokenUsage
    interrupted?: true
  }
  /**
   * One model attempt that committed no surface message. The embedded stream
   * preserves a failed, retried, cancelled, or stream-error attempt that
   * reached settlement without fabricating model-visible history.
   */
  'assistant/attempt': { turn: number; step: number; stream: AssistantStreamRecord[] }
  /**
   * The model requested one tool invocation: `name` with the raw `arguments`
   * JSON string exactly as the model produced it (unparsed). `callId` pairs the
   * call with its `tool/result`.
   */
  'tool/call': { turn: number; step: number; callId: ToolCallId; name: string; arguments: string }
  /**
   * A completed tool call's model-facing result, optional internal failure
   * identity and user-facing reason, and optional tool-private `meta`
   * presentation payload. The reason remains outside the model-facing message.
   * `meta` is
   * opaque to the core (the producing tool owns its shape and reads it back in
   * `presentResult`) but MUST be JSON-serializable: `Session.append`
   * runtime-validates all event data with `isJsonValue`, so a non-serializable
   * `meta` is rejected at the source, and the durable log reproduces the
   * identical card on replay. Absent
   * unless the tool attaches one (e.g. `dsh-tool-fs` carries its result-time
   * contextual diff here).
   */
  'tool/result': {
    turn: number
    step: number
    message: ToolResultMessage
    /**
     * Optional failure identity and raw user-facing reason, outside model content;
     * allowed only when the message has `isError: true`.
     */
    error?: { name: string; code: string; reason?: string }
    meta?: JsonValue
  }
  /**
   * Full header for the next request, appended inside its step before dispatch.
   * It is log-only; the latest snapshot reconstructs the request header.
   */
  'request/header': {
    header: EpochHeader
    reason: RequestHeaderReason
    /** This request begins a distinct model-message series, independently of the header reason. */
    startsSeries?: true
  }
  /**
   * Route metadata for the next request, logged only when the route, capacity,
   * or system prompt update mode changes. It does not participate in request
   * reconstruction or header equality. Prompt admission uses the bound prepared
   * call's capability, not this snapshot from an earlier request.
   */
  'request/context': RequestContext
  /**
   * Separates inherited or restored history from later lifecycle-owned work.
   * This log-only marker need not be at {@link Session.firstLiveSeq}: a fork
   * seed can already contain its tagged marker and child-owned synthetic
   * closers before construction.
   *
   * A fresh fork child owns one `{ inherited: true }` marker at its exact
   * inherited-prefix cut, even when that prefix ends in an ancestor marker.
   * `buildForkSeed` appends that marker before any synthetic closers; the
   * `Session` constructor supplies it when given only the inherited prefix.
   * The last tagged marker is the current Session's cut; untagged markers
   * keep ordinary restore and replay lifecycle boundaries.
   *
   * Only the `Session` constructor and `buildForkSeed` may create this marker.
   * Session append does not reject other writers, so a plugin appending one
   * would silently classify every live bracket before it as seed history.
   *
   * An owner of a standalone open/close bracket (`compaction/start` …
   * `compaction/end`) reads it because seed history and live work are otherwise
   * byte-identical: an unmatched opening marker before this event belongs to
   * an ended lifecycle, whatever ended it. NOT a liveness signal about other
   * writers — a concurrently live session holds its own boundary elsewhere,
   * so tolerating concurrent writers needs a signal beyond the log.
   */
  'session/end-seed': { inherited?: true }
}
```

`UserMessage` は、通常のプロンプト、注入されたコンテキスト、ステアリング、ライブ受信箱イベントで共有される、識別済みで凍結された user ロールの値である。イベントラッパーはイベントローカルな位置や結果のファクトのみを追加し、ループはアイテムが保留中の間にドライバー所有のルーティング状態のみを追加する。

<a id="the-request-header-event-requestheader"></a>

### リクエストヘッダーイベント: `request/header`

リクエストエンベロープ（`EpochHeader`: 呼び出し設定＋アダプター提供デフォルトのマーカー＋組み立て済みツールスキーマ）はログに記録されるセッション状態であり、そのためすべての会話リクエストはログの純粋関数になる（再構築可能性の Agent Note）。レンダリング済みシステムプロンプトはヘッダーの一部ではない。それは導出履歴であり、サーフェスノード 0 の `system/message` イベントと、それ以降の履歴内システムノードである（[決定](../../.agents/notes/implemented/architecture/2026-09-02-system-prompt-as-surface-node.md)）。そのためプロンプトの変更はシステムノードを置換または追加し、ヘッダーは変更しない。理由 `'initial'` または `'resume'` を持つ完全な `request/header` スナップショットは各ループインスタンス境界を記録し、変更されたリクエストは理由 `'change'` のスナップショットを追加し、明示的に宣言されたメッセージシリーズを開始する変更なしエンベロープやサーフェス置換に続くものは理由 `'series'` のスナップショットを追加する。`'initial'`、`'resume'`、`'change'` スナップショットは、そのリクエストがシリーズも開始する場合に `startsSeries: true` を運ぶ。理由 `'series'` 自体がその事実をすでに記録している。通常の追加専用の後続ターン、追加ステップ、同一モデルメッセージシリーズ内のリトライは最新のスナップショットを継承する。`foldRequestHeader(events)` は最新のスナップショットを選択してヘッダーを再構築する。このイベントは `SurfaceEventType` ではなく、LLM メッセージを生成しない。

```ts type-equiv
/**
 * Logged request state outside derived history: call config and tools. The
 * system prompt is derived history — surface node 0, a `system/message` event.
 * The latest full `request/header` snapshot reconstructs the header; canonical
 * empty optional fields are absent.
 */
interface EpochHeader {
  /** The conversation's call configuration (provider, model, reasoning effort, and sampling scalars). */
  config: LlmCallConfig
  /** Effective config fields materialized from the exact adapter rather than proposed by a caller. */
  adapterDefaults?: LlmCallConfigAdapterDefaults
  /** Assembled tool schemas; absent for a tool-less request. */
  tools?: ToolSchema[]
  /** Retired request text; system prompts belong to system/message events.
   * @persistenceReserved
   */
  system?: never
}
```

現在のイベント受け入れは正準の `request/header.header` を要求する。`system` フィールドは禁止であり、`tools: []` と `adapterDefaults: {}` は省略しなければならない。空白のみのシステムメッセージ内容、`config.stop: []`、ネストされた拡張は変更されない。シード、追加、現在の永続化読み取りは非正準ヘッダーを暗黙に正規化せず拒否する。歴史的変換は [V3 エンベロープの決定](../../.agents/notes/implemented/architecture/2026-09-06-v3-canonical-session-envelopes.md) が所有する。`request/header-delta` や完全スナップショットの `fallback` 理由を含むレガシー v0 ログは、不完全にリプレイせず拒否される。

### ルート容量イベント: `request/context`

リクエストが解決されたルートのコンテキストメタデータは別のログ記録状態であり、同じステップ内の `request/header` の横に追加され、プロバイダー、モデル、容量、または `systemPromptUpdate` モードが前回記録と異なる場合にのみ追加される。それは `EpochHeader` の外側に留まる。なぜならその型は `headerEquals` によりフィールド単位で比較される再構築契約であり、容量と更新モードはリクエスト入力ではなくルートを記述するため、取り込むとルート変更がリクエストエンベロープの `change` として登録され、アダプターメタデータがループのリクエスト再構築に引き込まれるからである。`request/header` と同様、これは `SurfaceEventType` ではなく、LLM メッセージを生成しない。`session.requestContext()` は最新の記録を増分的に畳み込む。エージェントループは、変更されたシステムプロンプトが最新のシステムノードを置換するか、キャッシュ済み履歴の後に追加されるかを決定する際に、その記録の `systemPromptUpdate` を読む（[決定ルール](../../packages/core/agent-loop/README.md#understand-the-implementation)）。容量を広告しないアダプターのルートは `contextWindow` なしで記録され、新しい記録が古いルートの容量をクリアする。宣言済み更新モードのないルートも同様に古いルートの `systemPromptUpdate` をクリアする。

```ts type-equiv
/** Registration-bound metadata for one resolved model route. */
interface RequestContext {
  /** Registered provider route the metadata belongs to. */
  provider: string
  /** Provider-owned model id the metadata belongs to. */
  model: string
  /** Maximum combined request and response context in tokens, when advertised. */
  contextWindow?: number
  /** `'in-history'` when the route reads the latest `system` message at any position as the effective system prompt. */
  systemPromptUpdate?: SystemPromptUpdate
}
```

## `SessionEvent<T>` — 1件のログエントリ

`type` 上の正規の判別共用体であり（独立した `type` / `data` 共用体ではない）、`switch (event.type)` がキャストなしに `event.data` を絞り込む。`seq` はログ内の単調な位置（`seq = log.length`）であり、`time` はエポックミリ秒である。

```ts type-equiv
/** Sequence number of one existing event in a Session log. */
type SessionSeq = BrandedNumber<'SessionSeq'>
```

```ts type-equiv
/** A Session log gap, prefix length, or read offset, which may equal the event count. */
type SessionLogOffset = BrandedNumber<'SessionLogOffset'>
```

```ts type-equiv
/** Inclusive Session event watermark, or `-1` before any event exists. */
type SessionSeqCursor = SessionSeq | -1
```

```ts type-equiv
/** One existing Session event position, or explicit absence. */
type OptionalSessionSeq = SessionSeq | null
```

`SessionSeq(value)` と `SessionLogOffset(value)` は非負の安全な整数のみを受け入れ、負のゼロを拒否する。これらはシリアライズされた数値を変えずにコンパイル時のブランドを付加する。算術演算は通常の `number` を返し、呼び出し元は意図した役割のためにコンストラクタを介して再び受け入れなければならない。

```ts type-equiv
/**
 * One immutable entry in the session log.
 *
 * A proper discriminated union over `type` (not independent `type`/`data`
 * unions), so `switch (event.type)` narrows `event.data` without casts.
 *
 * The {@link sourceEventSeqs} and {@link surfaceOp} fields are conditional:
 * they only exist on {@link SurfaceEventType} variants (`system/message`, `user/message`,
 * `assistant/message`, `tool/result`).
 * Non-surface events (boundary markers, attempts, errors) never carry
 * surface metadata — the compiler enforces this at `Session.append()`
 * call sites.
 */
type SessionEvent<T extends SessionEventType = SessionEventType> = {
  [K in SessionEventType]: {
    type: K
    /** Monotonic sequence number within the session. */
    seq: SessionSeq
    /** Unix epoch milliseconds. */
    time: number
    data: SessionEventMap[K]
    /**
     * Marks an event a reader may safely skip when it does not recognize
     * `type`. Absent means required: a reader meeting an unrecognized type
     * without this marker MUST refuse to reconstruct the session instead of
     * silently dropping the event, because an unrecognized required event may
     * change how the rest of the log is interpreted. A writer sets `true` only
     * on purely informational records whose loss cannot affect reconstruction;
     * defaulting to required means a forgotten marker over-refuses (an
     * inconvenience) rather than silently resuming a gutted session.
     */
    ignorable?: true
  } & (K extends SurfaceEventType ? SurfaceIntent<K> : {
    surfaceOp?: never
    sourceEventSeqs?: never
  })
}[T]
```

`SessionEventType = keyof SessionEventMap` である。`SessionEventMap` はマージ拡張可能なため、`SessionEvent` 上の switch では `assertNever` を使ってはならない。プラグインが追加したバリアントは有効な未知の値であり、既知のケースを処理して `default` にフォールスルーすること。

すべてのサーフェスイベントは `surfaceOp` を要求し、既知のログ専用イベントは両方のサーフェスメタデータフィールドを禁止する。ネイティブな未知または旧式の無視可能エンベロープは不透明のままである。`assistant/message` はプロバイダーストリームを埋め込み、`sourceEventSeqs` を禁止する。システム、ユーザー、ツールのサーフェスイベントは、ソース帰属や置換カバレッジが必要な場合に、完全で空でない一意な以前のイベント集合を引用できる。`tool/result` はメッセージが `isError: true` を持つ場合にのみ `data.error` を運べる。失敗 ID は失敗結果に対して任意のままである。

## サーフェス型

メッセージを生成する型（`SurfaceEventType`:`system/message`、`developer/message`、`user/message`、`assistant/message`、`tool/result`）は、順序付き導出サーフェスへの参加方法を宣言するサーフェスメタデータを運ぶ。`system/message` はレンダリング済みシステムプロンプトを保持する。ループは最初のものをサーフェスノード 0 として追加し、プロンプトが変更された場合は最新のシステムノードを正確に置換するか、履歴内ルート上で新しいものを追加する。サーフェスフォールドはノード 0 の `system/message` を覆う他の置換を拒否する一方、それ以降のシステムノードは通常の履歴であり、コンパクション置換がシャドウできる。[セッションサーフェスの Agent Note](../../.agents/notes/implemented/architecture/2026-06-18-session-surface.md) を参照。

### `SurfaceEventType` — メッセージを生成するイベント型のサブセット

```ts type-equiv
/**
 * The subset of {@link SessionEventType} values whose events produce LLM
 * messages and are eligible to appear on the ordered surface. Only these
 * event types may carry {@link SurfaceOp}; system, user, and tool events may also cite
 * earlier sources through {@link SessionEvent.sourceEventSeqs}.
 */
type SurfaceEventType =
  | 'system/message'
  | 'developer/message'
  | 'user/message'
  | 'assistant/message'
  | 'tool/result'
```

### `SurfaceOp` — イベントがサーフェスに入った方法

```ts type-equiv
/**
 * How a session event entered the ordered surface. Only valid on
 * {@link SurfaceEventType} events.
 *
 * - `'append'`: added to the tail — normal path for user/assistant/tool
 *   messages.
 * - `{ op: 'replace', startSeq, endSeq }`: replaces surface nodes from `startSeq`
 *   (inclusive) through `endSeq` (inclusive) with this node. Both must exist as
 *   surface nodes in the current surface. `startSeq === endSeq` replaces a single
 *   node. The node's {@link SessionEvent.sourceEventSeqs} must include every
 *   shadowed surface node. Used by compaction; any surface-replacing producer
 *   may use it.
 */
type SurfaceOp =
  | 'append'
  | { op: 'replace'; startSeq: SessionSeq; endSeq: SessionSeq }
```

`'append'` は通常の末尾追加パスである。`replace` は `op`、`startSeq`、`endSeq` のみを含み、別名や追加キーを持たない。これは現在のサーフェスイベントシーケンス間の包括的スパンをシャドウし、その位置に新しいイベントを挿入する。端点が等しい場合は1エントリを置換する。端点は置換イベントより前になければならないが、その相対順序は数値シーケンス順ではなくサーフェス順である。

### `SurfaceIntent` — `session.append()` への引数

```ts type-equiv
/**
 * Surface placement and cited source-event seqs for {@link Session.append}. Required on
 * message-producing events and forbidden on log-only events.
 */
type SurfaceIntent<T extends SurfaceEventType = SurfaceEventType> = {
  surfaceOp: SurfaceOp
} & (T extends 'assistant/message' ? {
  /** Assistant messages embed their provider stream instead of citing source events. */
  sourceEventSeqs?: never
} : {
  /** Complete non-empty set of known earlier source-event seqs. */
  sourceEventSeqs?: SessionSeq[]
})
```

`SurfaceEventType` イベントには必須である。すべてのメッセージ生成イベントは、導出モデル履歴の唯一の情報源であるサーフェスへの参加方法を宣言しなければならない。人間向けトランスクリプトはもう一方のプロジェクションであり、ログの追加起点イベントを代わりに読む。サーフェスは置換が要約する範囲を意図的にシャドウするためである（[dsh-session](../../packages/core/session/README.md) の `isAppendSurfaceEvent`）。非サーフェス型はコンパイル時にこれを拒否する。

`assistant/message` は `sourceEventSeqs` を運べない。その `stream` が正確なプロバイダー証拠を所有する。他のサーフェスイベントは、以前のイベントを引用しない場合はフィールドを省略し、引用する場合は完全で空でないリストを使う。

<a id="plugin-owned-message-projections"></a>
### プラグイン所有のメッセージプロジェクション

内容を変更するプラグインはイベント宣言を `@messageProjection` で印付けし、`ctx.sessions.registerMessageProjection()` を介して純粋な定義を登録する。セッションはコミット前にその定義を通じて完全な決定を検証し、不変のメッセージ更新を適用し、`contentGeneration` を進める。復元や分離フォールドを含む欠落インタプリタを拒否し、使用済み定義のアンロードはキャッシュ済み読み取りをブロックする。分離リーダーは `foldSurface(events, projections)` に明示的な定義を渡し、`deriveEventMessage()` を通じて `projectedMessages` を適用する。インストール済み形式カタログはオフラインリーダーのためにファーストパーティ定義を組み立てる。[画像オフロードプラグイン](compaction.md#image-offload) は画像固有のイベントと解釈を所有する。

```ts type-equiv
/** Readonly history immediately before a message-projection event. */
interface SessionMessageProjectionContext {
  /** Current message-producing event sequences in model-visible order. */
  nodes: readonly SessionSeq[]
  /** Contiguous event window; entries at or beyond the candidate seq are not committed inputs. */
  events: readonly SessionEvent[]
  /** Absolute sequence of the window's first event. */
  baseSeq: SessionLogOffset
  /** Previously projected messages keyed by their original event sequences. */
  messages: ReadonlyMap<SessionSeq, Message>
}
```

```ts type-equiv
/** Pure interpretation of one plugin-owned event that changes existing message content. */
interface SessionMessageProjection<T extends SessionEventType = SessionEventType> {
  /** Event interpreted by this definition; declare it with `@messageProjection` in SessionEventMap. */
  type: T
  /**
   * Validate the complete durable decision before returning any updates. Preserve
   * message identities and publish immutable copies without mutating the input.
   * @param event - candidate event, not yet applied to the supplied history.
   * @param context - history preceding this decision.
   * @returns changed current messages keyed by their original sequences.
   * @throws when the durable decision cannot be applied to this history.
   */
  project(event: SessionEvent<T>, context: SessionMessageProjectionContext): ReadonlyMap<SessionSeq, Message>
}
```

### `SessionSurface` — ライブの読み取り専用サーフェスプロジェクション

`Session.surface` はセッションの安定した `SessionSurface` ビューを返す。同じ増分マネージャがコミット前に追加候補を検証し、コミット済みイベントからこのプロジェクションを進める。呼び出し元は所属と置換世代を観察できるが、検証を呼び出すことはできない。

`SurfaceManager(log, baseSeq?, projections?)` は代わりに、最初のイベントが絶対シーケンス `baseSeq` を持つ連続したロード済みウィンドウを畳み込める。すべてのイベントはその絶対シーケンス空間で連続したままであり、ウィンドウ先頭を横断する置換は宣言範囲が欠けているため失敗する。

```ts type-equiv
/** Readonly live projection of the message-producing session events. */
interface SessionSurface {
  /** Current surface event sequences in model-visible order. */
  readonly nodes: readonly SessionSeq[]
  /** Monotonic count of committed positional replacements. */
  readonly replaceGeneration: number
  /** Monotonic count of committed replacements and plugin-owned message changes. */
  readonly contentGeneration: number
}
```

### `SurfaceFoldReplacement` と `SurfaceFoldResult` — 完全なサーフェスリプレイ

`foldSurface(events, projections)` は、分離された現在のイベントシーケンスを、各宣言置換範囲によってシャドウされた実際のシーケンスとともに返す。ライブマネージャは置換履歴を保持せずに同じ遷移を使う。その `replaceGeneration` はコミット済み置換ごとに増加するため、増分コンシューマは純粋な末尾成長と書き換えを区別できる。

```ts type-equiv
/** One replacement operation observed while folding a session surface. */
interface SurfaceFoldReplacement {
  /** Seq of the event that replaced the prior surface range. */
  seq: SessionSeq
  /** Declared inclusive start seq of the replaced surface range. */
  start: SessionSeq
  /** Declared inclusive end seq of the replaced surface range. */
  end: SessionSeq
  /** Actual surface entries removed by the operation, in surface order. */
  shadowedSeqs: SessionSeq[]
}
```

```ts type-equiv
/** Complete result of replaying the surface operations in a session log. */
interface SurfaceFoldResult {
  /** Current surface event sequences in model-visible order. */
  nodes: SessionSeq[]
  /** Replacement operations in event order. */
  replacements: SurfaceFoldReplacement[]
  /** Immutable projected messages, keyed by their original event sequences. */
  projectedMessages: ReadonlyMap<SessionSeq, Message>
}
```

## `Session` 公開 API

本体を除去した宣言は、プレーンクラスの分離ファクトリ、状態アクセサ、追加メソッド、履歴プロジェクションをソースと同期させる。ストア操作は生成された [`ctx.sessions` セクション](#ctxsessions--sessionstore) に残る。

```ts public-api
/**
 * An event-sourced session: an append-only log of {@link SessionEvent}s.
 *
 * Plain class (not a Service) — create live instances via
 * `ctx.sessions.create()` and detached instances via {@link create}.
 * Seeding with an existing event log replays/forks a session.
 * @typert object
 */
declare class Session {
  /** The ordered surface over this session's event log. */
  get surface(): SessionSurface;
  /**
   * Detached, deep-frozen creation metadata (format version, cwd, lineage,
   * and whether fork history exists). Supplied by the store via `ctx.sessions.create()`. When a
   * `Session` is created without a store-owned header, a minimal header is
   * synthesized (stamped with the current {@link SESSION_FORMAT_VERSION}) so
   * `session.header` is always present. Kept out of the event log — it is a
   * storage concern, not replayable conversation state.
   */
  readonly header: SessionHeader;
  /** Number of leading events inherited from this Session's fork parent. */
  readonly inheritedEventCount: SessionLogOffset;
  /** The session identity, derived from its durable header's single copy. */
  get id(): SessionId;
  /**
   * The constructor seed length (0 without one), before any marker appended
   * during construction. Seed events never publish on `session/event`. A
   * marker appended before the store attaches occupies this seq without
   * publishing either; otherwise this seq is available for the next append.
   *
   * This in-process offset is not persisted. A fork seed can already contain
   * the child's inherited marker and synthetic closers, so its child-owned
   * history starts at {@link inheritedEventCount}, before this offset. A
   * resumed Session's seed contains its full stored log, while its inherited
   * count keeps the durable fork cut. Consumers needing complete canonical
   * history start at seq 0.
   */
  readonly firstLiveSeq: SessionLogOffset;
  /**
   * First event produced for this object lifecycle. A new fork includes its
   * child-owned seed marker and closers; a restored Session starts after its
   * complete stored prefix. This in-process capture offset is not persisted.
   */
  readonly firstLifecycleSeq: SessionLogOffset;

  /**
   * Create a detached session by validating and snapshotting borrowed seed
   * events and storage metadata.
   * @param id - session identity.
   * @param seed - optional borrowed replay or fork events.
   * @param header - optional borrowed storage metadata.
   * @param inheritedEventCount - exact fork-inherited prefix length for a seeded header.
   * @param projections - pure interpreters for plugin-owned message changes.
   * @returns a detached session.
   * @throws when a seed event requires a missing message interpreter or fails validation.
   */
  static create(
    id: SessionId,
    seed?: readonly SessionEvent[],
    header?: SessionHeader,
    inheritedEventCount?: SessionLogOffset,
    projections?: readonly SessionMessageProjection[],
    ): Session;
  /**
   * Restore a detached session by adopting an independently owned or deeply frozen seed.
   * Runtime-required event fields, event envelopes, sequence continuity, surface
   * transitions, and header fields are validated without copying or freezing events.
   * Embedded Assistant streams remain opaque until a stream consumer or storage
   * verifier reads them.
   * @param id - restored session identity.
   * @param seed - independently owned or deeply frozen events.
   * @param header - independently owned storage metadata.
   * @param inheritedEventCount - exact fork-inherited prefix length decoded from storage.
   * @param eventState - aliasing state carried from the operation that produced the seed.
   * @param projections - pure interpreters for plugin-owned message changes.
   * @returns a restored detached session.
   * @throws when a seed event requires a missing message interpreter or fails validation.
   */
  static fromRestore(
    id: SessionId,
    seed: readonly SessionEvent[],
    header: SessionHeader,
    inheritedEventCount: SessionLogOffset,
    eventState: SessionSeedEventState,
    projections?: readonly SessionMessageProjection[],
    ): Session;
  /**
   * Return the immutable event stored at one exact sequence number.
   * @deprecated Existing logic may remain unmigrated for now, but new calls are prohibited.
   * See the [Agent Note](../../../../.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md).
   * @param seq - event sequence number.
   * @returns the accepted event, or undefined when the log does not contain it.
   */
  eventAt(seq: SessionSeq): SessionEvent | undefined;
  /**
   * Materialize an immutable snapshot of a half-open event sequence range.
   * A full current snapshot is reused until the next append; every previously
   * returned snapshot remains stable after later appends.
   * @deprecated Existing logic may remain unmigrated for now, but new calls are prohibited.
   * See the [Agent Note](../../../../.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md).
   * @param fromSeq - non-negative inclusive sequence number; defaults to the log start.
   * @param toSeqExclusive - non-negative exclusive sequence number; defaults to the current end.
   * @returns a frozen array of the selected deeply frozen events.
   */
  snapshotEvents(
    fromSeq: SessionLogOffset = SessionLogOffset(0),
    toSeqExclusive: SessionLogOffset = this.seq,
    ): readonly SessionEvent[];
  /**
   * Return this Session's events after its fork-inherited prefix.
   * @deprecated Existing logic may remain unmigrated for now, but new calls are prohibited.
   * See the [Agent Note](../../../../.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md).
   * @returns a fresh array containing child-owned events in log order.
   */
  ownEvents(): readonly SessionEvent[];
  /**
   * Whether one existing event position is outside the fork-inherited prefix.
   * @param seq - event position in this Session.
   * @returns true when the event belongs to this Session rather than its parent.
   */
  isOwnSeq(seq: SessionSeq): boolean;
  /** The next event's sequence number — always the log length (the `seq = log.length` contiguity contract). */
  get seq(): SessionLogOffset;
  /**
   * Append one typed event to the log and synchronously notify observers via
   * the store-owned, module-private publication hooks. The hot path never blocks
   * on I/O — persistence plugins buffer asynchronously. Once the event enters
   * the log, the append is committed: observer failures are logged and
   * contained per listener, so they do not change the return value or prevent
   * later listeners from observing the same accepted event.
   *
   * @param type - The event type (key of {@link SessionEventMap}).
   * @param data - The event payload; must be JSON-serializable.
   * @param opts - Surface metadata: `surfaceOp` controls how the event enters
   *   the ordered surface; `sourceEventSeqs` lists the seq numbers of earlier
   *   events this one derives from. REQUIRED for
   *   {@link SurfaceEventType} events (every message-producing event must
   *   declare how it joins the surface, the sole source of derived model
   *   history) and
   *   rejected by the compiler for non-surface types like `turn/start` or
   *   `assistant/attempt`. Assistant messages embed their exact provider
   *   stream and cannot cite top-level source events.
   * @returns the logged event — its assigned `seq`/`time` plus the SNAPSHOT of
   *   `data` that entered the log, so reading `event.data` back sees the logged
   *   value, never the caller's still-mutable input.
   * @throws if `data` or surface metadata is not losslessly JSON-serializable
   *   (BigInt, function, symbol, undefined, negative zero, non-finite number,
   *   circular reference, sparse array, or an exotic object such as
   *   Map/Set/Date/class instance), or when the candidate violates the
   *   request-header empty-field or tool-error consistency rules, or the
   *   canonical surface contract (marker shape and eligibility, unique
   *   earlier source-event references, positional replacement validity, and complete
   *   shadowed-node coverage). One iterative pass reads, validates, and
   *   copies each nested value once, so a stateful getter cannot supply one value
   *   to validation and another to storage. The event log is the durable source
   *   of truth, so a bad event fails at the append site rather than later during
   *   a backend flush. A synchronous internal dispatch validation failure or an
   *   append reentered while this acceptance/publication boundary is open also
   *   rejects before the log changes.
   */
  append<T extends SessionEventType>(
    type: T,
    data: SessionEventMap[T],
    ...opts: T extends SurfaceEventType ? [opts: SurfaceIntent<T>] : []
    ): SessionEvent<T>;
  /**
   * The {@link EpochHeader} in force after the log's last header event — the
   * header the NEXT request will be compared against — or undefined before
   * the first `request/header` snapshot. The live, incrementally-maintained
   * form of `foldRequestHeader(session.snapshotEvents())`: each header event is folded
   * once, when first seen, so a per-step read costs O(new events).
   * @returns the folded header, or undefined when no header event exists yet.
   */
  requestHeader(): EpochHeader | undefined;
  /**
   * Return the latest resolved route metadata, or `undefined` before the first
   * `request/context` event. Each event is folded once.
   * @returns the latest immutable route metadata.
   */
  requestContext(): RequestContext | undefined;
  /**
   * Fold unseen committed events into capability-independent tool history.
   * Initial access reconstructs inherited history; later reads consume only new events.
   * @returns an immutable snapshot for LLM request projection, including historical addition definitions.
   */
  toolHistory(): ToolHistory;
  /**
   * Derive the LLM message history by walking the ordered sequences of
   * message-producing events maintained by `surfaceOp` markers. The
   * surface is the single source of derived history: every message-producing
   * append records its `surfaceOp`, so a raw event with no marker (a chunk, a
   * turn boundary) is correctly absent, and a compaction `replace` deletes the
   * shadowed nodes from the derivation. The projection rules are
   * {@link deriveEventMessage}, with logged message projections applied
   * without changing node membership or message identity.
   *
   * CACHED: pure tail growth costs O(new nodes); a replacement or message projection
   * ({@link SessionSurface.contentGeneration}) rebuilds. The returned array is
   * a fresh snapshot per call (later appends never grow an array a caller
   * already holds); the `Message` objects in it are SHARED and **deep-frozen**.
   * Unchanged content reuses frozen event data; projected blocks are frozen
   * derived copies. Consumers cannot mutate the log through either form.
   * @returns a fresh array of the shared, frozen derived history.
   */
  deriveMessages(): Message[];
  /**
   * Project one event with all committed message projections applied.
   * The original durable event remains unchanged.
   * @param event - the event to project.
   * @returns the derived message, or null when the event produces none.
   */
  deriveEventMessage(event: SessionEvent): Message | null;
}
```

## 導出履歴: `deriveMessages()` と `deriveEventMessage()`

`Session.deriveMessages()` はイベントログをモデルが見る `Message[]` に投影する。キャッシュされ（各サーフェスノードは初見時に1度だけ投影され、サーフェス書き換えで再構築される）、凍結される（共有された深く凍結されたメッセージ上の呼び出しごとの新しい配列であり、プロジェクションを通じたログ履歴の変更は表現できない）。`deriveEventMessage(event)` はフォールドが適用するノードごとの純粋関数であり、外部再構築器がログ接頭辞をまったく同じルールで投影し、キャッシュと矛盾できないよう公開されている。投影ルールは次のとおり。

- `user/message` → 正確な `content` を運ぶユーザーメッセージ。任意のエンベロープはログ専用の表示メタデータのままである。
- `assistant/message` → 生成したプロバイダーとモデルに任意のアダプタープライベートなリプレイ状態を加えたアシスタントメッセージ。埋め込まれたコンパクトストリームは2番目のメッセージではなく、リプレイ、使用量、UI 証拠である。**内容が空の** `assistant/message` もスキップされる。内容なしで打ち切られた max-tokens ステップもストリーム、使用量、プロバイダー、モデルを保持するために `assistant/message` を記録するが、内容のないアシスタントターンはプロバイダートランスクリプトに入ってはならない。
- `tool/result` → 結果内容とツール呼び出し ID を運ぶ一級のツールロールメッセージ。
- `user/message`（注入コンテキスト、すなわち非 `user` ソース）→ `content` を時系列位置に逐語的に運ぶ user ロールメッセージ。その型付きソースは生成者を名指しし、生成者固有のデータを運ぶ。

その他すべて（`turn/*`、`step/*`、`assistant/attempt`、プラグイン所有の `llm/retry`）は構造的なものであり、メッセージに投影されない。トークン会計は各 `assistant/message` や `assistant/attempt` 上の埋め込みストリームを展開する一方、メッセージのトップレベル `usage` は存在する場合にコミット済みメッセージの権威のままである。失敗したモデルリクエスト試行はそのため、アシスタントメッセージを捏造せずにプロバイダー使用量を保持する。現在の論理検証は、ルートを推測せず、プロバイダー/モデルを省略したリクエストヘッダーやアシスタントメッセージを拒否する。サポートされる歴史的表現は、現在のセッションが存在する前に隣接する形式エッジによって正規化・検証される。

## ライブセッションフォーク API

`ctx.sessions.create(id, { seed, meta })` は低レベルのリプレイ/フォークプリミティブである。通常のライブセッションフォークのために、`SessionStore` は1つのポリシー API を公開する。

- `fork(source, boundary?, childSessionId?)` はライブの `Session` オブジェクトまたはライブの `SessionId` を受け入れ、包括的な `SessionSeq` 境界までのソースイベントを選択し（デフォルトは現在の最終イベント）、選択された接頭辞が開いたターンの外側で終わることを要求し、深く複製されたシードイベント、`parentSession`、`isSeeded: true`、正確な `inheritedEventCount`、継承された `cwd` を持つライブ子セッションを作成する。

明示的な `boundary` により、呼び出し元は、ソースが新しいイベントや開いた現在のターンを持っていても、以前の `turn/end` やそれ以降の独立したログ専用イベントを含む、任意の安定したターン間位置からフォークできる。この API は開いたターン内部で終わる接頭辞を暗黙に切り詰めず拒否する。`dsh-subagent-fork-in-process` は完了接頭辞の切り詰めを維持する。ツール時委譲は通常親ターンが開いている間に開始されるためである。通常のセッションブランチでは要求境界を明示すべきである。

## ターンが終了した理由: `TurnEndReasonMap`

`turn/start` はトリガーフィールドを持たない。入力された `user/message` バッチは各ステップに入ったものを記録し、`llm/retry` はリクエスト回復を記録し、アイドル注入はウェイクアップ配送が後のプリステップに到達するまで保留のままである。ライブターンはドライバーを停止させた型付き [`AgentCancelCause`](core.md#the-agent-handle) を保持する。永続化は、呼び出し元を保存しなかったサポート対象の粗いキャンセル記録を取り込む場合にのみ、追加の `{ kind: 'legacy' }` 原因を使う。

```ts type-equiv
/** Durable cancellation cause, including imports whose original coarse record carried no cause. */
type TurnEndCancelCause = AgentCancelCause | { readonly kind: 'legacy' }
```

```ts type-equiv
/**
 * Why a turn ended. Merge-extensible sum type.
 */
interface TurnEndReasonMap {
  completed: { kind: 'completed' }
  /** A cancellation request interrupted the live turn. */
  aborted: { kind: 'aborted'; reason: TurnEndCancelCause }

  blocked: { kind: 'blocked' }
  /**
   * The turn failed. `error` is always a structured failure: the `LlmError`
   * facts verbatim, or `{ message: errorChain(error), code: 'UNKNOWN' }`
   * flattened from any other error.
   */
  error: { kind: 'error'; error: LlmFailure }
  /** At least one step reached its output-token ceiling, even if a plugin continued the turn. */
  'max-tokens': { kind: 'max-tokens' }
  /**
   * A crash-orphaned turn was closed after the fact: agent-loop resume appends
   * this closer for a stored log whose last turn never ended, and session-query
   * synthesizes it on cold reads. The loop never emits this marker live, and
   * the events recorded before the crash remain intact.
   */
  interrupted: { kind: 'interrupted' }
  /**
   * Fork-seed construction closed a turn that was still open at the fork
   * boundary in the source session. Only fork seeds carry this marker — the
   * loop never emits it — and the source events before the boundary remain
   * intact in the child.
   */
  forked: { kind: 'forked' }
}
```

`max-tokens` は同名のモデル呼び出し `FinishReason` を反映する。ターン内の任意の `max-tokens` ステップはターン全体を `completed` ではなく `max-tokens` で終了させる（短縮された事実が後の継続に勝つ）。そのためコンシューマは正常停止と打ち切りを区別できる。キャンセルとエラーは異なる結果のままである。ループは `interrupted` も `forked` もライブでは発行しない。クラッシュリカバリが `interrupted` を合成し（[persistence.md](persistence.md) を参照）、フォークシード構築が `forked` を合成する。このマップはマージ拡張可能である。

## 実行囲いと独立イベント

ターンはセッションログ全体ではなく、1回のモデルループ実行を囲う。AgentLoop はターン内部の entering プリステップバッチからの注入 `user/message` イベントのみを記録する。プラグイン所有のログ専用イベントは `turn/end` と次の `turn/start` の間に現れることがあり、ターン番号を増やさずにイベント seq を消費する。永続化は連続した受け入れ済みイベントをすべて境界付き永続バッチに受け入れる一方、クラッシュ修復は真に開いた末尾ターンのみを閉じる。即時の永続化バリアを必要とする生成者は明示的に `ctx.sessions.flush(session)` を待つ。

マージ拡張可能なイベント関係は宣言したプラグインに属するため、コアはターンが開いていないという理由だけで未知のイベントを拒否しない。[独立イベントの決定](../../.agents/notes/implemented/simplification/2026-07-28-remove-synthetic-log-only-turns.md) を参照。

## 終端シード境界: `session/end-seed`

`buildForkSeed` は合成フォーククローザを追加する前に、正確な継承接頭辞カット位置に `session/end-seed { inherited: true }` を追加する。`Session` コンストラクタは準備済みマーカーを保持し、継承接頭辞のみが与えられた場合に1つ追加する。復元はタグ付きマーカーを保持し、完全な保存済みシードがマーカーで終わっていない場合にのみ通常の `session/end-seed {}` を追加する。両形式ともログ専用でメッセージを生成しない。コンストラクタと `buildForkSeed` のみがこれらを作成できる。

フォーク系統については、ペイロードが `inherited: true` を運ぶ最後のマーカーを探す。現行形式のデコードは `SessionHeader.isSeeded` が true の場合にまさにそれを要求し、その seq から `inheritedEventCount` を導出する。ライフサイクル所有については、いずれかの形式の最後の `session/end-seed` を探す。すでにいずれかのマーカーで終わっているシードを開き直しても、通常マーカーは追加されない。

これが存在するのは、シード履歴とライブ作業がそれ以外ではバイト同一であり、独立した開閉ブラケットを所有するプラグインを無力化するためである。不対の `compaction/start` は、書き手がコンパクション途中でクラッシュしたのか、まさにコンパクション中なのか区別なく同じに見える。`session/end-seed` より前の開始マーカーはコンストラクタシード由来であり、終了したライフサイクルに属する。それを終了させたもの（クラッシュ、後継プロセス、実行中の親からのフォーク）にかかわらず、所有者はそれを死んだものとして扱える。これは *この* セッションが継承したブラケットのみを対象とする。同じ履歴上に開いたブラケットを保持する同時ライブセッションは他の場所に独自の境界を持つため、同時書き手を許容するにはログを越えた生存信号が必要である。コアは境界を書き込み、そこからは何も読まない。ブラケットの語彙は所有プラグインに留まる。そのためクラッシュ修復は turn/step/tool 境界を閉じ、`compaction/*` を閉じることはない。

人間の活動でセッションを順序付けるコンシューマはこの境界を除外する。セッションを手に取ることは作業ではないため、ログ末尾で順序付けると開いたすべてのセッションが先頭に浮上してしまう。

## プラグイン提供のログ専用イベント

プラグインは追加の `SessionEventMap` 型を宣言マージできる。これらは **ログ専用** である。`SurfaceEventType` ではなく（`surfaceOp` を持たず、導出履歴に何も寄与しない）。開いた実行ターンに属するか、ターン間に立てられるかは所有者が決定する。生成された [永続化ログイベントカタログ](../persistence-catalog.md) はコアとプラグイン提供のすべてのイベントを列挙する。コンパクションシームの `compaction/*` セマンティクスは [compaction.md](compaction.md) で議論する。

プラグイン所有の1ファミリ内の複数イベントが1つの Web クライアント会話ノードに組み立てられる場合、そのファミリ内のすべての開始、更新、結果、リソース、中断イベントは同じ安定した業務 ID を運ぶか、独立に導出する。この要件は相関ノードファミリに適用され、すべてのセッションイベントに適用されるわけではない。これによりクライアントは隣接からの推測や履歴走査なしに各イベントをグループ化できる。[会話サブシステム](conversation.md) を参照。

フックブリッジの `hook/invoked` / `hook/result` ペア（`@deepseek-ai/dsh-hook-protocol` 由来）は `handlerId` で相関する。`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`Stop` はループの開いたターン内部で発火するため、その `hook/*` 記録は構造上ターンに囲われる。`SessionStart` はターン 1 より前に実行されるため `hook/*` 記録を得ない。そのコンテキストはウェイクアップ配送がターンを開くまで受信箱で保留のままである。

### プラグインレコード

実験的パッケージは `PluginRecordMap` にプラグイン所有の状態を宣言する。`appendPluginRecord()` は各宣言を使って名前とペイロードに型付けし、`plugin:` 名前空間で `ignorable: true` と印付けされたイベントを追加する。`pluginRecordOf()` は現在の宣言にかかわらず未知ペイロードの保存済み記録を読む。[実験的永続化カタログ](../experimental-persistence-catalog.md) は現在の宣言を一覧する。[パッケージ README](../../packages/core/session/README.md#write-experimental-plugin-records) は呼び出し元制限、保持、読み取りパスを所有する。

```ts type-equiv
/**
 * Event type of an experimental plugin record: `plugin:` followed by
 * slash-separated segments of lowercase letters, digits, `.`, `_`, and `-`,
 * each starting with a letter or digit. A record type is never a
 * {@link SessionEventMap} member.
 */
type PluginRecordType = `plugin:${string}`
```

```ts type-equiv
/**
 * Payloads written by experimental packages, keyed by their `plugin:` record
 * names. Packages augment this map to type writes and enter the current plugin
 * record catalog; these declarations do not enter {@link SessionEventMap} or
 * released persistence schemas. Stored records still require owner validation.
 */
interface PluginRecordMap {}
```

```ts type-equiv
/**
 * One committed experimental plugin record, read from the log by
 * `pluginRecordOf`. The record's owner validates `data` before use, because a
 * restored record carries whatever JSON an earlier build of its owner wrote,
 * or a V3 event that a format migration renamed into the `plugin:` namespace held.
 */
interface PluginRecord {
  /** The record type, chosen by the owning plugin. */
  readonly type: PluginRecordType
  /** The record's position in the Session log. */
  readonly seq: SessionSeq
  /** Unix epoch milliseconds at append. */
  readonly time: number
  /** The JSON payload as committed. */
  readonly data: unknown
}
```

## 永続化契約

永続化バックエンドが依存する内容は次のとおり。永続ログはすべてのイベントをロスレスに保持し、すべてのアシスタント試行は埋め込みコンパクトストリームが元の時刻付きチャンクを保持する1件の `assistant/message` または `assistant/attempt` である。`seq` はこれらの確定とすべてのインターリーブされたイベントにわたり連続する。バックエンドは、ハンドルの `read()` が正確に追加済みイベントを返す限り、イベントバッチの保存フレーミングを独自に選択できる。現在の JSONL はイベントごとに1行を書く（[persistence.md](persistence.md) を参照）。すべての `event.data` は JSON シリアライズ可能でなければならない。`Session.append` はソースでこれを強制し（非シリアライズ可能データで例外を投げる）、そのため不正イベントはログに入らず、`session.snapshotEvents()` はバックエンドが永続化できるものと常に等しい。非シリアライズ可能データを運ぶイベント型の追加、コア実行ネストを壊すこと、所有者の宣言関係に違反することは、オンディスク形式の破壊的変更である。

この契約を消費するバックエンドは [persistence.md](persistence.md) にある。

## リモートカタログとワークスペースを開く操作

`ModelCatalog` は `session/modelCatalog` が返すホスト生成モデルディレクトリである。デプロイのデフォルト、ルーティング可能なプロバイダー ID、成功したプロバイダーグループ、分離されたプロバイダー失敗を運ぶ。1つのセッションから導出されるものではなく、セッションプロジェクションとは分離されたままである。

`SessionOpenWorkspacePathRequest` は絶対またはワークスペース解決済みの `path` を運ぶ。任意の `action: "reveal"` はデフォルトアプリケーションで開く代わりにファイルマネージャでの案内を選択する。`SessionOpenWorkspacePathValue` はホストがネイティブ受け渡しを受け入れたことを確認する。セッション対応クライアントは、既知の場合に現在のセッション cwd に対して相対パスを解決する。コントローラはパスを変更せずオープナに渡し、無効なリクエスト、キャンセル、オープナ失敗をセッションリモートエラー語彙を通じて報告する。

任意の `application` はシステムのデフォルトを変更せずに登録済みファイルハンドラを選択する。`workspacePathApplications({ path })` はホストパス検証後の現在のハンドラ、名前、アイコン、デフォルト選択を返す。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成される（doc-sync 内の `pnpm run verify-cordis-catalog` で鮮度を検証し、`pnpm run gen-cordis-catalog` で再生成する）。言語面はロケール固有のペア文書パスのみが異なる。シグネチャブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは [入門](../cordis-primer.md#dispatch-modes) で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxsessioncontroller--sessioncontroller"></a>

### `ctx.sessionController` — `SessionController`

生成された `ctx.remote.session` 名前空間を支えるホストサービス。

```ts cordis-catalog
/**
 * Resolve or resume one ordinary Session for another Host API domain.
 * @param sessionId - Session identity whose Agent owns the operation.
 * @returns the live Agent or the stable Session-domain failure.
 */
resolveAgent(sessionId: SessionId): Promise<ApiSessionAgentResult>

/**
 * Inspect one attached or persisted Session without activating its Agent.
 * @param sessionId - durable Session identity.
 * @param signal - optional caller cancellation for persistence reads.
 * @returns the current attached state or persisted header and event prefix.
 */
inspect( sessionId: SessionId, signal?: AbortSignal, ): Promise<SessionInspection>

/**
 * Read all visible Session rows without resuming an Agent.
 * @param _request - reserved empty list request.
 * @param signal - cancellation for persistence reads and summary generation.
 * @returns visible Session summaries ordered by activity.
 */
@Remote('list') async list(_request: SessionListRequest, signal: AbortSignal): Promise<SessionListValue>

/**
 * Search visible Session content without resuming an Agent. A non-owner
 * receives only the hits whose Session `allows()` admits; `hasMore`
 * describes the bounded result before that filtering.
 * @param request - literal message-content query.
 * @param signal - cancellation for list and search reads.
 * @returns authorized bounded Session search results.
 */
@Remote('search') async search(request: SessionSearchRequest, signal: AbortSignal): Promise<SessionSearchValue>

/**
 * Create one ordinary Session for a new conversation, reusing the named blank Session while it is reusable.
 * @param request - optional blank Session to reuse, location, and Agent preset.
 * @returns the created or reused Session identity and its preset when configured.
 */
@Remote('create') create(request: SessionCreateRequest): Promise<SessionCreateValue>

/**
 * Select one Session-local model after explicitly resuming the Session; save the default in the background.
 * @param request - Session identity and requested model selection.
 * @returns the normalized selection installed for the Session, without waiting for default persistence.
 */
@Remote('selectModel') selectModel(request: SessionSelectModelRequest): Promise<SessionSelectModelValue>

/**
 * Select the first available account model after login when no provider API key is configured.
 * @returns after saving the first available model or retaining the existing default.
 */
@Remote async initializeDefaultModel(): Promise<void>

/**
 * Describe every currently routable model for Host-generation selectors.
 * @returns provider-grouped models, the deployment default, and isolated provider failures.
 */
@Remote('modelCatalog') modelCatalog(): Promise<ModelCatalog>

/**
 * Report whether this deployment can hand a Session workspace path to a native desktop.
 * @returns true when the matching open operation is available.
 */
@Remote canOpenWorkspacePath(): boolean

/**
 * Describe the serving desktop for authenticated file-action routes.
 * @returns Host name, configured availability, and platform-specific file-manager behavior.
 */
workspaceDesktop(): { name: string; available: boolean; fileManager: 'finder' | 'explorer' | 'directory' | null }

/**
 * Verify one path through the composed filesystem and open it on the Host desktop.
 * @param request - path after best-effort Session workspace resolution.
 * @param signal - caller lifetime; abort terminates the native command.
 * @returns confirmation after the native opener accepts the path.
 * @throws RemoteError when the request is invalid, has no verified Host mapping, is cancelled, or the opener fails.
 */
@Remote('openWorkspacePath') async openWorkspacePath( request: SessionOpenWorkspacePathRequest, signal: AbortSignal, ): Promise<SessionOpenWorkspacePathValue>

/**
 * Query current file handlers on the serving desktop without activating an Agent.
 * @param request - file path in Host filesystem syntax.
 * @param signal - caller lifetime, propagated to filesystem and desktop queries.
 * @returns OS application names, icons, and default selection; empty when desktop opening is unavailable.
 * @throws RemoteError when the path is invalid, the query is cancelled, or native discovery fails.
 */
@Remote('workspacePathApplications') async workspacePathApplications( request: { readonly path: string }, signal: AbortSignal, ): Promise<readonly SessionWorkspacePathApplication[]>

/**
 * Rename one Session after explicitly resuming it.
 * @param request - Session identity and proposed title.
 * @returns the accepted title and durable event sequence.
 */
@Remote('rename') rename(request: SessionRenameRequest): Promise<SessionRenameValue>

/**
 * Fork one cold-readable exact event prefix into a new Session. An omitted
 * boundary selects the latest completed-turn prefix; an open cut receives
 * synthetic fork closers.
 * @param request - source Session, optional exact inclusive event boundary, and migration preflight choice.
 * @returns the new Session identity.
 */
@Remote('fork') async fork(request: SessionForkRequest): Promise<SessionForkValue>

/**
 * Admit one prompt after explicitly resuming its Session.
 * @param request - Session identity, prompt content, source metadata, and delivery mode.
 * @param signal - caller cancellation before prompt admission begins.
 * @returns acknowledgement that the Agent accepted the prompt.
 */
@Remote('prompt') async prompt(request: SessionPromptRequest, signal: AbortSignal): Promise<SessionPromptValue>

/**
 * Read one image proven reachable from the addressed Session log.
 * @param request - Session and attachment identities used for authorization.
 * @returns the durable attachment reference and base64-encoded bytes.
 */
@Remote('attachment') attachment(request: SessionAttachmentRequest): Promise<SessionAttachmentValue>

/**
 * Mutate one still-pending queue occurrence, resuming a cold Agent first.
 * @param request - Session, queue item, and requested mutation.
 * @returns acknowledgement that the queue mutation was applied.
 */
@Remote('updateQueue') updateQueue(request: SessionUpdateQueueRequest): Promise<SessionUpdateQueueValue>

/**
 * Cancel one active Agent turn without dropping its pending inbox.
 * @param request - Session whose active Agent turn is cancelled.
 * @returns acknowledgement that cancellation was requested.
 */
@Remote('cancel') cancel(request: SessionCancelRequest): SessionCancelValue

/**
 * Read one cold-safe, message-aligned Session history page.
 * @param request - durable address, backward cursor, and page budget.
 * @param signal - cancellation for persistence reads.
 * @returns one chronological page.
 */
@Remote({ name: 'page', resources: { session: addressedSession } }) page(request: SessionPageRequest, signal: AbortSignal): Promise<SessionPage>

/**
 * Follow one Session log from its opening or resume cursor.
 * @param request - durable address and last committed sequence already held by the caller.
 * @param signal - cancellation owned by the Remote stream carrier.
 * @returns a complete opening snapshot followed by gap-free durable event
 *   frames and optional cursorless assistant-stream frames.
 */
@Remote({ mode: 'stream', resources: { session: addressedSession } }) follow(request: SessionFollowRequest, signal: AbortSignal): AsyncIterable<SessionFollowFrame>

/**
 * Read exact projections, returning cached hints only when migration is required.
 * @param request - Session whose current values are required.
 * @param signal - cancellation for the Session read.
 * @returns a sequenced baseline, cached hints when migration is deferred, or null when absent.
 */
@Remote('projections') async projections(request: SessionProjectionsRequest, signal: AbortSignal): Promise<SessionProjectionsValue>

/**
 * Stream a complete live-control baseline followed by replacement frames.
 * @param signal - cancellation owned by the Remote stream carrier.
 * @returns one complete baseline followed by live replacement frames.
 */
@Remote({ mode: 'stream' }) async *control(signal: AbortSignal): AsyncIterable<SessionControlFrame>
```

型: [SessionId](core.md) · [SessionInspection](persistence.md) · [SessionSearchRequest](session-query.md)

ソース: [`packages/api/session-controller/src/index.ts`](../../packages/api/session-controller/src/index.ts)

<a id="ctxsessions--sessionstore"></a>

### `ctx.sessions` — `SessionStore`

インメモリセッションストア（`ctx.sessions`）。

永続化は意図的にここでは実装されない。エージェントライフサイクルは公開された各セッションの書き込みハンドルにセッションログ書き込み器を接続する。そのライフサイクルの外側で公開されたセッションは何も永続化しない。

```ts cordis-catalog
/**
 * Register one event interpreter for live creation, restore, and fork.
 * Disposing the contribution makes sessions that used it refuse further derivation.
 * @param projection - pure definition owned by the event's plugin.
 * @returns the fiber-owned disposer.
 * @throws when another definition already owns this event type.
 */
registerMessageProjection(projection: SessionMessageProjection): () => Promise<void>

/**
 * Create a session owned by the calling fiber: disposing that fiber stops
 * event notification and removes the session from the store. `options.seed`
 * populates the session with a copy of those events (replay/fork);
 * `options.meta` attaches creation metadata (validated absolute `cwd`, seed
 * and parent lineage, and delegation depth) as the immutable
 * {@link SessionHeader} (the store fills `version`/`id`/`createdAt`).
 *
 * For an agent whose session must be torn down IN ORDER with its loop (so the
 * loop's final events are published before the store attachment ends), do NOT use this
 * — fold the session lifecycle into the agent's own effect via
 * {@link prepare} + {@link enter} + {@link announce} (see
 * `dsh-agent-loop`'s creation transaction).
 *
 * @param id - the session id; omitted, the store mints `session-<n>`.
 * @param options - seed events and/or creation metadata for the header.
 * @returns the live session, already entered and announced.
 * @throws if a session with `id` already exists, metadata is not a plain
 *   lossless-JSON record with valid scalar fields, or `meta.cwd` is a
 *   non-absolute path (storage backends key directories off it).
 */
create(id?: SessionId, options?: CreateSessionOptions): Session

/**
 * Build a session WITHOUT entering it into the store — validate the id/cwd and
 * construct the {@link Session} (with its immutable {@link SessionHeader}).
 * Pairs with {@link enter} + {@link announce}: a caller that owns a composite
 * `ctx.effect` (the agent factory) folds the session lifecycle into that ONE
 * effect so a fiber unload tears the session + agent down as a single ORDERED
 * chain rather than as racing sibling effects — which would remove the publication hooks
 * before the driver's closing events commit, dropping them.
 *
 * @param id - the session id; omitted, the store mints `session-<n>`.
 * @param options - seed events and/or creation metadata for the header. With
 *   `eventState`, every seed event is either independently owned or any
 *   shared value is deeply frozen; {@link Session.fromRestore} validates and
 *   adopts those values without copying or freezing them.
 * @returns the constructed session, NOT yet in the store.
 * @throws if a session with `id` already exists, metadata is not a plain
 *   lossless-JSON record with valid scalar fields, or `meta.cwd` is a
 *   non-absolute path.
 */
prepare(id?: SessionId, options?: PrepareSessionOptions): Session

/**
 * Enter a {@link prepare}d session into the store: install the module-private
 * append publication hooks and add it to the store. Returns the DETACH
 * disposer (hooks + store removal). Does NOT emit `session/created` —
 * the caller yields this disposer inside its effect and THEN calls
 * {@link announce}, so a throwing `session/created` listener rolls the attach
 * back instead of leaking it.
 *
 * Re-checks the id for a duplicate: `prepare` and `enter` are public
 * cross-package primitives and a caller may interleave arbitrary work (or
 * another create) between them, so a stale prepared session must NOT overwrite
 * a live store entry of the same id — its detach disposer would later delete
 * the REAL session. The {@link create} convenience and the agent factory call
 * the two back-to-back so they never trip this, but the public API cannot
 * assume that.
 *
 * @param session - a {@link prepare}d session not yet in the store.
 * @returns the detach disposer (publication hooks + store removal). When called from
 *   a synchronous `session/created` listener, removal and disposal wait until
 *   that creation dispatch unwinds.
 * @throws if a session with this id is already in the store.
 */
enter(session: Session): () => void

/** Emit `session/created` exactly once for an {@link enter}ed session (with
 * the carrier {@link enter} captured). Separate from {@link enter} so the
 * caller can yield the detach disposer first (rollback safety — see
 * {@link enter}).
 * @param session - the entered session to announce to listeners.
 * @throws if the session is not live or its announcement already began,
 *   including a reentrant call from a creation listener. */
announce(session: Session): void

/**
 * Dispatch the awaited `session/flush` durability checkpoint for `session`,
 * with the carrier captured at {@link enter}. THE flush entry point: the
 * store owns the carrier, so callers (the checkpoint policy's per-request
 * barrier, goal-round-driver's idle checkpoint, teardown drains, and consumers
 * that flush themselves before reading storage) must come through here
 * rather than dispatch a raw `ctx.parallel('session/flush', …)` — one owner
 * and one spelling.
 * @param session - the session whose buffered events must reach durable storage.
 * @returns whether at least one durability listener participated, after every
 *   listener has settled successfully.
 * @throws the first registered listener failure after every listener settles.
 */
async flush(session: Session): Promise<boolean>

/**
 * Look up a live session.
 * @param id - the session id to look up.
 * @returns the session, or undefined when no live session has that id.
 */
get(id: SessionId): Session | undefined

/**
 * All live sessions, in creation order.
 * @returns a fresh array; mutating it does not affect the store.
 */
list(): Session[]

/**
 * Create a live child session from an exact prefix of a live source.
 * `boundary` is an inclusive source event seq; omitted means the source's
 * current last event. An open tail receives synthetic tool results and
 * step/turn closers with the forked cause. Closed steps and turns remain
 * unchanged, including any failed tool calls already missing results.
 * `inheritedEventCount` counts only copied source events, excluding these closers.
 *
 * @param source - Live source session object or id.
 * @param boundary - Inclusive source event seq to fork through; omitted means
 *   the source's current last event, and omitted on an empty source forks an
 *   empty child.
 * @param childSessionId - Optional child session id; omitted delegates to
 *   `SessionStore`'s id policy.
 * @returns The created live child session.
 */
fork(source: SessionForkSource, boundary?: SessionSeq, childSessionId?: SessionId): Session
```

型: [CreateSessionOptions](persistence.md) · [PrepareSessionOptions](persistence.md) · [SessionId](core.md)

ソース: [`packages/core/session/src/index.ts`](../../packages/core/session/src/index.ts)

<a id="api-session-events"></a>

### `api-session/*` イベント

<a id="api-sessionactivity--emit"></a>

#### `api-session/activity` — emit

1件のユーザー作成永続メッセージがセッション一覧の活動を進めた。

```ts cordis-catalog
/**
 * One user-authored durable message advanced Session list activity.
 * @mode emit
 * @param sessionId - addressed Session identity.
 * @param updatedAt - durable message time used for list ordering.
 */
'api-session/activity'(sessionId: SessionId, updatedAt: number): void
```

型: [SessionId](core.md)

ソース: [`packages/api/session-controller/src/types.ts`](../../packages/api/session-controller/src/types.ts)

<a id="api-sessionadded--emit"></a>

#### `api-session/added` — emit

セッションが可視になったか、そのエージェントが作成または破棄された。コンシューマはサマリをアップサートし、現在の実行状態と利用可能状態を置換する。

```ts cordis-catalog
/**
 * A Session became visible or its Agent was created or disposed.
 * Consumers upsert the summary and replace its current running and availability state.
 * @mode emit
 * @param summary - current list row for the Session.
 */
'api-session/added'(summary: SessionSummary): void
```

ソース: [`packages/api/session-controller/src/types.ts`](../../packages/api/session-controller/src/types.ts)

<a id="api-sessionerror--emit"></a>

#### `api-session/error` — emit

1つのエージェントが永続ターン位置の外側で失敗した。

```ts cordis-catalog
/**
 * One Agent failed outside a durable turn position.
 * @mode emit
 * @param sessionId - Agent and Session identity.
 * @param message - user-safe failure chain.
 */
'api-session/error'(sessionId: SessionId, message: string): void
```

型: [SessionId](core.md)

ソース: [`packages/api/session-controller/src/types.ts`](../../packages/api/session-controller/src/types.ts)

<a id="api-sessionremoved--emit"></a>

#### `api-session/removed` — emit

セッションがライブホストレジストリを離れた。

```ts cordis-catalog
/**
 * A Session left the live Host registry.
 * @mode emit
 * @param sessionId - removed Session identity.
 */
'api-session/removed'(sessionId: SessionId): void
```

型: [SessionId](core.md)

ソース: [`packages/api/session-controller/src/types.ts`](../../packages/api/session-controller/src/types.ts)

<a id="api-sessionstatus--emit"></a>

#### `api-session/status` — emit

1つのエージェントが実行状態を変更した。

```ts cordis-catalog
/**
 * One Agent changed running state.
 * @mode emit
 * @param sessionId - Agent and Session identity.
 * @param running - whether the Agent is running.
 */
'api-session/status'(sessionId: SessionId, running: boolean): void
```

型: [SessionId](core.md)

ソース: [`packages/api/session-controller/src/types.ts`](../../packages/api/session-controller/src/types.ts)

<a id="session-events"></a>

### `session/*` イベント

<a id="sessioncreated--emit"></a>

#### `session/created` — emit

セッション公開中の作成通知。同期スローは拒否してペア破棄でロールバックする。ディスパッチ中に要求されたデタッチは延期される。返されたプロミスの拒否はログに記録されるが、この同期境界を遡及的に拒否できない。スコープフィルタ済みディスパッチ（`@deepseek-ai/dsh-scope`）: エージェントスコープのリスナーはそのエージェントのコンテキストを通じて入ったセッションのみを受け取る。

```ts cordis-catalog
/**
 * Creation announcement during session publication. A synchronous throw vetoes and rolls
 * back with a paired disposal; detach requested during dispatch is deferred.
 * A returned-promise rejection is logged but cannot retroactively veto this
 * synchronous boundary.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners
 * receive only sessions entered through that agent's context.
 * @param session - the session just entered and announced.
 * @mode emit
 */
'session/created'(this: Scoped<Session>, session: Session): void
```

型: [Scoped](scope.md)

ソース: [`packages/core/session/src/index.ts`](../../packages/core/session/src/index.ts)

<a id="sessiondisposed--emit"></a>

#### `session/disposed` — emit

通知済みセッションがストアを離れるときに1度発行される。公開ロールバックを含むが、作成通知が開始されなかったエントリに対しては発行されない。リスナー失敗はログに記録され封じ込められる。スコープフィルタ済みディスパッチ（`@deepseek-ai/dsh-scope`）は所有者スコープを再利用する。

```ts cordis-catalog
/**
 * Emitted once when an announced session leaves the store, including
 * publication rollback, but never for an entry whose creation announcement
 * did not begin. Listener failures are logged and contained.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`) reuses the owner scope.
 * @param session - the session that is no longer live in the store.
 * @mode emit
 */
'session/disposed'(this: Scoped<Session>, session: Session): void
```

型: [Scoped](scope.md)

ソース: [`packages/core/session/src/index.ts`](../../packages/core/session/src/index.ts)

<a id="sessionevent--emit"></a>

#### `session/event` — emit

コミット後のファイアアンドフォーゲット追加フィード。リスナースナップショットはログプッシュの前に解決されるが、コールバックはその後に実行される。オブザーバ失敗はログに記録され封じ込められ、コミット済み追加を失敗させない。スコープフィルタ済みディスパッチ（`@deepseek-ai/dsh-scope`）: エージェントスコープのリスナーはそのエージェントのコンテキストを通じて入ったセッション由来のイベントのみを受け取る。

```ts cordis-catalog
/**
 * Post-commit, fire-and-forget append feed. The listener snapshot resolves
 * before the log push, but callbacks run after it; observer failures are
 * logged and contained without making the committed append fail.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners
 * receive only events from sessions entered through that agent's context.
 * @param session - the session whose log grew.
 * @param event - the appended event, exactly as recorded.
 * @mode emit
 */
'session/event'(this: Scoped<Session>, session: Session, event: SessionEvent): void
```

型: [Scoped](scope.md)

ソース: [`packages/core/session/src/index.ts`](../../packages/core/session/src/index.ts)

<a id="sessionflush--parallel"></a>

#### `session/flush` — parallel

待機される並列永続化チェックポイント。すべてのリスナーが実行され、呼び出し元はそれらすべてを待つ。ウォーターフォール拒否はない。スコープフィルタ済みディスパッチ（`@deepseek-ai/dsh-scope`）はセッションの所有者スコープを再利用する。

```ts cordis-catalog
/**
 * Awaited parallel durability checkpoint: every listener runs and the
 * caller awaits all of them, with no waterfall veto. Scope-filtered dispatch
 * (`@deepseek-ai/dsh-scope`) reuses the session's owner scope.
 * @param session - the session whose buffered events must reach durable storage.
 * @mode parallel
 */
'session/flush'(this: Scoped<Session>, session: Session): Promise<void> | void
```

型: [Scoped](scope.md)

ソース: [`packages/core/session/src/index.ts`](../../packages/core/session/src/index.ts)
<!-- END GENERATED cordis-surface -->
