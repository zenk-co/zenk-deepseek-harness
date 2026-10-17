---
kind: upgrade-guide
description: "DeepSeekAccount.watch は、明示的に要求されない限り Platform アイデンティティの変更を含まない。"
---

# アカウントアイデンティティ変更を明示的に購読する

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

公開 `DeepSeekAccount.watch(signal)` メソッドは以前、プロファイル読み取りがキャッシュされた Platform ユーザー ID を最初に提供または変更したときにスナップショットを発行していた。現在はデフォルトでアカウント状態の変更のみを発行する。このストリームを使用して `getPlatformSession()` をリフレッシュするプラグインは、アイデンティティ変更をオプトインしなければならない。資格情報の置き換えとサインイン状態の変更は、依然としてすべてのサブスクライバーに通知される。

## 移行

1. Platform セッションをリフレッシュする、またはそのユーザー ID を同期するプラグインで `deepseekAccount.watch(signal)` の呼び出しを見つける。
2. それらの呼び出しを `deepseekAccount.watch(signal, true)` に変更する。サインインと資格情報の状態のみを必要とするアカウント UI のサブスクリプションは変更しない。
3. ユーザー ID が最初に現れるか変更された準備完了の `getProfile()` 結果が、サブスクリプションを起床させ、`getPlatformSession()` を再読み取りさせることを確認する。同じ ID での繰り返しの読み取りは、別のアイデンティティ通知を発行しない。
