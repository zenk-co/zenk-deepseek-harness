---
description: "lsp グループマップ: LSP シーム経由の言語サーバーによるコードナビゲーション、その stdio プロバイダー、モデル対面の lsp ツール。グループを行き来するユーザーとメンテナー向け。"
kind: "package-group"
---

# lsp/ — 言語サーバーによるコードナビゲーション

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

lsp グループでは、設定済み言語サーバー経由でエージェントがコードをたどれる。定義への移動、参照と実装の検索、ホバードキュメントの読み取りである。ローカル stdio 言語サーバーコマンドと拡張子マッピングの接続には `lsp-stdio` を使い、それらの操作をモデルに提供するには `tool-lsp` を使う。共有 `lsp` パッケージがプロバイダー選択と正規化済み結果の一貫性を保つため、サーバーを変えてもモデル要求は変わらない。配備では言語サーバーを用意して設定しなければならない。このグループはサーバーを同梱しない。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| Package | Role | ctx key |
|---|---|---|
| [`lsp/`](lsp/README.md) | コードナビゲーションサービスを定義する: 拡張子によるプロバイダー選択、4 つの正規化済み読み取り専用操作、構造化エラー | `ctx.lsp` |
| [`lsp-stdio/`](lsp-stdio/README.md) | `ctx.fs` と `ctx.subprocess` 上で設定済み stdio 言語サーバーコマンドをプロバイダーとして駆動する | `ctx.lsp` に登録 |
| [`tool-lsp/`](tool-lsp/README.md) | `lsp` ツール経由でモデルに精密なコードナビゲーションを公開する | `ctx.tools` に登録 |

プロバイダーが登録するのはケイパビリティであり、ツールではない。モデル対面の名前、スキーマ、プロンプトガイダンス、表示の唯一の所有者は `tool-lsp` であり、プロバイダーを交換してもモデルがナビゲーションを求める方法は変わらない。

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [LSP ナビゲーションサブシステム](../../docs/subsystems/lsp.md) — 操作、座標、要求と結果、`LspError` コード。
- [生成ツールカタログ](../../docs/tool-catalog.md#deepseek-aidsh-tool-lsp) — モデルが受け取る `lsp` スキーマ。

-----

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
