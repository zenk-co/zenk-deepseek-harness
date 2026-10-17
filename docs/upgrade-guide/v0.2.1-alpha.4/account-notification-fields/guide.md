---
kind: upgrade-guide
description: "AccountBonusNotification は未検証の任意メタデータを公開し、有効期限なしの通知を許可する。"
---

# アカウント通知コンシューマーを更新する

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

公開 `AccountBonusNotification`（`DeepSeekAccount.getUnnotifiedBonuses()` と `account/getUnnotifiedBonuses` が返す）は `campaign`、`amount`、`currency`、`grantedAt` を `JsonValue` 型の任意・未検証メタデータとして保持する。通知は `orderId`、`message`、`expiresAt` を保持し、任意の `title` を追加する。空の `expiresAt` は通知が期限切れにならないことを意味する。`orderId` は UUID を要求せず任意の文字列を受け付ける。

## 移行

1. 任意メタデータ値は使う前に絞り込む。その存在と形式はもはや保証されない。`message` を表示し、`title` がない場合はクライアントのデフォルトタイトルを使う。
2. タイムスタンプをパースする前に空の `expiresAt` を期限なしとして扱う。通知を確認応答する際は `orderId` を変更しない。
3. プロバイダーフィクスチャを現在のフィールドに更新する。非 UUID ID で有効期限が空の通知が表示され、確認応答できることを確かめる。
