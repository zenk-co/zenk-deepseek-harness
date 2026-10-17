# 永続 PTY セッション

日本語 | [English](terminal.en.md) | [中文](terminal.zh.md)

PTY バックエンド、`ctx.terminals`、モデルに面したコンシューマーが共有する型。[永続 PTY Agent Note](../../.agents/notes/implemented/feature/2026-07-16-persistent-pty-sessions.md) が根拠を所有し、このページは [`packages/terminal/terminal/src/types.ts`](../../packages/terminal/terminal/src/types.ts) 由来の横断パッケージ語彙を記録する。

## アイデンティティと準備状態

`TerminalSessionId` はサービスが発行するブランド付き id である。任意の名前は所有者ローカルな表示メタデータであり、認可は名前や推測 id ではなく厳密な所有 `Agent` を比較する。

`TerminalWaitReason` は 1 回の送信が戻った理由を示す。`TerminalSessionStatus` とは独立である。無音やタイムアウトで戻ってもトップレベルのシェルは生き残りうる一方、`session_exit` は任意のフォアグラウンドの子ではなくそのシェルが終了したことを意味する。

```ts type-equiv
/** Why one interactive send returned control to its caller. */
type TerminalWaitReason = 'stdin_read' | 'inferred_idle' | 'timeout' | 'session_exit'
```

```ts type-equiv
/** Top-level PTY process status, independent of a send's wait reason. */
type TerminalSessionStatus =
  | { kind: 'running' }
  | { kind: 'exited'; exitCode: number | null; signal: NodeJS.Signals | null }
```

## バックエンドとライブセッション

バックエンドは、登録された 1 つの型がどう開始し準備完了を検出するかを所有する。`TerminalSessionService` はセットアップ成功後に返されたセッションを公開し、id 認可とクリーンアップを所有する。部分的な開始リソースを片付けられないバックエンドは `TerminalBackendCleanupError` で拒否し、呼び出し元のキャンセル理由を置き換えずにクリーンアップ失敗を保持したまま破棄できる。バックエンドセッションは端末状態と捕捉リソースの静止を所有する。

```ts type-equiv
/** Replaceable provider for one PTY session type. */
interface TerminalBackend {
  /** Stable type selected by {@link TerminalSpawnRequest.type}. */
  readonly type: string
  /** Create an unpublished session or reject after cleaning partial resources; cleanup failure uses {@link TerminalBackendCleanupError}. */
  spawn(spec: TerminalBackendSpawnSpec): Promise<TerminalBackendSession>
}
```

```ts type-equiv
/** Backend-owned live session retained by {@link TerminalSessionService}. */
interface TerminalBackendSession {
  /** Initial bounded terminal output returned from `terminal_open`. */
  readonly motd: string
  /** Top-level process id when one exists. */
  readonly pid?: number
  /** Start one exclusive send operation. */
  startSend(request: TerminalSendRequest): TerminalSendOperation
  /** Read one bounded page from retained scrollback. */
  read(request: TerminalReadRequest): TerminalReadResult
  /** Signal the verified foreground process group. */
  signal(signal: TerminalSignal): Promise<TerminalSignalResult>
  /** Observe top-level process status. */
  status(): TerminalSessionStatus
  /** Idempotently close the captured owned process tree and await quiescence. */
  close(reason: string): Promise<void>
}
```

## 送信と保持出力

1 つのライブセッションはアクティブな送信を 1 つだけ受け付ける。その操作は、汎用バックグラウンドジョブ向けの消費型出力カーソルと、フォアグラウンド呼び出し元向けの 1 つの端末結果を公開する。`TerminalReadResult` は別に、境界付きセッションスクロールバックをページングする。

```ts type-equiv
/** Live backend-owned send; exactly one may be active per PTY session. */
interface TerminalSendOperation {
  /** Resolves after readiness, timeout, cancellation, or top-level process exit. */
  done: Promise<TerminalSendResult>
  /** Consume output produced since the prior call. */
  readOutput(): TerminalSendRead
  /** Request `SIGINT`; returns false after the operation settled. */
  cancel(): boolean
}
```

