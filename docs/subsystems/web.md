# Web アクセス

日本語 | [English](web.en.md) | [中文](web.zh.md)

Web アクセスシームは、1 つの `ctx.web` サービス上の **2 つの操作** (search と fetch) にまたがる[ケイパビリティシーム](../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md)であり、パッケージをまたいで分割されている: Service Definition ([dsh-web](../../packages/web/web)、`ctx.web` + プロバイダーレジストリ)、Service Providers ([dsh-web-search-exa](../../packages/web/web-search-exa)、[dsh-web-search-perplexity](../../packages/web/web-search-perplexity)、[dsh-web-search-deepseek](../../packages/web/web-search-deepseek)、[dsh-web-fetch-http](../../packages/web/web-fetch-http))、Consumer ([dsh-tool-web](../../packages/web/tool-web)、`web_search`/`web_fetch` ツールスキーマ)。Web は **1 つのオプションのケイパビリティ**であり、agent-loop の背骨の一部ではない — その語彙は [core.md](core.md) ではなくここに置かれる。検索プロバイダーの交換はモデルがクエリを要求する方法を変えず、fetch プロバイダーの交換はモデルが URL を要求する方法を変えない。

ソース: [`packages/web/web/src/types.ts`](../../packages/web/web/src/types.ts)

## なぜ 1 つのケイパビリティに 2 つの操作があるのか

search と fetch はリクエストスキーマもビジネスロジックも共有しないが、意図的に 1 つの `ctx.web` 中間層とされている: 1 つのプロバイダー選択ポリシーオーナー、1 つのアボート/エラー語彙、1 つの製品向け「このハーネスがどのように Web に到達するか」構成 API である。コストは、サービス上の並行する `searchX`/`fetchX` メソッドペアである。その並行性は意図的なものであり、見落とされた抽出ではない。プロバイダーはツールではなく**ケイパビリティ** (`WebSearchProvider` または `WebFetchProvider`) を登録する。モデル向けの名前、スキーマ、プロンプトガイダンス、プレゼンテーションはすべて単一の `dsh-tool-web` コンシューマーに存在する。

## 検索リクエストと結果

各シームリクエストは正確に 1 つの `query` を運ぶ。`dsh-tool-web` コンシューマーは必須の `queries` 配列を受け取り、それを個別のシームリクエストにファンアウトする。1 要素の配列は 1 回の検索を実行する。`maxResults` はコンシューマー所有の境界 (`dsh-tool-web` の `searchMaxResults` 構成、既定 `8`) であり、シームを通して渡され、戻りで強制される — プロバイダーが多く返しすぎた場合、シームは `sources[]` を切り詰めて `truncated` を設定する。

```ts type-equiv
/**
 * What one search-capable backend is asked to search. Each request carries one
 * query; a consumer may issue several requests. `maxResults` is a
 * `dsh-tool-web`-layer bound passed through unchanged and enforced on the way
 * back by the seam (see {@link WebSearchResult}).
 */
interface WebSearchRequest {
  readonly query: string
  /**
   * Upper bound on returned sources; the seam truncates to it. Omitted = no
   * bound. `dsh-tool-web` always sets it. A provider whose API supports a
   * result-count control (Exa's `numResults`) should apply it at the request
   * layer as a cost/latency optimization; the seam enforces the bound
   * regardless.
   */
  readonly maxResults?: number
}
```

```ts type-equiv
/**
 * Normalized search outcome. `content` is optional provider-generated answer
 * text or summary (Exa and DeepSeek return none; Perplexity returns a
 * generated answer).
 * `sources[]` is the portable citation shape. `truncated` is set by the seam
 * when it cut `sources[]` down to `maxResults`.
 */
interface WebSearchResult {
  /** Optional provider-generated answer text, search context, or summary. */
  readonly content?: string
  /** Citeable sources, already truncated to the request's `maxResults`. */
  readonly sources: readonly WebSearchSource[]
  /** True when the seam dropped sources to honor `maxResults`. */
  readonly truncated: boolean
}
```

```ts type-equiv
/**
 * One citeable source. A source always has a URL; `title`, `snippet`, and
 * `publishedAt` are optional because not every provider returns them — forcing
 * adapters to invent them would make the seam lie (Perplexity citations may be
 * URL-only). `dsh-tool-web` renders `title ?? hostname(url)` for display.
 */
interface WebSearchSource {
  readonly url: string
  readonly title?: string
  readonly snippet?: string
  /** Publication/crawl timestamp as a provider-supplied ISO-8601 string. */
  readonly publishedAt?: string
}
```

