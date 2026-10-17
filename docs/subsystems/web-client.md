# Web Client アーキテクチャ

日本語 | [English](web-client.en.md) | [中文](web-client.zh.md)

Web Client は、独立にロードされるプラグインから組み立てられるブラウザー側の Cordis アプリケーションである。そのアーキテクチャには 4 つの再利用可能な基盤がある: [Client Modules](client-modules.md) がプラグイングラフをロードし、[API Gateway](../api-gateway.md) が型付きの Host 通信を提供し、[Slots](slots.md) が React UI を組み立て、[Conversation](conversation.md) がセッション履歴ウィンドウをターゲット所有のビューに変える。このページはそれらのシステムをつなぎ、Client モデルと機能パッケージがどこに属するかを定義する。

[Keyboard shortcuts](../../packages/client/shortcuts/README.md) はウィンドウローカルのコマンド登録と物理キーのディスパッチを所有し、[ショートカットリファレンス](../../packages/client/ui-shortcuts/README.md) は利用可能なコマンドとローカル入力アクションを提示する。コマンドの所有者は各ランタイム/プラットフォームごとのデフォルトを宣言し、既存のアクションをマウスコントロールと共有する。共有モーダルプリミティブが最上位レイヤーの Escape を裁定し、フォーカスを復元する。

## レイヤーと所有権

| レイヤー | 主な所有者 | 責務 |
|---|---|---|
| ホストアプリケーション | ビジネスサービスと `packages/api/*-controller` の Host エントリー | 権威ある状態、永続化、変更の順序付け、アクセスポリシー、ストリーム生成を所有する。 |
| トランスポートと API 組立 | `client/connection`, `api/gateway`, `api/remotes` | Client の世代を確立し、生成された `ctx.remote` メソッドとストリームを公開し、選択された Cordis イベントを転送し、キャンセルと結果を運ぶ。 |
| Client モデル | `api/session-controller/client`, `api/workspace-controller/client` | Host 状態の React 非依存ミラーを維持し、ストリーム/単項の競合を解決し、オブジェクトアイデンティティとサブスクリプションを所有し、狭いコマンドサービスを公開する。 |
| UI アダプター | `client/ui-session`, `client/ui-workspace` | モデルのオブザーバブルをルートまたは Provider に束縛された Session Slot ソースへ変換し、ビューレベルのナビゲーションとステータスポリシーを所有する。 |
| Conversation データ | `client/ui-conversation`、`ui-chat` や `ui-trajectory` などのターゲットパッケージ | 標準イベントとコンパクトな過去の Assistant 実行を独立したターゲットスナップショットへ組み立て、共有の conversation シェルと入力フローを所有する。 |
| コンポジションとレンダリング | `client/ui-slots`, `client/ui-renderer`, `client/ui-layout`、機能 UI パッケージ | 拡張位置を宣言し、コンポーネント props を導出し、オブザーバブルを React フックに束縛し、最終ツリーをマウントする。 |

依存の方向は Host 状態 → Remote トランスポート → Client モデル → UI アダプター → Conversation またはプレゼンテーション → Slots → React である。ユーザーアクションは、注入された Client サービスまたは生成された Remote 名前空間をクローズオーバーするコールバックを通って戻る。プレゼンテーションコンポーネントは Cordis `ctx`、トランスポートオブジェクト、または別の機能プラグインの実装を決して受け取らない。

## ブラウザー起動

Host は合成された `WebBootGraph` を `window.__DSH_BOOT__` に書き込み、パーサーがプリロードするスクリプトが実行される前にブラウザーのモジュールローダーファサードを設置する。モジュールシステムは遅延 CommonJS テーブルである: バンドルをロードするとそのファクトリーが登録され、エントリーを実体化すると、プラットフォームモジュールと宣言された動的依存関係に対する同期 `require` でファクトリーが実行される。

Web 起動カーネルはモジュールシステムを作成し、`immediately` エントリーを先読みし、ベンダー化された Cordis Loader をマウントし、すべてのグラフエントリーを作成する。アクティベーションを決めるのは Cordis のサービス注入であり、モジュールグラフの順序は同期インポートを実体化できるかどうかだけを決める。完全なロスターが安定状態に達した後、`ui-renderer` がフレームワーク非依存の起動 DOM をハイドレートし、唯一のコンテキストレベルの `renderSlot('root')` 操作を呼び出す。[Client Modules](client-modules.md) がグラフ、バンドルルート、キャッシュリビジョン、ローダーの詳細を所有する。

