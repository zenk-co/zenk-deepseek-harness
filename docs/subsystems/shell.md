# Shell エグゼキューター

日本語 | [English](shell.en.md) | [中文](shell.zh.md)

shell 実行シームは [dsh-shell](../../packages/shell/shell) を `ctx.shell` 上の Service Definition として使う。[shell パッケージグループ](../../packages/shell/README.md)は、その Bash と PowerShell のプロバイダーおよびモデル向けの Consumer を列挙する。汎用のバックグラウンドジョブ id、所有権、制御は [jobs.md](jobs.md) にあり、このシームはジョブ登録なしでプロセスハンドルを返す。managed-range の仕組みは [subprocess シーム](subprocess.md)の背後にある。

ソース: [`packages/shell/shell/src/types.ts`](../../packages/shell/shell/src/types.ts)

## 管理対象の shell 環境名前空間

`DSH_*` 変数は Harness が所有する子プロセスの事実である。モデル向けの bash ツールはそれらを `ctx.shellEnv` を通じて収集し、`ShellExecRequest.dshEnv` で渡す。subprocess サービスは現在のスナップショットをマージする前に継承された `DSH_*` 名を除去する。`DshEnvironmentKey`/`DshEnvironment` の語彙は [subprocess シーム](subprocess.md)が所有し、`dsh-shell` が再エクスポートする。

## リクエストと spec: resolve() の分離

このシームは、**モデル/プラグイン向けのリクエスト**（オプションの `workdir`/`timeoutMs`/`stdoutMaxBytes` で、設定またはリクエストポリシーから補完される）と、実行器が実際に扱う**完全に解決された spec**（これらのフィールドが必須）を分離する。ツール層はその間で `ctx.shell.resolve(request)` を呼ぶ（リポジトリの「パッケージ境界では明示 > 暗黙」ルール）。`ShellExecSpec` は解決済みの値を運ぶ。

```ts type-equiv
/**
 * A caller's execution REQUEST: `workdir` and `timeoutMs` are optional and
 * filled by {@link ShellExecutor.resolve} from the implementation's config.
 * This is the model-/plugin-facing shape; pass it to `resolve()` to obtain a
 * fully-resolved {@link ShellExecSpec}.
 */
interface ShellExecRequest {
  command: string
  /** Working directory override (default: implementation-configured). */
  workdir?: string | undefined
  /** Timeout override in milliseconds (implementations cap it). */
  timeoutMs?: number | undefined
  /** Deadline policy at `timeoutMs` expiry (default `'kill'`). */
  onExpiry?: ShellExpiryPolicy | undefined
  /**
   * Foreground stdout capture budget in bytes. Absent uses the executor's
   * default output cap. Trusted in-process consumers use this when they must
   * parse complete stdout up to their own bounded limit; the model-facing bash
   * tool does not expose it as a parameter.
   */
  stdoutMaxBytes?: number | undefined
  /** Abort signal — implementations kill the command when it fires, and treat a signal that is already aborted as fired. */
  signal?: AbortSignal | undefined
  /**
   * Bytes to write to the command's stdin, then close it. Absent leaves stdin
   * closed/empty (the default for model-driven tool calls). Set by in-process
   * plugins (e.g. the hooks bridges, which write a hook command's JSON payload
   * to its stdin); the model-facing bash tool does not expose it as a parameter
   * (a model that needs stdin uses shell syntax like a heredoc or a pipe).
   */
  stdin?: string | undefined
  /**
   * Ordinary environment entries for the command, merged after the credential
   * scrub. Managed facts belong in {@link dshEnv}, which merges after this
   * map, so an entry here can never displace one. Set by in-process plugins
   * (the hooks bridges set `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, …); the
   * model-facing bash tool does not expose it as a parameter.
   */
  env?: Record<string, string> | undefined
  /**
   * Harness-owned `DSH_*` variables for this execution (typed to managed
   * keys). Executors discard ambient `DSH_*` entries before merging this
   * snapshot last, so an unavailable current fact cannot inherit a stale
   * value from the harness process and a caller {@link env} entry cannot
   * displace a managed one.
   */
  dshEnv?: DshEnvironment | undefined
  /** Fully resolved per-call sandbox policy; sandboxing executors default it. */
  sandboxPolicy?: SandboxExecutionPolicy | undefined
}
```

```ts type-equiv
/**
 * A resolved execution spec. {@link ShellExecutor.resolve} fills and caps the
 * required fields; under `onExpiry: 'none'` the resolved `timeoutMs` arms no
 * timer and is only echoed into {@link ShellRunResult.timeoutMs}.
 */
