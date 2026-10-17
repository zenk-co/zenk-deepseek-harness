# ツール

日本語 | [English](tools.en.md) | [中文](tools.zh.md)

[dsh-tools](../../packages/core/tools) のツールパイプライン。[core.md](core.md) は `ToolDefinition` をコアパッケージ間で共有されるパイプライン記述用の型として導入している。モデル向けの [`ToolSchema`](llm-streaming.md#the-model-request-and-result) ワイヤ型はモデルリクエストとともに宣言される。このページではすべての `ToolDefinition` フィールド、それを構築する型付きスキーマ DSL、ガード付き実行型、UI 表示型を説明する。

Source: [`packages/core/tools/src/index.ts`](../../packages/core/tools/src/index.ts) · [`packages/core/tools/src/schema.ts`](../../packages/core/tools/src/schema.ts) · [`packages/core/tools/src/presentation.ts`](../../packages/core/tools/src/presentation.ts)

## `ToolDefinition` — 登録済みツール

`ToolSchema`（モデル向けフィールド）に必須の正規出力宣言、`execute` 関数、ホスト専用スケジューラーメタデータ、任意の最終コンテンツコールバック、任意の UI プレゼンターを加えたもの。レジストリがこれらを保持し、ループはこれらを通じて呼び出しをディスパッチする。レジストリの `schemas()` は明示的な許可リストでモデル向け `ToolSchema[]` を構築する — `output`/`execute`/`projectContent`/`finalizeContent`/`timeoutMs`/`isConcurrencySafe`/`presentCall`/`presentResult` をモデルリクエストに漏らしてはならない。

```ts type-equiv
/** Tool-owned canonical output contract used after the body returns a JSON value. */
interface ToolOutputDefinition {
  /** Raw supported JSON Schema enforced against every successful canonical value. */
  readonly schema: JsonSchemaNode
  /** Pure projection from validated arguments and value to Native/model content. */
  render(args: unknown, value: JsonValue): ContentBlock[]
  /** Pure replayable presentation projection for native and nested calls. */
  presentationMeta?(args: unknown, value: JsonValue): JsonValue
}
```

```ts type-equiv
/** A registered tool: its schema plus the execution function. */
interface ToolDefinition extends ToolSchema {
  /** Mandatory canonical output declaration. */
  readonly output: ToolOutputDefinition
  /**
   * Run one accepted call and return only its canonical lossless-JSON value.
   * Async work must observe or forward `exec.signal` and settle only after its
   * owned work reaches quiescence. The registry preserves caller cancellation
   * through around-dispatch signal replacement and does not abandon this
   * promise, but it cannot hard-kill same-process code.
   * @param args - losslessly snapshotted, frozen model arguments.
   * @param exec - execution identity, cancellation signal, and context deferral.
   * @returns the canonical value declared by `output.schema`.
   */
  execute(args: unknown, exec: ToolRunContext): Promise<unknown>
  /**
   * Install execution-prepared content before `tools/post-execute` policies.
   * The callback is captured when the call starts and runs once for a
   * normalized outcome entering post-execute. Policy replacements remain
   * authoritative; pipeline failures that bypass post-execute skip projection.
   * @param exec - immutable execution identity and arguments.
   * @param result - normalized result before post-execute policy.
   * @returns replacement content, or undefined to preserve the renderer output.
   */
  projectContent?(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): ContentBlock[] | undefined
  /**
   * Synchronous last-mile transform for model-facing content. The registry
   * snapshots this callback when execution starts and invokes it exactly once
   * for every normalized outcome, including pipeline failures that bypass
   * `tools/post-execute`, immediately before lossless materialization.
   * Returning `undefined` preserves the content; every other result field
   * remains registry-owned. The callback must be total and must not throw.
   * @param exec - immutable execution identity and arguments.
   * @param result - complete normalized outcome before materialization.
   * @returns replacement content, or `undefined` to preserve it.
   */
  finalizeContent?(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): ContentBlock[] | undefined
  /**
   * Cooperative tool-call timeout budget in milliseconds. Omit for no deadline.
   * Enforced by `@deepseek-ai/dsh-tool-call-timeout-policy` (a `tools/execute` wrapper); it
   * is NEVER sent to the model — `schemas()` whitelists only name/description/
   * parameters. Declaring it asserts this tool forwards `exec.signal` to a
   * cooperative implementation that can reach quiescence when the signal aborts.
   */
  timeoutMs?: number
  /**
   * Pure synchronous classifier for overlap with sibling tool calls. Only
   * `true` opts in; omission, exceptions, non-`true` returns, and invalid
   * `defineTool` arguments are exclusive. This metadata is never model-visible.
   *
   * Opted-in executions must not mutate parent-owned state. Shared state must
   * tolerate concurrent dispatch; recorder races are permitted only when they
   * commute or fail closed. See the
   * [parallel-tool-call Agent Note](../../../../.agents/notes/implemented/feature/2026-07-10-parallel-tool-call-execution.md)
   * for the full contract.
   * @param args - parsed arguments; `defineTool` validates before calling.
   * @returns Whether this call may join a parallel group.
   */
  isConcurrencySafe?(args: unknown): boolean
  /**
   * Optional: how to present the PENDING state of one call in a UI, derived from
   * the call's `args` (parsed arguments, `unknown` — the tool validates/narrows
   * its own input). Returns a {@link ToolCallView} (a `card`-tagged render intent),
   * or `undefined` (or omit the method) to fall back to a generic presentation
   * (title = tool name, raw args as input). Pure and side-effect-free: a UI may
   * call it during live streaming AND a session-log replay, so it must depend
   * only on `args`.
   */
  presentCall?(args: unknown): ToolCallView | undefined
  /**
   * Optional: how to present the COMPLETED state, given the same `args` and the
   * durable result projection (`content`, failure state, and optional `meta`). Returns a
   * {@link ToolResultView}, or `undefined` (or omit the method) to keep the
   * pending title and render the raw result content. Pure and side-effect-free
   * for the same replay reason.
   */
  presentResult?(args: unknown, result: ToolResult): ToolResultView | undefined
}
```

`execute` は `args: unknown` を受け取る — 素の `ToolDefinition` は自身の入力を検証する。ファーストパーティのツールはこれを手書きせず、`defineTool` を使う。これは引数を検証して絞り込み、`output.schema` から本体の戻り値を推論し、両方の出力プロジェクターに型を付ける。`finalizeContent` は型付き引数ではなく不変の実行情報を意図的に受け取る。不正入力や外側パイプラインの失敗もここに届くためであり、`isError`、正規値、構造化エラー同一性、遅延コンテキスト、表示メタデータを保ちながらツール所有のコンテンツ上限を強制できる。

## 統一 JSON 値スキーマ DSL

プラグイン作者は型付きパラメーターと型付き出力値に1つの語彙を使う。`ValueSchemaSpec` は `string`、`number`、`integer`、`boolean`、`null`、`array`、`object`、作者専用の `json`、厳密に1つの `oneOf` をサポートする。スカラーの `enum` と `const` の値はノード型と一致しなければならない。明示的なオブジェクトノードは必ず `additionalProperties: true | false` を宣言する。パラメーター定義は暗黙のオープンなオブジェクトプロパティマップのままで、必須プロパティごとに `required: true` を付ける。

Source: [`packages/core/tools/src/schema.ts`](../../packages/core/tools/src/schema.ts)

```ts type-equiv
/** One author-facing schema for any lossless JSON value root. */
type ValueSchemaSpec =
  | StringValueSchemaSpec
  | NumberValueSchemaSpec
  | IntegerValueSchemaSpec
  | BooleanValueSchemaSpec
  | NullValueSchemaSpec
  | ArrayValueSchemaSpec
  | ObjectValueSchemaSpec
  | JsonValueSchemaSpec
  | OneOfValueSchemaSpec
```

```ts type-equiv
/** One implicit parameter-root property, optionally required. */
type ParameterPropertySpec = ValueSchemaSpec & { required?: true }
```

```ts type-equiv
/**
 * Tool parameter schema. The map itself is an implicit open object root;
 * requiredness remains a per-property `required: true` annotation.
 */
type ParameterSchemaSpec = {
  [key: string]: ParameterPropertySpec
  [key: symbol]: never
}
```

`{ type: 'json' }` は `JsonValue` に推論され、注釈のみの無制約 raw スキーマにコンパイルされる。出力ルートはオブジェクト、配列、スカラー、null のいずれにもできる。`InferValue<S>` は16コンテナレベルまでリテラル制約とオブジェクトの開放性を尊重し、その後は TypeScript の型インスタンス化スタックを使い果たす代わりに `JsonValue` にフォールバックする。`InferArgs<P>` はプロパティごとの必須性を必須および任意の文字列キーに変換する。

```ts type-equiv
/**
 * Infer the TypeScript value accepted by an author-facing value schema. Exact
 * inference is bounded to 16 container levels, then falls back to `JsonValue`.
 */
type InferValue<S> = InferValueAt<S, []>
```

```ts type-equiv
/** Infer the TypeScript argument object for an implicit parameter schema. */
type InferArgs<S> = InferProperties<S, []>
```

`defineTool({ name, description, parameters, output, execute, … })` はパラメーター推論を `parameterSchemaSpecToJsonSchema()` と `validateArgs()` に結び付け、`execute`/`render`/`presentationMeta` を `InferValue<OutputSchema>` に結び付ける。スキーマレコードは自身の列挙可能な文字列キーのみを含み、スキーマ配列は密な組み込み配列であるため、推論、コンパイル、検証は同じ宣言を参照する。推論は16コンテナレベルまで厳密で、その後は `JsonValue` に拡大する。ランタイム検証はスキーマ全体をたどり続ける。`valueSchemaSpecToJsonSchema()` は出力宣言を同じ強制 raw サブセットでコンパイルする。パラメーター不一致は `ToolArgsError`（`INVALID_ARGS`）を投げ、不正な本体やポストポリシー値は `ToolOutputError`（`INVALID_TOOL_OUTPUT`）を投げる。どちらも通常のツールエラーパスを使う。Raw JSON Schema は既定でオープンのまま。未サポートのキーワードは強制なしに受け入れられるのではなく拒否される。

登録は信頼された同一プロセス内の契約である。レジストリは型付き定義を読み取り専用入力として借用し、`output` を必須とし、その raw スキーマを検証し、正の有限な `timeoutMs` などの意味要件を確認する。`schemas()` はリクエスト構築時にモデル向けプロジェクションを構築するため、実行と表示はコールバックをワイヤ上に漏らすことなく1つの解決済み定義を共有する。

## `ToolRestriction` — 継承に対するスコープごとのライブフィルター

`ToolRestriction` はスコープが継承するツールに適用される。デプロイ全体のグローバル層にチェーン上のすべての祖先スコープを加えたものが対象である。レジストリは読み取り専用名をプライベート集合にコンパイルし、複数の制限を交叉させ、その後にスコープ自身の登録を重ねる。自身の登録は除外対象外のままなので、委譲された子は応答に使うツールを保持する。拒否のみのフィルターは後に追加された未掲載の継承ツールを許容し、許可リストはそれらを除外する。

```ts type-equiv
/**
 * Per-scope filter over global tools. Restrictions intersect and do not affect
 * scoped registrations or the reserved PTC mode transport.
 */
interface ToolRestriction {
  /** Global tool names that stay visible; everything else is removed. */
  readonly allow?: readonly string[]
  /** Global tool names removed from visibility. */
  readonly deny?: readonly string[]
}
```

## 実行: 拡張可能なウォーターフォールと単調ポリシー

`ctx.tools.execute()` は呼び出し元所有の `ToolExecutionInput` を受け取る。必須の読み取り専用 `signal` を持ち、解析済み JSON 引数を1回だけパイプライン所有の `ToolExecution` に実体化し、その呼び出しを `tools/pre-execute`（並べ替え可能な allow/deny/ask ウォーターフォール）→ 登録済み単調ガード → `tools/execute`（ディスパッチ包囲ラッパー）→ `projectContent` → `tools/post-execute`（結果の検査/置換）→ 任意の定義所有 `finalizeContent` → `tools/result`（不変の権威ある結果）の順に実行する。必須シグナルを置換できるのは `tools/execute` ビューのみである。結果は `ToolExecutionResult` である。

```ts type-equiv
/** Opaque call identity that permits correlation without exposing mutable execution state. */
type ToolExecutionToken = symbol & { readonly [toolExecutionTokenBrand]: true }
```

```ts type-equiv
/**
 * Caller-supplied description of one tool call. {@link ToolRuntime.execute}
 * adds the registry-owned token to form a pipeline {@link ToolExecution};
 * callers do not choose that token.
 */
interface ToolExecutionInput {
  readonly callId: ToolCallId
  /**
   * Root model-requested call owning this execution tree. Callers omit it for
   * a root execution; nested dispatchers propagate the enclosing value.
   */
  readonly rootCallId?: ToolCallId
  readonly name: string
  /** Binding-time tool schema for a PTC inner call; frozen by its producer and never logged. */
  readonly schema?: ToolSchema
  /** Losslessly JSON-serializable parsed arguments (tools validate their own schema). */
  readonly arguments: unknown
  /** The agent on whose behalf the call runs (set by the agent loop). */
  readonly agent?: Agent
  /**
   * Opaque token of the enclosing transport execution, when one exists. PTC
   * mode sets this on SDK sub-dispatches so commit-style observers can wait for
   * the outer `run_code` outcome without receiving its live mutable execution.
   * The token also marks the call as a transport sub-dispatch rather than a
   * model-direct call: under `mode: 'ptc'`, only calls WITH a parent may
   * execute a native tool name — a model-direct call (no parent) is denied as
   * `UNKNOWN_TOOL` before the policy pipeline. See {@link ToolRuntime.execute}.
   */
  readonly parent?: ToolExecutionToken
  /** Required caller-owned cancellation for this invocation. */
  readonly signal: AbortSignal
}
```

ツール本体はランタイム拡張を受け取る。`deferContext()` はコンテキストをその実行自身の結果に付加する — 複合ツールの入れ子ディスパッチチャネルであり、プラグイン由来命令を新たに発行するリーフツールも使える — まだ開いている外側呼び出しの内部には注入しない。

```ts type-equiv
/**
 * Runtime context handed to a tool implementation after the registry has
 * accepted a {@link ToolExecution}. {@link deferContext} attaches context to
 * this execution's own result — a composite tool ferries nested-dispatch
 * context back to the outer result, and a leaf tool may mint a fresh
 * plugin-sourced instruction; the loop appends it only after the
 * `tool/result`.
 */
interface ToolRunContext extends ToolExecution {
  /**
   * Defer one context — typically a nested-dispatch context ferried by a
   * composite tool, or a fresh plugin-sourced instruction — until this tool's
   * final result reaches the agent loop. Contexts retain their individual
   * source and metadata and are emitted in call order.
   */
  deferContext(context: UserMessage): void
  /**
   * Mark a successful final result as terminal for the current agent turn.
   * The marker rides this execution's own result (`concludesTurn` exists only
   * on {@link ToolExecutionSuccess}); a composite that dispatches nested
   * calls forwards it from the nested result, exactly like
   * `additionalContexts`, so only an authoritative nested success can
   * conclude the enclosing run.
   */
  concludeTurn(): void
}
```

エージェントループは保留中の各呼び出しの実行モードをレジストリに問い合わせ、それを使って排他バリアとローリングプールの並列実行を構成する。

```ts type-equiv
/**
 * Scheduling mode for one pending call. `parallel` may overlap with siblings;
 * `exclusive` runs alone and forms an ordering barrier.
 */
type ToolExecutionMode =
  | { kind: 'parallel' }
  | { kind: 'exclusive' }
```

PTC バインディングは構築時に ToolSchema を凍結し、スケジューラーを通じて `ToolExecution.schema` に渡す。これは一過性の実行メタデータである。ポリシー前に、実際に開始された各サブディスパッチはペアリング ID、名前、正規化引数のみを記録する。開始イベントも確定イベントも説明、パラメーター、スキーマを直列化しない。ブリッジは後に確定した呼び出しを `tools/ptc-dispatch-log` ウォーターフォールに公開する。これはプログラム値、モデル可視の外側結果、構造化失敗同一性を保ちながら永続コンテンツコピーを変更できる。

```ts type-equiv
/**
 * One settled `run_code` sub-dispatch about to be logged, as seen by the
 * `tools/ptc-dispatch-log` waterfall: the parent execution (session owner,
 * outer call identity), the sub-call identity, and the outcome whose durable
 * copy a listener may reshape. `content` is the RENDERED result projection
 * (what a native `tool/result` would carry) — the program itself received
 * the structured `value` (or just the error message on failure); only the
 * `tool/ptc-dispatch` event's copy changes.
 */
interface PtcDispatchLog {
  /** The outer `run_code` execution. */
  readonly exec: ToolExecution
  /** The calling agent (the scope routing key and the spill owner), when the outer call has one. */
  readonly agent?: Agent
  /** Opaque sub-call id; new calls use `<parent>:ptc:<n>`. */
  readonly subCallId: ToolCallId
  /** The dispatched sub-tool name. */
  readonly name: string
  /** Whether the sub-call settled as an error. */
  readonly isError: boolean
  /** The sub-call's complete model-facing content (the settle event's default payload). */
  readonly content: ContentBlock[]
}
```

```ts type-equiv
/**
 * One pending tool call inside the registry pipeline. Parsed arguments cross
 * one lossless-JSON materialization boundary before policy and are deep-frozen;
 * call identity, the caller signal, and the registry-assigned {@link token} are
 * readonly. The registry freezes the complete object before `tools/result`
 * observers run.
 */
interface ToolExecution extends ToolExecutionInput {
  /** Root model-requested call, resolved for every root and nested execution. */
  readonly rootCallId: ToolCallId
  /** Registry-assigned identity shared with nested calls only as their opaque `parent` token. */
  readonly token: ToolExecutionToken
}
```

```ts type-equiv
/**
 * Around-dispatch view of a {@link ToolExecution}. A `tools/execute` wrapper
 * may replace the signal for its delegated lifetime, but it cannot remove it.
 * The registry fuses every replacement with the captured caller signal.
 */
interface ToolDispatchExecution extends Omit<ToolExecution, 'signal'> {
  /** Cancellation signal visible to the next wrapper or tool body. */
  signal: AbortSignal
}
```

`ToolExecutionToken` は同一性比較にのみ使う不透明なランタイム `Symbol` である。ポリシー前に `execute()` は引数を実体化して凍結し、非 JSON 入力を拒否し、トークンを割り当てる。同一性フィールド、必須の呼び出し元シグナル、任意の親トークンは読み取り専用のままである。`ToolDispatchExecution` ラッパーはシグナルを置換できるが削除はできない。レジストリは本体呼び出し前に呼び出し元シグナルを再融合する。最終オブザーバーは凍結された実行同一性を受け取る。

`ToolGuard` はスコープ対応の最終ディスパッチ前ポリシーである。その戻り型には意図的に許可結果がない。`undefined` はウォーターフォール決定を維持し、返された理由は権限を縮小する方向にしか働かないため、後のリスナーがそれを取り消すことはできない。

```ts type-equiv
/**
 * A monotonic execution guard evaluated after every `tools/pre-execute`
 * listener and before the tool body. Returning a reason denies the call;
 * returning `undefined` leaves it unchanged. Because guards have no allow
 * result, listener ordering cannot turn a denial back into permission.
 * @param execution - the identity-protected call after extensible pre-execute policy completed.
 * @returns a final denial reason, or `undefined` to leave the call allowed.
 */
type ToolGuard = (execution: Readonly<ToolExecution>) => string | undefined
```

```ts type-equiv
/** Canonical failure detail; internal routing information remains optional. */
interface ToolFailure {
  /** Human-readable failure message without the Native `Error: ` envelope. */
  message: string
  /** Internal error class/code used by policy and durable diagnostics. */
  info?: ToolErrorInfo
}
```

```ts type-equiv
/** Successful canonical tool execution, including its Native/model projection. */
interface ToolExecutionSuccess {
  readonly isError: false
  /** Execution-local canonical value; deliberately omitted from durable events. */
  readonly value: JsonValue
  readonly content: ContentBlock[]
  readonly error?: never
  readonly meta?: JsonValue
  readonly additionalContexts?: UserMessage[]
  /** The agent loop stops after committing this successful result batch. */
  readonly concludesTurn?: true
}
```

```ts type-equiv
/** Failed canonical tool execution; failures never carry a successful value. */
interface ToolExecutionFailure {
  readonly isError: true
  readonly error: ToolFailure
  readonly value?: never
  readonly content: ContentBlock[]
  readonly meta?: JsonValue
  readonly additionalContexts?: UserMessage[]
  readonly concludesTurn?: never
}
```

```ts type-equiv
/** The discriminated, execution-local outcome of one tool call. */
type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionFailure
```

```ts type-equiv
/** Structured error metadata for a failed tool call (alongside the model-facing text). */
interface ToolErrorInfo {
  name: string
  code: string
  /** Optional raw user-facing detail; durable projections preserve it but model-facing content does not include it. */
  reason?: string
}
```

結果が運ぶのは結果のみである。呼び出し同一性はすべてのフックを通じて同伴する不変の `ToolExecution` 上と、永続の `tool/call` / `tool/result` セッションイベント上に残るため、ラッパーが食い違う第2の同一性を作ることはできない。正規の `value` は実行ローカルである。ループは `content`、`error`、`meta` のみを永続化し、`tool/ptc-dispatch` はサブ呼び出しの描画済み `content`、`isError`、任意の構造化 `error`、表示 `meta` を格納する。リプレイは表示を再現するが正規の中間値は復元できない。任意の `ToolErrorInfo.reason` は生のユーザー向け詳細を保持するが、モデル向けコンテンツには加えない。

成功時、レジストリは本体値をスナップショットして検証し、凍結し、ネイティブおよび入れ子呼び出し向けに純粋レンダラーと任意の表示メタデータプロジェクターを呼び出す。`tools/result` の直前に永続表示フィールドを別途実体化する。不正な値、レンダラー/プロジェクターの失敗、非 JSON 表示は JSON 安全な `isError` になる。したがって最終ライブオブザーバーは、後の永続追記に安全なフィールドと並んで厳密な実行ローカル値を参照する。

最終コンテンツの前に、レジストリは候補結果を実体化する。コンテンツ、構造化エラー、追加コンテキスト、表示メタデータの失敗は JSON 安全な `isError` 結果になり、それでも `finalizeContent` に届く。レジストリはそのコールバックを厳密に1回呼び出し、その後受け入れ結果を `tools/result` の直前に実体化して凍結するため、観測されるライブ結果は後の永続 `tool/result` 追記に安全である。

各介入ウォーターフォールは型付き **Decision** を返す（`agent/*` ウォーターフォールと共有される慣用句）。`tools/pre-execute` リスナーは `(exec, next)` を受け取り `PreToolDecision` を返し、`tools/execute` ラッパーは `ToolExecutionResult` を返し、`tools/post-execute` リスナーは `(exec, result, next)` を受け取り `PostToolDecision` を返す。

```ts type-equiv
/**
 * Pre-dispatch decision. `allow` runs the call; `deny` materializes its
 * model-facing reason and optional structured error identity; `cancel` selects
 * the canonical cancellation result without presenting a policy denial; `ask`
 * runs only after an approval service returns `allowed-once` and otherwise
 * denies; its `reason` is the audited approval reason and its optional
 * `displayReason` is the localized prompt text. Input rewriting is excluded because arguments are already logged and
 * presented.
 */
type PreToolDecision =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string; info?: ToolErrorInfo }
  | { kind: 'cancel' }
  | { kind: 'ask'; reason?: string; displayReason?: { readonly en: string; readonly [locale: string]: string } }
```

```ts type-equiv
/**
 * Post-dispatch decision: accept, replace one projection, attach context for the
 * next request, or block by turning corrective feedback into an error result.
 */
type PostToolDecision =
  | { kind: 'accept'; content?: ContentBlock[]; value?: never; additionalContexts?: UserMessage[] }
  | { kind: 'accept'; value: JsonValue; content?: never; additionalContexts?: UserMessage[] }
  | { kind: 'block'; feedback: ContentBlock[]; additionalContexts?: UserMessage[] }
```

既定には `next()` を呼び出し、短絡には決定を返す。事前ポリシーは拒否または問い合わせができる。進行するのは `allowed-once` のみであり、非付与、承認チャネルやサービスの欠落、エージェントなしリクエストは拒否になる。拒否はモデル向け理由を変えずに構造化同一性とユーザー向け詳細を付加できる。ガードは依然として最終拒否を課せる。履歴、監査、UI、実行の一致が必要なため引数は書き換えできない。

事後ポリシーはコンテンツまたは値のどちらかを置換でき、両方はできない。コンテンツ置換は正規値と既存メタデータを保持し、値置換は再検証されてコンテンツ/メタデータを再計算し、ブロックは値を除去して修正フィードバックを含む `isError` になる。コンテンツ置換は表示ポリシーであり機密性ポリシーではない。プログラム値を隠す必要があるリスナーはブロックまたは置換する。`tools/result` は正規化後の凍結された実行と結果を受け取る。オブザーバーはそれらを変換できず、オブザーバーの失敗は封じ込められる。不明ツールと例外ツールはどちらも構造化エラーになる（`ToolNotFoundError` は `UNKNOWN_TOOL` に対応する）ため、呼び出しはターンを終了させずに失敗する。

## 強制される raw JSON Schema サブセット

サブエージェント、ワークフロー、MCP、動的登録からの raw スキーマは、作者 DSL のワイヤレベル対応物を使う。`assertSupportedJsonSchema()` は任意の JSON ルートを受け入れ、`validateJsonSchemaValue()` はそれを強制し、`JsonSchemaError` は未サポートまたは不正なスキーマパスをすべて報告する。空の注釈のみノードは無制約のロスレス JSON を意味する。`oneOf` は少なくとも2分岐を要求し、値は厳密に1つに一致しなければならない。依然としてオブジェクトルートを要求するコンシューマーは `assertObjectJsonSchema()` を呼び出し `ObjectJsonSchema` を運ぶ。こうしてサブエージェント/ワークフローの呼び出し元定義の構造化出力は、共有語彙を制限せずオブジェクトルートのままである。

```ts type-equiv
/** Scalar JSON values supported by `enum` and `const`. */
type JsonSchemaScalar = string | number | boolean | null
```

```ts type-equiv
/** Single-type keywords accepted by the enforced subset. */
type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null'
```

```ts type-equiv
/**
 * One raw JSON Schema node in the enforced subset. The optional fields express
 * the external wire schema; {@link assertSupportedJsonSchema} rejects invalid
 * combinations before a caller treats the node as trusted.
 */
interface JsonSchemaNode {
  /** Omit with no constraints for any JSON value, or use `oneOf`. */
  type?: JsonSchemaType
  /** Exactly one branch must validate; at least two branches are required. */
  oneOf?: JsonSchemaNode[]
  /** Nested property schemas (`type: 'object'` only). */
  properties?: Record<string, JsonSchemaNode>
  /** Required property names; each must appear in `properties`. */
  required?: string[]
  /** `false` rejects undeclared keys; absent/`true` follows JSON Schema's open default. */
  additionalProperties?: boolean
  /** Item schema (`type: 'array'` only); absent accepts any JSON item. */
  items?: JsonSchemaNode
  /** Allowed values for a scalar node. */
  enum?: JsonSchemaScalar[]
  /** The single allowed value for a scalar node. */
  const?: JsonSchemaScalar
  /** Annotation, ignored for validation. */
  description?: string
  /** Annotation, ignored for validation. */
  title?: string
  /** Annotation, ignored for validation but required to be lossless JSON. */
  default?: JsonValue
  /** Annotation, ignored for validation but required to be lossless JSON. */
  examples?: JsonValue
}
```

```ts type-equiv
/** A consumer-constrained object-rooted schema. */
type ObjectJsonSchema = JsonSchemaNode & { type: 'object' }
```

## ツール表示 UI ボキャブラリー

ツールが自身の呼び出しを UI（エディターのツール呼び出しカード、CLI ログ行）にどう表示したいかを、プロバイダー中立に記述する。ツールはクライアントプロトコルに依存せず自身を記述できる。`presentCall`/`presentResult` は **`card` タグ付き描画意図** — UI ブリッジが切り替える判別共用体 — を返す。

- `ToolCallView`（保留中）: `{ card: 'generic', title, kind?, rawInput?, content?, locations? }`（既定カード。`locations` は呼び出しが読み書きするファイルの `{ path, line? }[]` で、エディター追従用）、`{ card: 'terminal', title, description?, cwd? }`（シェルコマンド → ターミナルカード）、または `{ card: 'diff', title, diffs, locations? }`（ファイル作成/変更 → インライン差分カード。`diffs` は `{ path, oldText, newText }[]` で、新規ファイルでは `oldText: null`）。
- `ToolResultView`（完了）: `{ card: 'generic', title?, content? }`、`{ card: 'terminal', title?, output?, exitCode?, signal? }`（捕捉した実行出力＋終了。対応 UI は終了ステータスピルを表示し、他はフェンス付き ` ```console ` フォールバックを導出できる）、`{ card: 'diff', title?, diffs }`（完了したファイル変更 → 表示すべき変更。通常は変更前後内容から計算したコンテキスト行付き適用ハンク、変更前イメージがなければファイル全体差分）、`{ card: 'search', shape, title?, truncated, total, … }`（完了した探索検索 → `shape: 'matches'`（grep）ならファイル別グループ化一致、`shape: 'paths'`（glob）ならフラットパス一覧。`truncated`/`total` はインライン結果が上限打ち切りかを報告するため UI が部分結果を完全として提示しない。ビューは結果テキストを運ばない — 検索カードなし UI は raw 結果コンテンツにフォールバックする）、`{ card: 'read', title?, path, offset, lines, totalLines, lang?, content? }`（完了したファイル読み取り → 行番号付きで任意に構文強調したコードビュー。`offset` はウィンドウが要求した1始まり先頭行で `lines` が空でも保持される。`lang` は拡張子由来の言語ヒント、`content` は読み取り対応なし UI がフォールバックするエンベロープ除去テキスト）、または `{ card: 'web', kind: 'search' | 'fetch', title?, … }`（完了したウェブ取得。`kind: 'search'` は構造化 `sources`/`answer?`/`truncated` を運び、`kind: 'fetch'` は `url`/`statusCode`/`truncated` を運ぶ。`web` 機能なし UI は raw 結果コンテンツにフォールバックする — 本体はビューに重複しない）。完了ビューは保留ビューを置換するため、変更ツールは呼び出し時スニペットと重複しても差分結果を返す。検索とウェブ取得には `card` の呼び出し時対応物がない（構造化結果は `execute` 後にのみ存在するため保留状態は汎用カードのまま）。

`ToolCallKind`（`'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'fetch' | 'other'`）は汎用カード上のアイコンを選ぶ。`FileLocation`（`{ path, line? }`）、`FileDiff`（`{ path, oldText, newText }`）、`ReadFileLine`（`{ number, text }`、読み取りウィンドウの1始まり番号付き1行）は共有ファイルカード語彙である。設計は [render-intent-union Agent Note](../../.agents/notes/implemented/architecture/2026-07-02-tool-render-intent-union.md) に固定されている。ホスト/クライアントランタイムはこの中立語彙を各自のビューに投影する。

表示フィールドの完全な説明は [`packages/core/tools/src/presentation.ts`](../../packages/core/tools/src/presentation.ts) にある。`bash` スキーマと実行器は [shell.md](shell.md)、汎用バックグラウンド制御は [jobs.md](jobs.md) を参照。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成される（doc-sync 内の `pnpm run verify-cordis-catalog` で鮮度を検証、`pnpm run gen-cordis-catalog` で再生成）。言語面の差異はロケール固有の対訳文書パスのみである。署名ブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは [primer](../cordis-primer.md#dispatch-modes) で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxtools--toolruntime"></a>

### `ctx.tools` — `ToolRuntime`

ツールレジストリと実行パイプライン。スコープ登録はグローバルを隠蔽する。1つの可視性リゾルバーが表示、検索、ディスパッチに供給する。

```ts cordis-catalog
/**
 * Present the calling scope's tools in `mode` instead of the deployment
 * default. Nearest scope on the chain wins, so a preset's standing
 * declaration covers every agent joined under it.
 *
 * Scoped only, and one declaration per scope: this is how an agent preset
 * composes PTC mode agents beside native ones in the same process, and a
 * process-global override would be the `mode` config field instead.
 * @param mode - the presentation the covered agents' models see.
 * @returns the exact disposer that restores the deployment default.
 */
presentAs(mode: ToolPresentationMode): () => void

/**
 * Register globally or in the calling agent scope. Scoped tools shadow
 * globals; duplicates within one layer and the reserved `run_code` name fail.
 * @param definition - tool schema, execution, and optional finalization/presentation callbacks.
 * @returns the exact disposer that unregisters the tool.
 */
register(definition: ToolDefinition): () => void

/**
 * Restrict global tools for the calling agent scope. Empty filters, unknown
 * names, scope-local names, and reserved transport names fail. Restrictions
 * intersect; scoped registrations remain visible.
 * @param filter - global-tool mask: `allow` (keep only) and/or `deny` (remove).
 * @returns the exact disposer that lifts this restriction.
 */
restrict(filter: ToolRestriction): () => void

/**
 * Register a monotonic guard after the extensible `tools/pre-execute`
 * waterfall. A plain-context guard applies globally; one registered through
 * `agent.ctx` applies only to that agent. Any matching guard may deny by
 * returning a reason, while no guard can force-allow a call another guard
 * denied. The exact effect disposer is returned for ordered ownership and
 * HMR cleanup.
 * @param guard - synchronous check; a returned string denies the execution.
 * @returns the exact disposer that unregisters the guard.
 */
guard(guard: ToolGuard): () => void

/**
 * Look up a tool as one scope sees it (scoped
 * shadows global; a restricted-away global reads as absent). Presenters pass
 * the calling agent so the rendered card matches the definition that
 * actually executed.
 * @param name - the tool name as registered.
 * @param scope - the viewing scope (the agent); omitted = the global view.
 * @returns the definition the scope resolves, or undefined when none is visible.
 */
get(name: string, scope?: ScopeKey): ToolDefinition | undefined

/**
 * Project visible definitions onto the allowlisted model-facing schema fields,
 * excluding execution and presentation callbacks.
 * @param scope - the viewing scope (the agent); omitted = the global view.
 * @returns one deep-cloned schema per visible tool.
 */
schemas(scope?: ScopeKey): ToolSchema[]

/**
 * Classify a pending call through the caller's visible tool definition. Only
 * an exact `true` is parallel; unknown, hidden, undeclared, invalid, or
 * throwing classifiers are exclusive.
 * @param exec - call name, parsed arguments, and optional agent scope.
 * @returns the fail-closed scheduling mode.
 */
executionMode(exec: ToolExecutionInput): ToolExecutionMode

/**
 * Execute through pre-policy, guards, around-dispatch, post-policy,
 * definition-owned content finalization, and final notification. Tool and
 * listener failures resolve as materialized error results; an invisible tool
 * reports `UNKNOWN_TOOL`. The returned outcome is the same lossless, frozen
 * snapshot final observers receive. Cancellation
 * arriving after entry and before final result materialization skips a
 * not-yet-started body with `ABORTED_BEFORE_DISPATCH` or replaces a
 * successful started outcome with `ABORTED`; already-started work is still
 * drained and may retain a tool-owned structured error.
 * @param exec - the typed same-process call input. The registry assigns its
 *   correlation token before policy begins.
 * @returns the materialized final result.
 */
async execute(exec: ToolExecutionInput): Promise<ToolExecutionResult>
```

Types: [ScopeKey](scope.md)

Source: [`packages/core/tools/src/index.ts`](../../packages/core/tools/src/index.ts)

<a id="tools-events"></a>

### `tools/*` events

<a id="toolschange--emit"></a>

#### `tools/change` — emit

ツールが登録または登録解除された、あるいはスコープ付き制限が変更された（利用可能ツール集合が変更された — 1つのスコープのみの可能性もある）。UNFILTERED なレジストリ主体通知であり、意図的にスコープフィルター済みディスパッチではない。グローバル変更はすべてのエージェントの次回アセンブリに関わるため、ここに購読するスコープ付きリスナーは自身のスコープだけでなくすべての変更を参照する。

```ts cordis-catalog
/**
 * A tool was registered or unregistered, or a scoped restriction changed
 * (the available tool set changed — possibly for one scope only). An
 * UNFILTERED registry-subject notification, deliberately not scope-filtered
 * dispatch: a global change concerns every agent's next assembly, so a
 * scoped listener subscribing here sees every change, not just its own
 * scope's.
 * @mode emit
 */
'tools/change'(): void
```

Source: [`packages/core/tools/src/index.ts`](../../packages/core/tools/src/index.ts)

<a id="toolsexecute--waterfall"></a>

#### `tools/execute` — waterfall

タイムアウト、再試行、メトリクス用のディスパッチ包囲ウォーターフォール。`next()` は正規化結果を返す。ラッパーが変更できるのは `exec.signal` のみであり、呼び出し同一性は不変のままである。レジストリは本体前に元の呼び出し元シグナルを再融合するため、置換で呼び出し元キャンセルを切り離せない。ラッパーは依然として自身のシグナルを復元し静止に到達しなければならない。スコープフィルター済みディスパッチ（`@deepseek-ai/dsh-scope`）: エージェントスコープのリスナーはそのエージェントの呼び出しのみを受け取る。

```ts cordis-catalog
/**
 * Around-dispatch waterfall for timeout, retry, or metrics. `next()` returns
 * a normalized result; wrappers may change only `exec.signal`, while call
 * identity remains immutable. The registry re-fuses the original caller
 * signal before the body, so replacement cannot detach caller cancellation;
 * wrappers must still restore their signal and reach quiescence.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent's calls.
 * @param exec - the allowed call about to dispatch (name, parsed arguments, caller agent, signal).
 * @mode waterfall
 */
'tools/execute'(this: Scoped<ToolRuntime>, exec: ToolDispatchExecution, next: () => Promise<ToolExecutionResult>): Promise<ToolExecutionResult>
```

Types: [Scoped](scope.md)

Source: [`packages/core/tools/src/index.ts`](../../packages/core/tools/src/index.ts)

<a id="toolspost-execute--waterfall"></a>

#### `tools/post-execute` — waterfall

正規化済みディスパッチ結果を受け入れ、置換、拡充、またはブロックする。`next()` はそれを変更なしに受け入れる。例外ツールもエラーとしてこのウォーターフォールに届く。非同期リスナーは `exec.signal` を監視しなければならない。それらが確定した後、呼び出し元キャンセルは成功した受け入れ結果のみを、ツール本体が呼び出されたかどうかで選ばれるコードに置換する。スコープフィルター済みディスパッチ（`@deepseek-ai/dsh-scope`）: エージェントスコープのリスナーはそのエージェントの呼び出しのみを受け取る。

```ts cordis-catalog
/**
 * Accept, replace, enrich, or block a normalized dispatch result. `next()`
 * accepts it unchanged; thrown tools still reach this waterfall as errors. Async
 * listeners must observe `exec.signal`; after they settle, caller
 * cancellation replaces only a successful accepted outcome with the code
 * selected by whether the tool body was invoked.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent's calls.
 * @param exec - the call that just ran (name, parsed arguments, caller agent).
 * @param result - the dispatch outcome a listener may accept, replace, or block.
 * @mode waterfall
 */
'tools/post-execute'(this: Scoped<ToolRuntime>, exec: ToolExecution, result: Readonly<ToolExecutionResult>, next: () => Promise<PostToolDecision>): Promise<PostToolDecision>
```

Types: [Scoped](scope.md)

Source: [`packages/core/tools/src/index.ts`](../../packages/core/tools/src/index.ts)

<a id="toolspre-execute--waterfall"></a>

#### `tools/pre-execute` — waterfall

ディスパッチ前に許可、拒否、取り消し、問い合わせを行う。`next()` は許可に委譲する。`cancel` は正規のディスパッチ前取り消し結果を選び、承認対応の欠落は `ask` を拒否に変える。非同期ゲートは `exec.signal` を監視しなければならない。レジストリはそれら確定後にキャンセルを再確認するが、それらのプロミスを放棄しない。スコープフィルター済みディスパッチ（`@deepseek-ai/dsh-scope`）: エージェントスコープのリスナーはそのエージェントの呼び出しのみを受け取る。

```ts cordis-catalog
/**
 * Allow, deny, cancel, or ask before dispatch. `next()` delegates to allow;
 * `cancel` selects the canonical pre-dispatch cancellation result, and missing
 * approval support turns `ask` into denial. Async gates must observe
 * `exec.signal`; the registry rechecks cancellation after they settle but
 * never abandons their promise.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent's calls.
 * @param exec - the pending call (name, parsed arguments, caller agent).
 * @mode waterfall
 */
'tools/pre-execute'(this: Scoped<ToolRuntime>, exec: ToolExecution, next: () => Promise<PreToolDecision>): Promise<PreToolDecision>
```

Types: [Scoped](scope.md)

Source: [`packages/core/tools/src/index.ts`](../../packages/core/tools/src/index.ts)

<a id="toolsptc-dispatch-log--waterfall"></a>

#### `tools/ptc-dispatch-log` — waterfall

ブリッジが `tool/ptc-dispatch` イベントを追記する前に、1つの `run_code` サブディスパッチ結果の永続ログコピー内のコンテンツをリスナーが置換できる。`next()` はコンテンツを変更なしに保つ。リスナーは置換ブロックを返せる（例: 巨大テキスト結果に対するスピルポリシーのプレビュー＋ロケーター）。影響を受けるのは記録コピーのみである — プログラムは既に完全な値を受け取っており、モデルはどちらも参照しない。例外リスナーは封じ込められる。ブリッジは元の確定コンテンツの記録にフォールバックする。スコープフィルター済みディスパッチ（`@deepseek-ai/dsh-scope`）: エージェントスコープのリスナーはそのエージェントのディスパッチのみを受け取る。

```ts cordis-catalog
/**
 * Allow a listener to replace content in the DURABLE LOG COPY of one
 * `run_code` sub-dispatch outcome before the bridge appends its
 * `tool/ptc-dispatch` event. `next()` keeps the
 * content unchanged; a listener may return replacement blocks (e.g. the
 * spill policy's preview + locator for an oversized text result). Only the
 * logged copy is affected — the program already received the complete
 * value, and the model sees neither. A throwing listener is contained:
 * the bridge falls back to logging the original settled content.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent's dispatches.
 * @param dispatch - the parent execution, sub-call identity, and the settled content to log.
 * @mode waterfall
 */
'tools/ptc-dispatch-log'(this: Scoped<ToolRuntime>, dispatch: PtcDispatchLog, next: () => Promise<ContentBlock[]>): Promise<ContentBlock[]>
```

Types: [ContentBlock](llm-streaming.md) · [Scoped](scope.md)

Source: [`packages/core/tools/src/index.ts`](../../packages/core/tools/src/index.ts)

<a id="toolsresult--emit"></a>

#### `tools/result` — emit

凍結されたロスレス JSON 最終結果を観測する。リスナーの失敗は封じ込められる。スコープフィルター済みディスパッチ（`@deepseek-ai/dsh-scope`）: `exec.agent` でキー付けされる。

```ts cordis-catalog
/**
 * Observe the frozen, lossless-JSON final outcome. Listener failures are contained.
 * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): keyed by `exec.agent`.
 * @param exec - the execution object that traversed the pipeline.
 * @param result - a deep-frozen snapshot of the final returned result.
 * @mode emit
 */
'tools/result'(this: Scoped<ToolRuntime>, exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): undefined
```

Types: [Scoped](scope.md)

Source: [`packages/core/tools/src/index.ts`](../../packages/core/tools/src/index.ts)
<!-- END GENERATED cordis-surface -->
