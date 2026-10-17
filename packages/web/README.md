---
description: "Web アクセスケイパビリティファミリーのパッケージマップ: 検索/取得サービス、そのプロバイダーバックエンド、それらを消費するモデル向けツール。"
kind: "package-group"
---

# web/ — Web アクセスケイパビリティファミリー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`web/` パッケージにより、モデルは `web_search` と `web_fetch` ツール経由で公開 Web の検索と HTTP(S) ページの取得を行える。検索は Exa、Perplexity、DeepSeek から、取得は匿名 HTTP(S) アクセスから選べ、利用可否とリソース制限は設定済みプロバイダーに依存する。このファミリーは検索とページ取得用であり、対話型ブラウジング、コンテンツ抽出、URL ごとのポリシー適用には使わない。プロバイダーが変わっても、モデルには一貫したツール動作、キャンセル、エラー報告が行われる。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

Web の役割を担う6つのパッケージ。網羅的な語彙と契約はサブシステムリファレンスが所有する。

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`web/`](web/README.md) | 検索/取得サービス: 交換可能なバックエンド経由で URL の検索と取得を行い、選択とエラーポリシーを統一する | `ctx.web` |
| [`web-search-exa/`](web-search-exa/README.md) | Exa 経由で Web を検索する | `ctx.web` に登録する |
| [`web-search-perplexity/`](web-search-perplexity/README.md) | Perplexity 経由で Web を検索する | `ctx.web` に登録する |
| [`web-search-deepseek/`](web-search-deepseek/README.md) | DeepSeek ネイティブ検索経由で Web を検索する | `ctx.web` に登録する |
| [`web-fetch-http/`](web-fetch-http/README.md) | 公開 HTTP(S) ページを匿名で取得する | `ctx.web` に登録する |
| [`tool-web/`](tool-web/README.md) | モデルに `web_search` と `web_fetch` を公開する | `ctx.tools` に登録する |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

共有語彙はサブシステムリファレンスから、単一プロバイダー選択サービスという設計判断はその背後の決定から読み進めること。

- [Web サブシステム](../../docs/subsystems/web.md) — 検索/取得リクエストと結果、プロバイダーの利用可否、`WebError`、公開アドレス強制。
- [Web ケイパビリティシーム決定](../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) — 検索と取得が1つのプロバイダー選択サービスを共有する理由。

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
