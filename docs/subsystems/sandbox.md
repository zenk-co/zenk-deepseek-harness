# プロセスサンドボックス

日本語 | [English](sandbox.en.md) | [中文](sandbox.zh.md)

[dsh-sandbox](../../packages/sandbox/sandbox) のプロセスサンドボックスシームは、同じワールドのサブプロセス argv をファイル効果ポリシーでラップし、コンシューマーをプラットフォームランナーに結合しない。[dsh-sandbox-local](../../packages/sandbox/sandbox-local) は Linux bwrap/Landlock、macOS Seatbelt、Windows ACL 制限トークンバックエンドを提供し、[dsh-bash-sandbox](../../packages/shell/bash-sandbox) と [dsh-pwsh-sandbox](../../packages/shell/pwsh-sandbox) がそれを消費する。[dsh-sandbox-ssh](../../packages/ssh/sandbox-ssh/README.md) は、SSH ファイルシステムおよびサブプロセスプロバイダーと対になるリモートバックエンドを通して同じポリシーを適用する。

ソース: [`packages/sandbox/sandbox/src/index.ts`](../../packages/sandbox/sandbox/src/index.ts)

## モードと強制

`SandboxMode` はファイルシステム効果のみを統治する。`read-only` はバックエンドに書き込みの拒否を求める — POSIX ランナーはさらに、シェルが必要とする `/dev/null` シンクを許可し、Windows ACL ランナーは明示的な書き込み可能ルートを許可せず、アンビエント ACL ギャップに対して部分的な強制を報告する。`workspace-write` はワークスペースルートとバックエンドが約束する一時領域の下での書き込みを許可し、`danger-full-access` は閉じ込めをバイパスする。ネットワークとプロセス可視性はこの語彙の対象外である。

```ts type-equiv
/**
 * File-effect policy for confined processes. `read-only` permits only required
 * sinks such as `/dev/null`; `workspace-write` also permits the workspace and a
 * backend-defined temp area; `danger-full-access` bypasses confinement. Network
 * and process visibility are outside this vocabulary.
 */
type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'
```

プロバイダーに送信できるのは最初の 2 つのモードのみである。`danger-full-access` のコンシューマーは元の argv を spawn し、`ctx.sandbox` を呼び出さない。

```ts type-equiv
/** A confining (non-`danger-full-access`) mode — the modes a {@link SandboxPolicy} can carry. */
type ConfinedSandboxMode = Exclude<SandboxMode, 'danger-full-access'>
```

強制は報告される事実である。`full` はバックエンドがモードの約束するすべてのファイル効果を統治することを意味し、`partial` はアクティブなバックエンドまたは古いカーネル ABI が一部のみを統治することを意味するので、絶対的な約束を必要とするコンシューマーはその区別を拒否するか表面化しなければならない。古い Landlock ABI と、Windows ACL ランナーのハードリンク、非閉じ込め読み取り、AppContainer ACL の境界が現在の partial ケースである。

```ts type-equiv
/**
 * Enforcement completeness for this host. `partial` means an active backend or
 * older kernel ABI cannot govern every promised file effect; callers requiring
 * an absolute boundary must not treat it as `full`.
 */
type SandboxEnforcement = 'full' | 'partial'
```

## 呼び出しごとのポリシー

完全な実行ポリシーは、ケイパビリティ呼び出しごとに解決され、運ばれる。これには `danger-full-access` が含まれるので、コンシューマーは閉じ込めをバイパスするかどうかを決める前にポリシーを 1 度解決できる。通常のツール呼び出しは呼び出し元セッションの不変 cwd から `workspaceRoot` を派生させる。デプロイメント構成はエージェントレス呼び出しのフォールバックである。リゾルバーは実行ワールドの絶対的な綴りを維持する。強制するプロバイダーは、ファイルが存在する場所でルートを正規化するので、`symlink/..` を含む cwd は、対になるサブプロセスプロバイダーが実際に実行されるディレクトリを識別する。

```ts type-equiv
/**
 * The complete file-effect policy resolved for one capability call. The root
 * is carried even under modes that do not consume it so callers can resolve
 * policy once before choosing the enforcement path.
 */
interface SandboxExecutionPolicy {
  /** The file-effect mode this execution runs under. */
  mode: SandboxMode
  /** Absolute root directory `workspace-write` may write under. */
  workspaceRoot: string
  /**
   * Opaque identity of the calling session (the branded `dsh-session`
   * SessionId). Backends key per-session state off it (e.g. windows-acl gives
   * each live session/workspace pair a random private temp directory and SID,
   * while the workspace SID and standing grant remain per-workspace); absent
   * for agentless calls, which fall back to per-call backend state.
   */
  sessionId?: SessionId
}
```

