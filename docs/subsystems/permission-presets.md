# パーミッションプリセット

日本語 | [English](permission-presets.en.md) | [中文](permission-presets.zh.md)

[dsh-permission-presets](../../packages/interaction/permission-presets)（`ctx.permissionPresets`、`PermissionPresetService`）のパーミッションプリセット層は、2 つの独立したエンフォースメントノブ — [サンドボックスモード](sandbox.md)（`sandbox/mode`）と[承認ポリシー](approval.md)（`approval/policy`） — を名前付きプリセットに束ね、クライアントが 1 つの Permissions セレクターとして提供する。設定されたテーブルは将来のセッションのデフォルトを所有し、固定の `registerAuto(admit)` フックは [Auto review](../../packages/experimental/auto-review/README.md) 統合が現在セッション限定のオプションを 1 つのエフェクト生存期間の間公開できるようにする。この層はオプションであり、実行ポリシーを所有しない: プロンプトのナレーションとリプレイは引き続きそれぞれのノブの畳み込みを読み、Auto review が追加のエンフォースメントを所有する。[パッケージ README](../../packages/interaction/permission-presets/README.md) がコンポジションの状態と制限を所有し、[歴史的なサンドボックス切り替え設計](../../.agents/notes/archived/feature/2026-07-06-sandbox.md)が元のノブの根拠を記録している。

ソース: [`packages/interaction/permission-presets/src/index.ts`](../../packages/interaction/permission-presets/src/index.ts)

## プリセットテーブル

プリセットは 1 つの安定したキーをサンドボックス/承認のバンドルとオプションのクライアント表示にマッピングする。デフォルトの設定済みテーブルは `workspace-write`（`workspace-write` + `ask`）と `danger-full-access`（`danger-full-access` + `never`）を出荷する。`custom` と `auto` は予約済みであり、設定できない。

```ts type-equiv
/** One preset's sandbox/approval bundle and optional client presentation. */
interface PresetSpec {
  /** The `sandbox/mode` value the preset writes through. */
  sandbox: SandboxMode
  /** The `approval/policy` value the preset writes through. */
  approval: ApprovalPolicy
  /** The display label a client shows for this preset; the raw table key when omitted. */
  name?: string
  /** One user-facing sentence on what the preset means; omitted when not configured. */
  description?: string
}
```

```ts type-equiv
/** The {@link PermissionPresetService} config: preset table and composition default. */
interface Config {
  /**
   * The preset table: name → knob bundle. Defaults to `workspace-write`
   * (workspace-write + ask) and `danger-full-access` (danger-full-access +
   * never). The names `custom` and `auto` are reserved for derived state and
   * the Auto review integration respectively.
   */
  presets: Record<string, PresetSpec>
  /**
   * Default for new sessions. When omitted, the preset matching the composed
   * sandbox and approval defaults is used.
   */
  defaultPreset: Volatile<string | undefined>
}
```

このサービスは隔離を提供する `ctx.shell` エグゼキューターと `ctx.approval` を必要とし、設定ミスはプラグインのロード時に失敗する: `custom` または `auto` という名前の設定エントリーは throw し、隔離しない bash エグゼキューター（`sandboxMode` ケイパビリティファクトがない）の上にコンポーズすると、プリセットがサンドボックスモードをバンドルするため throw する。

## 固定された現在セッションの Auto 登録

Auto 統合は自身のエフェクト生存期間の間 `registerAuto(admit)` を呼び出す。このサービスは `auto` アイデンティティとその `danger-full-access` と `ask` のバンドルを固定し、記録された Auto 選択は委譲された子が固定する `never` ポリシーにも一致する。出荷されるクライアントロケール辞書が Auto のラベルと説明を所有し、設定されたプリセットの表示は Host 所有のままである。呼び出し元は汎用のコントリビューション API を通じて別のプリセットを公開できない。Auto は設定されたプリセットの後に現れ、`permission.defaultPreset` 設定スキーマに入ることは決してなく、エフェクトが破棄されると消える。同期の `admit` コールバックは Auto 選択が Session を変更する前、および保存済み Auto Session が公開される前に実行されるため、統合が存在しないか閉じている場合でも耐久アイデンティティが書き換えられることはない。

Auto の登録または削除はペイロードなしの `permission-presets/catalog-changed` 通知を発行する。プロセスコンシューマーは `catalog()` を呼ぶ前に購読し、各通知の後に完全な選択可能カタログを再読み取りする。`permissions` Session プロジェクションは `currentValue` のみを含むため、カタログの変更は Session イベントを追記せず、Session プロジェクションフレームを公開せず、Session シーケンスを変更しない。

## 現在のプリセットと派生 `custom`

`current(session)` は必須の `permissions` プロジェクションから有効なプリセットを導出する。ユニットはセッションのサンドボックスモード、承認ポリシー、記録された選択を畳み込む。その状態内で欠落した値は、エグゼキューターの設定済みモードと承認サービスの設定、次に `ask` へフォールバックする。プロジェクションキーの欠落は明示的に失敗する。このサービスは依然として一致する選択（`never` 承認ポリシーの下で記録された Auto 選択を含む）、次に最初の一致する設定エントリーを優先し、それ以外の場合は `CUSTOM_PRESET`（`'custom'`）を返す。`custom` は派生専用である: クライアントは現在の値として表示してよいが、切り替えターゲットやイベントペイロードになることは決してない。

