---
description: "Web GUI 向けのワークスペースファイルサービス: 境界付きの読み取りと対象スコープのファイルシステム監視、およびセッションワークスペースルート内のディレクトリ一覧。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-workspace-files

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは、セッションのファイルシステムを通じて読めるファイルを Web クライアントからプレビューするために使う。UTF-8 テキストをページ単位で読み、境界付きのバイトウィンドウまたはファイル全体を読み、基準ファイルのディレクトリから関連ファイルを解決し、ファイルメタデータを報告する。ファイルまたはディレクトリの直接のエントリーへの変更を追跡する。ファイルの読み取りと監視はワークスペース外のパスを対象にできるが、ディレクトリ一覧と監視はワークスペーススコープのままである。このサービスは変更操作を公開しない。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

このパッケージは `dsh-fs`、`dsh-sandbox-policy`、セッションストア、Typert Gateway の隣にマウントする。バンドルはセッションコントローラーの直後にそうする。すべてのメソッドはワイヤ上でセッションアイデンティティを受け取るため、Client は `remote.workspaceFiles.read(sessionId, path, range, signal)`、`stat(sessionId, path, signal)`、`readBytes(sessionId, path, options, signal)`、`list(sessionId, path, signal)`、または `changes(sessionId, path, signal)` を呼び、ルートを自分で名指しすることはない。Host はライブセッションのヘッダーを読むか、コールドセッションには永続化の `stat` を使う。Agent をアクティベートしたり、イベント本体を読んだり、親セッションのルートを借りたりはしない。セッション永続化はライブ読み取りにはオプションだが、それがないとコールドセッションを解決できず、Gateway は `gateway/lookup-not-found` を返す。

| メソッド | 戻り値 | 目的 |
|---|---|---|
| `stat(path)` | `WorkspaceFileStat { absolutePath, version, bytes? }` | コンテンツなしの、1 つの通常ファイルのアイデンティティ、バージョン、サイズ |
| `read(path, { offset?, limit? })` | `WorkspaceFileText` = stat + `{ offset, text, lines, eof }` | UTF-8 テキストファイルからの 1 行ウィンドウ。`lines` はそれらを数えるので、1 つの空行と末尾を越えたページは異なって読まれる |
| `readBytes(path, { range?, baseFile? })` | `WorkspaceFileBytes` = stat + `{ offset, data, eof }` | 完全なファイル、または境界付きバイト範囲を `Uint8Array` として。オプションで別のファイルのディレクトリから解決する |
| `list(path)` | `WorkspaceDirectoryListing { path, entries, truncated }` | 1 つのディレクトリの直接の子 |
| `changes(path)` | `WorkspaceFileWatchFrame` のストリーム | サブスクリプションの準備完了、その後、1 つのファイルまたはディレクトリの直接のエントリーの無効化 |

### アドレッシングとパス

`read`、`readBytes`、`stat` は絶対パス、または選択されたセッションのワークスペースルートからの相対パスを受け入れる。合成されたファイルシステムがそのパスが読めるかどうかを決める。サービスはファイル読み取りにワークスペース封じ込めを課さない。`options.baseFile` 付きの `readBytes` は、相対ターゲット `path` をそのファイルのディレクトリから解決する（どちらかのファイルがワークスペース外にある場合も含む）。基準ファイル自体は絶対パスまたはワークスペース相対パスを受け入れる。どちらのファイルも同じ通常ファイルチェックを受ける。空のターゲット、絶対ターゲット、URL、NUL を含むターゲットは拒否される。ファイル結果はファイルシステムの実行ワールドでの絶対パスを報告する。`list` はワークスペーススコープのままで、一覧したディレクトリをそのルートからの相対で報告する。`changes` は同じパス解決を使う: ファイル監視はファイル読み取りの権限に従い、ディレクトリ監視はワークスペーススコープのままである。

### ページ

`read` は 1 行ウィンドウを返し、ファイル全体は決して返さない。`range.offset` は 1 始まりの最初の行で、既定は 1。`range.limit` はページ上の行の最大数で、既定は `maxLines` であり、それを超えてはならない — それより大きな limit、または正の整数でない offset や limit は `gateway/bad-request` である。行は `\n` で終わり、最後の `\n` は空行を始めるのではなく最後の行を終端する。したがって 2 行のファイルは 2 行を持つ。ページの `text` は行を `\n` で連結し、最後の後に終端子を持たない。`eof` はページがファイルの最後の行を含むときに true になり、末尾を越えた offset は `eof` が true の空ページを返す。すべてのページは、その前に実行された stat からのファイルの `version` も運び、コンシューマーは新鮮なページと古いページを見分けられる。また `bytes`（バックエンドが報告する場合のファイル全体のサイズ）も運ぶ。サービスはページを越えた最初の文字までの位置までしかファイルを読まないため、非常に大きなファイルでもリクエストごとに 1 ページ分のメモリしか消費しない。

