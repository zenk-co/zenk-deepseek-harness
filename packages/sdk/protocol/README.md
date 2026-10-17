---
description: "クライアントとサーバーの実装者向けの SDK wire プロトコル: 改行区切り JSON-RPC トランスポートと、Harness ランタイムとその SDK クライアントの間で話される名前付きのリクエスト、結果、通知の型。"
kind: "package-library"
---

# @deepseek-ai/dsh-sdk-protocol

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-sdk-protocol` は、DeepSeek Harness ランタイムとその SDK クライアントが改行区切りのバイトストリーム上で JSON-RPC 2.0 メッセージを交換できるようにする: 1 つのトランスポートクラスと、wire 両端が話す名前付きのリクエスト、結果、通知の型である。提供側は [`dsh-sdk-jsonrpc-server`](../server/README.md) プラグインであり、クライアントは TypeScript の [`dsh-sdk-client`](../client/README.md) と [Python SDK](../../../python/README.md) で、後者はこれらをインポートせずに同じ形を写し取る。wire 端を実装またはデバッグするときにこのパッケージを使う: フレーミング規則、メソッド名、ペイロード型、エラーセマンティクスはすべてここに住む。これは純粋なライブラリである — プラグインも設定も登録もない。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらなる探索](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

SDK の wire 端 — 提供プラグイン、クライアントライブラリ、または SDK プロトコルを話すカスタムツール — を構築またはデバッグするときにこのパッケージを使う。呼び出し元が所有するバイトストリーム上の JSON-RPC 2.0 用の 1 つのトランスポートと、すべての SDK メソッドと通知の型付きの形を提供する。

### フレーミングとトランスポート

自分が所有するバイトストリーム上で、`\n` で終わる 1 行につき 1 つの JSON-RPC 2.0 メッセージを流す。`id` と `method` の両方を持つフレームはリクエストであり、`id` だけなら応答、`method` だけなら通知である。不正な行は無視される。ハンドラーが登録されていないリクエストは `-32601` と応答し、ハンドラー失敗は `-32603` と応答し、エラー応答は保留中のリクエストを `JsonRpcResponseError` で拒否し、これが wire の `code` とオプションの `data` を保持する。`start()` はストリームリスナーを取り付け、`close()` はそれらを取り外して保留中のリクエストを拒否するが、ストリームを破棄しない。

### SDK メソッド

wire 両端は 1 つのメソッドセットを共有する: 7 つの client-to-server リクエストと 4 つの server-to-client 通知である。

| 方向 | メソッド | ペイロード型 |
|---|---|---|
| client→server | `initialize` | `InitializeParams` → `InitializeResult` |
| client→server | `session/prompt` | `SessionPromptParams` → `SessionPromptResult`（耐久エンキューの受領） |
| client→server | `session/resume` | `SessionResumeParams` → `{}` |
| client→server | `session/wait` | `SessionWaitParams` → `{}` |
| client→server | `session/working-directory/get` | `SessionWorkingDirectoryParams` → `SessionWorkingDirectoryResult` |
| client→server | `session/working-directory/set` | `SessionWorkingDirectorySetParams` → `SessionWorkingDirectoryResult` |
| client→server | `shutdown` | パラメーターなし → `{}` |
| server→client | `session.event` | `SessionEventNotification`（ランタイム内のすべてのセッション、フィルタリングなし） |
| server→client | `session.status` | `SessionStatusNotification`（エージェント全体の `running`/`idle` 遷移） |
| server→client | `subagent.started` | `SubagentStartedNotification` |
| server→client | `subagent.finished` | `SubagentFinishedNotification`（プロセス内実行のみ） |

`HarnessSdkRequestMap` と `HarnessSdkNotificationMap` はこれらの形をメソッド名でインデックスする。パッケージルートはトランスポートと一緒にそれらをエクスポートする。

`session/wait` は既存の SDK 所有セッションの `{ sessionId }` を受け付け、ルートがアイドルのままで進行中の管理子孫作業が完了した後に `{}` を返す。入力をパークしたアイドル子孫は、この待機をブロックせずに常駐したままである。未知の id と、新しいコミット済み終端を持たないライブ Agent 失敗は拒否される。待機中にコミットされた通知は同じトランスポート上でその応答に先行する。生の `session.status` 遷移はエージェント全体の意味を保つ。

`session/resume` は空でない永続化済み `{ sessionId }` を受け付け、その正確なセッションを復元した後に `{}` を返す。初期化と元の永続化ストアを必要とし、新しい入力を送らず、置き換えを作成することなく、欠落、読めない、互換性のない、または使用中のセッションを拒否する。履歴イベントは保存されたログに残り、通知は新しくコミットされたイベントを報告する。

### ペイロードのセマンティクス

`SessionPromptResult.messageId` はキューに入ったユーザーメッセージを識別し、後のアシスタントメッセージ、ターン終了、プロンプト結果を識別しない。`SdkPromptContentBlock` は通常の耐久コンテンツと `SdkEncodedImageBlock { type: "image", data, mimeType }` を受け付ける。サーバーはエンコードされた画像をエンキュー前に耐久参照へ変換する。`InitializeParams.reasoningEffort` は選択されたプロバイダー/モデルルートのためのオプションの空でないアダプター所有識別子であり、省略はそのモデルのデフォルトを保つ。`InitializeParams.maxTokens` は、SDK が作成したエージェントとそのプロセス内子孫について各 conversation-model 出力を上限するオプションの正の安全な整数であり、省略は選択されたアダプターの正確なモデルのデフォルトを適用させる。サーバーは初期化中に正確なルートを解決し、そのハンドシェイクが成功するまで `session/prompt` を拒否するので、アダプターの欠落、利用不可能なモデル、非サポートの effort がコンストラクターのデフォルトにフォールバックすることはできない。`SubagentFinishedNotification.lastAssistantMessage` は子の最後の空でないアシスタントメッセージ、またはそのようなメッセージが存在しない場合は累積されたアシスタントテキストを運び、子がどちらも生まなかった場合はこのフィールドは存在しない。`serverInfo.name` は wire 安定の `deepseek-harness-sdk-runtime` のままである。通知ペイロードは `SessionEvent`（`dsh-session`）、`ContentBlock`（`dsh-llm`）、`SubagentStopReason`（`dsh-subagent`）に依存するので、セッション語彙は wire 契約の一部である。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションでは wire ライブラリの背後の設計を説明する。観察可能な挙動は[このパッケージを使う](#use-this-package)で網羅されている。

### 設計概念

このパッケージは 1 つの分離の上に成り立つ: wire 両端が共有する単一の改行区切りトランスポートクラスと、プロトコルメソッドをインデックスする名前付き型である。パッケージルートが唯一のインポートサーフェスであり、ソースモジュールはディープインポートとしてエクスポートされない。これはプラグイン、設定、登録を持たない純粋なライブラリであり、提供プラグインとクライアントがその周りのすべての挙動を所有する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/transport.ts`](src/transport.ts) | `JsonRpcLineTransport`: 行フレーミング、リクエスト/応答/通知のディスパッチ、エラーマッピング、保留リクエストの帳簿付け |
| [`src/types.ts`](src/types.ts) | メソッドでインデックスされる名前付きのリクエスト/結果と通知ペイロード型 |
| [`src/index.ts`](src/index.ts) | コンシューマーインターフェース: トランスポートと名前付き wire 型 |

