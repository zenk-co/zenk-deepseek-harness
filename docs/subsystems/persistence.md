# セッション永続化

日本語 | [English](persistence.en.md) | [中文](persistence.zh.md)

イベントログのための**耐久性シーム**。[session.md](session.md) は、信頼できる唯一の情報源である追記専用の `SessionEvent` ログ、すなわちインメモリの `Session` について説明している。本ページでは、そのログをどのように永続化するかを説明する: 抽象的な `SessionPersistence` サービス、そのプロバイダーモデルと同梱の JSONL バックエンド、フラッシュチェックポイント、クラッシュ復旧、そしてログと併走するメタデータヘッダーである。ログが運ぶイベント語彙は、生成された[永続化ログイベントカタログ](../persistence-catalog.md)にメンバーごとに列挙されている。

このシームは[ケイパビリティシーム](../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.md)である。単一の抽象サービス（[dsh-session-persistence](../../packages/session/session-persistence)、`ctx.sessionPersistence`）が、既存の `SessionEvent` の上で `create`/`open`/`stat`/`list` を公開し（**並行する永続化イベント型は存在しない**）、`create` と `open` はセッションごとの `SessionHandle`（`read`/`append`/`flush`/`close`）を返す。このハンドルがすべてのログアクセスと単一ライター所有権を担う。リポジトリは [dsh-session-persistence-jsonl](../../packages/session/session-persistence-jsonl) をプロバイダーとして同梱する。ツリー外のプロバイダーが同じサービス契約を実装してもよい。[ハンドルベース永続化の Agent Note](../../.agents/notes/implemented/architecture/2026-08-27-handle-based-session-persistence.md)と [session-persistence リファレンス](../../packages/session/session-persistence/README.md)を参照。

## `SessionHandle` — 保存済みセッションへの 1 本の開かれたチャネル

すべてのログ読み書きはハンドルを通じて流れ、id でアドレス指定されるサービスのメソッドを経由することは決してない。ハンドルは、プロセス間の書き込みリースが守る唯一の入口である。読み取りは、呼び出し側が所有する外側のスライスと、プロデューサーが確立したイベント値のエイリアシング状態を返す。1 つのハンドル型が両方のアクセスに使われる — `read` ハンドルに対する変更は、型による分割ではなく実行時の `SessionReadOnlyError` になる — また、プロセス内の単一ライター所有権により、所有者がアクティブな間の 2 回目の `open(id, 'write')` は `SessionAlreadyOwnedError` で拒否される。

```ts type-equiv
/** One persistence event slice returned by {@link SessionHandle.read}. */
interface SessionHandleReadResult {
  /**
   * Whether event values are exclusively owned or shared only after deep
   * freezing. Slicing preserves the producer's state even when no events remain.
   */
  readonly eventState: SessionSeedEventState
  /** Event values in a caller-owned outer array. */
  readonly events: readonly SessionEvent[]
}
```

