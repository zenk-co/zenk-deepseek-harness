# サブプロセス

日本語 | [English](subprocess.en.md) | [中文](subprocess.zh.md)

サブプロセスシームは、サービス定義 ([dsh-subprocess](../../packages/subprocess/subprocess)、`ctx.subprocess`) とサービスプロバイダー ([dsh-subprocess-local](../../packages/subprocess/subprocess-local)) に分割される。そのコンシューマーは他のケイパビリティシームとプロセス外バックエンドである。[bash エグゼキューター系](shell.md)は収集されたバッチ出力を使い、LSP は生のプロトコルパイプを使い、PTY バックエンドはターミナルプリミティブを使い、ACP サブエージェントバックエンドはパイプされた ndjson と継承された stderr を使う。このシームは管理された `DSH_*` 環境名前空間、共有の資格情報スクラブ (`scrubbedParentEnv`)、`CollectedOutput` の形を所有する。[dsh-shell](../../packages/shell/shell)が語彙を再エクスポートするので、bash のコンシューマーは単一のインポートルートを保つ。

ソース: [`packages/subprocess/subprocess/src/types.ts`](../../packages/subprocess/subprocess/src/types.ts) および [`packages/subprocess/subprocess/src/index.ts`](../../packages/subprocess/subprocess/src/index.ts)

## 実行ファイルの検索

あるプロバイダーのスポーン作業ディレクトリ、実行ファイルパス、通常プロセス、ターミナルセッションは、マウントされたファイルシステムプロバイダーと同じパス・プロセス名前空間に属する。`resolveExecutable(command, env?, signal?)` は絶対実行ファイルパスを検証するか、プロバイダーのスクラブ済み `PATH` と意図的なオーバーライドを通じて裸の名前を解決する。

## 管理環境名前空間とキャプチャ済み出力

`DSH_*` 変数は Harness 所有の子プロセス事実である。実装は呼び出し元の明示的 `env` がマージされる前に環境の `DSH_*` 名を破棄するので、現在の事実は意図的な文字列エントリーとしてのみ到着し、明示的な `undefined` トゥームストーンは通常の環境値を削除する。各収集ストリームは `CollectedOutput` を通じてその切詰めとスピル復旧の状態を報告する。

```ts type-equiv
/** One environment key inside the managed {@link DSH_ENV_PREFIX} namespace. */
type DshEnvironmentKey = `${typeof DSH_ENV_PREFIX}${string}`
```

```ts type-equiv
/** Trusted DeepSeek Harness variables for one child-process execution. */
type DshEnvironment = Readonly<Record<DshEnvironmentKey, string>>
```

```ts type-equiv
/** One captured stream: the (possibly truncated) text plus recovery info. */
interface CollectedOutput {
  /** Collected text — the TAIL of the stream when truncated. */
  text: string
  /** True when bytes were dropped from `text`. */
  truncated: boolean
  /** Path to a file holding the COMPLETE stream, when truncated and available. */
  spillPath?: string
}
```

## Node 形式の stdio 配置

各ストリームの配置は明示的で、コンシューマーごとに選ばれる。プロトコルフレーミング用の生パイプ (LSP JSON-RPC、ACP ndjson)、パススルー診断用の inherit、有界のバッチ出力用の collect モード — スピルファイルはオプションなので、診断テール (言語サーバーの stderr) はファイルを残さずにバッファリングする。

```ts type-equiv
/**
 * stdin disposition. `'ignore'` leaves fd 0 on `/dev/null`; `'pipe'` exposes
 * {@link SubprocessHandle.stdin} for the caller's ongoing protocol writes;
 * `{ data }` writes the bytes and closes (the batch shape).
 */
type SubprocessStdinMode = 'ignore' | 'pipe' | { readonly data: string }
```

```ts type-equiv
/**
 * Bounded in-memory collection for one output stream, with an optional
 * full-stream spill file. Omitting `spill` keeps only the in-memory tail —
 * the diagnostic-tail shape (a language server's stderr); including it makes
 * the complete stream recoverable up to its cap (the bash tool shape).
 */
interface SubprocessCollect {
  /** In-memory cap in bytes; overflow keeps the TAIL. */
  maxBytes: number
  /** Full-stream spill file; absent disables spilling entirely. */
  spill?: {
    /** Whole-stream byte cap; a larger stream discards its now-incomplete spill. */
    maxBytes: number
  }
}
```

```ts type-equiv
/**
 * stdout/stderr disposition. `'pipe'` exposes the raw `Readable` for the
 * caller's protocol decoding; `'inherit'` passes the parent's descriptor
 * through (child diagnostics land on the harness's own stream); a
 * {@link SubprocessCollect} object buffers boundedly with offset-based reads.
 */
type SubprocessOutputMode = 'pipe' | 'inherit' | SubprocessCollect
```

