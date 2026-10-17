# ファイルシステム

日本語 | [English](filesystem.en.md) | [中文](filesystem.zh.md)

任意のファイルシステムケイパビリティは 4 つの部分からなる。[dsh-fs](../../packages/fs/fs)は `ctx.fs` とガード付きの原子的なテキスト操作を所有し、[dsh-fs-local](../../packages/fs/fs-local)はローカルディスクを実装し、[dsh-fs-observation-policy](../../packages/fs/fs-observation-policy)は観測された存在または不在を記録し、サービスではなくイベントを通じて鮮度ルールを追加し、[dsh-tool-fs](../../packages/fs/tool-fs)はモデル向けの read/write/edit 呼び出しを直接実行してウィンドウを描画する。これは agent-loop の主軸の外側にあり、代替バックエンドはポリシーやツールスキーマを変更しない。

`dsh-fs-observation-policy` は任意である。これがなければ、`FileSystem` サービス定義、プロバイダー、および `dsh-tool-fs` コンシューマーが完全な制約なしファイルシステムシームを形成する。`write` は無条件に作成または上書きし、`edit` は無条件にリテラルテキストを置換する。ポリシープラグインは `fs/*` ウォーターフォールを決定することでこれらの操作を変更する。これを外してもツールは壊れない。ツールは `ctx.fs` を呼び出してイベントを送出するだけであり、ポリシーメソッドを呼ばないからである。`dsh-tool-fs` を読み込むデプロイメントでは、デフォルト動作を read-before-write/edit にするために `dsh-fs-observation-policy` も読み込むことが期待される。

プロバイダーのソース: [`packages/fs/fs/src/types.ts`](../../packages/fs/fs/src/types.ts) および [`packages/fs/fs/src/index.ts`](../../packages/fs/fs/src/index.ts)。ポリシーのソース: [`packages/fs/fs-observation-policy/src/types.ts`](../../packages/fs/fs-observation-policy/src/types.ts)。読み描画のソース: [`packages/fs/tool-fs/src/read-render.ts`](../../packages/fs/tool-fs/src/read-render.ts)。

## ターゲットの同一性とメタデータ (プロバイダー契約)

すべての操作はまずユーザー指定のパスを不透明なバックエンドターゲットに解決する。コンシューマーは `displayPath` を表示してよいが、`targetKey` (ブランド化された不透明な id) を解析したり、ローカルの絶対パスと仮定したりしてはならない。

ファイルシステムの実行ワールドを共有するコンシューマーは、その同一性を解釈する代わりにプロバイダーを通じてケイパビリティ横断の座標を取得する。`processPath(target)` はサブプロセスが開ける正規の絶対パスを返し、`processPathFromHostPath(hostPath)` はその実行ワールドが共有する場合に限り絶対の harness ホストファイルをマップし、`fileUrl(target)` はプロバイダープラットフォームの `file:` URI を返し、`contains(parent, child)` は正規の同一性または子孫包含を検査する。

```ts type-equiv
/**
 * A path resolved by a backend into a stable identity. `resolve()` produces
 * this; every other operation takes it.
 */
interface FsTarget {
  /** Opaque key for stale guards and target lookup. */
  targetKey: FsTargetKey
  /**
   * Path for model/UI-facing output. May be a local absolute path,
   * workspace-relative path, or remote URI depending on the backend.
   */
  displayPath: string
}
```

バックエンドはファイルバージョイントークン — write/edit がガード対象とする鮮度トークン — を所有する。ポリシープラグインは stale チェックのためにそれらを格納し、コンシューマーはそれらを解釈しない。両方の id はブランド化された不透明な文字列である。

```ts type-equiv
/**
 * Opaque key for stale guards and target lookup. The local backend uses a
 * realpath-like string; a remote backend might use a workspace URI or file id.
 * Consumers MUST NOT parse it or assume it is a local absolute path.
 */
type FsTargetKey = Branded<'FsTargetKey'>
```

