---
kind: upgrade-guide
description: "Agent Teams は保留メッセージの上限を撤廃し、履歴キュー済みメールの配送を停止する。"
---

# Agent Teams のメッセージは宛先インボックスを使う

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

実験的な Agent Teams プラグインは、新規メッセージを Team の別メールボックスに保持せず、宛先 Agent のインボックスへ直接送信するようになる。`send_message` は `{ "sent": true }` のみを返し、メッセージ ID も `accepted` や `queued` のステータスも公開しない。受け付けはモデルの処理や同期的なストレージ書き込みを保証しない。送信失敗は再試行用に保持されず、明示的な再送の重複排除も行われない。

`maxPendingMessagesPerMember` 設定キーは削除される。履歴の `team/message/queued` および `team/message/delivered` 記録は引き続き読み取れるが、アップグレード前に配送されなかったキュー済みメッセージは以後配送されない。名簿とタスクの状態は耐久性を保つ。

## 移行

1. アップグレード前に、保留中の Team メッセージを送り終え、宛先が受信したことを確認する。アップグレード後は、必要な未配送メッセージを明示的に再送する。重複を避けるため、まず宛先の履歴を確認する。履歴 Session 記録は編集しない。
2. `cordis.yml` やオーバーレイ内の `@deepseek-ai/dsh-experimental-agent-team` プラグイン設定から `maxPendingMessagesPerMember` を削除する。Team キューの上限の代替はない。`maxMessageBytes` は引き続き送信者成形済みの完全な各メッセージを制限する。
3. `send_message` 結果の利用側を、メッセージ ID や配送ステータスではなく `sent` を読むように更新し、送信エラーを明示的に処理する。成功を宛先作業の完了とみなさない。`ctx.agentTeams.sendMessage()` サービスは引き続き `messageId` を返す。
4. Team 有効なプロファイルを開始し、他のメンバーへのメッセージ送信でツールが `{ "sent": true }` を返し、宛先が受信することを確認する。配送セマンティクスについては[パッケージ参照](../../../../packages/experimental/agent-team/README.md#use-this-package)を参照すること。
