# HTTP サーバー

日本語 | [English](web-server.en.md) | [中文](web-server.zh.md)

[dsh-host-webserver](../../packages/host/webserver) は GUI ホストのブラウザ HTTP キャリアである。1 つの `node:http` サーバー — `tls` が構成されている場合は `node:https` — が `ctx.webServer` を提供し、名前付きルートレジストリ、オプションの gzip レスポンス圧縮、index.html 変換コールバック、およびプラグインがクレームできる 1 つのフォールバックハンドラーを持つ。エージェントループの一部ではなく、ケイパビリティシームでもない。ハーネスの概念を一切知らず、`/api` ブリッジ、プラグインバンドル、HMR イベントストリームを含むすべての機能ルートは別のプラグインが登録する ([レイヤリング参照](../../packages/boot/app-boot/README.md))。ブラウザのみにサービスを提供する: Electron はビルド済みファイルを `file://` でロードし、このサーバーの代わりに IPC ブリッジ経由で fetch リクエストを送る。

ソース: [`packages/host/webserver/src/index.ts`](../../packages/host/webserver/src/index.ts)

## ルート

```ts type-equiv
/** Route match kind: 'exact' matches the pathname verbatim; 'prefix' p matches p and p/<anything>. */
type WebRouteKind = 'exact' | 'prefix'
```

```ts type-equiv
/** One named route registration. */
interface WebRoute {
  kind: WebRouteKind
  /** Absolute pathname, no trailing slash. */
  path: string
  /** Owns the full response lifecycle (may hold the response open, e.g. SSE). */
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}
```

マッチ順序は固定である: まず exact テーブル、次に最長一致プレフィックス、最後に登録済みフォールバック。登録順はリクエスト向けの意味を持たない — 名前付きルートは互いに素になるよう構成され、フォールバック席は名前付きルートがクレームしないものをすべて応答する。所有者は 1 つだけであり、2 度目の登録は throw する。同梱の Web 構成は [`dsh-host-frontend-static`](../../packages/host/frontend-static/src/index.ts) でその席をクレームする。ロックされたセマンティクスを持つ SPA dist サーバーである: Connection は dist ルートと構成された index を認証してからそれらの HTML を読む。index 以外のアセットは公開のままである。非 GET/HEAD は 405、dist ルート外へのトラバーサルは 403、存在するファイルは直接配信され、存在しないまたはファイルでないターゲットは空の 404 応答、未知の拡張子は octet-stream として出荷される。

<a id="config"></a>

## 設定

```ts type-equiv
/** Web server listen, TLS, and response-compression config. */
interface Config {
  /**
   * Listen address: a concrete IPv4 or IPv6 literal of one local interface,
   * for example the container's own Pod address from `hostname -i`. A loopback
   * literal (any address in 127/8, `::1`, or a mapped form of either) keeps the
   * server on this machine; any other literal serves the network that address
   * belongs to, over plain HTTP unless `tls` is set. The unspecified address —
   * IPv4 any, IPv6 any, and the IPv4-mapped forms of IPv4 any — is rejected at
   * load: it would expose the port on every interface at once.
   */
  host: string
  /** Listen port; zero requests an OS-assigned port. */
  port: number
  /**
   * Serve HTTPS with this certificate and key instead of plain HTTP. Both files
   * are read once, before the listener binds: an unreadable or empty file,
   * invalid PEM, or a key that does not match the certificate rejects
   * initialization rather than falling back to HTTP. The material is never
   * re-read, so replacing a certificate takes a reload. Omitted or null listens
   * over plain HTTP.
   */
  tls?: TlsConfig
  /** Response compression for socket-backed HTTP requests. @default 'none' */
  compression?: 'none' | 'gzip'
  /** Gzip DEFLATE level from 0 through 9. @default 1 */
  compressionLevel?: number
  /** Minimum known response length eligible for gzip; unknown-length streams are eligible. @default 1024 */
  compressionThresholdBytes?: number
}
```