```ts type-equiv
/** Settled result for one foreground or background send. */
interface TerminalSendResult {
  /** Bounded rendered terminal delta remaining at settlement. */
  viewport: string
  /** Why the wait returned; this does not imply arbitrary child-process exit. */
  waitReason: TerminalWaitReason
  /** Top-level session status observed at settlement. */
  sessionStatus: TerminalSessionStatus
  /** Whether output was dropped from the operation or retained scrollback. */
  truncated: boolean
}
```

## 所有権と耐久性

`TerminalSessionService` は厳密な所有者スコープに 1 つの待機クリーンアップを結び付け、外部の操作を拒否し、バックエンドやツールプラグインのリロードをまたいでセッションを生かし続ける。PTY 状態と生バイトはプロセスローカルのままである。モデル入力と境界付き返却出力は、PTY セッションイベントを重複させるのではなく既存の `tool/call`、`tool/result`、タスク結果パスを通じて耐久化される。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によるソースからの生成物 (`pnpm run verify-cordis-catalog` が doc-sync で鮮度を検証。再生成は `pnpm run gen-cordis-catalog`) — 言語面の差異はロケール固有のペア文書パスのみである。シグネチャブロックは `ts cordis-catalog` フェンスを使い元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義し、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxterminals--terminalsessionservice"></a>

### `ctx.terminals` — `TerminalSessionService`

置換可能な PTY バックエンドと厳密 Agent セッションのインプロセスレジストリ。

```ts cordis-catalog
/**
 * Register one backend type for this effect scope.
 * @param backend - provider with a non-empty unique type.
 * @returns disposer that removes exactly this contribution.
 */
registerBackend(backend: TerminalBackend): () => void

/**
 * List registered backend types in registration order.
 * @returns fresh backend type names.
 */
listBackends(): string[]

/**
 * Create and publish one owner-scoped session after backend setup succeeds.
 * @param owner - exact registered Agent that owns access and cleanup.
 * @param request - backend type plus optional owner-local name and cwd.
 * @param signal - cancellation of unpublished setup.
 * @returns published identity, metadata, status, and MOTD.
 */
async spawn(owner: Agent, request: TerminalSpawnRequest, signal?: AbortSignal): Promise<TerminalSpawnResult>

/**
 * Test whether an exact owner has a published session or unpublished spawn.
 * @param owner - exact live owner to inspect.
 * @returns true across the entire spawn-to-close interval, with no publication gap.
 */
hasOwnerActivity(owner: Agent): boolean

/**
 * Start one exclusive interactive send.
 * @param owner - exact session owner.
 * @param id - target PTY identity.
 * @param request - explicit text, submit behavior, and cancellation.
 * @returns live operation handle for foreground await or task registration.
 */
startSend(owner: Agent, id: TerminalSessionId, request: TerminalSendRequest): TerminalSendOperation

/**
 * Read one bounded scrollback page from an owned session.
 * @param owner - exact session owner.
 * @param id - target PTY identity.
 * @param request - optional newest-relative offset and line count.
 * @returns bounded retained text and pagination metadata.
 */
read(owner: Agent, id: TerminalSessionId, request: TerminalReadRequest = {}): TerminalReadResult

/**
 * Deliver an allowed signal through an owned backend session.
 * @param owner - exact session owner.
 * @param id - target PTY identity.
 * @param signal - allowed POSIX signal name.
 * @returns delivered foreground process-group identity.
 */
signal(owner: Agent, id: TerminalSessionId, signal: TerminalSignal): Promise<TerminalSignalResult>

/**
 * Close one owned session and remove it only after quiescent backend cleanup.
 * @param owner - exact session owner.
 * @param id - target PTY identity.
 * @param reason - diagnostic cleanup reason.
 * @returns true for a newly closed session, false when the same close is already in flight.
 */
async kill(owner: Agent, id: TerminalSessionId, reason: string = 'model request'): Promise<boolean>

/**
 * List fresh snapshots for exactly one owner.
 * @param owner - exact owner whose sessions are visible.
 * @returns owner-visible snapshots in publication order.
 */
list(owner: Agent): TerminalSessionSnapshot[]
```

Types: [Agent](core.md)

Source: [`packages/terminal/terminal/src/index.ts`](../../packages/terminal/terminal/src/index.ts)
<!-- END GENERATED cordis-surface -->
