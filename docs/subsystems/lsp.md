# LSP ナビゲーション

日本語 | [English](lsp.en.md) | [中文](lsp.zh.md)

LSP シームは、1 つの `ctx.lsp` サービス上で意味論的なコードナビゲーションを公開する[ケイパビリティシーム](../glossary.md#capability-seam)であり、パッケージをまたいで分割される。Service Definition（[dsh-lsp](../../packages/lsp/lsp)、`ctx.lsp` + プロバイダーレジストリ）、汎用 Service Provider（[dsh-lsp-stdio](../../packages/lsp/lsp-stdio)、構成済み stdio 言語サーバーホスト）、Consumer（[dsh-tool-lsp](../../packages/lsp/tool-lsp)、`lsp` ツールスキーマ）である。LSP は **1 つの省略可能なケイパビリティ**であり、agent-loop の背骨の一部ではない —— その語彙は [core.md](core.md) ではなくここにある。プロバイダーの差し替えは、モデルがナビゲーションを要求する方法を変えない。

ソース: [`packages/lsp/lsp/src/types.ts`](../../packages/lsp/lsp/src/types.ts)

## 操作と座標

シームとモデルはちょうど 4 つの意味論クエリを公開する。ユニオンは閉じているので、1 つ追加することはシーム、プロバイダー、ツールにまたがるコンパイル強制の変更である。位置と範囲はゼロベースの UTF-16 で、プロトコルに一致する。モデルに面するツールが 1 ベースのカーソル規約を所有し、入り口と出口で変換する。

```ts type-equiv
/**
 * The four semantic queries the seam and model expose. A closed union: adding an operation is a
 * compile-enforced change across the seam, providers, and the tool. Symbols and call hierarchy are
 * not operations here; they need different schemas.
 */
type LspOperation = 'goToDefinition' | 'findReferences' | 'goToImplementation' | 'hover'
```

```ts type-equiv
/** A zero-based UTF-16 cursor coordinate, matching the LSP wire convention. */
interface LspPosition {
  /** Zero-based line. */
  readonly line: number
  /** Zero-based UTF-16 code-unit offset within the line. */
  readonly character: number
}
```

```ts type-equiv
/** A zero-based UTF-16 half-open range `[start, end)`. */
interface LspRange {
  readonly start: LspPosition
  readonly end: LspPosition
}
```

## リクエスト

すべてのフィールドが必須である。`workspaceRoot` は呼び出し側が供給し、`languageId` はプロバイダーの登録から来る（リクエストからではない）。タイムアウトと結果上限はコンシューマーが所有する —— したがってどのフィールドも実装側のデフォルトを必要とせず、`resolve()` ステップも存在しない。プロバイダーは呼び出し側のリクエストと導出された `languageId` を受け取る。`languageId` は一時ドキュメントを同期させるだけで、選択には関与しない。

```ts type-equiv
/**
 * A caller's normalized query. Every field is required: `workspaceRoot` is caller-supplied,
 * `languageId` comes from the provider registration (not here), and consumers own timeouts and
 * result limits — so no field needs implementation defaulting and there is no `resolve()` step.
 */
interface LspQueryRequest {
  /** Which semantic query to run. */
  readonly operation: LspOperation
  /** The source file to query (relative to `workspaceRoot` or absolute; the provider canonicalizes). */
  readonly filePath: string
  /** The zero-based UTF-16 cursor position to query at. */
  readonly position: LspPosition
  /** The workspace root the provider resolves against and indexes; required, never defaulted. */
  readonly workspaceRoot: string
}
```

```ts type-equiv
/**
 * A request as a provider receives it: the caller's {@link LspQueryRequest} plus the `languageId`
 * the seam derived from the provider's extension mapping. The language id only synchronizes the
 * transient document; it does not participate in selection.
 */
interface LspProviderQuery extends LspQueryRequest {
  /** The LSP language id for `filePath`, from this provider's extension mapping. */
  readonly languageId: string
}
```

## 結果

閉じた判別可能ユニオンである。ナビゲーション操作は `locations` に、`hover` はコンテンツまたは `null` に正規化される。コンシューマーは `kind` で網羅的に `switch` するので、新しいアームは処理されるまでコンパイルを壊す。`findReferences` は常に宣言を含む —— プロバイダーが内部でこれを強制するので、呼び出し側にフラグはない。`locations` バリアントは `resolvedWorkspaceUri`、すなわちプロバイダーの正規のワークスペース `file:` URI を運ぶ。位置 URI を相対化する呼び出し側は、シンボリックリンクかもしれないリクエストルートにホストプラットフォームのパス規則を適用するのではなく、その座標を使う。

```ts type-equiv
/** One resolved location: a document URI and the range within it. */
interface LspLocation {
  /** The target document URI (`file:` or otherwise), verbatim from the server. */
  readonly uri: string
  /** The range within the target document. */
  readonly range: LspRange
}
```

```ts type-equiv
/** Normalized hover content, or `null` for no hover at the position. */
interface LspHover {
  /** The normalized hover text (markdown or plaintext, provider-joined). */
  readonly contents: string
  /** The range the hover applies to, when the server supplied one. */
  readonly range?: LspRange
}
```

```ts type-equiv
/**
 * The closed result union. Navigation operations (`goToDefinition`, `findReferences`,
 * `goToImplementation`) normalize to `locations`; `hover` normalizes to content or `null`.
 * Consumers `switch` on `kind` to exhaustiveness so a new arm breaks compilation until handled.
 *
 * The `locations` variant carries `resolvedWorkspaceUri`: the provider's canonical `file:` URI for
 * the request's workspace root. A caller that relativizes location URIs MUST use this, not parse the
 * request's possibly symlinked process path with host-platform rules; the execution platform may
 * differ from the caller's.
 */
type LspQueryResult =
  | { readonly kind: 'locations'; readonly locations: readonly LspLocation[]; readonly resolvedWorkspaceUri: string }
  | { readonly kind: 'hover'; readonly hover: LspHover | null }
```

## プロバイダーとサービス

プロバイダーは安定したブランド付きの `id` と、排他的な小文字・先頭ドットの拡張子マップを所有する。`registerProvider` は id とすべての拡張子をアトミックに予約し —— 無効または競合する登録は何も公開しない —— その disposer がすべての予約を解放する。選択はクエリごとで順序に依存しない。一致しない場合は `LspError` `LSP_UNAVAILABLE` を throw する。このシームはプロトコル型、プロセス/ドキュメント制御、汎用 JSON-RPC エスケープハッチを公開しない。

```ts type-equiv
/**
 * A language-server backend registered on `ctx.lsp`. Each provider owns a stable {@link
 * LspProviderId} and an extension-to-language-id map (lowercase, leading-dot keys).
 * `findReferences` always includes declarations — the provider enforces this internally; callers
 * get no flag.
 */
interface LspProvider {
  /** Stable provider identity, reserved atomically with the extension mappings. */
  readonly id: LspProviderId
  /** Lowercase leading-dot extension → LSP language id (e.g. `{ '.ts': 'typescript' }`). */
  readonly extensionToLanguage: Readonly<Record<string, string>>
  /**
   * Run one query. The seam has already selected this provider and derived `languageId`.
   * @param request - the resolved provider query (caller request + derived language id).
   * @param signal - optional cancellation; the provider stops its own work when it aborts.
   * @returns the normalized, closed-union result.
   */
  query(request: LspProviderQuery, signal?: AbortSignal): Promise<LspQueryResult>
}
```

```ts type-equiv
/**
 * The LSP capability seam (`ctx.lsp`). Owns provider registration/selection and normalized query
 * execution; exposes exactly the four operations and no protocol escape hatch.
 */
interface LspService {
  /**
   * Register a provider, atomically reserving its id and every normalized extension. Any conflict
   * or invalid input publishes nothing and throws `LspError`; the returned disposer releases all
   * reservations. Disposed with the calling fiber.
   * @param provider - the backend to register.
   * @returns a synchronous disposer releasing the id and all extension reservations.
   */
  registerProvider(provider: LspProvider): () => void
  /**
   * Select a provider by the file's extension and run one query. Selection is per-query and
   * order-independent; no match throws `LspError` `LSP_UNAVAILABLE`.
   * @param request - the normalized query.
   * @param signal - optional cancellation forwarded to the selected provider.
   * @returns the normalized, closed-union result.
   */
  query(request: LspQueryRequest, signal?: AbortSignal): Promise<LspQueryResult>
}
```

`LspProviderId` はこのシームのブランド付き id（[dsh-brand](../../packages/util/brand) の `Branded<'LspProviderId'>`）である。`LspError` は `HarnessError` を拡張し、`LSP_INVALID_PROVIDER`、`LSP_CONFLICT`、`LSP_UNAVAILABLE`、`LSP_DISPOSED`、`LSP_UNSUPPORTED_OPERATION`、`LSP_MALFORMED_RESPONSE` などの安定したコードを持ち、呼び出し側は `message` を解析する代わりにこれでルーティングする。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される（doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。`pnpm run gen-cordis-catalog` で再生成）。言語版はロケール固有の対訳ドキュメントパスだけが異なる。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxlsp--lspservice"></a>

### `ctx.lsp` — `LspService`

LSP ケイパビリティシーム（`ctx.lsp`）。プロバイダーの登録/選択と正規化クエリ実行を所有し、ちょうど 4 つの操作を公開して、プロトコルエスケープハッチを持たない。

```ts cordis-catalog
/**
 * Register a provider, atomically reserving its id and every normalized extension. Any conflict
 * or invalid input publishes nothing and throws `LspError`; the returned disposer releases all
 * reservations. Disposed with the calling fiber.
 * @param provider - the backend to register.
 * @returns a synchronous disposer releasing the id and all extension reservations.
 */
registerProvider(provider: LspProvider): () => void

/**
 * Select a provider by the file's extension and run one query. Selection is per-query and
 * order-independent; no match throws `LspError` `LSP_UNAVAILABLE`.
 * @param request - the normalized query.
 * @param signal - optional cancellation forwarded to the selected provider.
 * @returns the normalized, closed-union result.
 */
query(request: LspQueryRequest, signal?: AbortSignal): Promise<LspQueryResult>
```

ソース: [`packages/lsp/lsp/src/types.ts`](../../packages/lsp/lsp/src/types.ts)
<!-- END GENERATED cordis-surface -->
