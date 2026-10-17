# OTel 報告

日本語 | [English](otel.en.md) | [中文](otel.zh.md)

[OTel プラグイン](../../packages/telemetry/otel/README.md)は、独立した通常イベント用とセッションログ用のチャネル共有ファクトリーである `ctx.otel` を登録する。トランスポートと SDK バッチ実装を所有する。業務利用者はサービスをインジェクトし、明示的なトランスポート/リソース/スコープオプションを提供し、返された各チャネルのシャットダウンを所有する。

UI フィードバックは既存 Remote API を通じてセッションフィードバックサービスに届く。フィードバック記録は、OTel チャネル経由で報告する前にセッションアダプターの正規プレフィックス取り込みと編集を承認する。通常の製品利用者は選択したフィールドを製品アダプター経由で送信する。共有サービスに自動 ID や取り込みポリシーはなく、チャネル間でキューやリクエストを共有しない。

[製品アダプター](../../packages/host/product-telemetry-otel/README.md)と[セッションアダプター](../../packages/session/session-telemetry-otel/README.md)はデプロイ設定と破棄期限を保持する。利用者はシャットダウン後のチャネルを再利用してはならない。OTel サービスのみのマウントではプロバイダーやトランスポートを割り当てない。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成（doc-sync の `pnpm run verify-cordis-catalog` で鮮度を検証。`pnpm run gen-cordis-catalog` で再生成） — 言語面の違いはロケール固有のペア文書パスのみである。シグネチャーブロックは `ts cordis-catalog` フェンスを使用し、元のソース JSDoc を保持する。ディスパッチモードは[入門書](../cordis-primer.md#dispatch-modes)で定義し、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) に存在する。

<a id="ctxotel--otel"></a>

### `ctx.otel` — `OTel`

共有トランスポートプロバイダー。マウントだけではキュー、ID、ネットワーク接続を作成しない。

```ts cordis-catalog
/**
 * Create an independent ordinary-event channel with count-based batching.
 * The injected consumer must drain it during its fiber disposal.
 * @param options - transport, scope, resource, queue, and diagnostic settings selected by the consumer.
 * @returns the caller-owned channel; no state is shared with other channels.
 */
createEventReporter(options: EventLogOptions): EventLogReporter

/**
 * Create an independent byte-bounded Session-log channel.
 * Authorization and redaction precede reporting; the consumer owns shutdown and its outer deadline.
 * @param options - transport, scope, resource, queue, and diagnostic settings selected by the consumer.
 * @returns the caller-owned channel, preserving complete accepted events within the request byte ceiling.
 */
createSessionLogReporter(options: SessionLogOptions): SessionLogReporter
```

ソース: [`packages/telemetry/otel/src/index.ts`](../../packages/telemetry/otel/src/index.ts)
<!-- END GENERATED cordis-surface -->