`names` は宣言順の設定済みプリセットと、その統合がライブの間は Auto を続けて列挙する。`catalog()` はそれらの選択可能エントリーを 1 つのプロセスレベルのスナップショットとして返す。`optionOf(name)` は利用可能なエントリー（そのラベルはキーにフォールバックする）または派生 `custom` の表示を構築し、それ以外の名前は throw する。クライアントはカタログを Session プロジェクションと結合する。`custom` は現在の値にラベルを付けてよいが、カタログエントリーになることは決してない。

```ts type-equiv
/** Presentation for an available preset or the derived `custom` current value. */
interface PresetOption {
  /** Stable option value: a configured preset key, live `auto`, or derived `custom`. */
  value: string
  /** The display label. */
  name: string
  /** One user-facing sentence on what the value means; omitted when not configured. */
  description?: string
}
```

## 切り替えと `permission/preset` イベント

`set(session, name)` はプリセットを解決し（未知の名前は throw する）、該当する場合は Auto アドミッションを実行し、`name` がすでに有効なプリセットでない限りログ専用の `permission/preset` イベントを追記し、その後、そのノブの有効値が変化した場合にのみ、各ノブをそれぞれのセッター — [dsh-sandbox-policy](../../packages/sandbox/sandbox-policy) の `setSandboxMode` と [dsh-user-approval](../../packages/interaction/user-approval) の `setApprovalPolicy` — を通じて書き込む。選択イベントは同じターン内でノブイベントに先行し、有効なプリセットを再選択しても何も追記されない。

`permission/preset` は耐久性のあるログ専用のユーザー意図である: モデル transcript には入らず（ノブイベントがコンシューマーを通じてモデル可視の帰結を所有する）、2 つのプリセットがバンドルを共有するときに `current()` がユーザーがどちらを選んだかを保持できるように存在する。`permissions` プロジェクションはその選択を両方のノブイベントとともに畳み込み、復元された空のシードと新規セッションを区別するために使われる `session/end-seed` 境界を保持する。リプレイはキャッチアップ状態や生ログの再スキャンを必要としない。復元された `auto` 選択は Agent 公開の前にライブの Auto 登録を必要とする。完全なイベント宣言は[永続化ログイベントカタログ](../persistence-catalog.md)にあり、メソッドシグネチャは生成される[サービスカタログ](#ctxpermissionpresets--permissionpresetservice)にある。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

ソースから `scripts/gen-cordis-catalog.ts` によって生成される（doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。再生成は `pnpm run gen-cordis-catalog`）。言語側の違いはロケール固有の対訳ドキュメントパスのみである。シグネチャブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxpermissionpresets--permissionpresetservice"></a>

### `ctx.permissionPresets` — `PermissionPresetService`

デプロイの設定済みパーミッションプリセット、固定の Auto 統合フック、およびそれらの書き込みパスを所有する。隔離を提供する `ctx.shell` エグゼキューターと `ctx.approval` を必要とし、一致しないノブ値はエラーではなく CUSTOM_PRESET として報告される。

```ts cordis-catalog
/**
 * Read the complete process-level catalog exposed to current-session UI.
 * @returns every currently selectable preset in contribution order.
 */
@Remote('catalog') catalog(): PermissionCatalog

/**
 * Publish the fixed current-session Auto preset for the calling
 * integration's effect lifetime.
 * @param admit - synchronous gate run before live Auto selection or restore.
 * @returns the async effect disposer that removes Auto.
 */
registerAuto(admit: () => void): () => Promise<void>

/**
 * Resolve the preset matching the effective knob values. A still-matching
 * last selection wins shared-bundle ties, and a still-selected Auto also
 * matches the `never` approval policy; otherwise the first configured
 * match wins. Returns
 * {@link CUSTOM_PRESET} when no available preset matches.
 * @param session - the session whose knob state is read.
 * @returns the effective preset name, or `custom` when nothing matches.
 */
current(session: Session): string

/**
 * Resolve an available preset's knob bundle.
 * @param name - the preset name to resolve.
 * @returns the configured bundle.
 * @throws when `name` is neither configured nor the currently live Auto preset.
 */
resolve(name: string): PresetSpec

/**
 * Build the client option for an available preset or {@link CUSTOM_PRESET}.
 * A missing label falls back to the preset key.
 * @param name - a configured preset key, live `auto`, or `custom`.
 * @returns the option a client renders.
 * @throws when `name` is neither a configured preset, live `auto`, nor `custom`.
 */
optionOf(name: string): PresetOption

/**
 * Record a changed preset, then update each changed knob through its own
 * setter. Selecting the effective preset again appends nothing.
 * @param session - the session the switch belongs to.
 * @param name - the preset to switch to; unknown names throw.
 */
set(session: Session, name: string): void
```

型: [Session](session.md)

ソース: [`packages/interaction/permission-presets/src/index.ts`](../../packages/interaction/permission-presets/src/index.ts)

<a id="permission-presets-events"></a>

### `permission-presets/*` イベント

<a id="permission-presetscatalog-changed--emit"></a>

#### `permission-presets/catalog-changed` — emit

選択可能なプロセスカタログが変化した。設計上ペイロードなし: コンシューマーはまず購読し、その後で完全なカタログを再読み取りする。

```ts cordis-catalog
/**
 * The selectable process catalog changed. Payload-free by design:
 * consumers subscribe first, then re-read the complete catalog.
 * @mode emit
 */
'permission-presets/catalog-changed'(): void
```

ソース: [`packages/interaction/permission-presets/src/types.ts`](../../packages/interaction/permission-presets/src/types.ts)
<!-- END GENERATED cordis-surface -->