```ts type-equiv
/**
 * TLS material for the HTTPS listener: one certificate chain file and the
 * private key file it pairs with. Both hold PEM text and both resolve against
 * the process working directory.
 */
interface TlsConfig {
  /** Certificate chain file, leaf certificate first, PEM, no passphrase. */
  certFile: string
  /** Private key file for the chain's leaf certificate; unencrypted PEM. */
  keyFile: string
}
```

どの構成もすべてのインターフェースを一度にバインドすることはできない: 未指定アドレスはロード時に拒否される。エクスポートされる `isWildcardHost` と `isLoopbackHost` は解析値からバインドアドレスを分類し、IPv6 の `%zone` は `listen` 用に保持されつつ分類はアドレスのみを読む。キャリアは認証や Origin ポリシーを所有せず、`tls` が証明書と鍵を供給しない限り素の HTTP を提供する。`compression` は既定で `none` である。同梱の Web バンドルは gzip レベル 1 と 1024 バイトのしきい値を選ぶ。同梱の `dsh web` コマンドは既定でループバックを選び、1 つの具体的な `--host` アドレスを受け付け、非ループバックバインドが素の HTTP を提供する場合に起動時に警告する。その Connection プラグインはすべての Host API ルートとストリームに Host/Origin チェックとブラウザセッション認証を供給し、バインドアドレスと `--trusted-host` がどのブラウザ Host を受け入れるかを規定する。`--public-url` は告知される URL のみを変える。他の構成は自身のバインドとルート認証ポリシーを所有する。dist の場所は席をクレームするフロントエンドプラグインの組み立て上の事実である。

## サービス

`WebServer` (`ctx.webServer`) はアクティベーション時に即座にリッスンする。リッスン失敗 (EADDRINUSE…) は初期化を拒否し、boot プロセスが失敗したファイバーを報告する。`tls` ペアはリスナーがバインドする前に一度だけ読まれ、読めない、空、または不一致のペアは HTTP へフォールバックせず同じように初期化を拒否する。`register(route)` は名前付きルートを 1 つ追加し、そのディスポーザーを返す。重複する `(kind, path)` は throw する。ルートパターンは構成レベルの規約であり、衝突は誤構成だからである。Gzip は対象となるソケットベースのレスポンスをサーバー内部でラップするため、ルートハンドラーは `ServerResponse` の所有権を直接保ち、レスポンス書き込み API はサービスに追加されない。既存のコンテンツエンコーディング、`Cache-Control: no-transform`、レンジ、SSE、ZIP、およびパッケージされた `.gz` Worker イメージは identity レスポンスのままである。`collectIndexInjections()` は 1 回の `webserver/index-inject` emit で構造化された `IndexInjection` 行を集め、`renderIndex(html)` はそれらを成功したルートおよび構成済み index レスポンスにレンダリングしてから、生の `tapIndex(transform)` エスケープハッチ変換を登録順に適用する。[dsh-client-modules](../../packages/client/modules) がそのイベントに boot マニフェスト行で応答する。`port` はリッスンポートを読み（`config.port` が 0 のとき OS が割り当てたポートを含む）、`protocol` はリスナーが提供するスキーム（`http:` または `https:`）を報告する。

ハンドリングが throw するリクエスト（不正な %-エスケープが `decodeURIComponent` に当たる、クライアントがボディ途中で切断する）は警告としてログされ 400 で応答される — ヘッダーが既に送信済みの場合はソケットを破棄する — プロセス終了にはならない。破棄は `close()` と `closeAllConnections()` を対にする。ハンドラーがレスポンスを開いたまま保持する（SSE）ことがあり、そのような接続は自ら終わらないためである。強制クローズがなければティアダウンはハングする。TLS ソケットはハンドシェイク後にのみ接続として数えられるため、サーバーは生の TLS ソケットをアップグレード済みソケットの隣で追跡し、破棄時に両方を destroy する。このパッケージは決して出力しない: URL 行はシェルに属する。開発モードのバンドル watch パイプラインを含むパッケージ単位の運用詳細は [README](../../packages/host/webserver/README.md) にある。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される（doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。`pnpm run gen-cordis-catalog` で再生成）。言語版はロケール固有の対訳ドキュメントパスだけが異なる。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxconnection--hostconnectionhandle"></a>