```ts type-equiv
/**
 * One open channel onto a stored session. A handle is single-owner state, not
 * a shared service: `read` never backtracks below what this handle already
 * observed, a `write` handle reads its own successful appends, and `close()`
 * is the one teardown (idempotent, uncancellable; `Symbol.asyncDispose`
 * delegates to it). Every operation on a closed handle rejects with
 * `SessionHandleClosedError`.
 *
 * Freshness across handles: once an `append` or `flush` resolves on a write
 * handle, every read STARTED afterwards on the same backend instance — on any
 * handle, or through `stat`/`list` — observes at least that prefix.
 * Reads concurrent with a mutation carry no ordering promise beyond the valid
 * contiguous prefix.
 */
interface SessionHandle extends AsyncDisposable {
  /** The stored session this handle addresses. */
  readonly id: SessionId
  /** The immutable stored header, fixed at `create`/`open`. */
  readonly header: SessionHeader
  /**
   * Exact fork-inherited prefix length stored with the log; `0` when
   * `header.isSeeded` is false. Storage metadata paired with the header for
   * every body read, never part of the replayable event log.
   */
  readonly inheritedEventCount: SessionLogOffset
  /** Whether this handle may mutate the log. */
  readonly access: SessionAccess

  /**
   * Read a slice of the valid contiguous logical log. The slice is a legal log
   * prefix segment: a torn physical tail is never returned, and repeated reads
   * on this handle never observe an older state than a prior read.
   * @param offset - first logical event seq to include; defaults to `0`.
   * @param length - maximum number of events to return; defaults to the rest
   *   of the log. An offset at or past the end returns an empty list.
   * @param options - optional cancellation.
   * @returns the caller-owned outer slice plus the ownership state of its event values.
   */
  read(offset?: number, length?: number, options?: SessionHandleReadOptions): Promise<SessionHandleReadResult>

  /**
   * Append a contiguous batch continuing the current logical end. The first
   * event's `seq` MUST equal the stored next-seq; committed events are never
   * rewritten. Persistence is best-effort: on resolution the batch is
   * accepted, ordered, and visible to reads on this backend instance, but
   * only a resolved {@link flush} promises it survives a crash — a backend
   * may buffer or batch physical writes behind append. Rejects with
   * `SessionReadOnlyError` on a read handle and `SessionOwnershipLostError`
   * when write ownership is gone.
   * @param events - the contiguous batch, in seq order.
   * @param options - optional cancellation observed before the write starts.
   */
  append(events: readonly SessionEvent[], options?: SessionHandleAppendOptions): Promise<void>

  /**
   * The durability barrier — the one operation that promises storage: on
   * resolution every acknowledged append is durable and the session is
   * materialized for other processes; an empty created session becomes
   * durably listable here. Callers that must survive a crash flush; a backend
   * whose `append` already persists on resolution treats this as
   * materialize-if-needed. Rejects with `SessionReadOnlyError` on a read
   * handle.
   * @param options - optional cancellation observed before the barrier starts.
   */
  flush(options?: SessionHandleFlushOptions): Promise<void>

  /**
   * Release the handle: a read handle frees local resources; a write handle
   * completes pending durability and releases write ownership. Idempotent,
   * asynchronous, and deliberately not cancellable.
   */
  close(): Promise<void>
}
```

作成されたセッションは `create` が解決した瞬間からこのプロセス内で観測可能である。一方、バックエンドは物理的な実体化（純粋な最適化）を最初の `append` または `flush` まで遅延させてもよい。他のプロセスには実体化済みのセッションだけが見え、クラッシュ前に実体化されなかったセッションは存在しなかったことになる。

## フラッシュチェックポイント

`session/event` は*同期*通知である。マウントされたバックエンドは、プロデューサーをブロックすることなく、セッション id でそれをアクティブな書き込みハンドルの有界なライトビハインドウィンドウへルーティングする（バックエンドはこれらのリスナーを一度だけ設置する。永続化がすでに id ごとに 1 つのアクティブな書き込みハンドルを強制しているためである）。最初の保留イベントが固定の内部バッチウィンドウを開始し、後続のイベントはその期限をリセットせずに加わる。期限切れになると、セッションの書き込みハンドルを通じて 1 回の永続的な `append` が開始され、その書き込み中に受け入れられたイベントは独自の期限を受け取って後続バッチを形成する。`session/flush` は待機をキャンセルし、静止状態までドレインする。そのためループは今も、次の通常ターンを取得する前の順序とエラー観測のチェックポイントとしてこれを使う。拒否されたバックグラウンド書き込みはイベントを順序どおり保持し、自動経路を一時停止し、ロガーを通じて報告される。次の明示的なフラッシュが再試行し、呼び出し元に明示的に拒否を返す。`session/disposed` は同じ最終ドレインを実行してハンドルを閉じ、`close()` 自体もルーティング済みバッファをまだ開いているストレージを通じてドレインするので、バックエンド破棄時のクローズスイープが何かを失うことはない。このウィンドウが制限するのは意図的なバッチ待機だけであり、イベントループのスケジューリングやバックエンドの耐久性レイテンシーではない。

