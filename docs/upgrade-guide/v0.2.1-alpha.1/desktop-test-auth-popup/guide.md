---
kind: upgrade-guide
description: "Desktop test builds require local opt-in before showing any Feishu update-policy authentication dialogs."
---

# テスト更新ポリシー認証ダイアログをローカルで有効にする

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

テストビルドは以前、未認証起動後または手動の更新ポリシー確認後に Feishu ログインを提供した。すべてのテスト認証ダイアログは既定で無効になった。手動確認と必須更新リフレッシュを含む。テストゲートウェイクッキーは再起動を超えて残らない。ログイン無効時、認証を要求するゲートウェイは新しい必須更新判断を提供できない。設定を有効化し、再起動してサインインすると取得できる。認証失敗は同一プロセス内で既知の必須ブロックを保持する。製品ポリシーリクエストと製品アカウントログインは不変である。

## 移行手順

1. 更新済みアプリケーションを一度起動し、欠落していれば `app.getPath('userData')/desktop/settings.json` を作成する。既存ファイルは保持され、欠落フィールドは既定で `false` になる。プラットフォームパスとエラー回復は [ローカルデスクトップ設定](../../../../apps/desktop/README.md#local-desktop-settings) を参照。
2. Feishu ログインを許可するには、そのファイルで `updates.allowTestAuthPopupWindow` を `true` に設定し、Desktop を完全に終了して再起動する。未認証テストポリシー応答がログインを提供できるようになる。ログインダイアログが不要なら既定を変更しない。
3. ダイアログを再び無効にするには、フィールドを `false` に設定して再起動する。起動と手動確認は Feishu 認証ダイアログを表示してはならない。更新は引き続きポリシーを問い合わせ、認証失敗は既知の必須ブロックを消去しない。
