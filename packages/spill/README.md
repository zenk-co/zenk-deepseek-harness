---
description: "テキストスピルケイパビリティ群のパッケージマップ: ストレージサービス、ローカルバックエンド、結果ポリシーがそれぞれ何を提供するか。"
kind: "package-group"
---

# spill/ — テキストスピルケイパビリティ群

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`spill/` グループはモデルのコンテキストの外に全文を保存し、取得ガイダンス付きのロケーターを返す。群は `spill/` 内のストレージサービス、`spill-local/` 内のローカルファイルシステムバックエンド、`spill-policy/` 内のツール結果ポリシーに分かれる。ツール結果のスピルは `maxInlineTokens` 経由のオプトインであり、ストレージ失敗時は元の結果を保持する。[Session 参照](../context/session-reference/README.md)も、切り詰められたキャプチャ済みトランスクリプト向けに独自のプレビューと失敗通知でストレージを直接利用する。ツール結果ポリシーは不要である。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

3 パッケージがスピル役割を担う。網羅的な語彙と契約はサブシステム参照が所有する。

| Package | Role | ctx key |
|---|---|---|
| [`spill/`](spill/README.md) | ストレージサービス: 過大なテキストを保存し、ロケーターと取得ガイダンスを返す | `ctx.spillStore` |
| [`spill-local/`](spill-local/README.md) | スピル済みテキストをこのマシン上のプライベートなセッションスコープファイルに保存する | `ctx.spillStore` に登録 |
| [`spill-policy/`](spill-policy/README.md) | 過大なプレーンテキストのツール結果をプレビューとロケーターに置き換える | `ctx.tools` を待ち受け |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

共有語彙はサブシステム参照から始め、次に設計決定を読むこと。

- [スピルサブシステム](../../docs/subsystems/spill.md) — `SaveTextSpill`/`SpillRef` 語彙、所有権、バックエンド関係。
- [ツール出力スピル決定](../../.agents/notes/implemented/architecture/2026-07-08-tool-output-spill-files.md) — ストレージ、保持、ツール所有の出力処理の間のケイパビリティ境界。

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