```ts type-equiv
/**
 * Opaque file-version token — the freshness token a write/edit guards against.
 * The local backend derives it from high-resolution stat identity and freshness
 * fields; a remote backend might use a revision id. The policy layer records it
 * for stale checks; consumers may display related metadata but MUST NOT
 * interpret this token.
 */
type FsVersion = Branded<'FsVersion'>
```

`stat` はメタデータ (コンテンツではない) を返し、ターゲットが不在の場合は `undefined` を返す。`type` によりコンシューマーは読み取り前にディレクトリや特殊ファイルを拒否でき、`size` によりテキストコンシューマーは失敗による探索なしに `readText` と `streamText` を選択できる。テキストコンシューマーは `streamText` の消費中に独自の保持上限を適用する。生バイトのコンシューマーは `readBytes(target, signal, maxBytes)` を使い、その必須の完全コンテンツ上限により、既知または検出されたオーバーフローは切り詰めや無制限のバッファリングではなく `FS_TOO_LARGE` で失敗する。

```ts type-equiv
/**
 * Metadata about a target — what {@link FileSystem.stat} returns. Lets the
 * policy layer reject directories/special files before reading and choose
 * `readText` vs `streamText` from `size` without probing by failure. `version`
 * is the freshness token. `undefined` from `stat` means the target is absent.
 */
interface FsInfo {
  /** Opaque freshness token of the target right now. */
  version: FsVersion
  /** Whether the target is a regular file, a directory, or something else. */
  type: 'file' | 'directory' | 'other'
  /** Byte size of a regular file, when the backend can report it. */
  size?: number
}
```

`lstat` はパスレベルの no-follow メタデータプリミティブである。`resolve` が安定した同一性を生成するために意図的にシンボリックリンクをたどるため、`FsTarget` ではなくパスを受け取る。信頼境界チェックが必要なコンシューマーは、まず `lstat` を呼び出して解決前に `symlink` を拒否できる。

```ts type-equiv
/**
 * Metadata about a path without following the final path component when it is a
 * symbolic link. Unlike {@link FsInfo}, this path-level probe can report
 * `symlink` so consumers with trust-boundary rules can reject repository-owned
 * links before resolving a target.
 */
interface FsPathInfo {
  /** Opaque freshness token of the path entry right now. */
  version: FsVersion
  /** Whether the path entry is a regular file, directory, symlink, or other. */
  type: 'file' | 'directory' | 'symlink' | 'other'
  /** Byte size of the path entry, when the backend can report it. */
  size?: number
}
```

`listDir` は直接の子エントリを安定した名前順で返す。各エントリは子のベース名、型、解決済みターゲット、およびバックエンドが報告できる場合の安価なメタデータを運ぶ。ファイル内容を読んではならず、`size` は通常ファイルにのみ、`version` はメタデータ由来に限る。壊れた子や消失した子はメタデータなしで `other` として返される場合があり、子メタデータの一覧化や解決中の権限またはバックエンド I/O 失敗は、一覧全体を `FS_PERMISSION_DENIED` または `FS_IO_ERROR` で失敗させる。

```ts type-equiv
/**
 * One direct child returned by {@link FileSystem.listDir}. Listing returns
 * metadata and resolved targets only; it must not read file contents.
 */
interface FsDirEntry {
  /** Basename of the child inside the listed directory. */
  name: string
  /** Whether the child is a regular file, a directory, or something else. */
  type: 'file' | 'directory' | 'other'
  /** Resolved child target for follow-up operations. */
  target: FsTarget
  /** Opaque freshness token when the backend can report metadata cheaply. */
  version?: FsVersion
  /** Byte size of a regular file, when the backend can report it. */
  size?: number
}
```

## 書き込みと編集のガード (プロバイダー契約)

