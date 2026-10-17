---
description: "目標グループマップ: セッションごとに1つの durable 完了目標。モデルツール、人向けコマンド、自動継続を備える。グループ内を移動するユーザーとメンテナー向け。"
kind: "package-group"
---

# packages/goal

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

目標グループにより、1つのエージェントセッションは再起動、再開、フォークをまたいで durable な完了目標を追跡できる。エージェントは目標を作成・更新でき、人はモデルターンを消費せず `/goal` で直接確認または操作できる。オプショナルな継続パッケージは進行中の作業を連続ラウンドで動かし続けられる。各セッションが持つ現在の目標は1つのみであり、その目標は作業のスケジューリングではなく完了状態を記録する。そのため自動継続は別途有効化しなければならない。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`goal`](goal/README.md) | セッションごとに1つの durable 目標: 作成、編集、一時停止、再開、完了、ブロック、クリア | `ctx.goals` |
| [`tool-goal`](tool-goal/README.md) | モデルツール `get_goal`、`create_goal`、`update_goal` | `ctx.tools` に登録する |
| [`command-goal`](command-goal/README.md) | UI コマンド面の人向け `/goal` コマンド | `ctx.commands` に登録する |
| [`goal-round-driver`](goal-round-driver/README.md) | 自動継続: 有効な目標を連続ラウンドに変える | サービスキーなし |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [Goal サブシステム](../../docs/subsystems/goal.md) — 目標型、durable な `goal/change` イベント、生成サービス API。
- [生成ツールカタログ](../../docs/tool-catalog.md#deepseek-aidsh-tool-goal) — モデルが受け取る3つの目標ツールスキーマ。
- [生成設定カタログ](../../docs/config-catalog.md#deepseek-aidsh-goal) — 目標サービスの受け入れ設定フィールドのすべて。
- [歴史的な Goal ドメイン Agent Note](../../.agents/notes/archived/feature/2026-07-19-persisted-same-session-goal-domain.md) — ドメイン設計とその決定。

-----

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