interface ShellExecSpec {
  command: string
  workdir: string
  timeoutMs: number
  /** Deadline policy at `timeoutMs` expiry ({@link ShellExecutor.resolve} defaults it to `'kill'`). */
  onExpiry: ShellExpiryPolicy
  /**
   * Resolved stdout capture budget in bytes, applied to every execution's
   * stdout; stderr keeps the executor's own output cap.
   */
  stdoutMaxBytes: number
  /** Abort signal — implementations kill the command when it fires, and treat a signal that is already aborted as fired. */
  signal?: AbortSignal | undefined
  /** Bytes to write to stdin before closing it; absent means no stdin. */
  stdin?: string | undefined
  /**
   * Ordinary environment entries carried through from
   * {@link ShellExecRequest.env}; {@link dshEnv} still merges after them.
   * OPTIONAL on the spec for the same reason as `stdin`: absent means no
   * ordinary extra environment.
   */
  env?: Record<string, string> | undefined
  /** Managed `DSH_*` snapshot (typed to managed keys); merges after {@link env}. */
  dshEnv?: DshEnvironment | undefined
  /** Resolved sandbox policy; ignored by executors that do not confine. */
  sandboxPolicy: SandboxExecutionPolicy | undefined
}
```

`stdin` と `env` は信頼されたプロセス内プラグインの入力であり、`dsh-tool-bash` によって公開されない。ローカル実行器は、呼び出し元が明示的に指定した env をマージする前に、環境の資格情報をスクラブする。

`stdoutMaxBytes` も信頼されたプラグイン専用である。これは、stderr、バックグラウンドジョブ、モデル向け bash ツールの通常の出力上限を変更せずに、フォアグラウンドの消費者が解析用の有限予算まで完全な stdout を要求できるようにする。

## フォアグラウンド実行: ShellRunResult

完了した（または kill された）フォアグラウンド実行 1 回の結果。直交する結果は**独立に**報告される。プロセスはシグナルをトラップしたためタイムアウトしつつ exit 0 することもありうる。したがって `timedOut`、`aborted`、`signal`、`exitCode` はそれぞれ独立したフィールドである。呼び出し元が途中で打ち切られた実行を正常成功として読むことはない。

```ts type-equiv
/** The outcome of a foreground run, including timeout during preparation. */
interface ShellRunResult {
  /** Exit code; null when preparation expired or the process died from a signal. */
  exitCode: number | null
  /** Terminating signal, or null when none was reported, including preparation expiry. */
  signal: NodeJS.Signals | null
  /**
   * True when the executor's own timeout was the FIRST cause to cut the command
   * short. Mutually exclusive with {@link aborted}: one fused deadline drives
   * both the timeout and the caller's cancellation, so a timeout and an abort
   * racing before process close report the single first-abort cause, not both
   * (see the [timeout-library Agent Note](../../../../.agents/notes/implemented/architecture/2026-07-06-timeout-deadline-library.md)).
   */
  timedOut: boolean
  /**
   * True when the caller's `AbortSignal` was the FIRST cause to kill the command
   * (and it was not the executor's own timeout). Mutually exclusive with
   * {@link timedOut} — see there for the first-cause classification.
   */
  aborted: boolean
  /** The effective timeout applied to this run (after defaulting/capping). */
  timeoutMs: number
  stdout: CollectedOutput
  stderr: CollectedOutput
  /** Sandbox execution facts, absent for an unsandboxed executor. */
  sandbox?: ShellSandboxInfo
}
```

各ストリームは `CollectedOutput` である。すなわち（切り詰められている可能性のある）テキストと復元情報である。切り詰められた場合、`text` は**末尾**であり、完全なストリームはプライベートファイルへスピルされる。フィールドは [subprocess シーム](subprocess.md)が所有し、`dsh-shell` が再エクスポートする。

## ファイルサンドボックス: ShellSandboxInfo

サンドボックスを利用する実行器は、設定されたモードのフォールバックを `ShellExecutor.sandboxMode` を通じて公開する。ツール層は [`@deepseek-ai/dsh-sandbox-policy`](../../packages/sandbox/sandbox-policy/README.md) に依頼して、呼び出し元セッションごとの永続的な `sandbox/mode` オーバーライドと不変の cwd を `ShellExecRequest.sandboxPolicy` へ解決する。ユーザーが承認した厳密に広い呼び出しはモードだけを置き換える。モード/ルート/enforcement の語彙は [`@deepseek-ai/dsh-sandbox` シーム](sandbox.md)が所有し、モードが支配するのはファイルへの影響のみである。

サンドボックス化された実行は、そのモード、保守的な拒否分類、および enforcement の完全性を報告する。`runnerFailed` はコマンド実行前のサンドボックスランナー失敗を示す。フォアグラウンド実行は `SANDBOX_UNAVAILABLE` をスローするが、決着済みのバックグラウンドプロセスにはその事実チャネルしかない。

```ts type-equiv
/**
 * Sandbox facts for one run, present iff a sandboxing executor handled it.
 * Facts are reported independently of process exit status so callers can
 * distinguish command failures from policy denials and runner failures.
 */
