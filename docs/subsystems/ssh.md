# SSH

日本語 | [English](ssh.en.md) | [中文](ssh.zh.md)

[SSH プロバイダーファミリー](../../packages/ssh/README.md)は、デプロイが所有する OpenSSH 接続を介して 1 つのリモートファイルシステム/プロセスワールドを提供する。Harness、モデルトランスポート、およびセッションストレージはホスト上に残る。このファミリーは既存のファイルシステム、サブプロセス、サンドボックス API を実装し、SSH 固有のモデルツールは導入しない。

## 実行座標

ファイルシステム識別子、実行可能ファイルの検索、プロセスの cwd、サンドボックスのワークスペースルート、言語サーバーのファイル URL は SSH ホストを参照する。プロバイダーはファイルが存在する場所でパスを正規化し、`symlink/..` のファイルシステム解釈を保つ。ポリシーリゾルバーは、Harness ホスト上でリモートパスを解決しようとせず、絶対的な実行ワールドの綴りを運ぶ。

`processPath()` は、対になるサブプロセスプロバイダーが使用できるパスを提供する。`processPathFromHostPath()` は SSH では利用できないままである。リモート成果物をインストールしても、任意のホストパスが移植可能になるわけではない。したがって [`NodePtcRuntime`](../../packages/ptc-runtime/ptc-runtime-node/README.md) は、検証済みのリモート起動構成を取る: インストール済みスクリプトブートストラップ、または[ヘルパー実行可能ファイルの埋め込みワーカー](../../packages/ssh/ssh-helper-runtime/README.md)である。

## トランスポートと信頼

管理 RPC はヘルパーの SSH exec ストリームを使用する。通常の stdin、stdout、stderr、ターミナル出力、およびオプションの fd 7 制御トラフィックは、個別に認証された転送 Unix ソケットを使用する。転送される各ストリームは独自の SSH チャネルウィンドウを持ち、一時停止したプログラム出力が制御または管理のウィンドウを共有することはない。すべてのチャネルは依然として接続帯域幅とトランスポート障害を共有する。

デプロイ認証、インストール済み成果物の検証、およびストリームごとの TLS 認証は [`dsh-ssh`](../../packages/ssh/ssh/README.md) に属する。ヘルパーは、リモートマシン上の信頼されたローカルプロバイダーでファイルシステムとプロセスのリクエストを実行する。SSH はトランスポートであり、ファイルへの影響を執行するのは選択されたリモートサンドボックスプロバイダーである。

## プロセスの寿命とキャンセル

プロセスはストリームが接続される前に予約され、起動は最大 1 回だけ受け付けられる。`done` は直接の結果を報告し、`waitForExit` はリモートの管理対象範囲を観察する。ターミナル操作は非同期の共有 API を保つ。準備のキャンセル、起動済みプロセスの終了、およびプロバイダーの破棄は、ヘルパーを通じて所有リソースを解放する。

管理デッドラインは個々の RPC 観察を制限するが、Bash または ptc-runtime コンシューマーが選んだ実行デッドラインを置き換えるものではない。リモートの待機は、他のリクエストが進む間 pending のままでいられる。SSH の喪失は pending 操作を無効にする。ヘルパーの EOF、シグナル、リース期限切れはリモートクリーンアップを開始する。クライアントは未確認の結果を正直に報告し、実行された可能性のあるアクションをリプレイするために再接続することは決してない。

## 構成スコープ

Headless はマウントされたファイルシステムプロバイダーを通じてセッション cwd を記録・検査する。したがって、リモートの FS、Bash、ターミナル、LSP、PTC コンシューマーはそれらの座標を共有できる。ホストファイルシステムアクセスを前提とする Web ワークスペースビューは別途の統合を必要とする。プロバイダーを置き換えるだけでは、それらのビューがリモート対応になるわけではない。

代替案と検証義務については[決定記録](../../.agents/notes/implemented/architecture/2026-09-11-posix-ssh-runtime.md)を参照。

## 接続 API

```ts type-equiv
/** Installed helper invocation; script deployments may also install a PTC bootstrap. */
type HelperLaunch = {
  /** Run the installed script with a separately installed Node executable. */
  kind: 'node-script'
  /** Absolute remote Node executable. */
  node: string
  /** Absolute remote PTC bootstrap; requires bootstrapHash. */
  bootstrapPath?: string
  /** Lowercase SHA-256 of bootstrapPath; requires that path. */
  bootstrapHash?: string
} | {
  /** Run the helper executable with its embedded Node and PTC worker. */
  kind: 'executable'
}
```