### `ctx.connection` — `HostConnectionHandle`

Host の `ctx.connection` のうち、トランスポート非依存アダプターが消費するメンバー。

```ts cordis-catalog
/**
 * Compose exact Fetch routes and the shared-channel RPC interceptor.
 * @param channel - shared channel mounted by Connection.
 * @returns Fetch handler for trusted, authenticated requests.
 */
createSharedFetchHandler(channel: '/api'): ConnectionFetchHandler

/**
 * Apply Connection's Host/Origin checks and browser authentication to
 * another Web route.
 * @param request - request headers from the HTTP or upgrade request.
 * @returns rejection status, or undefined when the route may accept the request.
 */
requestRejection(request: ConnectionTrustRequest): ConnectionRequestRejection

/**
 * Admit an HTTP request against its signed browser or API credential and live Peer.
 * @param request - request headers from the HTTP or upgrade request.
 * @returns the credential's Peer, or the rejection status.
 */
admit(request: ConnectionTrustRequest): PeerAdmission

/**
 * Create an independent in-process Peer, disposed with the Context that read `ctx.connection`.
 * @param options - fixed principal and optional interaction participation (default `answer`).
 * @returns a new Peer distinct from every other Peer.
 */
createPeer(options: { readonly principal: Principal; readonly interactions?: 'answer' | 'none' }): PeerScope

/**
 * Claim a physical socket for an API Peer; browser sockets share their owner Peer.
 * @param request - authenticated upgrade request headers.
 * @returns the Peer and idempotent release, or 409 for duplicate API ownership.
 * The carrier releases on socket termination or failed upgrade; release removes
 * API admission synchronously without cancelling independent HTTP calls.
 */
admitConnection(request: ConnectionTrustRequest): ConnectionAdmission

/**
 * Authenticate one frontend index request, owning a token redirect or 401.
 * The cookie this mints is `Secure` when the mounted Web carrier serves TLS,
 * which only that listener's protocol decides.
 * @param request - root or configured-index HTTP request.
 * @param response - response owned when the result is false.
 * @returns true only when the frontend may serve index.html.
 */
authorizeIndex(request: ConnectionIndexRequest, response: ConnectionIndexResponse): boolean

/**
 * Add the fresh process token to an ordinary Web application URL.
 * @param baseUrl - clean application URL whose authority and mount are preserved.
 * @returns tokenized URL for initial login; a mount proxy strips its prefix before {@link authorizeIndex}.
 */
authenticatedUrl(baseUrl: string): string
```

型: [Principal](typert.md)

ソース: [`packages/client/connection/src/rpc.ts`](../../packages/client/connection/src/rpc.ts)

<a id="ctxwebapp--webapp"></a>

### `ctx.webApp` — `WebApp`

このプロセスが提供する Web GUI。`web-runtime` 行が提供する。

```ts cordis-catalog
/**
 * The URL this GUI advertises, also used for `DSH_WEB_URL` and the startup URL line.
 * @returns the configured `publicUrl`, otherwise the listener origin.
 */
getAdvertisedUrl(): string
```

ソース: [`packages/bundle/web-app/src/index.ts`](../../packages/bundle/web-app/src/index.ts)

<a id="ctxwebserver--webserver"></a>

### `ctx.webServer` — `WebServer`

ブラウザ HTTP キャリアサービス。アクティベーション時に構成された TLS マテリアルをロードし、即座にリッスンする。マテリアルまたはリッスンの失敗は初期化を拒否し、boot プロセスが失敗したファイバーを報告する。構成された名前付きルートは互いに異なる必要があるためルート登録順はリクエストに影響しない。フォールバックハンドラーは、その所有者が登録するまでの起動中にまだクレームされていないものを 404 で応答する。

