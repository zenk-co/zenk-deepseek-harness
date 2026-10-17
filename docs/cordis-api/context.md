<!-- scripts/gen-cordis-catalog.ts により生成される — 手動で編集しないこと。
     `pnpm run gen-cordis-catalog` を実行して再生成する。 -->

# Context

日本語 | [English](context.en.md) | [中文](context.zh.md)
コンテキストは Cordis の中核オブジェクトである。すべてのサービス、イベント、ライフサイクル API は `ctx` を通じて到達する。イベントメソッドは [Events](events.md) に、副作用と現在のファイバーは [Fiber](fiber.md) に、プラグインの読み込みは [Registry](registry.md) に記載されている。

Cordis プラグインのルートおよび子の依存コンテナ。

コンテキストはプロキシである。通常のプロパティ読み取りはサービスリゾルバーを通り、`extend()`、`isolate()`、`intercept()` は親を変更せずにスコープ付きの子コンテキストを作成する。

[ソース](../../vendor/cordis/src/context.ts#L42)

### ctx.extend(meta?)

```ts cordis-catalog
/**
 * Create a child context with extra metadata on top of the current scope.
 *
 * The child prototypally inherits every property of this context; own
 * properties of `meta` shadow the inherited ones. The parent is not mutated.
 *
 * @param meta — own properties (including symbol keys) to define on the child.
 * @returns a child context inheriting from this one.
 */
extend(meta = {}): this
```

現在のスコープの上に追加メタデータを持つ子コンテキストを作成する。

子コンテキストはこのコンテキストのすべてのプロパティをプロトタイプ継承する。`meta` の自前プロパティは継承されたものをシャドウする。親は変更されない。

- `meta` — 子コンテキストに定義する自前プロパティ（symbol キーを含む）。

**戻り値** このコンテキストから継承する子コンテキスト。

[ソース](../../vendor/cordis/src/context.ts#L99)

### ctx.isolate(name, label?)

```ts cordis-catalog
/**
 * Create a child context with an independent service scope for `name`.
 *
 * Below the returned context, reads and writes of the service `name`
 * resolve against the new label instead of the parent's, so a different
 * implementation can be provided without affecting the parent scope.
 * Passing the same `label` to two `isolate()` calls joins their scopes.
 *
 * @param name — the service name to isolate.
 * @param label — scope label to join; defaults to a fresh unique symbol.
 * @returns a child context whose `name` service resolves in the new scope.
 */
isolate(name: string, label?: symbol)
```

`name` に対する独立したサービススコープを持つ子コンテキストを作成する。

返されたコンテキストより下では、サービス `name` の読み取りと書き込みが親のラベルではなく新しいラベルに対して解決される。そのため親スコープに影響を与えずに別の実装を提供できる。同じ `label` を 2 つの `isolate()` 呼び出しに渡すと、それらのスコープが結合される。

- `name` — 隔離するサービス名。
- `label` — 結合するスコープラベル。既定では新しい一意の symbol。

**戻り値** `name` サービスが新しいスコープで解決される子コンテキスト。

[ソース](../../vendor/cordis/src/context.ts#L121)

### ctx.intercept(name, config)

```ts cordis-catalog
/**
 * Add service-specific intercept config for plugins started below this
 * context.
 *
 * Plugins loaded under the returned context see `config` merged into the
 * service's resolved config (ancestor entries first; see
 * `Service[symbols.resolveConfig]`). The parent context is not affected.
 *
 * @param name — the service name whose config to intercept.
 * @param config — the intercept config to merge for that service.
 * @returns a child context carrying the additional intercept entry.
 */
intercept<K extends InjectKey>(name: K, config: Context[K] extends { [symbols.config]: infer T } ? T : never): this
intercept(name: string, config: any): this
```

このコンテキストより下で開始されるプラグインに対するサービス固有の intercept 設定を追加する。

返されたコンテキストの下で読み込まれるプラグインは、サービスに解決された設定に `config` がマージされた状態を見る（祖先のエントリが先。`Service[symbols.resolveConfig]` を参照）。親コンテキストは影響を受けない。

- `name` — 設定を intercept するサービス名。
- `config` — そのサービスに対してマージする intercept 設定。

**戻り値** 追加の intercept エントリを運ぶ子コンテキスト。

[ソース](../../vendor/cordis/src/context.ts#L139)

### ctx.root

```ts cordis-catalog
/** The root context of the application (every child context shares it). @experimental */
root: this
```

アプリケーションのルートコンテキスト（すべての子コンテキストがそれを共有する）。@experimental

[ソース](../../vendor/cordis/src/context.ts#L22)

### ctx.baseUrl

```ts cordis-catalog
/** Base URL used to resolve relative plugin/module specifiers, if the runtime sets one. */
baseUrl?: string
```

ランタイムが設定する場合に、相対的なプラグイン/モジュール指定子を解決するために使われるベース URL。

[ソース](../../vendor/cordis/src/context.ts#L24)

### ctx.events

```ts cordis-catalog
/** The event bus. Its methods are also mixed onto `ctx` (`ctx.on`, `ctx.emit`, ...). */
events: EventsService
```

イベントバス。そのメソッドは `ctx` にもミックスインされる（`ctx.on`、`ctx.emit`、...）。

[ソース](../../vendor/cordis/src/context.ts#L26)

### ctx.logger

```ts cordis-catalog
/** The logging service. Call `ctx.logger(name)` for a named logger. */
logger: LoggerService
```

ロギングサービス。名前付きロガーには `ctx.logger(name)` を呼び出す。

[ソース](../../vendor/cordis/src/context.ts#L28)

### ctx.reflect

```ts cordis-catalog
/** The reflection layer backing the context proxy (`ctx.get`, `ctx.provide`, ...). */
reflect: ReflectService
```

コンテキストプロキシを支えるリフレクション層（`ctx.get`、`ctx.provide`、...）。

[ソース](../../vendor/cordis/src/context.ts#L30)

### ctx.registry

```ts cordis-catalog
/** The plugin registry. Its methods are mixed onto `ctx` (`ctx.plugin`, `ctx.inject`). */
registry: RegistryService
```

プラグインレジストリ。そのメソッドは `ctx` にミックスインされる（`ctx.plugin`、`ctx.inject`）。

[ソース](../../vendor/cordis/src/context.ts#L32)

## 静的メンバー

### Context.effect

```ts cordis-catalog
/** Symbol key under which a disposer exposes its {@link EffectMeta} diagnostics tree. */
static readonly effect: unique symbol
```

disposer がその EffectMeta 診断ツリーを公開するときの symbol キー。

[ソース](../../vendor/cordis/src/context.ts#L44)

### Context.filter

```ts cordis-catalog
/** Symbol key for a context's listener filter, consulted on every event dispatch. */
static readonly filter: unique symbol
```

コンテキストのリスナーフィルターの symbol キー。イベントのディスパッチごとに参照される。

[ソース](../../vendor/cordis/src/context.ts#L46)

### Context.isolate

```ts cordis-catalog
/** Symbol key of the isolation map (see the `Context[symbols.isolate]` property). */
static readonly isolate: unique symbol
```

隔離マップの symbol キー（`Context[symbols.isolate]` プロパティを参照）。

[ソース](../../vendor/cordis/src/context.ts#L48)

### Context.intercept

```ts cordis-catalog
/** Symbol key of the intercept map (see the `Context[symbols.intercept]` property). */
static readonly intercept: unique symbol
```

intercept マップの symbol キー（`Context[symbols.intercept]` プロパティを参照）。

[ソース](../../vendor/cordis/src/context.ts#L50)

### Context.is(value)

```ts cordis-catalog
/**
 * Returns true for Cordis context proxies and context prototypes.
 *
 * Works across realms and across multiple copies of cordis, because the
 * brand is keyed by a global symbol rather than by `instanceof`.
 *
 * @param value — the value to test.
 * @returns `true` if `value` is a Cordis context, narrowing its type.
 */
static is(value: any): value is Context
```

Cordis のコンテキストプロキシとコンテキストプロトタイプに対して true を返す。

ブランドが `instanceof` ではなくグローバル symbol でキー付けされているため、レルムをまたいでも、cordis の複数のコピーをまたいでも動作する。

- `value` — テストする値。

**戻り値** `value` が Cordis コンテキストであれば `true` を返し、その型を絞り込む。

[ソース](../../vendor/cordis/src/context.ts#L61)

## サービスのストアとミックスイン

### ctx.get(name, strict?)

```ts cordis-catalog
/**
 * Read a service from the store without the inject requirement.
 *
 * @param name — the service name.
 * @param strict — when `true` (default), only return implementations
 * whose providing fiber is currently active.
 * @returns the service value, or `undefined` when not (yet) provided.
 */
get<K extends string & keyof this>(name: K, strict?: boolean): undefined | this[K]
get(name: string, strict?: boolean): any
```

inject 要件なしでストアからサービスを読み取る。

- `name` — サービス名。
- `strict` — `true`（既定）の場合、提供元のファイバーが現在アクティブな実装のみを返す。

**戻り値** サービス値、または（まだ）提供されていない場合は `undefined`。

[ソース](../../vendor/cordis/src/reflect.ts#L17)

### ctx.set(name, value)

```ts cordis-catalog
/**
 * Overwrite a provided service's value.
 *
 * Only the fiber that provided the service may set it; setting an
 * unprovided name throws.
 *
 * @param name — the service name.
 * @param value — the new service value.
 */
set<K extends string & keyof this>(name: K, value: undefined | this[K]): void
set(name: string, value: any): void
```

提供済みサービスの値を上書きする。

そのサービスを提供したファイバーのみが設定でき、提供されていない名前を設定すると例外を投げる。

- `name` — サービス名。
- `value` — 新しいサービス値。

[ソース](../../vendor/cordis/src/reflect.ts#L29)

### ctx.provide(name, value)

```ts cordis-catalog
/**
 * Register a service implementation owned by the current fiber.
 *
 * The service becomes visible to dependents in the same isolation scope
 * once the fiber is active; it is unregistered (waking dependents) when
 * the returned disposer runs or the fiber unloads. Throws if the name is
 * already provided in this scope or declared as an accessor.
 *
 * @param name — the service name.
 * @param value — the service value.
 * @returns a disposer that unregisters the service.
 */
provide<K extends string & keyof this>(name: K, value: undefined | this[K]): () => void
provide(name: string, value?: any): () => void
```

現在のファイバーが所有するサービス実装を登録する。

ファイバーがアクティブになると、サービスは同じ隔離スコープの依存側から可視になる。返された disposer が実行されるかファイバーがアンロードされると登録が解除される（依存側を起こす）。このスコープですでに提供されている名前、またはアクセサーとして宣言されている名前を渡すと例外を投げる。

- `name` — サービス名。
- `value` — サービス値。

**戻り値** サービスを登録解除する disposer。

[ソース](../../vendor/cordis/src/reflect.ts#L44)

### ctx.accessor(name, options)

```ts cordis-catalog
/**
 * Define a computed context property backed by get/set hooks.
 *
 * The accessor is removed when the current fiber unloads. Throws if the
 * name is already declared.
 *
 * @param name — the context property name.
 * @param options — the `get` hook and optional `set` hook.
 */
accessor(name: string, options: Omit<Property.Accessor, 'type'>): void
```

get/set フックに支えられた計算済みコンテキストプロパティを定義する。

アクセサーは現在のファイバーがアンロードされると削除される。名前がすでに宣言されている場合は例外を投げる。

- `name` — コンテキストプロパティ名。
- `options` — `get` フックと任意の `set` フック。

[ソース](../../vendor/cordis/src/reflect.ts#L56)

### ctx.mixin(name, mixins)

```ts cordis-catalog
/**
 * Expose selected members of a service directly on `ctx`.
 *
 * Each mixed-in key becomes an accessor that forwards to the service
 * (binding methods to it), so e.g. `ctx.on` forwards to `ctx.events.on`.
 * Mixins are removed when the current fiber unloads.
 *
 * @param name — the context property holding the source service.
 * @param mixins — keys to forward, or a source-key → ctx-key map.
 */
mixin<K extends string & keyof this>(name: K, mixins: (keyof this & keyof this[K])[] | Dict<string>): void
mixin<T extends {}>(source: T, mixins: (keyof this & keyof T)[] | Dict<string>): void
```

サービスの選択されたメンバーを `ctx` に直接公開する。

ミックスインされた各キーはサービスへ転送するアクセサーになる（メソッドはサービスにバインドされる）。たとえば `ctx.on` は `ctx.events.on` へ転送する。ミックスインは現在のファイバーがアンロードされると削除される。

- `name` — ソースサービスを保持するコンテキストプロパティ。
- `mixins` — 転送するキー、またはソースキー → ctx キーのマップ。

[ソース](../../vendor/cordis/src/reflect.ts#L67)