`ctx.sandboxPolicy.resolve()` はアクティブなセッションと、承認されたリトライの場合は明示的なモードを受け取る。このサービスが優先順位とルートフォールバックを所有するので、bash と fs がそれを繰り返すことはない。

```ts type-equiv
/** Inputs that select the sandbox policy for one capability call. */
interface SandboxPolicyRequest {
  /** Calling session; its immutable cwd becomes the workspace boundary. */
  session?: Session
  /** Explicit approved mode override, which outranks session policy. */
  mode?: SandboxMode
}
```

`ctx.sandbox` に到達するのは閉じ込められた実行のみである。そのプロバイダーポリシーは同じルートを保ちながらモードを狭める。これにより、同時セッション、コンシューマー、ワンショットのエスカレートされたリトライが、プロバイダー状態を変更せずに同じプロバイダーへ異なる境界を要求できる。

```ts type-equiv
/**
 * What one confined execution is allowed to touch — carried PER CALL, not
 * fixed on the provider: two consumers may confine under different policies
 * at the same instant (bash under `read-only` while a confined child agent
 * needs its state directory writable), and an approved escalated retry is a
 * new call with a wider policy. Defaulting/resolution is an explicit step at
 * the consumer boundary; the provider treats the policy as fully specified.
 */
interface SandboxPolicy extends SandboxExecutionPolicy {
  /** The file-effect mode this execution runs under. */
  mode: ConfinedSandboxMode
}
```

<a id="wrapped-argv-and-classification-dialects"></a>

## ラップされた argv と分類ダイアレクト

`RunnerFailureRule` は、ランナーがコマンドを実行する前に失敗したという証拠を組み合わせる。コンシューマーは、非ゼロ終了、任意の許可終了コードゲート、および残っている 1 つの stderr 行内での大文字小文字を区別しない致命的シグネチャを要求する。大文字小文字を区別しない完全行一致の情報的除外が最初に除去されるので、無害なランナーの通知がそれだけで失敗を証明することはできない。一致した行はエラー詳細として利用可能なままである。分類は stderr を書き換えない。

```ts type-equiv
/**
 * Evidence that identifies a sandbox runner failing before it executes the
 * wrapped command. A consumer first applies {@link allowedExitCodes} when
 * present, removes {@link informationalLines} by case-insensitive exact line
 * equality, then matches {@link fatalSignatures} case-insensitively within
 * each remaining stderr line. Exit status alone never proves runner failure.
 */
interface RunnerFailureRule {
  /** Nonzero process exit codes on which this rule may match; omitted permits any nonzero exit. */
  allowedExitCodes?: readonly number[]
  /** Non-empty substrings identifying a fatal runner diagnostic on one stderr line. */
  fatalSignatures: readonly string[]
  /** Benign stderr lines excluded by exact full-line equality before fatal matching. */
  informationalLines?: readonly string[]
}
```

`ConfinedArgv` はコンシューマーが spawn するものである。置換 argv に加えて、バックエンドの強制の事実と 2 つの直交する stderr 分類器を運ぶ。`denialSignatures` は、サンドボックスが正しく動作している状態で閉じ込められたコマンドがブロックされていることを識別する。`runnerFailureRules` は、サンドボックスランナーがコマンドを実行する前に拒否または失敗していることを識別する。コンシューマーはこれらを最初にチェックし、サンドボックスインフラストラクチャの失敗を表面化し、通常のタスク失敗として扱うことは決してない。