### バイナリ読み取り

`read` は行単位でページングし、バイト単位では決して行わない。バイトウィンドウは `readBytes(path, { range: { offset?, length? } })` である。`options.range.offset` は 0 始まりの最初のバイトで、既定は 0。`options.range.length` はウィンドウ内のバイトの最大数で、既定は `maxBytes` であり、それを超えてはならない — それより長いウィンドウは短縮されて届くのではなく `too-large` で失敗し、範囲内の整数でない offset や length は `gateway/bad-request` である。ウィンドウは `Uint8Array` データとして返り、ファイル末尾では `length` より短く、末尾以降では空になる。`eof` はウィンドウがファイルの最後のバイトを含むときに true になる。何もデコードされず、バイナリとして拒否されるものもないため、画像や NUL を含むファイルは、`read` が `not-text` で失敗する場所でも読める。同じ `version` と `bytes` がページと同様に付随する。

必須の options オブジェクトは、`maxFileBytes` 未満のファイル全体には `{}` を、`maxBytes` 未満の既定バイトウィンドウには `{ range: {} }` を渡す。大きすぎるファイル全体は切り詰められて届くのではなく失敗する。`baseFile` と `range` は組み合わせ可能で、ウィンドウはファイル全体の上限とは独立している。バイナリ Remote は Connection の multipart レスポンス（JSON メタデータ + 生バイト）を使い、生成された Client は base64 デコードなしで `Uint8Array<ArrayBuffer>` を返す。呼び出し元のキャンセルはファイルシステムに到達する。このエンドポイントはデータを返し、ナビゲート可能なドキュメントは返さない。

### ファイル読み取りとディレクトリのチェック

すべての操作はまず `lstat` を使い、存在しないパスまたは誤ったファイル種別を拒否する。ファイル読み取り操作はさらに、最終シンボリックリンク（ワークスペース内を指し返すものでも）を拒否する。`list` は逆に最終リンクに従う — 任意のプラットフォーム上のディレクトリシンボリックリンク（Windows ジャンクションを含む） — そしてそれがワークスペースルート内のディレクトリに解決されることを要求するため、リンクされたディレクトリはそのターゲットのように一覧される。`changes` も監視対象ディレクトリを同じ方法で封じ込める。ファイル操作はその後、追加のワークスペース封じ込めチェックなしで合成ファイルシステムを通じて解決・読み取りを行う。構成されたページ、ウィンドウ、ファイル全体、一覧の上限は引き続き適用される。テキストページはさらに無効な UTF-8 と NUL バイトを拒否する。バイト読み取りはコンテンツをデコードしない。空の読み取りまたは一覧パスは `gateway/bad-request` である。

### 変更フィード

`changes` はターゲットパスのみを受け入れる `stream` Remote である。Host は `stat` からターゲットの型を導出し、その型がディレクトリであるときは常に（型変更後も含めて）ワークスペース封じ込めを要求する。ジェネレーションは自身の観察キューを登録し、ターゲットを解決し、`{ kind: 'ready' }` を yield する前に `fs.watch` を開始する。その後 `{ kind: 'change', change }` を yield する。ここで `change` は現在の stat メタデータ `{ absolutePath, version }` または `{ absolutePath, absent: true }` である。ローカルプロバイダーは Chokidar を使い、ディレクトリは直接のエントリーのみを監視する。一致する `fs/observed` の発火もターゲットを無効化する。ジェネレーションはセットアップ中に変更をキューする。キャンセルはコンシューマーの pull とは独立にウォッチャーを閉じ、ジェネレーションまたはプラグインのティアダウンは閉鎖を待つ。存在しないファイルは、親ディレクトリが残っている限り、同じパスでの再作成のために監視可能なままである。

### 構成

| フィールド | 既定値 | 意味 |
|---|---|---|
| `maxBytes` | `2097152` (2 MiB) | 1 ページのテキストと 1 つのバイトウィンドウに対する境界を含むバイト上限。それより大きなページやウィンドウは失敗する |
| `maxFileBytes` | `33554432` (32 MiB) | `range` なしの `readBytes` に対するファイル全体の境界を含む上限。それより大きなファイルは `too-large` で失敗する |
| `maxLines` | `5000` | 既定かつ最大のページサイズ（行数）。それより大きな `limit` は拒否される |
| `maxEntries` | `2000` | 返されるディレクトリエントリーの上限。残りは切り捨てられ、切り詰められたことが報告される |