interface ShellSandboxInfo {
  /** The mode the command actually ran under. */
  mode: SandboxMode
  /** Whether the sandbox denied a file operation. */
  denied: boolean
  /** How completely the selected runner enforced the requested mode. */
  enforcement?: SandboxEnforcement
  /** Whether the sandbox runner failed before the command could run. */
  runnerFailed?: boolean
}
```

`SANDBOX_UNAVAILABLE` エラーコード（[sandbox シーム](sandbox.md)が所有）は、封じ込めモードに使用可能なバックエンドがないときに `ctx.sandbox` プロバイダーがスローし、実行器が伝播するものである。選択されたランナーがそのプロファイルを拒否する場合も同じフェイルクローズドのフォアグラウンドエラーに至る。決着済みのバックグラウンドジョブは `runnerFailed` を記録する。モデルは拒否/ランナーの事実を結果で受け取り、拒否マーカーがモードを名指す場合にのみ実効モードを知り、`sandbox_permissions` と `justification` を通じて 1 回限りの厳密に広い再試行を要求できる。何かが実行される前に `ctx.approval` がその正確な呼び出しを許可しなければならない。完全なポリシーと切り替えの設計は [sandbox リファレンス](../../packages/sandbox/sandbox-policy/README.md)にある。

## バックグラウンドプロセス: ShellProcess

`start()` は非同期の起動準備の後にハンドルで解決する。キャンセルまたは準備失敗は公開前に拒否する。ハンドルは id もオーナーも持たない。`dsh-tool-bash` がそれを `ctx.jobs.start()` フックへ適合させ、汎用ランタイムがジョブ ID とライフサイクルを所有する。`done` は基盤のプロセスが決着すると解決し、決して拒否しない。subprocess プロバイダーの拒否は、stderr にステージ中立のエラーを持つ `killed` プロセスになる。読み取りは決着後も有効であり、サンドボックスの事実は `done` が解決する前に刻印される。

```ts type-equiv
/**
 * A background process handle returned by {@link ShellExecutor.start}. It is the
 * only access path; buffered output remains readable after exit. Composition
 * teardown (the subprocess service's disposal) kills running processes and
 * awaits {@link done}; an executor-only reload leaves them running.
 */
