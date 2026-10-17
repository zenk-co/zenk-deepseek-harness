# ワークスペース

日本語 | [English](workspace.en.md) | [中文](workspace.zh.md)

ワークスペースはユーザーが作業するディレクトリの永続レコードである: 正規パス上の安定した id、表示タイトル、およびそれに属するセッションの順序付き台帳。サブシステムは 1 つのパッケージ ([dsh-workspace](../../packages/workspace/workspace)、`ctx.workspaceRegistry`) である — オプションのホスト側ケイパビリティであり、エージェントループの背骨の一部ではなく、モデルからは不可視である (ツールなし、プロンプトテキストなし、セッションイベントなし)。レコードは [storage ドメイン形式](storage.md)を通じて保存し、セッションメンバーシップを [`SessionHeader.cwd`](persistence.md#sessionheader--metadata-beside-the-log)に対して検証するため、`storageDomain` と `sessionPersistence` は必須の起動依存である: 永続化ピアが利用不可の場合は空の履歴と誤認されるのではなくプラグインがペンディングのまま残る。設計記録: [domain KV storage Agent Note](../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.md); ブートストラップと GUI 順序: [Workspace UI product-flow Agent Note](../../.agents/notes/archived/feature/2026-07-25-workspace-ui-product-flow.md)。

Source: [`packages/workspace/workspace/src/types.ts`](../../packages/workspace/workspace/src/types.ts)

## アイデンティティ

```ts type-equiv
/**
 * Identifies one workspace record. A generated uuid, never the path: path
 * normalization rewrites paths, and a reference anchor must stay stable.
 */
type WorkspaceId = Branded<'WorkspaceId'>
```

`WorkspaceId` は [branded id](core.md#branded-ids)である。パスアイデンティティは別である: `realpathNormalize` (`fs.realpath`; 末尾スラッシュ、`..`、シンボリックリンクを解決) が唯一の一意性正規形である — ワークスペースパスは正規化して保存され、一意性は正規パスの文字列等価であり (所有済みディレクトリへのシンボリックリンクは衝突する)、アタッチ時のセッション cwd チェックも同じ正規形を通る。

## ワークスペースエンティティ

コンシューマーが見るのは `Workspace` インターフェースのみであり、実装はパッケージプライベートのままである。

```ts type-equiv
/**
 * One workspace: a stable id over an existing directory, a display title, and
 * an ordered candidate account of sessions. Membership validates header cwd
 * against the workspace path, but preserves an existing account when its
 * fully qualified cwd is missing. Consumers only see this interface; the
 * implementation stays private.
 */
interface Workspace {
  /** Stable record id (generated uuid). */
  readonly id: WorkspaceId

  /**
   * Canonical directory path: the `fs.realpath` of the path given at create
   * time (trailing slashes, `..`, and symlinks all resolved). Never rewritten
   * afterwards, even when the directory disappears (see {@link status}).
   */
  readonly path: string

  /** Display title. Defaults to the final path segment, or a filesystem root's own spelling; duplicates are allowed. */
  readonly title: string

  /** ISO-8601 creation instant, stamped at create and never rewritten. */
  readonly createdAt: string

  /** ISO-8601 instant of the last durable mutation (create counts as one). */
  readonly updatedAt: string

  /**
   * Header-validated sessions in manually owned order: a new session is
   * prepended at attach, explicit reordering goes through
   * `insertSessionBefore`, and activity never reorders. The durable candidate
   * account is filtered synchronously: missing headers, invalid cwd values,
   * and canonical cwd mismatches are never returned. A fully qualified cwd
   * whose realpath or directory stat fails with ENOENT preserves an existing
   * candidate, including a dangling symlink; other filesystem failures do not.
   * A subsequent mutation prunes filtered candidates, not missing-directory
   * candidates. This does not admit new sessions or recreate directories.
   */
  readonly sessionIds: readonly SessionId[]

  /**
   * Replace the display title durably.
   * @param title - New title; any string, duplicates across workspaces allowed.
   * @returns resolution after durability.
   */
  setTitle(title: string): Promise<void>

  /**
   * Prepend a session to this workspace's candidate account. An already
   * accounted id resolves without writing, aside from the durable
   * filtered-candidate prune every accepted mutation performs. A new id's
   * live or persisted
   * header cwd must resolve to an existing directory equal to {@link path};
   * unknown ids, missing or invalid cwd values, and mismatches reject without
   * writing.
   * @param sessionId - The session to record.
   * @returns resolution after durability.
   */
  attachSession(sessionId: SessionId): Promise<void>

  /**
   * Move an accounted session within the manual order, DOM-insertBefore-like:
   * with an anchor the session lands before it, without one it appends to the
   * end. Only the moved id changes position. A session or anchor absent from
   * the account rejects without writing; a move to the current position
   * resolves without writing, aside from the durable filtered-candidate
   * prune every accepted mutation performs; decided on the domain write
   * chain.
   * @param sessionId - The accounted session to move.
   * @param beforeSessionId - Accounted anchor to insert before; omitted appends.
   * @returns resolution after durability.
   */
  insertSessionBefore(sessionId: SessionId, beforeSessionId?: SessionId): Promise<void>

  /**
   * Remove a session from this workspace's account. Idempotent: an id not on
   * the account resolves without writing, aside from the durable
   * filtered-candidate prune every accepted mutation performs; decided on
   * the domain write chain like attach. Never touches the session's own stored log.
   * @param sessionId - The session to remove.
   * @returns resolution after durability.
   */
  detachSession(sessionId: SessionId): Promise<void>

  /**
   * Live directory check, uncached: whether {@link path} currently exists and
   * is a directory. A missing directory never mutates the record — the
   * directory may only be temporarily moved.
   * @returns `'ok'` when the directory exists, `'missing-dir'` otherwise.
   */
  status(): Promise<'ok' | 'missing-dir'>
}
```

所有の真実はレコードの順序付き `sessionIds` であり、セッション cwd から導出されることはない。メンバーシップは記録済みヘッダー cwd をワークスペースパスに対して検証する; 既存候補は、その完全修飾 cwd の解決またはディレクトリ stat が `ENOENT` で失敗した場合も所有されたまま残る。これにより、新規セッションを受け入れずに、欠落ディレクトリや宙ぶらりんシンボリックリンクの台帳を保持する。失敗した書き込みはリジェクトする (`insertSessionBefore` の台帳エラーは `WorkspaceMoveInvalidError`、ストレージ失敗はプレーンエラー); 受け入れられたすべてのミューテーションは `updatedAt` を刻印し、メンバーシップチェックを通らなくなった候補を耐久的にプルーニングする。

## レジストリ: `ctx.workspaceRegistry`

`WorkspaceRegistry` ([シグネチャー](#ctxworkspaceregistry--workspaceregistry)) は登録と解決を所有する。`create(path, title?)` は完全修飾パスを要求し、それを正規化し、存在しないパス (元の `ENOENT`) または非ディレクトリをリジェクトし、正規パスが既に所有されている場合は既存エンティティを無変更で返し、そうでなければ `title ?? defaultWorkspaceTitle(path)` のレコードを耐久レジストリ順序の先頭に追加して作成する (異なる正規パスが表示タイトルを共有してよく、最終セグメントを持たないパスはルート綴りを使う)。`get(id)` と順序付き `list()` は同期的キャッシュ読み取りであり、`resolveByPath(path)` は作成せずに同じ完全修飾 realpath 正規形を適用する。`delete(id)` は登録、順序エントリ、セッション台帳のみを削除する — ディレクトリ、ユーザーファイル、ライブセッション、永続ログには決して触れないため、それらのセッションは Ungrouped になる ([リファレンス](../../packages/workspace/workspace/README.md)); 未知 id は `false` を返す。作成と削除は 2 つの書き込み (レコード + 順序) が乖離する前にペンディングミューテーションマーカーを永続化する; 起動時はマークされたミューテーションだけを解決する — マークされたテーブル行を削除することにより、中断した削除を完了し、中断した作成をロールバックする (登録は再作成可能なためロールバックが安全な方向である) — そしてマークのない順序/テーブル不一致は破損として loud に失敗する。

セッションは作成時に作成者から cwd を受け取り、このレジストリからではない — API ゲートウェイは選択されたワークスペースの `path` から新規セッションの cwd を解決し (明示またはデフォルト cwd にフォールバック)、セッションを作成して cwd が不変の [`SessionHeader`](persistence.md#sessionheader--metadata-beside-the-log)に収まるようにし、次に `attachSession` を呼んで保存済みヘッダー cwd をワークスペースパスに対して再検証する。最初の成功起動時に、レジストリは永続ヘッダーのみ (`id`、`cwd`、`createdAt` — イベント本体は決して使わない) から履歴をブートストラップし、有効な正規 cwd を持つセッションをディレクトリごとのワークスペースに新しい順にグループ化する; 初期化済みマーカーは最後に書き込むため、中断したブートストラップは安全に再開する。ブートストラップは一度きりである: cwd のないレガシーセッションは Ungrouped のまま残り、後に作成されるセッションは `attachSession` 経由でのみワークスペースに参加する。

## デフォルトワークスペースの初期化

コントローラーの `initializeDefault` はリクエストを取らない: 固定の `default-workspace` ディレクトリ名を所有し、Documents の場所を解決し、レジストリに一度だけ初期化を求める。レジストリはディレクトリリゾルバーを受け入れ、初期タイトルを正規の方ではなく要求ディレクトリの最終セグメントから導出し、その耐久アイデンティティで登録をコミットする。言語は Host に届かない — ブラウザーコンシューマーは、その自動タイトルをまだ運ぶ Workspace にコントローラーの `workspaceDisplayTitle` を通じてラベル付けするため、画面上の名前だけが読者の言語に従う。[初回使用の動作と構成](../../packages/api/workspace-controller/README.md#first-use-workspace)は再利用と失敗処理を記述する。

## セッションピン留め

コントローラーの[トランスポート型](../../packages/api/workspace-controller/src/types.ts)は `WorkspacePinSessionRequest` と `WorkspaceUnpinSessionRequest` を定義し、それぞれ 1 つの `sessionId` を運ぶ。どちらの操作も `WorkspacePinValue` を返す: セッション id の完全な `pinnedSessionIds` 配列であり、最近ピン留めしたものが先頭である。ピン留めには既知の非アーカイブセッションが必要であり、ピン留めされていない id のピン外しは集合を変更せずに成功する。アーカイブは同じ耐久書き込みでセッションのピンを除去し、アーカイブ解除はそれを復元しない。

## アーカイブ受け入れ

アーカイブはレジストリグローバルな耐久集合であり、レジストリは実行中作業をその背後に隠すことを拒否する。この規則は、パッケージが宣言し送出する 2 つの Host イベント上のケイパビリティシームである ([イベント](#workspace-events)): `workspace/session-activity` (waterfall) は構成済みプロバイダーにセッションでまだ実行中のものを問い合わせ、`workspace/session-stop` (parallel) はそれらに停止を求める。各プロバイダーは他のリスナーと同様にルートに登録するため、パッケージはエージェント、ジョブ、スケジュールの語彙を知らない; ファミリーはマージ拡張可能マップのキーである。

```ts type-equiv
/**
 * Activity families a `workspace/session-activity` listener may report. This
 * package declares none: each provider merges its own key from a module both
 * its Host and Client faces import, so a consumer that renders the families
 * sees exactly the keys its program compiled and falls through to a generic
 * description for any other. The shipped providers merge `turn` (the Agent
 * registry), `job` (the job registry seam), `subagent` (the Subagent
 * runtime), and `schedule` (the Schedule plugin).
 */
interface SessionActivityKindMap {}
```

`SessionActivityKind` は `keyof SessionActivityKindMap` であるため、プロバイダーをコンパイルしなかったプログラムにはキーがまったく見えない。出荷キーはクライアントがインポート可能な型モジュールに存在する: Agent レジストリの `types.ts` の `turn`、ジョブレジストリシームの `view.ts` の `job`、サブエージェントランタイムの `control-types.ts` の `subagent`、Schedule プラグインの `types.ts` の `schedule`; ファミリーを描画するコンシューマーはそのケース用にそれらのモジュールをインポートし、他のキーには汎用行を残す。プロバイダーは `next()` の結果に自身の `SessionActivity` エントリを先頭追加して waterfall に答える; レジストリの最内コールバックは空リストを返すため、プロバイダーのない構成は自由にアーカイブする。

```ts type-equiv
/**
 * One reason a session counts as active for archive admission. Families with
 * per-item identity list their items so a caller can name what must stop.
 */
interface SessionActivity {
  readonly kind: SessionActivityKind
  /** Active items of the family; absent for a family without per-item identity (`turn`). */
  readonly items?: readonly SessionActivityItem[]
}
```

`SessionActivityItem` はファミリー固有の `id` (セッション、ジョブ、またはスケジュール id) と省略可能な表示 `label` を運ぶ。`archiveSession(sessionId)` は存在チェックの後に waterfall を一度問い合わせ、非空の回答を `WorkspaceActiveSessionError` (`sessionId`、`activity`) で書き込まずにリジェクトする; コントローラーはそれを `workspace/session-active` エラーにマップし、その詳細は同じ 2 フィールドを運ぶ。`archiveSession(sessionId, { stopActivity: true })` — トランスポートリクエストが `stopActivity` として公開する `ArchiveSessionOptions` フィールド — はチェックをスキップし、アーカイブを書き込んでから `workspace/session-stop` を送出する; リジェクトするプロバイダーはログに記録され、アーカイブは残り、停止した作業が落ち着くのを待つことはない。既にアーカイブされた id は問い合わせも停止もしない。出荷プロバイダー、それらが停止するもの、アーカイブ済みセッションがモデルステップを実行しないようにする `agent/pre-step` ゲートは[レジストリパッケージ](../../packages/workspace/workspace/README.md#api-behavior)で文書化されている; 決定記録は [archive-stops-running-work Agent Note](../../.agents/notes/implemented/feature/2026-09-21-archive-stops-running-session-work.md)である。

## コンシューマー

[`dsh-workspace-controller`](../../packages/api/workspace-controller) は `ctx.workspaceRegistry` 経由で GUI クライアントにワークスペース CRUD を提供し、[`dsh-session-controller`](../../packages/api/session-controller) は上記の create-session-then-attach フローを実行する。[dsh-agent-instructions](../../packages/context/agent-instructions) は名前にもかかわらずコンシューマー**ではない**: エージェント自身の cwd 配下の AGENTS.md 形式の指示ファイルを検出し、`ctx.workspaceRegistry` には決して触れない — 共有される語はユーザーの作業ディレクトリを指し、このレジストリのエンティティではない。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される（doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。`pnpm run gen-cordis-catalog` で再生成）。言語版はロケール固有の対訳ドキュメントパスだけが異なる。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxdirectorypicker--directorypicker-abstract-seam"></a>

### `ctx.directoryPicker` — `DirectoryPicker` (abstract シーム)

抽象ディレクトリ選択サービス。サブクラス化し、`capability()` を実装し、そのサブクラスをプラグインとしてロードする — それは `ctx.directoryPicker` として登録される (コンテキストごとに 1 実装; 2 つ目のロードは throw し、cordis 標準の重複サービス動作である)。ケイパビリティオブジェクトはサービス存続期間中安定でなければならない: コンシューマーは呼び出しをまたいでそれをキャプチャしてよい。

```ts cordis-catalog
/**
 * The backend's interaction capability.
 * @returns the discriminated capability consumers switch on.
 */
abstract capability(): DirectoryPickerCapability
```

Source: [`packages/host/directory-picker/src/index.ts`](../../packages/host/directory-picker/src/index.ts)

<a id="ctxdirectorypickercontroller--directorypickercontroller"></a>

### `ctx.directoryPickerController` — `DirectoryPickerController`

生成された `ctx.remote.directoryPicker` 名前空間を支える Host サービス。それがエクスポートするシームは abstract であるため、それ自体の Loader エントリには決してならず、このコントローラーがワイヤーバーブを運ぶ: 1 つの合成バックエンドがネイティブチューザーまたはブラウズプリミティブのいずれかを提供し、合成が提供できないバーブは近似ではなく拒否される。

```ts cordis-catalog
/**
 * Open the host's OS chooser for a Remote caller.
 * @param signal - caller lifetime; abort terminates the chooser.
 * @returns the chosen absolute path, or null when the operator cancels.
 */
@Remote('pick') async pick(signal: AbortSignal): Promise<string | null>

/**
 * List one directory level for a Remote caller's in-app browser.
 * @param path - absolute directory to list; absent lists the home directory.
 * @param signal - caller lifetime; abort stops the backend's scan instead of
 *   letting it outlive a disconnected caller.
 * @returns the level's listing with its ancestry.
 */
@Remote('list') async list(path: string | undefined, signal: AbortSignal): Promise<DirectoryListing>

/**
 * Create one child directory for a Remote caller's in-app browser.
 * @param path - absolute existing parent directory.
 * @param name - single non-blank path segment.
 * @returns the created directory's absolute path.
 */
@Remote('createDirectory') async createDirectory(path: string, name: string): Promise<string>
```

Source: [`packages/api/workspace-controller/src/directory-picker.ts`](../../packages/api/workspace-controller/src/directory-picker.ts)

<a id="ctxterminalcontroller--terminalcontroller"></a>

### `ctx.terminalController` — `TerminalController`

一時的セッション所有ターミナルプロセスの型付き Remote 制御。

```ts cordis-catalog
/**
 * Read the Session's current directory and terminal limits without filesystem validation or shell lookup.
 * @param agent - Session owner supplied by the Gateway.
 * @param signal - request cancellation.
 * @returns the logged current directory and terminal limits; retained terminals keep their own process directories.
 */
@Remote environment(agent: Agent, signal: AbortSignal): TerminalEnvironment

/**
 * Discover installed shells in the Session's execution environment.
 * @param agent - Session owner supplied by the Gateway.
 * @param signal - request cancellation.
 * @returns verified profiles, with the configured or system default first.
 */
@Remote shells(agent: Agent, signal: AbortSignal): Promise<TerminalShell[]>

/**
 * List retained terminals without resolving or activating an Agent.
 * @param sessionId - displayed Session identity, including offline history.
 * @returns terminals retained for this Host lifetime.
 */
@Remote list(sessionId: SessionId): WebTerminalInfo[]

/**
 * Allocate a user shell once for a caller-generated identity, without Agent sandbox or approval restrictions.
 * @param agent - Session owner supplied by the Gateway.
 * @param request - initial dimensions and idempotency identity.
 * @param signal - allocation cancellation; committed terminals survive disconnection.
 * @returns the existing or newly committed terminal.
 */
@Remote async create(agent: Agent, request: TerminalCreateRequest, signal: AbortSignal): Promise<WebTerminalInfo>

/**
 * Retain an existing terminal for a window without activating its Agent or taking input control.
 * @param sessionId - owning Session identity, including an inactive saved layout.
 * @param id - retained Host terminal identity.
 * @param signal - physical Remote stream cancellation.
 * @returns a hold acknowledgement followed by an open lifetime stream.
 */
@Remote({ mode: 'stream' }) retain(sessionId: SessionId, id: WebTerminalId, signal: AbortSignal): AsyncIterable<TerminalRetentionFrame>

/**
 * Attach terminal input and output to one physical Remote stream.
 * @param agent - Session owner supplied by the Gateway.
 * @param id - terminal identity.
 * @param signal - attachment cancellation; the process remains alive and input is never replayed.
 * @returns screen recovery, output, writable state and provider-acceptance acknowledgements.
 */
@Remote({ mode: 'stream' }) attach(agent: Agent, id: WebTerminalId, signal: AbortSignal): RemoteStream<TerminalFrame, TerminalInput>

/**
 * Rename a terminal without changing its shell.
 * @param agent - Session owner supplied by the Gateway.
 * @param id - terminal identity.
 * @param title - nonempty display title, at most 120 characters.
 */
@Remote rename(agent: Agent, id: WebTerminalId, title: string): void

/**
 * Close an identity to future creation and kill its process range; repeated closes succeed.
 * @param agent - Session owner supplied by the Gateway.
 * @param id - terminal identity.
 * @returns after provider cleanup succeeds. A failure retains the terminal for retry.
 */
@Remote async close(agent: Agent, id: WebTerminalId): Promise<void>
```

Types: [Agent](core.md) · [RemoteStream](typert.md) · [SessionId](core.md)

Source: [`packages/api/terminal-controller/src/index.ts`](../../packages/api/terminal-controller/src/index.ts)

<a id="ctxworkspacecontroller--workspacecontroller"></a>

### `ctx.workspaceController` — `WorkspaceController`

生成された `ctx.remote.workspace` 名前空間を支える Host サービス。

```ts cordis-catalog
/**
 * Create or idempotently resolve one Workspace over an existing directory.
 * @param request - directory path to register.
 * @returns the Workspace and whether this call created it.
 */
@Remote('create') create(request: WorkspaceCreateRequest): Promise<WorkspaceCreateValue>

/**
 * Initialize or reuse the default Workspace during first-use startup. The
 * directory name is fixed, so the Host never renames or relocates an
 * existing default; its initial title is that same name, which browser
 * consumers label in the reader's language.
 * @param signal - caller lifetime; cancels native directory lookup.
 * @returns the durable Workspace, or undefined when first-use initialization is ineligible; creates no Session or message.
 */
@Remote('initializeDefault') async initializeDefault(signal: AbortSignal): Promise<WorkspaceValue | undefined>

/**
 * Rename one Workspace to a unique non-blank title.
 * @param request - Workspace identity and proposed title.
 * @returns the updated Workspace projection.
 */
@Remote('rename') rename(request: WorkspaceRenameRequest): Promise<WorkspaceValue>

/**
 * Remove one Workspace registration while retaining files and Sessions.
 * @param request - Workspace identity to remove.
 * @returns deletion confirmation.
 */
@Remote('delete') delete(request: WorkspaceDeleteRequest): Promise<WorkspaceDeleteValue>

/**
 * Move one Workspace within the registry display order.
 * @param request - moved Workspace and optional anchor.
 * @returns the complete resulting Workspace order.
 */
@Remote('insertBefore') insertBefore(request: WorkspaceInsertBeforeRequest): Promise<WorkspaceOrderValue>

/**
 * Move one accounted Session within a Workspace.
 * @param request - Workspace, Session, and optional anchor identities.
 * @returns the updated Workspace projection.
 */
@Remote('insertSessionBefore') insertSessionBefore(request: WorkspaceInsertSessionBeforeRequest): Promise<WorkspaceValue>

/**
 * Hide one known Session from Workspace grouping surfaces.
 * @param request - Session identity to archive.
 * @returns the complete resulting archive set.
 */
@Remote('archiveSession') archiveSession(request: WorkspaceArchiveSessionRequest): Promise<WorkspaceArchiveValue>

/**
 * Restore one archived Session to Workspace grouping surfaces.
 * @param request - Session identity to unarchive.
 * @returns the complete resulting archive set.
 */
@Remote('unarchiveSession') unarchiveSession(request: WorkspaceUnarchiveSessionRequest): Promise<WorkspaceArchiveValue>

/**
 * Surface one known unarchived Session ahead of unpinned Sessions.
 * @param request - Session identity to pin.
 * @returns the complete resulting pin set, most recently pinned first.
 */
@Remote('pinSession') pinSession(request: WorkspacePinSessionRequest): Promise<WorkspacePinValue>

/**
 * Remove one Session's pin without changing its saved Session order.
 * @param request - Session identity to unpin.
 * @returns the complete resulting pin set, most recently pinned first.
 */
@Remote('unpinSession') unpinSession(request: WorkspaceUnpinSessionRequest): Promise<WorkspacePinValue>

/**
 * Stream a complete Workspace baseline followed by ordered increments. A
 * non-owner receives only the Workspaces and Sessions `allows()` admits.
 * When a delivered Workspace is no longer admitted at its next change or
 * the next order change, the stream sends a `replace` frame with the
 * complete filtered state instead of a `remove`, because a Client never
 * resurrects a removed Workspace; a `remove` frame reports a deletion and
 * reaches only a Client that received that Workspace.
 * @param signal - generation cancellation.
 * @returns baseline followed by ordered Workspace increments.
 */
@Remote({ mode: 'stream' }) async *follow(signal: AbortSignal): AsyncIterable<WorkspaceFollowFrame>
```

Source: [`packages/api/workspace-controller/src/index.ts`](../../packages/api/workspace-controller/src/index.ts)

<a id="ctxworkspacefiles--workspacefiles"></a>

### `ctx.workspaceFiles` — `WorkspaceFiles`

合成ファイルシステム上の Host Remote ファイル読み取りとワークスペースディレクトリ観測。

```ts cordis-catalog
/**
 * Read one page of lines from a UTF-8 file readable by the filesystem backend.
 * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
 * @param path - absolute path or path relative to the workspace root; files outside it are allowed.
 * @param range - the line window; omitted fields take the page defaults.
 * @param signal - caller cancellation.
 * @returns the page, the file's version at the stat before it, and whether it reaches the last line.
 */
@Remote async read( workspaceFileScope: WorkspaceFileScope, path: string, range: WorkspaceFileRange, signal: AbortSignal, ): Promise<WorkspaceFileText>

/**
 * Read a complete regular file or one byte range without text decoding.
 * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
 * @param path - target path, absolute or workspace-relative; relative to the base file's directory when provided.
 * @param options - optional base file and range; without a range the complete-file cap applies.
 * @param signal - caller cancellation.
 * @returns native bytes with the file's version and size at the preceding stat, byte offset, and EOF marker.
 */
@Remote async readBytes( workspaceFileScope: WorkspaceFileScope, path: string, options: WorkspaceByteReadOptions, signal: AbortSignal, ): Promise<WorkspaceFileBytes>

/**
 * Report one regular file's identity, version, and size without its content.
 * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
 * @param path - absolute path or path relative to the workspace root; files outside it are allowed.
 * @param signal - caller cancellation.
 * @returns the file's absolute path, current version, and byte size.
 */
@Remote async stat(workspaceFileScope: WorkspaceFileScope, path: string, signal: AbortSignal): Promise<WorkspaceFileStat>

/**
 * List the direct children of one directory inside the Session's workspace.
 * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
 * @param path - workspace path, absolute or relative to the workspace root.
 * @param signal - caller cancellation.
 * @returns the directory's children in the backend's stable name order, bounded by the entry cap.
 */
@Remote async list(workspaceFileScope: WorkspaceFileScope, path: string, signal: AbortSignal): Promise<WorkspaceDirectoryListing>

/**
 * Watch one file or a directory's direct entries in the Session's filesystem.
 * Files use the backend's read authority; directories remain workspace-scoped.
 * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
 * @param path - target path; the Host determines its type and confines directories to the workspace.
 * @param signal - generation cancellation.
 * @returns `ready` once the target watch is active, then current metadata for queued and live invalidations.
 * @throws RemoteError when watching is unavailable or a directory is outside the workspace.
 */
@Remote({ mode: 'stream' }) changes(workspaceFileScope: WorkspaceFileScope, path: string, signal: AbortSignal): AsyncIterable<WorkspaceFileWatchFrame>
```

Source: [`packages/api/workspace-files/src/index.ts`](../../packages/api/workspace-files/src/index.ts)

<a id="ctxworkspaceregistry--workspaceregistry"></a>

### `ctx.workspaceRegistry` — `WorkspaceRegistry`

耐久ワークスペースレジストリ。起動時は `sessionPersistence` を待ち、正規 cwd ヘッダーインデックスを 1 つ構築し、サービスがアクティブになる前に一度きりの履歴ブートストラップを完了する。永続化依存は必須であり、利用不可ピアが空の履歴と誤認されて初期化済みマーカーをコミットすることは決してない。

```ts cordis-catalog
/**
 * Create or reuse a workspace for an existing directory. The fully qualified
 * path is canonicalized through `fs.realpath`; a relative, nonexistent, or
 * non-directory path rejects. Repeated calls for the same canonical path
 * return the existing entity without changing its title.
 * A newly created workspace is prepended to the durable registry order.
 * Different canonical paths may share a display title.
 * @param path - Existing directory to own, in a fully qualified path spelling.
 * @param title - Display title used only when a new record is created.
 * @returns the existing or newly durable workspace.
 */
async create(path: string, title?: string): Promise<Workspace>

/**
 * Initialize the default Workspace only while both the registry and Session
 * history are empty. Repeated requests reuse its durable identity; deleting
 * that registration permanently disables automatic creation.
 * @param resolveDirectory - resolve the absolute directory; called only for
 * eligible creation, inside the registry mutation queue. Missing directories
 * are created recursively before registration, and the initial title is the
 * requested directory's own final segment — not the canonical one, so a
 * symlink at that path does not retitle the Workspace after its target.
 * After resolution, caller cancellation does not roll back creation or registration.
 * @returns the initialized Workspace, or undefined when automatic creation is ineligible.
 */
initializeDefault(resolveDirectory: () => Promise<string>): Promise<Workspace | undefined>

/**
 * Look up a workspace by id.
 * @param id - Workspace id.
 * @returns the workspace, or `undefined` when unknown.
 */
get(id: WorkspaceId): Workspace | undefined

/**
 * Synchronous workspace projection in durable registry order. Every
 * entity's `sessionIds` getter is already filtered by the startup/live
 * canonical-cwd header index; this method performs no persistence reads.
 * @returns a fresh ordered array of workspace entities.
 */
list(): Workspace[]

/**
 * Delete one workspace registration while retaining its directory and every
 * session log. The durable order is updated before the table deletion; a
 * failed table write restores the prior order and keeps the entity
 * published. Unknown ids are an idempotent no-op for domain callers.
 * @param id - Workspace registration to remove.
 * @returns `true` when a record was deleted, `false` when it was unknown.
 */
delete(id: WorkspaceId): Promise<boolean>

/**
 * Move one workspace within the durable display order, DOM-insertBefore-like.
 * With an anchor it lands before that workspace; without one it appends.
 * @param id - Workspace to move.
 * @param beforeId - Workspace anchor; omitted appends.
 * @returns the complete committed workspace order.
 */
insertBefore(id: WorkspaceId, beforeId?: WorkspaceId): Promise<readonly WorkspaceId[]>

/**
 * Archive one session durably. The session must exist (live or in session
 * persistence); its workspace accounting — or lack of one — is irrelevant.
 * Without `stopActivity` the session must also be inactive: the
 * `workspace/session-activity` waterfall is asked once, and any reported
 * activity rejects with {@link WorkspaceActiveSessionError} before anything
 * is written. With `stopActivity` the archive is written without an
 * activity check, and the `workspace/session-stop` providers are then asked
 * to stop the session's work: the durable archive set is what a provider's
 * `agent/pre-step` gate reads, so every wake the stops induce is already
 * blocked. Archiving drops the session's pin in the same durable write
 * (pinning and archival are mutually exclusive). An already archived id
 * resolves without writing, asking, or stopping.
 * @param sessionId - The session to archive.
 * @param options - Whether running work is stopped instead of refusing.
 * @returns resolution after durability and, with `stopActivity`, after every stop request was issued.
 */
archiveSession(sessionId: SessionId, options: ArchiveSessionOptions = {}): Promise<void>

/**
 * Unarchive one session durably by dropping it from the registry-global
 * archive set; the accounting slot was never touched, so the session
 * returns to its recorded position. Unarchiving runs no session-existence
 * check because removing an id cannot introduce an unknown one, so an
 * entry whose session is gone still resolves. An id that is not archived
 * resolves without writing.
 * @param sessionId - The session to unarchive.
 * @returns resolution after durability.
 */
unarchiveSession(sessionId: SessionId): Promise<void>

/**
 * Pin one session durably, prepending it to the registry-global pin set.
 * The session must exist (live or in session persistence) and must not be
 * archived. An already pinned id resolves without writing or reordering.
 * @param sessionId - The session to pin.
 * @returns resolution after durability.
 */
pinSession(sessionId: SessionId): Promise<void>

/**
 * Unpin one session durably by dropping it from the registry-global pin
 * set. Unpinning runs no session-existence check because removing an id
 * cannot introduce an unknown one, so an entry whose session is gone still
 * resolves. An id that is not pinned resolves without writing.
 * @param sessionId - The session to unpin.
 * @returns resolution after durability.
 */
unpinSession(sessionId: SessionId): Promise<void>

/**
 * Resolve by canonical directory path without creating or mutating a
 * workspace. A missing path rejects during `realpath`; an existing unowned
 * directory returns `undefined`.
 * @param path - Existing directory path in a fully qualified spelling.
 * @returns the workspace owning the canonical path, when one exists.
 */
async resolveByPath(path: string): Promise<Workspace | undefined>
```

Types: [SessionId](core.md)

Source: [`packages/workspace/workspace/src/index.ts`](../../packages/workspace/workspace/src/index.ts)

<a id="workspace-events"></a>

### `workspace/*` イベント

<a id="workspacesession-activity--waterfall"></a>

#### `workspace/session-activity` — waterfall

アーカイブ前にセッションでまだ実行中のものを構成済みプロバイダーに問い合わせる。リスナーは `next()` の結果に自身の SessionActivity エントリを先頭追加する; レジストリの最内コールバックは空リストを返すため、プロバイダーのない構成は自由にアーカイブする。非空の結果は書き込まずにアーカイブを拒否する。

```ts cordis-catalog
/**
 * Ask the composed providers what still runs for a session before it is
 * archived. A listener prepends its own {@link SessionActivity} entries to
 * the result of `next()`; the registry's innermost callback returns an
 * empty list, so a composition without providers archives freely. Any
 * non-empty result refuses the archive without a write.
 * @param request - the session about to be archived.
 * @param next - delegate to the remaining providers.
 * @mode waterfall
 */
'workspace/session-activity'( request: SessionActivityRequest, next: () => Promise<readonly SessionActivity[]>, ): Promise<readonly SessionActivity[]>
```

Source: [`packages/workspace/workspace/src/index.ts`](../../packages/workspace/workspace/src/index.ts)

<a id="workspacesession-stop--parallel"></a>

#### `workspace/session-stop` — parallel

呼び出し元が `stopActivity` 付きでアーカイブしたためセッションの実行中作業を停止する; 送出時点でアーカイブ集合は耐久である。各プロバイダーは自身のファミリー — ターン、そのサブエージェント子孫、所有ジョブ、またはアクティブスケジュール — を、ユーザー自身の停止操作と同じキャンセル経路で停止するため、セッションログは開いたターンをすべて正規に終了し、後のアーカイブ解除で会話を継続できる。リスナーは実行中作業の落ち着きを待たずに停止要求を発行する; リスナーは自身の耐久バリアを待ってもよい。リジェクトはレジストリがログに記録し、アーカイブを取り消さない。

```ts cordis-catalog
/**
 * Stop a session's running work because the caller archived it with
 * `stopActivity`; the archive set is durable when this dispatches. Each
 * provider stops its own families — cancelling a turn, its subagent
 * descendants, owned jobs, or active schedules — through the same cancel
 * paths the user's own stop actions use, so the session log ends every
 * open turn regularly and a later unarchive can continue the
 * conversation. Listeners issue their stop requests without waiting for
 * running work to settle; a listener may await its own durability
 * barrier. A rejection is logged by the registry and does not undo the
 * archive.
 * @param request - the session being archived.
 * @mode parallel
 */
'workspace/session-stop'(request: SessionActivityRequest): Promise<void> | void
```

Source: [`packages/workspace/workspace/src/index.ts`](../../packages/workspace/workspace/src/index.ts)
<!-- END GENERATED cordis-surface -->
