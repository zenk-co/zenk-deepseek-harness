# Client モジュール

日本語 | [English](client-modules.en.md) | [中文](client-modules.zh.md)

Web プラグインテーブル: [dsh-client-modules](../../packages/client/modules) にあるクライアントモジュールシステムの Node 半であり、`ctx.clientModules` (`ClientModuleRegistry`) として提供される。Host Loader のエントリーから `dsh.client` を宣言するパッケージを走査し、`window.__DSH_BOOT__` エントリーグラフを組み立て、`/plugins` の下でバージョン付きの 1 つ以上のリソースからなるコンボスクリプトを提供し、すべてのインデックス注入の収集に起動プロトコルの行で応答する — 1 つのサービスの 4 つの面である。Web GUI スタックのオプションのケイパビリティであり、エージェントループの背骨の一部ではなく、[dsh-host-webserver](../../packages/host/webserver) のコンシューマーである: [web-server.md](web-server.md) に記載されたキャリアが、このサービスが応答するプレフィックスルートと `webserver/index-inject` イベントを提供する。同じパッケージのブラウザー半 (`ctx.modules`、これらのバンドルを取得して実体化する lazy-CJS モジュールテーブル) は、[パッケージ README](../../packages/client/modules/README.md) に記載されたカーネル機構であり、本ページではない。

ソース: [`packages/client/modules/src/client/manifest.ts`](../../packages/client/modules/src/client/manifest.ts)

## ワイヤ

グラフは Node 半とブラウザー半の間のワイヤの唯一の情報源である。Host は走査したパッケージから `WebBootEntry` 行と `WebBootBatch` 記述子を組み立て、次に Vite エントリーの前に、登録ファサード、アプリケーションのプリロード、ブートストラップスクリプト、グラフグローバルを構造化インデックス注入テーブルにコントリビュートする。`global` 行は `globalThis["__DSH_BOOT__"]` としてレンダリングされ、`<` がエスケープされるので、プラグインが制御する文字列が script 要素から抜け出すことはできない。有効なマニフェストのないページは起動できない: ブラウザーパーサーは不正な行またはバッチ、未知のメンバー、ちょうど 1 つの初期コンボ記述子を持たないエントリーを拒否する。

```ts type-equiv
/**
 * One composed client entry pushed by the host (a graph row). Wire
 * single source: the host node half (package root) produces this same shape.
 * `immediately` marks stage-one prefetch. `inject` names package rows whose
 * factories must arrive before this row materializes, while Cordis separately
 * uses the same package edges to compose entries. `external` carries exact
 * non-inject module requests (see {@link WebBootGraph.entries}).
 */
interface WebBootEntry {
  /** Entry name == package name. */
  id: string
  /**
   * Revisioned single-resource combo reference used by HMR. It is relative to
   * the document, so the browser resolves it under whatever mount served the page.
   */
  url: string
  /** Opaque plugin-artifact revision used for HMR cache busting. */
  rev: string
  /** Package-name dependency edges used for factory arrival and plugin composition. */
  inject?: string[]
  /** Stage-one prefetch mark: load the script for factory registration during module-face boot. */
  immediately?: boolean
  /** Non-baseline module specifiers this row requests; omitted when it requests none. */
  external?: string[]
}
```

```ts type-equiv
/** Initial scheduling phase for one revisioned combo script. */
type WebBootBatchPhase = 'bootstrap' | 'application'
```

```ts type-equiv
/** One initial combo script; a scheduling phase may span several descriptors. */
interface WebBootBatch {
  /** Parser-blocking bootstrap or preloaded application scheduling. */
  phase: WebBootBatchPhase
  /** Content-addressed combo script reference, document-relative like {@link WebBootEntry.url}. */
  url: string
  /** Revision derived from the ordered entry revisions. */
  rev: string
  /** Graph entry ids whose factories the script registers, in execution order. */
  entries: string[]
}
```