```ts type-equiv
/** Per-stream stdio dispositions, all explicit — this seam applies no defaults. */
interface SubprocessStdio {
  stdin: SubprocessStdinMode
  stdout: SubprocessOutputMode
  stderr: SubprocessOutputMode
  /** Request a separate byte-mode duplex channel; omission creates none. */
  control?: 'pipe'
}
```

## 完全に明示的な spawn スペック

シームはデフォルトを適用しない。すべての配置、制限、ディレクトリがスペック上で明示されるので、隠れたサブプロセスサービスのデフォルトではなく、呼び出し元自身の設定がそれらを決める。`argv` がシェル解釈されることは決してない。

```ts type-equiv
/**
 * A fully-specified spawn request. This seam applies no defaults: every
 * disposition, limit, and directory is explicit, so the caller's own config —
 * not a hidden subprocess-service default — decides them (the `dsh-shell`
 * request/spec split is the owning template).
 */
interface SubprocessSpawnSpec {
  /** Executable and arguments; `argv[0]` is the program. Never shell-interpreted here. */
  argv: readonly string[]
  /** Working directory for the child. */
  cwd: string
  /** Per-stream stdio dispositions. */
  stdio: SubprocessStdio
  /**
   * Positive finite grace period in milliseconds, no greater than
   * `MAX_TIMER_DELAY_MS`, available to the provider's termination procedure
   * and used for draining still-open collected pipes after the process exits
   * (an inherited descriptor held by a survivor cannot hold the outcome open
   * indefinitely). Providers document whether range termination is staged or
   * immediate.
   */
  graceMs: number
  /**
   * Abort signal — starts the terminate escalation on the managed range when
   * it fires. The caller owns deadlines and cause classification; this seam
   * only reacts to the abort.
   */
  signal?: AbortSignal | undefined
  /**
   * Explicit environment entries merged onto the implementation's scrubbed
   * parent base (see `scrubbedParentEnv`), with no namespace validation. A
   * string is a deliberate caller opt-in, so a forwarded credential-shaped
   * entry or current `DSH_*` fact survives the scrub; `undefined` is a
   * tombstone that removes an ordinary ambient entry from the child.
   */
  env?: NodeJS.ProcessEnv | undefined
}
```

## ハンドル: ストリーム、リーダー、管理レンジの終了

spawn はライブハンドルを同期的に返し、ターゲットと管理レンジの同一性はプロバイダー非公開のままである。collect モードのリーダーはストリーム全体のバイトオフセットを取り、消費しないので、独立したリーダーが互いのデルタを奪うことはない。パイプされたストリームは呼び出し元のものである。`terminate()` はプロバイダーの文書化された手順を開始し、`waitForExit()` は同じプロバイダー管理レンジを観測する。段階的プロバイダーは `graceMs` を使ってよく、即時プロバイダーは遅延しない。コンシューマーはこれら 2 つの操作の上に独自のティアダウンラダーを構築できる (ACP バックエンドの stdin-EOF 優先の `disposeAcpChild` がテンプレートである)。

```ts type-equiv
/**
 * A live subprocess and its provider-managed process range. Collected output
 * remains readable after exit; piped streams belong to the caller.
 *
 * Termination and {@link SubprocessHandle.waitForExit} use the same managed
 * range. Each provider documents the range it can observe and its signalling
 * and observation limits.
 */
interface SubprocessHandle {
  /** The child's stdin, present iff spawned with `stdin: 'pipe'`. */
  readonly stdin: Writable | undefined
  /** The child's raw stdout, present iff spawned with `stdout: 'pipe'`. */
  readonly stdout: Readable | undefined
  /** The child's raw stderr, present iff spawned with `stderr: 'pipe'`. */
  readonly stderr: Readable | undefined
  /** Separate caller-owned byte channel when requested; native startup failure may leave it absent. */
  readonly control: Duplex | undefined
  /** Offset-based readers for collect-mode streams (also readable after exit). */
  readonly collected: SubprocessCollectedOutputs
  /** Resolves with spawned-command exit facts; rejects for spawn or provider failures. */
  readonly done: Promise<SubprocessOutcome>
  /**
   * Begin the provider's documented termination procedure on the managed range
   * — the seam's only termination verb. Idempotent, a no-op once that range is
   * gone, and also triggered by the spec's abort signal.
   */
  terminate(): void
  /**
   * Wait until the same managed range is empty — not just until the spawned
   * command reports its outcome, so surviving work remains observable.
   * @param signal - optional bound for the wait.
   * @returns `true` when the managed range is empty, `false` when the signal aborted first.
   * @throws when the selected provider can no longer observe its managed range.
   */
  waitForExit(signal?: AbortSignal): Promise<boolean>
}
```

