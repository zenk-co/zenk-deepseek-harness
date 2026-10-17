# ストレージ

日本語 | [English](storage.en.md) | [中文](storage.zh.md)

ストレージサブシステムは、セッションイベントログ以外のすべてを永続化する（セッションログには独自のシームがある — [persistence.md](persistence.md)）。これは 1 つのオプションのケイパビリティであり、エージェントループの背骨の一部ではなく、[ケイパビリティシーム](../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.md)として分割される: ハブとサービス定義（[dsh-storage](../../packages/storage/storage)、`ctx.storage`）、サービスプロバイダー（`json` として登録される [dsh-storage-json](../../packages/storage/storage-json) と `sqlite` として登録される [dsh-storage-sqlite](../../packages/storage/storage-sqlite)）、およびコンシューマー向けデータ形式（[dsh-storage-domain](../../packages/storage/storage-domain)、`ctx.storageDomain`、`ctx.storage.domain` としても到達可能） — バックエンド契約の唯一のコンシューマーであり、他のすべてが使う型付き API である。ハブ自身は IO を行わない: バックエンドが媒体を所有し、データ形式が意味論を所有し、製品パッケージがバックエンドに直接触れることはない。設計記録: [ドメイン KV ストレージの Agent Note](../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.md)。

Source: [`packages/storage/storage/src/backend.ts`](../../packages/storage/storage/src/backend.ts) · [`packages/storage/storage-domain/src/spec.ts`](../../packages/storage/storage-domain/src/spec.ts) · [`packages/storage/storage-domain/src/events.ts`](../../packages/storage/storage-domain/src/events.ts)

## ハブ: `ctx.storage`

