---
description: "型付きの Client から Host への呼び出しとストリーム: ディスパッチ、検証、キャンセル、再接続、および転送される Host イベント。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-gateway

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Host と Client の Cordis 環境のための両面 Typert RPC endpoint。Host エントリは `ctx.typertGateway` を提供し、`@deepseek-ai/dsh-api-gateway/client` は `ctx.remote` を提供する。両者は同じ生成された `InvocationDescriptor` 契約を消費し、ビジネスの選択は API Remotes に委ねる。Connection はユニタリー呼び出しの相関、信頼、レスポンス envelope を運び、Gateway は多重化された Remote ストリームを所有し、各ストリームは同じ論理ストリーム上で Client から Host への uplink を運ぶ。

## 目次

- [Host サービス: `TypertGatewayService` (ctx key: `typertGateway`)](#host-service-typertgatewayservice-ctx-key-typertgateway)
- [Client サービス: `ClientRemote` (ctx key: `remote`)](#client-service-clientremote-ctx-key-remote)
- [モデル体験](#model-experience)
- [既知の制限と延期された作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="host-service-typertgatewayservice-ctx-key-typertgateway"></a>
## Host サービス: `TypertGatewayService` (ctx key: `typertGateway`)

`ctx.typertGateway.invoke()` は、呼び出しごとに現在のディスクリプターと Cordis Service を解決し、正確な名前付き引数を検証し、登録されたオブジェクトまたは Context の同一性を解決し、公開ビジネスメソッドを起動する。ビジネス Service は `TypertRemoteService` を拡張し、[`dsh-typert-protocol`](../../typert/protocol/README.md) の `@Remote` または `@RemoteScope` でメソッドをマークする。別の基底クラスが継承を所有する場合は `bindTypertRemote()` が引き続き利用できる。

厳格モードは `ctx.typert.local` から生成された起動ディスクリプターを読む。ルックアップパラメーターは `ctx.typert.lookups` の現在アクティブなリゾルバーを使う: ビジネスパッケージが安定した宣言とデフォルトポリシーを登録し、Host コンポジションはエフェクトスコープの `configure()` で解決挙動を上書きできる。`@RemoteScope` は登録された Host Context アダプターを通じてそのレシーバーを解決する。SRC モードは、厳格な定義を一度も持ったことのない endpoint のための開発用フォールバックである。単純なパラメーター名を解析し、ルックアップ以外のパラメーターについては JSON 安全な値だけを受け入れる。観測された厳格定義の撤回は、検証を弱めるのではなく失敗する。ユニタリー結果について、Gateway は生成されたコーデックの `encode()` が存在すればそれを実行し、そうでなければ厳格な JSON 値をそのまま保つ。SRC は実行時のバイト値を再帰的に検出する。どちらのパスも JSON 互換のメタデータと結果相対のバイト添付を Connection に返し、トランスポートのフレーミングに使わせる。

Host エントリは、Connection の共有 `/api` FetchHandler に信頼済みホストインターセプターを登録する。Connection はこの複合ハンドラーをその HTTP ブリッジを通して渡す。ハンドラーはクレームされた endpoint を Gateway にディスパッチし、クレームされていないリクエストには 404 を返す (正確な Fetch ルートが所有する場合を除く)。直接の `invoke()` 呼び出しはビジネスエラーを保持する。`TypertGatewayError` は `RemoteError` のサブクラスであり、その `gateway/*` コードはディスパッチ、バインディング、プロバイダー、ルックアップ、Context、引数、コーデック、uplink が所有する失敗を名指す: バッファーされたフレームが `streamInboxBytes` を超えた uplink には `gateway/uplink-overflow`、`end` の後の uplink 項目には `gateway/protocol`、拒否された uplink 項目にはコーデックコード `gateway/input-invalid`。ポリシー上の理由 — コールドレジュームの失敗や所有権フェンス — で拒否するリゾルバーは自身の `RemoteError` を throw し、それが選んだコードがそのまま呼び出し元に届く。

すべての呼び出しはそれが代弁する Peer を指名する: `InvokeRemoteRequest.peer` と `wireStream.open()` の `peer` 引数は必須であり、Gateway がデフォルトの Peer を供給することは決してない。破棄された Peer からのディスパッチは、ユニタリー呼び出し、ストリーム、`$events`、`$events/result` のいずれでも `gateway/peer-disposed` で失敗し、wire パスはペイロードを読む前にそれをチェックする。Host サービスは `remoteAccess` を注入し、[`dsh-api-remote-access`](../remote-access/README.md) なしでは起動しない。endpoint と引数フィールドのチェックの後、すべての呼び出しはその JSON 引数を Typert コンパイル済み型に対して 1 回検証し、失敗すると `gateway/input-invalid` になり、ディスパッチは検証済みの値を再利用する。Peer のプリンシパルが owner でない呼び出しについては、その検証の後、ルックアップと Context 解決の前に、Gateway は呼び出しが触れるリソースを解決し、endpoint を action、検証済み引数を `args` として `ctx.remoteAccess.decide({ principal, action, resources, args })` を問い合わせる。リソースが無効な場合は問い合わせずに理由 `resource-invalid` で拒否する。拒否された呼び出しは details `{ action, reason }` とともに `remote-access/denied` を throw するため、拒否された呼び出しはどの Session もアクティブ化する前に失敗する。owner の呼び出しはリソース解決も判定もなしにディスパッチされる。

リソースは Typert コンパイル済み型に対して検証された引数から読まれる。それらの型は宣言していないオブジェクトフィールドを落とすが、ルックアップと Context の同一性は wire 値を保つ。リソース kind ごとに、メソッドの `@Remote({ resources })` または `@RemoteScope(key, { resources })` オプション内のリーダーが優先される。それはメソッドの位置引数 (ルックアップ位置は wire の同一性を、キャンセル位置は呼び出しのシグナルを保持する) とともに呼び出され、ルート Service インスタンスのクラスメタデータから読まれる。そうでなければ、プロバイダーが `resource` を通じてその kind を宣言しているすべてのルックアップパラメーターがその wire 同一性を寄与し (省略された省略可能パラメーターは何も寄与しない)、Host Context アダプターがその kind を宣言している Context メソッドは Context の同一性を寄与する (Context が解決される前の引数から読まれる)。それもなければ、`typert.resources` に登録されたその kind のデフォルトフィールドが、同名のトップレベル引数から、それがなければ最初のオブジェクト引数から読まれる。throw するか空リストを返すリーダー、配列を保持するデフォルトフィールド、または空でない文字列でない同一性 (Context の同一性を含む) は、解決を `invalid` にする。どのリソースも指名しない呼び出しは `global` リソースだけに触れ、リソースを指名する呼び出しはそれらだけに触れる。転送されるイベントはそのエントリーが宣言するすべてのリソースを運ぶため、そこでは `undefined` を返すリーダーも解決を `invalid` にする。一方、リーダーのないエントリーは `global` に触れる。

キャンセル対応の Remote メソッドは、最後の Host パラメーターとして `signal: AbortSignal` を宣言する。シグナルは wire 引数ではなくディスクリプターのメタデータである: Connection がそれを Gateway に供給し、Gateway がデコードされたビジネスパラメーターの後にそれを注入する。SRC は予約された最後の名前を認識し、厳格生成はさらにグローバルの `AbortSignal` 型を要求する。

ストリーム Remote は `@Remote({ mode: 'stream' })` を使い、`Iterable` または `AsyncIterable` を返す。`ctx.typertGateway.stream()` はユニタリー起動と同じ endpoint、引数、ルックアップ、キャンセルのチェックを適用し、ビジネス項目に対するキャンセル対応の iterable を返す。Client はそのプラグインのアクティブ化時に Gateway 所有の `/api/remote.mux` WebSocket を開き、アイドル中も接続を保つ。再試行スケジュールは Connection が所有し、各再試行の前に mux に候補またはアクティブなソケットのキャンセルを求め、ちょうど 1 回の新しい物理的試行を行わせる。Host は設定された `websocketHeartbeatIntervalMs` 間隔 (デフォルトでは 2 秒) で Ping 制御フレームを送り、ブラウザーは WebSocket プロトコル層で Pong を返すため、アイドル状態のネットワーク仲介者は Remote ストリームのフレームなしにトラフィックを目にする。Pong、受信した任意のフレーム、または満杯のローカル送信バッファーで待機した後に完了したダウンリンク書き込みはピア活動として数えられる。2 つの Ping 間隔にわたって活動のないソケットは終了されるため、データの後ろに Pong が遅れる混雑したリンクは接続を保つ。独立してキャンセル可能な論理ストリームがそのソケットを共有し、プロセス内 Connection キャリアはそれを開かずに同等のストリームを直接提供する。

ランチャーが `ctx.appReady` を供給する場合、Gateway はアプリケーションの起動が成功した後にのみ WebSocket アップグレードルートを登録する。それより前の接続試行は Connection の再試行ポリシーが扱うキャリア障害のままとなるため、再起動中の Host はコントローラーがまだ初期化中にストリームを受け入れられない。アンロードは保留中のレディネスサブスクリプションをキャンセルし、登録済みのキャリアを閉じる。`appReady` を持たない組み込み Host は即座に登録し、自身の起動順序を所有する。プロセス内起動は変わらない。

すべてのストリームは同じ論理ストリーム上で Client から Host への uplink も運ぶ。メソッドは uplink 項目型を戻り値型の第 2 型引数として宣言する。[`dsh-typert-protocol`](../../typert/protocol/README.md) の `RemoteStream<Out, In>` であり、`In` は `never` にデフォルトし、`Iterable`、`AsyncIterable`、または `RemoteStream<Out>` を返すメソッドは何も読まないことを宣言する。実行中のメソッドは自身の呼び出しを `this.ctx.invocation` として読む: Gateway はその `RemoteInvocation` — `request`、`service`、`peer`、`signal`、`uplink()` — を運ぶ Context からレシーバーを導出するため、パラメーターリストには何も入らず、Remote 呼び出しから導出されていない Context では `ctx.invocation` は `undefined` である。`uplink()` は呼び出しごとに 1 回利用できる。ディスクリプターコーデックがあれば、配信前にすべての項目をデコードする。なければ — SRC メソッド、または `In` が `never` のメソッド — JSON 安全な `unknown` 値を配信する。Client は各項目を開いている論理ストリーム上の `item` フレームとして送り、トップレベルの `undefined` 項目は `value` のない `item` フレームとして、そのハーフクローズは `end` フレームとして送る。メソッドはハーフクローズを `uplink()` イテレーションの終了として観測し、キャンセルを `signal` を通じて観測する。拒否された項目はストリーム全体を `gateway/input-invalid` (フィールド `uplink`) で失敗させる。uplink 項目はブラウザーから到着するため Host で 1 つずつ検証される。ダウンリンク項目は Host メソッドが生成した値であり、チェックなしで通過する。メソッドがダウンリンクを終えると、Gateway は uplink イテレーターを返し、未読の項目を破棄する。uplink を決して受け取らないメソッドに送られた項目は、その時まで inbox で待つ。各論理ストリームは uplink フレームバイトを最大 `streamInboxBytes` (デフォルト 262144) までバッファーする。オーバーフローはストリームを `gateway/uplink-overflow` で失敗させ、`end` の後の項目は `gateway/protocol` で失敗させる。どちらの場合もソケットは閉じない。Host がすでに終えたストリーム id に対する `item`、`end`、`cancel` フレームは破棄され、重複した `open` だけがソケットを閉じる。`$events` のような Gateway 所有のストリームは開くとすぐに uplink を返すため、その `item` フレームはバッファーされる代わりに破棄される。ユニタリー メソッドも `uplink()` を呼べる。その項目はメソッドの実行中にのみ読める。すべてのストリームは明示的に指名された Peer を代弁する: WebSocket のストリームはアップグレード時に受け入れた Peer Connection のためであり、そのスコープの破棄がソケットを閉じる。プロセス内キャリアのストリームは呼び出し元が渡す Peer のためである。ストリームメソッドの `signal` はその Peer が破棄されたときにも abort するため、ストリームは `gateway/cancelled` で終了し、`$events` ストリームはその Peer とともに終了する。すでに実行中のユニタリー呼び出しはキャンセルされない。

ストリームのキャンセルと停止は、Host ダウンリンク、Host uplink、Client uplink ポンプ上で、配信済み項目の履歴ではなく読み取りローカルの状態を保つ。ダウンリンクの完了は保留中の uplink 読み取りも起こす。

Host コンポジションは `registerRemoteEvents()` を通じて 1 つのアプリケーションイベントソースを登録できる。Gateway はそのソースのために内部の `$events` 論理 endpoint を予約し、空の `args` だけを受け入れ、ソースが撤回されたときにその登録が開いたストリームを abort する。イベント選択、引数検証、Client ごとのキュー、および開始 `{ type: 'ready', clientId, host: { home } }` フレームで送られる Host home は API Remotes が所有する。そのソースファクトリーはインクリメンタルリスナーを同期的にアタッチするため、Client はインクリメンタル配信の準備ができてから初めて世代を発行しベースライン読み取りを開始する。Peer のプリンシパルが owner でない `$events` ストリームは、応答できるスコープ付き waterfall を決して受け取らない。フレームのリーダーが指名するリソースに対して、またはリーダーのないフレームでは `global` に対して、`ctx.remoteAccess.decide({ principal, action: 'event:<name>', resources })` が許す場合にのみ、ブロードキャスト emit フレームを丸ごと、トリムされずに受け取る。リソースはフレームごとに 1 回解決され、リソースが無効なフレームは判定なしで非 owner ストリームに届かず、拒否されたフレームはそのストリームだけに対して破棄される。そのような Peer からの `$events/result` 応答は `gateway/invocation-unavailable` で失敗する。

破棄された Peer はイベントストリーム参加チェックの前に拒否される。`$events` と `$events/result` は owner と非 owner を問わず `peer.interactions === 'answer'` を要求し、拒否は `gateway/interactions-forbidden` を返す。転送される waterfall を受け取り応答できるのは owner Peer だけであり、応答は同じ Peer が所有するイベントストリームに属さなければならない。`hasLiveClient()` はキャンセルされていない owner の応答ストリームをチェックする。非 owner のブロードキャストストリームと裸の WebSocket は数えない。キャンセルは、イテレーターがクリーンアップを待っている間でもストリームを除外する。この同期観測は配信や Client プロバイダーのレディネスを保証しない。

<a id="client-service-clientremote-ctx-key-remote"></a>
## Client サービス: `ClientRemote` (ctx key: `remote`)

同じ `./client` インポートが、スタンドアロンの Node ESM `lib/client.node.js` またはブラウザーローダーファクトリー `lib/client.browser.js` を選択する。Host パッケージルートは別のままである。ブラウザーキャリアは [Connection](../../client/connection/README.md#use-this-package) が説明するシェル所有のストリームオリジンを受け入れ、論理ストリームのフレーミングとライフサイクルは変わらない。

`ctx.remote.$mount()` は生成された Host-for-Client コントリビューションを検証して登録し、呼び出し元 Cordis ファイバーのための具体的な直接メソッドとスコープ付きメソッドをインストールする。各名前空間はトレースされた `remote.<namespace>` 子 Service であり、最後のメソッドが撤回された後にアンロードされる。重複する endpoint、名前空間の衝突、および厳格な生成コーデックを持たない Client 供給フィールドは、メソッドが呼び出し可能になる前に失敗する。

各ユニタリー呼び出しは位置引数の個数をチェックし、ディスクリプターの正確な名前付き `args` を構築し、クライアント側スキーマを実行せずに `ctx.connection.rpc.call('/api', endpoint, ...)` を通じて型付き値を送る。Host はビジネス起動の前に受信した wire フィールドを検証する。生成されたストリームメソッドは `dsh-typert-protocol` の `RemoteStreamHandle<Out, In>` を返し、呼ばれたときに 1 つの論理ストリームを開く。利用可能であればプロセス内 Connection キャリアを通じ、そうでなければ共有 Gateway WebSocket を通じる。ハンドルはダウンリンクを 1 回イテレートする。`send(item)` は uplink 項目をキューに入れ、`open` フレームの後に送信する。`end()` は uplink をハーフクローズする。`dispose()` は終端フレームが到着していない限り `cancel` を送り、イテレーションを静かに終える。イテレーションから早期に抜けるとハンドルは破棄される。ダウンリンクが終了した後は `send` は throw し、`end` は無視される。生成されたキャンセル対応メソッドは最後の省略可能な `AbortSignal` を受け入れる。Client はキャリアを起動する前にそれをコントリビューションのマウントライフタイムと結合する。Client はユニタリー結果の変換をコーデックの省略可能な `decode()` に委譲する。生成されたデコーダーは、バイトペイロードをイテレート、コピー、フリーズすることなく、入れ子のメタデータとネイティブバイト型を検証する。JSON のユニタリー結果とストリーム項目は Client 側の型解析なしで通過する。コントリビューションの撤回はそのディスクリプターとメソッドを一緒に除去し、飛行中の呼び出しとストリームを abort し、保持されたメソッドハンドルを reject させる。

すべてのユニタリー呼び出しは `RemoteResult<T>` — `{ ok: true, value }` または `{ ok: false, error }` — に解決され、キャリア問題で reject することは決してない: このフェイスはオフラインのキャリアをエラーブランチに折り込み、呼び出し元のシグナルが abort したときは `gateway/cancelled` を返すため、これを回復するために呼び出しをラップするコンシューマーは存在しない。依然として reject するのはアセンブリの欠陥だけである: 誤った引数の個数、マウントされていないメソッド、撤回されたコントリビューション、欠落した Context アダプター。`error` は生きた `RemoteError` インスタンスであるため、`throw result.error` は throw の意味論を保つ。そして `isRemoteFailure(value)` はコンシューマーが必要とする唯一の述語である — それが受け入れる捕捉値は Host コードを運び、それが拒否するものは呼び出し元がクラッシュさせるべきローカルな欠陥である。`carrierFailure(endpoint, error)` と `cancelledFailure(endpoint, cause)` がそれら 2 つの折り込み結果を構築するため、このフェイスのテスト代替も同じように折り込む。

`ctx.remote.$host` は固定の Host ファクトをプレーンな値として読む: `home` (最初の ready フレームまでは undefined) と `isLoopback`。これはストアではない — サブスクリプションも世代カウンターもない — ため、再接続に反応しなければならないコンシューマーはポーリングする代わりに `connection/reset` をリッスンする。

`ctx.remote.$stream()` は物理キャリア世代をまたぐ単一コンシューマーの `RemoteStream` を返す。応答する Client には、キャリアが利用可能なまま孤立したストリーム障害の後で 1 回の即時再試行を許す。物理的な WebSocket 喪失の後は、Connection がキャリアを開き直すのを待つ。Host 世代がすでに利用不可であれば、次に接続された世代を待つ。各項目は自身の物理世代を運ぶ。パッシブ Client は `$stream()` を使えない。生成された生のストリームメソッドを呼び、終端のキャリア障害を自身で処理する。ドメインコンシューマーは各世代の開始値を検証して受け入れ、ビジネスとプロトコルの失敗は終端のままである。すべての終端失敗はこのフェイスを `RemoteError` として去る。キャリア再試行の枯渇や開始値の前に終わる世代を含め、ストリームコンシューマーはユニタリー呼び出し元と同じように判別する。`RemoteStreamCarrierError` は再試行可能な物理喪失を名指し、ドメインには `carrierFailed` コールバック引数としてのみ到達し、終端の結果として到達することは決してない。`RemoteSnapshotStream` は 1 つの開始スナップショットとそれに続くデルタを加える。`RemoteJournalStream` はページの前のフォローによるオープン、ページネーション、再接続キャッチアップ、およびドメイン定義の両端含むエントリー範囲に対するギャップ修復を加える。完全な重複を除去し、ギャップ、逆転した範囲、部分的な重複を拒否する。ドメインはカーソルなしの通知も運べる: それらは永続カーソルを進めたり修復したりせず、ギャップ修復中に受け取った通知は置換ページがコミットした後にのみ発行される。より新しい世代がその修復を置き換える場合、置き換えられた世代からの保留通知はそのページとともに破棄される。任意のストリームの破棄はそのリクエストをキャンセルし、アクティブなイテレーターが完全に停止した後に解決する。

`ctx.remote.$on()` は転送される Host イベントを 1 つ購読する。その正規のキーは Host アセンブリの転送選択そのものであり、リスナー型は所有パッケージ自身の Cordis `Events` 宣言であるため、第 2 のシグネチャがそこから逸脱することはない。各サブスクリプションは呼び出し元ファイバーに属し、それとともに消える。Client Remote サービスは、`$on` リスナーが存在するかどうかに関係なく、`connection.interactions` が `answer` のときにのみ `$events` ポンプを Connection 世代ソースとして登録する。`none` の場合、`$on()` は利用不可で、Client は物理ライフサイクルソケットだけを開く。ユニタリー呼び出しはソケットのレディネスを決して待たない。ブラウザーは Remote mux を使い、プロセス内コンポジションは `connection.rpc.open` を使う。開始 `ready` 項目が Connection 世代を確立し、その Host ファクトを供給する。キャリア障害、Remote ストリーム障害、予期しない正常完了、ready でない開始項目、または不正なイベント項目はその世代を終わらせ、Connection が継続的で上限付きのジッター付き指数バックオフの下でそれを開き直す。通常の通知は登録順で実行され、リスナーの失敗を分離する。エージェントスコープの waterfall はリスナーが結果を返す、`next()` を呼ぶ、または reject することを許す。Gateway はその結果を既存の HTTP ユニタリーキャリアを通じて返す。

Client waterfall の Context 解決は同期のままである。リゾルバーは借用された Context または `TypertOwnedValue<Context>` を返せる。Gateway はハンドラーの使用と応答の決着の後にのみ所有値を解放する。Context 解決の失敗は既存の報告と委譲の挙動を保ち、ハンドラーの失敗は拒否された応答を生成する。キャンセルは、ハンドラーがまだ使っている Context を解放せずに、遅れて届く応答を抑制する。すべてのハンドラーは `request.signal` を観測し、キャンセル後に決着しなければならない。プラグインの破棄と Connection 世代の置換は、未完了のハンドラーが決着するのを待つ。Session Context の取得自体は履歴 I/O を行わない。

`ctx.remote` は Connection ライフサイクルのコントロールを公開しない。回復を含む責任を持つコンシューマーは `ctx.connection.state` を読み、`ctx.connection.reconnect()` を直接呼ぶ。通常の Remote コンシューマーは生成された名前空間と `$stream()` にとどまる。

生成された宣言マージが、共有の `TypertClientRemote` 契約を通じて TypeScript API を提供する。Client エントリは Host Service や Host Cordis インターフェースのマージを含まず、メソッドの照会と起動は JavaScript Proxy ではなく通常のオブジェクトと関数を使う。

<a id="model-experience"></a>
## モデル体験

なし。本パッケージはアプリケーション呼び出しをディスパッチし、プロンプト、ツール、セッションイベントを何も登録しない。

#### KV キャッシュへの影響

直接の影響はなし。起動されたビジネス Service がモデル可視の結果を所有する。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>

- Connection アダプターは、ディスパッチ失敗と未分類の例外に対して空の details で `gateway/internal` を返す。owner または Gateway 自身が throw した `RemoteError` は、自身のコード、メッセージ、details を載せて wire を越える。その `cause` チェーンと `TypertGatewayError` サブクラスの同一性は、同一プロセスの呼び出し元に対してのみ保たれる。
- SRC モードは、分割代入、デフォルト、レストパラメーターのない一意の識別子パラメーターをサポートする。生成されたビジネス型ではなく JSON 安全性を検証し、省略可能フィールドを推論することは決してない。
- Client が供給するすべてのフィールドは、そのコントリビューションのマウント時に厳格な生成コーデックを要求する。SRC マーカーは Client 型投影を持たず、通常の Client コントリビューション入力ではない。
- `$stream()` はキャリアの置換を監督するが、リプレイの意味論を推論しない。再開カーソルまたは置換ベースラインの検証と通常終了の分類は各ドメインが所有する。Connection 世代は内部の `$events` ストリームを開き直し、一方向の通知は再生されないが、保留中のスコープ付き waterfall はリプレイをまたいでイベント id を保つ。
- ルックアップリゾルバーはキーごとに設定される。個々の Remote パラメーターや endpoint は、同じ `agent`/`session` キーの下で live 専用ポリシーを現在選択できない。
- 転送イベントはビジネスペイロードの投影や秘匿なしで `$on` に到達する。通常の通知は再接続後に再生されず、エージェントスコープの waterfall は Client Context の選択に必要なトップレベルの Agent 同一性だけを投影し、自身の保留ライフタイムを運ぶ。
- `websocketHeartbeatIntervalMs` は Ping ケイデンスと活動期限の両方である。Host は 2 間隔の間活動を示さないピアを終了させるため、イベントループまたはネットワークがこの間隔より長く停止し得るデプロイメントはこれを引き上げなければならない。
- 完了したキュー済み書き込みは、TCP ピアがデータを確認応答したことを示す。バッファリングするリバースプロキシの背後ではそのピアはプロキシであるため、継続的なダウンリンク中に消えた Client は、プロキシがデータの受け入れを止めた後に初めて検出される。
- Gateway は各 WebSocket ストリームの inbox 容量と JSON envelope コストを `invocation.uplinkWindow` を通じて公開する。エンコード済みフレームの inbox 上限を持たないキャリアではこれは存在しないままとなる。ドメインプロトコルはこのウィンドウを広告し、確認応答を使って飛行中のバイトを制限できる。Gateway 自体はクレジットを発行しない: メソッドが読むより速く送る Client、または uplink を決して受け取らないメソッドに送る Client は、そのストリームを `gateway/uplink-overflow` で失敗させる。uplink 項目がキャリア世代をまたいで再生されることはなく、uplink を再開しなければならないドメインは再オープンされたリクエストに自身の確認応答カーソルを載せる。


<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>

`./stream-protocol` エクスポートは、共有の Remote ストリームフレーミングとパーサーをネイティブ Desktop 呼び出し元に供給する。これらの呼び出し元はブラウザークライアントと同じ認証済み WebSocket endpoint を使う。