```ts type-equiv
/**
 * Cursor-free incremental access to one collected output stream. Offsets are
 * whole-stream byte coordinates owned by the caller, so independent readers
 * cannot consume one another's output; `readFrom(0)` after settlement is the
 * batch result (`lossy` then means the in-memory tail lost its head — the
 * {@link CollectedOutput.truncated} fact).
 */
interface SubprocessOutputReader {
  /**
   * Read everything captured since `fromByte`. When that offset has slid out
   * of the in-memory tail window the read is `lossy` — it returns the whole
   * retained tail and the gap is only recoverable from the spill file.
   * @param fromByte - whole-stream offset to resume from (a prior read's `nextOffset`; 0 for the first read).
   * @returns the delta text, the next offset, the `lossy` flag, and the spill path when one exists.
   */
  readFrom(fromByte: number): SubprocessOutputRead
}
```

```ts type-equiv
/** One incremental {@link SubprocessOutputReader.readFrom} read. */
interface SubprocessOutputRead {
  /** Stream text from the requested offset (the whole retained tail when lossy). */
  text: string
  /** Whole-stream offset to resume from on the next read. */
  nextOffset: number
  /** True when the requested offset slid out of the in-memory tail window. */
  lossy: boolean
  /** Path to the full-stream spill file, when one was created and remains intact. */
  spillPath?: string
}
```

```ts type-equiv
/** Offset-based readers for the streams spawned in collect mode. */
interface SubprocessCollectedOutputs {
  /** Present iff stdout is a {@link SubprocessCollect}. */
  readonly stdout?: SubprocessOutputReader
  /** Present iff stderr is a {@link SubprocessCollect}. */
  readonly stderr?: SubprocessOutputReader
}
```


## 結果は終了事実のみを運ぶ

`done` は Node の close イベント語彙を報告し、原因分類は行わない — サービスはアボート時に kill するが、理由を決めることは決してない (呼び出し元が、例えば bash エグゼキューターの `timedOut`/`aborted` の分割のように、自身が所有する期限シグナルを読む)。収集された出力は決着後も `handle.collected` を通じて読めるので、バッチとストリーミングの呼び出し元は 1 つのアクセス経路を共有する。

```ts type-equiv
/**
 * Exit facts of one closed process — Node's `close`-event vocabulary.
 * Deliberately carries NO timeout or cancellation classification (the caller
 * reads the signal it owns to classify causes) and NO output: collected
 * streams stay readable through {@link SubprocessHandle.collected} after
 * settlement, so batch and streaming callers share one access path.
 */
interface SubprocessOutcome {
  /** Exit code; null when the process died from a signal. */
  exitCode: number | null
  /** Terminating signal (e.g. 'SIGTERM'); null on normal exit. */
  signal: NodeJS.Signals | null
}
```

## ターミナルプロセスプリミティブ

`spawnTerminal(spec)` は非パイプのプロセスプリミティブである。プロバイダーは制御端末を割り当て、UTF-8 テキスト転送、フォアグラウンドプロセスグループの検査とシグナル送信、およびプロバイダーがまだ観測できるすべてのセッションメンバーの静止に到達する 1 つの await される TERM→KILL 操作を所有する。プロバイダーは基盤固有の観測限界を文書化する。PTY バックエンドはプロンプト検出、レディネスの推論、スクロールバック、サンドボックスポリシー、永続セッションの所有権に引き続き責任を持つ。通常の `spawn()` は制御端末のセマンティクスを再現できない。

ターミナルスペックは argv、cwd、環境オーバーライド、ターミナル種別、寸法、クリーンアップ猶予、オプションの割り当てキャンセルとシェルアクティビティ観測を完全に指定する。そのハンドルは `pid`、順序付き出力、`done`、`write`、`resize`、`inspectForeground`、`inspectActivity`、`signalForeground`、await される `terminate` を公開する。[`SubprocessTerminalSpawnSpec` と `SubprocessTerminalHandle`](../../packages/subprocess/subprocess/src/types.ts) がこれらのフィールドと操作を定義する。`resize(cols, rows)` はライブ PTY の寸法を更新し、プロセス終了後は拒否する。

