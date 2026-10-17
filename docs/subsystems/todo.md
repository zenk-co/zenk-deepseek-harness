# Todo

日本語 | [English](todo.en.md) | [中文](todo.zh.md)

[`@deepseek-ai/dsh-tool-todo`](../../packages/todo/tool-todo/README.md) が所有する永続的な todo 語彙。モデル向けツールは一つのエージェントセッションのリスト全体を置き換える。パッケージはイベント宣言とリプレイ投影も所有する。ツール動作と設定は [パッケージ README](../../packages/todo/tool-todo/README.md) にある。

ソース: [`packages/todo/tool-todo/src/types.ts`](../../packages/todo/tool-todo/src/types.ts)

## `TodoItem` — 一つのリスト項目

```ts type-equiv
/**
 * One entry in an agent's todo list — the unit of the `todo/write`
 * whole-list snapshot declared by this package.
 *
 * Deliberately minimal: a human-readable `content` line and a three-state
 * `status`. No id, priority, or `activeForm` — the list is replaced wholesale
 * on every write (last-write-wins), so entries need no stable identity. The
 * three statuses describe the complete portable lifecycle needed by model and
 * UI consumers.
 */
interface TodoItem {
  /** What this task is — a short imperative line shown in the UI. */
  content: string
  /** Lifecycle state. `in_progress` marks a task being worked now; parallel work may mark several. */
  status: 'pending' | 'in_progress' | 'completed'
}
```

## 永続イベント

パッケージは `todo/write: { todos: TodoItem[] }` を `SessionEventMap` に宣言マージする。イベントはログのみであり、完全な置換リストを運ぶ。生成された [永続化カタログ](../persistence-catalog.md#todowrite--log-only) はその宣言箇所を記録する。
