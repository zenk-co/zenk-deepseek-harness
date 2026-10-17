# 同一セッションの目標

日本語 | [English](goal.en.md) | [中文](goal.zh.md)

イベントソースの目標サービスとそのポリシーコンシューマーが共有する型。永続化とアクティベーションの決定は [goal ドメイン参照](../../packages/goal/goal/README.md)が所有する; このページは [`packages/goal/goal/src/types.ts`](../../packages/goal/goal/src/types.ts) の正確なフィールドとバリアントを記録する。

## ID とライフサイクル

`GoalId` は[ブランド付き id](core.md#branded-ids) である。呼び出し元は `GoalRef` を通じて 1 つの正確なリビジョンをミューテートする; 受け入れられたすべての永続ミューテーションはリビジョンを増分する。

```ts type-equiv
/** Compare-and-set identity for one exact goal revision. */
interface GoalRef {
  /** Stable goal identity. */
  readonly id: GoalId
  /** Positive revision; every durable mutation increments it. */
  readonly revision: number
}
```

永続フェーズは目的に何が起きたかに答える。プロセスローカルなアクティベーションは、継続コンシューマーが別のラウンドを開始してよいかどうかに別途答える。

```ts type-equiv
/** Durable continuation phase. Activation is process-local and separate. */
type GoalPhase =
  | 'active'
  | 'paused'
  | 'blocked'
  | 'complete'
```

ブロックは、問題によって停止した状態を表す唯一の永続的な状態である。そのポリシー所有の理由は、ルーティング用の安定した lower-kebab-case コードと、人間とモデル向けの自由形式の説明を運ぶ。

```ts type-equiv
/** Machine-routable and human-readable explanation for a blocked goal. */
interface GoalBlockReason {
  /** Stable lower-kebab-case classification chosen by the blocking policy. */
  readonly code: string
  /** Non-empty explanation shown to humans and models. */
  readonly message: string
}
```

```ts type-equiv
/** Full durable state written by every non-clear goal mutation. */
interface GoalSnapshot extends GoalRef {
  /** Human-requested completion objective. */
  readonly objective: string
  /** Durable lifecycle phase. */
  readonly phase: GoalPhase
  /** Present exactly while `phase` is `blocked`. */
  readonly blockedReason?: GoalBlockReason
  /** Total admitted goal-round cap. */
  readonly maxGoalRounds: number
}
```

```ts type-equiv
/** Current goal projection, including values derived from the session log. */
interface GoalView extends GoalSnapshot {
  /** Highest admitted round number for this goal. */
  readonly roundsStarted: number
  /** Epoch milliseconds of the create mutation. */
  readonly createdAt: number
  /** Epoch milliseconds of the latest mutation. */
  readonly updatedAt: number
  /** Process-local continuation eligibility; never persisted. */
  readonly activation: GoalActivation
}
```

サービスは永続状態を変えずにプロセスローカルなアクティベーションエッジも公開する; クライアントはライブステータスのためにこのイベントを消費する。

```ts type-equiv
/** Live process-local activation update forwarded to UI clients. */
interface GoalActivationChanged {
  /** Session whose live goal activation changed. */
  readonly sessionId: SessionId
  /** Current exact activation, absent when no goal is current. */
  readonly goal?: {
    /** Exact current goal identity. */
    readonly id: GoalId
    /** Exact current goal revision. */
    readonly revision: number
    /** Current process-local continuation state. */
    readonly activation: GoalActivation
  }
}
```

## 永続的な変更

すべてのミューテーションは永続的な `goal/change` セッションイベントであり、そのペイロードはミューテーション後の完全なスナップショットかクリアのトゥームストーンのいずれかである。厳格な fold と永続化されたプロジェクションはこれらのイベントからのみライフサイクル状態を導出する; inbox のミューテーションは目標状態に影響しない。

```ts type-equiv
/** Full-snapshot goal mutation committed by a durable `goal/change` event. */
interface GoalSnapshotChangeMeta {
  readonly kind: 'goal/change'
  readonly version: 1
  readonly operation: Exclude<GoalOperation, 'clear'>
  readonly goal: GoalSnapshot
  readonly roundsStarted: number
  readonly createdAt: number
  readonly updatedAt: number
}
```

```ts type-equiv
/** Tombstone retained when the current goal is cleared. */
interface GoalClearChangeMeta {
  readonly kind: 'goal/change'
  readonly version: 1
  readonly operation: 'clear'
  readonly cleared: GoalRef
  readonly clearedAt: number
}
```

継続コンシューマーは、承認された各 user-message ターンを正の連番ラウンド番号と現在のリビジョンで帰属する; これらの承認された `user/message` イベントだけが `roundsStarted` を進める。リプレイは非正のラウンド、ギャップ、古いリビジョン、停止したフェーズ、および上限のオーバーフローを拒否する。

```ts type-equiv
/** Message attribution for admitted continuation rounds. */
interface GoalMessageSource {
  readonly kind: 'goal'
  readonly goalId: GoalId
  readonly revision: number
  /** Positive admitted continuation round. */
  readonly round: number
}
```

## リクエストと通知

作成は呼び出し元の省略とデプロイメントの選択を分離し、`create()` がそれを内部で解決する。編集は部分置換であり、そのランタイムバリデータは少なくとも 1 つのフィールドを要求する。すべてのミューテーション通知は受け入れられた操作と正確なリビジョンを運ぶ; clear は `goal` を省略する。

```ts type-equiv
/** Input whose omitted round cap is resolved by the service configuration. */
interface CreateGoalRequest {
  readonly objective: string
  readonly maxGoalRounds?: number
}
```

```ts type-equiv
/** Fields changed by an edit; at least one must be present. */
interface EditGoalRequest {
  readonly objective?: string
  readonly maxGoalRounds?: number
}
```

```ts type-equiv
/** Live notification after one durable goal mutation commits. */
interface GoalChanged {
  readonly operation: GoalOperation
  readonly ref: GoalRef
  /** Absent for a clear tombstone. */
  readonly goal?: GoalView
}
```

## サービスの挙動

[`GoalService`](../../packages/goal/goal/src/index.ts) は作成のデフォルトを解決し、省略可能で登録された `goal` プロジェクションから厳格なリプレイを読み、正確な生きたエージェントの同一性とコンペアアンドセットのミューテーションを強制し、封じ込められた `goal/changed` 通知を emit する。プロジェクションレジストリまたはキーが存在しない場合、最初の依存アクセスは失敗する。パッケージ [README](../../packages/goal/goal/README.md) が呼び出し可能な API とモデル可視の契約を定義する。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される (doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証; `pnpm run gen-cordis-catalog` で再生成) — 言語版はロケール固有の対訳ドキュメントパスのみが異なる。シグネチャブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する; ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxgoals--goalservice"></a>

### `ctx.goals` — `GoalService`

所有するセッションログのみに裏付けられた目標サービス (`ctx.goals`)。

```ts cordis-catalog
/**
 * Read the current goal for one exact live agent.
 * @param agent - owning live agent.
 * @returns a fresh view or `undefined` when no goal is current.
 * @throws {@link GoalError} when the agent is not the registry's live instance.
 */
@Remote('get') get(agent: Agent): GoalView | undefined

/**
 * Remove process-local continuation authority without changing durable goal
 * phase or revision. Lifecycle owners use this before unloading a driver;
 * a later human-authorized {@link resume} records the new activation edge.
 * @param agent - owning live agent.
 * @returns a fresh disarmed view, or `undefined` when no goal is current.
 */
disarm(agent: Agent): GoalView | undefined

/**
 * Create and arm a goal. A completed goal may be replaced; every other
 * current phase must be cleared or resumed instead.
 * @param agent - owning live agent.
 * @param request - objective and optional round cap.
 * @returns the created live view.
 */
create(agent: Agent, request: CreateGoalRequest): GoalView

/**
 * Edit objective and/or round cap without changing phase.
 * @param agent - owning live agent.
 * @param ref - expected current revision.
 * @param request - at least one replacement field.
 * @returns the edited view.
 */
@Remote('edit') edit(agent: Agent, ref: GoalRef, request: EditGoalRequest): GoalView

/**
 * Pause an active goal and disarm automatic continuation.
 * @param agent - owning live agent.
 * @param ref - expected current revision.
 * @returns the paused view.
 */
@Remote('pause') pause(agent: Agent, ref: GoalRef): GoalView

/**
 * Resume and arm a stopped goal, or rearm an active goal after a
 * session-start edge, while its round budget still has capacity.
 * @param agent - owning live agent.
 * @param ref - expected current revision.
 * @returns the active view.
 */
@Remote('resume') resume(agent: Agent, ref: GoalRef): GoalView

/**
 * Mark a current non-complete goal complete and disarm it.
 * @param agent - owning live agent.
 * @param ref - expected current revision.
 * @returns the completed view.
 */
@Remote('complete') complete(agent: Agent, ref: GoalRef): GoalView

/**
 * Mark an active goal blocked and disarm it.
 * @param agent - owning live agent.
 * @param ref - expected current revision.
 * @param reason - policy-owned stable code and human-readable explanation.
 * @returns the blocked view with its durable reason.
 */
block(agent: Agent, ref: GoalRef, reason: GoalBlockReason): GoalView

/**
 * Clear the current goal while retaining a durable tombstone and history.
 * @param agent - owning live agent.
 * @param ref - expected current revision.
 * @returns the tombstone ref whose revision is one past the cleared snapshot.
 */
@Remote('clear') clear(agent: Agent, ref: GoalRef): GoalRef

/**
 * Create one Goal through the remote boundary.
 * @param agent - exact live Agent resolved from the wire identity.
 * @param request - objective and optional round cap.
 * @returns the created Goal identity.
 */
@Remote('create') remoteExportCreate(agent: Agent, request: CreateGoalRequest): CreateGoalResult
```

型: [Agent](core.md)

ソース: [`packages/goal/goal/src/index.ts`](../../packages/goal/goal/src/index.ts)

<a id="goal-events"></a>

### `goal/*` イベント

<a id="goalactivation-changed--emit"></a>

#### `goal/activation-changed` — emit

1 つのセッションのプロセスローカルな目標アクティベーションが変化した。

```ts cordis-catalog
/**
 * Process-local goal activation changed for one session.
 * @mode emit
 * @param payload - session id and the exact current goal activation, or no goal after a clear.
 */
'goal/activation-changed'(payload: GoalActivationChanged): void
```

ソース: [`packages/goal/goal/src/types.ts`](../../packages/goal/goal/src/types.ts)

<a id="goalchanged--emit"></a>

#### `goal/changed` — emit

1 つの生きたエージェントによって受け入れられた目標ミューテーション。対応する `goal/change` セッションイベントはすでにコミットされている。リスナーの失敗は封じ込められる。スコープフィルタリングされたディスパッチ (`@deepseek-ai/dsh-scope`): エージェントスコープのリスナーはそのエージェントだけを受け取る。

```ts cordis-catalog
/**
 * Goal mutation accepted by one live agent. The matching `goal/change`
 * session event has already committed. Listener failures are contained.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @param payload.agent - agent whose session owns the goal.
 * @param payload.change - fresh current projection or clear tombstone.
 * @mode emit
 */
'goal/changed'(this: import('@deepseek-ai/dsh-scope').Scoped<Agent>, payload: { agent: Agent; change: GoalChanged }): void
```

型: [Agent](core.md) · [Scoped](scope.md)

ソース: [`packages/goal/goal/src/domain.ts`](../../packages/goal/goal/src/domain.ts)
<!-- END GENERATED cordis-surface -->