`Storage`（[シグネチャー](#ctxstorage--storage)）はストアではなく合流点である。`ctx.storage.backend` は名前 → バックエンドのテーブルである: 複数のバックエンドが並んでマウントされたままで、どのバックエンドがどのコンシューマーに提供するかはそのコンシューマーの構成（ドメイン層のルートテーブル）であり、ハブ全体の選択にはならない。`register(name, backend)` はディスポーザーを返し、重複した名前と未知のルックアップは `StorageError` を投げる。破棄は名前の登録解除のみを行い、所有プラグインが登録解除後にバックエンドを閉じる。各バックエンドプラグインはライフサイクル専用のサービスキー（`storageBackendServiceKey(name)`）も公開し、形式プロバイダーはそれを inject することでアクティベーションがバックエンド登録と競合しないようにする。

データ形式はマージ拡張可能なキーマップのもとでハブにマウントされる:

```ts type-equiv
/**
 * Data forms mountable on the hub, keyed by form name. Form owners extend
 * this map via declaration merging (the domain layer merges
 * `domain: DomainFacility`) and mount the facility in their `apply`.
 */
interface StorageForms {}
```

`mount(form, facility)` はディスポーザーがアンマウントするエフェクトである。同じキーの 2 回目のマウントは `duplicate-mount` を投げる。`form(form)` はマウントされたファシリティを解決し、所有プラグインがロードされるまで `form-not-mounted` を投げる — アセンブリは暗黙に先送りするのではなく、それに合わせてプラグインを順序付ける。ドメイン層は `domain: DomainFacility` をマージするため、`ctx.storage.domain` と `ctx.storageDomain` は同じオブジェクトである。

## バックエンド契約

```ts type-equiv
/**
 * One registered backend. A backend owns exactly one medium and shares its
 * lifecycle across all facets; facets are optional members — a backend that
 * cannot serve a data kind simply omits it, and resolution fails loud instead.
 */
interface StorageBackend {
  /** Key-value operations; absent when this backend cannot serve them. */
  readonly kv?: KvFacet

  /**
   * Drain in-flight writes across all open units and release the medium.
   * Idempotent; concurrent and repeated calls resolve once teardown finishes.
   * @returns resolution after the medium is released.
   */
  close(): Promise<void>
}
```

バックエンドは 1 つの媒体（ファイルツリーのルート、データベースファイル）を所有し、省略可能な操作グループを公開する。`kv` が唯一同梱されるグループである。`KvFacet.open(descriptor)` は 1 つの名前付きユニットを開く — `KvUnitDescriptor` は名前、現在の形式バージョン、省略可能な互換レコードバージョン、テーブル名、グローバルシングルトンスロットの有無を運ぶ — そして `loadAll`、`putRecord`、`deleteRecord`、`setGlobal`、`close` を持つ `KvUnit` を返す。ユニット名とテーブル名は `UNIT_NAME_RE` に一致しなければならない（ファイル名としても SQL 識別子セグメントとしても安全）。レコードキーは任意の文字列で、ファイルパスに達することはない。ユニットは同時書き込みを直列化しない — 順序は呼び出し元に属する — が、個々の呼び出しは媒体上でアトミックであり、解決された時点で耐久である。異なるバージョンが刻印された `single` 媒体は `version-mismatch` を拒否し、受け入れセット外のバージョンが刻印された `per-record` ドキュメントは存在しないものとして読まれる。ユニットとしてパースできない媒体は `malformed-medium` を拒否する。[`backend.ts`](../../packages/storage/storage/src/backend.ts) が条項ごとの規範的契約であり、[`tests/contract.ts`](../../packages/storage/storage/tests/contract.ts) の共有適合性スイートがすべての条項を各バックエンドに対して検査する。[json バックエンド](../../packages/storage/storage-json/README.md)はユニットごとに人間が読めるファイル 1 つを全体としてアトミックに再公開し、[sqlite バックエンド](../../packages/storage/storage-sqlite/README.md)は頻繁に更新されるデータのために 1 つのデータベースの行ごとに 1 ドキュメントを保存する。

## ドメインの宣言

ドメインは所有パッケージによって spec オブジェクトとして 1 回宣言される — ドメインのアイデンティティ、レイアウト、レコードスキーマの唯一の情報源である（zod なので `z.infer` がコンシューマー型を重複させずに保つ）:

```ts type-equiv
/** Static declaration of one domain: identity, version, and record layout. */
interface DomainSpec {
  /** Domain name; must match `UNIT_NAME_RE` (doubles as the backend unit name). */
  readonly name: string
  /** Current domain format version; reads enforce it according to the selected layout. */
  readonly version: number
  /**
   * Medium layout for the backend unit: `single` (the default) stores the
   * whole unit as one document; `per-record` stores each record as its own
   * document, for units whose records are large, sparse, or individually
   * disposable — the projection cache — and scopes version checks per record
   * (an unaccepted record document is discarded, never migrated).
   */
  readonly layout?: 'single' | 'per-record'
  /**
   * Older domain versions whose stored records the current record schemas
   * also accept (the declaring owner vouches for that, typically by
   * declaring the fields older records lack as optional). `per-record` backends
   * read documents stamped with a listed version instead of discarding them,
   * and accept a legacy whole-unit file so stamped for the one-time
   * bootstrap; writes always stamp {@link version}.
   */
  readonly compatibleVersions?: readonly number[]
  /**
   * What `open` does with a stored table record that fails its zod schema.
   * Absent (the default), the whole open rejects with `invalid-record` —
   * right for authoritative data. `'backup-and-skip'` is for domains whose
   * records are disposable derived data: the backend moves the record's
   * document aside (`KvUnit.backupRecord`), the failure is logged with
   * its cause, and the open continues with the record absent. A backend
   * without `backupRecord` (no per-record document to move) falls back
   * to the rejecting default. The global slot always rejects.
   */
  readonly invalidRecords?: 'backup-and-skip'
  /** Optional global singleton slot. */
  readonly global?: DomainGlobalSpec<unknown>
  /** Table declarations keyed by table name; each name must match `UNIT_NAME_RE`. */
  readonly tables: Record<string, DomainTableSpec>
}
```

`defineDomain(spec)` は spec のリテラル型を固定し、どの媒体に触れるよりも前に所有側のモジュールロード時に大きな音を立てて失敗する: `UNIT_NAME_RE` 外のドメイン名やテーブル名、非負整数でないバージョン、`null` を受け入れるグローバルスキーマはすべて throw する（`null` は媒体の「未書き込み」センチネルであるため、保存された nullable グローバルはラウンドトリップできない）。`domainTable<K, V>(schema)` は 1 つのテーブルをファントムのコンパイル時キー型（通常は[ブランド付き id](core.md#branded-ids)）付きで宣言し、`descriptorOf(spec)` はバックエンドに面するユニット記述子を射影する。

## 開かれたドメイン

```ts type-equiv
/** One open domain, typed by its spec. */
interface Domain<S extends DomainSpec> {
  /** Domain name from the spec. */
  readonly name: string
  /** Global singleton handle; a spec without `global` has no usable handle (`never`). */
  readonly global: DomainGlobalHandleOf<S>
  /**
   * Resolve one declared table handle. Handles are stable — repeated calls
   * return the same instance.
   * @param name - Declared table name.
   * @returns the typed table handle.
   */
  table<N extends keyof S['tables'] & string>(name: N): KvTable<TableKeyOf<S, N>, TableValueOf<S, N>>

  /**
   * Close this domain: reject new writes immediately, drain already-queued
   * writes (their events still emit), release the backend unit, then free
   * the domain name for a later open. Idempotent — repeated calls share one
   * teardown. The consumer owns this call (typically as its own `ctx.effect`
   * disposer); the facility closes any domain left open when it unmounts.
   * @returns resolution after the unit is released.
   */
  close(): Promise<void>
}
```

読み取りは権威あるインメモリ状態から同期的に行われる: `KvTable` は `get`/`entries`/`keys`/`size` を公開し（キューされた書き込みが着地する間も安定したスナップショットイテレーター）、グローバルハンドルの `get()` は、最初の `set` が媒体上でスロットを実体化するまで spec の `initial` を提供する。すべての書き込み — `put`、`delete`、`update`、`global.set` — はドメインごとの 1 本のチェーンにキューされ、まずバックエンドの耐久性に達し、次にメモリを変更し、次に `domain/changed` を発火する。拒否されたバックエンド書き込みはメモリを触らないため、読み取りが媒体から乖離することはない。`update(key, fn)` はチェーンスロットでのアトミックな読み取り-変更-書き込みである（欠けているキーは `missing-key` を拒否する）。存在しないキーの `delete` は書き込みもイベントもなく `false` に解決する。返されるレコードはコピーではなく保存されたオブジェクトそのものである — `put`/`update` で置き換え、その場での変更は決してしないこと。

## ドメインファシリティ: `ctx.storageDomain`

`DomainFacility`（[シグネチャー](#ctxstoragedomain--domainfacility)）はルーティングされたバックエンド上で宣言済みドメインを開く。ルーティングはドメインプラグインの構成であり、決してハブのものではない: `backend` は必須の既定ルートを名指しし、`routes` はドメイン名ごとにそれを上書きする。`open(spec)` は厳密な順序で実行され、各ステップが呼び出し全体を失敗させる: すでに開いているか閉じ中の名前を拒否し（`already-open`）、ルートを解決し（`backend-not-found`）、バックエンドの `kv` ファセットを要求し（`facet-unsupported`）、ユニットを開き（バックエンドの `version-mismatch`/`malformed-medium` はそのまま通る）、すべての保存済みレコードとグローバルを spec の zod スキーマに対して検証する（違反したテーブルとキー付きの `invalid-record`）。呼び出し元が返されたハンドルを所有し、`Domain.close()` で解放する。プラグインのアンマウント時にまだ開いているドメインはファシリティが閉じ、閉じられたドメインの名前はティアダウンが完全に完了した後にのみ再オープンのために解放される。`get(name)` は、すべての型付きハンドルの背後にあるパッケージプライベートな `DomainImpl` ランタイムへの型なしの診断ルックアップであり、`closeAll()` はアンマウント経路である。

## 変更イベント: `domain/changed`

すべての耐久書き込みは、バックエンドが耐久性を確認した厳密に後に、ドメインの書き込みチェーン順で 1 つのイベントを発火する（[イベント項目](#domainchanged--emit)）:

```ts type-equiv
/** Shared location fields of one durable domain change. */
interface DomainChangedBase {
  /** Owning domain name. */
  readonly domain: string
  /** Table name; `''` for a global-singleton write. */
  readonly table: string
  /** Record key; `''` for a global-singleton write. */
  readonly key: string
}
```

```ts type-equiv
/** One durable domain change; a closed union — switch on `operation`. */
type DomainChanged = DomainChangedPut | DomainChangedDeleted
```

`put`（挿入、上書き、グローバル書き込み）は新しいスナップショットを `value` に運ぶ — 古い値は決して運ばない。差分を取るコンシューマーは自身の前回スナップショットを保つ。`deleted` は値のないトゥームストーンである。イベントは通知であり、トランザクションの参加者ではない: 発火時点でコミットポイントは過ぎているため、同期的に throw するリスナーは、すでに耐久な書き込みを拒否するのではなく、記録された警告付きで封じ込められる。発火される値は発火時点のインメモリ状態に等しい。イベントはプロセス内のみであり、プロセス間の変更プッシュは記録された制限である（[パッケージ README](../../packages/storage/storage-domain/README.md)）。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される（doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。`pnpm run gen-cordis-catalog` で再生成）。言語版はロケール固有の対訳ドキュメントパスだけが異なる。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxstorage--storage"></a>

### `ctx.storage` — `Storage`

ストレージハブサービス。バックエンドは `backend` の下に登録され、データ形式は `StorageForms` キーの下にマウントされ、`ctx.storage.<form>` として到達される。

```ts cordis-catalog
/**
 * Mount a data-form facility on the hub. Mounting is an effect: the
 * returned disposer unmounts the form.
 * @param form - Form key declared in {@link StorageForms}.
 * @param facility - The facility instance to expose.
 * @returns the disposer that unmounts the form.
 */
mount<K extends keyof StorageForms>(form: K, facility: StorageForms[K]): () => void

/**
 * Resolve a mounted data form.
 * @param form - Form key declared in {@link StorageForms}.
 * @returns the mounted facility.
 */
form<K extends keyof StorageForms>(form: K): StorageForms[K]
```

Source: [`packages/storage/storage/src/index.ts`](../../packages/storage/storage/src/index.ts)

<a id="ctxstoragedomain--domainfacility"></a>

### `ctx.storageDomain` — `DomainFacility`

マウントされたドメインファシリティ。ルーティングされたバックエンド上で宣言済みドメインを開く。1 つのファシリティインスタンスがオープンドメインテーブルを所有し、ドメイン名ごとの単一オープンを強制する。

```ts cordis-catalog
/**
 * Open one declared domain. Steps, each failing the whole call: reject a
 * name that is already open (`already-open`); resolve the backend route
 * (`backend-not-found` passes through from the hub); require its `kv` facet
 * (`facet-unsupported`); open the unit projected from the spec (backend
 * `version-mismatch`/`malformed-medium` pass through); load and validate
 * every stored record against the spec's zod schemas (`invalid-record`
 * with the offending table and key — unless the spec declares
 * `invalidRecords: 'backup-and-skip'` and the unit can move documents aside, in
 * which case the failing record is backed up, logged, and skipped);
 * construct the domain.
 *
 * Lifecycle: the CALLER owns the returned handle and closes it via
 * `Domain.close()` (typically as its own `ctx.effect` disposer) — the
 * facility does not tie the domain to any consumer fiber. Domains still
 * open when the facility unmounts are closed by the plugin disposer.
 * @param spec - The domain declaration, typically from `defineDomain`.
 * @returns the opened domain handle, typed by the spec.
 */
async open<S extends DomainSpec>(spec: S): Promise<Domain<S>>

/**
 * Look up an open domain by name, untyped. Diagnostic surface; typed
 * consumers hold the handle returned by {@link open}.
 * @param name - Domain name.
 * @returns the open domain runtime, or `undefined` when not open.
 */
get(name: string): DomainImpl | undefined

/**
 * Close every domain still open on this facility. The unmount path for
 * consumers that never called `Domain.close()` themselves; closing is
 * idempotent, so double-closing an already-closed domain is harmless.
 * @returns resolution after every unit is released.
 */
async closeAll(): Promise<void>
```

Source: [`packages/storage/storage-domain/src/index.ts`](../../packages/storage/storage-domain/src/index.ts)

<a id="domain-events"></a>

### `domain/*` イベント

<a id="domainchanged--emit"></a>

#### `domain/changed` — emit

ドメインレコードまたはグローバルシングルトンが変更された。書き込みごとに 1 回、バックエンドが耐久性を確認した厳密に後に発火される。1 つのドメインのイベントはその書き込みチェーン順に到着する。

```ts cordis-catalog
/**
 * A domain record or the global singleton changed, emitted once per write
 * strictly after the backend acknowledged durability. Events of one
 * domain arrive in its write-chain order.
 * @param change - domain, table (`''` for global), key (`''` for global),
 * operation discriminant, and on `put` the new snapshot.
 * @mode emit
 */
'domain/changed'(change: DomainChanged): void
```

Source: [`packages/storage/storage-domain/src/events.ts`](../../packages/storage/storage-domain/src/events.ts)
<!-- END GENERATED cordis-surface -->
