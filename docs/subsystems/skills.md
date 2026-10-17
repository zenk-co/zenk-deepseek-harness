# Skills

日本語 | [English](skills.en.md) | [中文](skills.zh.md)

[skill ケイパビリティファミリー](../../packages/skill)には、Service Definition ([dsh-skill](../../packages/skill/skill)、`ctx.skills`)、ローカル Service Provider ([dsh-skill-filesystem](../../packages/skill/skill-filesystem))、省略可能な同梱プロバイダー ([dsh-skill-badge](../../packages/experimental/skill-badge)、[dsh-skill-office](../../packages/skill/skill-office)、および [dsh-sandbox-windows-acl](../../packages/sandbox/sandbox-windows-acl) 内の Windows ACL 診断プロバイダー)、そして Consumer ([dsh-tool-skill](../../packages/skill/tool-skill)) が含まれる。レジストリはホスト層とスコープごとの層にまたがってプロバイダーのカタログをマージし、プロバイダーはローカルまたは同梱のスキルを提供し、Consumer は初期カタログと置換カタログ、およびモデル向けの `skill` ツールを所有する。スキルはセッションイベントではなく省略可能な指示であるため、その語彙は [core.md](core.md) ではなくここに置かれる。

ソース: [`packages/skill/skill/src/index.ts`](../../packages/skill/skill/src/index.ts)、[`packages/skill/skill-filesystem/src/index.ts`](../../packages/skill/skill-filesystem/src/index.ts)、[`packages/experimental/skill-badge/src/index.ts`](../../packages/experimental/skill-badge/src/index.ts)、[`packages/skill/skill-office/src/index.ts`](../../packages/skill/skill-office/src/index.ts)、[`packages/sandbox/sandbox-windows-acl/src/acl-skill.ts`](../../packages/sandbox/sandbox-windows-acl/src/acl-skill.ts)、[`packages/skill/tool-skill/src/index.ts`](../../packages/skill/tool-skill/src/index.ts)。

## プロバイダーレジストリ

`ctx.skills` はローカル、組み込み、リモート、その他のプロバイダーを統合する。登録は同期であり、リモートの初期化とディスカバリーは await される `list()` に属する。プロバイダーオブジェクト、オプション、候補は読み取り専用として借用され、意味論的フィールドは検証される。

レジストリはホスト + スコープごとの層構造であり、[tools レジストリ](tools.md)が [dsh-scope](../../packages/core/scope) の上で確立した形態である: 登録は呼び出し元コンテキストのスコープの層にファイルされ、ホスト行とリポジトリプラグインはグローバル層に、エージェント preset の常設コンポジションがマウントしたプラグインはその preset の層に着地し、プロバイダー名はプロセス全体ではなく層ごとに一意である。読み取りはグローバル層と閲覧スコープのチェーンをマージする — 最も近い層のエントリーが重複するスキル名を完全に制し、以下のランク順は 1 つの層内でだけ重複を裁決する。ディスカバリーキャッシュは解決されたスコープチェーンでキー付けされるため、スコープの親の付け替え (空セッションの再コンポーズ) はレジストリの変更なしに次の読み取りから見える。

1 つの層内では、重複名は rank、プロバイダー順、次にローカル順で解決され、サマリーは名前でソートされる。拒否された `list()` はログに記録され、不完全な観測からは省略される。一方、明示的な不完全観測は使用可能な候補を提供しつつ、結果をキャッシュ可能にはしない。不正な候補は即座に失敗する。各プロバイダーファクトリーは登録スコープのコントロールを受け取る。その `invalidate()` はその正確な登録がアクティブな間だけ完了済みカタログをクリアし、そのシグナルは登録失敗または破棄で abort する。進行中のディスカバリーは、プロバイダーの世代が変わると 1 回再試行する。2 回目の変化は最新の候補を不完全かつ非キャッシュとして返す。プロバイダーとランタイムの変更はフィルターなしの `skills/change` 無効化イベントを発行する。差分を運ばないため、コンシューマーは自身のルックアップオプションで `snapshot()` を再取得する。

