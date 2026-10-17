---
description: "SDK ファミリーのパッケージマップ: JSON-RPC プロトコルと、プロセス外 SDK が使う TypeScript クライアントおよびサーバー。"
kind: "package-group"
---

# sdk/ — 別プロセスから Harness ランタイムを駆動する

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

SDK ファミリーにより、別プロセスは改行区切り JSON-RPC 経由で完全な DeepSeek Harness ランタイムを駆動できる。そのプロトコルパッケージは公開メッセージを定義し、TypeScript クライアントは名前付きプロファイルと順序付きパッチで `dsh` を起動し、サーバーは stdio 経由で SDK リクエストを受け付ける。クライアントはセッションを開き、プロンプトを送り、セッションイベント、エージェント状態変化、サブエージェント完了を観測できる。TypeScript クライアントと [Python SDK](../../python/README.md) は同じプロトコルを使い、これらのパッケージは開発者プロジェクトの作成や別アプリケーションの定義を行わない。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

スタックの各部位で何ができるかは各パッケージ README が記述する。

| パッケージ | 役割 |
|---|---|
| [`protocol/`](protocol/README.md) | ワイヤープロトコル: 改行区切り JSON-RPC トランスポートと、名前付きリクエスト・結果・通知型 |
| [`client/`](client/README.md) | ランタイムサブプロセスを起動し、高水準 API とプロトコル水準 API でエージェントターンを駆動する TypeScript クライアント |
| [`server/`](server/README.md) | stdio 経由でプロセス外 SDK クライアントにサーブする `jsonrpc` プラグイン |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

クライアント契約の兄弟実装である Python SDK、実行可能なアプリケーション、グループ境界の背後にある決定記録から読み進めること。

- [Python SDK](../../python/README.md) — 同じプロトコルを話し、バンドル済みランタイムを出荷する Python 側の対応物。
- [SDK アプリケーションバンドル](../bundle/sdk-app/README.md) — JSON-RPC サーバーを起動する `dsh --profile sdk` アプリケーション。
- [アーキテクチャ](../../docs/architecture.md) — パッケージ済み Python クライアントが同じ名前付きプロファイルを起動する理由。
- [SDK プロジェクトツールチェーンの削除](../../.agents/notes/archived/simplification/2026-08-11-remove-sdk-project-toolchain.md) — このグループが開発者プロジェクトの作成、設定、ビルドを行わない理由。
- [SDK サブエージェントプロバイダー](../subagent/subagent-dsh-sdk/README.md) — TypeScript クライアントのハーネス内消費者。

<a id="dev-note"></a>
## 開発ノート

なし。
