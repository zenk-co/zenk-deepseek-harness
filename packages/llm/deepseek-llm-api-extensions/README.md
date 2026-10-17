---
description: "Official DeepSeek request-extension registry for provider plugins contributing lifecycle-owned top-level API fields."
kind: "package-reference"
---

# @deepseek-ai/dsh-deepseek-llm-api-extensions

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

公式 DeepSeek LLM API リクエストに対する、加算的なトップレベルフィールド用のプロバイダー固有レジストリー。`DeepSeekLlmApiExtensionRegistry` は `ctx.deepseekLlmApiExtensions` を登録する。提供側プラグインは宣言マージされたフィールドを 1 つずつ確保し、`dsh-llm-deepseek` はベースリクエストの直列化後に現在の提供物を準備する。ベースアダプターを変更せずに検証済みプロバイダー固有フィールドを追加しなければならない場合に使用する。

## 目次

- [サービス](#service)
- [モデル体験](#model-experience)
- [既知の制限と後回しにした作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="service"></a>
## サービス

- `register(field, provider)` は呼び出しファイバー用に 1 つのフィールドを予約する。重複または不正な名前は同期的に失敗する。登録の破棄により後のプロバイダー用に解放される。
- `prepare(request)` は登録済みプロバイダーのスナップショットを取得し、並行に準備し、返された JSON 値を複製して凍結し、`{ fields, accept }` を返す。準備で例外を投げたプロバイダーは除外され、他のフィールドは返される。その最初の失敗のみがログに記録される。リクエストの取り消しは拒否され、一方がシグナルを無視してもプロバイダーの待機を停止する。
- `accept()` は取り込んだすべての 2xx 後コールバックを 1 回ずつ実行する。並行呼び出しは同じ確定に参加し、失敗を報告する前にすべてのコールバックが確定し、複数の失敗は 1 つの `AggregateError` になる。

各プロバイダーは、正確に直列化された Messages ボディ、リクエスト `AbortSignal`、任意の `sessionId` と補助呼び出し用 `purpose` を受け取る。取り消し後は速やかに自身の作業を停止しなければならず、そのリクエストにフィールドが適用されない場合は `undefined` を返す。準備済み操作は、HTTP 受理前に HMR が登録を除去しても取り込んだプロバイダーを保持する。

レジストリーは追加とライフサイクルを所有し、フィールドの意味は所有しない。`dsh_session_log` は `@deepseek-ai/dsh-session-log-deepseek` が、`dsh_plugin_packages` は `@deepseek-ai/dsh-plugin-package-inventory-deepseek` が所有する。プロバイダー中立の LLM シームと `llm-pi-ai` はこのレジストリーを使用しない。

<a id="model-experience"></a>
## モデル体験

`@deepseek-ai/dsh-llm-deepseek` を通じて間接的に関与する。登録済みフィールドはモデルの `messages`、システムプロンプト、ツールスキーマの外側で送信される。

#### KV キャッシュへの影響

なし。レジストリーフィールドはモデルから隠されたプロバイダーメタデータであり、直列化されたモデル入力プレフィックスを変更しない。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

- **公式 DeepSeek リクエストのみ** — このレジストリーには意図的にプロバイダー中立のルーティングや pi-ai アダプター統合がない。
- **フィールド順序の契約なし** — JSON オブジェクトメンバーの順序は登録準備に従うが、受信者はフィールドを名前で参照する。


<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
