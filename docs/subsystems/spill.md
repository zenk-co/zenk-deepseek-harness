# Spill ストレージ

日本語 | [English](spill.en.md) | [中文](spill.zh.md)

spill ストレージ[ケイパビリティシーム](../../.agents/notes/implemented/architecture/2026-07-08-tool-output-spill-files.md)は呼び出し元提供のテキストを永続化し、モデル向けロケーターと取得ガイダンスを返す。そのサービス定義は [dsh-spill](../../packages/spill/spill) (`ctx.spillStore`) であり、そのローカルサービスプロバイダーは [dsh-spill-local](../../packages/spill/spill-local) である。コンシューマーには[ツール結果ポリシー](../../packages/spill/spill-policy)と[セッション参照](../../packages/context/session-reference/README.md)が含まれる。Spill は任意であり、[エージェントループ脊柱](core.md)の一部ではない。コンシューマーはプレビューと spill 決定を所有し、ストレージは供給テキストを逐語で保存する。

Source: [`packages/spill/spill/src/types.ts`](../../packages/spill/spill/src/types.ts)

## 保存要求

`saveText` は唯一のサービス操作である。`content` を逐語で永続化し、不透明なロケーター、バックエンド供給の取得ヒント、正確なバイト数を返す。要求は保存時ストレージ名前空間 (`owner`)、記述的な生産者詳細 (`source`。アクセス制御では決してない)、バックエンドが命名ヒントとして使い得るパスではない `suggestedName` を運ぶ。ツールソースは実際のツール呼び出しを識別する。セッション参照ソースは取得元ソースセッションを識別し、その所有者はコンテキストを受け取る対象セッションである。

```ts type-equiv
/** One request to persist text to a spill artifact. */
interface SaveTextSpill {
  owner: SpillOwner
  source: SpillSource
  /**
   * A caller-suggested base name (e.g. `web_fetch.txt`). The backend sanitizes
   * it to a single safe path segment before use — it is a hint, never a path.
   */
  suggestedName: string
  /** The full text to persist (UTF-8). */
  content: string
}
```

```ts type-equiv
/**
 * Save-time storage namespace for a spilled artifact. The session id lets a
 * backend group storage under the producing session, but the returned
 * {@link SpillLocator} is the model-facing handle. Forked sessions inherit
 * locators already present in the seeded log; those artifacts are not copied or
 * re-owned, and spills produced after the fork use the child session id.
 */
interface SpillOwner {
  sessionId: SessionId
}
```

保持期間クリーンアップは他の古いセッション成果物と共に古いロケーターを期限切れにし得る。spill シームはセッションごとのクリーンアップポリシーを定めない。

```ts type-equiv
/**
 * Producer of a spilled artifact. Tool results carry their model-issued call id;
 * session references identify the captured source session instead. Descriptive
 * source description only, never access control.
 */
type SpillSource = {
  kind: 'tool'
  /** The tool whose result was spilled (e.g. `web_fetch`). */
  toolName: string
  /** The model-issued call id the result belongs to. */
  callId: ToolCallId
  /** A short human label for the artifact (e.g. `result`). */
  label: string
} | {
  kind: 'session-reference'
  /** Session whose projected conversation was captured. */
  sessionId: SessionId
  /** Host-provided label for the referenced session. */
  label: string
}
```

## 結果

```ts type-equiv
/** A saved spill artifact: its locator, byte length, and backend-specific retrieval guidance. */
interface SpillRef {
  locator: SpillLocator
  bytes: number
  retrievalHint: string
}
```

`SpillLocator` はバックエンドが返す[ブランド化](core.md#branded-ids)されたモデル向けハンドルである。ローカルバックエンドはそれをファイルシステムパスとして描画する。リモートまたはデータベースのバックエンドは URI、キー、コマンドトークンを描画できる。コンシューマーはそれを不透明として扱い、`read` が常に正しい取得機構と想定せず `retrievalHint` と共に描画する。

```ts type-equiv
/**
 * Opaque model-facing handle for one spilled artifact. A local backend may use a
 * filesystem path; a remote or database backend may use a URI or key. Consumers
 * render it with {@link SpillRef.retrievalHint}, but do not parse it.
 */
type SpillLocator = Branded<'SpillLocator'>
```

## サービス

`SpillStore` (`ctx.spillStore`。[`packages/spill/spill/src/index.ts`](../../packages/spill/spill/src/index.ts) で定義) は 1 メソッド抽象サービスである。`saveText(input) → Promise<SpillRef>` である。完全な `content` を永続化し、真のストレージ失敗 (権限、ENOSPC、バックエンド利用不可) で拒否する。シームはストレージのみを所有する。保持ポリシー、ツール結果置換、取得/検索 API はない。

ローカルバックエンド ([dsh-spill-local](../../packages/spill/spill-local)) は `<root>/session-<hash>/<random>-<safeName>` 配下に書く — 設定または遅延作成されたプライベート (0700) ルート、`sha256(sessionId)` セッションサブディレクトリ、所有者のみの排他 (`open(path, 'wx', 0o600)`) 書き込みであり、仕掛けられたシンボリックリンクはリダイレクトできない。その `locator` はローカルパスであり、その `retrievalHint` はそのパスに `read` または `grep` を使うようモデルに教える。ポリシーコンシューマー ([dsh-spill-policy](../../packages/spill/spill-policy)) は `maxInlineTokens` 超のテキスト/画像結果を順序付き head/tail 内容と spill アドレスで置き換える。ベストエフォートである。保存失敗は成功呼び出しを `isError` に変えずに元のインライン結果を保つ。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成 (doc-sync の `pnpm run verify-cordis-catalog` で鮮度を検証。`pnpm run gen-cordis-catalog` で再生成) — 言語面の差異はロケール固有の対訳文書パスのみである。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保つ。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxspillstore--spillstore-abstract-seam"></a>

### `ctx.spillStore` — `SpillStore` (抽象シーム)

抽象 spill ストレージサービス。サブクラス化し、saveText を実装し、サブクラスをプラグインとして読み込む — それは `ctx.spillStore` として登録される (コンテキストごとに 1 実装。2 件目の読み込みは throw する。cordis 標準の重複サービス動作)。

すべての実装が守らなければならない意味:

- saveText は完全な `content` を逐語で永続化し、不透明なロケーター、正確なバイト長、モデル向け取得ガイダンスを返す。
- ストレージは要求の SaveTextSpill.owner セッションで範囲付けされる。バックエンドはプライベートな (world-readable でない) 場所と、呼び出し元の `suggestedName` から導出されるが等しくはならない衝突なし名を選ぶ。
- `saveText` は真のストレージ失敗 (権限、ENOSPC、バックエンド利用不可) で拒否する。呼び出し元は劣化方法を決める (spill ポリシーは拒否をベストエフォートとして扱い、インライン結果を保つ)。

```ts cordis-catalog
/**
 * Persist `input.content` to a session-scoped spill artifact.
 * @param input - the owner, caller-supplied source fields, suggested name, and full text to save.
 * @returns the saved artifact's {@link SpillRef}; rejects on a storage failure.
 */
abstract saveText(input: SaveTextSpill): Promise<SpillRef>
```

Source: [`packages/spill/spill/src/index.ts`](../../packages/spill/spill/src/index.ts)
<!-- END GENERATED cordis-surface -->
