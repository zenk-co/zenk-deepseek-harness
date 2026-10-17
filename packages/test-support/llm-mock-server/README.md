---
description: "プロバイダーキーなしで LLM アダプターとリカバリーポリシーをテストするための、スクリプト可能な Messages 互換フォールトサーバー。テスト作成者とデモ向け。"
kind: "package-library"
---

# @deepseek-ai/dsh-llm-mock-server

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは、テストとデモに、ネイティブ SDK コンシューマー向けの名前付きイベントを備えた、スクリプト可能な Messages 互換 HTTP/SSE エンドポイントを提供します。これにより、プロバイダーキーなしでモデルプロバイダーの失敗と成功を試せます。受理された各 `/v1/messages` リクエストは、次にスクリプトされた動作を消費します。これにはリセット、ストール、不正なチャンク、レート制限、サーバーエラー、完了、ツール呼び出しが含まれます。テスト作成者は `pnpm run mock:llm` で実行するか、`startMockLlmServer` を呼び出します。後者はアサーション用にキャプチャしたリクエストを返します。シード付きの `random` 動作は、再現可能な混合障害のストレス実行を支えます。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と保留作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

このパッケージは、テストやデモがプロバイダーなしでプロバイダープロトコルを話せるようにします。サーバーを起動し、試したいワイヤ動作をスクリプトし、実際の LLM アダプターをそのベース URL に向けます。

### 単体で実行する

このリポジトリからソースエントリーを実行します:

```sh
pnpm run mock:llm \
  --port 8000 \
  --api-key mock-key \
  --sequence partial_disconnect,success \
  --partial-text "discard this half"
```

出荷済みの DeepSeek アダプターをこのサーバーに向けます。アダプターはサーバーの `/v1` ルート配下の `/messages` にリクエストを送ります:

```sh
DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1 \
DEEPSEEK_API_KEY=mock-key \
pnpm dsh --profile headless "test provider recovery"
```

リポジトリのスクリプトは JSONL を stdout に書き出します: `ready` レコードが `/v1` ベース URL と乱数シードを運び、続いてスクリプトされた動作と選択された具体的な動作の両方を名指すリクエスト/結果レコードが続きます。このパッケージはインストール可能なバイナリーを公開しません。

### 動作のスクリプト

`--sequence` はカンマ区切りの FIFO です。使い果たすと構造化された HTTP 500 を返します。`--repeat-last` は最後のエントリを明示的に再利用します。

| 動作 | ワイヤ上の結果 |
|---|---|
| `connection_reset` | HTTP ヘッダーの前にソケットを破棄する |
| `stream_disconnect` | SSE ヘッダーを送った後、最初のイベントの前にリセットする |
| `partial_disconnect` | テキストデルタを送った後、ソケットをリセットする |
| `stall` | SSE ヘッダーを送り、クライアント/サーバーのキャンセルまでアイドルを保つ |
| `empty` | 有効な内容なしの stop と `[DONE]` を送る |
| `empty_body` / `stream_eof` / `partial_eof` | 必須の `[DONE]` 境界なしでクリーンに終了する |
| `malformed_json` / `malformed_event` | 無効な SSE JSON または無効なプロバイダーチャンクの形を送る |
| `rate_limit` / `server_error` / `service_unavailable` | リトライ向けの 429/500/503 JSON エラーを返す |
| `auth_error` / `invalid_request` / `context_overflow` / `quota_exceeded` | 終端または別途回復されるプロバイダーエラーを返す |
| `success` / `slow_success` / `reasoning_success` | 完全なテキスト応答をストリームする。任意で遅延または推論を先行させる |
| `tool_call_success` / `max_tokens` | ツール呼び出しまたは `length` 終了で完了する |
| `wrong_content_type` | 有効な SSE ボディを `application/json` の下で送る |
| `random` | 重み付きシード乱数から具体的なリクエスト動作を選択する |

`connection_refused` は CLI 専用で、最初のエントリでなければなりません。呼び出し元が指定した非ゼロポートのバインドを遅延させるため、`--listen-delay-ms` の間のリクエストは実際の TCP 拒否を受け取ります。残りのエントリはリスナー開始後に始まります。

### ランダムモード

終わりのない混合実行には、繰り返し `random` エントリを使います:

```sh
pnpm run mock:llm \
  --port 8000 \
  --sequence random \
  --repeat-last \
  --seed 42 \
  --random-weights 'success=60,slow_success=10,connection_reset=5,stream_disconnect=5,partial_disconnect=10,empty=5,server_error=5'
```

`--seed` を省略すると 1 つ生成され、`ready` レコードに出力されます。`--random-weights` は非負の相対 `behavior=weight` エントリを受理し、少なくとも 1 つの正の重みを持つ具体的な動作を要求します。エクスポートされるデフォルトは成功寄りのストレスプロファイルで、リセット、切断、部分出力、空完了、ストール、429/5xx、クリーンな切り捨て、不正 JSON を含みます。これはテストの負荷であり、本番でのインシデント頻度の推定値ではありません。`connection_refused` は除外されます。バインド済みのリクエストハンドラーは真の拒否を生成できないからです。ランダム重みに `stall` が含まれる場合、テスト対象のクライアントに短いストリームアイドルタイムアウトを設定して、シナリオが速やかに終了するようにしてください。