## リモート通信

Host のビジネスサービスは、呼び出し可能なメソッドに Typert Remote デコレーターを注釈する。Host の生成は、厳格な記述子、ランタイムコーデック、宣言マージ、ソースマップを出力する。Client 側の `api-remotes` 組立はそれらの生成されたコントリビューションを選択し、具体的なメソッドを `ctx.remote.<namespace>` とセッションスコープの `agentCtx.remote.<namespace>` の下にマウントする。機能パッケージは生成されたサービスフェイスに依存し、Gateway 実装や Host パッケージのランタイムエントリーには依存しない。

Connection はリクエスト URL の解決、相関、`/api` キャリア、信頼チェック、正確な Fetch ルート、接続世代を所有する。API Gateway は Remote ディスパッチ、キャンセル、論理ストリーム、選択された Host イベント転送を所有する。コントローラー操作は生成された Remote メソッドまたは明示的な Remote ストリームに属し、機能所有のダウンロードは正確な Fetch ルートを登録する。[API Gateway リファレンス](../api-gateway.md)が世代と呼び出しを定義し、[Connection README](../../packages/client/connection/README.md) が物理キャリアと信頼ポリシーを定義する。

内部の `$events` 論理ストリームが Connection の世代ソースである。その冒頭の `ready` フレームはパス表示に使う Host ホームを運び、Host リスナーが接続された後、どのコントローラーもベースライン読み取りを始める前に世代を確立する。`ctx.remote.$on()` は許可リスト済みの通常イベントをルート Client コンテキストへ、スコープ付き waterfall イベントを解決済み Session コンテキストへ配信する。waterfall リスナーは結果を返すか、`next()` を呼ぶか、棄却する。

## Client モデル

各 API コントローラーパッケージは、対になった Host と Client のフェイスを所有する。Host 側は権威ある変更とストリーム生成を所有する。Client 側は同じ生成 wire 型の上でアイデンティティ安定かつ React 非依存のモデルを所有し、オブザーバブルスナップショットとコマンドを公開する。UI パッケージはこれらの Client サービスを消費し、コンポーネントストアでトランスポート状態を再現しない。

### セッション

[`api/session-controller`](../../packages/api/session-controller/README.md) は、一覧、検索、作成、プロンプト、キュー、キャンセル、ページネーション、および follow/control ストリームの Host コマンドを公開する。その Client 側は `ClientSessions → SessionManager → Session` として構成される:

- `ClientSessions` は `ctx.sessions` を提供し、参照、ソース数、Session スコープ、安定した `SessionBinding` オブジェクトを所有し、グローバルな現在の Session を選択することなくカタログ状態を投影する。
- `SessionManager` はリストのベースライン、ライブのリスト/コントロール更新、遅延 Session インスタンス、プロジェクションストア、subagent カタログ、および pull と後続更新の間の競合順序を所有する。
- 各 `Session` は、`SessionEventLikeEntry` 値で表される 1 つの連続した論理イベントウィンドウ、ページング、follow、プロンプト/コントロール状態、およびアダプターが消費するオブザーバブルスナップショットを所有する。

永続イベント経路は `follow()` を開き、その最初のフレームは現在のヘッダー、テールページ、カーソル、完全なプロジェクションベースラインを含む。履歴レコードは明示的な `event` または `chunks` 判別子と、整列された内側の `event` を持つ。ジャーナルは各包括的論理シーケンス範囲を検証してから、Client がレコードをレコードごとの変換なしに `SessionEventLikeEntry` 値として保持する。各物理世代はそのスナップショットから保持ウィンドウをアトミックに置き換え、その後、標準のライブイベントがシーケンス順に追記される。`page()` は古い履歴とギャップ修復のために予約されている。一時的なコントロールストリームは各世代を完全なベースラインで開始し、その後プロジェクション更新を適用する。

### ワークスペース