### フレームのディスパッチ

受信した行は 1 つずつパースされる: `id` と `method` を持つフレームはリクエストハンドラーを通じて応答され（または `-32601`）、`id` だけのフレームは一致する保留リクエストを解決し（エラーフレームはそれを `JsonRpcResponseError` で拒否する）、`method` だけのフレームは通知ハンドラーに渡される。`start()` は入力リスナーを取り付け、`close()` はそれらを取り外し、ストリームを破棄せずにすべての保留リクエストを失敗させる。

</details>

-----

<a id="further-exploration"></a>
## さらなる探索

wire 契約では足りないときにこれらのページを読むこと。提供プラグインから、クライアントと実行可能なアプリケーションへと進む。

- [JSON-RPC 提供プラグイン](../server/README.md) — このプロトコルを stdio 上で提供するランタイムプラグイン。
- [TypeScript SDK クライアント](../client/README.md) — このプロトコルを駆動するクライアント。
- [Python SDK](../../../python/README.md) — 同じ形を写し取る Python の対になるもの。
- [SDK アプリケーションバンドル](../../bundle/sdk-app/README.md) — サーバーをブートする `dsh --profile sdk` アプリケーション。

-----

<a id="model-experience"></a>
## モデル体験

なし。これはクライアント向けの wire ライブラリであり、提供エントリーの背後のランタイムプラグインがすべてのモデル向け挙動を所有する。

#### KV キャッシュ効果

なし。このパッケージはプロバイダーリクエストを組み立てず、送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、プロトコルがカバーしない、または約束しないものを定義する。これらは現在のパッケージ制約であり、他の wire フォーマットとの比較やタスクバックログではない。

- **プロトコルバージョンネゴシエーションなし** — ハンドシェイクは `serverInfo.version`（`0.0.1`、クライアントによる検証なし）のみを運ぶ。プレリリースの姿勢であり、互換性の約束はない。
- **キャンセルやセッションクローズのメソッドなし** — クライアントはランタイムプロセスを閉じることでターンを放棄する。[JSON-RPC 提供プラグイン](../server/README.md)を参照。
- **server→client リクエストは死んだケイパビリティ** — トランスポートはそれらをサポートするが、サーバーは決して送らない。Python SDK のレスポンダーサーフェスは将来の承認フローのために存在する。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発メモはメンテナー向けの作業コンテキストであり、明示的に非権威である — 出荷済みの挙動と制限は上記のセクションとコードにある。このプロトコルの形は Python SDK によって写し取られており（インポートはされない）、ここでメソッド、ペイロード、または wire 安定の `serverInfo.name` を変更するには、同じ変更で Python の対になるものと TypeScript クライアントを更新する必要がある。その他の未解決の設計上の問いは記録されていない。

</details>
