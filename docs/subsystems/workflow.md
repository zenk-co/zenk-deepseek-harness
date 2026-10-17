# ワークフロー

日本語 | [English](workflow.en.md) | [中文](workflow.zh.md)

ワークフローシームは、エージェントがサブエージェントを起動するモデル作成のオーケストレーション SCRIPT を実行できるようにする。[subagent](subagent.md) と同様、これは **1 つのオプションのケイパビリティ**であり、エージェントループの一部ではないため、その型と操作は [core.md](core.md) ではなくここに置かれる。bash と同様、コンテキストごとに 1 つのエンジン実装が `ctx.workflowEngine` を提供することを許す。名前付きプロバイダーレジストリは存在しない (2 番目のエンジンはその隣で動くのではなく、プラグイン設定を通じて最初のものを置き換える)。

Service Definition: [dsh-workflow](../../packages/workflow/workflow) (`ctx.workflowEngine` と以下の語彙)。[dsh-workflow-ptc](../../packages/workflow/workflow-ptc) は、呼び出し元 Session のファイルポリシーの下で、共有の Node PTC プロセスランタイムを通じて VM とヘルパーを実行する。コンシューマーは [dsh-tool-workflow](../../packages/workflow/tool-workflow) とオプトインの [dsh-tool-ralph](../../packages/experimental/tool-ralph) である。[ワークフローサンドボックスの再利用](../../.agents/notes/implemented/architecture/2026-09-13-workflow-ptc-sandbox-reuse.md)が実行の選択肢を所有し、[dynamic-workflows リファレンス](../../packages/workflow/workflow/README.md)がスクリプトのセマンティクスを所有する。

ソース: ブラウザーセーフな語彙は [`packages/workflow/workflow/src/types.ts`](../../packages/workflow/workflow/src/types.ts) に、Host のリクエストとライブラン実行のハンドルは [`runtime-types.ts`](../../packages/workflow/workflow/src/runtime-types.ts) にある。

## 開始リクエスト

呼び出し元が実行を開始するときに要求するもの。通常の workflow ツールはこれをモデルの `{ script, meta, args }` 呼び出しと呼び出し元エージェントから組み立てる。特化したコンシューマーは実行のためにエンジン全体の 1 つの `subagentProvider` を選択し、`maxTotalAgents` を引き下げることもできるが、スクリプトはどちらのポリシーも観察も置き換えもできない。`meta` と `args` はプレーンな JSON DATA である (エンジンは `meta` をそのスキーマに対して検証し、何かが実行される前に大きな声で拒否する — それを得るためにスクリプトテキストが評価されることは決してない)。`parent` は必須である — スクリプトが起動するすべての子はそれに帰属し、cwd、系統、深さは [subagent シーム](subagent.md)を通る。

```ts type-equiv
/**
 * What a caller asks for when starting a workflow run. `meta` and `args` are
 * plain JSON data by the seam contract. `parent` is required because every
 * `agent()` spawned by the script is attributed to that live Agent.
 */
interface WorkflowStartRequest {
  /** The plain-JS script body (top-level await allowed; ends with `return <json-value>`). */
  script: string
  /** The workflow's identity block, as plain JSON data (shape-validated by the engine). */
  meta: WorkflowMeta
  /** Optional input exposed verbatim to the script as the `args` global. */
  args?: unknown
  /** Optional engine-wide child-provider override for this run. */
  subagentProvider?: string
  /** Optional per-run total-child ceiling. */
  maxTotalAgents?: number
  /** The agent on whose behalf the run executes (parent of every child). */
  parent: Agent
  /** Cancels the run when aborted. */
  signal?: AbortSignal
}
```

## ワークフローのアイデンティティ: `WorkflowMeta`

開始リクエストにデータとして運ばれるアイデンティティブロック (ツールの `meta` パラメーター。フィールド語彙は Claude Code dynamic-workflows の meta ブロックと一致する)。`phases` は進捗の語彙にすぎない: `phase()` 呼び出しはオブザーバー向けにタイトルを一致させるだけで、実行構造は何も含意しない。