interface ShellProcess {
  /** Process lifecycle state (settled exactly once). */
  status: ShellProcessStatus
  /** Exit code once finished (null = killed by signal / still running). */
  exitCode: number | null
  /** Terminating signal name, when signal-killed. */
  signal: NodeJS.Signals | null
  /**
   * Resolves when the underlying process settles (never rejects — provider
   * rejection settles as `killed` with a stage-neutral error on stderr).
   */
  readonly done: Promise<void>
  /** Sandbox facts, stamped once a confined process settles. */
  sandbox?: ShellSandboxInfo
  /**
   * Read output produced since the previous read (consuming — consecutive
   * reads never re-deliver). Reads that lost data flag `lossy` and point at
   * full-stream spill files when available.
   */
  readOutput(): ShellProcessRead
  /**
   * Non-consuming offset readers over the same captured streams the consuming
   * {@link readOutput} cursor drains, including the provider-failure note a
   * rejected spawn leaves on stderr. Independent observers read here at their
   * own offsets without stealing bytes from `readOutput`.
   */
  observed: ShellObservedStreams
  /**
   * Terminate the provider-managed range. Returns false when it had already finished
   * (no-op); idempotent.
   */
  kill(): boolean
}
```

`readOutput()` は増分デルタとスピル復元の事実を返す:

```ts type-equiv
/** One incremental {@link ShellProcess.readOutput} read. */
interface ShellProcessRead {
  /** Output produced since the previous read (stderr in a marked section). */
  delta: string
  /** True when truncation dropped unread bytes the delta cannot include. */
  lossy: boolean
  /** Full stdout spill file, when stdout truncation occurred and a safe path is available. */
  stdoutSpillPath?: string
  /** Full stderr spill file, when stderr truncation occurred and a safe path is available. */
  stderrSpillPath?: string
}
```

## サービス

`ShellExecutor` は `resolve`、フォアグラウンド `run`、バックグラウンドプロセスの `start`、および `sandboxMode` ケイパビリティの事実を所有する。`dsh-bash-local` はコマンドのデフォルト化、タイムアウト/アボートの分類、ターミナル環境、バックグラウンド読み取りのマージを所有する。managed-range の終了、有限コレクター、スピルファイル、資格情報のスクラブ、破棄時の静止は [subprocess サービス](subprocess.md)のものである。`dsh-tool-bash` はモデル向けのレンダリングを所有し、バックグラウンドハンドルを[汎用ジョブランタイム](jobs.md)へ適合させる。`dsh-shell` は shell ツール群が共有する終了ステータス契約を所有する。エクスポートされた `parseExitStatus`/`ParsedExitStatus` は、`dsh-tool-bash` の `renderResult` と `dsh-tool-pwsh` の `renderPwshResult` が付加する `[exit code: N]` / `[killed by signal: X]` マーカーを反転し、両ツールの `presentResult` がそれを使ってレンダリング済みテキストをターミナルカードの出力本体と終了ステータスのピルに分割する。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される（doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。`pnpm run gen-cordis-catalog` で再生成）。言語版はロケール固有の対訳ドキュメントパスだけが異なる。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxshell--shellexecutor-abstract-seam"></a>

### `ctx.shell` — `ShellExecutor`（抽象シーム）

抽象 bash 実行サービス。サブクラス化して抽象メソッドを実装し、そのサブクラスをプラグインとしてロードする。`ctx.shell` として登録される（コンテキストごとに実装は 1 つ。2 つ目をロードするとスローされる。これは cordis の標準的な重複サービス動作である）。

execute は準備後にプロセスハンドルで解決する。「フォアグラウンド」は呼び出し元が何を待つかの性質であり、spawn の性質ではない。`ShellExecution.result` を待つ呼び出し元はコマンドをフォアグラウンドで実行し、ハンドルを保持する呼び出し元はバックグラウンドで実行した。しばらくだけ待つ呼び出し元は `onExpiry: 'none'` でコマンドを実行して自身の待機を有限化する。ハンドルは呼び出し元が待機をやめた後も有効なままである。

実装は次のセマンティクスを守らなければならない:

- ShellExecution.result が拒否するのはインフラストラクチャー障害のみである。非ゼロ終了、タイムアウトによる kill、アボートによる kill は説明的な結果で解決する。最初の原因である `timedOut`/`aborted` と、spec の `timeoutMs` のエコーを含む。
- ハンドルは準備後に公開される。`done` はプロセス終了時に決着し、決して拒否しない。spawn 失敗は `killed` として決着し、エラーは読み取りパスに載る。一方 `result()` は同じ失敗を自身の拒否として運ぶ。
- `onExpiry: 'none'` はデッドラインを設定しない。`'kill'` は期限切れ時に kill する。準備中の期限切れは出力なしの決着済みタイムアウトハンドルを返す。
- ShellProcess.readOutput は増分的である。連続する読み取りが出力を繰り返すことはない。lossy な読み取りは切り詰めと利用可能なスピルファイルを報告する。
- 実行中のプロセスは、それを所有する構成の破棄時に停止され、待機される。subprocess シームではその境界は `ctx.subprocess` の破棄なので、プロセスは実行器のみのリロードを生き延びる。

```ts cordis-catalog
/**
 * Apply implementation-owned defaults and caps to a request before execution.
 * @param request - the caller's request; omitted fields get this
 *   implementation's defaults, capped fields are clamped.
 * @returns the fully-specified spec to hand to {@link execute}.
 */
