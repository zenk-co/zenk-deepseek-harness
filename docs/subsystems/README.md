# サブシステム

日本語 | [English](README.en.md) | [中文](README.zh.md)

DeepSeek Harness のサブシステムごとに 1 ページ: それが何か、動かすデータ構造、そして — `ctx` サービスまたはイベントスコープがそれを支える場合 — そのサービスとイベントリファレンスを運ぶ生成された **Cordis API** セクション。このフォルダは [architecture.md](../architecture.md) を補完する。同ファイルはサブシステム横断の*動作*（サービスマップ、session/turn/step ライフサイクル、イベント分類）を記述する。ここにある各ページは 1 つのサブシステムの語彙と結線のリファレンスである。

| ページ | 所有 |
|---|---|
| [boot.md](boot.md) | 現在のプロファイルのプラグイン管理とランチャーリロード調整 |
| [core.md](core.md) | `packages/core` がエージェントループをいかに制御するか: パッケージごとのループ記述、エージェントの作成と所有権（`AgentHandle`）、`Agent` ハンドルの配達/キャンセル/インターセプトの契約、リポジトリ全体の型パターン（`…Map → derived-union`、ブランド付き id） |
| [llm-streaming.md](llm-streaming.md) | `packages/llm` の会話型 — `Message`/`ContentBlock`、組み立てられたモデルリクエスト、`StreamChunk` ワイヤープロトコルとアダプター契約、`BlockAssembler`、`LlmAdapter` プロバイダー契約 |
| [token-meter.md](token-meter.md) | 消費ログのリビジョン付きの不変なスカラーおよび位置指定リプレイ計測 |
| [scope.md](scope.md) | スコープ付き登録アイデンティティ、ディスパッチキャリア、所有された `Scope` コンテキスト |
| [typert.md](typert.md) | リモート呼び出し記述子、ルックアップ/Context 宣言、Typert レジストリ、Host Gateway/Client API 境界 |
| [goal.md](goal.md) | 永続化されたゴールアイデンティティ、ライフサイクルスナップショット、アクティベーション、変更レコード、ラウンド帰属 |
| [schedule.md](schedule.md) | Host 所有のリマインダーレコード、durable な遷移、アクティブと終了のビュー、通常会話への配達 |
| [todo.md](todo.md) | todo パッケージのリスト全体の項目型、durable なイベント所有権、プロジェクション |
| [deliverables.md](deliverables.md) | ターンがユーザーに手渡すもの: `present` からの `PresentedFile` 配達と、git スナップショットからの変更ファイルの Host 提供 `WorkspaceChangesSummary` |
| [commands.md](commands.md) | 人間コマンドレジストリサービス: 定義、アダプター探索、直接呼び出し、結果、解析ビュー |
| [session.md](session.md) | 完全な `SessionEventMap` バリアントカタログ、`TurnEndReason`、`deriveMessages()`、実行エンクロージャ、スタンドアロンイベント |
| [working-directory.md](working-directory.md) | セッション実行ディレクトリ、durable な変更、復旧、ユーザーコンテキスト |
| [worktrees.md](worktrees.md) | 既存の権限の下での実験的な Git ブランチとチェックアウトの作成 |
| [persistence.md](persistence.md) | durability シーム: `SessionPersistence`、JSONL プロバイダー、`session/flush`、クラッシュ復旧、`SessionHeader` |
| [settings.md](settings.md) | ユーザー設定シーム: `SettingsNamespace` 登録、階層解決（既定 → 構成 `base` → ユーザードキュメント）、オーナースコープ、ホットコミット |
| [credentials.md](credentials.md) | 資格情報シーム: 設定内の `CredentialRef` 参照（値ではない）、操作ごとの解決、UI 安全な `CredentialInfo`、プロバイダーソースレイヤー |
| [session-query.md](session-query.md) | 論理レコード、境界付きの正確なイベント読み取り、関係トレース、意味論フィルター/ドキュメント、全文結果ページ |
| [feedback.md](feedback.md) | ライフサイクルに束縛されたメッセージごとのフィードバックレコード、楽観的バージョン、サイドカー永続化、Host Remote 契約 |
| [session-title.md](session-title.md) | durable なタイトルスナップショット、引用されたソースメッセージ seq、非同期プロバイダー契約 |
| [session-reference.md](session-reference.md) | 構造化されたセッション横断参照: `SessionReferenceInput`/`Candidate`、準備されたメッセージコンテキスト、安定したエラー分類 |
| [system-prompt.md](system-prompt.md) | アセンブリごとのコンテキスト、ツールプロバイダー結果、プロンプトセクション、協調的アセンブリ |
| [tools.md](tools.md) | `ToolDefinition` の全フィールド、スキーマ DSL、`ToolExecution`/`ToolResult`、ツール提示 UI 型、ガード付き実行パイプライン |
| [mcp.md](mcp.md) | 外部 MCP 接続、スコープ付きツールとリソース、サーバー指示、プロトコル結果、設定所有権 |
| [user-questions.md](user-questions.md) | UI に支えられた人間の質問/回答シーム: `AskUserQuestionRequest`、回答/オプション語彙、プロバイダー API、エラー分類 |
| [approval.md](approval.md) | ワンショットのユーザー承認シーム: `ApprovalRequest`、`ApprovalOutcome`、セッションごとのポリシー、監査イベント、回答者契約 |
| [office-to-pdf.md](office-to-pdf.md) | 認可された Office→PDF 変換、ネイティブ/WASM エンジン、境界付きの共有再利用 |
| [attachment.md](attachment.md) | durable な画像アイデンティティとメタデータ、検証入力、検証済み読み取り、`AttachmentStore` シーム |
| [shell.md](shell.md) | シェル実行者シーム: `ShellExecRequest`/`Spec`、`ShellRunResult`、バックグラウンド `ShellProcess` ハンドル |
| [subprocess.md](subprocess.md) | サブプロセスシーム: 完全に明示的な `SubprocessSpawnSpec`、オフセットベースの出力リーダー、未分類の `SubprocessOutcome`、管理された `DSH_*` 環境語彙 |
| [ssh.md](ssh.md) | POSIX SSH 接続とリモートファイルシステム、サブプロセスとサンドボックスプロバイダー |
| [terminal.md](terminal.md) | 永続ターミナル id、バックエンド/セッション契約、送信準備、境界付き読み取り、オーナー可視スナップショット |
| [sandbox.md](sandbox.md) | セッションごとのポリシー解決とプロセス閉じ込めシーム: ファイル効果モード、実行/プロバイダーポリシー、`ConfinedArgv`、強制とフェイルクローズドエラー |
| [ptc-runtime.md](ptc-runtime.md) | PTC 実行シーム: `PtcRunRequest`/`Result`、バインディング名前空間、キャプチャされたログ、`PtcRunFailure` 分類 |
| [computer-use.md](computer-use.md) | 排他的な名前付き computer-use プロバイダー登録と Cua Driver 統合の選択 |
| [browser-use.md](browser-use.md) | 排他的な名前付き browser-use 登録、プロバイダー選択、セッションごとのブラウザ所有権 |
| [extensions.md](extensions.md) | バージョン付き動的 Cordis Plugin と Package、Host/Client アクティベーション、承認、ランタイム検査、ライフサイクルティアダウン |
| [filesystem.md](filesystem.md) | ファイルシステムシーム: `FsTarget`、読み取り/書き込み/編集の結果、観察されたファイル状態、`FsErrorCode` |
| [lsp.md](lsp.md) | LSP ナビゲーションシーム: `LspQueryRequest`/`Result`、`LspProvider`/`Service`、4 つの操作、`LspError` |
| [skills.md](skills.md) | スキルサービス: 探索優先順位、`SkillSummary`/`SkillDefinition`、セッションプレフィックスカタログ、モデル向け `skill` ローディング |
| [compaction.md](compaction.md) | compaction シーム: `compaction/*` セッションイベント、`CompactionResult`、`CompactionEngine` インターフェース |
| [subagent.md](subagent.md) | subagent シーム: 名前付きプロバイダーレジストリ、`SubagentStartRequest`/`Result`/`Run`、開始時対実行時のケイパビリティ分割 |
| [voice-input.md](voice-input.md) | 実験的な名前付き認識器、一時オーディオ、リビジョンガード付きドラフト挿入 |
| [translation.md](translation.md) | 実験的な匿名テキスト翻訳と明示的なプロバイダーリクエスト |
| [agent-team.md](agent-team.md) | Agent Teams: 暗黙の Lead アイデンティティ、名前付きで継続可能なチームメイト、peer 受信箱への直接配達、共有タスク DAG |
| [claude-code-mods.md](claude-code-mods.md) | 実験的ブリッジ経由の Claude Code mod: Claude Code と異なるすべてのイベント、`$` メンバー、チェーンルール、描画機能、例 mod |
| [web.md](web.md) | web アクセスシーム: `WebSearchRequest`/`Result`、`WebFetchRequest`/`Result`、`WebFetchBody`、プロバイダー可用性、`WebError` |
| [spill.md](spill.md) | スピルストレージシーム: `SaveTextSpill`、`SpillOwner`/`SpillSource`、`SpillRef`、ブランド付き `SpillLocator` |
| [workflow.md](workflow.md) | ワークフローシーム: `WorkflowStartRequest`、`WorkflowMeta`、`WorkflowRun`/`Result`、`workflow/*` イベントペイロード、`WorkflowError` の致命性 |
| [jobs.md](jobs.md) | バックグラウンドジョブランタイム: ブランド付き `JobId`、プロデューサー契約、消費者ビュー、`ctx.jobs` サービス動作 |
| [permission-presets.md](permission-presets.md) | 権限プリセットレイヤー: `PresetSpec`/`PresetOption`、派生 `custom` 状態、ログのみの `permission/preset` イベント |
| [plan.md](plan.md) | plan モード: ログのみの `plan/mode` 状態、保留中選択のフラッシュ、`PlanModeConfig`、`exit_plan_mode` レビューアーク |
| [web-server.md](web-server.md) | HTTP キャリア: `WebRouteKind`/`WebRoute`、マッチ順序、クレーム可能なフォールバック席、インデックスタップ |
| [webhook.md](webhook.md) | 認証済みプロバイダー配達、任意のプログラム的ルール、ファイアアンドフォーゲットの Workspace セッション作成 |
| [storage.md](storage.md) | ストレージサブシステム: バックエンド契約（`StorageBackend`）、`StorageForms`、`DomainSpec`/`Domain`、`domain/changed` |
| [workspace.md](workspace.md) | ワークスペースレジストリ: `Workspace`/`WorkspaceId`、登録と解決、セッション `cwd` の関係 |
| [web-client.md](web-client.md) | ブラウザーアーキテクチャ: ブート、Remote 通信、ペアになった Client モデル、UI アダプター、Conversation アセンブリ、Slot、再接続セマンティクス |
| [client-modules.md](client-modules.md) | web プラグインテーブル: `dsh.client` 宣言、`WebBootGraph` ワイヤー合成、バンドルルートとインデックスタップ |
| [slots.md](slots.md) | 型付き Web UI 合成: 宣言所有権、濃度とスコープ、フレームワークとフィーチャーの注入、props 導出、出荷済み階層 |
| [client-resources.md](client-resources.md) | クライアントリソースモデル: `dsh-resource://<type>/…` アドレス、プロトコルプロバイダーと `ResourceProtocolMap`、`useResource` グローバルフックとその状態、ピンと解放 |
| [sidebar-right.md](sidebar-right.md) | 右サイドバー: リソースとナビゲーションのアドレス、タブ型の登録とルーティング、`ctx.sidebarRight` ナビゲーションサービス、ペインタブスロットとオーナー props、リソースモデル、Workspace Files サービス |
| [conversation.md](conversation.md) | ターゲット中立の Session イベントアセンブリ: Context アイデンティティ、Location データ、リプレイパス、ビュービルダー、ターゲット所有のレンダーノード |
| [session-projection.md](session-projection.md) | プロジェクションシーム: `SessionProjectionMap`、純粋な `ProjectionDefinition` ユニット、`ProjectionSnapshot` の一貫したカット、変更フィード |
| [session-telemetry.md](session-telemetry.md) | 外向きセッションレポートケイパビリティシーム: `SessionTelemetryRecord`/`SessionTelemetrySeverity`、`SessionTelemetrySink` 契約、`session-telemetry/record` の redact ウォーターフォール |
| [otel.md](otel.md) | 共有の通常イベントと Session ログの OTLP チャネル |
| [product-telemetry.md](product-telemetry.md) | 明示的な製品分析送信と OTLP/HTTP トランスポート |

> これらのページの型宣言とその JSDoc はソースと等価であり、`pnpm run verify-type-equiv` によってドリフトチェックされる（[development.md](../development.md#documenting-types-verbatim-ts-type-equiv) を参照）。通常のブロックは完全な宣言を保持し、`public-api` ブロックは本体を削った公開クラス宣言を保持する。Cordis サービスとイベントは各ページの生成された **Cordis API** セクションを使う。
