---
description: "永続化型の移行とその互換性の承認を記録する。"
kind: persistence-change
---

# 2026-09-18-schedule-optional-title

日本語 | [English](2026-09-18-schedule-optional-title.en.md) | [中文](2026-09-18-schedule-optional-title.zh.md)

## 概要

永続化された schedule/change 作成レコードの after、at、every バリアントで、保存されるタイトルを任意にする。

## 目次

- [宣言](#declaration)
- [互換性](#compatibility)
- [検証](#verification)
- [開発者ノート](#dev-note)

<a id="declaration"></a>
## 宣言

```yaml persistence-change
schemaVersion: 1
id: 2026-09-18-schedule-optional-title
baseline: false
changes:
  - root: "event:schedule/change"
    previous: "2026-09-11-initial"
    after: "a0a2e5c42e1c929445ecd1cd70f49be6b66441894ec72c08e8ae332821d4a3cb"
    decision: same-version
```

<a id="compatibility"></a>
## 互換性

タイトルが存在する前に書かれたバージョン 1 の Session イベントには title メンバーがなく、そのようなログは拒否される代わりにタイトルなしでデコード・フォールドされる。名前を必要とするリーダーは、存在しないタイトルを無名タスクとして扱う。ホストタスクレコードでは依然としてこのメンバーが必須である: ストレージデコーダーはタイトルのない保存タスクを拒否し、作成、更新、schedule ツールでも引き続き必須である。

<a id="verification"></a>
## 検証

pnpm exec vitest run packages/schedule/schedule/tests: 18 ファイル、789 テストが合格した。

<a id="dev-note"></a>
## 開発者ノート

None.