`writeText` と `editText` はどちらもバージョンガードを任意で受け取る。省略すれば無条件 (素のプロバイダー) の変更となり、指定すればガードする。`writeText` のガードは `FsWriteIntent` である。`createIfAbsent` は欠落したターゲットを作成し、既存のものは `FS_NOT_OBSERVED` で拒否する。これにはプロバイダーの初期プローブ後に現れたターゲットも含まれる。公開自体が no-replace でなければならないからである。`replaceIfVersion` はターゲットが観測されたバージョンで存在する場合にのみ置換し、そうでなければ `FS_STALE_VERSION` となる。`expected` を省略すれば無条件に作成または上書きする。共用体自体は 2 つのガード付き意図のみを運ぶ。「ガードなし」は省略で表すため、write と edit はどちらも同じ任意の `expected` フィールドを使う。

```ts type-equiv
/**
 * Guarded write intent. `createIfAbsent` rejects an existing target with
 * `FS_NOT_OBSERVED`; `replaceIfVersion` rejects absence or mismatch with
 * `FS_STALE_VERSION`. Omitting the intent from `writeText` means unconditional
 * create-or-overwrite, not a third union arm.
 */
type FsWriteIntent =
  | { kind: 'createIfAbsent' }
  | { kind: 'replaceIfVersion'; version: FsVersion }
```

```ts type-equiv
/** Outcome of a full-file write. */
interface FsWriteOutcome {
  /** Whether the write created a new file or replaced an existing one. */
  operation: 'create' | 'update'
  /** Opaque version of the file after the write. */
  version: FsVersion
  /**
   * The file's content BEFORE the write, or `null` when the file did not exist
   * (a create) or the backend declined a contextual basis (for example, a
   * binary/non-UTF-8 prior file or either overwrite side reaching its exclusive limit).
   * LF-normalized storage text (the diff basis), never a diff — a consumer
   * computes the result-time contextual diff from `before`/`after` when
   * `before` is present, else falls back to a whole-file diff.
   */
  before: string | null
  /** The file's content AFTER the write, LF-normalized to share `before`'s diff basis. */
  after: string
}
```

`editText` はプロバイダーレベルの変更であり、他所で合成された `read` に `write` を足したものではない。ガード付きの場合はリテラル照合の前に期待バージョンを検証する (そのため stale な編集は新しい内容に対する照合失敗ではなく `FS_STALE_VERSION` を報告する)。ガードなしの場合は現在の内容を編集する。いずれの場合も置換を適用して原子的に書き込む。照合、改行処理、stale チェック、原子的な置換を 1 つの変更クリティカルセクション内に保ち、ターゲット欠落は両方の経路で `FS_STALE_VERSION` を報告する。

```ts type-equiv
/** A literal-replacement edit request. */
interface FsEditRequest {
  /** Literal non-empty text to replace. Must match exactly (after line-ending normalization). */
  oldString: string
  /** Literal replacement text. An empty string deletes the matched text. */
  newString: string
  /** Replace every match instead of requiring exactly one. */
  replaceAll: boolean
}
```

```ts type-equiv
/** Outcome of a literal edit. */
interface FsEditOutcome {
  /** Opaque version of the file after the edit. */
  version: FsVersion
  /**
   * The file's content BEFORE the edit. Raw storage text (LF-normalized by the
   * backend), never a diff — a consumer computes the result-time contextual diff
   * (the applied hunk with context) from `before`/`after`.
   */
  before: string
  /** The file's content AFTER the edit. */
  after: string
}
```

## fs ポリシーイベント (プロバイダー契約の語彙)

`dsh-fs` はツールが送出しポリシープラグインが購読する 3 つのイベントを所有するため、送出側 (`dsh-tool-fs`) と購読側 (`dsh-fs-observation-policy`) は、送出側がポリシープラグインに依存することなく語彙を共有する。これらは `dsh-fs` の語彙と不透明な `object` アクターのみを運ぶ。モデル向けの概念も agent/セッション所有者構造も含まない。