`SkillProvider.list()` が返す配列は完全ディスカバリーの省略記法である。`SkillProviderObservation` は、その観測が権威的でないことを報告しつつ、直接ロード可能なままの候補をプロバイダーが公開できるようにする。

```ts type-equiv
/** Provider candidates plus whether the current discovery is authoritative. */
interface SkillProviderObservation {
  /** Candidates available from the current provider discovery. */
  readonly candidates: readonly SkillCandidate[]
  /** Whether discovery completed and these candidates may be cached. */
  readonly complete: boolean
}
```

```ts type-equiv
/** Provider interface for one source of skills, such as local directories or a remote registry. */
interface SkillProvider {
  /** Unique provider name in the `ctx.skills` registry. */
  readonly name: string
  /**
   * List available skill candidates for the current lookup context. Provider
   * plugins register synchronously during `apply()`; remote initialization,
   * authentication, and discovery are awaited inside this method. Implementations
   * should settle promptly when `options.signal` aborts.
   * @param options - lookup options; `cwd` selects workspace-sensitive skills and `signal` cancels work.
   * @returns provider candidates as a complete-array shorthand, or an explicit
   *   observation when usable candidates came from incomplete discovery.
   */
  readonly list: (options: SkillLookupOptions) => Promise<readonly SkillCandidate[] | SkillProviderObservation>
  /**
   * Load a complete skill body for a previously listed candidate.
   * @param candidate - the winning candidate originally returned by this provider.
   * @param options - lookup options; `cwd` selects workspace-sensitive skills and `signal` cancels work.
   * @returns the full skill body, or `undefined` if it is no longer loadable.
   */
  readonly get: (candidate: SkillCandidate, options: SkillLookupOptions) => Promise<SkillDefinition | undefined>
}
```

```ts type-equiv
/** Registration-scoped lifecycle and invalidation capability borrowed by one provider. */
interface SkillProviderControl {
  /** Aborts if registration fails or when the exact provider registration is disposed. */
  readonly signal: AbortSignal
  /** Invalidate completed catalogs and notify consumers only while the exact registration remains active. */
  readonly invalidate: () => void
}
```

## ローカルディスカバリーの優先順位

同梱のローカルプロバイダーはランク順にルートを走査する:

