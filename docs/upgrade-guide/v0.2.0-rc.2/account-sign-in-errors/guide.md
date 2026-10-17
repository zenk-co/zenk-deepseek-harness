---
kind: upgrade-guide
description: "アカウントサインインのトランスポート失敗は network ではなく no-response を報告するようになった。"
---

# アカウントサインインエラーコード

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

`SignInErrorCode` は `no-response` を追加する。`account/getState`、`account/startSignIn`、`account/watch` が返すアカウント状態は、リクエストタイムアウトを含む Response 返却前の fetch 失敗時にこのコードを報告する。これらの失敗は以前 `network` を報告していた。HTTP 応答エラーは引き続き `network` を報告し、認可試行の期限切れは引き続き `expired` を報告する。

## 移行

1. アカウント API や `@deepseek-ai/dsh-deepseek-account` のクライアントで、`SignInAttemptView.errorCode` のバリデーターと網羅的ハンドラーに `no-response` を追加する。
2. `no-response` にはネットワークのトラブルシューティングを表示する。HTTP とアカウント詳細取得の失敗も含む `network` には汎用失敗処理を保つ。
3. `errorCode: 'no-response'` の失敗ログインがクライアントに受け入れられリトライを提供すること、HTTP エラー応答は汎用失敗処理のままであることを確認する。
