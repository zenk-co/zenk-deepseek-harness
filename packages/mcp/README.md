---
description: "MCP パッケージグループ: 外部 Model Context Protocol サーバーに接続し、そのツールを呼び、リソースを読む。"
kind: "package-group"
---

# MCP — Model Context Protocol

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`mcp/` グループでは、モデルが外部 Model Context Protocol（MCP）ツールを呼び、サーバーリソースを読める。`mcp-client` エントリのみを設定すること。出荷プロファイルは `mcp-resources` を 1 回マウント済みである。MCP ツールとプロンプトテキストは、スコープ内に設定済みサーバーを持つ呼び出し元にのみ現れる。接続はサーバー指示も供給する。設定と制限はパッケージ README が所有する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

設定済み接続はクライアントが所有し、共有リソースパッケージがそれらの接続を横断してリソースツール群を供給する。

| Package | What it provides |
|---|---|
| [`mcp-client/`](mcp-client/README.md) | 1 つの MCP サーバーに接続し、そのツールと指示を公開し、そのリソース操作を提供する |
| [`mcp-resources/`](mcp-resources/README.md) | 明示的なサーバー選択を伴う共有ツール群でリソースを探索して読む |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

プラグインの動作を見るには実践的な設定例から試し、その背後の動作決定は Agent Note を読むこと。

- [歴史的な MCP クライアントプラグイン Agent Note](../../.agents/notes/archived/feature/2026-07-07-mcp-client-plugin.md) — ブリッジの設計: サーバー修飾命名、探索、実行、環境スクラブ。
- [リソース・指示参照](mcp-resources/README.md) — オンデマンドのリソースアクセスとスコープ付きサーバーガイダンス。
- [サードパーティ製メモリ MCP ガイド](../../docs/user/guide/mcp-memory.md) — 実行可能なオーバーレイ行と設定手順。
- [ツールサブシステム参照](../../docs/subsystems/tools.md) — 登録済みツールを受け取る `ToolRuntime`。

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