### タイミングと内容のコントロール

CLI は `--success-text`、`--partial-text`、`--reasoning-text`、`--chunk-size`、`--chunk-delay-ms`、`--disconnect-delay-ms`、`--retry-after-ms`、`--request-id`、`--tool-name`、`--tool-arguments` を公開します。ミリ秒の遅延は Node のタイマー範囲内の境界付き整数です。`retryAfterMs` も正でなければなりません。ライブラリは同じキャメルケースのオプションを受理します。任意の厳密な `apiKey` は `x-api-key: <token>` を検証します。省略時は任意のトークンを受理します。

### 起こり得る問題

- **スクリプトが尽きる** — 使い果たすと構造化された HTTP 500 を返します。実行にさらにリクエストが必要な場合は `--repeat-last` を設定するか、シーケンスを長くしてください。
- **正の重みを持つ具体的な動作がないランダム重みは拒否される** — すべてのエントリが既存の動作を名指し、少なくとも 1 つが正の重みを持たなければなりません。
- **無効なリクエストはスクリプトを消費しない** — 誤ったメソッド、パス、API キー、不正な JSON は通常の 4xx 応答を受けるため、設定を誤ったクライアントはシーケンスを進めずにリトライを浪費し得ます。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

このセクションではサーバーの設計を説明します。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱います。

### 設計

サーバーは 1 つのルールの上に構築されています: 受理された各 Messages リクエストは、到着順の FIFO カーソルからちょうど 1 つの動作を消費し、サーバーはリトライもハーネスポリシーの解釈も行いません。検証はカーソルが進む前に行われます。パスが `/v1/messages` で終わる `POST` で、設定済みの場合は有効な API キーを持ち、解析可能な JSON ボディを持つものだけがスクリプトを消費し、それ以外はすべて通常の 4xx を受け取ります。`random` エントリはリクエスト時に設定された重みに対するシード付き PRNG で解決されるため、実行は出力されたシードから再現できます。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | `startMockLlmServer`: リスナー、動作テーブル、シード乱数、テレメトリー、キャプチャしたリクエストレコード |
| [`src/cli.ts`](src/cli.ts) | `--sequence` とタイミング/内容オプションの解析、JSONL stdout テレメトリー |
| [`src/bin.ts`](src/bin.ts) | `pnpm run mock:llm` のソースエントリー |

### ワイヤフロー

リクエストがハンドラーに入り、検証され、動作を選択します。具体的なスクリプトエントリは直接実行され、`random` は 1 つを抽選し、尽きたスクリプトは `script_exhausted` を構造化 500 として報告します。次に `runBehavior` がワイヤ結果 — ソケット破棄、SSE ストリーム、JSON エラー、または完了 — を実行し、すべてのリクエストと結果がテストアサーション用に返されたハンドルへ到着順で記録されます。`close()` はリクエストの受理を停止し、ストールした接続を強制終了します。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときに、これらのページを読んでください。フォールトサーバーから、それが試すアダプター契約と、記録された成功トランスクリプト向けのキー不要の代替へと進みます。

- [LLM パッケージ](../../llm/llm/README.md) — このサーバーが試すプロバイダーストリーム契約とリトライポリシー。
- [llm-replay](../llm-replay/README.md) — 障害を起こす代わりに記録された成功トランスクリプトを再生する、キー不要の対応物。
- [テストポリシー](../../../docs/testing.md) — このサーバーが支えるカバレッジ階層とリカバリーテスト。
- [test-support グループマップ](../README.md) — 姉妹ハーネスとサポートパッケージ。

-----

<a id="model-experience"></a>
## モデル体験

なし。このテストサーバーは実際のモデルを起動せずにプロバイダーのワイヤ動作を代替します。

#### KV キャッシュ効果

なし。リクエストはローカルで終端し、プロバイダーのキャッシュには決して到達しません。

## 既知の制限と保留作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、サーバーが特別な注意を必要とする場合を定義します。これらは現在のパッケージ制約であり、タスクバックログではありません。

- **ランダム重みがモデル化するのはテストの負荷であり、本番の発生率ではない** — 環境固有の分布を求める呼び出し元は、計測済みの重みを提供し、出力されたシードを記録しなければなりません。
- **リクエストスクリプトは到着順** — 同時実行の呼び出し元が 1 つのカーソルを共有するため、セッションごとに決定的な障害割り当てを行うには別々のサーバーインスタンスが必要です。
- **真の接続拒否はリスナーのライフサイクル段階** — CLI の遅延がクライアントの試行と重ならなければなりません。リクエストレベルのランダム選択は受理済みの接続をリセットすることしかできません。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
