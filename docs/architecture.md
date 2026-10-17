# DeepSeek Harness アーキテクチャ

日本語 | [English](architecture.en.md) | [中文](architecture.zh.md)

`packages/` 配下を変更する前にこれを読むこと。Cordis を知っていることを前提とする。知らない場合は[入門](cordis-primer.md)または[チュートリアル](cordis-tutorial/index.md)から始めること。

## Cordis

[Cordis](cordis-primer.md)は dsh の基盤フレームワークである。プラグインは共有コンテキストにサービス、型付きイベント、可逆的エフェクトを提供する。モデルアダプター、ツールレジストリ、セッションログ、エージェントループ自体を含む製品のすべての部分がプラグインなので、それぞれを設定から置き換えられる。

パッチを当てる特権的なコアは存在しない。dsh を拡張するには他のプラグインの隣にプラグインをマウントする。登録はエフェクトであり、そのプラグインがアンロードされると巻き戻される。

## プロファイルとバンドル

実行中の `dsh` は、起動時に順序付きレイヤーから構成されるプラグインツリーである。

**プロファイル**は Harness ホームに保存される名前付きの構成である。スタックするバンドルを列挙し、インストールするツリー外プラグインを保持し、ユーザー自身の `cordis.patch.yml` を保つ。`web`、`headless`、`sdk`、`sdk-minimal`、`acp` がテンプレートとして同梱される。

**バンドル**は Cordis 設定行とそれらがマウントするコードの配布形式であり、挿入するものは何であれ上位のレイヤーからパッチ可能なままである。

それぞれ自身の `package.json` の `dsh` フィールドで宣言する。`dsh.profile` はプロファイルのバンドルを列挙し、`dsh.bundle` はバンドルのパッチファイルを指す。

[`dsh-base`](../packages/bundle/base/README.md)は `web`、`headless`、`sdk`、`acp` プロファイルの共有第 1 レイヤーである。モデルアダプター、ツール、永続化、サンドボックスと承認ポリシー、設定、資格情報、テレメトリー。[`dsh-web-app`](../packages/bundle/web-app/README.md)はブラウザーアプリケーションを追加し、[`dsh-headless`](../packages/bundle/headless/README.md)はサーバーのないワンショットランナーを追加し、[`dsh-sdk-app`](../packages/bundle/sdk-app/README.md)は SDK JSON-RPC サーバーを追加し、[`dsh-acp-app`](../packages/bundle/acp-app/README.md)は自動化専用の ACP サーバーを追加する。[`dsh-sdk-minimal`](../packages/bundle/sdk-minimal/README.md)は意図的な例外である。1 つのバンドルが完全な明示的 SDK ツリーを所有し、`dsh-base` を適用しない。

レイヤーは空のエントリーリストに適用される。プロファイルの順序付きバンドル、その `cordis.patch.yml`、ホームパッチ、次に `--patch` オーバーレイである。パッチは id で行を対象にし、その設定全体を置き換えるか、新しい行を挿入する。`preset` パッチは同じレイヤー優先順位でこれらの操作をその宣言の `config.plugins` 内部に適用する。

YAML が HMR を制御する。base は設定のみの `dsh-hmr` を有効化し、headless、SDK、ACP は無効化し、`sdk-minimal` は省略する。プロファイルパッチがこれらのデフォルトを上書きする。HMR はウォッチングとリロードを調整し、ランチャーがプロファイルデータとレディネスを提供する。

base は Web とエージェント用の [Plugin Manager](../packages/boot/plugin-manager/README.md)を含む。

自分のマシンが起動するツリーを確認するには:

```sh
dsh --profile web --dump-config
```

出力される行はどれも、自身のパッチで置き換えられる。

