# プラグイン構成フォーム

日本語 | [English](settings.en.md) | [中文](settings.zh.md)

[settings サービス](../../packages/settings/settings/README.md)は有効なプロファイルエントリから揮発性 Config フィールドを射影する。[構成エディター](../../packages/boot/config-editor/README.md)は編集を Cordis パッチ経由で永続化する。業務コンシューマーは自身の Config 参照上で `.get()` を読む。

## Identity と値

フォーム名前空間は、有効なプロファイル内で一意にアドレス指定されたエントリのローカル id である。エントリ id が異なる複数のプラグインインスタンスは別々のフォームを持つ。通常フィールドは除外される。記述子は解決済み値、継承値、明示的なプロファイル上書き、楽観的リビジョンを運ぶ。

## 編集

`update` は投入されたフィールドをマージする。`replace` は投入されたフィールドを適用する前にライブフィールドを継承構成へリセットする。`mutate` は個別パスにアドレス指定し、クライアント応答にないシークレットを保持する。すべての書き込みは完全な Config を検証し、古いリビジョンを永続化前に拒む。
`settings/document-updated` は Loader 構成変更の後にフォーム記述子を無効化する。これは UI 通知であり、登録事実の更新が必要な場合にのみコンシューマーは `loader/volatile-update` を使う。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成（doc-sync の `pnpm run verify-cordis-catalog` で鮮度を検証、`pnpm run gen-cordis-catalog` で再生成）。言語面が異なるのはロケール固有の対訳文書パスのみである。シグネチャブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md)にある。

<a id="ctxsettings--settingsforms"></a>

### `ctx.settings` — `SettingsForms`

Config スキーマをフォームへ射影し、任意のインスタンスレベル UI ポリシーを所有する。

```ts cordis-catalog
/** Register the calling plugin instance's page policy without changing its Config.
 * @param presentation Automatic-page policy for this instance; `auto` defaults to true.
 * @param owner Plugin instance the policy belongs to; defaults to the calling fiber.
 * @returns Disposer; register it with the calling plugin's effects.
 * @throws If this instance already has a registered policy.
 */
configure(presentation: { auto?: boolean }, owner: Fiber = this.ctx.fiber): () => void

/** Locate the profile patch for native editing.
 * @returns The existing profile patch path.
 */
prepareDocument(): Promise<string>

/** Read active plugin schemas and their live values.
 * @param options Redaction required for remote callers.
 * @returns Forms keyed by unique profile entry ids.
 */
describe(options?: SettingsDescribeOptions): SettingsDescriptor[]

/** Merge editable fields into an entry's config.
 * @param ns Profile entry id.
 * @param patch Fields to merge.
 * @param expectedRevision Revision returned by describe.
 */
async update(ns: string, patch: object, expectedRevision?: number): Promise<void>

/** Reset all live fields, then set the supplied fields; ordinary config is preserved.
 * @param ns Profile entry id.
 * @param section Complete form values.
 * @param expectedRevision Revision returned by describe.
 */
async replace(ns: string, section: object, expectedRevision?: number): Promise<void>

/** Apply field edits without restating redacted secrets; unsetting an array index removes its element.
 * @param ns Profile entry id.
 * @param ops Ordered form edits.
 * @param expectedRevision Revision returned by describe.
 */
async mutate(ns: string, ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<void>
```

Source: [`packages/settings/settings/src/index.ts`](../../packages/settings/settings/src/index.ts)

<a id="ctxsettingscontroller--settingscontroller"></a>

### `ctx.settingsController` — `SettingsController`

生成された `ctx.remote.settings` 名前空間の裏付けとなる Host サービス。すべてのリモート読み取りは `redactSecrets: true` を使うため、`role('secret')` フィールドが応答に乗ることはない。書き込みは settings サービスのマージ・置換・パス指定操作を公開し、すべてのプロバイダー拒否をサービスメッセージ付きで `settings/conflict` または `settings/rejected` に分類する。

```ts cordis-catalog
/**
 * Describe every registered namespace for a configuration page: redacted
 * layered values plus the serialized schema the page renders its form from.
 * @returns provider writability, local-document presence, and one view per namespace.
 * @throws RemoteError when no settings provider is mounted.
 */
@Remote describe(): SettingsDescribeValue

/**
 * Merge a patch into one namespace's stored user section.
 * @param ns - namespace key to write.
 * @param patch - fields to merge into the user section.
 * @param expectedRevision - revision the caller read; `undefined` writes unconditionally.
 * @returns the namespace's redacted view after the write.
 * @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
 */
@Remote update( ns: string, patch: Record<string, JsonValue>, expectedRevision: number | undefined, ): Promise<SettingsNamespaceView>

/**
 * Replace one namespace's stored user section wholesale.
 * @param ns - namespace key to write.
 * @param section - complete replacement user section.
 * @param expectedRevision - revision the caller read; `undefined` writes unconditionally.
 * @returns the namespace's redacted view after the write.
 * @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
 */
@Remote replace( ns: string, section: Record<string, JsonValue>, expectedRevision: number | undefined, ): Promise<SettingsNamespaceView>

/**
 * Apply path-addressed edits to one namespace's user section, resolved against
 * the section as stored rather than against whatever the caller last read,
 * then answer with that namespace's new redacted view.
 * @param ns - namespace key to write.
 * @param ops - the edits to apply, in order.
 * @param expectedRevision - revision the caller read; `undefined` writes unconditionally.
 * @returns the namespace's redacted view after the write.
 * @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
 */
@Remote async mutate( ns: string, ops: SettingsPathOpView[], expectedRevision: number | undefined, ): Promise<SettingsNamespaceView>

/**
 * Materialize the provider-owned settings document and open it in a native text editor.
 * @param signal - caller lifetime; abort terminates preparation or the native command.
 * @returns confirmation after the native opener accepts the document.
 * @throws RemoteError when no document exists, preparation fails, or opening fails.
 */
@Remote async openSettingsDocument(signal: AbortSignal): Promise<SettingsDocumentOpenValue>
```

Source: [`packages/api/settings-controller/src/index.ts`](../../packages/api/settings-controller/src/index.ts)

<a id="settings-events"></a>

### `settings/*` イベント

<a id="settingsdocument-updated--emit"></a>

#### `settings/document-updated` — emit

1 つのプロファイルエントリのフォーム値、利用可否、ページポリシーが変わった。フォームクライアントはそのスキーマ、解決済み値、リビジョンを読み直す。

```ts cordis-catalog
/**
 * One profile entry's form values, availability, or page policy changed.
 * Form clients re-read its schema, resolved values, and revision.
 * @param ns Profile entry id.
 * @param revision The entry's new revision.
 * @mode emit
 */
'settings/document-updated'(ns: SettingsNamespace, revision: number): void
```

Source: [`packages/settings/settings/src/types.ts`](../../packages/settings/settings/src/types.ts)
<!-- END GENERATED cordis-surface -->