`inspectActivity()` は `SubprocessTerminalActivity` を返す。`state` は `idle`、`busy`、`unknown` のいずれかで、`revision` はプロバイダーが観測したアクティビティまたは入力に応じて変わる。ターミナルリクエストは `shellActivity` でサポートされるシェルライフサイクル観測にオプトインする。プロバイダー固有のサポートと保守的な unknown ケースは [subprocess-local](../../packages/subprocess/subprocess-local/README.md#running-terminal-sessions) が文書化する。

`terminalEnvironment(signal?)` は `SubprocessTerminalEnvironment` を返す。実行環境のプラットフォーム (`posix` または `windows`) とオプションの `defaultShell` である。これらの事実は Web サーバーやブラウザーではなくプロバイダーから来る。`resolveExecutable` はシェル候補を検証する。`SubprocessExecutableNotFoundError` は実行ファイルの欠落を識別し、プロバイダーとトランスポートの失敗はエラーのままである。

## サービスの振る舞い

抽象 [`SubprocessRuntime`](../../packages/subprocess/subprocess/src/index.ts) サービス定義は、実行ワールド座標、実行ファイル検索、通常の `spawn`、`spawnTerminal` を指定する。[`LocalSubprocessRuntime`](../../packages/subprocess/subprocess-local/src/index.ts) はそれらを、プラットフォームが選ぶ管理レンジ、配置ごとの配線、資格情報スクラブ、`node-pty`、プラットフォームプロセス検査、terminate-and-join 破棄で提供する。サービス定義の契約は [`dsh-subprocess`](../../packages/subprocess/subprocess/README.md)、ローカルの仕組みは [`dsh-subprocess-local`](../../packages/subprocess/subprocess-local/README.md) を参照。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxsubprocess--subprocessruntime-abstract-seam"></a>

### `ctx.subprocess` — `SubprocessRuntime` (abstract seam)

Abstract subprocess service. Subclass, implement spawn, and load the subclass as a plugin — it registers as `ctx.subprocess` (one implementation per context; loading a second throws, which is cordis' standard duplicate-service behavior).

Implementations must honor these semantics:

- Executable paths belong to one execution world shared with the mounted filesystem provider.
- spawn returns a live handle synchronously. Target identity remains provider-private; `done` resolves with the spawned command's exit facts and may reject for spawn or provider failures.
- Collect-mode readers are offset-based and non-consuming, so independent readers never consume one another's output; lossy reads report truncation and the spill file holding the complete stream when one exists. Piped streams are handed to the caller raw and never buffered here.
- SubprocessHandle.terminate (and the spec's abort signal) starts the provider's documented procedure against its managed range. SubprocessHandle.waitForExit observes that same range so a consumer-owned teardown ladder can hold each tier on real quiescence; each provider documents its signalling and observability limits.
- Disposal of the service terminates all still-running managed processes and awaits their exit.
- spawnTerminal owns terminal allocation, text transport, foreground groups, signalling, and whole-session quiescence behind one awaited termination method; readiness and persistent-shell policy stay in the PTY consumer. Its output stream ends after queued terminal output when the top-level process exits.

```ts cordis-catalog
/**
 * Resolve one configured executable in this provider's execution world.
 * Absolute paths are verified; bare names use the provider's scrubbed PATH
 * plus explicit environment overrides. Relative paths containing separators
 * are rejected: the resolution base is undefined, so providers fail loud
 * instead of guessing.
 * @param command - absolute executable path or bare PATH name.
 * @param env - explicit environment entries used for lookup.
 * @param signal - aborts remote or local lookup.
 * @returns a canonical executable path.
 */
abstract resolveExecutable( command: string, env?: Readonly<Record<string, string>>, signal?: AbortSignal, ): Promise<string>

/**
 * Inspect shell-selection facts in the provider's execution environment.
 * @param signal - cancellation of remote environment inspection.
 * @returns platform and preferred shell; executable lookup and allocation remain separate operations.
 */
abstract terminalEnvironment(signal?: AbortSignal): Promise<SubprocessTerminalEnvironment>

/**
 * Start one managed child process from a fully-specified spec; this seam
 * applies no defaults.
 * @param spec - argv, directory, stdio dispositions, grace, cancellation, and environment.
 * @returns the live process handle (streams/readers, signalling, outcome promise).
 * @throws synchronously when pre-aborted or when argv, cwd, environment, or grace is invalid before handle creation.
 */
abstract spawn(spec: SubprocessSpawnSpec): SubprocessHandle

/**
 * Allocate a real terminal and start one owned process session. This is the
 * only non-pipe process primitive: implementations own terminal byte I/O,
 * foreground groups, signals, and whole-session quiescence.
 * @param spec - fully specified argv, cwd, environment, dimensions, grace, and allocation cancellation.
 * @returns the live terminal handle after allocation succeeds.
 */
abstract spawnTerminal(spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle>
```

Source: [`packages/subprocess/subprocess/src/index.ts`](../../packages/subprocess/subprocess/src/index.ts)
<!-- END GENERATED cordis-surface -->
