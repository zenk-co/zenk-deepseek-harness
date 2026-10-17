# プロダクトテレメトリ

日本語 | [English](product-telemetry.en.md) | [中文](product-telemetry.zh.md)

[プロダクトテレメトリプラグイン](../../packages/host/product-telemetry-otel/README.md)は明示的に選択された分析イベントを OTLP/HTTP 越しに送る。その `productTelemetry` サービスは送信のみを所有し、イベントがいつ起きるか、どの欄が承認されるかは製品利用者が所有する。出力側はセッションデータも識別子も自動収集しない。[Desktop 分析利用者](../../packages/client/product-analytics/README.md)は対話とライブ圧縮イベントを選び、静的環境キャッシュと利用可能ログイン識別子を加え、Desktop 起動時収集スイッチに従う。通常 Web クライアントは製品イベントを収集しない。

`ProductTelemetryRecord` はイベント名・文字列本体・Unix ミリ秒時刻印を要求する。属性は素量文字列・数値・真偽値とそれらの値の 1 水準オブジェクト（`ProductTelemetryScalar`）を受け付ける。任意重大度は OTel 重大度番号を使い、既定 INFO である。観測時刻は記録の待ち行列入れ時に割り当てられる。

待ち行列入れは同期的であり、配送を承認しない。SDK が束ねと再試行を所有し、ローカル診断が輸出失敗を報告する。設定・停止・損失上限はパッケージ README を見ること。

## 記録型

```ts type-equiv
/** Scalar values accepted in product attributes. */
type ProductTelemetryScalar = OTelEventScalar
```

```ts type-equiv
/** Caller-selected ordinary analytics record. */
type ProductTelemetryRecord = OTelEventRecord
```

由来: [`packages/host/product-telemetry-otel/src/index.ts`](../../packages/host/product-telemetry-otel/src/index.ts)

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成（`pnpm run verify-cordis-catalog` が doc-sync で鮮度を検証。`pnpm run gen-cordis-catalog` で再生成）。言語側はロケール固有の対訳文書パスのみが異なる。署名塊は `ts cordis-catalog` fence を使い、元のソース JSDoc を保つ。配送方式は[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承 `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxproductanalytics--productanalytics"></a>

### `ctx.productAnalytics` — `ProductAnalytics`

認証済みイベント受付。無効インスタンスは識別子を検査も新規イベント受付もしない。

```ts cordis-catalog
/**
 * Read the collection policy.
 * @returns whether this Host currently accepts Desktop analytics.
 */
@Remote enabled(): boolean

/**
 * Stream the effective policy initially and after live configuration edits.
 * @param signal - subscriber lifetime.
 * @returns current policy values until cancellation or service disposal.
 */
@Remote({ mode: 'stream' }) async *watchPolicy(signal: AbortSignal): AsyncIterable<boolean>

/**
 * Submit selected Desktop fields with cached static environment and fresh identity.
 * The first intake waits for bounded environment queries; concurrent intakes share them.
 * Missing identity is omitted; failed environment fields carry fixed reasons.
 * @param event - typed product event without message contents or credentials.
 * @returns after local submission; no delivery or warehouse acknowledgement.
 */
@Remote async report(event: ProductEvent): Promise<void>
```

由来: [`packages/client/product-analytics/src/index.ts`](../../packages/client/product-analytics/src/index.ts)

<a id="ctxproducttelemetry--producttelemetry"></a>

### `ctx.productTelemetry` — `ProductTelemetry`

ホスト分析送信側。マウントだけでは何も送らず、所有ファイバーはアンロード時にそれを排出する。

```ts cordis-catalog
/**
 * Enqueue one selected product event without waiting for network delivery.
 * Queue admission and shutdown completion are not collector or warehouse acknowledgements.
 * @param record - caller-owned event containing only approved analytics fields.
 */
emit(record: ProductTelemetryRecord): void
```

由来: [`packages/host/product-telemetry-otel/src/index.ts`](../../packages/host/product-telemetry-otel/src/index.ts)
<!-- END GENERATED cordis-surface -->
