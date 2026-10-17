---
description: "The context group map: request-context plugins that add durable, model-visible context without defining tools, for users and maintainers navigating the group."
kind: "package-group"
---

# context/ — リクエストコンテキストプラグイン

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

context グループは、ツールを定義せずに各リクエストへモデル可視コンテキストを追加するプラグインを提供する。ワークスペース命令ファイルはガイダンスとなり、`@file` メンションはパス補完を提供し、他セッションは境界付きスナップショットとして参照でき、モデルは現在時刻とエージェントの tmux 位置を認識できる。`agent-instructions`（`dsh-base`）のみがデフォルトでマウントされたまま出荷され、残りは任意である。コンテキストは durable である。注入された命令と参照はユーザーロールメッセージとしてセッション履歴に入るため、他の会話内容と同様に永続化、リプレイ、圧縮される。このページはグループを対応付ける。各パッケージ契約は各パッケージ README が所有する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`agent-instructions/`](agent-instructions/README.md) | `AGENTS.md`/`CLAUDE.md` ワークスペース命令をコンテキストに読み込み、ファイル編集後に更新する | — |
| [`session-reference/`](session-reference/README.md) | 他セッションの参照。1 件にメンションすると境界付き読み取り専用スナップショットがコンテキストになる | `ctx.sessionReferenceResolver` |
| [`file-reference/`](file-reference/README.md) | ホスト支援 UI 用の `@file` メンション検出と共有メンション文法 | `ctx.fileReferences` |
| [`file-reference-local/`](file-reference-local/README.md) | `@file` メンション用ローカルワークスペース補完プロバイダー | — |
| [`time-context/`](time-context/README.md) | 現在時刻、ブラウザーゾーン、ステップごとの経過時間 | — |
| [`tmux-context/`](tmux-context/README.md) | エージェントの tmux セッション、ウィンドウ、ペイン位置 | — |
| [`harness-dev-context/`](harness-dev-context/README.md) | ランタイムコンテキストとしての harness チェックアウトと Web GUI URL。プロセスをまたいでシステムプロンプトを安定させる | — |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [セッション参照サブシステム](../../docs/subsystems/session-reference.md) — 正規メンション URI、スナップショット意味、安定エラー分類。
- [ワークスペースコンテキスト決定記録](../../.agents/notes/archived/feature/2026-06-24-workspace-context.md) — 命令コンテキストがエージェント/セッションごとで durable にログされる理由。
- [生成設定カタログ](../../docs/config-catalog.md) — グループのパッケージが受け付けるすべての設定フィールド。

-----

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
