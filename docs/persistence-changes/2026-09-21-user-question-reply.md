---
description: "永続化型遷移とその互換性承認を記録する。"
kind: persistence-change
---

# 2026-09-21-user-question-reply

日本語 | [English](2026-09-21-user-question-reply.en.md) | [中文](2026-09-21-user-question-reply.zh.md)

## 概要

継続中の ask_user_question 呼び出しに対する遅い回答のための、修飾付き user-question-reply メッセージソースを追加する。

## 目次

- [宣言](#declaration)
- [互換性](#compatibility)
- [検証](#verification)
- [開発ノート](#dev-note)

<a id="declaration"></a>
## 宣言

```yaml persistence-change
schemaVersion: 1
id: 2026-09-21-user-question-reply
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-09-16-session-format-v4"
    after: "6178f1edcb23f361f2a6cb2c859b1c2187220d5695ece4a3400e0d92845a7178"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-09-16-session-format-v4"
    after: "186159f5f6f67a0b8cd095b8fe55bef42d4f25ca1a1c248f859867af2ece0467"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-09-16-session-format-v4"
    after: "ae84c5e493f94acc63cfb70389073ba616ed7aa4fadde048bd64d49bb46"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-09-16-session-format-v4"
    after: "b83ed1b1cfffbd7bd5cca06ea72be57beb68b39e5a96660ceb42a9e21aa411"
    decision: same-version
```

<a id="compatibility"></a>
## 互換性

既存ログはそのようなソースを含まず、有効なままである。新ソースは通常のユーザーメッセージ上の修飾付き帰属であり、dsh-user-questions を持たないリーダーはメッセージを保持し、その内容から履歴を導出する。userQuestions 投影のみがこのソースを読んで対象質問を閉じ、その回答を記録する。回答 RPC は唯一の生成元であり、結果 answered を書き込む。クライアントパネルを閉じても返信は永続化されない。イベント型やセッションヘッダーの変更はない。

<a id="verification"></a>
## 検証

pnpm exec vitest run packages/interaction/user-questions/tests packages/interaction/tool-ask-user/tests: 81テスト通過。対象を絞った投影、返信、ビュー、プロセスグループスイートは70テスト通過。pnpm run typecheck 通過。pnpm run doc-sync は42ゲートすべて通過（永続化履歴と翻訳ペアリングを含む）。

<a id="dev-note"></a>
## 開発ノート

なし。
