---
description: "Host とブラウザー Client の Cordis ランタイム向けの実験的 Chrome DevTools 検査。Console 評価、Sources、Network キャプチャ、Elements ツリー、CDP 非依存のクエリ API を含む。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-inspector

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

実行中の 1 つの dsh Host とそのブラウザー Client を Chrome DevTools で検査する: Host と Client の Console コンテキスト、Host の Sources とデバッグ、キャプチャされた Host の fetch、共有の Cordis ツリー。すべての CDP 状態は Worker にある。

オプションの[開発者ツールバンドル](../inspector-profile/README.md)は、Host の fetch キャプチャを含む NodeJS Inspector と Session Log の両方を有効にする。Web の起動は `--inspect` を要求も受け付けもしない。

## 目次

- [このパッケージを使う](#use-this-package)
- [ランタイムレイアウト](#runtime-layout)
- [設定](#configuration)
- [観測 API](#observation-api)
- [Cordis ツリー検査](#cordis-tree-inspection)
- [Host の fetch キャプチャ](#host-fetch-capture)
- [セキュリティ](#security)
- [モデル体験](#model-experience)
- [既知の制限と延期された作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

信頼されたローカル開発では、`pnpm run demo:inspector` が通常の Web プロファイルを通じてソース overlay を明示的にマウントする。Host はデバッグ URL を出力し、そのターゲットを検査するには Chrome が必要である。fetch キャプチャには秘密情報が含まれ、ローカルのデバッグエンドポイントは任意のコード実行を許す。

バンドルは `experimental-inspector` を `disabled: false` に、`captureFetch: true` とともに設定する。Host のオプションの `--inspect` 引数フックは外部 Chrome ウィンドウを開くだけで、Inspector が実行されるかどうかは制御しない。

このコンポーネントが有効なとき、**Ctrl/Cmd+Shift+.** が全幅の下部パネルで **NodeJS Inspector** をトグルする。Session の選択は不要である。上端をドラッグしてサイズを変更でき、上のコンテンツからスペースを取る。選択した高さは折りたたみとナビゲーションをまたいで保持される。フォーカスされた divider は Up/Down、Home、End も受け付ける。その iframe は最初のオープンでロードされ、折りたたみ中も Session やメインパネルのナビゲーションをまたいでもマウントされたまま残り、コンポーネントのアンロードでリセットされる。X ボタンとショートカットは、開いたコントロールが接続されたままの場合、そのコントロールにフォーカスを戻す。iframe は自動的にこの Host に接続し Console を開く。手動の Connection パネルは省略される。各埋め込みフロントエンドは Console、Sources、Cordis ツリーで Host と、その埋め込みページの Client だけを表示する。出力される `devtools://` URL はすべての Client を表示する。

Host はミラーリングされた DevTools フロントエンドを、アプリケーション相対の `inspector/devtools/devtools_app.html` パスで、既存の Web ログインを使って提供する。`inspector/devtools` プレフィックスはそのエントリーにリダイレクトする。GET と HEAD はファイルを提供し、存在しないリソースは 404 を返し、その他のメソッドは 405 を返す。その `cdp` WebSocket ルートは同じブラウザーセッションを認証し、この Inspector の Worker ページターゲットにのみ転送する。下部パネルは、その主張する `clientSourceId` をエントリーと自動 WebSocket エンドポイントに渡す。選択は再接続をまたいでその論理 Client に追随する。セレクターがなければすべての Client を含み、選択された Client が利用できない場合は Host が見えたままになる。空または繰り返しのセレクターはアップグレードを 400 で拒否する。明示的な `ws` または `wss` クエリパラメーターは、その選択も含めて自動エンドポイントを上書きする。

ビルドは公式の `chrome-devtools-frontend@1.0.1638082` TypeScript ソースを、ルートワークスペースにピン留めされた [Vite 依存](../../../package.json)でコンパイルする。この npm スナップショットは Chromium 150 リリースブランチの祖先であり、その後の安定版リリースの正確なコピーではない。[ソース設定](scripts/devtools/source.ts)とパッケージマニフェストがバージョンを固定する。通常の npm インストールがソースとツールチェーンを供給し、ビルドには appspot アクセス、ブラウザーのダウンロード、ブラウザーの起動、PAK 抽出のいずれも不要である。ワークスペースインストールも公開パッケージインストールも DevTools ダウンロードフックを実行しない。

[配布ビルド](scripts/build-devtools.ts)は ESM エントリー、共有チャンク、明示的な Worker、注入スクリプト、ランタイムアセットを `lib/devtools` に出力する。デプロイプレフィックスを含む、元のモジュール相対リソース URL を保持する。CSS テキストモジュール、画像変数、最小限の英語ロケール定数が、npm ソースを変更せずに GN 生成の入力を置き換える。フロントエンドはアップストリームモジュールから英語 UIStrings を直接使う。翻訳ファイルも辞書ジェネレーターもない。他の言語設定は英語に解決される。Lighthouse を含むすべてのアップストリームパネルが含まれたままである。Memory は自身のパーサー Worker を保持し、Performance は Host CPU を記録する。公開パッケージにはビルド済みアセット、整合性マニフェスト、Chromium ライセンスが含まれ、ビルド時の npm ソースや Vite 依存は含まれない。

フロントエンドはブラウザーランタイムアダプターを使い、ビルド時に Node 専用トランスポートを除外する。import map は使わない。その同一オリジン接続ブートストラップはアプリケーションエントリーに先行する。下部パネルは `disableLocaleInfoBar=true` を追加し、ブートストラップは DevTools 自身の `disable-locale-info-bar` 設定を、その言語を変えずに設定する。フロントエンドの更新には npm ピンとソース設定を同時に変更し、パネルと Worker のチェックを再実行する必要がある。互換性のないソース編集はビルドを失敗させる。

<a id="runtime-layout"></a>
## ランタイムレイアウト

Worker は live な Cordis オブジェクトに決してアクセスしない。共有の Host/Client コレクターが、トランスポート前にそれらを検証済みスナップショットへ射影する。Cordis はプラグイン構成、`ctx.inspector` 登録、ブートストラップ注入、破棄を所有する。遅れてロードされる Client は、Host が Worker を開始する前に登録する認証済み Host ルートを通じてブートストラップを取得する。リクエストは Worker の準備完了を待ってからブートストラップを受け取るか、起動失敗時は `503` を受け取る。中断されたリクエストは待機を止める。プラットフォームが Worker を実行できず、Node の `ERR_FEATURE_UNAVAILABLE_ON_PLATFORM`（ブラウザープレビューの Worker ホストなど）を報告する場合、Host は警告を 1 回ログし、プラグインはそのルートだけを備えて起動する。そのルートは `503` を返し、`ctx.inspector`、DevTools ルート、ブートストラップ注入、`devtools://` URL を提供しない。その他の起動エラーは依然としてプラグインをリジェクトする。ブートストラップのトランスポートとソースセットアップの失敗は警告し、注入された起動と取得された起動の両方で接続リセットからの回復を保つ。無効なブートストラップデータやサービス登録の失敗は起動をリジェクトする。ソースの置き換えは、別のソースをクレームする前に古いサービス Consumer のクリーンアップに参加し、アクティブなプラグインのアンロードは保留中のブートストラップリフレッシュをキャンセルする。

Host プラグインは Worker を起動し、専用の `MessagePort` を接続する。Client は注入または取得したブラウザーソースパラメーターを使って、Worker への認証済み WebSocket を直接開く。DevTools URL は受け取らない。Chrome DevTools は Worker の CDP WebSocket に接続する。DevTools 接続ごとのプライベートな `node:inspector.Session` が Worker から Host メインスレッドにアタッチするため、Host の JavaScript が一時停止している間も Host のデバッグが利用できる。

ソースツリーはこれらの実行環境に従う。`client/` と `host/` はミラーリングされたアダプターのエントリーパスを提供し、`worker/` は Worker スレッドのオーケストレーションと Chrome プロトコル状態のみを含み、`shared/` は環境非依存の Cordis とネットワークのモデル、正規化された realm バックエンドインターフェース、内部ブリッジプロトコルを含む。Worker 側の Client と Host のアダプターは `worker/realms/` の下にミラーリングされる。そのディレクトリにある Client アダプターも Worker 内で実行される。

Host と Client のプロデューサーは CDP メッセージではなく内部観測レコードを送る。レコードはソース世代、シーケンス、ソースクロックのタイムスタンプ、トピック、JSON ペイロードを含む。Worker はすべてのプロセスまたはネットワークのフレームを検証し、ソース状態と保持を所有し、認識されたトピックを標準 CDP ドメインに翻訳する。

Client ソースは型付きの Runtime、Console、読み取り専用 Sources ケイパビリティを宣言する。`Runtime.enable` はデフォルトの Host 実行コンテキストと、その DevTools 接続に含まれる接続済み Client ごとに 1 つの合成コンテキストだけを公開する。Node の内部コンテキストと追加の VM コンテキストは列挙されない。Client コンテキストを選択すると、評価、プロパティアクセス、関数呼び出し、promise の await、オブジェクトの解放がそのブラウザー realm にルーティングされる。Client の Console 引数は同じセッションローカルのオブジェクトテーブルを使い、`Debugger.enable` はビルド済みの `lib/client.js` カタログを公開し、`Debugger.getScriptSource` は有界のコンテンツチャンクを読む。ソースマップ URL は、ロードされたスクリプトの `sourceMappingURL` トレーラー（combo URL とデプロイプレフィックスを含む）から来る。Client スクリプトのブレークポイント、ステップ、コールフレームは引き続きサポートされず、ターゲット全体の一時停止と再開は Host デバッガーのみを制御する。

Client は `pagehide` で同期的にソースを閉じ、キャッシュされたページからの復元後に `pageshow` で同じ論理 identity で再接続する。live なページをバックグラウンドに切り替えても切断されない。閉じた世代は遅延した実行コンテキストやスクリプトカタログを公開できない。

両方のプラグインフェイスは同じブラウザーセーフな Cordis コレクターを実行する。それは到達可能な Context と Fiber のオブジェクトをバージョン付きの `CordisTreeSnapshot` に変換し、Worker がその CDP 非依存の表現を保存して、各 Host または Client ソースを Elements パネルに射影する。

<a id="configuration"></a>
## 設定

Host プラグインは `webServer` と `connection` を注入し、以下のフィールドを受け付ける:

| フィールド | デフォルト | 意味 |
|---|---:|---|
| `host` | `127.0.0.1` | Worker エンドポイントのバインドアドレス。受け付けられるのは loopback のみ |
| `port` | `9230` | 最初の Worker エンドポイントポート。占有されたポートは上へ進み、`0` は OS 割り当てポートを要求する |
| `clientOrigins` | `[]` | `/ingest` が受け付ける追加の正確なブラウザーオリジン。loopback オリジンは引き続き受け付けられる |
| `captureFetch` | `true` | `globalThis.fetch` をラップし、以降のすべての呼び出しを公開する |
| `maxRequestBodyBytes` | 8 MiB | リクエストごとにキャプチャされるリクエストボディのプレフィックス |
| `maxResponseBodyBytes` | 32 MiB | リクエストごとにキャプチャされるレスポンスボディのプレフィックス |
| `maxBodyChunkBytes` | 48 KiB | base64 エンコード前に 1 つのボディレコードが運ぶ生バイト |
| `maxJournalBytes` | 256 MiB | Worker が保持するリクエストとレスポンスのボディバイト |
| `maxRetainedRequests` | `2000` | Worker が保持するアクティブおよび完了済みリクエスト |
| `maxSourceFrameBytes` | 128 KiB | エンコードされたソースフレームの制限 |
| `maxSourceRecordsPerFrame` | `128` | 1 つのソースバッチ内のレコード数 |
| `maxQueuedRecords` | `2048` | トランスポートを待つプロデューサーごとのレコード数 |
| `maxQueuedBytes` | 16 MiB | プロデューサーごとにキューに入れられたエンコード済みバイト |
| `startupTimeoutMs` | 10 秒 | Worker 準備完了の期限 |
| `stopTimeoutMs` | 5 秒 | 終了前のグレースフルな Worker シャットダウンの期限 |
| `clientReconnectBaseMs` | 250 ms | 最初の Client 再接続バックオフの上限 |
| `clientReconnectMaxMs` | 5 秒 | Client 再接続バックオフの最大上限 |
| `clientRuntimeTimeoutMs` | 30 秒 | Worker から Client への 1 つの Runtime または Sources コマンドの期限 |
| `queryTimeoutMs` | 10 秒 | 1 つの非 CDP セマンティッククエリの期限 |
| `maxClientRuntimeObjects` | `10000` | DevTools 接続ごとに保持される live な Client オブジェクトハンドル |
| `maxClientRuntimeProperties` | `2000` | 1 回の Client オブジェクト検査が返すプロパティ記述子 |
| `maxClientSourceBytes` | 8 MiB | 1 つの Client スクリプトまたはソースマップから読むエンコード済みバイトの最大値 |
| `maxCordisNodes` | `2048` | 切り詰め前に 1 つの realm スナップショットから受け入れる Context と Fiber ノード数 |
| `maxDisconnectedCordisTrees` | `8` | 非 live スナップショットとして保持される最後の切断済み realm ツリー数 |

生成される[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-experimental-inspector)が、受け付けられるフィールドとその宣言の網羅的なソースである。

Host は Worker がリッスンを開始した後に `devtools://` URL をログする。同じ Worker が `/json`、`/json/list`、`/json/version`、`/devtools/page/<id>` 配下のターゲット WebSocket、および `/ingest` の Client ソースを提供する。

<a id="observation-api"></a>
## 観測 API

両方のプラグインフェイスは同じサービスを提供する:

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { InspectorJsonValue } from '@deepseek-ai/dsh-experimental-inspector'

declare const ctx: Context
declare const topic: string
declare const jsonPayload: InspectorJsonValue

ctx.inspector.publish(topic, jsonPayload)
await ctx.inspector.cordis.getTree()
```

Publish はロスレス JSON を検証し、Worker を待たずに配信をスケジュールする。各ソースは有界キューを持つ。オーバーフローはシーケンスギャップとして報告され、観測対象のアプリケーション操作を決して遅延させない。`cordis.getTree()` は CDP セッションを作成したり Runtime、Debugger、Sources を有効にしたりせずに、Worker の最新のデタッチされたセマンティックスナップショットを読む。

<a id="cordis-tree-inspection"></a>
## Cordis ツリー検査

Elements ドキュメントは固定の `<host>` と `<clients>` コンテナーを持つ。`<host>` は Host のルート Context を含み、`<clients>` は Client ソースごとに 1 つの `<client>` を含み、各 `<client>` はその realm のルート Context を含む。Cordis のルート Fiber は省略される。Cordis のサービス呼び出し `shadow` ラッパーを取り除いた後、他のすべての Fiber は `fiber.parent` の子であり、`fiber.ctx` 用の Context の子をちょうど 1 つ持ち、`uid="<Cordis Fiber.uid>"` のみを運ぶ。Context 要素は属性を持たない。Context のみの `extend()`、`isolate()`、`intercept()` レイヤーは直接の Context 子孫のままである。

Host と Client は同じネストされた `CordisTreeSnapshot` 型を公開する。Context と Fiber ノードは realm ローカルのオブジェクト検索のための不透明オブジェクトハンドルを運び、Fiber ノードはさらに Cordis の `uid` を運ぶ。Worker はそれらの realm スナップショットを 1 つの `{ host, clients }` 検査ツリーに構成する。ソース世代ごとに `BackendNodeId` 値を割り当て、各 DevTools 接続は自身の `NodeId` 値を割り当てる。`DOM.resolveNode` は所有する Host または Client の Runtime に接続ローカルの `RemoteObjectId` を尋ねる。`DOM.requestNode` はそのオブジェクト id を同じ Elements ノードに逆マップする。`ctx.inspector.cordis.getTree()` と `DSHInspector.getCordisTree` は、ハンドルや CDP id をルーティングせずに、デタッチされた Consumer 中立のツリーを読む。

ノード配信は DevTools 接続ごとに深さ制限される。呼び出し元が `depth` を省略した場合、`DOM.getDocument` は 3 つのドキュメントレベルを提供し、保留されたレベルは `childNodeCount` を通知し、展開は `DOM.requestChildNodes` を通じてそれらを取得する（サブツリー全体には `depth: -1`）。繰り返しの展開リクエストは欠落した子リストのみを配信し、既存のフロントエンドノードオブジェクトと深くロードされた子孫を保持する。`DOM.performSearch`、`DOM.requestNode`、`DOM.pushNodesByBackendIdsToFrontend` から出ていく NodeIds は、まず未送信の祖先レベルを `DOM.setChildNodes` イベントとしてプッシュする。

ソースは完全なスナップショットを公開し、Worker は DevTools に通知する前に安定したバックエンドノード identity を比較する。変更されていないスナップショットは DOM イベントを発しない。既知のノードの未配信子リストへの変更は `DOM.childNodeCountUpdated` のみを送り、それを展開すると完全な現在の子リストを取得する。配信済みの子リストはノードレベルの挿入と削除のイベントを受け取り、挿入ノードのペイロードはそのサブツリーを保留し、兄弟の並べ替えはその親の子のみを置き換える。属性の変更は配信済みノードのみを対象とする。ドキュメントを再取得すると配信済みの深さが置き換わる。`DOM.describeNode` はノードをフロントエンドツリーにアタッチしない。既存の `NodeId` 値と影響を受けていない Elements の展開は安定したままである。

Client が切断すると、その Console 実行コンテキストと live オブジェクト id は即座に破棄され、Console のコンテキストセレクターから取り除かれる。切断ツリー保持が有効な場合、Elements は最後のツリーを保ち、その `<client>` 要素に真偽値の `disconnected` 属性を追加する。再接続は論理ソース id を保ち、新しいトランスポート世代に新しい合成 CDP コンテキスト id を作成し、その完全なスナップショットが古いツリーを置き換えると属性を削除する。属性の変更は DevTools をリフレッシュせずに段階的に届く。Client は論理 id を `sessionStorage` に保持し、ページのライフタイムにわたって Web Locks を通じてそれをクレームするため、リフレッシュは id を再利用し、複製された live タブは新しい id を受け取る。Worker はそのようなスナップショットを最大 `maxDisconnectedCordisTrees` 個保持し、0 なら即座に削除する。

<a id="host-fetch-capture"></a>
## Host の fetch キャプチャ

fetch キャプチャはデフォルトで有効であり、完全な URL、すべてのリクエスト/レスポンスヘッダー、リクエストボディ、レスポンスボディ、ステータス、タイミング、エラー、キャンセルを記録する。認証情報、Cookie、クエリ値、ペイロードをマスクしない。ボディキャプチャはクローンを読むため、呼び出し元は元の fetch が解決するとすぐに元の Response を受け取る。

設定されたボディ制限はフィールドの選択ではなく保持を制限する。キャプチャはプレフィックスを保ち、結果を切り詰め済みとしてマークする。`Network.getRequestPostData` と `Network.getResponseBody` は Worker が保持するバイトを読む。`Network.streamResourceContent` はバッファー済みプレフィックスを返し、その DevTools 接続の `Network.dataReceived` に以降のレスポンスバイトを追加する。これが live な Response と EventStream ビューを駆動する。直接の Undici Client/Dispatcher 呼び出しと、プラグイン有効化より前に保持された fetch 参照はこのオブザーバーの対象外である。

レスポンスヘッダーが到着した後、呼び出し元側の abort はオブザーバーのクローンを停止できる。キャプチャ済みバイトは `Network.getResponseBody` を通じて利用可能なままで、キャプチャメタデータがエラーと切り詰めを記録し、fetch が Response を返したため CDP は `Network.loadingFinished` を発する。レスポンスヘッダーより前の fetch リジェクトは `Network.loadingFailed` を発し、abort の場合は `canceled: true` を伴う。

<a id="security"></a>
## セキュリティ

Client の選択は、1 つの DevTools 接続の realm セッション、DOM 射影、診断クエリを制限する。収集を停止したり、共有の観測 API を変えたりはしない。これは表示フィルターであり認可ではない。信頼されたデバッグユーザーはフィルターなしの接続を開くことができ、Host の評価は既存の権限を保持する。

CDP ターゲットは `Runtime.evaluate` を通じて Host と接続済み Client realm の両方に任意のコード実行を許し、Host の Debugger 操作はさらなる制御を提供する。完全な fetch キャプチャには秘密情報が含まれる。したがって Worker は `127.0.0.1` のバインドアドレスのみを受け付ける。Client の ingest はさらに、Host が注入するランダムな WebSocket サブプロトコルトークンを必要とし、明示的に構成されない限り非 loopback オリジンを拒否する。CDP ソケット自体はトークンを持たず、loopback バインドがその唯一のアクセス制御である。

<a id="model-experience"></a>
## モデル体験

なし。この開発者専用 Inspector はモデルリクエストを変えずにランタイムアクティビティを観測する。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストの組み立てや送信を行わない。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>

- **Memory と Performance は Host を検査する** — Memory は Host ヒープをキャプチャし、Performance は Host の CPU サンプルを記録する。Client Runtime コンテキストはブラウザーのヒープスナップショットやレンダリングトレースを公開しない。
- **同一オリジンリレーは Host メインスレッドで動作する** — Host の JavaScript を一時停止するとこのリレーも一時停止する。ブレークポイントデバッグと再開制御には、出力された直接の Worker DevTools エンドポイントを使う。
- **Client のアクティブデバッグはサポートされない** — Console イベント、Runtime 評価、RemoteObject アクセス、読み取り専用 `lib/client.js` Sources は動作する。Client スクリプトのデバッガーリクエストは明示的な unsupported エラーを返す。ターゲット全体の一時停止と再開は Host のみを制御する。
- **Client Sources が公開するのは Inspector バンドルのみ** — 他のページスクリプトはこのパッケージではカタログ化されない。
- **Client の評価はページの JavaScript を使う** — ページの Content Security Policy が動的評価をブロックしうる。また合成コンテキストは DevTools のコマンドラインヘルパーやネイティブ REPL の宣言セマンティクスを提供しない。
- **Client identity の調停には Web Locks が必要** — その API を持たないブラウザーは `sessionStorage` を通じて再接続とリフレッシュの identity を保つが、同じストレージ状態からコピーされた 2 つの同時 live タブを区別できない。
- **fetch のインターセプトは `globalThis.fetch` を対象とする** — 直接の Undici API と有効化より前に保持された fetch 参照は観測されない。
- **ボディのクローンにはコストがある** — 完全キャプチャは設定された制限までリクエストとレスポンスのストリームを tee し、メモリと I/O の負荷を増やしうる。保持ボディ制限にはストリーム tee 内部のバッファリング（大きすぎるソースチャンクや、遅いアプリケーションリーダーのためにキューに入れられたデータなど）は含まれない。
- **自動 Worker 再起動はない** — 予期しない Worker の終了は現在の Inspector インスタンスを失敗させる。ライフサイクル回復は後の変更に属する。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