| Rank | ソース | ルート |
|---|---|---|
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` |
| 300 | `custom` | `Config.customSkillDirs` |
| 400 | `user-dsh` | `<dshHome>/skills` |
| 500 | `user-agents` | `<agentsHome>/skills` |
| 600 | `bundled` | 設定されている場合は `Config.bundledSkillDir` |

プロジェクトルートは `.git` を含む最も近い祖先であり、それがなければ現在の cwd が使われる。`ctx.fs` が利用可能な場合、git ルートの探索はファイルシステムサービスを通じて `.git` を調べるため、リモートまたはサンドボックス化されたワークスペースがホストのファイルシステム境界にフォールバックすることはない。ユーザー DSH ルートはその `.system` 子をスキップする。ローカルプロバイダーはビルトインのシステムスキルを合成しない。デプロイメントは設定された同梱ルートまたは専用プロバイダーを通じて同梱スキルを提供する。

`dsh-skill-badge` は `BUNDLED_SKILL_RANK` に 1 つの不変な `bundled` 候補を登録し、同梱アセットディレクトリを `resourceBase` を通じて公開する。出荷される CLI はこのプラグインを無効として宣言しているため、そのコンポジション行の有効化は明示的なオプトインである。

Chokidar は既存のルートを監視し、バンドル/フラットエントリーの直接の追加と削除、およびスキルエントリーの直接の変更を捉える。欠落したルートは、Chokidar がアタッチできるまで、最も近い既存の祖先から 1 つの欠落パスセグメントずつ辿られる。バンドルの下のリソースファイルはカタログ変更ではない。モデル向けの `write` と `edit` の観測は、そのターゲットがカタログに関係する場合にプロバイダーを同期的に無効化し、ホストのウォッチャーは IDE、Git、シェル、外部プロセスの変更をカバーする。ウォッチャーの失敗は、直接ロードに対して読み取り可能な候補を隠すことなく、現在の観測を不完全にする。プロジェクトスコープのウォッチャーは設定された上限付き LRU を使う。

## スキルの同一性

スキル名はケバブケースである (`^[a-z0-9]+(?:-[a-z0-9]+)*$`)。ローカルプロバイダーはディレクトリバンドル (`<name>/SKILL.md`) とフラットな Markdown ファイル (`<name>.md`) を受け入れる。入れ子の再帰的な `**/SKILL.md` ディスカバリーはサポートされない。

```ts type-equiv
/** Origin bucket for a skill contribution. The value is prompt-visible metadata, not precedence by itself. */
type SkillSource = 'project-dsh' | 'project-agents' | 'runtime' | 'user-dsh' | 'user-agents' | 'custom' | 'bundled' | (string & {})
```

## サマリー、候補、完全な定義

`SkillSummary` はレジストリの呼び出し中立なサマリー形式である。どのエントリーとフィールドをレンダリングするかはコンシューマーが選ぶ。モデルセッションカタログはモデル呼び出し可能な `name` と `description` だけを使い、ボディや絶対ファイルパスは決して使わない。`SkillInvocationPolicy` は 2 つの独立した呼び出しコントロールを正のブール値に正規化し、解決されたすべてのサマリー、候補、定義がそれを運び、任意のフロントマターをドメインモデルに変えることはない。

```ts type-equiv
/** Invocation controls shared by skill discovery consumers. */
interface SkillInvocationPolicy {
  /** Whether model-facing catalogs and loaders include this skill. */
  readonly modelInvocable: boolean
  /** Whether human-facing command catalogs and loaders include this skill. */
  readonly userInvocable: boolean
}
```

```ts type-equiv
/** Invocation-neutral skill metadata returned by `ctx.skills.list()`. */
interface SkillSummary {
  /** Absolute instruction file path when supplied by the provider; absent for virtual skills. */
  readonly path?: string
  /** Kebab-case identifier used to address the skill. */
  readonly name: string
  /** Short routing description shown by discovery consumers. */
  readonly description: string
  /** Optional extra routing guidance. */
  readonly whenToUse?: string
  /** Resolved model and user invocation controls. */
  readonly invocation: SkillInvocationPolicy
  /** Discovery source that produced this winning skill. */
  readonly source: SkillSource
  /** Provider that owns this skill body. */
  readonly provider: string
  /** Provider-specific base for relative resources. */
  readonly resourceBase?: SkillResourceBase
}
```

`ctx.skills.list()` は 4 つのポリシー組み合わせすべてを保持する。`isModelInvocable(skill)` と `isUserInvocable(skill)` は対応する必須フィールドを読む。モデル専用スキルは `{ modelInvocable: true, userInvocable: false }` を設定し、ユーザー専用スキルは `{ modelInvocable: false, userInvocable: true }` を設定し、両方を `false` にするとスキルは信頼された `ctx.skills.get()` 呼び出し元だけが利用できるようになる。ローカルプロバイダーは正確なケバブケースのフロントマターキー `disable-model-invocation` と `user-invocable` を読み、省略されたフィールドは `true` にデフォルトし、解析されたすべてのスキルをこの正規化ポリシーに投影する。

`SkillCatalogSnapshot` は権威的な不在を、一時的なプロバイダー障害やディスカバリー中に変わり続けたカタログと区別する。`skills` にはその観測で収集されたソート済みの呼び出し中立サマリーが含まれ、`complete` は登録されたすべてのプロバイダーがカタログ改訂と同時に走ることなく完了した場合にのみ true になる。不完全なスナップショットはキャッシュされず、各コンシューマーは最後に良好だったフィルター済みカタログを保持して再試行できる。

```ts type-equiv
/** One catalog observation plus whether discovery completed within a stable catalog revision. */
interface SkillCatalogSnapshot {
  /** Sorted invocation-neutral summaries collected in this observation. */
  readonly skills: SkillSummary[]
  /** Whether every registered provider completed without a concurrent catalog revision. */
  readonly complete: boolean
}
```

`SkillCandidate` はプロバイダーからレジストリへの形式である。`locator` は不透明なプロバイダー状態であり、レジストリはそれを保存し、勝ったプロバイダーの `get()` に返すだけである。

```ts type-equiv
/** Provider catalog entry used by the registry to merge and later load skills. */
interface SkillCandidate extends SkillSummary {
  /** Lower ranks win duplicate skill names before provider registration order is considered. */
  readonly rank: number
  /** Opaque provider-owned handle passed back to `provider.get()`. */
  readonly locator: unknown
  /** Parsed optional metadata object from provider-specific skill frontmatter. */
  readonly metadata?: Readonly<Record<string, unknown>>
}
```

`SkillDefinition` は `ctx.skills.get()` が返し、`skill` ツールが使う、完全に解析された結果である。`resourceBase` は、ローカル、URL、またはプロバイダー管理のスキルに対する相対リソースガイダンスのレンダリング方法をツールに伝える。

```ts type-equiv
/** Optional provider-specific base used by loaded skill bodies to resolve relative resources. */
type SkillResourceBase =
  | { readonly kind: 'directory'; readonly path: string }
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'opaque'; readonly description: string }
```

```ts type-equiv
/** Complete parsed skill definition, including the body loaded by `ctx.skills.get()`. */
interface SkillDefinition extends SkillSummary {
  /** Markdown instruction body after any provider-specific metadata removal. */
  readonly content: string
  /** Parsed optional metadata object from frontmatter. */
  readonly metadata?: Readonly<Record<string, unknown>>
}
```

ランタイムスキル入力は呼び出しコントロールとプロバイダーラベルを省略できる。レジストリは両方のデフォルトを 1 回解決し、その後、プロバイダーと同じ完全な定義形式と先勝ちの収集順を使う。返された disposer はコントリビューションを除去し、ディスカバリーキャッシュを無効化する。

```ts type-equiv
/** Runtime skill contribution accepted by `ctx.skills.register()`. */
type SkillRegistration = Omit<SkillDefinition, 'invocation' | 'provider'> & {
  /** Invocation controls; omission permits both model and user surfaces. */
  readonly invocation?: SkillInvocationPolicy
  /** Provider label; omission uses the registry-owned runtime provider. */
  readonly provider?: string
}
```

## ルックアップと設定

スキルのルックアップは cwd に敏感である。プロバイダーがワークスペースローカルのスキルを公開することがあり、その省略可能なシグナルは呼び出し元のためにプロバイダーの作業をキャンセルするからである。レジストリの読み取りはさらに閲覧スコープを取る — コンシューマーは呼び出し元エージェント (それ自体がスコープキー) を渡す — `SkillViewOptions` を通じて。レジストリは層選択のために `scope` を消費し、プロバイダーは同じ借用オプションオブジェクトから自身の `SkillLookupOptions` 契約だけを読む。キャンセルはカタログ選択の前後にチェックされ (キャッシュヒットを含む)、ディスカバリーと完全定義のロードの両方と競合する。git ルートが見つからない場合、ローカルプロバイダーは供給された cwd 自体をプロジェクトルートとして扱う。

完全な定義はレジストリにキャッシュされない。各 `get()` は選択された候補とともに勝ったプロバイダーを呼ぶため、ローカルプロバイダーは現在のボディを読み直す。名前がその候補と一致しなくなった定義は拒否され、再ディスカバリーのために正確なプロバイダーを無効化する。

```ts type-equiv
/** Caller context used for cwd-sensitive and abortable provider work. */
interface SkillLookupOptions {
  /** Workspace selector for the current lookup. */
  readonly cwd?: string | undefined
  /** Abort discovery or loading work for the current caller. */
  readonly signal?: AbortSignal | undefined
}
```

```ts type-equiv
/**
 * Registry read options: provider lookup context plus the viewing scope.
 * The registry consumes `scope` to select layers; providers receive the same
 * borrowed options object and read only their {@link SkillLookupOptions}
 * contract from it.
 */
