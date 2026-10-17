---
description: "モードの選択、exporter の設定、マシンから出るものの追跡を行うデプロイメント向けの OpenTelemetry セッションテレメトリバックエンド。"
kind: "package-reference"
---

# @deepseek-ai/dsh-session-telemetry-otel

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このアダプターは `otel` をインジェクトし、[共有 OTel プラグイン](../../telemetry/otel/README.md)が独立した Session ログチャネルを作成する。認可、レダクション、アイデンティティ、スコープバージョン、構成、シャットダウンの期限はここが所有したままである。

`dsh-session-telemetry-otel` は、すべてのユーザーとプロバイダー（`deepseek-official` を含む）について、新しい明示的なフィードバックの後にのみ OTel JS SDK を通じてセッションレコードをエクスポートする。`FEEDBACK_ONLY` はそのフィードバックを通じて正規プレフィックスを解放し、コンテキストも含める。それ以降のレコードは次の明示的なフィードバックを待つ。`DISABLED` はトランスポートを一切構築しない。スケジュールされたバッチ処理は、別のユーザー操作やモデル呼び出しなしに認可済みアップロードを完了できる。レダクションルールはデプロイメントが所有する。

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

デプロイメントが OpenTelemetry ログを通じてセッションレコードをエクスポートすべきときにこのプラグインをマウントする。モードを選び、exporter にエンドポイントを与え、シームにレダクションルールをマウントするかどうかを決める。

### モード

| `mode` | 挙動 |
|---|---|
| `FEEDBACK_ONLY` | デフォルト。テキストフィードバック、評価の作成/編集、ノートの編集、撤回が、その正規フィードバックイベントを通じて未処理のプレフィックスを解放する。それ以降のレコードは待つ |
| `DISABLED` | コーディネーター、プロバイダー、プロセッサー、exporter のいずれも構築されない。テレメトリレコードはプロセスから出ない。ライブフィードバックはローカルで警告し、コールドな変更は沈黙したままである |

