# コア

日本語 | [English](core.en.md) | [中文](core.zh.md)

**core** サブシステムは [`packages/core`](../../packages/core/README.md) であり、すべてのコンポジションが起動するパッケージ群である: イベントソーシングされたセッションログ、システムプロンプトの組み立て、ツールレジストリー、エージェントの型、そしてそれらを駆動する具体的なループ。このページでは `agent`/`agent-loop` ペアが宣言する内容 — エージェントの作成と所有の方法、`Agent` ハンドルの配送・キャンセル・介入コントラクト — およびすべてのサブシステムが従う 2 つの型パターンを説明する。このグループの専用ページとフォルダーの残りは [subsystems README](README.md) に索引化されている。

## パッケージごとに見た中核構成

1 つのターンは 6 つのパッケージを 1 つのループで流れる: [`agent-loop`](../../packages/core/agent-loop) 内のドライバーがキューに入ったプロンプトを取得し、[セッションログ](session.md) (`ctx.sessions`) 上でターンを開き、[system-prompt](system-prompt.md) (`ctx.systemPrompt`) を通じてリクエストのプレフィックスを組み立ててログから履歴を導出し、[LLM シーム](llm-streaming.md)を通じてモデルの応答をストリーミングし、[ツールレジストリー](tools.md) (`ctx.tools`) を通じてツール呼び出しをディスパッチし、次のステップが導出する前にモデル可視の事実をすべてログに追記する。ループが運ぶ会話ボキャブラリー — `Message`、`ContentBlock`、`StreamChunk`、モデルリクエスト — は [`packages/llm`](../../packages/llm/README.md) が宣言し、[llm-streaming.md](llm-streaming.md) で文書化されている。

| パッケージ | 担当 | ページ |
|---|---|---|
| `session/` | 追記専用の `SessionEvent` ログとインメモリストア — 単一の真実の源 (`ctx.sessions`) | [session.md](session.md) |
| `system-prompt/` | プロンプトセクションとツールスキーマの組み立て (`ctx.systemPrompt`) | [system-prompt.md](system-prompt.md) |
| `tools/` | スコープ付きツールレジストリーとガード付き実行パイプライン (`ctx.tools`) | [tools.md](tools.md) |
| `agent/` | `Agent` インターフェース、ライブレジストリー、イニシエータースコープ、`agent/*` イベントボキャブラリー (`ctx.agents`) | このページ |
| `agent-loop/` | 公開 `Agent` コントラクトを実装する具体的なドライバー (`ctx.agentLoop`) | このページ |
| `scope/` | レジストリーとループがエージェントごとのスコープ構築の土台とするスコープ付き登録プリミティブ | [scope.md](scope.md) |

`scope/` は唯一の非サービスパッケージである: 依存関係を持たないライブラリー (`createScope`/`scopeOf`/`scopeTarget`) で、モジュールグラフにおいて `session/` と `system-prompt/` の下位に位置することで、それらが循環なしに利用できるようになっている。`agent-loop` は公開 `Agent` コントラクトの唯一の具体的な実装であり、ハーネスの既定のプロダクトループであるためここに属する; 各ドライバーを `ctx.agents.withInitiator()` 内で実行する。拡張プラグインは `agent` に依存し — 起動元エージェントが必要な場合も含めて — `agent-loop` に直接依存しないため、ループは交換可能に保たれる。[`dsh-base`](../../packages/bundle/base/README.md) は既定のプロダクトコンポジションであり、[`dsh-sdk-minimal`](../../packages/bundle/sdk-minimal/README.md) はより小さなスタンドアロンツリーを宣言する。

## 作成と所有権

コンシューマーは `ctx.agents` を通じてエージェントを作成する — `create()` は呼び出し元が指定した 1 つの `SessionId` の下で新しいセッションとエージェントを構築し、`resume()` は永続化されたセッションを先に読み込む — またはループの設定エントリーを通じて宣言的に作成する。プログラムによる作成は所有者のハンドルを返す:

Source: [`packages/core/agent/src/index.ts`](../../packages/core/agent/src/index.ts)

```ts type-equiv
/**
 * An owned agent plus its disposer, returned by {@link AgentRegistry.create} /
 * {@link AgentRegistry.resume}. The disposer is a CAPABILITY: among consumers,
 * only the holder can tear this agent down. The registered factory provider is
 * also a structural owner because the scoped agent depends on that provider's
 * service API; provider unload stops and drains every live handle it made.
 * `dispose()` stops the loop, awaits its exit, unregisters the agent, removes
 * its session from the store, and finally unwinds its scoped world.
 *
 * `ctx.agents.get(id)` still returns a bare {@link Agent} — the handle is
 * exposed only to the consumer owner that created it; the structural provider
 * reaches the same teardown internally. Config-created agents (the loop's own
 * startup) are owned by the loop fiber and never need a handle.
 */
interface AgentHandle {
  agent: Agent
  dispose(): Promise<void>
}
```

`CreateAgentOptions` は共有の同一性と、新しいエージェントが公開前に必要とするすべてのものを運ぶ: 任意のライブの `parentAgent`、セッションメタデータ (`meta` — 検証済みの `cwd`、フォークの系譜、`isSeeded` マーカー、生成元の分類、委譲の深さ、`agentPreset`)、兄弟フィールド `inheritedEventCount` 内の正確なフォーク切り分け点、任意の `seed` リプレイプレフィックス、エージェントごとの `AgentOptions`、作成時のみのキャンセル用 `signal`、および `setup`。`ResumeAgentOptions` は永続化された同一性に対応する: `resumeSessionId`、`parentAgent`、`agentOptions`、`signal`、および `setup`。`setup` コールバック (`AgentSetup`) は両方の id がまだ公開されていない間に `(agentCtx, agent)` を受け取る: コンテキストはスコープ付き登録を所有し、明示的な Agent は Context 上の逆方向プロパティなしに正確な子 Session を提供する。`agentCtx` を通じて登録されたものはすべて `agent/created` と最初のプロンプト組み立ての前に存在する。Setup は公開直前に実行される同期コミットを返してもよい; setup の拒否、コミットの throw、または所有者の破棄は両方の id を公開せずにトランザクションをロールバックする。