```ts type-equiv
/**
 * A {@link SandboxProvider.confine} result: the argv to spawn in place of
 * the caller's own, plus the enforcement completeness the selected backend
 * achieves for it.
 */
interface ConfinedArgv {
  /** The wrapped argv (runner, profile, separator, then the caller's argv). */
  argv: string[]
  /** How completely the selected backend enforces the policy's file effects. */
  enforcement: SandboxEnforcement
  /**
   * The selected backend's denial DIALECT: the case-insensitive stderr
   * substrings a file effect denied by THIS backend produces (EROFS text
   * under bwrap's read-only binds, EACCES under Landlock, EPERM under
   * Seatbelt). A consumer that infers denials from a failed run's stderr
   * matches against exactly these rather than a cross-backend union — the
   * union claims denials a given backend never produces.
   */
  denialSignatures: readonly string[]
  /**
   * Structured runner-failure evidence rules. Consumers require a matching
   * fatal stderr line (after informational exclusions) and any rule-specific
   * exit-code gate before checking denial signatures: runner failure means the
   * command never ran, while denial means confinement worked and blocked it.
   */
  runnerFailureRules: readonly RunnerFailureRule[]
}
```

[ローカルプロバイダー](../../packages/sandbox/sandbox-local/README.md)がオペレーター構成を所有し、そのランナーダイアレクトをこれらのルールにマッピングする。[サンドボックス化された bash コンシューマー](../../packages/shell/bash-sandbox/README.md)が spawn と結果の帰属を所有する。

## プロバイダーとフェイルクローズドエラー

`await ctx.sandbox.confine(argv, policy, signal)` はポリシーパスを解決し、実行ワールドから `ConfinedArgv` を返すか、使用可能なバックエンドが存在しない場合は `SandboxUnavailableError` とコード `SANDBOX_UNAVAILABLE` で拒否する。任意のシグナルは起動前の解決をキャンセルする。コンシューマーは、返された argv の spawn 中または観測中の失敗を分類してもよい。その帰属はコンシューマー契約に属する。閉じ込めポリシーに対して、暗黙の非閉じ込めパススルーが合法となることは決してない。

プロバイダー選択、プローブ、キャッシュ、バックエンド固有の強制レポートは[ローカルプロバイダー](../../packages/sandbox/sandbox-local/README.md)に属する。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxsandbox--sandboxprovider-abstract-seam"></a>

### `ctx.sandbox` — `SandboxProvider` (abstract seam)

Abstract process-sandbox service. confine must return enforcing argv or fail closed at wrap or runner-execution time; silent unconfined passthrough is forbidden. Functional probes arbitrate multi-runner chains and may be skipped for a sole candidate, whose own refusal remains the fail-closed end.

```ts cordis-catalog
/**
 * Wrap `argv` so it executes confined under `policy` on this host; the
 * caller spawns the returned argv in place of its own.
 * @param argv - the exact argv the caller is about to spawn (program plus
 *   arguments), NOT a shell string — a shell-shaped consumer passes
 *   `['bash', '-c', command]`.
 * @param policy - the file-effect policy this execution runs under,
 *   carried per call (see {@link SandboxPolicy}).
 * @param signal - cancellation while the provider resolves the policy and runner.
 * @returns the argv to spawn instead, plus the enforcement completeness
 *   the selected backend achieves for it.
 */
abstract confine(argv: readonly string[], policy: SandboxPolicy, signal?: AbortSignal): Promise<ConfinedArgv>
```

Source: [`packages/sandbox/sandbox/src/index.ts`](../../packages/sandbox/sandbox/src/index.ts)

<a id="ctxsandboxpolicy--sandboxpolicyservice"></a>

### `ctx.sandboxPolicy` — `SandboxPolicyService`

The sandbox-policy service (`ctx.sandboxPolicy`). Owns the deployment default mode, fallback workspace root, and current request-time policy section. Tool layers call resolve for each execution so a session's mode log and immutable cwd travel together to every enforcing capability.

```ts cordis-catalog
/**
 * Resolve the complete policy for one capability call. An approved explicit
 * mode outranks the session's last `sandbox/mode` event, which outranks the
 * deployment default. A session cwd is its workspace-write boundary; the
 * configured root is the fallback for agentless calls and sessions without a
 * cwd.
 * @param request - optional session and approved mode override.
 * @returns the fully resolved per-call mode and absolute workspace root.
 */
resolve(request: SandboxPolicyRequest = {}): SandboxExecutionPolicy

/**
 * Read the session override without applying the deployment default.
 * @param session - session whose log supplies the override.
 * @returns the last logged mode, or `undefined` without one.
 */
overrideOf(session: Session): SandboxMode | undefined
```

Types: [Session](session.md)

Source: [`packages/sandbox/sandbox-policy/src/index.ts`](../../packages/sandbox/sandbox-policy/src/index.ts)
<!-- END GENERATED cordis-surface -->
