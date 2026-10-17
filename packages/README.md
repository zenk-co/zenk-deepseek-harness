---
description: "DeepSeek Harness パッケージワークスペース。packages/ 配下の npm パッケージのグルーピング、各グループの所有範囲、それらを束ねる規約。"
kind: "package-group"
---

# Packages

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

ハーネスは `packages/` 配下の npm パッケージから組み立てられ、ケイパビリティファミリーごとにグループ化される。セッションとエージェントループ、モデルに面したツール、シェルとファイルシステム実行、Web アクセス、サブエージェント、その他である。このページを最上位マップとして使う。所有グループを見つけてから、その README を開いてパッケージ一覧を見る。各パッケージは `@deepseek-ai/dsh-*` スコープであり、ちょうど 1 つのグループに属する。各グループ README はそのファミリーの信頼できるパッケージマップである。

## 目次

- [パッケージグループ](#package-groups)
- [リリース期待](#release-expectations)
- [依存関係](#dependencies)
- [パッケージ README 契約](#package-readme-contracts)
- [Dev Note](#dev-note)

-----

<a id="package-groups"></a>
## パッケージグループ

各パッケージはちょうど 1 つのグループに属する。新規パッケージは既存グループに参加し、新規グループは独自 README とこの表を更新する。

| グループ | 役割 |
|---|---|
| [`core/`](core/README.md) | 製品 API 脊柱。セッション、プロンプト、ツール、エージェントサービス、具体ループ |
| [`api/`](api/README.md) | リモート BFF 組み立てと Typert RPC ゲートウェイ |
| [`typert/`](typert/README.md) | 型グラフ生成、成果物ロード、ランタイムレジストリ |
| [`goal/`](goal/README.md) | 同一セッションのゴール永続化とライフサイクル |
| [`schedule/`](schedule/README.md) | Host 所有のスケジュール済みフォローアップ |
| [`feedback/`](feedback/README.md) | ヒューマンフィードバック取得とコマンド |
| [`telemetry/`](telemetry/README.md) | 共有 Cordis OTel 報告チャネル |
| [`identity/`](identity/README.md) | 共有匿名アイデンティティ |
| [`llm/`](llm/README.md) | LLM ケイパビリティファミリー。抽象サービス + プロバイダーアダプター |
| [`subprocess/`](subprocess/README.md) | サブプロセスケイパビリティファミリー。サービス定義 + ローカルプロセストリープロバイダー |
| [`ssh/`](ssh/README.md) | POSIX リモート接続。ペアのファイルシステム・サブプロセス・サンドボックスプロバイダー付き |
| [`shell/`](shell/README.md) | Bash ケイパビリティファミリー。実行器シーム、ローカル実装、モデルに面したツール |
| [`terminal/`](terminal/README.md) | 永続 PTY サービス。所有者スコープセッションとローカルシェルバックエンド付き |
| [`ptc-runtime/`](ptc-runtime/README.md) | PTC 実行ケイパビリティファミリー。サービス定義 + サンドボックス Node プロバイダー + PTC モードコンシューマー |
| [`computer-use/`](computer-use/README.md) | 排他的名前付きデスクトッププロバイダー登録 |
| [`browser-use/`](browser-use/README.md) | 排他的名前付きブラウザープロバイダー登録 |
| [`sandbox/`](sandbox/README.md) | プロセス隔離シーム。bwrap/Landlock/Seatbelt バックエンド |
| [`deliverables/`](deliverables/README.md) | ターン成果物。明示ファイル配送と記録済みワークスペース変更 |
| [`fs/`](fs/README.md) | ファイルシステムケイパビリティファミリー。シーム、ローカル実装、モデルに面したファイルツール、探索ツール |
| [`lsp/`](lsp/README.md) | LSP ケイパビリティファミリー。シーム、汎用 stdio プロバイダー、`lsp` ツール |
| [`skill/`](skill/README.md) | スキルケイパビリティファミリー。プロバイダーレジストリ、ローカルプロバイダー、モデルに面したカタログ/ローダー |
| [`compaction/`](compaction/README.md) | コンパクションケイパビリティファミリー。サービス定義 + 基本プロバイダー + コマンドコンシューマー |
| [`context/`](context/README.md) | モデル可視リクエストコンテキスト。ワークスペース指示、時刻コンテキスト、参照 |
| [`subagent/`](subagent/README.md) | サブエージェントケイパビリティファミリー。プロバイダーレジストリ契約とモデルに面した委任ツール |
| [`jobs/`](jobs/README.md) | 汎用バックグラウンドジョブランタイムとモデルに面したジョブ制御ツール |
| [`experimental/`](experimental/README.md) | 評価中のケイパビリティ。[状態とサポートポリシー](experimental/README.md#status) |
| [`workflow/`](workflow/README.md) | ワークフローシーム、PTC プロセスエンジン、モデルに面した `workflow` ツール |
| [`web/`](web/README.md) | Web ケイパビリティファミリー。シーム、検索/取得プロバイダー、モデルに面した Web ツール |
| [`document/`](document/README.md) | 共有 Host Office-to-PDF 変換 |
| [`attachment/`](attachment/README.md) | 耐久添付アイデンティティ、検証、ローカル内容アドレス記憶域 |
| [`spill/`](spill/README.md) | Spill ケイパビリティファミリー。記憶域シーム、ローカル実装、ツール結果 spill ポリシー |
| [`todo/`](todo/README.md) | モデルに面した `todo_write` ツール |
| [`plan/`](plan/README.md) | プラン協働状態。直接エントリコマンドとレビュー済み出口付き |
| [`preset/`](preset/README.md) | プリセット `cordis.yml` ファイルからのセッション単位エージェント合成 |
| [`guard/`](guard/README.md) | ループ衛生ガード。助言的繰り返し呼び出しリマインダー + `tools/execute` デッドライン強制 |
| [`bundle/`](bundle/README.md) | インストール可能な `dsh --profile` パッチ層 |
| [`extensions/`](extensions/README.md) | エージェントランタイム自己改変。ライブプラグイン/サービス検査とモデル記述マウント/アンマウント |
| [`mcp/`](mcp/README.md) | ネイティブツールとして公開される外部 Model Context Protocol サーバー |
| [`session/`](session/README.md) | 耐久セッションデータプレーン。永続化シーム + バックエンド、投影シーム、ログ支援タイトル、セッションレポート |
| [`session-query/`](session-query/README.md) | セッション取得ファミリー。論理コーパス、境界付き読み取り、系統、意味フィルタ、SQLite 全文検索 |
| [`settings/`](settings/README.md) | ユーザー設定シーム + ファイル支援プロバイダー |
| [`credentials/`](credentials/README.md) | 資格情報参照・資格情報記録シーム + env-over-`.env` プロバイダー + ヒューマンに尋ねる認可フロー |
| [`storage/`](storage/README.md) | 非セッション記憶域ハブ + バックエンド + ドメイン形式 |
| [`workspace/`](workspace/README.md) | ワークスペースエンティティ |
| [`sdk/`](sdk/README.md) | プロセス外 SDK。JSON-RPC プロトコルと TypeScript クライアント/サーバー |
| [`acp/`](acp/README.md) | 自動化専用 Agent Client Protocol サーバー |
| [`interaction/`](interaction/README.md) | ヒューマン協働プレーン。承認/対話シーム、権限プリセット、コマンド、ask-user ツール |
| [`boot/`](boot/README.md) | 共有アプリ bin ブート接着剤 |
| [`host/`](host/README.md) | Web GUI ホストサービス、ディレクトリ選択、アプリケーション起動、プラグイン目録、製品テレメトリー |
| [`client/`](client/README.md) | Web-GUI ブラウザー半分。シェル、wire、オブジェクトサービス、スロット、`ui-*` プラグイン |
| [`test-support/`](test-support/README.md) | テスト基盤 (テストキット、リプレイ、Loader スモーク) |
| [`util/`](util/README.md) | グループ横断で共有される低レベル無依存ユーティリティ (`Branded<B>`、home/パスヘルパー、タイムアウト、保持) |

-----

<a id="release-expectations"></a>
## リリース期待

製品グループは保守される製品役割を持つ一方、公開 API はプレ安定のままである。[Experimental 状態](experimental/README.md#status)は公開・インストール・任意配送とは独立である。非 experimental ランタイムパッケージは製品利用または明示の[パッケージ分類](../scripts/product-package-policy.ts)を持たなければならない。SDK・ビルド・テスト・宣言基盤は別の分類を持つ。

-----

<a id="dependencies"></a>
## 依存関係

依存グラフは生成される。[docs/module-graph.md](../docs/module-graph.md) (`pnpm run gen-module-graph`、CI で鮮度ゲート)。

**拡張プラグインはサービス定義に依存し、具体プロバイダーには決して依存しない。**`dsh-agent-loop` は交換可能である。UI・フック・ツールプラグインは `dsh-agent` を使う。合成バンドルは脊柱プラグインに依存しうる。ケイパビリティは、独立に進化する場合にサービス定義 / サービスプロバイダー / コンシューマー役割を分離する。[ケイパビリティシーム](../.agents/notes/implemented/architecture/2026-06-13-capability-seams.md) を見る。

-----

<a id="package-readme-contracts"></a>
## パッケージ README 契約

各パッケージ README は、モデル非依存の[省略許可リスト](../scripts/verify-package-readme-model-experience.ts)が免除しない限り、目的・設定・拡張点・[モデル体験](../docs/cookbook/adding-a-package.md#4-write-the-package-readme)を扱う。また `## Known Limitations and Deferred Work` を備えるか、その[許可リスト](../scripts/verify-package-readme-limitations.ts)を使う。パッケージ規約 — エクスポート、サービスアクセス、テスト — は [packages/AGENTS.md](AGENTS.md) にある。

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>メンテナ向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