[`api/workspace-controller`](../../packages/api/workspace-controller/README.md) は、Workspace 変更ポリシーと権威ある follow フィードを Host に置く。`ClientWorkspaceModel` はブラウザーの行、Workspace の順序、アーカイブ済みおよび固定済み Session id 配列、コマンドエコー、ストリーム/単項の競合解決を所有する。各ストリーム世代は完全なベースラインで始まり、`upsert`、`remove`、`order`、`archived`、`pinned` のインクリメントが続く。再接続は新しいベースラインでモデルを置き換える。`WorkspaceController` はそのモデルを `ctx.workspaces` として公開し、`ui-workspace` は `useWorkspaces` とナビゲーションコールバックを提供する。サイドバーの `ArchivedFilter` は、リストと検索でデフォルト非表示、表示、アーカイブ済みのみの行を制御する。アーカイブ済みの行は順序スロットを保持し、グレーでレンダリングされ、行または検索結果の Unarchive アクションで復元されるまで開けない。復元は `workspace.unarchiveSession` を呼び、その完全なアーカイブセットは単項レスポンスと `archived` インクリメントを通じて Client に届く。Session の表示順はブラウザーローカルのままで、隠れたアーカイブを含む。固定はその完全な順序内で Session を移動させるが、固定解除は以前の位置を復元しない。

この対はビジネス上の真実の第二のソースではない。永続状態と変更結果を決めるのは Host コントローラーである。Client モデルは最新の使用可能なローカル投影を維持し、レンダリングに有用な箇所でオブジェクトアイデンティティを保ち、遅延レスポンスと置換ベースラインがどのようにマージされるかをエンコードする。

## Conversation とプレゼンテーション

