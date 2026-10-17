---
description: "アプリケーション Remote アセンブリ: Client コンシューマー向けに型付き Host ケイパビリティと転送イベントを選択する。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-remotes

日本語 | [English](README.en.md) | [中文](README.zh.md)

Desktop の分析は[製品収集ポリシー](../../client/product-analytics/README.md)に従う。そのライブアプリケーション設定も含む。Web の利用は除外される。

## 概要

このアプリケーションが選択する Host Remote ケイパビリティのための両面 BFF。Host エントリーは転送イベントの選択を所有し、アプリケーションイベントソースを API Gateway に登録する。Client エントリーは生成された `/remote` 成果物をランタイム値としてインポートし、各コントリビューションを `ctx.remote.$mount()` を通じてマウントし、それらの宣言マージを再エクスポートする。Client のビジネスパッケージは、Gateway 実装や個々の Remote ランタイムエントリーではなく、このファサードに依存する。

## 目次

- [このパッケージを使う](#use-this-package)
- [転送される Host イベント](#forwarded-host-events)
- [ビルド境界](#build-boundary)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

[`@deepseek-ai/dsh-api-session-controller`](../session-controller/README.md) は、他の名前空間が使う Typert ルックアップリゾルバーを含め、Agent と Session の識別ポリシーを所有する。このパッケージは `@deepseek-ai/dsh-session` への直接のランタイム依存なしに、その生成された Session コントリビューションを選択してマウントする。アクティベーションポリシーは Session Controller に留まる。

Client アセンブリは Office 変換、Commands、資格情報、設定、Goal、Schedule、動的 Cordis、ファイルと Session の参照、読み取り専用の Host プラグインインベントリ、プラグインインストールレジストリ応答の比較、メッセージフィードバック、パーミッションプリセット、Session Controller、サブエージェント、Workspace Controller のコントリビューションをマウントする。`permissionPresets` 名前空間は、現在のセッションのコントロールが使うプロセスレベルの完全なカタログを返す。Cordis の効果所有権により、このアセンブリがアンロードされるとすべてのコントリビューションが撤回される。一方、`@deepseek-ai/dsh-api-gateway/client` は記述子検証、トレースされた名前空間サービス、直接メソッドとスコープ付きメソッド、呼び出し、ストリーム、キャンセルを所有する。Client エントリーは共有 `TypertClientRemote` インターフェースを Cordis 経由で消費し、具象 Gateway をインポートしない。Gateway Client フェイスの宣言マージを型のみで再エクスポートするので、このファサードを通じて転送イベント語彙に到達するコンシューマーは、Gateway 実装へのランタイムエッジを得ない。

このファサードは、Client パッケージが名指すワイヤ型語彙の玄関でもある。Remote 失敗語彙（`RemoteResult`、`RemoteFailure`、`RemoteErrorCode`、`RemoteErrorDetailsMap`）、Host の事実（`RemoteHostFacts`）、および選択された各ドメインのクライアント安全なペイロード型を型のみで再エクスポートするので、Client の機能パッケージは `dsh-typert-protocol`、Gateway、またはオーナーの Host エントリーに手を伸ばす代わりに 1 つの指定子をインポートする。この玄関を意図的に迂回する 2 種類のパッケージがある: このアセンブリ自身が選択する API 層パッケージ（逆にインポートすると依存サイクルが閉じてしまう）と、`dsh-typert-protocol` から直接失敗語彙を取るそれらのテストである。UI パッケージのテストは代わりに [`dsh-client-test-runtime`](../../test-support/client-runtime/README.md) から `RemoteError` コンストラクターを取る。

このパッケージは物理トランスポートや Host サービスディスカバリーを所有しない。アプリケーションの選択を、生成された Remote コントリビューションと Client ごとの独立した Host イベントソースに投影する。API Gateway はエンドポイント、キャリア、キャンセル、再接続を所有する。その Client フェイスは、同じ React 非依存の `ctx.remote` 契約を提供する Web または将来の TUI によって再利用できる。

-----

<a id="forwarded-host-events"></a>
## 転送される Host イベント

`src/remote-events.ts` は `API_REMOTE_FORWARDED_EVENTS` を保持する。これはこのアプリケーションが名前を変えずに転送する Host Cordis イベントの許可リストであり、したがって `ctx.remote.$on` の正当なキーセットである。各エントリーは通常の emit か Agent スコープのウォーターフォール配送かも選択する。型のみの `src/types.ts` がその選択フェイスを導出する。イベントを 1 つ多く転送するには、その配列に 1 つのエントリーが必要である: 型投影、コンシューマーキーフェイス、Host 転送ループはすべてそこから導出される。

リスナーシグネチャはここでは再掲しない。許可リストにある各イベントの Cordis `Events` 宣言は、そのオーナーパッケージのクライアント安全な `./types` エクスポートにあり、このパッケージの両方のフェイスがそれらの宣言を取り込む。Host フェイスはさらに各エントリーを `TypertForwardableEventEntry` に対してアサートする: `emit` エントリーは宣言された一方向イベントでなければならず、`waterfall` エントリーは最終パラメーターが同結果の `next()` コールバックである宣言された Agent スコープのウォーターフォールでなければならない。

`emit` エントリーは `resources` を宣言できる。これは `TypertResourceMap` の種別でキー付けされ、イベント自身のパラメーターで型付けられたリーダーであり、例えば `api-session/added` の `resources: { session: summary => summary.sessionId }` である。Host エントリーはそれらを各転送フレームに変更せずに添付し、Gateway は、アクセス制御が名指されたリソース上でそのイベントを許可する場合にのみ、通知を非オーナー Peer へ転送する。`resources` のない通知はビルトインの `global` リソースに触れる。`api-session/activity`、`api-session/added`、`api-session/error`、`api-session/removed`、`api-session/status` はそれぞれの Session を宣言する。通知は 1 つのリソース識別子またはなしを名指す。コレクションの変更は代わりにフォローストリームで伝わる。

Host エントリーは、Client ストリームごとに独立した許可リストリスナーセットとキューを登録する。エンキュー前に非 JSON の通常イベント引数を拒否する。ウォーターフォールについては、トップレベルの Agent 識別子と JSON リクエストフィールドのみを投影する。Client の結果もロスレス JSON でなければならず、`next()` は後続の Host リスナーに委任する。スコープ付きウォーターフォールリクエストはそれぞれ、ルーティングされた Agent を `request.agent` として直接運ばなければならない。Host は転送前に欠落または不一致の識別子を拒否する。ソースは `ctx.typertGateway.registerRemoteEvents()` が Gateway の内部 `$events` 論理ストリームを公開する前に、すべてのリスナーを同期的にアタッチするので、その最初の `ready` アイテムは増分配送がアクティブであることを証明し、Client のパス表示用の Host ホームを運ぶ。登録の撤回はアクティブなストリームを中止する。

ペイロードのない `schedule/changed` イベントは Schedule タスククエリを無効化する。Client は通知後に再読み取りし、再接続する。ペイロードのない `permission-presets/catalog-changed` イベントはプロセスカタログを無効化する。Client は最初の `permissionPresets.catalog()` 読み取りの前に購読し、通知後に完全なスナップショットを再読み取りする。イベントはカタログ状態を運ばず、Session シーケンスを変えない。

<a id="build-boundary"></a>
## ビルド境界

リポジトリのほとんどのパッケージは 1 つの TypeScript フェイスに属する: Host パッケージはルート `tsconfig.host.json` に登録され、Client パッケージはルート `tsconfig.client.json` に登録される。このパッケージは分割される。その Host エントリーが Host Typert グラフに参加しなければならない一方、`src/client/index.ts` は Host tsdown がビジネスパッケージの `/remote` 宣言を生成するまでコンパイルできないためである。

このパッケージのルート `tsconfig.json` は `tsconfig.host.json` と `tsconfig.client.json` を参照するソリューションにすぎない。Host 集約と直接の Host コンシューマーは前者を参照し、Client 集約と直接の Client コンシューマーは後者を参照する。パッケージルートのソリューションはどちらの集約の依存グラフにも入ってはならない。2 つのプロジェクトは素集合のソースファイルと `.tsbuildinfo` ファイルを所有するが、`lib/types` 出力ディレクトリを共有する。1 つの意図的な例外がある: `src/remote-events.ts` と `src/types.ts` は両方のフェイスの `files` に列挙される。転送イベント許可リストはコンシューマーが受け取れるものに対する単一の制御点であり、Host 転送ループと Client の `ctx.remote.$on` キーフェイスは、乖離しうる 2 つではなく 1 つの宣言を読まなければならないためである。

この例外は単なる `files` エントリーではない。ルート `tsconfig.base.json` は `@deepseek-ai/dsh-api-remotes/types` を `src/types.ts` —— ソースプレーン —— にマップする。これは他のすべてのワークスペースサブパスと同様であり、`paths` エントリーを持たず `exports` を通じてビルド済み出力に解決される生成 `/remote` 成果物とは異なる。したがって両方のフェイスは同じ許可リストと型投影を自身のプログラムに取り込み、バイト単位で同一の `remote-events` と `types` 出力を `lib/types` に emit する。`.tsbuildinfo` ファイルは独立したままである。フェイスのソースファイル素集合性を強制するゲートはない —— `scripts/project-reference-faces.ts` は分割プロジェクトへの参照が一致するフェイスを名指すことだけをチェックする —— ので、この段落は二重列挙が意図的である理由を記録する。

パッケージローカルの `clientBundle(..., { hostPhase: true })` は、Host tsdown に Host エントリーをバンドルさせ、後の Client tsdown にブラウザエントリーだけをバンドルさせる。通常の Client プラグインは単一の Client プロジェクトのままで、Client tsdown 中に Node ローダーエントリーとブラウザバンドルの両方を生成する。2 つのソースセットが異なるコンパイラフェイスを必要とする場合にのみ分割する。

<a id="model-experience"></a>
## モデル体験

なし。この BFF は Remote アプリケーションメソッドと転送イベントを選択するが、モデルに面するものは何も登録しない。

#### KV キャッシュへの影響

直接の効果はない。マウントされた Host ケイパビリティが、それらが引き起こすモデル可視の挙動を所有する。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- ケイパビリティセットは明示的なビルド時の値インポートによって固定される。Client は実行時に Host のアクティブなサービスや Remote 定義を発見しない。
- 追加のケイパビリティには、このアセンブリにおける明示的な `/remote` 値インポートとマウントが必要である。
- 再接続後に再生されるのは、まだ保留中のスコープ付きウォーターフォールのみである。通常の一方向通知は分離されたベストエフォート配送のままで、再生されない。信頼できる回復を必要とする状態には、オーナー提供のクエリ、カーソル、または開始ベースラインが必要である。


<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>

Client アセンブリには、ログインコマンドと再接続可能なアカウントスナップショットのための account 名前空間が含まれる。