`fs/write-intent` と `fs/edit-intent` は**単一スロット決定ウォーターフォール**である。ツールはそれぞれを `undefined` を返すデフォルトサンク (素のプロバイダー) と共に送出し、リスナーは `next()` を呼ばずに完全に決定する。スロットは登録順の先勝ちであり、それをポリシープラグインが所有するのはデプロイメントの慣例であって強制される不変条件ではない。`fs/observed` は `FsObservation` を運ぶ fire-and-forget の記録イベントである。バージョン付きの present または確認済みの absent を運ぶ。これは素の `ctx.emit` で送出される。そのリスナーは同期的で副作用のみでなければならならない。ツールは送出をガードしないため、投げるリスナーは読み取りエラーを置き換えたり、変更が既に成功した後にツールの `isError` 結果として表面化したりし得るからである。下の生成された [cordis surface](#cordis-surface) が正確なシグネチャを示す。

```ts type-equiv
/**
 * One authoritative observation of a target. A present observation carries the
 * version used by guarded replacement; an absent observation authorizes only a
 * guarded create, never an edit.
 */
type FsObservation =
  | { readonly kind: 'present'; readonly version: FsVersion }
  | { readonly kind: 'absent' }
```

## 実行コンテキスト (ポリシープラグイン)

ポリシープラグインは、`fs/*` イベントが運ぶ不透明な `object` アクターを絞り込んで観測状態の所有者を導出するのに十分な実行コンテキストだけを必要とする。`ToolExecution` が必須フィールドを持つため、`dsh-tool-fs` はツール、agent、セッションパッケージを `dsh-fs-observation-policy` に import させることなく、その実行オブジェクトをそのままアクターとして渡す。

```ts type-equiv
/**
 * Minimal structural view of a tool execution the policy plugin needs to derive
 * an observed-state owner. `@deepseek-ai/dsh-tools`' `ToolExecution` contains
 * these fields, so the tool passes its `exec` straight through as the opaque
 * `object` actor on the `fs/*` events; this plugin narrows that actor to
 * `FsObservationActor` without importing `dsh-tools`, `dsh-agent`, or `dsh-session`.
 *
 * The owner is `agent.session` when present. It is treated as an opaque object
 * identity (a `WeakMap` key); this package never reads any of its fields.
 */
interface FsObservationActor {
  /** The agent on whose behalf the call runs, when there is one. */
  agent?: {
    /** The session that owns observed-file state, used as an opaque key. */
    session?: object
  }
}
```

## 読み取り結果 (コンシューマー / 読み描画)

テキスト読み取りは行ウィンドウ、バイト上限、バックエンド制限で区切られる。バイト上限に達した後も走査は行を保持せずに続くため、`totalLines` は正確なままである。モデル向け `read` ツールが描画する結果は純粋に表示用であり、`full`/`partial` ビューはない。認可は鮮度ベースである (ツールは stat のバージョンで直接 present の `fs/observed` を送出する) ため、ファイルが不変なら任意のウィンドウ読み取りが後の write/edit を認可できる。メタデータ欠落はツールが `FS_NOT_FOUND` を返す前に absent 観測を送出し、edit を認可せずに後のガード付き書き込みが外部で削除されたターゲットを再作成できるようにする。読み取りを所有する実行者 `dsh-tool-fs` が読みウィンドウ化を実装してこの結果を構築する。ポリシープラグインは行わない。

```ts type-equiv
/** Outcome of a bounded text read — what {@link formatReadOutput} renders. */
interface FileReadOutcome {
  /** 1-based first line requested. */
  offset: number
  /** Returned lines, already numbered. */
  lines: FileTextLine[]
  /** Exact total line count in the file. */
  totalLines: number
  /** Whether selected output hit the byte cap. */
  truncatedByBytes?: true
}
```

## 観測ファイル状態 (ポリシープラグイン)

観測状態は `dsh-fs-observation-policy` プラグイン内に保持される `WeakMap<owner, Map<targetKey, FsObservation>>` である。マップエントリ欠落は未観測を意味し、`{ kind: 'absent' }` は `read` または `str_replace_editor` の `view`、`str_replace`、`insert` のメタデータ欠落が不在を確認したことを意味し、`{ kind: 'present', version }` は read、write、または edit がそのバージョンを観測したことを意味する。書き込み決定は未観測と absent を `createIfAbsent` に写像し、present は `replaceIfVersion` に写像する。編集決定は未観測を `FS_NOT_OBSERVED`、absent を `FS_NOT_FOUND`、present をそのバージョンガードに写像する。所有者はイベントアクター (通常は `exec.agent.session`) から導出され、不透明として扱われ読み取られることはない。破棄はすべてを捨て (HMR 安全性)、ポリシーはファイルシステム I/O を行わない。

## エラー分類 (プロバイダー契約)

ファイルシステム障害は `FsError` (`HarnessError`) が運ぶ安定した `FsErrorCode` 文字列を使う。ツールレジストリはエラー結果に `{ name, code }` を保持するため、リトライ層、権限層、UI 層はテキストを解析せずに分岐できる。

```ts type-equiv
/**
 * Stable, machine-routable codes for filesystem failures. Carried on
 * {@link FsError}; the tool registry exposes `{ name, code }` on `isError`
 * results so retry/permission/UI layers can branch without parsing messages.
 */
type FsErrorCode =
  | 'FS_NOT_FOUND'
  | 'FS_NOT_DIRECTORY'
  | 'FS_NOT_TEXT'
  | 'FS_NOT_REGULAR_FILE'
  | 'FS_TOO_LARGE'
  | 'FS_PERMISSION_DENIED'
  | 'FS_SANDBOX_DENIED'
  | 'FS_IO_ERROR'
  | 'FS_STALE_VERSION'
  | 'FS_NOT_OBSERVED'
  | 'FS_AMBIGUOUS_EDIT'
  | 'FS_EDIT_NOT_FOUND'
  | 'FS_ABORTED'
```

`FS_NOT_DIRECTORY`、`FS_PERMISSION_DENIED`、`FS_IO_ERROR` はディレクトリ一覧化で使い、存在する非ディレクトリターゲット、拒否された一覧化、予期しないバックエンド I/O 失敗を区別する。`FS_SANDBOX_DENIED` はサンドボックス強制バックエンド (`dsh-fs-sandbox`) による POLICY 拒否であり — モードフェンスが write/edit を拒否した — ホストカーネルによる拒否である `FS_PERMISSION_DENIED` とは異なる。`FS_NOT_OBSERVED` はポリシープラグインがこの所有者の事前観測記録を持たないこと (または `createIfAbsent` が既存ファイルに当たったこと) を意味する。`FS_NOT_FOUND` は確認済み不在から拒否された編集も表す。`FS_STALE_VERSION` はバックエンドバージョンが観測版と一致しなくなったこと (またはプロバイダー自体が欠落ターゲットへの編集を受けたこと) を意味する。鮮度認可に partial/full の区別はないため、`FS_PARTIAL_OBSERVATION` は存在しない。

## ファイル I/O にタイムアウトなし

`read`/`write`/`edit` は `timeoutMs` を**受け取らず**、プロバイダー契約も期限を設定しない — [`@deepseek-ai/dsh-timeout`](../../packages/util/timeout/README.md) を消費する bash や web とは異なり、宣言された `timeoutMs` が `@deepseek-ai/dsh-tool-call-timeout-policy` により強制されるサブプロセス裏付けの `glob`/`grep` とも異なる。これらはプロセス裏付けであり、期限が作業を実際に殺せるからである。ローカル syscall はせいぜいベストエフォートで中止可能な程度であり、タイムアウトは進行中の `fsync`/`rename` を止めさせることはできない。そのためここでの `timeoutMs` はシームが強制できない期限となり、explicit-over-implicit が禁じるまさにその場所での暗黙のデフォルトとなる。キャンセルはツール実行シグナルを通じて伝播し、syscall 境界でベストエフォートの中止を行う。

## サービスとプラグイン

`FileSystem` (`ctx.fs`、abstract) はプロバイダープリミティブを所有する。`resolve`、`processPath`、`processPathFromHostPath`、`fileUrl`、`contains`、`stat`、`lstat`、`readText`、`streamText`、`readBytes`、`listDir`、`writeText`、および `editText` である。`dsh-fs-observation-policy` は**サービスを登録しない** — `fs/*` イベントゲートを通じてポリシーを追加するプラグインであり、unseen/absent/present 状態から write/edit 意図ウォーターフォールを決定し、`FsObservation` 値を記録する。実行者は `dsh-tool-fs` であり、`ctx.fs` を通じて読み書き編集し、ウォーターフォールを送出して記録イベントを送出する。下の生成された [`ctx.fs` セクション](#ctxfs--filesystem-abstract-seam) が正確なシグネチャを示す。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成される (`pnpm run verify-cordis-catalog` により doc-sync で鮮度を検証し、`pnpm run gen-cordis-catalog` で再生成する) — 言語面はロケール固有のペア文書パスのみが異なる。シグネチャブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは [primer](../cordis-primer.md#dispatch-modes) で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxfs--filesystem-abstract-seam"></a>

### `ctx.fs` — `FileSystem` (抽象シーム)

抽象ファイルシステムプロバイダー。ターゲットはエイリアスを越えて同一性を保持しなければならず、読み取りは通常の UTF-8 テキストまたは型付きエラーを公開し、一覧は安定して内容なしであり、変更は原子的である。任意のガードはガードなしプロバイダー契約を変えずに stale 保護を追加する。

```ts cordis-catalog
/**
 * Observe one file or a directory's direct entries in this provider's execution world.
 * @param target - resolved file or directory, including an absent path to observe for creation.
 * @param changed - invalidation callback; errors can be reported during or after initialization.
 * @param signal - cancels watcher initialization; the caller closes an initialized watcher.
 * @returns a promise resolving once observation is active, with an asynchronous close function.
 * @throws when the provider does not support watching or cannot initialize the watcher.
 */
watch(target: FsTarget, changed: (error?: Error) => void, signal: AbortSignal): Promise<() => Promise<void>>

/**
 * Resolve a model/plugin-supplied path into a stable {@link FsTarget}. May perform I/O (a
 * remote/sandboxed backend may need a round-trip to map a path to a stable identity), hence
 * async even though the local backend only normalizes + realpaths.
 *
 * @param path - the path to resolve; relative paths resolve against `opts.cwd`.
 * @param opts - optional cwd override and cancellation signal.
 * @returns the stable target; the same file yields the same `targetKey`.
 */
abstract resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<FsTarget>

/**
 * Return the canonical absolute path a subprocess in this filesystem's
 * execution world can open. The path is deliberately separate from
 * {@link FsTarget.targetKey}: consumers may pass this value to another OS
 * capability, but must continue treating the target key as opaque.
 * @param target - the resolved target whose process path is required.
 * @returns an absolute path in the backend's execution world.
 */
abstract processPath(target: FsTarget): string

/**
 * Map an absolute path from the harness host into this filesystem's
 * execution world when both paths identify the same file. The base provider
 * exposes no mapping; host-backed or explicitly shared backends override it.
 * @param hostPath - absolute path in the harness host filesystem.
 * @returns the process path for the same file, or undefined when this
 *   execution world cannot read that host file.
 */
processPathFromHostPath(hostPath: string): string | undefined

/**
 * Return the canonical `file:` URI for a target in this filesystem's
 * execution world. Backends own URI encoding because the host platform may
 * differ from the execution platform.
 * @param target - the resolved target to encode.
 * @returns the target's canonical file URI.
 */
abstract fileUrl(target: FsTarget): string

/**
 * Test canonical containment without exposing or parsing backend target
 * keys. Both targets must come from this provider.
 * @param parent - canonical directory target.
 * @param child - canonical candidate target.
 * @returns true when `child` is `parent` or a descendant of it.
 */
abstract contains(parent: FsTarget, child: FsTarget): boolean

/**
 * Return target metadata, or `undefined` when the target does not exist.
 * @param target - the resolved target to stat.
 * @param signal - aborts the metadata round-trip.
 * @returns metadata only, never content; undefined for an absent target.
 */
abstract stat(target: FsTarget, signal?: AbortSignal): Promise<FsInfo | undefined>

/**
 * Return path metadata without following the final path component when it is a
 * symbolic link. This is intentionally path-shaped, not target-shaped:
 * {@link resolve} follows symlinks to produce the stable identity used by
 * normal reads/writes, while `lstat` lets a consumer reject the path itself
 * before that follow happens.
 *
 * `opts.cwd` follows {@link resolve}'s cwd rules. `undefined` means the path is
 * absent.
 * @param path - the path to inspect; relative paths resolve against `opts.cwd`.
 * @param opts - `cwd` overrides the backend's default base for relative paths.
 * @param signal - aborts the metadata round-trip.
 * @returns metadata only, never content; undefined for an absent path.
 */
abstract lstat(path: string, opts?: { cwd?: string }, signal?: AbortSignal): Promise<FsPathInfo | undefined>

/**
 * Read the whole regular text file as a single decoded string.
 * @param target - the resolved target to read.
 * @param signal - aborts the read.
 * @returns the full decoded UTF-8 content.
 */
abstract readText(target: FsTarget, signal?: AbortSignal): Promise<string>

/**
 * Stream the whole regular text file as decoded text chunks (same text
 * semantics as {@link readText}, for large files). The backend owns
 * cross-chunk UTF-8 decoding and binary rejection so the policy layer never
 * touches raw bytes.
 * @param target - the resolved target to read.
 * @param signal - aborts the stream, including between chunks.
 * @returns the chunk iterable, decoded and validated like {@link readText}.
 */
abstract streamText(target: FsTarget, signal?: AbortSignal): Promise<AsyncIterable<string>>

/**
 * Read the whole regular file as raw bytes with no decoding or binary
 * rejection. The bound lives at this seam so a backend can never buffer an
 * unbounded file: a target known or discovered to exceed `maxBytes` fails
 * with `FS_TOO_LARGE` instead of returning a truncated result.
 * @param target - the resolved target to read.
 * @param signal - aborts the read.
 * @param maxBytes - inclusive byte cap on the complete content.
 * @returns the full raw content, at most `maxBytes` long.
 */
abstract readBytes(target: FsTarget, signal: AbortSignal | undefined, maxBytes: number): Promise<Uint8Array>

/**
 * Read one byte window of the regular file as raw bytes with no decoding or
 * binary rejection: the bytes at `[offset, offset + length)`, shorter when
 * the file ends inside the window and empty when `offset` lies at or past
 * its end. The window is the bound here, not the file: a backend transfers
 * at most `length` bytes of content beyond the prefix it skips to reach
 * `offset` and never buffers the whole file, so the caller's cap on `length`
 * is the guard against unbounded buffering.
 * @param target - the resolved target to read.
 * @param range - `offset`, the 0-based first byte, and `length`, the largest byte count; both non-negative integers.
 * @param signal - aborts the read.
 * @returns the window's bytes, at most `length` long.
 */
abstract readByteRange(target: FsTarget, range: { offset: number; length: number }, signal?: AbortSignal): Promise<Uint8Array>

/**
 * List direct children of a directory in stable name order. Returns resolved
 * child targets plus cheap metadata only; never reads file contents.
 * @param target - the resolved directory target.
 * @param signal - aborts the listing.
 * @returns one entry per direct child, in stable name order.
 */
abstract listDir(target: FsTarget, signal?: AbortSignal): Promise<FsDirEntry[]>

/**
 * Atomically create or replace UTF-8 text. `expected` guards intent and
 * staleness; omission allows unconditional overwrite.
 * @param target - the resolved target to write.
 * @param content - the full new file content.
 * @param expected - the write intent guarding the write; omit for unconditional.
 * @param signal - aborts before atomic publication takes effect.
 * @param sandboxPolicy - the per-call mode and workspace root this write
 *   runs under; a sandboxing backend fences the write by it, the bare backend
 *   ignores it. Omit to leave the backend its own default.
 * @returns the outcome, including the version the write produced.
 */
abstract writeText( target: FsTarget, content: string, expected?: FsWriteIntent, signal?: AbortSignal, sandboxPolicy?: SandboxExecutionPolicy, ): Promise<FsWriteOutcome>

/**
 * Atomically edit literal text. When supplied, the version guard is checked
 * before matching so stale content reports `FS_STALE_VERSION`; omission edits
 * the current content without a freshness precondition.
 * @param target - the resolved target to edit.
 * @param edit - the literal search/replace request.
 * @param expected - the version guard; omit for an unconditional edit.
 * @param signal - aborts before atomic publication takes effect.
 * @param sandboxPolicy - the per-call mode and workspace root this edit runs
 *   under; a sandboxing backend fences the edit by it, the bare backend
 *   ignores it. Omit to leave the backend its own default.
 * @returns the outcome, including the version the edit produced.
 */
abstract editText( target: FsTarget, edit: FsEditRequest, expected?: { version: FsVersion }, signal?: AbortSignal, sandboxPolicy?: SandboxExecutionPolicy, ): Promise<FsEditOutcome>
```

型: [SandboxExecutionPolicy](sandbox.md)

ソース: [`packages/fs/fs/src/index.ts`](../../packages/fs/fs/src/index.ts)

<a id="fs-events"></a>

### `fs/*` イベント

<a id="fsedit-intent--waterfall"></a>

#### `fs/edit-intent` — waterfall

次の FileSystem.editText への単一スロット決定。`next()` の呼び出しは無条件の編集をもたらし、最初に返されたガードが勝つ。

```ts cordis-catalog
/**
 * Single-slot decision for the next {@link FileSystem.editText}. Calling
 * `next()` yields an unconditional edit; the first returned guard wins.
 * @param target - the resolved target about to be edited.
 * @param actor - the opaque tool-execution context the decider keys off.
 * @mode waterfall
 */
'fs/edit-intent'(target: FsTarget, actor: object | undefined, next: () => { version: FsVersion } | undefined | Promise<{ version: FsVersion } | undefined>): Promise<{ version: FsVersion } | undefined>
```

ソース: [`packages/fs/fs/src/index.ts`](../../packages/fs/fs/src/index.ts)

<a id="fsobserved--emit"></a>

#### `fs/observed` — emit

権威ある肯定または否定の観測を記録する。リスナーは同期的な記録者でなければならない。throw はツール呼び出しを失敗させ、返された promise は待機されない。

```ts cordis-catalog
/**
 * Record an authoritative positive or negative observation. Listeners must
 * be synchronous recorders: throws fail the tool call and returned promises
 * are not awaited.
 * @param target - the target whose presence or absence was observed.
 * @param observation - present with its version, or confirmed absent.
 * @param actor - the observing tool-execution context; undefined records nothing useful.
 * @mode emit
 */
'fs/observed'(target: FsTarget, observation: FsObservation, actor: object | undefined): void
```

ソース: [`packages/fs/fs/src/index.ts`](../../packages/fs/fs/src/index.ts)

<a id="fswrite-intent--waterfall"></a>

#### `fs/write-intent` — waterfall

次の FileSystem.writeText への単一スロット決定。`next()` の呼び出しは素のプロバイダーの無条件書き込みをもたらし、意図を返す最初のリスナーがピアと合成するのではなく決定を所有する。

```ts cordis-catalog
/**
 * Single-slot decision for the next {@link FileSystem.writeText}. Calling
 * `next()` yields the bare provider's unconditional write; the first listener
 * that returns an intent owns the decision rather than composing with peers.
 * @param target - the resolved target about to be written.
 * @param actor - the opaque tool-execution context the decider keys off.
 * @mode waterfall
 */
'fs/write-intent'(target: FsTarget, actor: object | undefined, next: () => FsWriteIntent | undefined | Promise<FsWriteIntent | undefined>): Promise<FsWriteIntent | undefined>
```

ソース: [`packages/fs/fs/src/index.ts`](../../packages/fs/fs/src/index.ts)
<!-- END GENERATED cordis-surface -->
