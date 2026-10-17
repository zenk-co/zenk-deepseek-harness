---
description: "セッション取得ケイパビリティファミリーのパッケージマップ: ライブと durable のセッション履歴の検索、追跡、読み取り、および Web セッションログエクスポート。"
kind: "package-group"
---

# session-query/ — セッション取得ケイパビリティファミリー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`session-query/` グループは、コンパクションとは独立に、ライブと durable のセッション履歴に対する取得を提供する。プログラムによる呼び出し元は、正確なログ、フィルタ済み一覧、関係追跡、全文検索について1つの統一クエリーサービスに問い合わせる。SQLite バックエンドが検索を駆動し、Web UI はセッション ZIP をダウンロードする `/export` コマンドを備える。検索結果はモデルが見る会話履歴と一致する。このページはグループを対応付ける。各パッケージの契約は各パッケージ README が所有する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

ファミリーの各部位で何ができるかは各パッケージ README が記述する。

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`session-query/`](session-query/README.md) | 統一セッション履歴クエリーサービス: 正確な読み取り、関係追跡、フィルター | `ctx.sessionQuery` |
| [`session-query-sqlite/`](session-query-sqlite/README.md) | SQLite FTS5 インデックスに支えられたセッション履歴の全文検索 | `ctx.sessionQuery` に登録する |
| [`session-log-export/`](session-log-export/README.md) | Web の `/export` コマンドとセッション ZIP のブラウザーダウンロード | `ctx.sessionLogDownload`（ブラウザー） |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

共有クエリー語彙はサブシステムリファレンスから、追跡と検索の背後にある設計記録はその次に読み進めること。

既定の Web と Desktop はこの共有クエリー、インデックス、エクスポート基盤を使う。[実験的なモデル向けツール](../experimental/tool-session-query/README.md) は個別のオプショナル消費者である。

- [Session Query サブシステムリファレンス](../../docs/subsystems/session-query.md) — 論理レコード、フィルター、検索ページ、リネージ、有界読み取り、イベント関係。
- [セッションクエリー関係追跡](../../.agents/notes/archived/feature/2026-07-13-session-query-tracing.md) — 追跡セマンティクスと検証境界。
- [SQLite FTS5 セッション検索](../../.agents/notes/archived/feature/2026-07-10-sqlite-session-query-provider.md) — 検索セマンティクス、照合、トークナイザーの決定。

<a id="dev-note"></a>
## 開発ノート

なし。