`AgentFactory` はレジストリー背後の作成インターフェースである: ループは `ctx.agents.setFactory()` を通じてそのファクトリーを登録するため、コンシューマーは具体的なループパッケージに依存せずに `ctx.agents` を使う。ランタイムの子作成者は `options.parentAgent` を設定する; レジストリーはオプションと呼び出し元 Context をファクトリーに渡し、一方から他方を導出しない。正確な `create`/`resume` シグネチャーとロールバックコントラクトは下の[生成セクション](#ctxagents--agentregistry)にある。

## エージェントハンドル

`Agent` はすべてのプラグイン (UI、フック、オーケストレーター) がプログラム対象とするサーフェスである; `ctx.agents.get(id)` がそれを返し、[イニシエーター$scope](#initiating-agent) がそれを運ぶ。具体的な実装は dsh-agent-loop 内部のパッケージプライベートであり、ループ外の何ものもそれに依存しない。統一された `send` メソッドがターゲットとウェイクアップのルーティングを直接公開する; `followup`、`steer`、`inject` は固定プリセットの別名である。

Source: [`packages/core/agent/src/types.ts`](../../packages/core/agent/src/types.ts)

```ts type-equiv
/** Public live-agent handle; the runtime face augments its live capabilities. */
interface Agent {
  /** Session-backed Agent identity. */
  readonly id: SessionId
  /** The provider route and model this agent's requests use. */
  readonly options: AgentOptions
  /** The live session this agent drives; its log is the durable source of truth. */
  readonly session: Session
  /** Agent-owned access to durable pending work. */
  readonly inbox: Inbox
  /** The current lifecycle state, mirrored on every `agent/status` transition. */
  readonly status: AgentStatus
  /** Agent-scoped context; its contributions are agent-local, unwind on disposal, and reject registration afterward. */
  readonly ctx: Context

  /**
   * Clear queued and steering work — unless `keepInbox` — and abort the active
   * turn or between-turn task. The first cause wins for that activity. With no
   * active activity, cancellation is a no-op and does not arm later work.
   * @param cause - the stable caller intent carried by the active operation signal.
   * @param options - cancellation options; `keepInbox` preserves pending work.
   */
  cancel(cause: AgentCancelCause, options?: CancelOptions): void

  /**
   * Resolve after the current whole-agent activity reaches quiescence. This
   * follows replacement work started before the observed driver retires,
   * but does not identify the settlement of any particular message.
   * @returns fulfillment after no active driver or maintenance task remains.
   */
  whenIdle(): Promise<void>

  /**
   * Run one non-turn maintenance task from the true idle phase. The task starts
   * synchronously after claiming that phase; later waking input remains in the
   * inbox until the task settles, while public status stays `idle`.
   * `whenIdle()` follows both the task and any waking work released behind it.
   * @param task - operation whose fulfillment or rejection is preserved, with a signal aborted by {@link cancel}.
   * @throws synchronously when turn-driving or another maintenance task already owns the agent.
   * @returns the task promise.
   */
  runMaintenance<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>

  /**
   * Route identified input to an inbox boundary and optionally wake the driver.
   * Waking input submitted after active cancellation is queued for the next
   * turn and runs when the aborted activity converges to idle; a `disposed`
   * cancel leaves it parked. A wake submitted while already idle always opens
   * its turn boundary, even when its message is cleared before the driver
   * claims ([driver wake convergence](../../agent-loop/src/agent.ts)).
   * @param message - identified content and the source that supplied it.
   * @param target - the preferred next-turn or next-step inbox boundary.
   * @param wakeup - whether delivery may wake the driver.
   */
  send(message: UserMessage, target: InboxTarget, wakeup: boolean): void

  /**
   * Queue an ordinary follow-up turn and wake the driver. The item becomes the
   * sole ordinary message of its own turn.
   * @param message - identified prompt content and the source that supplied it.
   */
  followup(message: UserMessage): void

  /**
   * Submit steering for the nearest step. An idle driver starts a turn;
   * a running driver consumes it at its next step boundary.
   * A rejected step leaves steering parked in the inbox until the next
   * wake; cancellation or disposal may discard pending steering.
   * @param message - identified steering content and the source that supplied it.
   */
  steer(message: UserMessage): void

  /**
   * Queue model-facing context for the next pre-step without waking the
   * driver. A running driver claims it at the nearest later step boundary;
   * idle drivers leave it pending until follow-up or steering
   * wakes them. It may miss a request whose pre-step already claimed its
   * batch. Cancellation or disposal may discard pending context.
   * @param message - identified injected context and the source that supplied it.
   */
  inject(message: UserMessage): void
}
```

```ts type-equiv
/**
 * An agent's lifecycle state, emitted on every transition as `agent/status`:
 * `idle` means no driver is active; `running` begins when waking input starts
 * cancellable pre-step processing and lasts while the driver drains,
 * closes, or checkpoints turns. Disposal removes the agent from its registry;
 * it is not a third observable status.
 */
type AgentStatus = 'idle' | 'running'
```

```ts type-equiv
/** One process-local live assistant streaming publication. */
type AssistantStreamFrame =
  | {
    readonly type: 'start'
    readonly attemptId: LlmAttemptId
    /** Monotone within one attached Agent lifecycle; replacement restarts at 1. */
    readonly revision: number
    readonly turn: number
    readonly step: number
  }
  | {
    readonly type: 'chunk'
    readonly attemptId: LlmAttemptId
    readonly revision: number
    /** Dense zero-based position within the attempt. */
    readonly index: number
    /** Safe-integer timestamp reused by the durable embedded stream. */
    readonly time: number
    readonly chunk: StreamChunk
  }
  | {
    readonly type: 'end'
    readonly attemptId: LlmAttemptId
    readonly revision: number
    /** Number of chunk frames emitted by this attempt. */
    readonly index: number
    /** Durable settlement committed before this notification, or live abandonment without one. */
    readonly outcome:
      | {
        readonly kind: 'committed'
        readonly eventType: 'assistant/message' | 'assistant/attempt'
        readonly seq: SessionSeq
      }
      | { readonly kind: 'abandoned' }
  }
```

`running` はドライバー全体の排出区間を表し、連続するキュードターンをまたぐことがある; ターンがまだ開いていることの証明にはならない。破棄はエージェントをレジストリーから除去し `agent/disposed` を送出する; 終端の状態値ではない。`followup()` はハンドルを返さない: その `MessageId` は耐久化されたインボックスへの挿入・取得・破棄の事実を識別し、後のアシスタント出力やターンの終了を識別しない。`whenIdle()` はエージェント全体を観測するため、呼び出し元はその区間を明示的に所有する場合にのみ受領からアイドルまでの区間をランと呼べる ([決定](../../.agents/notes/implemented/architecture/2026-07-30-followup-enqueue-and-owned-runs.md))。

```ts type-equiv
/** Merge-extensible agent creation options. Persona belongs to system-prompt sections. */
interface AgentOptions {
  /** Provider route (must have a registered adapter at call time). */
  provider?: string
  /** Model id interpreted by the selected provider adapter. */
  model?: string
  /** Adapter-owned reasoning effort for the selected provider/model route. */
  reasoningEffort?: ReasoningEffortId
  /** Maximum output tokens for each conversation-model request. */
  maxTokens?: number
}
```

ディスパッチには `agent/request` の後で `provider` と `model` が必要である。明示的な `reasoningEffort` はそのルート上の最初のリクエストをシードし、厳密モデル解決がそれを検証する一方、省略時はアダプターの既定が具体化する。存在する場合、`maxTokens` は正の安全整数でなければならず、会話モデルリクエストごとに上限を設ける; 省略時は厳密モデルアダプターの既定がリクエストヘッダーの前に具体化するか、そうでなければプロバイダーの動作を変えない。エージェントスコープの `deployment:persona-prefix` プロンプトセクションはグローバルの既定ペルソナを隠蔽できる。

インボックスは配送ボキャブラリーである — エージェントが耐久プロジェクションとして所有する 2 つの順序付き保留メッセージリストである:

```ts type-equiv
/** Agent-owned access to pending work; concrete storage belongs to the driver. */
interface Inbox {
  /** Prompts awaiting individual turns. */
  readonly nextTurn: readonly UserMessage[]
  /** Input awaiting the next step boundary. */
  readonly nextStep: readonly UserMessage[]

  /** Durably cancel all pending input, clearing next-step before next-turn. */
  clear(): void

  /**
   * Append one message to a pending list.
   * @param target - pending list to extend.
   * @param message - message to append.
   */
  append(target: InboxTarget, message: UserMessage): void

  /**
   * Prepend one message to a pending list.
   * @param target - pending list to extend.
   * @param message - message to prepend.
   */
  prepend(target: InboxTarget, message: UserMessage): void

  /**
   * Replace one pending message in place.
   * @param messageId - identity of the pending message to replace.
   * @param newMessage - replacement message.
   * @returns whether the message was still pending.
   */
  replace(messageId: MessageId, newMessage: UserMessage): boolean

  /**
   * Remove one pending message.
   * @param messageId - identity of the pending message to remove.
   * @returns whether the message was still pending.
   */
  remove(messageId: MessageId): boolean

  /**
   * Apply standard splice semantics and durably record the normalized result.
   * @param target - pending list to mutate.
   * @param start - splice position.
   * @param deleteCount - maximum number of messages to remove.
   * @param inserted - messages to insert at the resolved position.
   * @returns messages removed by the splice.
   */
  splice(
    target: InboxTarget,
    start: number,
    deleteCount: number,
    inserted: UserMessage[],
  ): UserMessage[]
}
```

```ts type-equiv
/** One of the two ordered pending-message lists owned by an agent. */
type InboxTarget = 'next-turn' | 'next-step'
```

保留中の出現はすべてその `UserMessage` である; `MessageId` が唯一の同一性である。構造的な `Inbox` メソッドは正規化された耐久 `agent/inbox/spliced` 変更を記録し、重複する保留 id を拒否する。`replace(messageId, newMessage)` と `remove(messageId, newMessage)` は両リストにわたり保留メッセージを探す; 置換は同一性を変えることがあり、古いメッセージを破棄済みとして、新しいメッセージを挿入済みとして送出する。通常の除去と `clear()` はキャンセルである。ステップ境界では、dsh-agent-loop のパッケージ内部 `ReactLoopInbox` が提案バッチ — すべての `next-step` 入力に加え、ターン境界では 1 件の `next-turn` メッセージ — を破棄通知なしの純粋な削除 splice で取り除き、次にメッセージごとの取得済み通知を送出する。ループ専用の保留検出と取得は `Agent.inbox` の一部ではない。`AgentLoop` サービスはファクトリー公開前に標準の `inbox` プロジェクションを登録する; そのセルが唯一のライブ状態であり、エージェントが存在しないコールドコンシューマーにも同じ fold が適用される。fold は安全でない範囲外の splice 座標と両リストにわたる重複同一性を拒否し、イベント seq により不正な耐久履歴を識別する。1 つのメッセージを追跡するコンシューマーは正確な `agent/inbox/inserted`、`claimed`、`discarded` 通知を使う。

キャンセル:

```ts type-equiv
/** Options for {@link Agent.cancel}. */
interface CancelOptions {
  /**
   * Preserve queued and steering inbox items instead of discarding them. The
   * active turn is still aborted, but un-started and pending work survives for a
   * later turn and no canceled inbox splice is logged.
   */
  keepInbox?: boolean | undefined
}
```

```ts type-equiv
/** Why an active agent driver was cancelled. */
type AgentCancelCause =
  | { readonly kind: 'user' }
  | { readonly kind: 'parent' }
  | { readonly kind: 'hook'; readonly reason: string }
  | { readonly kind: 'disposed' }
```

cause は TypeScript で強制される同一プロセス入力である。アクティブなキャンセル保持者はその同じオブジェクトをランタイム専用の `AbortSignal.reason` として公開する; シグナルは協調リスナーに分類権限を与えない。耐久 `turn/end` は結果を `{ kind: 'aborted', reason: TurnEndCancelCause }` として記録するため、キャンセル cause は終端結果に残る。

[`イベント分類`](../architecture.md#events) が `agent/*` ライフサイクル、チェックポイント、ウォーターフォールのコントラクトを所有する。ターンとステップの境界はエージェント送出ではなく耐久セッションイベントである。

## 起動元エージェント

`ctx.agents` が運ぶプロセス好きイニシエーターは正確に上記の `Agent` であり、別のフレームや複製された同一性ではない。常駐は生存証明でも認可でもない; [イニシエータースコープの決定](../../.agents/notes/implemented/architecture/2026-07-15-agent-initiator-scope.md) がその存続期間とスコープ規則を定義する。

## 介入の決定

ステップ前決定は耐久ユーザー入力と同じ識別付き `UserMessage` 型を使う。取得済みバッチは権威があり、すべてのメッセージの `id` と `source` を保持する。フックブリッジはネイティブ決定フィールドをこの型付き結果に写像する。

Source: [`packages/core/agent/src/types.ts`](../../packages/core/agent/src/types.ts)

`agent/pre-step` は取得済み排他バッチ (`messages`)、提案ステップの座標 (`turn`、`step`)、現在のターンのキャンセル用 `signal` を運ぶ 1 つのペイロードを受け取る。初期提案はステップ前の開いたターン内で実行される; ツール継続はステップ間で空の取得済みバッチを提出できる:

それは `PreStepDecision` を返す。Reject はステップを開かない。Enter は `step/start` の後に追記される完全なメッセージバッチを提供する; 最終決定で省かれた取得済みメッセージは除去されたまま残り、取得後に挿入された入力は保留中のままである:

```ts type-equiv
/** Whether and with which messages the loop enters a proposed step. */
type PreStepDecision =
  | { kind: 'reject' }
  | {
    kind: 'enter'
    messages: UserMessage[]
    /** Start a distinct model-message series before this step's admitted messages. */
    startsRequestSeries?: true
  }
```

`agent/request-error` は失敗したモデルステップの終了後、そのターンの終了前に実行される。リスナーは失敗したターンのシグナルがまだ有効な間に耐久状態を修復したりポリシー作業を待ったりできる。回復を所有するハンドリングリスナーは `next()` を呼ばずに `{ kind: 'retry' }` を返す; 既定の `undefined` は失敗を終端のままにする。

```ts type-equiv
/** Action returned by a listener that owns model-request recovery. */
type RequestErrorAction = { kind: 'retry' } | undefined
```

`agent/pre-step` はリクエスト導出前の唯一のウォーターフォールリスナーチェーンである。`agent/turn-stopping` はツールやステアリングの継続がないターンが、最後のステアリング排出の前に実行される。

`agent/created` は `SessionStartSource` (セッションライフサイクルが開始した理由; ブリッジはその SessionStart マッチャーにキーを付ける) を運ぶ:

```ts type-equiv
/** Why a session lifecycle began; seeded creates are `startup`, while persisted loads are `resume`. */
type SessionStartSource = 'startup' | 'resume' | 'clear' | 'compact'
```

## セッション

`Session` は型付き `SessionEvent` の**追記専用ログ**であり、単一の真実の源である。LLM メッセージ履歴はログから*導出*され (`deriveMessages()`)、別に保存されることはない。各エントリーは単調な `seq`、`time`、`type` 判別付き `data` ペイロードを運ぶ; サーフェス変種は引用した過去イベントを `sourceEventSeqs` に列挙し、`surfaceOp` を運ぶことがある。

`SessionEvent` エンベロープの正確な条件付きフィールド、13 種のコアイベント変種 (`turn/start`、`turn/end`、`step/start`、`step/end`、`user/message`、`system/message`、`assistant/message`、`assistant/attempt`、`tool/call`、`tool/result`、`request/header`、`request/context`、`session/end-seed`)、`deriveMessages()` プロジェクション規則、`TurnEndReason` の理由、実行囲いとスタンドアロンイベントの規則は **[session.md](session.md)** にある。ログの耐久化方法 — `SessionPersistence` インターフェース、JSONL プロバイダー、`session/flush` チェックポイント、クラッシュリカバリー、`SessionHeader` — は **[persistence.md](persistence.md)** にある。

## `ToolDefinition`

パイプライン作成の型として中核にあるもの: 登録済みツールが何であるか — モデル向け `ToolSchema` に `execute` 関数と任意の最終コンテンツ・UI コールバックを加えたもの。ツール作者が手で構築することは稀であり (通常は `defineTool` DSL が型付き引数で組み立てる)、レジストリーが保持しループがディスパッチするコントラクトである。

その完全なフィールド、`defineTool`/`ValueSchemaSpec`/`ParameterSchemaSpec` 型付きスキーマ DSL、`ToolExecution`/`ToolExecutionResult` ウォーターフォール型、ツール提示 UI 型は **[tools.md](tools.md)** にある。

## リポジトリ横断の型パターン

すべてのサブシステムに現れる 2 つのパターンをここで一度だけ文書化する。

<a id="the-map--derived-union-pattern"></a>

### `…Map → derived-union` パターン

ハーネス内のほぼすべての拡張可能な合計型は 1 つのパターンに従う: 判別タグでキー付けされたインターフェース (`…Map`) から `keyof` で和集合を導出する。プラグインは所有パッケージを編集せず**宣言マージ**で変種を追加する。

```ts ignore-check
// The pattern, schematically:
interface ThingMap {
  'a': { kind: 'a'; /* … */ }
  'b': { kind: 'b'; /* … */ }
}
type ThingKind = keyof ThingMap          // 'a' | 'b'
type Thing = ThingMap[keyof ThingMap]    // the discriminated union

// A plugin extends it without touching the source package:
declare module '@deepseek-ai/dsh-llm' {
  interface ThingMap {
    'c': { kind: 'c'; /* … */ }
  }
}
```

5 つの正規マップがこのパターンを使い、プラグイン作者はこれらを拡張する:

| マップ | パッケージ | 導出先 | カタログ |
|---|---|---|---|
| `ContentBlockMap` | dsh-llm | `ContentBlock` | [llm-streaming.md](llm-streaming.md#content-blocks-and-messages) |
| `MessageSourceMap` | dsh-llm | `MessageSource` | [llm-streaming.md](llm-streaming.md#content-blocks-and-messages) |
| `FinishReasonMap` | dsh-llm | `FinishReason` | [llm-streaming.md](llm-streaming.md#the-model-request-and-result) |
| `TurnEndReasonMap` | dsh-session | `TurnEndReason` | [session.md](session.md) |
| `SessionEventMap` | dsh-session | `SessionEvent` | [session.md](session.md) |

コンシューマーが `switch` する 2 つの大きな判別和集合は **`StreamChunk`** (ストリーミングプロトコル) と **`SessionEvent`** (ログエントリー) である。リポジトリの慣習に従い、タグで `switch` し — `if` 連鎖は使わない — 各アームで絞り込み、タグの綴り誤りはコンパイル失敗にする。

### ブランド付き ID

パッケージ間で渡される ID は**ブランド付き**である — 構造的には文字列だが、型レベルでは相互交換できない (`SessionId` を `ToolCallId` が求められるところに渡せない)。構築は共有の `brandString<T>()` ヘルパーまたは所有者定義の検証ファクトリーを使う; 比較、ログ、JSON は通常の文字列として振る舞う。

`Branded<B>` プリミティブとステートレスなコンストラクターは [dsh-brand](../../packages/util/brand) にあり、ハーネスケイパビリティ依存を持たない。`brandString<T>()` はコンパイル時のみの文字列ブランドを適用する。

Source: [`packages/util/brand/src/index.ts`](../../packages/util/brand/src/index.ts)

```ts type-equiv
/** A string carrying a compile-time-only brand `B`. */
type Branded<B extends string> = string & { readonly [BRAND]: B }
```

2 つのコア ID は `ToolCallId` (ツール呼び出しと結果を相関付ける; dsh-llm) と `SessionId` (共有のライブエージェントと耐久セッションの同一性; dsh-session) である。ケイパビリティパッケージも独自の id をブランド化する。たとえば [jobs.md](jobs.md) の `JobId` である。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` から生成 (doc-sync 内の `pnpm run verify-cordis-catalog` で鮮度を検証; 再生成は `pnpm run gen-cordis-catalog`) — 言語側の違いはロケール固有のペア文書パスのみである。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する; ディスパッチモードは[入門書](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxagentdefaultmodel--agentdefaultmodelconfig"></a>

### `ctx.agentDefaultModel` — `AgentDefaultModelConfig`

Host やトランスポートとは独立に既定モデル選択を所有する。各操作は所有する Config 参照を読み取る。

```ts cordis-catalog
/**
 * Read the current default model selection.
 * @returns a detached provider, model, and optional reasoning selection.
 */
currentSelection(): ModelSelection

/**
 * Save the complete default model selection. A deployment without a configuration
 * editor keeps its composition entry. Saves commit in submission order; a failed
 * save rejects its caller without blocking later saves.
 * @param next - resolved selection accepted by an entry point.
 * @returns fulfillment after the optional profile write settles.
 */
async saveSelection(next: ModelSelection): Promise<void>
```

Source: [`packages/core/agent-default-model/src/index.ts`](../../packages/core/agent-default-model/src/index.ts)

<a id="ctxagentloop--agentloop"></a>

### `ctx.agentLoop` — `AgentLoop`

具体的なエージェントファクトリー兼ドライバーサービス。

```ts cordis-catalog
/**
 * Create an agent and session under one caller-supplied identity, owned by
 * the accessing fiber. Constructor-driven config calls mint a fresh combined
 * id before entering this boundary. When a persistence backend is mounted,
 * the session's durable identity and any seed are stored before publication.
 * @param id - shared agent/session identity.
 * @param options - concrete loop options.
 * @param meta - optional fresh-session workspace metadata.
 * @returns the published running agent.
 */
async create(id: SessionId, options: AgentOptions = {}, meta: Pick<SessionHeader, 'cwd'> = {}): Promise<Agent>

/**
 * Create an owned agent on a caller-supplied session id.
 * @param ownerCtx - caller context that structurally owns the lifecycle.
 * @param options - identities, optional live parent, session seed/metadata, loop options, setup, and cancellation.
 * @returns the published handle.
 */
async createAgent(ownerCtx: Context, options: CreateAgentOptions): Promise<AgentHandle>

/**
 * Resume an owned agent from the configured persistence service.
 * @param ownerCtx - caller context that owns load, setup, and the live lifecycle.
 * @param options - persisted identity, optional live parent, loop options, setup, and cancellation.
 * @returns the published handle.
 */
async resume(ownerCtx: Context, options: ResumeAgentOptions): Promise<AgentHandle>
```

Types: [SessionHeader](persistence.md)

Source: [`packages/core/agent-loop/src/index.ts`](../../packages/core/agent-loop/src/index.ts)

<a id="ctxagentpresets--agentpresetregistry"></a>

### `ctx.agentPresets` — `AgentPresetRegistry`

YAML 宣言プリセットとライブエージェントが保持するリビジョンのレジストリー。

```ts cordis-catalog
/** Register and eagerly load a definition; activation failure remains visible in the roster.
 * @param definition Parsed configuration supplied by the declaring plugin.
 * @returns Definition disposer after activation or its diagnostic settles; the declaring plugin owns it.
 */
async register(definition: PresetDefinition): Promise<() => Promise<void>>

/** Inspect retained revisions, or the exact revision an Agent joined.
 * @param ctx - optional Agent context; omission includes all retained revisions.
 * @returns detached module references and isolation diagnostics; no match returns an empty list.
 */
inspectCompositions(ctx?: Context): AgentPresetInspection[]

/** Read every declared preset, including activation failures.
 * @returns Display metadata and loading diagnostics.
 */
async list(): Promise<AgentPreset[]>

/** Read the selection roster.
 * @returns Current presets, each marked when it is the default.
 */
@Remote('list') async remoteExportList(): Promise<AgentPresetRoster>

/** Resolve an identity without starting an Agent.
 * @param id Explicit preset or the current default.
 * @returns Current metadata, including failure when activation failed.
 */
async resolve(id?: string): Promise<AgentPreset>

/** Read one declaration's child plugin list as YAML, for viewing only.
 * @param agentPreset Preset identity.
 * @returns The declared composition beside its published metadata.
 */
@Remote('read') readDocument(agentPreset: string): Promise<AgentPresetDocument>

/** Bind an unpublished Agent to the current preset revision.
 * @param ctx Agent context from its setup callback.
 * @param id Requested preset, or the default.
 * @returns Bound preset identity.
 */
async mount(ctx: Context, id?: string): Promise<AgentPreset>

/** Join a child to the exact revision retained by its parent.
 * @param ctx Child Agent context.
 * @param parent Parent Agent context.
 * @returns Inherited preset id, or undefined in a preset-free composition.
 */
composeFrom(ctx: Context, parent: Context): string | undefined

/** Read the preset a live Agent uses.
 * @param ctx Agent context.
 * @returns Its preset id, if bound.
 */
composedPreset(ctx: Context): string | undefined

/** Read a service supplied inside an Agent's isolated preset group.
 * @param agent Agent whose composition is queried.
 * @param name Cordis service name.
 * @returns The service, or undefined.
 */
serviceFor<K extends string & keyof Context>(agent: { ctx: Context }, name: K): Context[K] | undefined

/** Rebind a blank Agent; the caller owns the blank-session check.
 * @param ctx Agent context.
 * @param id Requested preset.
 * @returns The bound identity.
 */
async recompose(ctx: Context, id: string): Promise<AgentPreset>

/** Select a preset before a session starts its first turn. A Session whose
 * log records the preset and whose Agent runs its current revision keeps its
 * composition; nothing is logged or announced.
 * @param agent Target Agent.
 * @param agentPreset Requested identity.
 * @returns Committed preset identity.
 */
@Remote('select') async select(agent: Agent, agentPreset: string): Promise<string>

/** Read current registrations for cold transcript presentation.
 * @param id Preset identity or the default.
 * @returns A revision lease; dispose it after the scoped read completes.
 */
async acquireScope(id?: string): Promise<{ key: ScopeKey } & AsyncDisposable>

/** Read plugin rows without creating an Agent.
 * @returns Current declaration metadata and activation states.
 */
compositionInventory(): Promise<AgentPresetComposition[]>
```

Types: [ScopeKey](scope.md)

Source: [`packages/preset/agent-preset-registry/src/index.ts`](../../packages/preset/agent-preset-registry/src/index.ts)

<a id="ctxagents--agentregistry"></a>

### `ctx.agents` — `AgentRegistry`

エージェントサービス (`ctx.agents`): ライブエージェントを追跡し、1 つのプロセス好き非同期ドライバーチェーンを通じて起動元エージェントを運ぶ。エージェントの*作成*は AgentFactory を実装するプラグイン (`@deepseek-ai/dsh-agent-loop`) が提供し、setFactory 経由で登録される。

イニシエーターメソッドは同一プロセス内の因果帰属のみを提供する。常駐は生存証明でも認可でもない; 主語と所有者は明示のままであり、ワーカー・プロセス・永続化・ワイヤー境界での同一性も同様である。返された Promise 境界は破棄中に排出されるが、所有ファイバーのアンロードを開始するネストした系譜は自身の排出から除外される。

```ts cordis-catalog
/**
 * Read the Agent that initiated the inherited asynchronous driver chain.
 * Use this optional form for logging, tracing, metrics, or host attribution
 * that also supports agentless calls. When a parent creates a child, setup
 * reports the causal parent while the setup callback's Agent parameter
 * identifies the child.
 * @returns the inherited Agent, or `undefined` outside an initiator boundary
 *   and inside an explicit clearing boundary.
 * @throws when this service instance has been disposed.
 */
currentInitiator(): Agent | undefined

/**
 * Read the initiating Agent and fail when no initiator boundary is active.
 * Use this for private helpers contractually below a driver, or for a
 * deployment-owned outbound request whose contract forbids agentless calls.
 * Generic or direct-call paths use optional lookup or explicit request fields.
 * @returns the inherited Agent.
 * @throws when no initiator is active or this service instance has been disposed.
 */
requireInitiator(): Agent

/**
 * Run an operation with one exact Agent as its process-local initiator. The
 * exact synchronous value or Promise returned by the operation is preserved.
 * Custom drivers and test harnesses wrap their complete returned foreground
 * lifetime.
 * A queue or wire receiver may establish this boundary only after validating
 * explicit identity and resolving the exact live Agent; this method does neither.
 * Detached work remains owned by the subsystem that starts it.
 * @param agent - initiating Agent to inherit; presence is neither liveness proof nor authorization.
 * @param operation - synchronous or asynchronous operation to invoke.
 * @returns the exact value returned by `operation`.
 * @throws when the initiator scope is closing/disposed, or when `operation` throws.
 */
withInitiator<T>(agent: Agent, operation: () => T): T

/**
 * Run an operation inside a boundary that hides any inherited initiating
 * Agent. The exact synchronous value or Promise is preserved.
 * Use this while creating lazy shared timers, queue pumps, pool maintenance,
 * watchers, or exporters so they do not inherit the first Agent that happens
 * to initialize them. It clears only initiator attribution, not explicit
 * fields, and does not own or drain detached resources.
 * @param operation - synchronous or asynchronous operation to invoke without an initiator.
 * @returns the exact value returned by `operation`.
 * @throws when the initiator scope is closing/disposed, or when `operation` throws.
 */
withoutInitiator<T>(operation: () => T): T

/**
 * Register the agent-creation factory (the loop calls this on construction,
 * effect-scoped). A traced Cordis service is canonicalized to its concrete
 * target; each create/resume call is then traced through that caller's
 * context so ownership follows the caller without stacking proxy layers.
 * Throws if a factory is already registered. Returns the disposer; on
 * dispose the factory slot is cleared.
 * @param factory - the loop-owned factory {@link create}/{@link resume} delegate to.
 * @returns the disposer that clears the factory slot. The exact
 *   Cordis effect disposer (single-shot): composite (generator) effects may
 *   yield it directly — exact identity nests the teardown in order.
 */
setFactory(factory: AgentFactory): () => void

/**
 * Create and publish a new agent through the registered factory.
 * Distinct from {@link register} (which records an already-constructed
 * agent): this constructs the agent and its session. Rejects if no factory is
 * registered or creation/setup fails. The resolved {@link AgentHandle} lets
 * the owner tear down exactly this agent.
 * @param options - shared identity, optional live parent, session seed/metadata, and agent options.
 * @returns the handle after setup, rollback-covered publication, and loop start complete.
 */
async create(options: CreateAgentOptions): Promise<AgentHandle>

/**
 * Load a persisted session and resume an agent on it through the registered
 * factory. Rejects if no factory is registered; the factory rejects if
 * session persistence is not configured or persistence/setup fails.
 * @param options - persisted identity, optional live parent, configuration, and setup.
 * @returns the handle after setup, rollback-covered publication, and loop start complete.
 */
async resume(options: ResumeAgentOptions): Promise<AgentHandle>

/**
 * Register a live agent with source `startup`. Rejects if the id is already registered or a
 * serial `agent/created` listener fails. Emits `agent/disposed`
 * when the calling fiber is disposed — both with the agent's scope carrier
 * (`scopeTarget(agent, agent)`): the subject is the agent in hand, so the
 * emits are scope-filtered regardless of which context invoked `register`
 * (calling through `agent.ctx` scopes EFFECTS; dispatch scoping always
 * requires passing the carrier). The entry is a runtime root; factory-backed
 * creation uses `options.parentAgent` for child ownership. Await the registration before using the agent.
 * @param agent - the already-constructed agent to record in the store.
 * @returns the awaitable Cordis effect disposer (single-shot; a repeat call
 *   returns undefined without awaiting an in-flight teardown). Exact
 *   identity is load-bearing: a composite (generator) effect that owns a
 *   teardown ORDER — the agent factory's lifecycle chain — must yield THIS
 *   function so Cordis nests the unregistration at that yield position;
 *   yielding a wrapper would leave it disposing as a concurrent sibling on
 *   owner unload, unregistering the agent (and emitting `agent/disposed`)
 *   while its final turn is still draining.
 */
register(agent: Agent): ReturnType<Context['effect']>

/**
 * Insert an already-constructed agent without announcing it. This is the
 * advanced ordered-lifecycle primitive used by the async agent factory: it
 * first completes setup while the agent is unpublished, then assigns the
 * returned detach closure into its pre-installed composite teardown before
 * calling {@link announce}. Ordinary callers use {@link register}.
 * @param agent - the prepared, unpublished agent.
 * @param owner - explicitly supplied live runtime owner, or
 *   undefined for a top-level runtime root. This is runtime ownership, not
 *   the resumed session's durable parent lineage.
 * @returns an idempotent closure that removes this exact entry and emits
 *   `agent/disposed` with listener failures contained. When called from a
 *   `agent/created` listener, removal and disposal wait until the serial
 *   creation dispatch settles.
 */
enter(agent: Agent, owner: Agent | undefined): () => void

/**
 * Announce an agent previously inserted with {@link enter}.
 * @param agent - the live inserted agent to announce.
 * @param source - fresh creation, resume, clear, or compaction source.
 * @param signal - optional factory initialization cancellation signal passed to listeners.
 * @returns completion of the serial creation listeners; a listener failure rejects.
 * @throws if `agent` is not the exact live registry entry for its id, or its
 *   creation announcement already began (including a reentrant call from a
 *   creation listener).
 */
async announce(agent: Agent, source: SessionStartSource, signal?: AbortSignal): Promise<void>

/**
 * Look up a live agent.
 * @param id - the shared agent/session id to look up.
 * @returns the agent, or undefined when no live agent has that id.
 */
get(id: SessionId): Agent | undefined

/**
 * Test whether a live agent was created through one exact parent agent's
 * scoped context. Runtime ownership is independent of durable session
 * lineage and remains unambiguous when unrelated providers reuse an id.
 * @param id - the candidate child agent's shared agent/session id.
 * @param owner - the expected runtime creator agent.
 * @returns true only while the exact child entry is live under that owner.
 */
isOwnedBy(id: SessionId, owner: Agent): boolean

/**
 * All live agents, in registration order.
 * @returns a fresh array; mutating it does not affect the registry.
 */
list(): Agent[]

/**
 * All live top-level agents in registration order. A top-level agent was
 * created without an owning agent context; durable session lineage does not
 * affect this runtime relation, so a resumed fork may still be a root.
 * @returns a fresh array; mutating it does not affect the registry.
 */
roots(): Agent[]
```

Source: [`packages/core/agent/src/index.ts`](../../packages/core/agent/src/index.ts)

<a id="agent-events"></a>

### `agent/*` events

<a id="agentassistant-stream--emit"></a>

#### `agent/assistant-stream` — emit

プロセス好きアシスタントストリームの公開。チャンクフレームは一時的であり、ループはコミット済み終了フレームの前に同じストリームを持つ最終の v2 `assistant/message` または `assistant/attempt` を 1 件追記する。

```ts cordis-catalog
/**
 * Process-local assistant-stream publication. Chunk frames are transient;
 * the loop appends one final v2 `assistant/message` or `assistant/attempt`
 * with the same stream before a committed end frame.
 * @param payload.agent - the agent whose attempt produced the frame.
 * @param payload.frame - one ordered start, chunk, or end publication.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode emit
 */
'agent/assistant-stream'(this: Scoped<Agent>, payload: { agent: Agent; frame: AssistantStreamFrame }): void
```

Types: [Scoped](scope.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agentcreated--serial"></a>

#### `agent/created` — serial

投入済みエージェントはファクトリー setup 後にエージェントごとの初期化の準備ができる。リスナーは順に実行され、作成解決前に待機される。AgentLoop はすべてのリスナーが終わるまでキュー入力を保持する。throw または拒否は作成を失敗させ、後のリスナーを飛ばす。破棄はディスパッチ確定までスコープとセッションを保持する; リスナーは agent.whenIdle() や自身の所有者の破棄を待ってはならない。

```ts cordis-catalog
/**
 * An entered agent is ready for per-agent initialization after factory setup.
 * Listeners run in order and are awaited before creation resolves. AgentLoop
 * holds queued input until all listeners finish. A throw or rejection fails
 * creation and skips later listeners. Disposal retains the scope and session
 * until dispatch settles; listeners must not await agent.whenIdle() or their
 * own owner's disposal.
 * @param payload.agent - the newly registered agent with its live session and completed setup.
 * @param payload.source - fresh creation, resume, clear, or compaction source.
 * @param payload.signal - factory initialization cancellation signal, when provided.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode serial
 */
'agent/created'(this: Scoped<Agent>, payload: { agent: Agent; source: SessionStartSource; signal?: AbortSignal }): undefined | Promise<undefined>
```

Types: [Scoped](scope.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agentdisposed--emit"></a>

#### `agent/disposed` — emit

エージェントがレジストリーを離れた; AgentLoop はドライバー静止とスコープ登録巻き戻しの後、セッション切り離しの前にこれを送出する。カスタムレジストリーユーザーはドライバー順序コントラクトを所有する。

```ts cordis-catalog
/**
 * An agent left the registry; AgentLoop emits this after driver quiescence
 * and scoped-registration unwind, but before session detachment. Custom
 * registry users own their driver-ordering contract.
 * @param payload.agent - the exact agent removed from the registry.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode emit
 */
'agent/disposed'(this: Scoped<Agent>, payload: { agent: Agent }): void
```

Types: [Scoped](scope.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agenterror--emit"></a>

#### `agent/error` — emit

ステップまたはターンがエラーになった。ターン内の位置を持たない耐久レコードに対してもマシンはここで失敗を報告する。

```ts cordis-catalog
/**
 * A step or turn errored. The machine reports a failure here even when
 * the error has no in-turn position for a durable record.
 * @param payload.agent - the agent whose turn errored.
 * @param payload.turn - the turn in which the failure surfaced.
 * @param payload.step - the step at which the failure surfaced.
 * @param payload.error - the failure, verbatim.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode emit
 */
'agent/error'(this: Scoped<Agent>, payload: { agent: Agent; turn: number; step: number; error: unknown }): void
```

Types: [Scoped](scope.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agentinboxclaimed--emit"></a>

#### `agent/inbox/claimed` — emit

1 件のメッセージが開いたターン内でインボックスを離れた。提案ステップが拒否された場合、取得済みメッセージはここで終わる: 破棄としても `user/message` としても再送出されず、ターンはステップなしに閉じる。

```ts cordis-catalog
/**
 * One message left the inbox inside its open turn. If the proposed step
 * is rejected, the claimed message ends here: it is neither discarded nor
 * re-emitted as a user/message, and the turn closes without a step.
 * @param payload.agent - the agent whose inbox changed.
 * @param payload.message - the claimed message.
 * @param payload.turn - the owning turn.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode emit
 */
'agent/inbox/claimed'(this: Scoped<Agent>, payload: { agent: Agent; message: UserMessage; turn: number }): void
```

Types: [Scoped](scope.md) · [UserMessage](session.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agentinboxdiscarded--emit"></a>

#### `agent/inbox/discarded` — emit

1 件のメッセージがライブインボックスから破棄された。

```ts cordis-catalog
/**
 * One message was discarded from the live inbox.
 * @param payload.agent - the agent whose inbox changed.
 * @param payload.message - the discarded message.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode emit
 */
'agent/inbox/discarded'(this: Scoped<Agent>, payload: { agent: Agent; message: UserMessage }): void
```

Types: [Scoped](scope.md) · [UserMessage](session.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agentinboxinserted--emit"></a>

#### `agent/inbox/inserted` — emit

1 件のメッセージがライブインボックスに入った。

```ts cordis-catalog
/**
 * One message entered the live inbox.
 * @param payload.agent - the agent whose inbox changed.
 * @param payload.message - the inserted message.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode emit
 */
'agent/inbox/inserted'(this: Scoped<Agent>, payload: { agent: Agent; message: UserMessage }): void
```

Types: [Scoped](scope.md) · [UserMessage](session.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agentpre-step--waterfall"></a>

#### `agent/pre-step` — waterfall

提案ステップを拒否するか、それに入るメッセージを置換する。`next()` の呼び出しは現在のメッセージを保持する。

```ts cordis-catalog
/**
 * Reject a proposed step or replace the messages that enter it. Calling
 * `next()` preserves the current messages.
 * @param payload.agent - the agent proposing the step.
 * @param payload.messages - messages removed from the inbox for this step.
 * @param payload.turn - the turn that will own the step.
 * @param payload.step - the step proposed by the loop.
 * @param payload.signal - the current turn's cancellation signal.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode waterfall
 */
'agent/pre-step'(this: Scoped<Agent>, payload: { agent: Agent; messages: UserMessage[]; turn: number; step: number; signal: AbortSignal }, next: () => Promise<PreStepDecision>): Promise<PreStepDecision>
```

Types: [Scoped](scope.md) · [UserMessage](session.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agentrequest--waterfall"></a>

#### `agent/request` — waterfall

凍結された呼び出し構成を置換する。`await next()` はマシンが使う構成 (最初のリクエストではエージェントオプション、以降はログされたヘッダー) を与える; 置換するには戻り値で差し替える。ステップ受入時、これは組み立てと `step/start` の後、システムプロンプトと受け入れ済みユーザーバッチのコミット前に実行される。ここや後続の `prepareCall()` 解決中のキャンセルは何もコミットしない。準備済み呼び出しケイパビリティがプロンプト受入を統治する。モデル可視コンテンツはログ済みチャネルを使わなければならず、このウォーターフォールはメッセージを変更できない。

```ts cordis-catalog
/**
 * Replace the frozen call configuration. `await next()` yields the config
 * the machine would use (agent options on the first request, the logged
 * header afterwards); return a replacement to switch. On step admission,
 * this runs after assembly and `step/start`, before the system prompt and
 * accepted user batch are committed. Cancellation here or during subsequent
 * `prepareCall()` resolution commits neither. The prepared call capability
 * governs prompt admission. Model-visible content must use logged channels;
 * this waterfall cannot mutate messages.
 * @param payload.agent - the agent making the model call.
 * @param payload.turn - the open turn number.
 * @param payload.step - the step whose request this is.
 * @param payload.signal - the current turn's explicit abort signal.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode waterfall
*/
'agent/request'(this: Scoped<Agent>, payload: { agent: Agent; turn: number; step: number; signal: AbortSignal }, next: () => Promise<LlmCallConfig>): Promise<LlmCallConfig>
```

Types: [LlmCallConfig](llm-streaming.md) · [Scoped](scope.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agentrequest-error--waterfall"></a>

#### `agent/request-error` — waterfall

失敗した 1 回のモデルリクエスト試行をループが再試行またはステップ終了する前に処理する。回復を所有するリスナーは `next()` を呼ばずに `{ kind: 'retry' }` を返し、委譲するには `next()` を呼ぶ。既定の `undefined` は失敗を終端のままにする。

```ts cordis-catalog
/**
 * Handle one failed model-request attempt before the loop retries or closes
 * its step. A listener returns `{ kind: 'retry' }` without calling `next()`
 * when it owns recovery, or calls `next()` to delegate. The default
 * `undefined` leaves the failure terminal.
 * @param payload.agent - the agent whose request failed.
 * @param payload.turn - the turn containing the failed request.
 * @param payload.step - the step containing the failed request attempt.
 * @param payload.provider - the provider selected for the failed request.
 * @param payload.failure - serializable facts normalized at the final adapter boundary.
 * @param payload.retryPolicy - the policy of the adapter registration that served the failed request.
 * @param payload.signal - the turn abort signal.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode waterfall
 */
'agent/request-error'(this: Scoped<Agent>, payload: { agent: Agent; turn: number; step: number; provider: string; failure: LlmFailure; retryPolicy: ResolvedRetryPolicy | undefined; signal: AbortSignal }, next: () => Promise<RequestErrorAction>): Promise<RequestErrorAction>
```

Types: [LlmFailure](llm-streaming.md) · [ResolvedRetryPolicy](llm-streaming.md) · [Scoped](scope.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agentstatus--emit"></a>

#### `agent/status` — emit

エージェント状態が変わった (`idle` ⇄ `running`)。ウェイクを伴う配送はキャンセル予約後に同期的に `running` に入る; `idle` は残るドライバーも予定もないことを意味する。

```ts cordis-catalog
/**
 * Agent status changed (`idle` ⇄ `running`). A waking delivery enters
 * `running` synchronously after reserving cancellation; `idle` means no
 * driver remains scheduled or active.
 * @param payload.agent - the agent whose status flipped.
 * @param payload.status - the status just entered (the transition's destination).
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode emit
 */
'agent/status'(this: Scoped<Agent>, payload: { agent: Agent; status: AgentStatus }): void
```

Types: [Scoped](scope.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agentturn-stopping--serial"></a>

#### `agent/turn-stopping` — serial

ターンは閉じようとしている: モデルは応答の義務がない (ライブツール呼び出しも新しいステアリングもない)。境界コミット前に待機される — 異議のあるリスナーはステア (`agent.steer(...)`) し、マシンはインボックスを読み直す: 新しいステアリングがあれば別のステップを実行し、なければターンを閉じる。データが決めるため、リスナー順序は結果を変えない。逆方向の制御 (ツールループの早期停止) もデータである: `concludesTurn` を持つツール結果はそのステップでターンを終える。結論は既に提出された next-step 作業を短絡しない: 同ステップの `additionalContexts` や競合するステアリングは依然実行され、そのインボックスが排出されたときにのみターンが閉じる。

```ts cordis-catalog
/**
 * The turn is about to close: the model owes no response (no live tool
 * calls, no fresh steering). Awaited before the boundary commits — a
 * listener that objects steers (`agent.steer(...)`) and the machine
 * re-reads its inbox: fresh steering runs another step, none closes the
 * turn. Data decides, so listener order cannot change the outcome. The
 * inverse control (stop a tool loop early) is data too: a tool result
 * carrying `concludesTurn` ends the turn at its step. The conclusion
 * never short-circuits already-submitted next-step work: same-step
 * `additionalContexts` or racing steering still runs, and the turn
 * closes only when that inbox drains.
 * @param payload.agent - the agent whose turn is at its stop boundary.
 * @param payload.turn - the turn about to close.
 * @param payload.signal - the current turn's explicit abort signal.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @mode serial
 */
'agent/turn-stopping'(this: Scoped<Agent>, payload: { agent: Agent; turn: number; signal: AbortSignal }): Promise<void> | void
```

Types: [Scoped](scope.md)

Source: [`packages/core/agent/src/runtime-types.ts`](../../packages/core/agent/src/runtime-types.ts)

<a id="agent-loop-events"></a>

### `agent-loop/*` events

<a id="agent-loopconfig-start-failed--emit"></a>

#### `agent-loop/config-start-failed` — emit

宣言エージェントエントリーがライブエージェント公開前に失敗した。設定済み同一性向け作業を緩衝するコンシューマーは、無限に待つ代わりにこの一時的シグナルでその作業を拒否する。通常のファクトリー破棄はキャンセルされた起動試行の失敗を抑止する。

```ts cordis-catalog
/**
 * A declarative agent entry failed before it could publish a live agent.
 * Consumers that buffer work for the configured identity use this
 * transient signal to reject that work instead of waiting forever. Normal
 * factory teardown suppresses failures from the cancelled startup attempt.
 * @param payload.sessionId - exact shared agent/session identity that failed startup.
 * @param payload.error - persistence, setup, or publication failure.
 * @mode emit
 */
'agent-loop/config-start-failed'(payload: { sessionId: SessionId; error: unknown }): void
```

Source: [`packages/core/agent-loop/src/index.ts`](../../packages/core/agent-loop/src/index.ts)

<a id="agent-preset-events"></a>

### `agent-preset/*` events

<a id="agent-presetselected--emit"></a>

#### `agent-preset/selected` — emit

1 つのセッションが異なるエージェントプリセットを耐久ログにコミットした。コンシューマーはそのセッションの構成から導出した状態のみを無効化する。

```ts cordis-catalog
/**
 * One session committed a different agent preset to its durable log.
 * Consumers invalidate only state derived from that session's composition.
 * @mode emit
 * @param sessionId - the session whose composition changed.
 * @param agentPreset - the preset recorded by the committed selection.
 */
'agent-preset/selected'(sessionId: SessionId, agentPreset: string): void
```

Source: [`packages/preset/agent-preset-registry/src/types.ts`](../../packages/preset/agent-preset-registry/src/types.ts)
<!-- END GENERATED cordis-surface -->
