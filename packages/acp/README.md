---
description: "Agent Client Protocol パッケージグループ: JSON-RPC stdio 越しにプログラム的クライアントへ新鮮な Harness エージェントを公開する自動化専用サーバー。"
kind: "package-group"
---

# acp/ — Agent Client Protocol 自動化

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

acp グループは 1 パッケージを提供する。標準 Agent Client Protocol 越しにプログラムと自動化が永続的な DeepSeek Harness エージェントを動かせるサーバーである。クライアントはセッションの作成、一覧、再開、終了、標準 MCP サーバーの接続、モデル選択肢の選択、テキスト・イメージプロンプトの送信、意味的更新の受信、許可プロンプトへの回答、人手なしの作業キャンセルができる。別 Harness からそのようなサーバーを起動する対応クライアントは `subagent/subagent-acp` にある。このページはグループを対応付け、パッケージごとの契約はパッケージ README が所有する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| Package | Role |
|---|---|
| [`acp/`](acp/README.md) | ACP 越しにプログラムが永続エージェントを管理し、MCP サーバーを接続し、モデル選択肢を選び、作業にプロンプトしてキャンセルし、意味的更新を受け取れるようにする |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [dsh-subagent-acp](../subagent/subagent-acp/README.md) — このサーバーを起動して駆動するプロセス外 ACP クライアント。
- [自動化専用プロトコルとしての ACP](../../.agents/notes/implemented/simplification/2026-07-23-acp-automation-only-protocol.md) — 自動化契約とそのワイヤー境界の設計記録。
- [1 接続上の多重並行 ACP セッション](../../.agents/notes/archived/feature/2026-06-14-acp-multi-session.md) — セッションごとの分離、所有権、破棄の決定。

<a id="dev-note"></a>
## 開発者ノート

なし。
