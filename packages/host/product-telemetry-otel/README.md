---
description: "Configure explicit product usage events, OTLP/HTTP routing, batching, and shutdown limits."
kind: "package-reference"
---

# @deepseek-ai/dsh-host-product-telemetry-otel

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

選択した製品利用イベントを OTLP/HTTP コレクターに送ります。イベントは名前、文字列要約、発生時刻、スカラーまたは 1 階層オブジェクト属性を運びます。プラグインのマウントは自動収集しません。アプリケーションは各イベントを明示提出します。配送はベストエフォートであり、ウェアハウス取込みを確認しません。

## 目次

- [このパッケージの利用](#use-this-package)
- [実装の理解](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの利用

アプリケーション同一性と共に Cordis 構成にプラグインをマウントし、必要に応じてコレクターエンドポイントを上書きします。Desktop 構成は [product analytics](../../client/product-analytics/README.md) 有効時にマウントします。通常 Web はしません。以下の単独例は `DSH_APP_VERSION` を読みます。Desktop はネイティブランチャー経由で `DSH_CLIENT_VERSION` を提供します。両者は実行リリースを名指さなければなりません。スキーマは欠落バージョンを拒否します。

```yaml
- name: '@deepseek-ai/dsh-otel'
- name: '@deepseek-ai/dsh-host-product-telemetry-otel'
  config:
    endpoint: https://dsh-otel-collector.deepseeksvc.com/v1/logs
    serviceName: deepseek-harness
    serviceVersion: !!js process.env.DSH_APP_VERSION
    compression: gzip
    scheduledDelayMillis: 30000
```

| Field | Default | Meaning |
|---|---|---|
| `endpoint` | `https://dsh-otel-collector.deepseeksvc.com/v1/logs` | Full HTTP(S) logs URL |
| `serviceName`, `serviceVersion` | required | Application identity on the OTel resource |
| `channel` | `dsh_otel_report` | Collector `x-channel` header |
| `compression` | SDK environment | `gzip` or `none`; omission honors OTel compression environment variables |
| `maxExportBatchSize`, `maxQueueSize` | `512`, `2048` | Record-count limits; batch size cannot exceed queue size |
| `scheduledDelayMillis` | `30000` | Partial-batch export interval |
| `timeoutMillis` | `15000` | Exporter HTTP and retry deadline |
| `exportTimeoutMillis` | `20000` | Processor batch export deadline |
| `shutdownTimeoutMillis` | `21000` | Drain deadline; expiry cancels pending exports and reports possible loss |

既定エンドポイントは明示提出イベントを製品コレクターにルーティングします。テストおよびカスタム配置は上書きしなければなりません。コレクターに届くのは `x-channel` と SDK プロトコルヘッダーのみです。環境 OTel ヘッダーやクライアント証明書は継承されません。

30 秒間隔は製品イベントをバッチ化します。エクスポーターはプロセッサーの 20 秒バッチ期限内に 15 秒の再試行枠を持ちます。21 秒の排出期限はプロセッサー期限が扱わない SDK `forceFlush()` 処理を覆います。期限切れは有効 HTTP 要求と再試行待機をキャンセルし、転送クリーンアップを待ってから破棄完了します。到達不能コレクターは最大 21 秒破棄を遅延させることがあります。2,048 件の満杯キューは 512 件バッチ 4 回を要し、期限前に排出できないことがあります。短い終了を求める対話構成はこれら予算を上書きします。いずれの設定も配送を保証しません。

コンシューマーは `productTelemetry` を注入し、明示選択の分析フィールドで `emit()` を呼びます。イベント名とフィールド意味はその製品および分析所有者に属します。プラグインはセッション、アカウント、認証情報、デバイス識別子を読みません。呼び出し側はプロンプト、応答、ファイル内容、認証情報、その他未承認値を除外しなければなりません。

コレクターは文字列本体と文字列、数値、真偽値、またはそれらスカラーのオブジェクトを含む属性を期待します。呼び出し側は発生時刻をミリ秒で提供します。プラグインは観測時刻を割当て、重大度既定を INFO とします。無効転送設定は有効化時に失敗します。出力失敗はローカル警告を生成し、イベント提出をネットワーク待機させません。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

アダプターは `otel` を注入し、`ctx.otel.createEventReporter()` 経由で独立の通常イベントチャネルを作成します。[共有 OTel プラグイン](../../telemetry/otel/README.md)は転送と SDK バッチ化を所有します。このアダプターは分析設定とその終了キャンセル期限を所有します。グローバル OTel プロバイダーは導入しません。

[`src/index.ts`](src/index.ts) owns configuration and submission.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Product telemetry](../../../docs/subsystems/product-telemetry.md) — consumer types and service reference.
- [Session telemetry](../../session/session-telemetry-otel/README.md) — separate feedback-authorized Session reporting.
- [Testing policy](../../../docs/testing.md) — Loader composition and network fixtures.

-----

<a id="model-experience"></a>
## モデル体験

None, as the plugin exports explicit analytics records without contributing model context.

#### KV キャッシュ効果

なし。イベント提出はモデル要求を変更しません。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

配送と収集は次のケイパビリティに限定されたままです。

- 呼び出し側はイベント選択、レンダラーからホストへの転送、許可済み同一性属性を所有します。
- キューはメモリー限定です。溢れ、ネットワーク失敗、プロセス終了でイベント喪失がありえます。durable outbox もウェアハウス確認もありません。
- SDK は符号化バイトではなく件数でバッチ化します。呼び出し側は記録をコレクターの 4 MB 制限内に保ち、受信者に適したバッチサイズを選ばなければなりません。
- 呼び出し側選択の文字列は自動編集されません。このパッケージは製品開示や同意ポリシーを決定しません。

<a id="dev-note"></a>
### 開発者ノート

None.
