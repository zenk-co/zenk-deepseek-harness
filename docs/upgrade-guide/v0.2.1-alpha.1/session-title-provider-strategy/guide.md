---
kind: upgrade-guide
description: "Session-title providers register directly, own their strategy settings, and share only prepared execution."
---

# セッションタイトルプロバイダーを移行する

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

`@deepseek-ai/dsh-session-title-llm` は `registerSessionTitleLlmProvider`、`generateSessionTitleWithLlm`、`SessionTitleLlmMessageSelector` をエクスポートしなくなった。`SessionTitleLlmConfig` は実行制御 (`maxInputBytes`、`maxOutputTokens`、`timeoutMs`、および任意の `provider`/`model` ペア) のみ保持するようになり、`targetWords` と `targetCjkCharacters` は各プロバイダー独自の `Config` に移動した。各プロバイダーはシステム指示、メッセージ整形、タイトル解析、リーズニング選択、出力解釈を所有し、`ctx.sessionTitle.register()` に直接登録し、`executeSessionTitleLlm(ctx, config, request, providerId, { system, input, messageSeqs, selectReasoningEffort })` を呼び出す。その関数は組み立て済みコンテンツブロック、終端の finish、および使用したモデルルートを返す。`SessionTitleProviderRequest` は任意の `currentTitle` スナップショットを得た。

## 移行手順

1. `registerSessionTitleLlmProvider(...)` 呼び出しを直接の `ctx.sessionTitle.register({ id, automatic, generate })` に置き換える。同じ `id` と頻度を保つ。
2. `generate(request)` 内で独自のシステムプロンプトとユーザー入力を構築し、`selectReasoningEffort` 関数を渡してから、`{ system, input, messageSeqs, selectReasoningEffort }` で `executeSessionTitleLlm` を呼び出す。
3. `tool-calls` または `max-tokens` の終端 finish とツール呼び出しブロックを拒否し、テキストブロックからタイトルを導出する。
4. 戦略が承認済みプロバイダータイトルを保持すべき場合は `request.currentTitle` を読む。タイトルが存在しない前は不在である。
5. タイトルを生成し、保存結果と正確な `session/title-llm-request` 記録を確認する。