## Fetch リクエストと結果

```ts type-equiv
/**
 * What one fetch-capable backend is asked to retrieve. The request deliberately
 * omits timeout, format, prompt, and extraction controls: cancellation is a
 * direct execution argument, while presentation and higher-level LLM concerns
 * belong outside safe retrieval.
 */
interface WebFetchRequest {
  readonly url: string
}
```

HTTP ステータスは取得したリソース状態の一部であり、自動的な失敗ではない: `404`/`500` のネットワークフェッチ成功は、ステータスコードと境界付きのデコード済みボディを伴う `WebFetchResult` を返す。`url` は許可されたリダイレクト後の最終 URL である。`WebError` はリソースを安全に取得または表現できなかった失敗のために予約されている。

```ts type-equiv
/**
 * Normalized fetch outcome. A successful network fetch of a non-2xx response is
 * a result, not an error: the status code is part of the fetched resource
 * state. {@link WebError} is reserved for failures to safely retrieve or
 * represent the resource.
 */
interface WebFetchResult {
  /** The final URL after allowed redirects (the request URL is in the request). */
  readonly url: string
  /** HTTP status code of the fetched response. */
  readonly statusCode: number
  /** Decoded body, classified by content kind. */
  readonly body: WebFetchBody
  /** True when the provider capped the decoded body. */
  readonly truncated: boolean
}
```

```ts type-equiv
/**
 * The decoded body of a fetched resource. A CLOSED discriminated union owned by
 * `dsh-web`: the provider decodes the kind and `dsh-tool-web` renders it, so a
 * new kind is a coordinated change across known packages, not a plugin
 * extension. Consumers `switch` on `kind` ending in `default: assertNever(...)`
 * so adding a kind breaks compilation at every consumer until handled. Each arm
 * stays its own object literal even where fields coincide, so an arm can gain
 * fields the others lack.
 */
type WebFetchBody =
  | { readonly kind: 'html'; readonly content: string }
  | { readonly kind: 'text'; readonly content: string }
```

## プロバイダーの可用性

プロバイダーの `available(): boolean` は安価なローカルチェック (クレデンシャルの存在、パース可能な構成) であり、**ネットワーク呼び出しを行ってはならない**。これは実行時選択への入力であり、ヘルスシステムではない: `search()`/`fetch()` は使用可能なプロバイダーを選ぶためにこれを読み、選択の失敗は呼び出し元がルーティングする構造化 `WebError` として表面化する — 分岐可能な詳細 (欠落した ID または曖昧な候補集合) をコードとメッセージに運ぶ。

選択は登録、構成、HMR の順序に決して依存しない: ケイパビリティは明示的なプロバイダー ID (構成 `searchProvider`/`fetchProvider`、または同じフィールドに給する対応する環境変数) を持つか、使用可能なプロバイダーがちょうど 1 つ登録されている場合に自動選択する。構成された ID なしで複数の使用可能なプロバイダーがある場合は `WEB_PROVIDER_AMBIGUOUS` であり、先勝ちではない。

## Fetch ネットワークポリシー

同梱の Cordis、Code、Standard プリセットは、呼び出しごとの確認なしで、すべてのサンドボックスと承認モードで `web_fetch` を公開する。ファイルサンドボックスプリセットは Web ネットワークアクセスを統治しない。確認を必要とするデプロイメントは `tools/pre-execute` ポリシーを追加するか、fetch を無効化する必要がある。

HTTP プロバイダーは各実際のリクエストを解決し、アクティブな DNS64 プレフィックスを通して到達するプライベート IPv4 を含む非公開の応答を拒否し、検証済みアドレス集合をピン留めし、同一オリジンのリダイレクトごとに強制を繰り返す。クロスオリジンのリダイレクトには新しいツール呼び出しと新たな公開アドレス検証が必要である。これらのチェックは非公開宛先への SSRF アクセスを防ぐが、モデルが公開 URL にデータを送ることを止めるものではない。

## エラー