interface SkillViewOptions extends SkillLookupOptions {
  /** Viewing scope (the calling agent); omitted reads the global layer alone. */
  readonly scope?: ScopeKey | undefined
}
```

レジストリは自身のディスカバリーキャッシュ上限だけを所有する。ローカルプロバイダーはファイルシステムルート (`dshHome`、`agentsHome`、`customSkillDirs`、および省略可能な `bundledSkillDir`/`DSH_BUNDLED_SKILL_DIR`) と、ウォッチャーの有効化、ポーリング、安定性、シンボリックリンク、プロジェクト容量のコントロールを所有する。コンシューマーは自身のカタログ説明の上限を所有する。正確なデフォルトと検証は生成された[設定カタログ](../config-catalog.md)にある。

```ts type-equiv
/** Skill registry configuration. */
interface Config {
  /** Maximum number of completed cwd/provider catalogs kept in memory. */
  readonly collectCacheMaxEntries?: number
}
```

## セッションカタログとツール契約

`dsh-tool-skill` は、空でない完全なビューを観測するライブセッションの最初の `agent/pre-step` で、初期の永続的な user ロールの `<system-reminder>` を注入する。カタログにはソート済みのスキル `name` と正規化され XML エスケープされた `description` だけが含まれ、ボディ、パス、ソース、プロバイダー、ルーティングヒントは省略される。ディスカバリーはステップの abort シグナルを `SkillLookupOptions` を通じて転送する。`catalogDescriptionMaxLength` は説明の上限に関するコンシューマー設定で、デフォルトは `500`、整数の最小値は `3` である。

以降の各モデルステップの前に、コンシューマーは正確なツール可視性を適用し、完全なスナップショットから `<available_skills>` タグの間の正確なレンダリング済みエントリーをダイジェストする。比較ベースラインは、プラグインが発信元である最新の認識可能な可視カタログメッセージ内の同じエントリーから導出する。ダイジェストが変わると、`agent.inject()` を通じて永続的な完全置換を追加する。すべてのスキルを削除すると、明示的な空置換を追加する。不完全なスナップショットは最後に良好だったモデルビューを保つ。コンパクションが履歴のカタログメッセージをすべて隠した場合、次の完全なスナップショットが現在のカタログを再確立する。先行カタログのない空ビューは何も発行しない。これらのカタログメッセージはセッション履歴であり、World State ではない。

モデル向けの `skill({ name })` ツールはケバブケースの名前を検証し、呼び出し中立カタログでサマリーを見つけ、`isModelInvocable` がアクセスを許さない限りロード前に拒否し、その後、呼び出し元エージェントの cwd に対して完全な定義を読み直し、コンテンツを返す前にポリシーを再チェックする。解決できないスキルは不明またはもはや利用不可として報告し、`<skill_content name="...">`、`<skill_resources>`、`<skill_instructions>` を含むツール結果を返す。`resourceBase` は明示的に参照されたスクリプト、参照、アセットを必要な分だけ解決する。ロードされた結果がスキルディレクトリを列挙することはない。したがってボディのみの編集は、カタログメッセージを生成したり以前のツール結果を書き換えたりすることなく、以降のツール呼び出しを変える。

## ブラウザー Session カタログ

`SkillListRequest` は `sessionId` によって 1 つの Session を指定する。`SkillListValue` は、ユーザー呼び出し可能なエントリーを、名前、説明、省略可能な使用ガイダンス、モデル呼び出しの可用性とともに返す。`SessionSkillCatalog` は Agent をアクティブ化せずに Session の cwd と記録された preset を読む。ライブ Agent は自身のスコープ付きレジストリを供給でき、コールド Session は preset の常設スコープを使う。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxsessionskillcatalog--sessionskillcatalog"></a>

### `ctx.sessionSkillCatalog` — `SessionSkillCatalog`

Host service backing `ctx.remote.skills` without activating a cold Agent.

```ts cordis-catalog
/**
 * List the user-invocable skills visible to one Session composition.
 * @param request - Session identity whose cwd and preset select the catalog view.
 * @param signal - caller lifetime carried by the Remote transport; admitted catalog reads retain their existing completion semantics.
 * @returns user-invocable skill metadata without loading skill bodies.
 * @throws RemoteError when the Session cannot be inspected or no registry can serve it.
 */
