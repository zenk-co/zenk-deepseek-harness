# ブラウザー利用

日本語 | [English](browser-use.en.md) | [中文](browser-use.zh.md)

ブラウザー利用により、モデルは設定済みバックエンドを通じて Web ページを検査し操作できる。DSH はタスクループを所有する。プロバイダーはブラウザー操作を提供し、1 つのライブセッションのターンにわたってブラウザー状態を保持する。

## プロバイダーの選択

[`dsh-browser-use`](../../packages/browser-use/browser-use/README.md) と 1 つのプロバイダーを同じ構成にマウントする。プロバイダーは実験的な公開 npm パッケージであり、明示的な有効化が必要である。それらの初期ブラウザーエンジンは Chromium である。

| プロバイダー | 統合 |
|---|---|
| [Playwright MCP](../../packages/experimental/browser-use-playwright-mcp/README.md) | Playwright のブラウザー制御 MCP ツール |
| [Chrome DevTools MCP](../../packages/experimental/browser-use-chrome-devtools-mcp/README.md) | MCP を通じた Chrome DevTools 検査と制御 |
| [Stagehand](../../packages/experimental/browser-use-stagehand-native/README.md) | AI 支援アクション、観察、抽出を備えたネイティブブラウザー操作 |

共有サービスは名前のみを登録し、同名の別インスタンスを含む 2 つ目のプロバイダーを拒否する。共通ブラウザー操作メソッド、ブラウザーリソース、モデル制御セレクターは持たない。プロファイルやプリセットでのプロバイダー設定は、その有効化のための起動または接続を選択する。

## セッション所有

起動されたブラウザーはそれを使う正確なライブエージェントとセッションに属する。ターンをまたぐ呼び出しはそのブラウザーを再利用する。セッションランタイムの破棄は起動したリソースを閉じる。セッションのリロードやフォークは新しいブラウザー状態で開始する。ブラウザープロファイルとログイン状態はセッションログから復元されない。

接続されたブラウザーは外部所有のままである。プロバイダーはそのプロバイダーインスタンス内で 1 つのセッションのためにそれを確保し、既存のブラウザー状態を保ち、別のセッションによる同時接続を拒否する。テアダウンは切断し、外部ブラウザーを実行中のままにする。別の DSH プロセスと他のクライアントはこの確保の範囲外である。

プロバイダー停止はツール受付を止め、所有作業とリソース片付けを待ってから共有プロバイダー登録を解放する。すでに配送されたブラウザーアクションはキャンセルで取り消せない。

## MCP 初期化

MCP プロバイダーはプロバイダー読み込み後に作成されるライブエージェントごとに 1 つのクライアントを初期化する。既存の直列 `agent/created` イベントは、作成や再開の完了前およびキュー済み入力の実行前に接続と検出を待機する。クライアントはターンをまたいでセッションと共に残る。起動失敗やキャンセルは作成や再開を拒否し、クライアント片付けを引き起こす。

接続先が使用中の場合、その有効化はブラウザーなしで継続し、後のターンに再試行しない。解放後、新たに作成または再開された有効化はそれを取得できる。プロバイダーの読み込みや再読み込みはすでに有効なセッションを引き継がない。これらの初期化規則は[共有ランタイム](../../packages/experimental/browser-use-runtime/README.md)が所有する。

## ツールと記録済み結果

プロバイダーツールは通常の DSH 実行パイプラインとセッションログを使う。プロバイダーはツールスキーマ、結果描画、画像対応、設定、上流制限を所有する。共有サービスはモデル可視コンテンツを追加しない。Stagehand の AI 支援操作は明示的に設定されたネイティブモデルを使う一方、DSH はタスクループを保持する。DSH モデル経路指定、認証情報再利用、基盤推論要求・応答捕捉、セッション使用量集計への統合は先送りである。返される SDK データとメタデータは通常のログ済みツール結果のままである。

ブラウザー MCP 接続は[リソースとサーバー指示](mcp.md)も公開する。ブラウザーサーバー宛てのリソース呼び出しはそのセッションキューを使い、他のセッションを拒否する。サーバー指示は所有セッションのためだけに組み立てられる。

[決定記録](../../.agents/notes/implemented/architecture/2026-09-12-browser-use-provider-registration.md)は登録専用サービスとセッションごとの所有を説明する。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される(doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。再生成は `pnpm run gen-cordis-catalog`)。言語版の違いは、ロケール固有のペアドキュメントパスのみである。シグネチャブロックは `ts cordis-catalog` フェンスを使用し、元のソース JSDoc を保持する。ディスパッチモードは [primer](../cordis-primer.md#dispatch-modes) で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxbrowseruse--browseruseregistry"></a>

### `ctx.browserUse` — `BrowserUseRegistry`

共有 browser-use サービス内の任意の単一プロバイダー登録を所有する。

```ts cordis-catalog
/**
 * Reserve the sole provider slot until the contribution is disposed.
 * A second registration fails even when it repeats the current name. Providers
 * must stop their tools and await owned work before releasing this registration.
 * @param name - provider-owned name used in registration diagnostics.
 * @returns the effect disposer for this exact registration.
 */
register(name: BrowserUseProviderName): () => Promise<void>
```

ソース: [`packages/browser-use/browser-use/src/index.ts`](../../packages/browser-use/browser-use/src/index.ts)
<!-- END GENERATED cordis-surface -->
