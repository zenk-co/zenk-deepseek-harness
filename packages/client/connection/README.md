---
description: "web GUI のブラウザー-Host wire 層: Remote RPC、再接続付きイベントストリーム配信、正確な Fetch ルート、/api HTTP ブリッジ、ブラウザー信頼フェンス。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-connection

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは、ブラウザーから Host への Remote 呼び出し、正確な Fetch レスポンス、接続世代を運ぶ。Client プラグインは `ctx.connection` をマウントし、現在ページのループバック状態、汎用 RPC、アクティブな世代とその Host ファクト、観測可能なリカバリー状態、即時再接続コマンド、および 1 つの世代ソースの登録ポイントを提供する。世代はそのソースが ready を報告したときに可視になる。ソースの完了、失敗、撤回、または明示的な停止は、`ConnectionController` がリトライポリシーを適用する前にそれをクリアする。

## 目次

- [このパッケージを使う](#use-this-package)
- [ブラウザー認証とリクエスト信頼](#browser-authentication-and-request-trust)
- [接続世代](#connection-generation)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

`./client` インポートは、Node ではスタンドアロンの `lib/client.node.js` ESM バンドルを、ブラウザーでは `lib/client.browser.js` ローダーファクトリーを選択する。Web Host は論理 URL `/plugins/.../client.js` でブラウザーエクスポートを提供し続ける。非ページの Cordis ツリーには Client エントリーをインポートする。別個のパッケージルートが Host エントリーである。

静的なデスクトップページは、自身が所有する Host の HTTP オリジンとして `__DSH_TRANSPORT__.streamBaseUrl` を提供できる。Gateway はそのオリジンを WebSocket に使用し、HTTP トランスポートは独立に選択されたままである。デスクトップキャリアが認証を所有する。オリジンの設定だけではアクセス権は得られない。

単項 RPC リクエストは JSON を使う。Host ハンドラーは、JSON 互換の結果値からすでに分離したバイト添付を返してもよく、各添付は結果相対のパスを名指す。Connection はこれらの値を multipart パートとして書き込む。JSON の `metadata` パートは、`null` プレースホルダー付きの RPC レスポンスエンベロープと、各パス、コーデック、パート識別子を記録する添付テーブルを含む。パスは文字列キーと数値配列インデックスを使う。予約されたビジネスフィールド名はない。Client はエンベロープ、`rpcId`、添付テーブル、パートを検証し、各バイト値を `ArrayBuffer` ベースのビューとして復元する。添付のない結果 (base64 文字列を含む) と失敗は JSON のままである。論理 RPC キャリアはデコードされたネイティブ値を直接返す。Connection はバイナリフィールドを発見したり Typert に依存したりしない。結果プロトコルを所有するハンドラーが、返す前に型指向またはランタイムの投影を行う。バイナリパラメーター、イベント、ストリーミングされたバイナリ結果はサポートされない。

ブラウザーは Remote の単項呼び出しに HTTP POST を使う。API Gateway は `/api/remote.mux` WebSocket とその論理ストリームを所有する。シェル所有のコンポジションは、WebSocket を開かずに `connection.rpc.open` を通じて、ストリームのアップリンクを含む同等の Remote ストリームを提供する。ブラウザープラグインはページトランスポート、リカバリー設定、ロケーションを読み取り、`installConnection(ctx, options)` に委譲する。自身のキャリアを所有するコンポジションは同じインストーラーを直接呼んでもよい。whole-client テスト階層はそうしている。非ページキャリアは `ClientTransportHooks.createWebSocket` に、HTTP と同じ認証済み Cookie と `streamBaseUrl` を供給する。`ConnectionHandle.openWebSocket()` はそのベースに対して Mux パスを解決し、選択されたファクトリーを呼び出す。各呼び出しは 1 つの Context 所有サービスを作成するため、複数の Client ツリーが 1 つのレルム内で異なるキャリアを使える。Host 半分は常にキャリア中立の RPC と正確な `GET`/`HEAD`/`POST` ルートレジストリを提供する。Web キャリアが存在するときは、唯一の `/api` ルート、Fetch ブリッジ、ブラウザー認証、Host/Origin チェックも所有する。シェル所有のキャリアは共有 Fetch ハンドラーを直接ディスパッチする。各正確なルートは、ブリッジがバイトを読む前に、バッファリングまたはストリーミングのリクエストボディ処理を宣言する。Typert Gateway が生成された Remote エンドポイントを要求し、機能パッケージが Session ログのダウンロードや生ファイルアップロードなどの非 JSON レスポンスを登録し、未要求のリクエストは 404 を返す。ループバックホスト名の分類は、ブラウザーに面する Client 状態に対してパッケージ内部のままである。ブラウザーの raw body 転送は [`dsh-client-file-upload`](../file-upload/README.md) が提供する。

-----

<a id="browser-authentication-and-request-trust"></a>
## ブラウザー認証とリクエスト信頼

Web キャリア上では、すべての Host RPC メソッドと WebSocket ストリームが、認証済みのブラウザーまたは API Peer を必要とする。メソッド固有のループバック階層は存在しない。各プロセスはランダムな起動トークンを生成する。`dsh-web-app` は `?token=...` 付きでアプリケーション URL を印刷して開き、呼び出し元の権限とマウントを保つ。`frontend-static` はルートと index のリクエストを `ctx.connection.authorizeIndex` に委譲し、これは `GET /` でのみそのトークンを受け入れ、権限に束縛された署名済み Cookie を書き込み、クリーンな `./` へリダイレクトする。これによりトークンは破棄され、リクエストのディレクトリは保たれる。欠落、期限切れ、不正形式、または誤った権限の Cookie は RPC ディスパッチの前に 401 を返す。静的アセットは公開のままである。HTTP キャリアはルート交換と `/connect` でのみクエリトークンを受け入れ、Authorization ヘッダーのトークンは受け入れない。

Cookie 署名の秘密は、`ctx.credentials` 内のオーナースコープの `client-connection/browser-session` グラントレコードである。ローカルプロバイダーはそれを `$DSH_HOME/.credentials.yaml` に永続化する。`BrowserAuth` は Connection のアクティベーション中にレコードをロードまたは作成し、秘密をメモリに保持するため、リクエスト認証は同期である。レコードの削除または置換は次の Connection アクティベーションで有効になる。Cookie は絶対の発行/失効インターバルを運び ( `cookieMaxAgeDays` によりデフォルト 30 日)、正規化されたホスト名とポートを、決定論的な名前と署名済みペイロードの両方に束縛する。それらは host-only、`Path=/`、`HttpOnly`、`SameSite=Strict` であり、index リクエストを受け取ったリスナーが TLS を提供する場合にのみ `Secure` を運ぶ。決めるのはそのリスナー自身のプロトコルだけで、`publicUrl` の告知や転送ヘッダーは決して使わない。

HTTPS の Cookie 名と署名対象 (audience) は `https:` スキームを含むため、HTTP Cookie は同じホスト名とポートであっても TLS リスナーを認証できない。デフォルトポートはリスナーのスキームの下で正規化される。既存の HTTP Cookie の audience は変わらない。

認証の前に、すべてのリクエストは `src/api-request-trust.ts` を通る。その `Host` はループバックであるか、任意のポートでリスナーのバインド IP リテラルと等しいか、`trustedHosts` エントリーに一致しなければならない: `host:port` では完全一致、ポートなしエントリーでは任意のポート。Host と設定されたエントリーは、WHATWG のデフォルトポート正規化のためにリスナーのスキームを使い、転送ヘッダーや `Origin` は使わない。付随する HTTP(S) の `Origin` は同じ権限を名指さなければならず、Host はその Origin のスキームの下で解析される (HTTP アップストリームの先の HTTPS プロキシをサポートするため)。`sec-fetch-site: cross-site` は拒否される。不正な形式の設定済み権限はプラグインロードを失敗させる。`allowsRemoteAuthorities` は `trustedHosts` が非ループバック権限を許可するかを報告する。バインド IP の受け入れはそのリストを変えない。これらのチェックは DNS リバインディングとクロスサイトブラウザーリクエストを防御する。それらはアイデンティティを確立することは決してない。Host/Origin チェックの失敗は 403 を返し、信頼されているが未認証のリクエストは 401 を返す。`dsh web --host 0.0.0.0` はサポートされない。決定記録: [browser request trust](../../../.agents/notes/implemented/architecture/2026-07-28-api-browser-trust-boundary.md) と [browser token authentication](../../../.agents/notes/implemented/architecture/2026-08-24-browser-token-authentication.md)。

すべてのリクエストは 1 つの Peer を代弁する。`PeerScope` は、`principal` が呼び出し元を名指し、`interactions` が転送イベントへの参加を統治し、`signal` がそのスコープの終了時に abort する。`ctx.connection.browserPeer` は認証済みブラウザー接続で共有され、所有者 principal を持ち、デフォルトで `interactions: 'answer'` である。`ctx.connection.admit(request)` は信頼とブラウザーまたは API の認証をチェックし、クレデンシャルのライブ Peer または拒否を返す。`/api` ルートと Gateway WebSocket アップグレードはこのアドミッションを使う。ハンドラーは呼び出しの Peer を受け取る。`ctx.connection.createPeer({ principal, interactions? })` は独立したプロセス内 Peer を作成し、サービスを読んだ Context とともに、またはそれより早く自身の `dispose()` によって破棄される。省略された interactions は `answer` にデフォルトする。エクスポートされた `Peer` クラスは同じオプションを受け入れる。`fetch(request, peer)` と HTTP ブリッジは Peer を明示的に取る。正確なルートは非所有者 Peer に 403 を返す。他の principal のメソッドレベルアクセスは [`dsh-api-remote-access`](../../api/remote-access/README.md) に属する。

`GET /connect?token=...&interactions=answer|none` を使うのは API 呼び出し元だけである: これは所有者 principal の Peer を即座に作成し、Mux の宛先と署名済み API Cookie を伴う 302 を返す。API 接続はデフォルトで `none` である。不正または繰り返された宣言は 400 を返す。HTTP が WebSocket 確立に先行してもよい。1 つの API ソケットがクリーンアップを所有する: 重複アタッチは 409 を返し、クローズはその Peer を除去し、その Cookie を使う以降の HTTP は拒否される。すでに許可された単項呼び出しはリクエストレベルのキャンセルを保持するが、`invocation.peer.ctx` は Peer が破棄された後にエフェクトを登録できない。API 呼び出し元は Cookie をブラウザーストレージとは別に保つ。権限固有の Cookie 名は共有される。

認証済みの共有 HTTP リクエストは、ボディ転送の前に `connection/request` waterfall を通る。リスナーは新しいリクエストを拒否してもよく、レスポンス完了まで `next()` を await してもよい。所有ファイバーを除去するとアドミッション動作が除去される。デスクトップはこのフックを使い、承認されたインストール中に新しい API 作業をロックするが、すでに許可された作業はキャンセルしない。クライアントの切断はハンドラーシグナルを abort する。ブリッジはソケット書き込みを停止し、残っているレスポンスチャンクをドレインする。WebSocket ストリームの所有権は API Gateway に残る。

<a id="connection-generation"></a>
## 接続世代

`installConnection` は、明示的に供給されない限り、`interactions` をページには `answer` に、非ページ呼び出し元には `none` に解決する。答える (answering) Client だけが、`$on` リスナーの存在にかかわらず、内部の `$events` 論理ストリームを唯一の世代ソースとして登録する。Host は API Remotes ソースファクトリーですべてのインクリメンタルリスナーをアタッチしてから、イベントの前に 1 つの `{ type: 'ready', clientId, host: { home } }` アイテムを送る。`ConnectionController` は ready アイテムが到着した後にのみその世代を公開して `onConnected` を呼ぶため、ベースライン取得がインクリメンタル観測より先に競走することはない。

終了した `$events` ストリーム、Remote ストリームエラー、ready でない冒頭アイテム、または不正形式のイベントアイテムは、現在の世代を無効にする。保留中のハンドシェイクは 3 秒後に遅い Host の警告をログし、デフォルトでは 15 秒後にレディネスタイムアウトをログして abort する (物理ソケットを待つ時間も含む)。ソースは、置換が始まる前に、配信を停止し、リソースを解放し、キャンセル後に決着しなければならない。キャンセルされたソースからの遅いレディネスは世代を公開できない。ブラウザーがネットワーク可用性を報告している間、コントローラーは `connecting` を公開し、500ms、1s、2s、4s、8s、10s の上限の下で 50%–100% のジッターを伴って再試行し、回復するまで最終上限で続ける。各再試行は Gateway に物理 WebSocket を 1 回置き換えるよう求め、`$events` を再び開く。

`ctx.connection.reconnect()` はアクティブな作業を中断し、シーケンスをリセットし、再試行 1 を即座に開始する。ブラウザーの `offline` はアクティブな作業を abort し、`disconnected` を公開し、自動試行を停止する。次の `online` 遷移がシーケンスをリセットし、500ms の段から開始する。`connected` を公開するのは ready アイテムだけである。Gateway mux は独立した再試行スケジュールを持たない。

Host の Connection 行の `config.recovery` を設定して、再試行上限、成長係数、またはハンドシェイク警告とキャンセルの時間を上書きする。[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-client-connection)が受け入れられるフィールドを列挙する。Host はこれらの値を検証し、提供する各ページに注入する。Client は Connection を提供する前にブートストラップデータを検証し、Gateway がループを開始するときにそれらのデフォルトを使う。明示的な `start()` のタイミング上書きが優先される。成長係数は有限で 1 以上でなければならない。警告より前に起こるレディネス、失敗、キャンセル、またはハード期限はその警告をキャンセルする。Host のリカバリー設定変更後はページをリロードする。


<a id="model-experience"></a>
## モデル体験

なし。wire コンシューマー層はすでに構成済みのメッセージをブラウザーと Host の間で移動させるだけであり、ここにあるものはモデルリクエストに到達しない。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立てることも送信することもない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **バッファリングされる `/api` ルートは各リクエストボディをメモリに保持する** — `maxRequestBodyBytes` (デフォルト 300 MiB。デフォルトの 200 MiB 集約画像上限の base64 展開後とエンベロープのヘッドルームを見込んだサイズ) が通常の画像と RPC のエンベロープを制限する。オプトインのストリーミングルートは背圧のかかったチャンクを受け取り、集約上限を迂回する。ルート実装が永続化、キャンセル、ストレージクォータを所有する。
- **プレーン HTTP リスナーはベアラー Cookie を転送中に露出する** — そのようなデプロイメントはブラウザー Cookie を `Secure` にできないため、同じ権限をネットワーク越しに提供するとセッション Cookie が漏れうる。Cookie を `Secure` とし TLS に限定するには、Web キャリア ([`dsh-host-webserver`](../../host/webserver/README.md)) に TLS を設定する。
- **未使用の API Peer は Host シャットダウンまで残ることがある** — 呼び出し元が WebSocket を確立しない軽量レコードには、接続期限やアイドル回収が課されない。Cookie の失効は依然として新しいリクエストを拒否する。API 呼び出し元は、所有ソケットが閉じた後や Host 再起動後に `/connect` を通じて再接続しなければならない。
- **ログアウト操作は存在しない** — ブラウザー Cookie をクリアすると 1 つのブラウザーセッションが終了する。オーナークレデンシャルレコードを削除して `dsh` を再起動すると、すべてのセッションが失効する。


<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
