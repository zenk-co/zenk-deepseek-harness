# 作業ディレクトリ

日本語 | [English](working-directory.en.md) | [中文](working-directory.zh.md)

セッションの有効ディレクトリは [`dsh-working-directory`](../../packages/session/working-directory/README.md) が所有する。不変ヘッダーが元のプロジェクトを識別し、`working-directory/change` が後続のディレクトリ基準操作で使う実効ディレクトリを記録する。生成済み[永続化カタログ](../persistence-catalog.md)がイベント宣言を所有する。

## ディレクトリ選択

`ctx.workingDirectory.get(session)` は記録値を読む。`ensure(agent)` はそれを検証し、ディレクトリが消えていれば元のプロジェクトに復元する。`set(agent, path)` は要求された変更を検証して記録する。ヘッダーディレクトリのないセッションは設定済みランタイムフォールバックを使い、フォールバックが利用できなければエラーになる。

変更は 1 つのセッションに局所的である。相対ファイルシステム操作、新規起動プロセス、指示探索、スキル、ファイル補完は有効ディレクトリを使う。既存ターミナルと持続シェルは各自のディレクトリを保つ。サンドボックス書き込みルートとプロジェクト所属は元のプロジェクトに錨止めされたままである。

## モデル文脈

初期値と後続の現在値は、任意ランタイム文脈が無効でも、必須のユーザー文脈スナップショットとしてモデルに届く。確定した各変更は通常の Agent 受信箱経由で通知の待ち行列化を試みるが、取消や破棄により受付け前に通知が捨てられうる。ディレクトリイベントは残存し、次に受け付けられたリクエストが現在値を受ける。ディレクトリ文脈はシステムプロンプトに入らない。[`working_directory`](../../packages/session/tool-working-directory/README.md) は任意の `cd` 引数 1 つを表す。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成 (doc-sync 内の `pnpm run verify-cordis-catalog` で鮮度を検証。`pnpm run gen-cordis-catalog` で再生成) — 言語面は地域固有の対訳文書経路のみが異なる。署名ブロックは `ts cordis-catalog` フェンスを使い元のソース JSDoc を保つ。送出様式は[入門](../cordis-primer.md#dispatch-modes)で定義し、継承 `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxworkingdirectory--workingdirectoryservice"></a>

### `ctx.workingDirectory` — `WorkingDirectoryService`

各セッションの実効ディレクトリとそのモデル可視な変更の単一所有者。

```ts cordis-catalog
/**
 * Read the committed directory without filesystem I/O.
 * @param session - Session whose directory is requested.
 * @returns its effective absolute directory.
 */
get(session: Session): string

/**
 * Validate the current directory and restore the original project when it disappeared.
 * @param agent - live or unpublished Agent owning the Session.
 * @param signal - cancellation for filesystem inspection.
 * @returns the existing directory; recovery is committed before fulfillment.
 * A notice failure is warned without reverting the committed state.
 * @throws when the original project is also unavailable.
 */
ensure(agent: Agent, signal?: AbortSignal): Promise<string>

/**
 * Change one Session's directory without changing existing processes or permissions.
 * @param agent - live or unpublished Agent owning the Session.
 * @param path - absolute path or a path relative to its current directory.
 * @param signal - cancellation before the durable change.
 * @returns the canonical absolute directory, committed before fulfillment.
 * A notice failure is warned; the next request still receives the committed directory.
 * @throws when the requested path is not an existing directory.
 */
set(agent: Agent, path: string, signal?: AbortSignal): Promise<string>
```

型: [Agent](core.md) · [Session](session.md)

ソース: [`packages/session/working-directory/src/index.ts`](../../packages/session/working-directory/src/index.ts)
<!-- END GENERATED cordis-surface -->