```ts type-equiv
/**
 * The script's identity block, provided as plain JSON data alongside the
 * script body (the model-facing tool carries it as its `meta` parameter) and
 * validated by the engine before the body runs. `name`/`description` are
 * required; the rest is optional annotation. The field vocabulary matches the
 * Claude Code dynamic-workflows meta block.
 */
interface WorkflowMeta {
  /** Short kebab-case workflow name (display + persistence key). */
  name: string
  /** One-line description of what the workflow does. */
  description: string
  /** Optional guidance on when this workflow applies (shown in listings). */
  whenToUse?: string
  /** Optional phase declarations matched by `phase()` calls. */
  phases?: WorkflowPhase[]
}
```

## 終端結果: `WorkflowResult`

1 回の実行の結果であり、`WorkflowRun.result` によって解決される。`value` はスクリプトの実体化された戻り値 — プレーンな host レルムの JSON データ (スクリプトが何も返さなかった場合は `null`) — であり、`completed` の場合にのみ意味を持つ。`stopReason` は CLOSED なユニオンである (エンジン所有。コンシューマーはそれを網羅してよい): `completed` | `cancelled` | `error`。`completed` 以外の理由は失敗を `error` に運び、コンシューマーは部分的な出力を成功として報告するのではなく、それを `isError` ツール結果に写像する。

```ts type-equiv
/**
 * The outcome resolved by a live workflow run. `value` is
 * the script's materialized return value (plain host-realm JSON data; `null`
 * when the script returned `undefined`) — meaningful only for `completed`.
 * A non-`completed` reason carries the failure in `error`; the consumer maps
 * it to an `isError` tool result rather than reporting partial output.
 */
interface WorkflowResult {
  /** The script's return value (host JSON data; `null` for no return). */
  value: unknown
  /** Why the run settled. */
  stopReason: WorkflowStopReason
  /** The failure message (present iff `stopReason` is not `completed`). */
  error?: string
  /**
   * How many `agent()` calls the run accepted over its whole lifetime. On a
   * graceful settlement this is the script-side count (calls still queued for
   * a concurrency slot included); on a termination path (cancellation or
   * process failure) it degrades to the host-observed count — calls queued
   * inside a terminated script are unknowable then.
   */
  agentsStarted: number
}
```

## ライブラン: `WorkflowRun`

コンシューマーは `result` を await し、実行中に `cancel` してよく、すべての経路で `dispose` しなければならない。`result` は決して reject しない: スクリプトの失敗は `stopReason: 'error'` で、キャンセルは `'cancelled'` で解決する。PTC エンジンには全体の経過期限はない。キャンセルされると管理対象プロセスを即座に中断する。破棄は独立したワークフロー片付け期限なしに、それぞれのプロバイダー契約の下でプロセスと子の片付けを待つ。

```ts type-equiv
/**
 * Holder-owned live workflow. `result` never rejects; consumers may cancel
 * and must call idempotent `dispose()` to await script and child quiescence.
 */
interface WorkflowRun {
  readonly id: WorkflowRunId
  /** The validated meta block available before the script body runs. */
  readonly meta: WorkflowMeta
  readonly result: Promise<WorkflowResult>
  /** Cancel the run and its children. */
  cancel(reason?: string): void
  /** Cancel if needed and await script and child cleanup. */
  dispose(): Promise<void>
}
```

## 失敗の規律: `WorkflowError.fatal`

スクリプト内でのフックの誤用 — 不正な引数、未知/先送りされた `agent()` オプション、[structured-output サブセット](../../packages/core/tools/README.md)の外のスキーマ、上限への到達、シームの開始失敗、キャンセル — は `fatal: true` を持つ `WorkflowError` を投げる。`parallel()`/`pipeline()` コンビネーターは致命的エラーを `null` に写像する代わりに再スローする: タイポしたオプションはスクリプトを大きな声で殺さなければならず、通常の子の失敗として読めるものに溶解してはならない。項目ごとの `null` は子実行の失敗 (`completed` 以外の停止理由) と通常のステージ内スクリプトエラーのために予約されている。

## イベント