```ts cordis-catalog
/**
 * The root URL local clients use to reach the bound listener: the protocol,
 * the {@link bindUrlHost} form of the bind address, and the listening port.
 * @returns the origin, for example `http://127.0.0.1:3080`.
 * @throws before `listen` binds a port, or when the bind address has no URL form.
 */
getOrigin(): string

/**
 * Register a named route. Duplicate (kind, path) throws — route patterns are
 * a composition-level contract, so a collision is a misconfiguration.
 * @param route - kind, path, and the owning handler.
 * @returns the disposer removing the route.
 */
register(route: WebRoute): () => void

/**
 * Register an exact-path HTTP upgrade route. Duplicate paths throw because
 * one socket can have only one protocol owner.
 * @param route - pathname and handler owning negotiation plus socket use.
 * @returns the disposer removing the route.
 */
registerUpgrade(route: WebUpgradeRoute): () => void

/**
 * Claim the fallback seat: the handler answering every request no named
 * route matches (the SPA dist server in the shipped Web composition). One
 * owner only — a second registration throws, because two fallbacks cannot
 * compose.
 * @param handler - owns the full response lifecycle of unmatched requests.
 * @returns the disposer releasing the seat.
 */
registerFallback(handler: WebRoute['handler']): () => void

/**
 * Register a raw-HTML index transform, the escape hatch for markup no
 * {@link IndexInjection} row expresses: {@link renderIndex} applies taps in
 * registration order after rendering the structured rows.
 * @param transform - pure html-to-html function.
 * @returns the disposer removing the transform.
 */
tapIndex(transform: (html: string) => string): () => void

/**
 * Run an index.html body through the registered taps in registration order
 * — called by the fallback owner on every index response it renders.
 * @param html - the raw index.html body.
 * @returns the transformed body.
 */
applyIndexTaps(html: string): string

/**
 * Gather the structured injection table: one `webserver/index-inject` emit,
 * every subscriber pushes its current rows. Fresh per call, so subscribers
 * read live state (module graph, theme preference) at emit time.
 * @returns rows in subscriber activation order.
 */
collectIndexInjections(): IndexInjection[]

/**
 * Render one index.html body: the structured injection table first, then
 * the raw `tapIndex` transforms over the result.
 * @param html - the raw index.html body.
 * @returns the transformed body.
 */
renderIndex(html: string): string
```

ソース: [`packages/host/webserver/src/index.ts`](../../packages/host/webserver/src/index.ts)

<a id="connection-events"></a>

### `connection/*` events

<a id="connectionrequest--waterfall"></a>

#### `connection/request` — waterfall

認証済み共有 API リクエストを、ボディ転送を含めて受け入れるかラップする。リスナーが後続リクエストを拒否しても既存リクエストは継続する。

```ts cordis-catalog
/**
 * Admit or wrap an authenticated shared API request, including body transfer.
 * Existing requests continue when a listener refuses subsequent requests.
 * @param request - Authenticated incoming HTTP request.
 * @param response - Response owned until the delegated bridge settles.
 * @param next - Delegate to the next listener or the shared API bridge.
 * @mode waterfall
 */
'connection/request'(request: IncomingMessage, response: ServerResponse, next: () => Promise<void>): Promise<void>
```

ソース: [`packages/client/connection/src/index.ts`](../../packages/client/connection/src/index.ts)

<a id="webserver-events"></a>

### `webserver/*` events

<a id="webserverindex-inject--emit"></a>

#### `webserver/index-inject` — emit

構造化 index インジェクションテーブルを収集する。index レンダリングと worker boot-payload リクエストのたびに emit され、リスナーは現在の行を push するため、行のデータは emit 時に新鮮に読まれる。

```ts cordis-catalog
/**
 * Collect the structured index injection table. Emitted on every index
 * render and every worker boot-payload request; listeners push their
 * current rows, so a row's data is read fresh at emit time.
 * @param table - Mutable row table; listeners append in activation order.
 * @mode emit
 */
'webserver/index-inject'(table: IndexInjection[]): void
```

ソース: [`packages/host/webserver/src/index.ts`](../../packages/host/webserver/src/index.ts)
<!-- END GENERATED cordis-surface -->
