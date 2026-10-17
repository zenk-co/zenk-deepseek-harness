---
description: "schedule パッケージグループ: Host 所有のスケジュール済みリマインダーとタスク管理。"
kind: "package-group"
---

# schedule/ — Host 所有のリマインダー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

会話向けにワンショット、固定間隔、日次、週次、cron のリマインダーを作成し、Host 再起動を超えて保持する。有効・無効のタスクを元の Session を開かずに点検する。リマインダーの作成と配送には Schedule を使い、セッション横断の点検と確認済み削除には自動化タスクページを使う。期限到来のリマインダーはメール、SMS、プッシュ通知ではなく、元の会話に通常のフォローアップメッセージとして届く。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

永続的なリマインダー管理にはこのパッケージを選ぶこと。

| Package | Role |
|---|---|
| [`schedule/`](schedule/README.md) | Host 所有のリマインダー永続化、スケジューリング、点検、明示的な削除 |
| [`tool-schedule/`](tool-schedule/README.md) | ホスト `ctx.schedule` サービス上のプリセットスコープ `schedule_create`、`schedule_list`、`schedule_update`、`schedule_delete` 各ツール |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [スケジュールサブシステム](../../docs/subsystems/schedule.md) — タスク記録、最新受領、時刻規定、配送契約。
- [生成ツールカタログ](../../docs/tool-catalog.md#deepseek-aidsh-tool-schedule) — マウントプリセットが寄与する `schedule_create`/`schedule_list`/`schedule_update`/`schedule_delete` スキーマ。
- [スケジュールユーザーガイド](../../docs/user/guide/schedule.md) — リマインダーの作成と有効・無効タスクの点検。
- [Web タスクページとリマインダーカタログ](../client/ui-schedule/README.md) — タスクのブラウザー点検と確認済み削除。

-----

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
