---
description: "Incremental canonical session-log upload for deployments enabling official DeepSeek request metadata."
kind: "package-reference"
---

# @deepseek-ai/dsh-session-log-deepseek

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

公式 DeepSeek LLM API 要求向けの増分正規セッションログアップロードです。この function プラグインは `ctx.sessions` と `ctx.deepseekLlmApiExtensions` を注入し、`dsh_session_log` 要求フィールドと、受諾ウォーターマークを導出する durable `session-log-deepseek/delivery-accepted` イベントを所有します。公式 API にセッションログ接尾辞を送信してよい場合のみ有効化します。

## 目次

- [設定](#configuration)
- [要求フィールド](#request-field)
- [受諾と再試行](#acceptance-and-retry)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="configuration"></a>
## 設定

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `false` | Send the `dsh_session_log` contribution. Changes apply to the next request; `true` enables Session-log upload. |
| `maxBytes` | 8 MiB | Largest serialized `dsh_session_log` field, in UTF-8 bytes, that one request carries. |

出荷プロファイルはプラグインをマウントするが、既定設定では要求フィールドを登録せず、受諾ウォーターマークも追記しない。`enabled: true` は寄与を開始する。Web スイッチは有効プロファイル経由でバンドル既定を上書きできる。ホームパッチとコマンドラインオーバーレイは優先を保持し、競合する形式書込みを拒否する。

Web **Settings → General → Upload Session Log when using the official model API** スイッチはホスト設定経由で `enabled` を永続化します。飛行中要求は準備済みペイロードを保持します。再有効化は無効中に記録されたイベントも含め未受諾接尾辞を再開します。OpenTelemetry フィードバックアップロードは別設定です。

<a id="request-field"></a>
## 要求フィールド

ライブ `sessionId` を運ぶ要求では、プラグインはその正確なセッション形式世代の最大受諾ウォーターマークを畳み込み、`Session.events` をスナップショットし、ウォーターマーク後に `maxBytes` に収まる最長連続範囲を送ります。プロセス局所畳み込みは各イベントを一度だけ走査し、以降の追記を増分消費します。再起動と HMR は durable ログから再構築します。バージョン 1 フィールドは `sessionFormatVersion`、生セッションヘッダー (`seedLength` はシード済みセッションのみ存在)、数値 `afterSeq` と `throughSeq`、正規イベントごとに生数値エンベロープフィールドへ変換した完全イベントを含みます。フォークセッションは継承親ウォーターマークを無視します。記録セッション ID と形式世代の両方が要求元と一致しなければなりません。サーフェスイベントは `surfaceOp` を要求し、置換には数値 `startSeq` と `endSeq` を付けます。system、user、tool イベントのみ `sourceEventSeqs` を運べます。アシスタントプロバイダーメタデータは埋込ストリームに留まり、ログ限定イベントはいずれのメタデータフィールドも運びません。

`maxBytes` はヘッダーと数値エンベロープフィールドを含めた完全直列化フィールドを UTF-8 バイトで制限します。制限超過の滞留は連続する受諾要求またぎに排出され、各回は prior `throughSeq` の後から続けます。最初の保留イベント単独で制限を超える場合、要求は `dsh_session_log` を省略し、プラグインはブロックイベントごとに警告を 1 件記録し、`maxBytes` が許すまでウォーターマークはそのイベント手前に留まります。ランタイムが直列化自体できないほど巨大なイベントも同様に扱われ、どの `maxBytes` 値も許容しません。

<a id="acceptance-and-retry"></a>
## 受諾と再試行

DeepSeek アダプターは HTTP 2xx 後に、SSE 本体消費前に、準備済み寄与の `accept()` を呼びます。受諾はアップロード済み `throughSeq` と `sessionFormatVersion` で `session-log-deepseek/delivery-accepted` を追記します。形式フィールドを省く記録は v0 を表します。次の要求はそのイベントを新規接尾辞の一部としてアップロードします。転送失敗、非 2xx 失敗、直列化失敗後に DeepSeek アダプターが拡張フィールドなしに送る要求は受諾記録を追記しないため、以降の要求は不確定範囲を再送します。同時配送は順不同で受諾されることがあります。一致 `throughSeq` の最大値畳み込みはカーソル後退を防ぎます。

サーバー受諾後、ウォーターマークの永続化前にクラッシュすると、再起動後に受諾済み範囲を再送することがあります。これは at-least-once 失敗方向です。不確定性は重複を生み、列飛ばしは生みません。通常セッションチェックポイントポリシーは次の意味チェックポイントでウォーターマークを永続化します。このプラグインは独立 I/O しません。

ライブセッションなしの直接要求は `dsh_session_log` を省略します。通常エージェント、コンパクション、セッションタイトル呼び出しはライブセッション ID を運びます。

<a id="model-experience"></a>
## モデル体験

### セッションログメタデータ

#### モデルが見るもの

なし。`dsh_session_log` は DeepSeek 要求のモデル入力フィールドの兄弟であり、`messages`、システムプロンプト、ツールスキーマには挿入されません。

#### トークン効果

モデル入力トークンゼロです。フィールドは `maxBytes` 制限内で HTTP 要求バイトのみ増やします。

#### KV キャッシュ効果

なし。モデル可視要求プレフィックスは不変のままです。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- **Crash-window duplicates** — 受諾ウォーターマーク永続化前の 2xx 後のプロセス喪失は、再開時に保守的再送を引き起こします。
- **No live Session means no field** — 直接または stale セッション呼び出しにはスナップショットすべき正規ログがありません。明示不在意味は deferred のままです。
- **An oversized event stalls upload** — フィールド単独で `maxBytes` を超えるイベントは送信されず、制限引上げまで以降イベントは後ろで待ちます。直列化自体できないイベントはブロックしたままです。
- **Provider rejection fails the request** — このフィールドが原因でプロバイダーが要求を拒否すると、ログ切詰めではなくモデル要求が失敗し、カーソルは不変のままです。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
