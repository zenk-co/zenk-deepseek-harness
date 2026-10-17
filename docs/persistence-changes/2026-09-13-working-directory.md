---
description: "永続化型の移行とその互換性の承認を記録する。"
kind: persistence-change
---

# 2026-09-13-working-directory

日本語 | [English](2026-09-13-working-directory.en.md) | [中文](2026-09-13-working-directory.zh.md)

## 概要

セッション単位の作業ディレクトリー変更を durable に追加する。

## 目次

- [宣言](#declaration)
- [互換性](#compatibility)
- [検証](#verification)
- [開発者ノート](#dev-note)

<a id="declaration"></a>
## 宣言

```yaml persistence-change
schemaVersion: 1
id: 2026-09-13-working-directory
baseline: false
changes:
  - root: "event:working-directory/change"
    previous: null
    after: "124aa62078ca3311353b39cc3bf6c75da281338be6bbf672f8b361d828cddca3"
    decision: same-version
```

<a id="compatibility"></a>
## 互換性

既存のセッションヘッダーとイベントは引き続き有効である。新しいイベントは読み取り時に必須である: working-directory/change を知らない古いビルドはそれを含むログを拒否する。イベント語彙は構造的な Session 形式を変えずに拡張される。

<a id="verification"></a>
## 検証

working-directory と system-prompt の focused スイートが 113 テストに合格し、ファイル単位 100% カバレッジである。キーレス headless リプレイが変更、回復、ユーザーコンテキスト通知、安定したシステムプロンプトを検証する。

<a id="dev-note"></a>
## 開発者ノート

None.