`workflow/*` イベント (`workflow/start`、`workflow/phase`、`workflow/log`、`workflow/agent-start`、`workflow/agent-end`、`workflow/end` — [イベントカタログ](#cordis-surface)を参照) は、DATA SNAPSHOTS を運ぶ **observe-only** の emit である: すべてのペイロードは `WorkflowRunInfo` (id + meta) で始まり、ライブの `WorkflowRun` では決してないので、サブスクライバーは `cancel`/`dispose` を得られない。`workflow/end` は意図的に結果値を省略する (結果を観察するリスナーが呼び出し元の結果の可変エイリアスを受け取ってはならない)。すべての emit はリスナーごとに封じ込められる — 投げるサブスクライバーはログに記録され、決して伝播されず、その後に登録されたリスナーを飢えさせることができない — そしてすべてのリスナーは自身のペイロードクローンを受け取るので、それを変更してもエンジンも他のリスナーも破壊しない。この封じ込めは `subagent/start`/`subagent/end` を鏡写しにする。

## 耐久 Chat レコード

最上位の `dsh-tool-workflow` コンシューマーは、実行の所有権を変えることなく、表示上の事実を呼び出し元の親 Session に射影する。実行が受け入れられた後に `tool-workflow/run-start` を書き込み、`runId + seq` でメンバーの開始と終了を対にし、結果が判明して破棄が静止に達した後にのみ `tool-workflow/run-end` を書き込む。ネストしたトランスポート呼び出しはレコードを書かない。最初の追記失敗はその実行の以後の書き込みを無効化するので、ログは空か法的な連続プレフィックスのままであり、ツール結果は変わらない。

レコードプロトコルは、実行ごとに 1 つの start、正で一意なメンバーシーケンス、対になったメンバー終了、開いたメンバーを持ったままの実行終了の禁止、および実行終了後の更新の禁止を許す。ログ末尾で欠落したメンバー終了または実行終了は、破損ではなく有効な中断の証拠である。

`dsh-client-ui-workflow-run` は 4 つのイベントを Conversation Node エンジンを通じて折り畳み、元の workflow ツールノードの後に、実行開始シーケンスにアンカーされた 1 つの `workflow-run` Chat ノードにする。フェーズグループは実際のメンバー開始からのみ生じ、省略されたフェーズと `''` の区別を含め、正確な文字列を保つ。クローズされた Location は、欠落した終端の事実を中断されたプレゼンテーションに変える。[UI パッケージ README](../../packages/client/ui-workflow-run/README.md)が開示、ステータス、および同一親のローカルナビゲーション動作を所有する。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される (doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。`pnpm run gen-cordis-catalog` で再生成)。言語版はロケール固有の対訳ドキュメントパスだけが異なる。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxworkflowengine--workflowengine-abstract-seam"></a>

### `ctx.workflowEngine` — `WorkflowEngine` (抽象シーム)

Workflow Service Definition の契約。無効なリクエストは公開前に投げる。ライブランは保持者所有であり、その結果は決して reject せず、破棄はスクリプトと子の片付けを待つ。ライフサイクルリスナーの失敗は封じ込められ、`workflow/end` は結果の確定とともにちょうど 1 回発火する。

```ts cordis-catalog
/**
 * Parse and execute a workflow script.
 * @param request - the script, its `args`, the parent agent, and an
 *   optional cancel signal.
 * @returns the live run; its `result` resolves when the script settles.
 */
abstract start(request: WorkflowStartRequest): WorkflowRun
```

ソース: [`packages/workflow/workflow/src/index.ts`](../../packages/workflow/workflow/src/index.ts)

<a id="workflow-events"></a>

### `workflow/*` events

<a id="workflowagent-end--emit"></a>

#### `workflow/agent-end` — emit

1 つの `agent()` 呼び出しが確定した (クリーンな結果、子の失敗、または実行のキャンセル)。`agent.seq` によって Events['workflow/agent-start'] と対になり、開始された呼び出しごとにすべての停止経路でちょうど 1 回発火する — エンジンの終了経路では、end は結果 `'cancelled'` でエンジンが合成する。

```ts cordis-catalog
/**
 * One `agent()` call settled (clean result, child failure, or run
 * cancellation). Paired with {@link Events['workflow/agent-start']} by
 * `agent.seq`, exactly once per started call on every stop path — on an
 * engine termination path the end is
 * engine-synthesized with outcome `'cancelled'`.
 * @param info - the run's identity snapshot.
 * @param agent - the call identity plus its outcome.
 * @mode emit
 */
'workflow/agent-end'(info: WorkflowRunInfo, agent: WorkflowAgentEndInfo): void
```

ソース: [`packages/workflow/workflow/src/index.ts`](../../packages/workflow/workflow/src/index.ts)

<a id="workflowagent-start--emit"></a>

#### `workflow/agent-start` — emit

1 つの `agent()` 呼び出しが公開された子実行を確立した。`agent.seq` によって Events['workflow/agent-end'] と対になる。プロバイダーから公開された実行を決して受け取らない呼び出しは、このペアのどちらのイベントも発火しない。

```ts cordis-catalog
/**
 * One `agent()` call established a published child run. Paired with
 * {@link Events['workflow/agent-end']} by `agent.seq`. A call that never
 * receives a published run from the provider emits neither
 * event in this pair.
 * @param info - the run's identity snapshot.
 * @param agent - the call's sequence number, label, phase, and child id.
 * @mode emit
 */
'workflow/agent-start'(info: WorkflowRunInfo, agent: WorkflowAgentInfo): void
```

ソース: [`packages/workflow/workflow/src/index.ts`](../../packages/workflow/workflow/src/index.ts)

<a id="workflowend--emit"></a>

#### `workflow/end` — emit

ワークフロー実行が確定した (任意の停止理由)。WorkflowRun.result が解決したときに発火する。Events['workflow/start'] と対になる。

```ts cordis-catalog
/**
 * A workflow run settled (any stop reason). Fired when
 * {@link WorkflowRun.result} resolves. Paired with
 * {@link Events['workflow/start']}.
 * @param info - the run's identity snapshot.
 * @param result - the outcome data (stop reason, error, agent count) —
 *   deliberately WITHOUT the result value (see {@link WorkflowResultInfo}).
 * @mode emit
 */
'workflow/end'(info: WorkflowRunInfo, result: WorkflowResultInfo): void
```

ソース: [`packages/workflow/workflow/src/index.ts`](../../packages/workflow/workflow/src/index.ts)

<a id="workflowlog--emit"></a>

#### `workflow/log` — emit

スクリプトがナレーション行 (`log(message)` 呼び出し) を出力した。

```ts cordis-catalog
/**
 * The script emitted a narration line (a `log(message)` call).
 * @param info - the run's identity snapshot.
 * @param message - the logged message, verbatim.
 * @mode emit
 */
'workflow/log'(info: WorkflowRunInfo, message: string): void
```

ソース: [`packages/workflow/workflow/src/index.ts`](../../packages/workflow/workflow/src/index.ts)

<a id="workflowphase--emit"></a>

#### `workflow/phase` — emit

スクリプトがフェーズに入った (`phase(title)` 呼び出し) — オブザーバー向けの進捗グルーピングであり、実行セマンティクスはない。

```ts cordis-catalog
/**
 * The script entered a phase (a `phase(title)` call) — progress grouping
 * for observers; no execution semantics.
 * @param info - the run's identity snapshot.
 * @param title - the phase title, verbatim.
 * @mode emit
 */
'workflow/phase'(info: WorkflowRunInfo, title: string): void
```

ソース: [`packages/workflow/workflow/src/index.ts`](../../packages/workflow/workflow/src/index.ts)

<a id="workflowstart--emit"></a>

#### `workflow/start` — emit

ワークフロー実行が開始した — スクリプトの meta ブロックが検証され、本体がまもなく実行される。Events['workflow/end'] と対になる。

```ts cordis-catalog
/**
 * A workflow run started — the script's meta block validated, the body
 * about to execute. Paired with {@link Events['workflow/end']}.
 * @param info - the run's identity snapshot (id + meta).
 * @mode emit
 */
'workflow/start'(info: WorkflowRunInfo): void
```

ソース: [`packages/workflow/workflow/src/index.ts`](../../packages/workflow/workflow/src/index.ts)
<!-- END GENERATED cordis-surface -->