## クラッシュ復旧は中断されたターンを保持する

ターンの途中でクラッシュしたログは、開いたままの `turn/start` を持ち `turn/end` を持たない状態で終わる。永続化はそれを切り詰めたり修復したり**しない** — 長期的なタスクでは 1 つのターンが巨大になり得る（多数のステップ、大きなツール出力）が、それらのイベントはクラッシュ前に永続的に追記済みである。永続化は物理的に有効な連続ログを返す。破棄されるのは、解決されなかった append に属する破断した物理テールの不完全な断片だけであり、そこから回収された完全なレコード（JSONL バックエンドは破断した Zstandard フレームを部分的にデコードする）は、ハンドルの最初の新しい append の前に書き込み経路によって永続的に書き直される。修復はリーダーの仕事である。レジューム（agent-loop）は書き込みハンドルを通じて保存済みログを読み、`interruptedTurnClosers` — 欠落したツールエラー、開いているすべての `step/end`、および合成の `turn/end { reason: { kind: 'interrupted' } }` — を計算し、Session を公開する前に、通常のバッチとして同じハンドルを通じてそれらを追記する。`interrupted` はどのループも発行しない唯一の `TurnEndReason` である（[session.md](session.md#why-a-turn-ended-turnendreasonmap) を参照）。

したがって修復は書き込み所有権の下でのみ書き込む。ライブセッションの書き込みハンドルはそのライフサイクル所有者が保持しているので、並行する `open(id, 'write')` は、修復をライブのターンと競合させる代わりに `SessionAlreadyOwnedError` で拒否される。読み取り専用のオブザーバー（session-query）は、中断されたコールドログを同じクローザーでメモリ内のみで釣り合わせ、何も書き戻さない。

読み取り専用の観測は `open(id, 'read')` である。ハンドルは検証済みの連続したプレフィックススライスを提供し、破断したテールを決して返さない。また 1 つのハンドル上の繰り返し読み取りは、以前の読み取りより古い状態を決して観測しない。永続化側に prepared-Session キャッシュは存在しない。session-query が自身のコールドリードキャッシュを所有し、id ごとに 1 つの釣り合ったコールド Session を `stat().revision` 変更トークンに紐づけ、トークンが変わったときだけ読み直す。[ハンドルベース永続化の Agent Note](../../.agents/notes/implemented/architecture/2026-08-27-handle-based-session-persistence.md)がこのライフサイクルを所有し、アーカイブ済みの [Session 準備の記録](../../.agents/notes/archived/architecture/2026-08-05-session-preparation.md)が、当初の公開境界 `SessionPreparation` の決定を記録している。

## `SessionLocation` — 拒否診断のアーティファクトターゲット

`SessionLocation` はコンシューマー向けのクエリではない。ログアクセスはセッションハンドルの `read` を通じて行われる。これは拒否診断としてのみ存続し、`SessionFormatUnsupportedError` が、あるビルドが解釈を拒否した生のログを名指しできるようにする。JSONL はプロジェクト/セッションディレクトリ内のトランスクリプトの絶対パスを提供する。セッションごとに 1 つのアーティファクトを持たないバックエンドは何も提供しない。

```ts type-equiv
/**
 * A backend-resolved, per-session local artifact location. Carried only by
 * refusal diagnostics ({@link SessionFormatUnsupportedError}) so a user can
 * find the raw log a build refused to interpret; it is not a consumer-facing
 * query — log access goes through a session handle's `read`.
 */
interface SessionLocation {
  /** Backend-specific artifact kind, for example `jsonl`. */
  readonly kind: string
  /** Absolute path to this session's backend-owned artifact. */
  readonly path: string
}
```

<a id="sessionheader--metadata-beside-the-log"></a>

## `SessionHeader` — ログの傍らのメタデータ

セッションごとのメタデータはイベントログとは**別個に**格納される。ヘッダーはフォーマットバージョン、cwd、`isSeeded` 系統ビットを運び、本体を持つストレージ値はその傍らに正確な継承カットを運ぶ。どちらも `SessionEventMap` に属さず、`deriveMessages()` に到達しない。論理ヘッダーは `session.header` を通じて付与され、Session はそのカットを `inheritedEventCount` として公開する。

ソース: [`packages/core/session/src/types.ts`](../../packages/core/session/src/types.ts)

```ts type-equiv
/**
 * Immutable validated storage metadata, kept outside the conversation event log.
 */
interface SessionHeader {
  /**
   * Current logical format version, stamped from {@link SESSION_FORMAT_VERSION}.
   * Historical physical headers are translated before entering this interface.
   */
  readonly version: typeof SESSION_FORMAT_VERSION
  /** The session's id (mirrors the {@link Session}'s id). */
  readonly id: SessionId
  /** Non-negative safe-integer Unix epoch milliseconds when the session was created. */
  readonly createdAt: number
  /** Absolute working directory the session was created in (if any). */
  readonly cwd?: string
  /** The session this one was forked from (seed lineage), if any. */
  readonly parentSession?: SessionId
  /**
   * Whether this Session contains a fork-inherited event prefix. The exact prefix
   * length is Session state rather than ordinary header metadata.
   */
  readonly isSeeded: boolean
  /**
   * Coarse product classification for a session created as a subagent child.
   * This is presentation metadata, not proof that the child is continuable.
   */
  readonly origin?: 'subagent'
  /**
   * Delegation depth: absent (zero) for a top-level session, parent depth + 1
   * for a subagent child. Persisted so a recursion budget survives restart and
   * resume — a runtime-only depth would reset a resumed child to top-level.
   */
  readonly delegationDepth?: number
  /**
   * Id of the agent preset this session's agent was composed from, when the
   * deployment composes per session. Durable because the preset decides the
   * session's tools and prompt: a resume that restored a different composition
   * would replay history the model can no longer act on.
   */
  readonly agentPreset?: string
}
```

## フォーマット拒否 — あるビルドが忠実に読み取れないログ

バックエンドは、忠実に解釈できないログを `SessionFormatUnsupportedError` で拒否する。何も破損していないため、これは `SessionPersistenceCorruptionError` とは区別される。`stat` と `list` は最も高い正規世代を分類し、サポートされる歴史的ヘッダーを、その本体を読んだり変更したりせずに変換する。歴史的な `open` 呼び出しは、セッションごとの単一の移行準備を共有してから現行の論理値を返し、すべてのソースパス、バイト、inode を変更しない。JSONL プロバイダーはそのインメモリ結果から読み取りハンドルを返し、公開は行わない。書き込み open は、単一ライターのクレームとファイルリースを保持したままその準備を再利用し、最終的な現行世代を排他的に公開してから、書き込み可能なハンドルを返す。将来の最も高い世代は、古い読み取り可能な世代が残っていても拒否する。現行フォーマットの復元では、インストール済み拡張と `ignorable: true` を持つ未知のイベントが保持される。歴史的な v0/v1/v2 移行は、無視可能とマークされていても未知の型を拒否する。このメッセージは、バックエンドがセッションごとに 1 つのアーティファクトを保持している場合、選択された生のログパスを追記する。ツリー外のバックエンドは、その物理フォーマットのエントリーで、同等の現行のみのハンドル値と方向を考慮した拒否を強制しなければならない。[リリース済みフォーマット移行の決定](../../.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.md)が、この連鎖と不変公開のルールを所有する。

## `CreateSessionOptions` — シードとメタデータ

ストアを通じて `Session` を作成するときは、`seed`（初期リプレイまたはフォーク履歴）、任意の正確な `inheritedEventCount`、および `meta`（ストアが `SessionHeader` に畳み込むストレージレベルのフィールド）を取る。ストアは `version`/`id` を埋めて `createdAt` をデフォルト化する。呼び出し側は、検証済みの絶対 `cwd`、`parentSession` 系統、`isSeeded` 系統ビット、任意の粗い `origin`、`delegationDepth`、`agentPreset`、および既存の `createdAt` を指定できる。シード付き作成には、継承プレフィックスに等しい明示的なシードと正確なカットが必要である。コンストラクターは、セットアップが子所有のイベントを追加する前に、そのカットに子所有のタグ付きエンドシードマーカーを追記する。`origin: 'subagent'` は、製品のナビゲーションが重複する子行を隠せるようにするが、記述子が有効であることや子がレジュームできることを証明するものではない。

```ts type-equiv
/**
 * Options for creating a {@link Session} via the store. `seed` replays/forks
 * an existing event log; `meta` carries the caller-supplied storage fields the
 * store folds into a {@link SessionHeader}.
 */
interface CreateSessionOptions {
  /** Initial replay or fork history supplied at construction. */
  readonly seed?: readonly SessionEvent[]
  /**
   * Exact fork-inherited prefix length when `meta.isSeeded` is true. The
   * constructor appends the child-owned tagged marker at the cut unless
   * the seed already includes it followed by child-owned fork closers.
   */
  readonly inheritedEventCount?: SessionLogOffset
  /**
   * Storage metadata read once before publication. `isSeeded` marks fork
   * lineage; supplying replay history alone does not make it inherited.
   */
  readonly meta?: {
    readonly cwd?: string
    readonly parentSession?: SessionId
    readonly createdAt?: number
    readonly isSeeded?: boolean
    readonly origin?: 'subagent'
    readonly delegationDepth?: number
    readonly agentPreset?: string
  }
}
```

したがってリプレイ/フォークは `ctx.agents.create({ sessionId, seed, meta })` である — フォークはさらに `meta.isSeeded: true` とともに `inheritedEventCount` を渡す — そして永続化されるのは agent-loop が公開したセッションだけであり、ループは公開前に新しいセッションの書き込みハンドルを通じてシードを格納する。*永続化済み*のセッションをライブエージェントへレジュームするのは `ctx.agents.resume({ resumeSessionId })` である。

## 準備と復元の所有権

`SessionStore.prepare()` は、通常の作成オプションまたは `RestoredSessionOptions` を通じた採用可能なシードを受け入れる。その `eventState` は、イベント値が独立して所有されているのか、深い凍結の後にのみ共有されるのかを表す。この状態を確立するのはプロデューサーであり、スライスは結果の長さから別の状態を推測しない。復元は、別のコピーや凍結パスなしでそれらの値を検証して採用する。その後 `SessionPreparation` が、公開またはロールバックまで、その未公開の Session を正確に所有する。破棄は同期的かつ冪等である。agent-loop のレジュームは、セッションの書き込みハンドルを通じてこの結果を読み、準備の前に独立して所有される `interruptedTurnClosers` を追記する。

```ts type-equiv
/**
 * Aliasing state of an adoptable Session seed. `shared-frozen` permits deeply
 * frozen aliases plus independently owned unfrozen values in the same seed.
 */
type SessionSeedEventState = 'detached' | 'shared-frozen'
```

```ts type-equiv
/**
 * Adoptable storage values transferred to {@link SessionStore.prepare}
 * without another copy or freeze pass.
 */
interface RestoredSessionOptions {
  /** Events that are independently owned or already deeply frozen. */
  readonly seed: SessionEvent[]
  /** Independently owned storage metadata to validate and freeze in place. */
  readonly meta: SessionHeader
  /** Exact number of fork-inherited leading events decoded from storage. */
  readonly inheritedEventCount: SessionLogOffset
  /** Aliasing state carried from the operation that produced the seed. */
  readonly eventState: SessionSeedEventState
}
```

```ts type-equiv
/** Inputs accepted while constructing an unpublished Session. */
type PrepareSessionOptions =
  | (CreateSessionOptions & { readonly eventState?: undefined })
  | RestoredSessionOptions
```

```ts type-equiv
/** Options for a preparation whose provider retains unpublished state. */
interface SessionPreparationOptions {
  /** Release provider-owned state when the Session was not published. */
  readonly release?: () => void
}
```

```ts public-api
/**
 * One exact unpublished Session and the provider state that keeps it usable.
 * Disposal is synchronous and idempotent. Providers decide whether release
 * returns the Session to a cache or discards it; publication may consume that
 * state before disposal, making the callback a no-op.
 */
declare class SessionPreparation implements Disposable {
  /** The exact Session to use for setup and publication. */
  readonly session: Session;
  /**
   * Wrap an unpublished Session in one preparation lifetime.
   * @param session - exact unpublished Session.
   * @param options - optional provider release behavior.
   * @returns a preparation disposed after publication or rollback.
   */
  static create(session: Session, options?: SessionPreparationOptions): SessionPreparation;
  /** Release provider state once when this preparation leaves its caller. */
  [Symbol.dispose](): void;
}
```

## 軽量なソースリビジョン

派生読み取りモデルの消費者は、完全なイベントログをロードする前に、安価で不透明なリビジョンを比較する。リビジョンは `stat`/`list` から得られるバックエンドインスタンスごとの変更トークンである。等しいリビジョンは変更されていないログとして扱ってよく、等しくないリビジョンは何も約束しない。また書き込み所有権の入れ替わりがリビジョンを変えることはない。session-query は自身のコールドリードキャッシュをこれに紐づける。このトークンは open、read、レジュームには関与しない。

```ts type-equiv
/**
 * Backend-owned token that identifies both one storage source and one revision
 * of a persisted session log.
 */
type SessionPersistenceRevision = Branded<'SessionPersistenceRevision'>
```

```ts type-equiv
/**
 * Lightweight stored-session observation returned by {@link SessionPersistence.stat}
 * and {@link SessionPersistence.list} without reading the full event log.
 */
interface SessionPersistenceSnapshot {
  /** Detached metadata for one stored session. */
  readonly header: SessionHeader
  /** Header-only format classification; absent without versioned artifact metadata. */
  readonly formatStatus?: 'current' | 'migration-required'
  /** Opaque change token; see {@link SessionPersistence.stat}. */
  readonly revision: SessionPersistenceRevision
  /** Logical event count, when the backend can provide it cheaply from metadata; otherwise absent. */
  readonly eventCount?: number
  /** Physical artifact byte size, when the backend can provide it cheaply (JSONL); otherwise absent. */
  readonly sizeBytes?: number
}
```

任意の `eventCount`/`sizeBytes` フィールドは、それらを明示的に必要とする消費者のための、安価なバックエンド観測値として残る。セッション一覧表示はどちらのフィールドもコールドログを開くのに使わない。ヘッダーと、同一性を検査済みのプロジェクションキャッシュヒントだけを読むので、キャッシュや Session フォーマットのアップグレードが起動を本文スキャンに変えることは決してない。

## バックエンド

同梱のプロバイダーは、抽象 `SessionPersistence` 契約（`create`/`open`/`stat`/`list`、および `read`/`append`/`flush`/`close` を担い全体に任意のキャンセルを備えるセッションごとの `SessionHandle`）を実装し、共有の永続化契約スイートを通過する:

- **[dsh-session-persistence-jsonl](../../packages/session/session-persistence-jsonl)** — セッションごとの追記専用論理 JSONL ログ。デフォルトではチェックサム付きの連結 Zstandard フレームとして、設定により生の行として格納され、クラッシュ安全な原子的実体化、バッチごとの `fsync` 追記、最初の新しい append の前の破断テール切り詰めを備える。`stat`/`list` は `sizeBytes` と、`fs.stat` 由来のベストエフォートのリビジョンを運ぶ。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される（doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。`pnpm run gen-cordis-catalog` で再生成）。言語版はロケール固有の対訳ドキュメントパスだけが異なる。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxsessionpersistence--sessionpersistence-abstract-seam"></a>

### `ctx.sessionPersistence` — `SessionPersistence`（抽象シーム）

セッションごとのハンドルを通じてアドレス指定される、永続的な追記専用セッションストレージ。

すべてのバックエンドが共有するストレージセマンティクス: イベントは seq 0 から連続し、決して書き換えられない。破断した物理テールはリーダーに返されることはなく、書き込み経路が最初の append の前にそれを切り詰める。読み取りは現行フォーマットのレコードのみを検証し、未知の語彙を fail-closed で拒否する。`append` はベストエフォートで永続化し、`flush` — ハンドル単位またはサービス全体 — が耐久性バリアである。

可視性: 作成されたセッションは、`create` が解決した瞬間からこのプロセス内で `stat`/`list`/`open` を通じて観測可能であり、バックエンドが物理的な実体化を遅延させている間もそうである（純粋な最適化）。他のプロセスには、セッションは実体化されて初めて見える。クラッシュ前に実体化されなかったセッションは存在しなかったことになる。`SessionHandle.flush` は実体化を強制する。

鮮度: いったん `append` または `flush` が解決すると、その後このバックエンドインスタンスで開始された読み取りは、少なくともそのプレフィックスを観測する。

```ts cordis-catalog
/**
 * Create a new stored session and take its write ownership.
 * @param header - the immutable header (id, version, cwd, lineage) to store.
 * @param options - optional cancellation.
 * @returns a `write` handle owned by the caller; close it to release ownership.
 * @throws {SessionAlreadyExistsError} when the id already exists.
 */
abstract create(header: SessionHeader, options?: SessionPersistenceCreateOptions): Promise<SessionHandle>

/**
 * Open an existing stored session.
 *
 * `read` never takes ownership and works while another handle (or process)
 * holds write ownership. `write` atomically claims single-writer ownership;
 * an existing active owner rejects.
 * @param id - the stored session to open.
 * @param access - `read` or `write`.
 * @param options - optional cancellation.
 * @returns the open handle.
 * @throws {SessionPersistenceNotFoundError} when the session does not exist.
 * @throws {SessionAlreadyOwnedError} for `write` when ownership is taken.
 */
abstract open(id: SessionId, access: SessionAccess, options?: SessionPersistenceOpenOptions): Promise<SessionHandle>

/**
 * Flush every active write handle owned by this service instance in one
 * durability barrier: each handle's routed live events drain durably and
 * its session materializes, exactly as that handle's own
 * `SessionHandle.flush` would. Read handles buffer nothing and are
 * untouched. A handle closed concurrently counts as flushed — close itself
 * drains durably.
 * @returns resolution once every write handle active at the call has flushed.
 * @throws {AggregateError} naming each session whose flush failed; the
 *   remaining handles still flush.
 */
abstract flush(): Promise<void>

/**
 * Observe one stored session without reading its event log or taking
 * ownership.
 *
 * The snapshot's `revision` is an opaque change token comparable only
 * against revisions from the same service instance and session id: equal
 * revisions may be treated as an unchanged log; unequal revisions promise
 * nothing. Write-ownership churn does not change a revision. It exists for
 * derived read-model caches keyed off `stat`/`list`; it plays no part in
 * open, read, or resume.
 * @param id - the stored session to observe.
 * @param options - optional cancellation.
 * @returns the snapshot, or `undefined` when the session does not exist.
 */
abstract stat(id: SessionId, options?: SessionPersistenceStatOptions): Promise<SessionPersistenceSnapshot | undefined>

/**
 * List every stored session visible to this process, in no promised order.
 * @param options - optional cancellation.
 * @returns one snapshot per stored session.
 */
abstract list(options?: SessionPersistenceListOptions): Promise<readonly SessionPersistenceSnapshot[]>
```

型: [SessionId](core.md)

ソース: [`packages/session/session-persistence/src/index.ts`](../../packages/session/session-persistence/src/index.ts)
<!-- END GENERATED cordis-surface -->