```ts type-equiv
/** Host release identity; two releases are the same when both fields are equal. */
interface WebBootRelease {
  /** Release version label. */
  version: string
  /** Source commit fixed in when the Host was built; absent when the build recorded none. */
  commit?: string
}
```

```ts type-equiv
/** The composed client entry graph the host injects as `window.__DSH_BOOT__`. */
interface WebBootGraph {
  /** Consistency anchor over the current entry and batch descriptors. */
  rev: string
  /** Host release identity; absent from a Host that publishes none. */
  release?: WebBootRelease
  /**
   * Composed entries in module-graph order — a dynamic package row precedes
   * rows whose `external` requests that package. Cordis activation order is
   * unrelated and remains owned by fiber service waiting.
   */
  entries: WebBootEntry[]
  /** Initial combo descriptors; every entry belongs to exactly one descriptor. */
  batches: WebBootBatch[]
}
```

初期発行と HMR は、実行可能バイトをハッシュせずに、各エントリーの mtime、ctime、size から各行の `rev` を導出する。同じアーティファクトは Host の再起動をまたいでリビジョンを保持する。初期記述子は行をブートストラップとアプリケーションのスケジューリングフェーズに分割し、どちらのフェーズも複数の記述子を含んでよい。それらの URL は順序付きのパッケージリソースリストと、それらの行リビジョンから導出されたリビジョンだけを含み、フェーズ名はルートに入らない。グラフの合成は行順を保ちつつ、map 形式の URL が 3 KiB を超える前に貪欲に分割し、スクリプトを連結したり map を読んだりしない。グラフリビジョンはエントリーとバッチの記述子をハッシュする。`immediately` はステージ 1 の登録バリアを印付けする。1 つのコンボ内の行はそのスクリプトの転送を共有し、別々のコンボは独立にロードされる。

