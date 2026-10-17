---
description: "共有実用集のパッケージ地図。不可分文件書込、銘付き id、両端待ち行列、JSON 値、harness 居経路、起動環境、生命令、出力保持、時間帯、期限。"
kind: "package-group"
---

# util/ — 共有実用集

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`util/` 群は重複実装の代わりに共有の機械的素材をケイパビリティパッケージに与える。不可分書込、銘付き id、両端待ち行列、可逆 JSON 値、UUID、Harness 居経路、起動環境、外向 proxy 方針、生命令、出力保持、時間帯正準化、期限処理を覆う。ここの各根項目は蔵書である。製品サービスもイベントも登録せず、消費ケイパビリティが業務意味論を保つ。

## 目次

- [パッケージ群](#packages)
- [関連文書](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ群

各パッケージは素材 1 つを提供する。使い方は各包頁を開くこと。

| パッケージ | 役割 |
|---|---|
| [`brand/`](brand/README.md) | 名目文字列型とその無状態構成子 |
| [`package-manifest/`](package-manifest/README.md) | 包宣言用の共有 TypeScript 宣言 |
| [`plugin-market-index/`](plugin-market-index/README.md) | 插件市場索引形式 1 を検証し固定導入引数を組み立てる |
| [`crypto/`](crypto/README.md) | 越実行時 `crypto.getRandomValues` 素材から RFC 9562 v4 UUID を鋳る |
| [`deque/`](deque/README.md) | 有界空き貯蔵で償却定時待ち行列操作を提供する |
| [`chunked-list/`](chunked-list/README.md) | 有界追加写しと検査点検証で不変一覧版を保つ |
| [`values/`](values/README.md) | 可逆 JSON 適合値を検証、 snapshot、比較、凍結する |
| [`home-paths/`](home-paths/README.md) | 単一 Harness 居を解決し共有利用者資料経路を結合する |
| [`http-proxy/`](http-proxy/README.md) | 単一外向 proxy 方針を解決し `fetch`、SDK 応答者、子出産に導入する |
| [`launch-environment/`](launch-environment/README.md) | 各値を供給した層を憶える凍結起動環境 |
| [`atomic-write/`](atomic-write/README.md) | 不可分文件置換と越過程書込錠 |
| [`lazy-require/`](lazy-require/README.md) | 呼出者相対解決で CommonJS 適合 Host 依存を初用時に読み込む |
| [`native-command/`](native-command/README.md) | 殻文字列経由でなく host 生命令を直接走らせる |
| [`workspace-path/`](workspace-path/README.md) | ブラウザー安全な Workspace 経路と表示補助を提供する |
| [`code-language/`](code-language/README.md) | ファイル名接尾辞を符号 preview、差分査読、読み札が描く構文強調言語に写像する |
| [`output-retention/`](output-retention/README.md) | 模型対面出力を限り厳密な省略附属を報告する |
| [`time/`](time/README.md) | 呼出者報告の IANA 時間帯を検証し正準化する |
| [`timeout/`](timeout/README.md) | 期限算術、信号融合、期限対取消分類 |

-----

<a id="related-documentation"></a>
## 関連文書

- [根包地図](../README.md) — 全包群の中での `util/` 位置。
- [生成設定目録](../../docs/config-catalog.md) — この群が一部を成す蔵書包索引。
- [包追加手引き](../../docs/cookbook/adding-a-package.md) — 新共有素材がこの群に着陸する仕方。

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
