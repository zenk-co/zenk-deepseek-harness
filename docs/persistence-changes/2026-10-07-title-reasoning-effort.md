---
description: "永続化型の移行とその互換性の承認を記録する。"
kind: persistence-change
---

# 2026-10-07-title-reasoning-effort

日本語 | [English](2026-10-07-title-reasoning-effort.en.md) | [中文](2026-10-07-title-reasoning-effort.zh.md)

## 概要

補助セッションタイトルリクエストに対して選択された具体的なリーズニングエフォートを記録する。

## 目次

- [宣言](#declaration)
- [互換性](#compatibility)
- [検証](#verification)
- [開発者ノート](#dev-note)

<a id="declaration"></a>
## 宣言

```yaml persistence-change
schemaVersion: 1
id: 2026-10-07-title-reasoning-effort
baseline: false
changes:
  - root: "event:session/title-llm-request"
    previous: "2026-10-05-working-directory-attribution"
    after: "b33545b3244861bcbf73b407d24b53402710f5acacab7ae939537e5504a68dc6"
    decision: same-version
```

<a id="compatibility"></a>
## 互換性

新しい reasoningEffort フィールドは任意である。既存の V4 レコードは引き続き有効で、記録されたエフォートが元々存在しないまま保たれる。準備済みタイトルリクエストは、ルートが選択可能なリーズニングを公開する場合に解決済みエフォートを書き込む。Session 形式のバンプは不要である。

<a id="verification"></a>
## 検証

LLM、adapter、title-provider、replay の focused テストが合格した: 50 ファイル、1960 テスト。session-title-after-turn SDK スナップショットは、デフォルトが high のルートから選択された記録済み low エフォートで合格した。

<a id="dev-note"></a>
## 開発者ノート

None.