Web とデスクトップは [Coding Tools プリファレンス](../../packages/client/ui-settings/README.md#use-this-package)を共有する。これは診断ビュー、[利用可能な preset の選択肢](../../packages/client/ui-agent-preset/README.md)、変更ファイルカード、組み込み HTML プレビューポリシーを制御するが、Session レコードは変更しない。

`ui-session` は Session スコープアダプターを設置し、[remote-access](../../packages/api/remote-access/README.md) Client サービス上で `useSessions`、`useSessionStatus`、`useSessionRetainInfo`、`useSessionAccess`、`useSession`、`sessionId`、`useProjection`、および Session スコープの `useAccess` を公開する。`SessionProvider` は外側のバインディングを継承するか、明示的な `SessionReference` を束縛するため、並行するサブツリーが異なる Session を対象にできる。ドメインアダプターは、モデルオブジェクトに React フックを載せることなく、さらなる標準ソースを追加する。

`ui-conversation` は各 `SessionBinding.eventSource` に 1 回だけ束縛する。そのイベントレジストリは永続 Session イベントと Client 専用の `assistant/live-chunk` 更新を安定したビジネスコンテキストへ相関させ、ビューレジストリはターゲットスナップショットを実体化する。Chat Assistant、Trajectory Assistant、Turn Tail は、ライブチャンクと永続的な決着に埋め込まれたコンパクトストリームの両方を解釈するため、再接続やページング履歴でも永続トークン行なしに同じ Assistant 状態を再現する。`ui-chat` と `ui-trajectory` は別々の Definition とビルダーを登録する。同じイベントファミリーを解釈してもよいが、互いの最終表示モデルをインポートしたり共有したりしない。シェルは登録済みビューを選択し、そのスナップショットを標準フックと Slots に渡す。[Conversation](conversation.md) がコンテキストアイデンティティ、リプレイ、Location データ、ターゲットビルダー、キー付きレンダラーを定義する。

`ui-slots` は型付きレジストリとライフサイクル台帳を提供する。`ui-renderer` は、素のオブザーバブルを `useSyncExternalStore` で束縛し、React コンテキストを所有し、ルートツリーをレンダリングする唯一のパッケージである。機能コンポーネントは、派生 props を通じてフレームワークフック、所有者 props、ストアアクション、明示的注入を受け取る。[Web Client Slots](slots.md) はそれらの入力、拡張 API、現在の Slot 階層を列挙する。

## データ経路

| 経路 | シーケンス |
|---|---|
| 永続 Session 表示 | Host の Session ログ → パックされた Remote の `follow`/`page` 履歴 → Client の `SessionEventLikeEntry` ウィンドウ → Conversation コンテキスト → ターゲットスナップショット (`chat`、`trajectory`、または別の登録済みターゲット) → Slot ビュー → React |
| 一時的 Session コントロール | Host のコントロールベースライン → Remote スナップショットストリーム → `SessionManager` プロジェクションストア → Session とリストのスナップショット → 標準フック → コンポーネント |
| バックグラウンドジョブ | Host のジョブレジストリ → `job.list` / `job.follow` → [`ClientJobs`](../../packages/api/job-controller/README.md) のロスターと出力ビュー → ジョブリストとパネル |
| Workspace 状態 | Host の Workspace ベースラインとインクリメント → `ClientWorkspaceModel` → `ctx.workspaces.list` → `useWorkspaces` → サイドバー、ヒーロー、ナビゲーションエントリー |
| スコープ付きインタラクション | Host の Cordis waterfall → API Remotes の `$events` → Session コンテキスト上の `ctx.remote.$on()` → 所有する UI パッケージ → 結果または `next()` |
| ユーザーコマンド | コンポーネントコールバック → 登録の inject フェイスまたは Slot 所有者 → `ctx.sessions`、`ctx.workspaces`、または生成されたスコープ付き Remote → Host Controller → 権威ある更新 → Client へ戻るストリームまたはイベント投影 |

## 再接続

物理的リカバリーと論理的リカバリーは別である。Gateway mux が物理 WebSocket を復元し、Connection が使用可能な世代を公開すると、各 `RemoteStream` が自身の論理ソースを再び開く。キャリアの失敗は再試行可能だが、ビジネスエラー、不正な冒頭アイテム、プロトコル違反は所有する論理ストリームにとって終端である。

リカバリーはデータの意味論に従う:

- 永続 Session ジャーナルは論理シーケンス範囲を検証し、各世代の冒頭スナップショットからウィンドウを置き換える。`page()` が古い履歴を供給し、後続の範囲ギャップを修復する。
- Session コントロールと Workspace のストリームは、切断中も最後に公開された値を保持し、その後、新しい冒頭ベースラインからアトミックに置き換える。
- 通常の転送通知はリプレイされない。ステートフルなドメインにはベースライン、カーソル、または明示的なクエリが必要である。スコープ付き waterfall は自身のリクエスト生存期間を保持する。

単一の Client `Runtime`、`HostFrame`、`events.mux`、`events.host`、または万能の `resync()` API は存在しない。Connection が世代状態を公開し、Gateway が論理ストリームの監督を所有し、各 Client モデルが自身のデータに適した置換または再開の意味論を定義する。

## パッケージ境界

機能プラグインパッケージは `import type` を通じて宣言を共有してもよいが、別の機能プラグインの値をランタイムインポートしたり再エクスポートしたりしない。パッケージ間の振る舞いは注入された Cordis サービスを使い、パッケージ間 UI は Slots を使う。ターゲット固有の Conversation Definition、プロジェクションヘルパー、最終ビューデータは、Chat と Trajectory が意図的に並行ロジックを実装する場合でも、それぞれのターゲットパッケージに留まる。

共有ランタイム値には、機能ライフサイクルを持たない狭い静的オーナーが必要である。例えば `client/store`、`ui-primitives`、またはブラウザーセーフなユーティリティパッケージである。トランスポートと生成 API 組立は、1 つのプロトコルを組み立てることが明示的な責務であるため、ランタイムコントリビューションをインポートしてよい。機能パッケージは、この規則を回避するためだけに `dsh.client.external` を追加しない。

追加する拡張に応じて、4 つの詳細リファレンスを使う:

- パッケージのディスカバリー、ロード、共有モジュールアイデンティティ、起動順には [Client Modules](client-modules.md)。
- Host メソッド、生成された Remote コントリビューション、ストリーム、転送イベントには [API Gateway](../api-gateway.md)。
- コンポーネント、フック、ストア、注入、配置には [Web Client Slots](slots.md)。
- 永続イベントの相関、ターゲットスナップショット、Chat または Trajectory ビューのコントリビューションには [Conversation](conversation.md)。