@Remote async list(request: SkillListRequest, signal: AbortSignal): Promise<SkillListValue>
```

Source: [`packages/api/session-controller/src/skill-catalog.ts`](../../packages/api/session-controller/src/skill-catalog.ts)

<a id="ctxskills--skillregistry"></a>

### `ctx.skills` — `SkillRegistry`

Layered registry of skill providers, the host+per-scope shape the tools registry established. A registration files into the layer of its calling context's scope (scopeOf): host rows and repository plugins land in the global layer, while a plugin mounted by an agent preset's standing composition lands in that preset's layer. A read merges the global layer with the viewing scope's chain — the nearest layer's entry wins a duplicate name outright, and the rank order decides duplicates only within one layer. It exposes sorted invocation-neutral summaries and loads full skill bodies on demand.

```ts cordis-catalog
/**
 * Register a borrowed same-process provider synchronously during plugin
 * apply, into the calling context's layer: a scoped context (an agent
 * preset's standing mount) registers for that scope alone, an unscoped
 * context registers globally. Duplicate names within one layer and reserved
 * names throw; remote initialization belongs in `list()`. Fiber disposal
 * unregisters the provider and invalidates catalog caches.
 * @param create - synchronous factory receiving this registration's lifecycle and invalidation control.
 * @returns the exact Cordis effect disposer that unregisters this provider;
 *   composite effects may yield it directly to preserve teardown ordering.
 */
