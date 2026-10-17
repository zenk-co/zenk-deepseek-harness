---
description: "experimental グループのマップ: 公開インストール可能な pre-stable プロトタイプ群。"
kind: "package-group"
---

# packages/experimental

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

experimental ケイパビリティは、製品サポートのコミットメントなしに、明示的にインストールして構成する。パッケージの命名と公開は [experimental パッケージポリシー](../../scripts/experimental-package-policy.ts)に従う。[オプションバンドルのルール](../../.agents/notes/implemented/architecture/2026-09-21-experimental-capabilities-as-optional-bundles.md)は、どのケイパビリティがインストール時にオフのまま出荷され、GUI プラグインマネージャーの Official グループで明示的に選択されるかを決める。

## 目次

- [Experimental、オプショナル、Official](#status)
- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="status"></a>
## Experimental、オプショナル、Official

**Experimental** とは、公開ケイパビリティの全体が評価中であり、製品サポートのコミットメントではないことを意味する。その挙動や API は変更される可能性があり、ケイパビリティが撤回されることもある。ただし、エンジニアリング、セキュリティ、ドキュメント、テスト、およびリリース済みデータに関する義務は引き続き適用される。パッケージがここに属するのは、その公開契約の全体が experimental または内部専用である場合のみである。製品パッケージ内の experimental オプションは、その製品ロールとともに留まる。

**Optional** とは、ユーザーがケイパビリティを明示的に選択することを意味する。**Official** とは、プロジェクトがパッケージを維持し、Plugins ページに掲載していることを意味する。どちらも成熟度を表さず、公開、デフォルトインストール、GUI での可視性も成熟度を決めない。このグループ外の製品パッケージは維持された製品ロールを持ち、その公開 API は依然としてリポジトリの pre-stable ポリシーに従う。

昇格には、名前付きの製品ロール、文書化された公開挙動と制限、現在のコンシューマー、リリース内容、およびテストエビデンスが必要である。パッケージをその製品グループに移動し、そのグループの命名規則を適用し、影響を受けるコンシューマーを同時に更新する。[サブツリーのルール](AGENTS.md)が依存関係の分離と公開を規定する。

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`tool-session-query`](tool-session-query/README.md) | ワークスペース認可付きのモデルセッション検索、トレース、イベント読み取り | — |
| [`session-search`](session-search/README.md) | オプションの experimental グローバルセッション検索ツール | — |
| [`ralph-bundle`](ralph-bundle/README.md) | 分離されたワークフローエンジンによるオプションの反復委任 | — |
| [`terminal-bundle`](terminal-bundle/README.md) | オプションのグローバル永続ターミナルツール | — |
| [`badge-skill-bundle`](badge-skill-bundle/README.md) | オプションの powered-by-dsh バッジスキル | — |
| [`session-titles-bundle`](session-titles-bundle/README.md) | 会話内の人間のプロンプトに追従するオプションのタイトル | — |
| [`hook-protocol`](hook-protocol/README.md) | フックブリッジのワイヤ型と永続イベント | — |
| [`hooks-claude-code`](hooks-claude-code/README.md) | Claude Code フックブリッジ | — |
| [`hooks-codex`](hooks-codex/README.md) | Codex フックブリッジ | — |
| [`webhook`](webhook/README.md) | 認証付き配信ディスパッチとワークスペースセッション作成 | `ctx.webhookRuntime` |
| [`webhook-github`](webhook-github/README.md) | 署名検証付き GitHub webhook イングレス | — |
| [`session-title-all-prompts-llm`](session-title-all-prompts-llm/README.md) | すべての人間プロンプトからのセッションタイトル | — |
| [`tool-terminal`](tool-terminal/README.md) | 永続ターミナルツール | — |
| [`tool-ralph`](tool-ralph/README.md) | 上限付きの反復委任タスク | — |
| [`skill-badge`](skill-badge/README.md) | powered-by-dsh バッジスキル | — |
| [`translator`](translator/README.md) | 匿名の Google および Bing テキスト翻訳 | `ctx.translator` |
| [`client-ui-cot-translation`](client-ui-cot-translation/README.md) | 拡張された推論翻訳と原文テキストコントロール | `ctx.cotTranslation` |
| [`cot-translation-bundle`](cot-translation-bundle/README.md) | デフォルト無効の推論翻訳構成 | — |
| [`speech-to-text`](speech-to-text/README.md) | 名前付き音声認識プロバイダー | `ctx.speechToText` |
| [`speech-to-text-sensevoice`](speech-to-text-sensevoice/README.md) | 管理されたローカル SenseVoice 推論 | — |
| [`api-speech-to-text`](api-speech-to-text/README.md) | 認証付きの一時的な文字起こし Remote | `ctx.speechController` |
| [`client-ui-voice-input`](client-ui-voice-input/README.md) | マイク取り込みとガード付きドラフト挿入 | — |
| [`plugin-market-bundle`](plugin-market-bundle/README.md) | デフォルト無効のオプションカスタムプラグインマーケット: マーケットサービスと Discover タブ | — |
| [`voice-input-bundle`](voice-input-bundle/README.md) | デフォルト無効のオプション音声入力構成 | — |
| [`agent-team-profile`](agent-team-profile/README.md) | Agent Teams のコラボレーション、ツール、Web UI バンドル | — |
| [`agent-team`](agent-team/README.md) | ダイレクトメッセージと永続的な共有タスクボードを備えた名前付きチームメイト | `ctx.agentTeams` |
| [`client-ui-agent-team`](client-ui-agent-team/README.md) | Web 向けのチーム名簿、タスクボード、チームメイトナビゲーション | — |
| [`auto-review`](auto-review/README.md) | 各ネイティブまたは PTC 内部ツール呼び出しの前に同一モデルレビューを行う明示的 Web レイヤー | — |
| [`claude-code-mods`](claude-code-mods/README.md) | Claude Code mod をプラグインとして実行: ハーネス拡張ポイント上のフックチェーンとプロンプト上のバンド | `ctx.claudeCodeMods` |
| [`client-ui-claude-code-mods`](client-ui-claude-code-mods/README.md) | プロンプト上に mod のツリーを描画し、ボタンクリックを送り返す Web バンド | — |
| [`ptc-runtime-python`](ptc-runtime-python/README.md) | PTC 実行シームの CPython サブプロセスバックエンド | `ctx.ptcRuntime` |
| [CUA](cua/README.md) | 共有アプリケーション/ウィンドウオブジェクト、同意、ログ記録された実行。 | ライブラリ |
| [macOS CUA](cua-macos/README.md) | Swift ネイティブ実行とプラットフォーム準備。 | `ctx.computerUse` |
| [`computer-use-cua-driver-mcp`](computer-use-cua-driver-mcp/README.md) | インストール済み Cua Driver を MCP 経由で使用 | `ctx.computerUse` |
| [`computer-use-cua-driver-native`](computer-use-cua-driver-native/README.md) | Cua Driver ネイティブ npm ランタイムを埋め込む | `ctx.computerUse` |
| [`browser-use-playwright-mcp`](browser-use-playwright-mcp/README.md) | MCP 経由の Playwright ブラウザーツール | `ctx.browserUse` |
| [`browser-use-chrome-devtools-mcp`](browser-use-chrome-devtools-mcp/README.md) | MCP 経由の Chrome DevTools 検査とブラウザー制御 | `ctx.browserUse` |
| [`browser-use-stagehand-native`](browser-use-stagehand-native/README.md) | 明示的に設定されたネイティブモデルによる Stagehand ブラウザー操作 | `ctx.browserUse` |
| [`browser-use-runtime`](browser-use-runtime/README.md) | experimental プロバイダーが共有するセッション所有のブラウザーリソース | — |
| [`inspector`](inspector/README.md) | Host デバッグ、Client Runtime 検査、ネットワークキャプチャ、Cordis ツリーのためのクロスレルム CDP ハブ | `ctx.inspector` |
| [`session-inspector`](session-inspector/README.md) | 生のセッションログと Chat ノードのサイドバーテーブル | — |
| [`inspector-profile`](inspector-profile/README.md) | セッションログと Chat ノード検査のためのオプション Web バンドル | — |
| [`tool-agent-team`](tool-agent-team/README.md) | モデルがチームメイトを作成、メッセージ送信、調整できる 9 つのツール | `ctx.tools` にスコープ付きツールを登録 |
| [`tool-worktree`](tool-worktree/README.md) | worktree を作成して入るためのオプションバンドルとモデルツール | `ctx.tools` |
| [`webworker-packer`](webworker-packer/README.md) | ブラウザーワーカープレビューが消費する gzip 圧縮 VFS イメージをビルド | ライブラリと CLI — ctx キーなし |
| [`webworker-runtime`](webworker-runtime/README.md) | 専用ブラウザーワーカー内でハーネスプラグインツリーを実行 | ライブラリとワーカーエントリ — ctx キーなし |
| [`worktree`](worktree/README.md) | 名前付き Git worktree を作成し、呼び出し元セッションのディレクトリを変更 | `ctx.worktrees` |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [experimental 公開リファレンス](../../scripts/experimental-package-policy.ts) — 公開デフォルトとプライベート例外。
- [Worktrees](../../docs/subsystems/worktrees.md) — 明示的なブランチとチェックアウトの作成。
- [Computer use](../../docs/subsystems/computer-use.md) — デスクトッププロバイダーの選択肢。
- [Browser use](../../docs/subsystems/browser-use.md) — ブラウザープロバイダーの選択肢とセッション所有権。
- [Agent Teams サブシステム](../../docs/subsystems/agent-team.md) — 永続的な Team 型と `ctx.agentTeams` サービス API。
- [experimental サブツリーのルール](AGENTS.md) — experimental ステータスが緩和するものとしないもの。

-----

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
