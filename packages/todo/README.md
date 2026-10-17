---
description: "The todo group map: the model-facing todo_write tool over the session log, for users and maintainers navigating the group."
kind: "package-group"
---

# packages/todo

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

todo グループはエージェントにセッションレベルのタスクリストを計画用に与える: タスクを追加し、進行中に印を付け、完了にチェックし、同じリストがターンや再開したセッションをまたいで持続する。`todo_write` ツールを提供する一つの製品パッケージであり、リストはそれを作成したエージェントセッションに属し、各更新はリスト全体を置き換える。対話型ホストはリストから現在の計画を表示するが、グループ自体は UI を出荷しない。

## 目次

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| Package | Role | ctx key |
|---|---|---|
| [`tool-todo`](tool-todo/README.md) | エージェントにセッションタスクリストを維持させる: タスクを計画し、状態を更新し、進捗を追跡する | registers on `ctx.tools` |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [Todo サブシステム](../../docs/subsystems/todo.md) — `todo/write` イベントペイロード、所有権規則、`TodoItem`。
- [生成ツールカタログ](../../docs/tool-catalog.md#deepseek-aidsh-tool-todo) — モデルが受け取る `todo_write` スキーマ。
- [生成設定カタログ](../../docs/config-catalog.md#deepseek-aidsh-tool-todo) — 受け付けるすべての設定フィールド。
- [todo_write ツール Agent Note](../../.agents/notes/archived/feature/2026-06-29-todo-write-tool.md) — 本来の設計と代替案。

-----

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