abstract resolve(request: ShellExecRequest): ShellExecSpec

/**
 * Prepare and spawn the command under its resolved deadline.
 * @param spec - a resolved spec from {@link resolve}, never a raw request.
 * @returns the prepared handle, including its result projection;
 *   preparation timeout yields an already-settled handle with no output.
 * @throws on preparation failure or caller cancellation before process publication.
 */
abstract execute(spec: ShellExecSpec): Promise<ShellExecution>
```

ソース: [`packages/shell/shell/src/index.ts`](../../packages/shell/shell/src/index.ts)

<a id="ctxshellenv--shellenvregistry"></a>

### `ctx.shellEnv` — `ShellEnvRegistry`

信頼された実行単位の `DSH_*` 変数のためのレジストリ（`ctx.shellEnv`）。名前空間はモデルの shell 呼び出しごとに再構築される。環境の `DSH_*` 値は実行器によって破棄され、その後レジストリの現在のスナップショットが注入される。組み込みの shell 事実はレジストリ自身が所有したまま、プラグインは effect スコープの破棄を伴う追加の列挙可能な事実を登録できる。

```ts cordis-catalog
/**
 * Register one environment contributor. Names and keys are unique; built-in
 * keys are reserved. Registration is disposed with the calling plugin fiber.
 * @param contributor - declared key ownership and per-execution resolver.
 * @returns the disposer that unregisters the contribution.
 */
register(contributor: BashEnvContributor): () => void

/**
 * Build the trusted `DSH_*` snapshot for one shell tool execution.
 * @param execution - the current tool execution.
 * @returns an immutable environment overlay containing built-ins and current contributions.
 */
collect(execution: ToolExecution): DshEnvironment

/**
 * Enumerate plugin-contributed variables without executing their resolvers.
 * @returns declarations sorted by environment variable name.
 */
list(): BashEnvVariableInfo[]
```

型: [DshEnvironment](subprocess.md) · [ToolExecution](tools.md)

ソース: [`packages/shell/shell-env/src/index.ts`](../../packages/shell/shell-env/src/index.ts)
<!-- END GENERATED cordis-surface -->
