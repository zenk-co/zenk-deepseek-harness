# Office から PDF への変換

日本語 | [English](office-to-pdf.en.md) | [中文](office-to-pdf.zh.md)

[document パッケージファミリー](../../packages/document/README.md)は Node ホスト上で Office ファイルを PDF に変換する。コンシューマーはソース読み取りを承認し、プレゼンテーションを所有する。共有プロバイダーは変換、制限付きアドミッション、一時的な PDF の再利用を所有する。このサブシステムはモデル向けツールもセッションイベントも作らない。

## 所有関係

| 所有者 | 責務 |
|---|---|
| [office-to-pdf](../../packages/document/office-to-pdf/README.md) | `ctx.officeToPdf`: 共有 LibreOffice 変換、制限付きアドミッション、PDF キャッシュ |
| [Web バンドル](../../packages/bundle/web-app/README.md) | ホストのコンシューマーが共有する設定可能な変換プロバイダー 1 件 |
| [Office プレビュークライアント](../../packages/client/ui-sidebar-documentpreview/README.md#office-preview) | Office 拡張子の選択、PDF の再利用、フォント不足の通知 |

## リクエストと結果

[`OfficeToPdfRequest`](../../packages/document/office-to-pdf/src/types.ts) は承認済みのソースキー/バージョン、任意の stat サイズ、遅延 `read(signal, maxBytes)` コールバック、フォアグラウンド/バックグラウンドの優先度、`OfficeExtension` (`doc`、`docx`、`xls`、`xlsx`、`ppt`、`pptx` のいずれか) を含む。`OfficeToPdf.convert(request, signal?)` は完成した PDF 結果 1 件を返す。キャンセルは呼び出し元とプロバイダーのライフタイムに従う。検証、出力、エンジンの失敗は分類済み `OfficeToPdfError` で拒否される。

`OfficeToPdfPriority` は、要求されたプレビュー/QA では `foreground`、推測実行では `background` である。`OfficeSourceKey` は呼び出し元が所有する承認済みソースロケーターにブランドを付ける。`OfficeToPdfGeneration` はプロバイダーのライフタイムにブランドを付け、`OfficeToPdfKey` はそのコンテンツアイデンティティにブランドを付ける。どちらの不透明な値もコンシューマーは解析しない。

| 結果フィールド | 意味 |
|---|---|
| `pdf` | 完成した PDF を含む呼び出し元所有の `Uint8Array` |
| `missingFonts` | この変換で利用できなかった要求文書のフォントファミリー |
| `cacheKey` | コンバーターの世代と拡張子/ソースコンテンツのアイデンティティからなる不透明な値 |
| `generation` | プロバイダーのライフタイム。置き換えるとキャッシュ済み PDF の再利用が無効になる |

プロバイダーはソースバイトを確保する前に遅延読み取りをアドミッションし、コンテンツアイデンティティごとに変換を共有し、戻る前にプライベートなスクラッチディレクトリを削除する。返された PDF バイトはプロバイダー破棄後も有効なままである。ソースバイトと PDF バイトはセッションストレージに入らない。コンシューマーは承認付き制限付き読み取りに [Workspace Files](../../packages/api/workspace-files/README.md) を使える。

## プレビュー読み取り

`RenderedDocumentBytes` はワークスペースファイルのメタデータ、ネイティブ PDF の `data`、`missingFonts`、`generation` を運び、変換済み PDF に元のソースアイデンティティが付随する。

`officeToPdf.render` リモートメソッドは、セッションの [Workspace Files](../../packages/api/workspace-files/README.md) サービスを通じてソースの承認とバージョンを確認する。変換アドミッションの後、`fs.readBytes` が予約済みバイト容量の範囲内で生入力を供給する。この読み取りには Office 入力上限が適用される。バイナリリモートは PDF をマルチパート添付に投影し、クライアント側で `ArrayBuffer` に裏打ちされた `Uint8Array` を復元する。ソースアクセスの失敗はそのまま通過する。サイズとエンジンの失敗は診断情報なしに分類済み理由を公開する。変換はエージェントを起動せず、イベントも追加しない。

`api/remotes` アセンブリは変換サービスの生成済みリモート記述子をマウントする。共有ドキュメントプレビューパッケージは Office 形式を完全バイト読み込みと既存の PDF.js Worker で登録する。各プレビュー読み取りは、進行中の変換またはキャッシュ済み PDF を共有する前にレンダラー世代、ソース承認、バージョンを再確認する。接続リセットとプラグイン破棄は要求をキャンセルし、キャッシュ済みバイトを消去する。サービスが欠落している場合はローカライズされた構成ガイダンスを表示する。

## エンジン選択と上限

外部 [`@deepseek-ai/libreoffice-kit`](https://github.com/deepseek-ai/dsh-libreoffice-kit) Node API は事前コンパイル済みエンジンを選択する。このキットは独立したバージョンとリリースワークフローを持ち、[リリース所有の決定](../../.agents/notes/implemented/architecture/2026-09-14-independent-libreoffice-kit.md)で定められている。アプリケーションビルドは公開済み npm パッケージをインストールする。アプリケーションパッケージングには対象の宣言済みネイティブエンジンが必要であり、その対象にキットがネイティブエンジンを宣言していない場合は Node WASM を使う。[プラットフォームエンジンリファレンス](../../packages/document/office-to-pdf/README.md)はインストールとパッケージングを定める。無効なメタデータ、必須アセットの欠落、変換エラーはエンジンを切り替えずに拒否される。変換はホスト上のディスク入出力パスを使い、ブラウザー変換エンジンもフォント RPC もない。

[ホストプロバイダー構成](../../packages/document/office-to-pdf/README.md#use-this-package)は並行性、期限、入出力上限、アーカイブ上限、画像解像度、フォントアクセスを所有する。ネイティブ/WASM 実装とアセット配布はキットワークスペースに属する。システム LibreOffice 探索、ランタイムエンジンダウンロード、永続 PDF キャッシュ、モデル向けレンダリングはこのプロバイダーの範囲外である。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成 (doc-sync の `pnpm run verify-cordis-catalog` で鮮度を検証。`pnpm run gen-cordis-catalog` で再生成) — 言語面の差異はロケール固有の対訳文書パスのみである。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保つ。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxofficetopdf--officetopdf"></a>

### `ctx.officeToPdf` — `OfficeToPdf`

プロバイダーライフタイムはすべてのコンバーター、キュー済み呼び出し、一時ファイルを所有する。

```ts cordis-catalog
/**
 * Convert Office bytes without modifying the source or writing Session events.
 * @param request - authorized metadata and deferred bounded source read.
 * @param signal - caller cancellation; provider disposal also stops active work.
 * @returns caller-owned PDF bytes after conversion and scratch cleanup settle; canceled readers reject independently.
 * @throws {OfficeToPdfError} Invalid input, unusable output, or engine failure; cancellation rejects with its reason.
 */
convert(request: OfficeToPdfRequest, signal?: AbortSignal): Promise<OfficeToPdfResult>

/**
 * Read and convert one Office file using the Session's ordinary filesystem authorization.
 * @param workspaceFileScope - Session header lookup shared with workspaceFiles.
 * @param path - absolute or workspace-relative Office path.
 * @param priority - foreground preview or speculative background work.
 * @param signal - Remote cancellation; disposal also cancels outstanding reads and conversions.
 * @returns complete PDF bytes with original source identity and missing font families.
 */
@Remote async render( workspaceFileScope: WorkspaceFileScope, path: string, priority: OfficeToPdfPriority, signal: AbortSignal, ): Promise<RenderedDocumentBytes>

/**
 * Read the current rendering generation before reusing a Client PDF.
 * @param signal - Remote caller cancellation.
 * @returns provider lifetime, replaced with rendering, font, or engine configuration.
 */
@Remote('generation') getGeneration(signal: AbortSignal): OfficeToPdfGeneration
```

Source: [`packages/document/office-to-pdf/src/index.ts`](../../packages/document/office-to-pdf/src/index.ts)
<!-- END GENERATED cordis-surface -->