```ts type-equiv
/** Deployment-owned SSH identity and installed helper; no model argument selects these values. */
interface Config {
  /** OpenSSH host alias, including its existing user, key and known-host configuration. */
  host: string
  /** Explicit script or self-contained executable invocation. */
  launch: HelperLaunch
  /** Absolute path to the installed, bundled helper entry. */
  helper: string
  /** SHA-256 of that bundled helper; mismatches refuse the connection. */
  helperHash: string
  /** Absolute remote default workspace. */
  workspace: string
  /** Connection and administrative-request deadline, at most 2,147,483,647 milliseconds. */
  requestTimeoutMs?: number
  /** Maximum JSON payload bytes per helper request or response. */
  maxFrameBytes?: number
  /** Maximum ordinary requests; heartbeat and bounded resource cleanup have reserved capacity. */
  maxPending?: number
  /** Remote helper lease; loss of heartbeats starts remote managed cleanup. */
  leaseMs?: number
}
```

```ts public-api
/** One non-reconnecting SSH session; loss invalidates all active operations. */
declare class SshConnection extends Service {
  static Config: schema<Config>;
  /** Verified remote helper coordinates; callers must await this before launch. */
  readonly ready: Promise<Hello>;
  constructor(ctx: Context, config: Config);
  /** Hold plugin readiness until the remote identity and helper digest are verified. */
  async [Service.init](): Promise<void>;
  /** Verified remote PTC launch configuration; script deployments require a verified bootstrap. */
  get ptcLaunch(): { kind: 'embedded'; executable: string } | { kind: 'node-script'; executable: string; bootstrapPath: string };
  /**
     * Send a helper operation; cancellation never replays an ambiguous mutation.
     * @param method - the private helper operation.
     * @param params - JSON request fields validated by the helper.
     * @param result - response validation before returning provider-visible data.
     * @param signal - cancellation, which does not undo completed remote effects.
     * @param wait - allow a process observation to outlast the administrative deadline.
     * @returns the validated remote result.
     */
  async request<T>(method: string, params: unknown, result: z.ZodType<T>, signal?: AbortSignal, wait: boolean = false): Promise<T>;
  /**
     * Forward one authenticated stream through an independent SSH channel.
     * @param endpoint - private coordinates issued by this connection's helper.
     * @param signal - cancellation of allocation and the resulting socket.
     * @returns a paused socket; attach a consumer before resuming it.
     */
  async connectStream(endpoint: SshStreamEndpoint, signal?: AbortSignal): Promise<Socket>;
  /** Tear down the helper's remote managed ranges before releasing the SSH master when reachable. */
  dispose(): Promise<void>;
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される（doc-sync の `pnpm run verify-cordis-catalog` によって最新性が検証され、再生成は `pnpm run gen-cordis-catalog` で行う）— 言語側はロケール固有のペアドキュメントパスのみが異なる。シグネチャブロックは `ts cordis-catalog` フェンスを使用し、元のソース JSDoc を保つ。ディスパッチモードは[primer](../cordis-primer.md#dispatch-modes)で定義され、フレームワークから継承した `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxssh--sshconnection"></a>

### `ctx.ssh` — `SshConnection`

1 つの非再接続 SSH セッション。喪失はすべてのアクティブ操作を無効にする。

```ts cordis-catalog
/**
 * Send a helper operation; cancellation never replays an ambiguous mutation.
 * @param method - the private helper operation.
 * @param params - JSON request fields validated by the helper.
 * @param result - response validation before returning provider-visible data.
 * @param signal - cancellation, which does not undo completed remote effects.
 * @param wait - allow a process observation to outlast the administrative deadline.
 * @returns the validated remote result.
 */
async request<T>(method: string, params: unknown, result: z.ZodType<T>, signal?: AbortSignal, wait: boolean = false): Promise<T>

/**
 * Forward one authenticated stream through an independent SSH channel.
 * @param endpoint - private coordinates issued by this connection's helper.
 * @param signal - cancellation of allocation and the resulting socket.
 * @returns a paused socket; attach a consumer before resuming it.
 */
async connectStream(endpoint: SshStreamEndpoint, signal?: AbortSignal): Promise<Socket>

/** Tear down the helper's remote managed ranges before releasing the SSH master when reachable. */
dispose(): Promise<void>
```

ソース: [`packages/ssh/ssh/src/index.ts`](../../packages/ssh/ssh/src/index.ts)
<!-- END GENERATED cordis-surface -->
