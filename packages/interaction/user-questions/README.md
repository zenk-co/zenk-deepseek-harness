---
description: "Waterfall-based question and answer service for tools, permission plugins, local answerers, and Agent-scoped Web interactions."
kind: "package-reference"
---

# @deepseek-ai/dsh-user-questions

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

ツールや権限フローがユーザーからの構造化回答を必要とする場合に `ctx.userQuestions` を使います。`ask()` はその回答を待ちます。`askTimed()` は質問がセッションで回答可能なまま、エージェントを解放して独立作業を続けさせることがあります。

## 目次

- [質問する](#service-userquestionservice-ctx-key-userquestions)
- [役割](#role)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="service-userquestionservice-ctx-key-userquestions"></a>
## 質問する

回答なしに作業継続できない場合に `ask()` を呼びます。フォアグラウンド待機後にエージェントが独立作業を続けられる場合に `askTimed()` を呼びます。回答 UI は `attachWait` 経由でその待機を確保し、ホスト計算の残存期間を受け取り、自時計で数えます。確保なしの場合、最後のクライアント切断後も含め、サービスは元の期限でモデルを解放します。`userQuestions` プロジェクションはツール呼び出し、その結果、最終返信から durable 質問を導出します。クライアント確保は永続化されません。

単一選択質問では `custom` が選択肢を上書きし、`selected` は空です。複数選択質問では `custom` が `selected` のラベルを補完できます。UI は飛ばした項目を `{ id, selected: [] }` として保持し、バッチ内の他回答を保持しつつ既存回答形状を保てます。

質問は提示 `intent` を運べます。それが既知種別の決定であることを宣言し、タグを認識する UI はそのように提示できます。1 つのタグは `plan-review` であり、その `detail` は審査対象プラン、`approve` は肯定選択肢を名指します。intent は提示のみ変えます。それを尊重する UI は汎用 UI が送るのと同じ選択肢ラベルで回答し、タグを知らない UI は汎用選択肢一覧を描画します。`ask()` は型が運べない 2 表明を `BAD_INTENT` で拒否します。その質問独自の選択肢のいずれも指名しない `approve`、および `detail` のない質問の intent です。`dsh-plan-mode` は `exit_plan_mode` 審査質問に設定します。

要求がエージェントを運ぶ場合、`ask()` はライブ `AgentRegistry` 経由でその正確な同一性を認証し、ランタイムルートのみ許容します。ライブ子は人間対話を開けません。エージェントなしのプログラム要求はスコープなしローカルウォーターフォールリスナーに利用可能のまま残り、受諾者なしでは `NO_PROVIDER` で失敗します。

ツール呼び出しが開いている間、唯一の回答経路はその要求です。再接続ブラウザーは再び受け取り、なお完了できます。呼び出しが pending を返した後、またはそれを所有したプロセス終了後、質問は `continued` です。`answer` Remote メソッドは返信を `user-question-reply` メッセージとしてエージェントに導きます。質問を放棄する Remote メソッドはありません。パネルを片付けたクライアントは何も送らないため、回答到着まで呼び出しは回答可能なままです。閉じたセッションへの回答は先にそのルートエージェントを再開します。いずれの経路も完了ツール呼び出しに結果を捏造しません。

<a id="role"></a>
## 役割

`UserQuestionService` は各 `TimedQuestionWait`、そのキャンセル可能クライアント確保、無人タイマーを所有します。確保済み待機は数えとフォーカス/編集決定をクライアントに委ねます。無人タイムアウトはフォアグラウンド要求シグナルのみ中止して pending を返し、ターンを中止しません。`userQuestions` プロジェクションは既存セッションイベントから開、継続、確定の時間付き呼び出しを記録します。ネイティブ呼び出しは記録済みツールスキーマを使い、PTC 副呼び出しは結果 pending 時に入ります。`answer` RPC は質問ごとに 1 回答を検証し、継続呼び出しごとに 1 キュー返信を受け付けます。2 つ目の返信は `REPLY_QUEUED` で失敗します。破棄返信は質問を回答可能のまま残します。遅延バッチは元のツール結果がタイムアウトを含むためプロジェクションに残ります。

<a id="model-experience"></a>
## モデル体験

間接的に、`dsh-tool-ask-user` 経由です。成功回答をコンパクト JSON として保持するか、次のいずれかの失敗です。`Error: ask_user_question was aborted before the user answered`、`Error: ask_user_question requires at least one question`、`Error: human interaction requires the exact live calling agent when an agent is supplied`、`Error: human interaction is unavailable while the calling agent is owned by another live agent; include the unresolved question or decision in the child agent's final result`、`Error: no user-questions answerer accepted the request`、または `Error: <message>`。人間待ちはトークンを加えません。

#### KV キャッシュ効果

直接無効化なし。指名コンシューマーが要求プレフィックス変更を所有します。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- **Agent-scoped Web answering** — Remote イベントは要求がライブエージェントスコープを運ぶ場合のみ出荷 Web 回答器をルーティングします。エージェントなし呼び出し側はスコープなしローカルウォーターフォールリスナーが必要です。
- **The vocabulary is the question-form shape only** — 選択肢と任意カスタムテキストのみです。より豊かな対話形状 (ファイルピッカー、差分プレビュー確認) にシーム語彙はまだありません。
- **Draft text is not part of Host question persistence** — 質問はプロジェクション経由でクライアントまたぎ再起動耐性があります。未完入力は 1 ブラウザープロファイルにローカル残留します。


<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**ランタイム不変条件:** `userQuestions` プロジェクションは記録済みツール呼び出し、PTC 発送、許容ユーザーメッセージから導出されます。別の質問状態は保存されません。継続質問は新しいユーザーターンを作成できますが、完了ツール呼び出しは再開できません。