生成された[構成カタログ](../../../docs/config-catalog.md#deepseek-aidsh-api-workspace-files)が、受け入れられる全フィールドとその JSDoc の網羅的な情報源である。

### 失敗

各失敗は型付き詳細を持つ 1 つの `RemoteError` コードであり、[`src/types.ts`](src/types.ts) で宣言される: `workspace-file/not-found`、`workspace-file/outside-workspace`（ディレクトリ一覧または監視）、`workspace-file/watch-unsupported`（監視の初期化失敗）、`workspace-file/too-large`（`limit` 付き、該当するページ、ウィンドウ、またはファイル全体の上限）、`workspace-file/not-text`、`workspace-file/not-regular-file`（`kind`: `directory`、`symlink`、または `other`）、および `workspace-file/not-directory`（`kind`: `file`、`symlink`、または `other`）。呼び出し元はコードで分岐し、メッセージテキストでは決して分岐しない。

### Client ファイルリソース

ブラウザエクスポートは `file` プロバイダーを `ctx.resources` に登録し、`resources`、`remote`、`remote.workspaceFiles` を要求する。バンドルの単一の `workspace-files` 行が両方のフェイスを供給し、Client に別個の構成はない。コンポーネントは `useResource<'file'>(address)` を通じて `WorkspaceFileStat { absolutePath, version, bytes? }` メタデータを読み、コンテンツはテキストまたはバイナリの Remote を通じて別途取得する。Global コンポーネントを含むどの UI も、同じ完全なアドレスの観察を共有する。

`session/<sessionId>/<path>` アドレスは、認可するセッションと相対または絶対パスを運ぶ。先頭のスラッシュは保持される（例: `dsh-resource://file/session/s//etc/hosts`）。Host はパスをそのまま受け取り、解決とアクセスチェックを所有する。Client はセッションの `cwd` を必要としない。`absolute/<path>` はパース可能なままだが、認可するセッションを持たず、現在または Tab のセッションを借りることなく `workspace-file/unknown-workspace` で失敗する。サポートされないアドレスは `workspace-file/unsupported-address` で失敗する。[Workspace-path](../../util/workspace-path/README.md) が文法を所有し、汎用 Resource 層はアドレスと `signal` だけを知る。

プロバイダーは最初の `stat` の前に Host の `ready` フレームを待ち、読み取り中は変更をキューし、その後フォロワーを `stat.absolutePath` に結合する。キューされた変更もライブの変更も、その Host が返したパスに一致する。新しいバージョンまたは不在の通知はファイルを再 stat し、パス、バージョン、バイトサイズを一緒に更新する。重複するバージョンは無視される。失敗した stat はアドレスをフォローされたままにし、後のターゲット変更がそれを回復できるようにする。ready の前に観察が終了した場合（`watch-unsupported` を含む）でも、キャンセルされていないプロバイダーは 1 回の stat を実行してその結果を yield する。フレームは `RemoteResult` 値であり、プログラミング例外は捕捉されないままである。

1 つの監督された `changes` ストリームが各セッションと要求されたパスにサービスし、そのターゲットのコンシューマーはそれを共有する。フォロワーはバックスラッシュをスラッシュに正規化した絶対パスで照合する。キャリアの喪失は Gateway スーパーバイザーを通じて再接続し、新しい ready フレームが再び stat をトリガーする。Host が終了したフィードまたは最終的に失敗したフィードはフォロワーを終了させ、再オープンまで最後のメタデータを読めるままにする。最後のフォロワーが去るとストリームがディスポーズされ、後継者はそのディスポーズを待ち、プラグインのティアダウンはすべての保留中のクローズを待つ。プロバイダーは `ResourceProtocolMap.file` を宣言し、テキストプレビューはそのサイドバー行ナビゲーションパラメーターを宣言する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

### 設計コンセプト

`ctx.fs` を通じた読み取りはバックエンドの読み取り権限を使う。サンドボックス化バックエンドは書き込みと編集を柵で囲み、読み取りは囲まない。Typert ルックアップはライブセッションのヘッダー、または永続化サービスのヘッダーのみの `stat` から `WorkspaceFileScope` を導出するため、コールドなサブエージェントセッションは Agent アクティベーションもイベント本体の読み取りも必要としない。サービスは通常ファイルチェックと境界付き転送を加え、ワークスペース封じ込めはディレクトリ一覧とディレクトリ監視にのみ属する。ページは `streamText` から切り出される。これはチャンクごとにデコードし、非 UTF-8 を拒否する: カッターはウィンドウの前の行を保持せずに数え、ウィンドウ内の各セグメントをバッファリングする前にバイト上限に対して認め、ウィンドウを越えた最初の文字で戻る。ストリームの前の 1 回の `stat` が、ページが報告するバージョンとサイズを名指しする。

ファイル全体の読み取りはサイズの強制を `fs.readBytes` に委譲し、生バイトをバイナリ Remote を通じて返す。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | `WorkspaceFiles`: `workspaceFiles` サービスと Remote 名前空間、`Config`、ゲート、ページカッター、`read`、`readBytes`、`stat`、`list` |
| [`src/changes.ts`](src/changes.ts) | `WorkspaceChangeFeed`: ターゲットウォッチャー、一致する `fs/observed` 通知、ジェネレーションごとの 1 つのキュー |
| [`src/types.ts`](src/types.ts) | ワイヤ型と `RemoteErrorDetailsMap` コード。Client パッケージ向けに `./types` として公開される |
| [`src/client/index.ts`](src/client/index.ts)、[`provider.ts`](src/client/provider.ts)、[`change-feed.ts`](src/client/change-feed.ts) | ブラウザプラグイン、ファイルメタデータ、ターゲットごとの変更フィード |
| [`src/client/types.ts`](src/client/types.ts)、[`remote.ts`](src/client/remote.ts) | リソース値、パラメーター、Client エラーコード、生成された Remote 型 |

Typert は `./typert` と `./remote` が公開する Host と Client の Remote アーティファクトを生成する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [ファイルシステムケイパビリティ](../../fs/fs/README.md) — このサービスが読み取りに通す `ctx.fs` 契約（`fs/observed` と `readByteRange` を含む）。
- [サンドボックスポリシー](../../sandbox/sandbox-policy/README.md) — セッションのワークスペースルートの出所。
- [Remote アセンブリ](../../api/remotes/README.md) — Client パッケージが `workspaceFiles` 名前空間に到達する方法。
- [Client リソース](../../client/resources/README.md) — リソースモデル、`useResource`、ピン、プロバイダーの寿命。
- [ワークスペースパスヘルパー](../../util/workspace-path/README.md) — `fileAddressFor` と `parseFileAddress`、両端が共有する `dsh-resource://file/…` アドレス文法。
- [サイドバーテキストプレビュー](../../client/ui-sidebar-documentpreview/README.md) — `file` プロバイダーを通じてファイルを追跡し、そのページを読むタブ型。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはツールを登録せず、プロンプトセクションを提供せず、セッションイベントを追加しない。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立てず、送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **プロバイダーの監視サポート** — SSH を含むサポートされないバックエンドは `watch-unsupported` を報告する。通常の読み取りと手動リフレッシュは利用可能なままで、外部変更のポーリングはない。
- **Linux の親ディレクトリ再作成** — 親ディレクトリが削除・再作成された後の自動監視回復は先送りである。[fs-local](../../fs/fs-local/README.md) を参照。
- **ディレクトリスコープのみ** — ディレクトリ一覧と監視はセッションワークスペース内にとどまる。ファイル読み取りと監視はファイルシステムバックエンドの読み取り権限を使う。
- **総行数なし** — ページは `eof` を報告し、続く行数は報告しない。総数が必要なコンシューマーは末尾までページングするか `bytes` から推定する。
- **1 つの巨大な行はページを持たない** — `maxBytes` を超える単一行は、それを含むすべてのウィンドウで `too-large` に失敗する。ページは行単位で切り出され、バイト単位ではないためである。
- **読み取りはトランザクショナルではない** — 結果メタデータはコンテンツを読む前の stat から来る。並行書き込みは報告されたバージョンと返されたコンテンツを食い違わせ得る。
- **無制限のジェネレーションキュー** — `changes` ジェネレーションは、コンシューマーが pull するまで操作の観察とターゲットの無効化をバッファリングする。停滞したコンシューマーはストリームの生存期間中 Host メモリを増大させる。
- **`maxEntries` は回答を制限し、一覧を制限しない** — `list` は `ctx.fs.listDir` にすべての子を要求し、その後で配列を切り詰める。そのため上限をはるかに超えるディレクトリでも Host は一覧全体のコストを払う（`fs-local` では子ごとに 1 回の stat）。その作業を制限するにはファイルシステムシームの `listDir` に上限が必要である。
- **死んだフィードはメタデータを保持する** — Host が `changes` を終了した後、またはストリームが最終的に失敗した後、オープンされた値は再オープンまで最後の状態を保持する。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