registerProvider(create: (control: SkillProviderControl) => SkillProvider): () => void

/**
 * Register a borrowed readonly runtime skill into the calling context's
 * layer. Project entries outrank runtime entries, which outrank user
 * entries, within one layer. Same-name runtime entries in one layer are
 * first-wins; a duplicate logs a warning and receives a no-op disposer so
 * it cannot remove the winner.
 * @param skill - the skill definition input; omitted invocation and provider fields receive defaults.
 * @returns the exact Cordis effect disposer, preserving composite teardown order and invalidating caches.
 */
register(skill: SkillRegistration): () => void

/**
 * List invocation-neutral skill summaries for a workspace. Consumers apply
 * model or user invocation policy at their operational boundary. Lookup
 * options and provider candidates are readonly same-process values borrowed
 * throughout discovery.
 * @param options - view options; `scope` selects the viewing agent's layers, `cwd` selects project roots, and `signal` cancels discovery.
 * @returns all sorted winning summaries.
 */
async list(options: SkillViewOptions = {}): Promise<SkillSummary[]>

/**
 * Observe the current invocation-neutral catalog and whether discovery completed within a stable revision.
 * Incomplete observations are never cached, allowing consumers to retain last-good state and
 * retry on their next request boundary.
 * @param options - view options; `scope` selects the viewing agent's layers, `cwd` selects project roots, and `signal` cancels discovery.
 * @returns sorted summaries plus discovery-completeness state.
 */
async snapshot(options: SkillViewOptions = {}): Promise<SkillCatalogSnapshot>

/**
 * Load and validate the winning candidate, passing its opaque discovery locator back to the
 * provider. Cancellation is rechecked after selection, including cache hits, and raced against
 * loading so an uncooperative provider cannot hang the caller.
 * @param name - kebab-case skill name.
 * @param options - view options; `scope` selects the viewing agent's layers,
 *   `cwd` selects workspace-sensitive skills, and `signal` cancels work.
 * @returns the full skill, including body content, or `undefined`.
 */
async get(name: string, options: SkillViewOptions = {}): Promise<SkillDefinition | undefined>
```

Source: [`packages/skill/skill/src/index.ts`](../../packages/skill/skill/src/index.ts)

<a id="skills-events"></a>

### `skills/*` events

<a id="skillschange--emit"></a>

#### `skills/change` — emit

A skill provider, runtime contribution, or provider-backed catalog may have changed. This is an unfiltered invalidation notification; consumers refetch the catalog for their own lookup options. Listener failures are contained and cannot veto the registry mutation.

```ts cordis-catalog
/**
 * A skill provider, runtime contribution, or provider-backed catalog may
 * have changed. This is an unfiltered invalidation notification; consumers
 * refetch the catalog for their own lookup options. Listener failures are
 * contained and cannot veto the registry mutation.
 * @mode emit
 */
'skills/change'(): void
```

Source: [`packages/skill/skill/src/index.ts`](../../packages/skill/skill/src/index.ts)
<!-- END GENERATED cordis-surface -->
