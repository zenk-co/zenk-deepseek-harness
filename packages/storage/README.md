---
description: "ストレージグループマップ: ワークスペースレコードやセッションサイドカーなど durable な非セッションデータを、名前付きバックエンドと型付きドメインデータ形式で保持する。"
kind: "package-group"
---

# packages/storage

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

ストレージグループは、ワークスペースレコードやセッションサイドカーを含む非セッションアプリケーションデータを再起動をまたいで保持する。`storage-json` は人間可読ファイル向け、`storage-sqlite` は単一データベース内でのポイント更新向け、`storage-domain` はスキーマ検証済み型付きレコードと変更通知を追加し、`storage` は設定済みバックエンドを選択する。これらのパッケージはオプショナルで Host 側のものであり、モデルにツール、プロンプト内容、セッションイベントを公開しない。アプリ状態がプロセスを超えて存続しなければならない場合にこのグループを使い、そのようなデータがない構成では省略すること。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`storage`](storage/README.md) | 登録済みバックエンドとマウント済みデータ形式ファシリティを接続する | `ctx.storage` |
| [`storage-json`](storage-json/README.md) | 1単位を1つの人間可読 JSON ファイルとして格納する | バックエンド `json` を登録する |
| [`storage-sqlite`](storage-sqlite/README.md) | 単位を単一 SQLite データベース内の JSON ドキュメントとして格納する | バックエンド `sqlite` を登録する |
| [`storage-domain`](storage-domain/README.md) | ルーティング済みバックエンド上にスキーマ検証済みで変更通知付きの型付き KV ドメインを提供する | `ctx.storageDomain` |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [Storage サブシステム](../../docs/subsystems/storage.md) — 正式な契約: バックエンド契約、ドメイン宣言、変更イベント、生成 API。
- [ドメイン KV ストレージ Agent Note](../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.md) — ファミリー、ワークスペース消費者、延期されたセッションバックエンド移行の背後にある設計。
- [Workspace サブシステム](../../docs/subsystems/workspace.md) — データ形式の最初の消費者。

-----

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

設計 Agent Note は提案中のままファミリーが出荷されている。その対象外テーブルは移行フェーズの将来作業リストである（`log` ファセット、セッションバックエンドの再利用、クロスプロセス変更プッシュ）。着地したら決定を implemented ノートに昇格させること。

</details>