プログラムによる TypeScript 構成ではエクスポートされた `SessionTelemetryMode` 列挙型を使う。生の文字列リテラルは代入できない。`FULL` はエイリアスではなく拒否される。[`sharing` プロパティ](../session-telemetry/README.md#the-sharing-disclosure)は配信受領証ではなく `feedback-only` または `disabled` を報告する。`/feedback` の確認は記録のみを確認する。

### 最小構成

アップロードするモードには exporter の URL が必要である。プロセッサー設定は独立した Session ログキューを制御し、ルーティングヘッダーは明示的な `exporter.headers` の値である。

```yaml
- id: sessionTelemetry-otel
  name: '@deepseek-ai/dsh-session-telemetry-otel'
  config:
    mode: FEEDBACK_ONLY       # optional; defaults to FEEDBACK_ONLY
    shutdownTimeoutMillis: 3000 # optional; defaults to 3000
    exporter:                # explicit SDK transport settings
      url: https://collector.example.com/v1/logs
      headers:
        authorization: !!js `Bearer ${process.env.OTLP_TOKEN}`
    processor: {}            # optional; byte/count batching and per-request watchdog
```

| フィールド | デフォルト | 意味 |
|---|---|---|
| `mode` | `FEEDBACK_ONLY` | 共有ポリシー: `FEEDBACK_ONLY` または `DISABLED` |
| `exporter.url` | アップロードするモードでは必須 | 完全な OTLP logs エンドポイント。`http(s)` としてパースできなければならない |
| `exporter`, `processor` | — | SDK トランスポートとバイト/件数バッチ処理。ヘッダー/TLS のアイデンティティは環境から継承されない。Agent ファクトリーは keepAlive を含む自身が返す agent 設定を所有する |
| `shutdownTimeoutMillis` | `3,000` | キューに入ったすべての HTTP リクエストの外側の期限。残りのキュー済み送信は期限切れで停止する |
| `maxRequestBytes` | `4,000,000` | gzip 前の完全な OTLP JSON リクエストの最大バイト数。下げることだけができる |

`ctx.sessionTelemetry.emit()` の直接呼び出しはどのモードでも no-op であり、フィードバック認可をバイパスできない。継承された親のフィードバックは子のエクスポートを認可しない: 子には自身の新しいフィードバックが必要である。その認可済みプレフィックスには継承されたコンテキストが含まれる。

モデルリクエスト、リクエストヘッダー、Session の作成や採用、復元、プラグインのマウントや HMR はキャプチャを認可しない。保存されたフィードバックだけでは何もトリガーされない。スケジュールされたフラッシュとシャットダウンは以前に認可されたバッチを完了できるが、新しいレコードをキャプチャすることは決してない。

### マシンから出るもの

各 Session イベントは 1 つの `eventName: "session-log"` レコードになる。`attributes.sessionId` はコレクターの Session アイデンティティであり、`attributes.content` はレダクション済みの `event.data` を持つ完全なイベントエンベロープをエンコードする。JSON の値が保持され、元の JSONL バイト列やキー順序は保持されない。レガシーの `session.id`、`event.seq`、`event.type` メタデータは既存のコンシューマーのために残る。Resource はアプリケーションと匿名ユーザーのアイデンティティを持ち、scope はバックエンドパッケージの名前とバージョンを持つ。ベースプロファイルは `https://dsh-otel-collector.deepseeksvc.com/v1/logs` を使い、`DSH_TELEMETRY_OTLP_URL` がそれを上書きする。チャネルヘッダーは暗黙に追加されない。

共有 OTel チャネルは各レコードを SDK OTLP JSON シリアライザーで 1 回計測し（その resource/scope エンベロープを含む）、それらの保守的なサイズを使ってリクエストを貪欲に詰め込む。単一の過大なイベントは切り詰めなしで 1 つの拒否診断を生成する。Session ログは 1 つのリクエスト内でプロダクト分析と混ざることは決してない。キャプチャの引き渡しとシャットダウンはコレクターの確認応答ではない。

### 失敗とシャットダウン

無効なバイト制限、非正のキュー/タイマー値、`maxExportBatchSize > maxQueueSize`、無効なエンドポイント、無効なシャットダウン期限はロード時に失敗する。プロセッサーのデフォルトは、キュー 2,048 レコード、リクエストあたり 512 レコード、スケジューリング遅延 1,000 ms、リクエストウォッチドッグ 30,000 ms である。バイト制限は件数バッチを複数の逐次 HTTP リクエストに分割することがある。各リクエストは、次のリクエストが始まる前に自身のコールバック後の SDK エクスポートキューのクリーンアップを待つ。`exportTimeoutMillis` はリクエストごとに警告するが、未決着のトランスポートスロットを解放することは決してない。ネットワークのタイムアウト/リトライは SDK トランスポートが所有する。シャットダウンは `shutdownTimeoutMillis` までこれらのリクエストをドレインする。期限切れは残りのキューを破棄し、以降の送信を防ぐが、アクティブなリクエストは決着することがある。したがって大きなプレフィックスは CLI 終了時に部分的に未送信のまま残りうる。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションではバックエンドの構成を説明する。観察可能な挙動は[このパッケージを使う](#use-this-package)で網羅されている。

### 設計概念

バックエンドはフィードバック認可、アイデンティティ、シャットダウンを所有する。共有 OTel サービスはチャネル作成、バイト/件数スケジューリング、レコード構築、JSON トランスポート、圧縮、リトライを所有する。Resource アイデンティティは `APP_IDENTITY` からの `service.name`/`service.version` と匿名の `user.id` を持ち、scope はこのパッケージの名前とバージョンを保持する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: モード解決、fail-closed 検証、SDK パイプラインの配線、コーディネーター構成、シャットダウン期限 |

### キャプチャの配線

バックエンドは新しい自身のフィードバックイベントまたはコミット済みのコールドスナップショットを通じて、オンデマンドで履歴をキャプチャする。そのプライベートレポーターはウォッチドッグが発火した後もキューに入った HTTP リクエストを直列化する。外側のシャットダウン期限が残りのキューを停止する。追加のフラッシュエントリーポイントは公開しない。

### フィールドマッピング

各キャプチャレコードは別々にコピーされたイベントエンベロープとレダクション済みペイロードを `SessionLogReporter` に供給する。シリアライズはオプションのサーフェスメタデータとイベントのシーケンス/時刻を保持する。フィードバックはフィードバックペイロードだけでなく、未処理のプレフィックス全体を認可する。

</details>

-----

<a id="further-exploration"></a>
## さらなる探索

バックエンドの契約では足りないときにこれらのページを読むこと。それが実装するシームから、サブシステムリファレンスとそれが報告するアイデンティティへと進む。

- [Session telemetry シーム](../session-telemetry/README.md) — キャプチャ契約、レコード語彙、レダクションウォーターフォール。
- [Session telemetry サブシステム](../../../docs/subsystems/session-telemetry.md) — ケイパビリティ分割と型宣言。
- [匿名ユーザーアイデンティティ](../../identity/anonymous-user-id/README.md) — OTel Resource の `user.id` として報告される id。
- [生成された構成カタログ](../../../docs/config-catalog.md#deepseek-aidsh-session-telemetry-otel) — 受け付けられるすべての設定フィールドとそのソース宣言。

-----

<a id="model-experience"></a>
## モデル体験

なし。バックエンドはシームのレコードを OTel SDK パイプラインへ転送し、モデル向けのものを何も登録しない。

#### KV キャッシュ効果

なし。このパッケージはプロバイダーリクエストを組み立てず、送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、SDK の挙動が支配する範囲とエクスポート保証が終わる範囲を定義する。これらは現在のパッケージ制約である。

- **上流の experimental ツリー** — `@opentelemetry/sdk-logs` は上流の experimental ツリーから公開されている。SDK API の変動は[共有 OTel プラグイン](../../telemetry/otel/README.md)に着地し、シーム契約は動かない。
- **ライブコレクターの挙動は SDK exporter に属する** — 認証、TLS、スロットリング、その他の実際の OTLP デプロイメント挙動は、パッケージ所有の互換レイヤーではなく上流 SDK に従う。
- **ベストエフォートの引き渡し** — 再起動後の新しいコールドスナップショットと新しいフィードバック提出はプレフィックスを重複させることがある。レシーバーは Session id、フォーマットバージョン、イベント seq で重複排除する。耐久性のあるアウトボックス、配信ウォーターマーク、自動リトライの約束、コレクター受理の保証はない。OTel とオプトインの DeepSeek API 経路は重複しうる。撤回は削除イベントをエクスポートするのであり、リモートからの消去ではない。

- **バックエンドの可用性** — このプラグインが無効またはアンロードされている間に提出されたフィードバックはローカルに記録されるが、復帰時に自動再生されない。キャプチャにはサブスクライバーが提出を観測するまでマウントされたままでいることが必要であり、保留中のコールド書き込み中にアンロードするとそのフラッシュ後の通知を取り逃すことがある。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