`WebError extends HarnessError` ([core.md](core.md) のエラー分類) は `code: string` (他のすべてのシームのエラー — `LlmError`、`SubagentError` — と同様にオープン) を持ち、閉じたユニオンではない: プロバイダーは `dsh-web` を編集せずに独自のコードを上げてよく、コンシューマーは未知のコードを許容しなければならない。コードはオーナーごとに分かれる。シーム中立のコードは共有 `WebRuntime` 契約によって上げられる: `WEB_PROVIDER_UNAVAILABLE`、`WEB_PROVIDER_CONFIGURED_MISSING`、`WEB_PROVIDER_CONFIGURED_UNAVAILABLE`、`WEB_PROVIDER_AMBIGUOUS`、`WEB_DUPLICATE_PROVIDER` (登録時のプログラミングエラーで、`LlmRuntime` の `DUPLICATE_ADAPTER` に相当)、`WEB_ABORTED`、および `WEB_PROVIDER_ERROR` (シームを通して表面化するプロバイダー自身の失敗 — ネットワーク/トランスポートの失敗 (DNS、接続拒否、TLS) を含む — の catch-all)。Fetch トランスポートのコードは `dsh-web-fetch-http` 実装が所有し、別の fetch バックエンドがそれらを上げる必要はない: `WEB_INVALID_URL`、`WEB_BLOCKED_URL`、`WEB_REDIRECT_BLOCKED`、`WEB_FETCH_TOO_LARGE`、`WEB_FETCH_TIMEOUT`、`WEB_UNSUPPORTED_CONTENT_TYPE`。

## サービス

`WebRuntime` は search と fetch のプロバイダーを登録し、重複 ID を `WEB_DUPLICATE_PROVIDER` で拒否し、実行時に構造化された選択エラーでプロバイダーを解決する。ローカル fetch バックエンドは HTTP(S) のみを受け入れ、クレデンシャルを拒否し、各ホスト名を 1 度解決し、非公開の IPv4 または IPv6 宛先、あるいは非公開 IPv4 へのアクティブプレフィックス NAT64 変換を含む応答集合を拒否し、リクエスト接続を検証済みアドレスにピン留めし、同一オリジンのリダイレクトホップごとにそれらのチェックを繰り返し、リダイレクト、バイト、文字、時間を制限し、ボディをデコードする。プレゼンテーションはツールが所有する。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxweb--webruntime"></a>

### `ctx.web` — `WebRuntime`

The web access service. Registered as `ctx.web` (one instance per context).

Selection semantics (resolved at execution time, never order-dependent):

- A configured id that is registered and `available()` → that provider.
- A configured id not registered → `WEB_PROVIDER_CONFIGURED_MISSING`.
- A configured id registered but unavailable → `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`.
- No id configured, exactly one registered usable provider → that provider.
- No id configured, multiple usable providers → `WEB_PROVIDER_AMBIGUOUS`.
- No id configured, no usable provider → `WEB_PROVIDER_UNAVAILABLE`.

```ts cordis-catalog
/**
 * Register a search provider. Throws {@link WebError} `WEB_DUPLICATE_PROVIDER`
 * if its id is already registered for search. Returns a disposer; disposed
 * with the calling fiber.
 * @param provider - the provider; its `id` is the registry key.
 * @returns the disposer that unregisters the provider.
 */
registerSearchProvider(provider: WebSearchProvider): () => void

/**
 * Register a fetch provider. Throws {@link WebError} `WEB_DUPLICATE_PROVIDER`
 * if its id is already registered for fetch. Returns a disposer; disposed
 * with the calling fiber.
 * @param provider - the provider; its `id` is the registry key.
 * @returns the disposer that unregisters the provider.
 */
registerFetchProvider(provider: WebFetchProvider): () => void

/**
 * Run one search through the selected provider. Resolves the provider at call
 * time with the selection rules above; throws {@link WebError} when the
 * capability cannot run. The seam enforces `request.maxResults` on the result:
 * if the provider over-returns, `sources[]` is truncated and `truncated` set.
 * @param request - the query and optional result limit.
 * @param signal - optional cancellation signal forwarded to the provider.
 * @returns the provider's results, capped to `request.maxResults`.
 */
async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>

/**
 * Retrieve one URL through the selected provider. Resolves the provider at
 * call time with the selection rules above; throws {@link WebError} when the
 * capability cannot run. A non-2xx response is a result, not a throw.
 * @param request - the URL plus retrieval options.
 * @param signal - optional cancellation signal forwarded to the provider.
 * @returns the retrieval outcome; non-2xx responses resolve descriptively.
 */
async fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult>
```

Source: [`packages/web/web/src/index.ts`](../../packages/web/web/src/index.ts)
<!-- END GENERATED cordis-surface -->
