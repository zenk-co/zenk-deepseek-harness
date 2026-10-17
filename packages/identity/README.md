---
description: "The identity package group: anonymous, per-harness-home correlation ids shared by telemetry, feedback, and DeepSeek provider requests."
kind: "package-group"
---

# identity/ — 共有アイデンティティ

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

identity グループはハーネスホームごとに一つの匿名 id を提供し、インストールのテレメトリー、フィードバック、DeepSeek リクエストが記録に付与する。これにより一つのホームから出るものはすべてユーザーを識別せずに同一インストール由来として認識できる。構成することは何もない: id はそれらの機能のいずれかが最初に動いたときに自動的に現れ、ファイルが削除されるまで安定して残る。グループは一つのパッケージを持ち、このページはそれを対応付け、詳細はパッケージ README が所有する。

## 目次

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

<a id="packages"></a>
## パッケージ

| Package | Role |
|---|---|
| [`anonymous-user-id`](anonymous-user-id/README.md) | 各ハーネスホームに一つの匿名 id を与え、テレメトリー、フィードバック、DeepSeek リクエストが記録に付与する。これにより一つのインストールからの記録はユーザーを識別せずに認識できる |

<a id="related-documentation"></a>
## 関連ドキュメント

- [セッションテレメトリーサブシステム](../../docs/subsystems/session-telemetry.md) — エクスポートに id を運ぶテレメトリー機能。
- [dsh-llm-deepseek](../llm/llm-deepseek/README.md) — リクエストに id を運ぶ DeepSeek プロバイダー。
- [dsh-command-feedback](../feedback/command-feedback/README.md) — 承認通知で匿名インストールに名前で言及するフィードバックコマンド。

<a id="dev-note"></a>
## 開発ノート

None.
