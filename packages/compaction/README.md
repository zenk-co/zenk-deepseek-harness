---
description: "Package map for the conversation-condensing feature family: automatic compaction, the on-demand /compact command, and tool-output trimming."
kind: "package-group"
---

# compaction/ — 圧縮ケイパビリティ群

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`compaction/` グループは、モデルのコンテキスト上限付近で長いエージェント会話を動作させ続ける。トークン圧力の高まりに応じて古い履歴は自動的に概要へ凝縮され、`/compact` でオンデマンドに凝縮でき、過大なツール出力は先に刈り込んで凝縮量を減らせ、画像対応ルートが送信できなくなった画像はプレースホルダーに置換される。出荷 `dsh` ベースではこの機能はデフォルトで有効である。凝縮の時期と方法を調整するにはパッケージを明示的にマウントする。凝縮時期を決めるトークン計測は、別の LLM 系サービスに存在する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ

以下の各パッケージが機能の 1 断片を提供する。使用方法は各パッケージページを開くこと。

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`compaction/`](compaction/README.md) | 共有凝縮契約。すべてのバックエンドとトリガーが使用する操作と概要形式 | `ctx.compaction` |
| [`compaction-basic/`](compaction-basic/README.md) | トークン圧力の高まりに応じた古い履歴の自動凝縮 | `ctx.compaction` を登録 |
| [`compaction-tool-result-pruner/`](compaction-tool-result-pruner/README.md) | 過大なツール出力を刈り込み、凝縮が必要な履歴を減らす | `ctx.toolResultPruner` |
| [`compaction-image-offload/`](compaction-image-offload/README.md) | 画像対応ルートがリクエストを拒否した際、予算超過のリクエスト画像をプレースホルダーに置換する | `agent/request-error` を受信 |
| [`command-compact/`](command-compact/README.md) | オンデマンドで履歴を凝縮する `/compact` コマンド | `ctx.commands` に登録 |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

共有語彙のサブシステムリファレンスから始め、設計根拠の 2 つの Agent Note を読む。

- [圧縮サブシステムリファレンス](../../docs/subsystems/compaction.md) — 凝縮語彙、結果、サービス動作。
- [歴史的圧縮ケイパビリティシーム Agent Note](../../.agents/notes/archived/feature/2026-06-18-compaction-capability-seam.md) — 群の分割方法と、セッション・LLM 語彙に依存する理由。
- [キュー手動圧縮リファレンス](compaction/README.md) — オンデマンド `/compact` が実行中ターンに対して直列化される仕組み。
- [ケイパビリティシーム](../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.md) — この群が従う Service Definition / Service Provider / Consumer 分割。

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
