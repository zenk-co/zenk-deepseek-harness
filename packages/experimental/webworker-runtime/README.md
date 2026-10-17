---
description: "実験的な Web プレビューランタイムをビルド・デバッグするメンテナー向けの、ブラウザー worker によるハーネスホスティング。"
kind: "package-library"
---

# `@deepseek-ai/dsh-experimental-webworker-runtime`

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

ブラウザー worker ホスト: ハーネスのプラグインツリー全体が 1 つの専用 Web Worker 内で動作し、プレビューデプロイとパッケージングのリグレッションに使う（[experimental グループ](../README.md)）。worker はダウンロードしたパック済み VFS イメージを展開してメモリにマウントし、CommonJS ラッパーローダーを通じてそのモジュールをロードし、平文 HTTP を話す postMessage トンネルでページにサービスする。Node Host なしでパッケージ済みハーネスを実行する必要があるプレビューで使う。

## 目次

- [このパッケージを使う](#use-this-package)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

公開 npm パッケージは、ルートにランタイムライブラリ、`./worker` に自己完結したブラウザー Worker、`./client` にページコネクターを公開する。デプロイは [パッカー](../webworker-packer/README.md)を通じて VFS イメージを別途供給・配信する。このライブラリのインストールはプロファイル層を追加しない。ルートはパッカーが使うモジュールプロキシと置き換えテーブルもエクスポートする。

3 つのビルド成果物と 1 つのソース所有のプロセス層:

- **`lib/index.js`（アセンブリライブラリ）** — `createWorkerHost`/`startWorkerHost` はベースイメージと任意の順序付きデータオーバーレイ（`storage/`）をマウントし、イメージの遅延アーカイブを登録し、モジュールローダー（`module-system/`）と `process` shim をインストールし、イメージ自身の `dsh-app-boot` を通じてツリーをブートし、トンネルにその提供シームを渡す。オーバーレイは `home/` と `workspace/` の下のファイルのみを置き換えられ、ベースマニフェストやモジュールは置き換えられない。イメージレイアウト契約（`image-layout.ts`: 仮想ルート、マニフェストパス、遅延アーカイブディレクトリ、空ディレクトリ）とマニフェスト（`image-manifest.ts`: profile、installation、`lowered` ラッパー契約ゲート、遅延アーカイブ）はパッカーと共有される。Worker はランチャーと同様にマニフェストの出荷済みプロファイルをブートする: イメージの app-boot が `home/profiles/<profile>/` を出荷済みテンプレートから初期化し、イメージが単独で運ぶインストールマニフェストからバンドルを解決し、バンドル層、プロファイルパッチ、home パッチをコンポーズする。プロファイルコンテキスト、起動環境スナップショット、ランタイム解決を持たない `PluginPackages` サービスは、ランチャーが提供するのと同じように提供され、モジュール解決は Worker ローダーが所有する。プロファイルコンテキストはコマンドラインオーバーレイを運ばない。イメージの home パッチ（`home/cordis.patch.yml`）— パッカーが `PLATFORM_ENTRY_CONFIG` から書く — は JSONL セッションログを平文のまま保つ。ConfigEditor はオーバーライドをプロファイルパッチに永続化し、各書き込みを調停し、Loader がライブ値をコミットする。Worker はトンネルが提供を開始すると `appReady` をコミットするため、HMR はプロファイル変更をライブでロード・適用する。Worker の ES モジュールキャッシュは空のままで、`process` shim はエントリースクリプトを報告しないため、HMR はロード済みモジュールを比較も置き換えもしない。プラグイン管理はインストールの省略可能なバンドルを一覧・切り替えし、そのパッケージ操作は `execa` 拒否で失敗する。構成編集は現在の Worker 生存期間の間だけ持続する。
- **遅延アーカイブ** — マニフェストは、パッカーがベースイメージから移動した各ページチャンクをパスとサイズで登録し、そのアーカイブ名はイメージ URL を基準とした相対名になる。存在確認、stat、一覧は即座に応答する。最初の非同期読み取り（`fs.promises.readFile`、`fs.promises.open`、`fs.createReadStream`、`fs.promises.cp`）が、待っている全リーダーのためにそのアーカイブを 1 回フェッチして展開し、登録と照合し、変更を発行せずにそのファイルをマウントする。フェッチの失敗は読み取りを拒否し、ファイルは登録されたままになるため、次の読み取りは再びフェッチする。それまでは、登録済みファイルの同期読み取り、書き込み、追記、切り詰め、chmod、rename、link が、アーカイブ名を告げる `ERR_DSH_VFS_DEFERRED` で失敗する。unlink と再帰削除は登録を落とし、パスのシードは登録を置き換える。アーカイブ名はその内容ダイジェストから導出され、フェッチは登録されたパスとサイズのみを確認し、ダイジェストは確認しない。遅延アーカイブを登録するイメージは URL として渡されなければならない。
- **`lib/worker.js`（worker バンドル）** — アセンブリとこのパッケージの Node 互換層を 1 つの自己完結した ES モジュールにまとめたもの。モジュールプロキシテーブル（`module-proxies.ts`）が唯一のプラットフォーム分岐である: VFS/トンネル/ブラウザープリミティブ上の `node:*` ビルトイン、ブラウザーにできないことをコンソールで大きな音を立てて失敗させる構造的スタブ、ネイティブ/バイナリパッケージの置き換え。`node:module` はイメージパッケージルート上で `createRequire().resolve` と `.resolve.paths()` を提供するため、変更のないパッケージが自身のモジュールを評価せずにマニフェストを発見できる。`node-addon-require-builtin` は、ベンダーされた Loader、app-boot、HMR が `--expose-internals` なしで読む Node v24.18.0 の内部モジュールに回答する: Worker ローダー上のカスケード ESM ローダーの `resolveSync` と `import`（Node の `ERR_MODULE_NOT_FOUND` と `ERR_PACKAGE_PATH_NOT_EXPORTED` コード、空の `loadCache` 付き）、および HMR が置き換える CommonJS ローダー、パッケージリーダー、`modules` バインディング、resolve キャッシュのメンバー（呼ばれると拒否する）。`process.versions.node` は `24.18.0` を報告するため、`ModuleLoader.fromInternal()` と Loader の `internal` はそのカスケードローダーに到達する。`node:path.win32.isAbsolute` と `node:util.inherits` は Node に従い、他の `win32` メンバーは throw する。`node:util` の JSON データ比較器は自身の列挙可能プロパティを比較し、`__proto__` などの記録フィールドに対する Node の受け入れ判断を保つ。グローバルの `process` shim は `title` を含む Node 検出フィールドを運び、Worker 実行が DOM 専用の分岐に入るのを防ぐ。パック時のパーサーは、静的に名前付けされたモジュールリクエスト（名前付き `node:module` または `module` インポートを通じた `createRequire(import.meta.url)('pkg')` 形式のモジュールスコープ直接呼び出しを含む）をパッカーの到達可能性ウォークへ報告する。保存された、CommonJS 経由で得た、およびリベースされた `createRequire` 呼び出しはイメージエントリーシードを必要とする。VFS の変更は `node:fs` のコールバック、ポーリング、promise ウォッチャーを駆動し、そのリスナーは書き込み側コードの非同期コンテキストではなく、ウォッチャーが作成された非同期コンテキストで実行される。開かれたディスクリプターは rename、置き換え、unlink をまたいでファイルアイデンティティとアクセスモードを保ち、`FileHandle.stat({ bigint: true })` は名前がそのファイルを指す間、パス stat と同じ device と inode アイデンティティを報告し、`FileHandle.chmod()` は開かれたファイルアイデンティティを更新する。`readable-stream` は `node:stream/promises` の完了と pipeline ヘルパー、およびファイルストリームと Chokidar や readdirp のような変更のないイメージパッケージが使うストリーム状態機械を提供する。AsyncLocalStorage はパック時 lowering が注入するスナップショット/リストアフェイスを通じて、`await` をまたいで同期スタックの因果性を運ぶ。worker はコンパイラーを保持しない: パッカーが lowering しなかったイメージはマウント時に拒否される。コールバックの `fs.realpath.native` エイリアスはマウントされた VFS 内で解決され、`util.promisify` をサポートする。
- **`src/shell/`（worker 自身のプロセス層）** — ブラウザー worker は fork できないため、`node:child_process` はスタブではなく実装である: `spawn` はコマンドを独自の Web Worker（最初のフレームでシェルプロセスになるよう指示された、この同じバンドル）で開始し、subprocess サービスが利用する `ChildProcess` サーフェスを通じて報告する。コマンドは Host のスレッド外で実行され、`SIGKILL` はそれが何をしていようと終了させ、VFS にはメッセージによってのみ到達する（Host がそれらのフレームを処理する）。Worker のプラットフォーム実行ファイルは、JavaScript パッケージを置き換えたり、その実装を `node:child_process` に結合したりすることなく、Landlock などのネイティブパッケージプロトコルを保つ。`xdg-open` は 1 つの VFS テキストファイルをページの読み取り専用ビューアーへ送るため、**Open configuration file** のようなデスクトップオープナーアクションはページ内でファイルを表示する。通常のコマンドはパッケージのエバリュエーターと coreutils コマンドテーブルを使う。文法は `@yarnpkg/parsers` の `parseShell` で、`execSync`/`fork` は本物のプロセスを必要とするため依然として拒否する。
- **`lib/client.js`（ページ側の半分）** — 起動には 2 つの独立した段階がある。`chooseWorkerHostSource({ image?, fixtureManifest? })` は省略可能で、ブートバリアとフィクスチャマニフェストを所有する: `preview-fixture` がなければソースチューザーで待ち、有効なクエリは直接選択する。どちらの経路も順序付きのオーバーレイを返す。`connectWorkerHost(worker, { image?, overlays? })` は公開のベースランタイムコネクターのままで、チューザーを省略した呼び出し元は空のオーバーレイリストを得る。`apps/web` は両方を呼び出し、静的にバンドルされた Worker を供給する。開始時の `init` フレームはベースと順序付きオーバーレイの URL を運び、ブートペイロードは構造化された index 注入テーブルを配信し、`applyIndexInjections` がシェルエントリーの実行前にそれを実行する。スクリプトのプリロード行は助言的でスキップされる。`/plugins` リソースはトンネル経由でのみ解決されるためである。`loadBundle` は各コンボを最初の要求時にフェッチし、トンネル専用のソースマップを Base64 データ URL として埋め込み、スクリプトを Blob として実行する。worker の非要求の `view-text` フレームはページのモーダルテキストビューアーを開く。トンネルは fetch 形のトランスポート、独立したファイルアップロードキャリア、API クライアントも公開する。リクエストフレームは構造化クローンを通じて Blob ボディを保ち、`ReadableStream<Uint8Array>` の所有権を転送する。Host Worker は両方の形式をルートへストリームするため、どちらのブラウザースレッドも汎用ファイルアップロードのために完全なバイト配列を作らない。Remote ストリームのアップリンクは `stream-uplink-item` / `stream-uplink-end` フレームとして、`end` の後に到着した項目を破棄する無制限の `TunnelUplink` を越える: ページとその worker は 1 つの信頼された同一オリジン境界であるため、Host の受信箱上限は適用されない。

受け入れテストは `apps/web/tests/preview-boot.e2e.ts` にあり、実際にビルドされたページを配信し、ヘッドレス Chromium でブート前チューザーと Worker アクティベーションを駆動する。空の選択は初回起動を演習する。`vfs-example` オーバーレイは、モデルリクエストなしでコールドな Workspace/セッション探索、ツール提示、サブエージェントナビゲーション、履歴ページングを行うための通常のワークスペースファイルと平文の永続化成果物を供給する。ショーケースは空、空白のみ、非空の reasoning を、長い複数行コマンドと親パスのファイルリンクと混ぜ合わせる。これらは作成されたフィクスチャであり、ライブのモデル出力ではない。[パッカー](../webworker-packer/README.md)は Node でコミット済みの履歴ログから現世代の後継を準備する。それらのソースログはオーバーレイ内でバイト単位で同一のままである。フィクスチャ生成器が受け入れテストの現在のプロジェクションキャッシュを所有する。チューザーは WebFS を別個のユーザー認可ソースとして予約する。そのプロバイダーは組み込みフィクスチャを読まない。

[ビルド済みバンドルのインポートスイープ](tests/compile/transform-corpus-check.ts)は、ライブラリビルド後に bare な Node インポートを検査する。その Dockkit 例外は、固定された 1 つのパスではなく任意のスタイルシートに対する Node の未知の `.css` 拡張子拒否を受け入れる。別の拡張子、エラーコード、メッセージ、および予期せず成功した免除インポートはエラーのままである。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはツリーをブラウザー worker でホストし、その `node:*` 呼び出しに応答するだけであり、モデルに面する登録はすべてそれがブートするプラグインに属する。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立ても送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **worker コンポジションは平文のセッションログを書き込む**（イメージの home パッチの `compression: 'none'`。ConfigEditor はその行の構成への編集を拒否する）: Zstandard コーデックを積んでいないため、エクスポートされるログは `.jsonl` であり、`.jsonl.zstd` にはならない。
- **`node:dns/promises`、`node:vm`、`node:net`、`node:sqlite`、`node:worker_threads` は構造的スタブ**: すべての呼び出しはコンソールに拒否を報告し、Node の `ERR_FEATURE_UNAVAILABLE_ON_PLATFORM` コードで throw する。ネイティブ DNS、本物のプロセス、またはレルム分離を必要とする行はここでは実行できない。
- **`node:assert/strict` は truthiness アサーションのみをサポートする**: falsy 値に対して、呼び出し可能なデフォルトと `ok` は与えられたメッセージまたは汎用テキストで `ERR_ASSERTION` を throw するか、与えられた Error をそのまま再 throw する。他のアサーション API は存在しない。
- **ネイティブ TLS リスナーには Node Host が必要**: worker の `node:https.createServer` は平文で代替するのではなくアクティベーションを拒否する。プレビューの内部 HTTP トンネルはソケットをバインドせず、ブラウザー向けの HTTPS はデプロイサーバーに属する。
- **Desktop プロダクトテレメトリーは利用不可**: `got.post` は明示的な worker-host 拒否を報告する。Got とその Node HTTP 依存関係はブラウザーイメージから除外され、Desktop のレポートはプレビューコンポジションでは無効のままである。
- **Host パッケージコマンドは利用不可**: `execa` は明示的な worker-host 拒否を報告する。プレビューは pnpm の実行、プラグインのインストール、ネイティブ依存関係のインストールができない。
- **pi-ai モデルリクエストは利用不可**: 置き換えは、モデルのないインストール済みプロバイダー識別子の固定サブセットを公開し、アダプターが構成メタデータを登録できるようにする。その識別子は pi-ai のアップグレード時に有効のままである必要がある。推論エントリーポイントは明示的な worker-host 拒否を報告する。
- **PTC Node プログラムは利用不可**: process shim はプロバイダーがアクティベートできるよう、実行ファイルアイデンティティとして `/dsh/bin/node` を公開するが、Worker には Node 実行ファイルも `stripTypeScriptTypes` もない。プログラム実行は子の起動前に失敗する。
- **Office 変換には Node Host が必要**: LibreOffice キットの置き換えは `unavailable` でコンバーター作成を拒否する。ブラウザーイメージはキットとそのエンジン依存関係を除外し、Office プレビューは変換が利用不可であると報告する。
- **HMR はモジュールを置き換えない**: Worker の ES モジュールキャッシュは空のままなので、VFS 内で変更されたモジュールファイルは、HMR がプロファイル変更を適用する間もロード済みのコードを保つ。プレビューイメージはモジュールファイルを変更しない: パッケージ操作は `execa` 拒否で失敗する。
- **Node 内部モジュールは HMR が置き換えるメンバーにのみ回答する**: CommonJS ローダー、パッケージリーダー、`modules` バインディング、`getOrCreateModuleJob` は呼ばれると拒否し、Worker 自身の `require` は CommonJS ローダーを経由しないため、`Module._resolveFilename` や `Module._load` を置き換えても Worker の解決は変わらない。
- **CommonJS の `require('stream')` は Node の `Stream` コンストラクターではなくモジュール名前空間を返す**: それを `util.inherits` に渡すコードはロード時に失敗する。
- **遅延提供されるファイルは、アーカイブが到着する前に同期読み取りを持たない**: コンシューマーはまず非同期で読まなければならない。Host のオンデマンド Client チャンクルートはそうしている。
- **ファイルシステムウォッチャーはマウントされた VFS のみを観測する**: イメージのシードは静かで、VFS にはシンボリックリンクも外部ライターもない。`persistent`、`ref()`、`unref()` は Node API を保つが、ブラウザーは参照カウントされたイベントループを公開しないため、専用 Worker の寿命を制御できない。
- **Worker の閉じ込めは VFS 境界であり、カーネル Landlock ではない**: `read-only` と `workspace-write` は変更のない `@deepseek-ai/node-addon-system/landlock-run` の JavaScript とランチャー argv を実行するが、プロセス層が論理的な `landlock-run` 実行ファイルを実装し、すべてのシェルファイルシステムリクエストにそのグラントを強制する。したがって `full` は Worker のコマンドテーブルとマウントされた VFS のみを対象とし、任意のネイティブプロセス実行や Linux カーネル分離を主張しない。
- **worker バンドルは `@yarnpkg/parsers` 内のパスを固定する** — ビルドはパッケージのルートではなく、そのパッケージ自身の `lib/shell.js` を解決する。ルートのバレルは Syml パーサーも再エクスポートするため、その形式を決してパースしないバンドルに js-yaml を引き込む（約 175 kB、加えて worker 開始時のモジュール本体）。パスはパッケージマニフェストから導出されるので、レイアウト変更はバレルを復活させるのではなくビルドを失敗させる。依存関係のアップグレードは、シェルパーサーが依然そこにあることの再確認を意味する。
- **シェルは bash ではない**: ループ、関数、`case`、ジョブ制御、プロセス置換はない。文法はパイプライン、`&&`/`||`、サブシェル、グループ、リダイレクト、展開で止まる。`&` はそのコマンドをその場で最後まで実行し、`sed` は置換スクリプトのみを受け付け、パターンは JavaScript 正規表現で、コマンドテーブルには coreutils のみが入る（`git` なし、ネットワークツールなし）。
- **シェルプロセスには同期ファイルシステムがない**: 応答でブロックするには `SharedArrayBuffer` が必要であり、それには GitHub Pages が付与できないクロスオリジン分離が要るため、Host の VFS はメッセージで読み書きする。したがってディレクトリ走査コマンドはエントリーごとに 1 ラウンドトリップを要し、2 つの同時コマンドは書き込みを交互に混ぜることがある。
- **トランスポート、worker-host、ページ側の半分のカバレッジにはブラウザー級のハーネスが必要** — それらのモジュールではファイル単位カバレッジゲートが満たされていない。ユニットスペックは storage、ALS、transform、スタブ契約をカバーする。


<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
