---
description: "workflow グループマップ: サブエージェントにファンアウトするモデル作成のオーケストレーションスクリプト。グループを行き来するユーザーとメンテナー向け。"
kind: "package-group"
---

# packages/workflow

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

workflow グループでは、エージェントがサブエージェントに作業を委譲して最終値を返すオーケストレーションスクリプトを実行できる。`workflow` ツールはスクリプト化されたファンアウトに対応する。スクリプトは呼び出し元 Session のファイルポリシーの下で共有 PTC Node プロセスランタイムを使う。ワークフローフックと子のライフサイクルは引き続きワークフローエンジンが所有する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| Package | Role | ctx key |
|---|---|---|
| [`workflow`](workflow/README.md) | サブエージェントにファンアウトするモデル作成のオーケストレーションスクリプトを実行する | `ctx.workflowEngine` |
| [`workflow-ptc`](workflow-ptc/README.md) | 共有のサンドボックス化 PTC Node プロセスランタイム経由でワークフロースクリプトを実行する | `ctx.workflowEngine` に登録 |
| [`tool-workflow`](tool-workflow/README.md) | スクリプト化されたマルチエージェントオーケストレーション向け `workflow` ツールをモデルに提供する | `ctx.tools` に登録 |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [ワークフローサブシステム](../../docs/subsystems/workflow.md) — シームの型、開始要求、および `workflow/*` イベント。
- [生成ツールカタログ](../../docs/tool-catalog.md#deepseek-aidsh-tool-workflow) — モデルが受け取る `workflow` ツールスキーマ。
- [生成ツールカタログ](../../docs/tool-catalog.md#deepseek-aidsh-tool-ralph) — モデルが受け取る `ralph` ツールスキーマ。
- [生成設定カタログ](../../docs/config-catalog.md#deepseek-aidsh-workflow-ptc) — 受け付け可能なすべてのエンジン設定フィールド。
- [歴史的な動的ワークフロー Agent Note](../../.agents/notes/archived/feature/2026-07-05-dynamic-workflows.md) — シーム設計とその決定。
- [Harness レベルのゴールベース実行リファレンス](../experimental/tool-ralph/README.md) — 固定のフレッシュエージェントループ設計と延期された作業。

-----

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