構成の仕組みは [app-boot](../packages/boot/app-boot/README.md#profiles) に、設定フィールドは生成された[設定カタログ](config-catalog.md)にある。

## アプリケーションの起動

サポートされる Node アプリケーションは、名前付き `dsh` プロファイルを通じて起動する。同梱プロファイルは `web`、`headless`、`sdk`、`sdk-minimal`、`acp` で、`dsh --profile <name>` または `dsh <name>` で選択する。`plugin` は管理コマンドを名付ける。その名前のプロファイルには `--profile plugin` が必要である。TypeScript SDK は同バージョンの `dsh` 依存を解決して `sdk` を選択する。カスタムプラグイン構成はプロファイルと順序付きパッチファイルのままであり、別の実行ファイルやインラインのアプリケーションツリーではない。`sdk-minimal` は同じランチャーの背後にあるリポジトリ所有のスタンドアロンバンドルであり、呼び出し元が提供する Cordis ツリーではない。

ベンダー化された CLI、ビルド専用・テスト専用の実行ファイル、直接のインプロセスプラグインマウント、非公開のブラウザー WebWorker プレビューは Harness アプリケーションランチャーではない。[`verify-application-entrypoints`](../scripts/verify-application-entrypoints.ts)は、すべてのパッケージ bin、実行可能ソース、ルートデモ、ルートの `start:web` と `dev:web` スクリプトを明示的なクラスに保ち、`dsh` を迂回する Node アプリケーションパスを拒否する。

Python SDK も同じアプリケーションアーキテクチャに従う。そのランタイムホイールは通常の `dsh` CLI を `deepseek-harness-sdk-runtime-<platform>-<arch>` としてパッケージ化し、クライアントはデフォルトで明示的な Harness ホーム付きの `dsh --profile sdk` を起動する。最小の例は同梱の `sdk-minimal` プロファイルを選択する。Python は完全な Cordis ツリーではなく、プロファイル選択と順序付きパッチファイルを公開する。永続的な外部プラグインは `dsh plugin` でインストールする。削除された非公開の直接設定キャリアには、互換 bin もフォールバックパーサーもない。

## デスクトップアプリケーション

[Electron デスクトップアプリケーション](../apps/desktop/README.md)は、正確な dsh 本番ランタイムを署名済みリソースとして同梱し、予約された `$DSH_HOME/profiles/desktop` を所有する。共有ヘルパーはプロファイルファイルを初期化し、バンドルを調整し、pnpm 所有のパッケージを置き換えずにインストールとバンドルの依存関係を解決する。Desktop と npm CLI は製品データを共有するが、パッケージ、アクティベーション、ロックファイルは分離したままである。Desktop の同梱 CLI が初期化したプラグインを管理する。

Electron は非公開の Desktop Host を Electron Node モードで起動する。Host は共有 CLI プロファイルランナーと完全な Web アプリケーションを呼び出す。ウィンドウはパッケージ済み Web アセットを即座に読み込み、同じドキュメント内でクライアントプラグインをアクティブ化する前にブートインジェクションを待つ。Web は RPC とストリームを所有し、desktop キャリアがローカルページを認証済み Host に接続する。Node IPC がブートインジェクション、レディネス、致命的エラー、シャットダウンを運ぶ。Desktop はデフォルトで OS 割り当てのポートでリッスンし、プロファイル設定で上書きできる。シェル所有の UI は、通常のユーザー・プロファイル設定で同梱 pnpm を通じてプラグイントランザクションを実行する。

## コアパッケージ

| パッケージ | 所有するもの | `ctx` キー |
|---|---|---|
| [`core/session`](subsystems/session.md) | 追記専用の `SessionEvent` ログとインメモリストア | `ctx.sessions` |
| [`core/system-prompt`](subsystems/system-prompt.md) | プロンプトセクションとツールスキーマの組み立て | `ctx.systemPrompt` |
| [`core/tools`](subsystems/tools.md) | スコープ付きツールレジストリとガード付き実行パイプライン | `ctx.tools` |
| [`core/agent`](subsystems/core.md) | `Agent` インターフェース、ライブレジストリ、`agent/*` イベント | `ctx.agents` |
| [`core/agent-loop`](subsystems/core.md) | そのインターフェースを実装するデフォルトドライバー | `ctx.agentLoop` |
| [`core/scope`](subsystems/scope.md) | エージェントごとのスコープ付き登録プリミティブ | ライブラリ、キーなし |
| [`llm/llm`](subsystems/llm-streaming.md) | メッセージとストリームの語彙およびアダプターシーム | `ctx.llm` |

## イベント

イベントは拡張ポイントであり、正しいドメインの選択がほとんどの変更における最初の決定である。

- **セッションイベント**は、ログに追記され `session/event` を通じてブロードキャストされる耐久的事実である。リロードを生き延びなければならない事実にはこれを使う。
- **エージェントイベント** (`agent/*`) はライブ `Agent` を運ぶ。インボックス、ステップ、ステータス、リクエスト、検証、継続。飛行中の作業を観察または傍受するにはこれを使う。
- **ケイパビリティイベント**は、ループをインポートせずにポリシーとアダプターをシーム (`fs/*`、`tools/*`、`telemetry/*`) に取り付ける。

AgentLoop はキューされた作業の前にシリアルの `agent/created` を await し、失敗した初期化をロールバックする。アンロードは Agent ティアダウンを通じてリソースを保持する。順序は [agent-loop](../packages/core/agent-loop/README.md#understand-the-implementation) が定義する。

[イベントマップ](event-producer-consumer.md)はすべてのイベントのプロデューサーとコンシューマーを列挙する。

## ターンフロー

**ステップ**は 1 回のモデルリクエストとそれが呼び出すツールである。**ターン**は 0 個以上のステップである。最初の入力がクレームされる前に開き、何も負っていない状態になると閉じる。

```text
turn/start
  claim next-step input plus one queued message
  assemble prompt sections + tool schemas
  -> agent/pre-step; project runtime context at fallback
                                     reject | enter(messages, startsRequestSeries?)
     reject, or a first enter rewritten empty -> close the turn with no step
     step/start
     agent/request -> prepareCall (cancellation commits neither system nor users)
     reconcile system/message using the prepared call capability
     append entered messages as user/message; reconcile retained runtime context
     log request/header and request/context as needed
     derive and freeze model history from the log
     stream the bound prepared call -> llm/stream -> agent/assistant-stream start
       agent/assistant-stream chunk*
       assistant/message | assistant/attempt -> agent/assistant-stream end
     tool/call* -> tools/pre-execute -> tools/execute -> tools/post-execute -> tool/result*
     step/end
     tools owe another request, or next-step input arrived -> claim -> next step
  -> agent/turn-stopping
turn/end
```

`turn/*`、`step/*`、`system/message`、`user/message`、`assistant/message`、`assistant/attempt`、`tool/*` は耐久セッションイベントであり、残りは 3 つのドメインにまたがるライブ拡張ポイントである。`agent/assistant-stream` はプロセスローカルの start、一時的な chunk、end フレームを発行する。ループは完全なコンパクトストリームを 1 つのメッセージまたはログのみの試行として、コミット済み end フレームの前にコミットし、Web Session-follow アダプターがライブイベントの唯一のリモートコンシューマーである。`agent/pre-step`、`agent/request`、`llm/stream`、3 つの `tools/*` イベントはウォーターフォールであり、そのリスナーは委譲するために `next()` を呼ばなければならない。`agent/turn-stopping` はシリアルで `next()` を持たない。

1 つのインボックスがドライバーに供給する。注入されたコンテキストは起床メッセージを待つ。AgentLoop の耐久 `inbox` プロジェクションは、ライブ Agent なしで保留入力を公開する。

`agent/pre-step` は受け入れられる入力を決める。リスナーはクレームされたメッセージを書き換えたり拒否したりできる。最初のクレームが拒否されるか空なら、ステップなしで耐久ターンが閉じる。enter 決定は `startsRequestSeries` を設定できる。ループは新しい `request/header` をログする (reason は `series`、またはエンベロープも変わった場合は `startsSeries: true` 付きの `change`)。ラッピングリスナーは `{ ...decision, messages }` でその宣言を保持する。組み立てと `step/start` の後、`agent/request` と `prepareCall()` が、システムプロンプトと受け入れ済みユーザーがコミットされる前に実際のルートを解決する。どちらの非同期フェーズ中のキャンセルも両方をコミットしない。準備済み呼び出しケイパビリティはプロンプトの受け入れを支配し、先行する `request/context` は支配しない。各試行は登録済みランタイム事実をリフレッシュし、バインドされたプロンプトを調停し、ユーザーを一度だけ受け入れ、削除されたランタイムコンテキストを復元し、必要に応じて header/context をログし、バインドされた呼び出しをストリーミングする前にリクエストを凍結する。リトライは組み立てや `agent/pre-step` を繰り返さない。添付後のサーフェス置換と画像オフロード決定は、最初の再開 pre-step 中を含め、新しいリクエストシリーズを開始する。変更のない再開はシリーズを継続する。最初に受け入れられたステップは、空のプロンプトでも (wire メッセージなしで) ユーザーメッセージより前にシステムヘッドを予約する。プロンプトは `system/message` 履歴としてのみ移動する。空のレンダリングはすべてのアクティブなシステムノードをクリアし、古いプロンプトをモデル可視のまま残さない。対応ルートはキャッシュ済み履歴の後に空でない更新 (サポートされるツール更新を含む) を追加する。非対応ルートと新しいリクエストシリーズは、空でないプロンプトテキストを最初のシステムノードに統合し、後続の空でないシステムノードにはログ済みの空置換を行う ([decision](../.agents/notes/implemented/architecture/2026-09-02-system-prompt-as-surface-node.md); [decision rule](../packages/core/agent-loop/README.md#understand-the-implementation))。

ループはライブキャンセル付きの不変リクエストを送り、凍結された同一性にはフリーズの証拠を再利用する。構築とキャンセル原因は [agent-loop](../packages/core/agent-loop/README.md) が所有する。

失敗したステップは[欠落したツール結果を記録する](../packages/core/agent-loop/README.md#understand-the-implementation)。

詳細: [シーケンス図](agent-lifecycle.md)、[ツールパイプライン](tool-execution-pipeline.md)、[キャンセルとエラー回復](subsystems/core.md#the-agent-handle)。

## セッションログ

セッションログはモデルが見るコンテキストの源である。`deriveMessages()` がそこからモデル履歴を投影する。各 `assistant/message` は、その組み立て済みコンテンツを生み出した正確なコンパクト計時ストリームを埋め込む。`assistant/attempt` は、決着した失敗、リトライ、キャンセル、ストリームエラーの試行を、モデル履歴を追加せずに保持する。フォーク、再開、トランスクリプト、テレメトリー、永続化はすべてこれらの耐久決着から導出され、ライブ UI の増分性は `agent/assistant-stream` から来る。決着前のハードなプロセス損失は耐久試行ストリームを残さない ([decision](../.agents/notes/implemented/architecture/2026-09-01-v2-embedded-assistant-streams.md))。

セッションコンシューマーは現在の論理フォーマットのみを知る。ヘッダーのみの `stat` と `list` は各 Session ディレクトリを再スキャンし、数値上最も高い正準世代を選択し、イベントをロードしたり後継を公開したりせずにサポートされる歴史的ヘッダーを変換する。保存済みセッションの `open` は同じ世代を選択し、将来のバージョンを拒否するか、検証済みの現在の論理イベントを返す前に静的隣接マイグレーションチェーンを一度だけデコードして構成する。読み取り open は後継を公開せずにそのインメモリ結果を使う。書き込み open はまず最終のバージョン名付き後継をエンコード、検証し、変更されていないソースの隣に排他的に公開する。未シールの中断テールの通常の修復はハンドルコンシューマーの責任のままである。マイグレーションは、後続の `turn/start` ですでにシールされた境界付きリリース済み再開に対してのみ、欠落した中断 `turn/end` を挿入する。JSONL v0 は `session.jsonl[.zstd]` を使い、v1 以降は小文字の `session.vN.jsonl[.zstd]` を使う。コミット済み世代パスは決して改名、置換、削除されない。JSONL プロバイダーは物理フレーミング、圧縮、世代選択、排他的公開を所有し、各隣接マイグレーションパッケージはちょうど 1 つの `vN -> vN+1` ステップを所有する ([decision](../.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.md))。

**モデル可視はログ済みを意味する。** すべてのモデルリクエストはログから再構成可能でなければならない。新しいモデル可視入力にはセッションイベントが必要である。既存のメッセージ内容を変更するプラグインは[純粋メッセージプロジェクション](subsystems/session.md#plugin-owned-message-projections)を登録し、切り離されたリーダーは同じ定義を明示的に供給する。ツール変更はケイパビリティ非依存である。[Session ツール履歴](../packages/core/session/README.md)がプロバイダー宣言を供給する。

**プロジェクションシーム。** `dsh-session-projection` が `ctx.sessionProjections` を所有する。登録されたユニットはコミット済みイベントを増分的に畳み込み、ホストコンシューマーは `stateOf()` で 1 つの型付き状態を読み、キャリアは `snapshot()` でクロップ済みクライアントビューをバッチ化する。ホストリーダーはアクティベーション中にこのサービスを要求するか、レジストリまたは必須キーが存在しない場合に明示的に失敗する。コントリビューターは、欠落したホスト値を黙ってデフォルト化することなく、`ctx.inject(['sessionProjections'], ...)` 登録を保持してよい。エージェントループは自身のリーダー用に共有 `turnBoundary` 状態を登録する ([decision](../.agents/notes/implemented/architecture/2026-08-19-session-projection-mandatory-seam.md))。

[作業ディレクトリ](subsystems/working-directory.md)は、元のプロジェクト同一性、サンドボックス書き込みルート、既存のプロセスディレクトリを変えずに、ユーザーコンテキストと実行パスを供給する。

## ケイパビリティシーム

**シーム**は 3 つの役割を持つ交換可能なケイパビリティである。インターフェースを宣言する**サービス定義**、それを実装する**サービスプロバイダー**、それを使う**コンシューマー** (通常はモデル向けツール) である。1 つのパッケージが役割を兼ねてよいが、1 つの役割だけではシームではない。ケイパビリティの追加は 3 つすべての設計を意味する ([ケイパビリティグラフ](capability-seams.md))。

シームがあるからこそ、1 つのプロバイダー差し替えが製品全体を変える。ファイルシステムとサブプロセスのプロバイダーは 1 つの実行ワールドを共有するので、それらをリモートサンドボックスに向けると Bash、PTY、LSP も一緒に移動し、プロバイダーのフォークは不要である。[サブエージェントプロバイダー](subsystems/subagent.md)も 1 つのインターフェースの背後で同様に大きく変化し、新しい子エージェントから別製品での委譲ターンまで及ぶ。

[実験的な Agent Teams](subsystems/agent-team.md)は、耐久名簿とタスク状態、および継続可能なサブエージェント上の直接インボックスメッセージングを備えたオプトインの `ctx.agentTeams` 調整を公開する。

## 新しい振る舞いの置き場所

新しい振る舞いは文書化された拡張ポイントに接続する。ループ自体の変更はこのマップを更新する。

| 目的 | メカニズム |
|---|---|
| モデルプロバイダーを追加する | `ctx.llm` にそのアダプターを登録する |
| モデル向けケイパビリティを追加する | `ctx.tools` に登録する。そのスキーマがプロンプト組み立てに加わる |
| 1 つのセッションに異なるケイパビリティセットを与える | エージェントプリセットを構成する。そこでのサービス行には `isolate` レルムが必要 |
| シェル実行を追加する | `ctx.shell` バックエンドを登録する。ローカルのものは `ctx.subprocess` を通じてスポーンする |
| 永続ターミナル実行を追加する | `ctx.terminals` バックエンドと `dsh-tool-terminal` を登録する |
| 人間のコマンドを追加する | `ctx.commands` に登録する。モデルターンなしでディスパッチする |
| バックグラウンドジョブを管理する | `ctx.jobs` に登録する。`job_*` ツールがジョブを読むか停止する |
| 外部 Webhook から Session を開始する | `ctx.webhookRuntime` に信頼済みルールを登録し、プロバイダーアダプターをマウントする |
| ファイルシステムアクセスまたはポリシーを追加する | `ctx.fs` プロバイダーを登録するか `fs/*` イベントをリッスンする |
| スポーンされたプロセスを閉じ込める | `ctx.sandbox` バックエンドを使う。コンシューマーはスポーン前に argv をラップする |
| リクエスト、ツール、ターンを傍受する | その `agent/*` または `tools/*` イベントを使う。`agent/turn-stopping` がターンを停止する |
| モデル向けコンテキストを追加する | `agent.inject()` を呼ぶ。次の受け入れ済みリクエストに載る |
| UI またはエディター統合を追加する | `ctx.agents` を駆動し `session/event` からレンダリングする |
| Web クライアント Chat ノードを追加する | `ConversationNodeDefinition` + キー付きレンダラーを登録する |
| 耐久セッション状態を追加する | `SessionEventMap` を拡張する。ログからレンダリングおよびリプレイする |
| セッションタイトルを生成する | 唯一の `ctx.sessionTitle` プロバイダーを登録する |
| 同一セッションの目的を管理する | `ctx.goals` を使う。`agent/*` を通じて継続する |
| ターン境界でセッションをフォークする | `ctx.agents.create({ sessionId, seed, meta: { parentSession, seedLength } })` — agent-loop が公開したセッションのみ永続化する |
| セッションを新しいバックエンドに保存する | 共有ハンドル足場の上で `SessionPersistence` (`create`/`open`/`stat`/`list`/`export`) を実装する |
| 登録を 1 つのエージェントにスコープする | そのエージェントの `agent.ctx` を使う |

[拡張クックブック](cookbook/extension-cookbook.md)は機能をケイパビリティに対応付け、[パッケージ](cookbook/adding-a-package.md)、[ツール](cookbook/adding-a-tool.md)、[LLM アダプター](cookbook/adding-an-llm-adapter.md)、[設定ページ](cookbook/adding-a-settings-card.md)の手順ガイドを索引する。[Conversation サブシステム](subsystems/conversation.md)が Chat ノードの組み立てを所有する。