`release` はこのパッケージのバージョンと、クライアントビルドがビルド済み Host アーティファクトに固定したソースコミットを対にするもので、グラフリビジョンの外側にとどまる。ページがグラフと再構築されたフレームを適用するのは、Host がそのページの起動リリースを提供している間だけであり、別のリリースはページのリロードを待つ ([Host リリースの変更](../../packages/client/modules/README.md#host-release-changes))。

## スキャン

パッケージは package.json で `dsh.client` (`platform: 'web'`、オプションの `inject` エッジ、オプションの `immediately`) を宣言し、ビルド済みバンドルを `exports["./client"]` で公開することでテーブルに参加する。各ライブ行は自身の Loader 指定子と所有ツリーの `baseUrl` から、利用可能なときにその Host フェイスをインポートするのと同じ `loader.internal.resolveSync` 実装を通じて解決される。最も近い所有パッケージのマニフェストがブラウザーモジュール id を供給するので、相対ソースとビルド済みオーバーレイはパッケージアイデンティティを保つ。1 つのパッケージ名に解決される別個のアクティブ Loader ソースは合成に失敗する。1 つのソースがアンロードされると、残ったソースがファイバー再起動なしで行を供給する。

走査はパッケージごとにインクリメンタルである。全再走査のコードパスは存在しない。すべての cordis `internal/plugin` 発行 (ファイバーの構築または破棄) がそのファイバーのエントリー名をダーティにし、マイクロタスクのフラッシュが各ダーティ名をライブの loader エントリーと突き合わせて調整する。アクティベーションパスはすべての現在のエントリーで同じダーティ集合をシードして同期的にフラッシュするので、最初の走査と定常状態は 1 つの実装を共有する — 失敗時の姿勢は正反対である。アクティベーション時、すでにロード済みのエントリーの中の不正な宣言または欠落したバンドルは、壊れたパッケージをすべて列挙した 1 つの大きな `AggregateError` に集約される: ファイバーは FAILED になり、起動の fail-loud スイープがそれを報告する。定常状態では、壊れたパッケージは警告をログし、他のパッケージを汚染してはならない。

パッケージメタデータ — 「クライアントパッケージではない」という否定的な判定を含む — は Loader 指定子と所有ツリーのベース URL ごとに再起動までキャッシュされる。同じソースからのファイバー再起動はその行と rev をそのまま再利用し、バンドル内容の変更は `rebuilt()` を通じてのみグラフに到達する。

## バンドルルートとインデックス注入

`GET`/`HEAD /plugins/??<package-a>/client.js,<package-b>/client.js&rev=<rev>` は生成された 1 つのコンボスクリプトをアドレス指定する。1 リソースのリクエストも同じ形式を使い、それが HMR パスである。スクリプトは最初の `GET` で 1 回だけ連結され、末尾にコンボクエリだけを運ぶ `sourceMappingURL` を付ける — `??<package-a>/client.js.map,<package-b>/client.js.map&rev=<rev>` で、これはドキュメントではなくスクリプト自身のディレクトリを基準に解決される。map ファイルは起動、インデックスレンダリング、スクリプトの `GET`、`HEAD` では読まれない。最初の map の `GET` がそれらを読んで検証し、1 つの Indexed Source Map v3 を合成し、そのボディをキャッシュする。作者によるコンポーネント map は自身のセクションを供給し、それを持たないコンポーネントは、`sourcesContent` が取り込まれたバンドルでありソース名がパッケージ化された `sourceURL` またはプラグインルートである identity セクションを受け取る。すべての起動リクエスト URL は UTF-8 バイトで測って最大 3 KiB であり、分割にはより長い map 形式が使われる。すべてのアプリケーション URL はプリロードされ、すべてのブートストラップ URL はグラフグローバルと Vite エントリーより前に実行される。実体化されたレスポンスは長寿命のイミュータブルキャッシュを使う。未知または改変されたリソースリスト、欠落したリビジョン、陳腐化したリビジョンは、異なるバイトを提供したり SPA フォールバックに HTML を JavaScript として返させたりするのではなく 404 を返す。他のメソッドは 405 である。注入行はすべてのインデックスレンダリングで現在のグラフを運ぶので、リロードは常にライブの合成に対して起動する。

## サービス

```ts type-equiv
/** Filesystem baseline captured before a client artifact snapshot is read. */
interface ClientArtifactBaseline {
  /** Absolute path of the client bundle. */
  readonly path: string
  /** Bundle modification time in milliseconds. */
  readonly mtimeMs: number
  /** Bundle status-change time in milliseconds, including writes that preserve mtime. */
  readonly ctimeMs: number
  /** Bundle size in bytes. */
  readonly size: number
}
```

`ClientModuleRegistry` (`ctx.clientModules`、[`packages/client/modules/src/index.ts`](../../packages/client/modules/src/index.ts) で定義) は読み取りと再構築の面を公開する。シグネチャーは生成された[サービスカタログ](#ctxclientmodules--clientmoduleregistry)にある。`graph()` は現在の合成済みグラフ (変更間で安定したオブジェクト) を返し、`clientPath(id)` はバンドルの絶対パスを返し、`artifactBaseline(id)` は現在のスナップショットが読まれる前に取得したバンドル stat 値を返す。`fetchBundle()` は HTTP ルートが使うのと同じ遅延レスポンスを解決する。`rebuilt(id)` は変化したバンドル内容がグラフに到達する唯一の入口である: ファイルシステムメタデータからリビジョンを導出し、リビジョンが変わったときだけ新しいバイトを読んでグラフを再合成し、通知する。`onRebuilt` は変化したバンドルごとに新しいリビジョンを伴って発火し、`onGraphChanged` はグラフを再合成したあらゆるフラッシュの後 (行の追加もしくは削除、または rebuilt によるリビジョン変化) に発火し、プルモデルである — リスナーは `graph()` を読み直す。両方の通知パスはリスナーの例外を内包するので、例外を投げる購読者が後続の購読者をスキップさせたり、フラッシュを引き起こしたものを殺したりすることはできない。

[`dsh-client-hmr`](../../packages/client/hmr/README.md) は、出荷される Web 構成でライブグラフのスナップショットを届ける。Host は既存のグラフ変更通知を即座に転送し、再接続は現在の完全なグラフを送る。グラフは Host のクリーンアップが完了したことを主張せずに、望ましいブラウザーエントリーを記述する。そのアーティファクトポーリングは再構築されたリビジョンを別途報告する。ソースマップの変更だけではリロードはトリガーされない。新しいコンボ map URL はバンドルのリビジョンが変わって初めて現れ、各 map ボディは最初の `GET` で固定される。Client Modules はスナップショットを検証し、調整をそれらの再構築と直列化する。起動時に作成されるエントリーマップ、単一リソースの到着、非同期削除、未使用モジュール/スタイルのクリーンアップ、ページローカルのリトライ状態を所有する。静的プラットフォームモジュールとブートストラップはページ寿命を保つ。Electron のインストールは別のフローである。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される（doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。`pnpm run gen-cordis-catalog` で再生成）。言語版はロケール固有の対訳ドキュメントパスだけが異なる。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxclientmodules--clientmoduleregistry"></a>

### `ctx.clientModules` — `ClientModuleRegistry`

Web プラグインテーブルサービス: インクリメンタルな `dsh.client` 走査 + ワイヤ合成 + バンドルルート + インデックス注入行。構築はアクティベーション走査を同期的に実行する — すでにロード済みのエントリーの中の不正な宣言または欠落したバンドルは、1 つの大きな throw に集約される (FAILED ファイバー。起動のアクティベーション監査がそれを報告する)。

```ts cordis-catalog
/**
 * Current composed entry graph (stable object between changes).
 * @returns the graph served as `window.__DSH_BOOT__`.
 */
graph(): WebBootGraph

/**
 * Absolute path of an entry's client bundle.
 * @param id - entry id (package name).
 * @returns the path, or undefined for an unknown id.
 */
clientPath(id: string): string | undefined

/**
 * Serve an advertised revisioned bundle or source map without a Web server.
 * Unknown URLs return 404, unsupported methods return 405, and `HEAD`
 * returns the same immutable headers without materializing a body. Each body
 * is built once on its first `GET`; script construction never reads maps.
 * @param request - shell-carrier request for a `/plugins` resource.
 * @returns the exact response also exposed by the optional Web route.
 */
async fetchBundle(request: Request): Promise<Response>

/**
 * Filesystem baseline captured before an entry's current bytes were read.
 * HMR compares it with the live files when installing a watch, so a write
 * between startup composition and watch installation cannot disappear into
 * the watcher's initial state.
 * @param id - entry id (package name).
 * @returns the path and baseline, or undefined for an unknown id.
 */
artifactBaseline(id: string): ClientArtifactBaseline | undefined

/**
 * Publish one completed bundle generation (the HMR watch's registration
 * hook — the only entry point through which build changes reach the graph).
 * Unchanged mtime, ctime and size preserve the graph without reading the bundle.
 * @param id - entry id (package name).
 * @returns the current artifact rev, or undefined for an unknown id.
 */
rebuilt(id: string): string | undefined

/**
 * Subscribe to bundle rebuilds; fires only when artifact metadata changes the rev.
 * @param listener - receives the entry id and its new bundle rev.
 * @returns the unsubscriber.
 */
onRebuilt(listener: (id: string, rev: string) => void): () => void

/**
 * Fires after any flush that recomposed the graph (row added/removed, or a
 * rebuilt rev change). Pull model: listeners re-read {@link graph}.
 * @param listener - notified with no payload.
 * @returns the unsubscriber.
 */
onGraphChanged(listener: () => void): () => void
```

ソース: [`packages/client/modules/src/index.ts`](../../packages/client/modules/src/index.ts)
<!-- END GENERATED cordis-surface -->
