---
description: "エージェントのファイルシステムアクセスを構成またはデバッグするユーザーとメンテナー向けの、モデル向け read、read_image、write、edit ツール。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-fs

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-tool-fs` を使うと、モデルは行番号付きで UTF-8 ファイルを読み、サポートされる画像を読み、ファイルを作成またはアトミックに置換し、対象を絞ったリテラル編集を適用できる。結果は上限付きで、失敗は安定したエラーコードと回復手順を提供する。write と edit が成功した read に続くことを要求する場合は `dsh-fs-observation-policy` を追加する。それなしでは、変更はアトミックなままだが無条件である。画像の読み取りには永続的な添付ストレージと画像対応のルーティングされたモデルが必要である。glob や grep 検索には兄弟のディスカバリーパッケージを選ぶ。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と延期された作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

相対パスは Session の現在の作業ディレクトリを使う。ディレクトリの変更は、サンドボックスの許可ルートを変えずに、以降の読み取りと変更に影響する。成功した結果は `fs.processPath` からの正規の絶対パスを返し、ルート結果メタデータはリプレイとナビゲーションのためにその操作時点のパスを保持する。

`ctx.fs` バックエンドの後ろにツールをマウントし、read-before-write/edit の動作にはポリシープラグインもマウントする。するとモデルは行番号付きの読み取り、アトミックな書き込みと編集、そして添付ストアがマウントされている場合は画像の読み取りを得る。すべての結果は上限付きで、失敗は回復手順付きの安定したコードを運ぶ。

### 最小構成

バックエンド、ポリシープラグイン、次にツール。添付ストアはオプションで、`read_image` を有効にする。

```yaml
- name: '@deepseek-ai/dsh-fs-local'
- name: '@deepseek-ai/dsh-fs-observation-policy'
- name: '@deepseek-ai/dsh-tool-fs'
```

ポリシープラグインはオプションである。それなしではツールは素のプロバイダーに対して実行される（観測状態なしの無条件の write、上書き、edit）。これらのツールをロードするデプロイはそれもロードすることが期待されるため、動作は read-before-write/edit になる。`read_image` は永続的な `ctx.attachments` サービスがマウントされている間だけ登録され、実行はさらに、正確なモデルが画像入力を宣言しないルート上で拒否する。これによりテキストルートの永続履歴は画像ブロックを含まないままになる。

### ツール

| ツール | 引数 | 動作 |
|---|---|---|
| `read` | `file_path`, `offset?`, `limit?` | ページネーションフッター付きの行番号付き UTF-8 コンテンツ。`offset` は 1 始まりで、`limit` は設定された `readLimit` をデフォルトとし、それを上限とする |
| `read_image` | `file_path` | PNG/JPEG/WebP/GIF ソースを読み取って永続化する。拡張子のないパス（正規化された添付オブジェクトパスを含む）はファイルシグネチャから識別される。正規化は次のモデルリクエストの前に縮小できるため、モデルは先にサムネイルを作る必要がない |
| `write` | `file_path`, `content` | ファイルを作成または完全に置換する。ポリシープラグイン付きでは、上書きには変更されていないバージョンでの事前の `read` が必要で、作成には不要である |
| `edit` | `file_path`, `old_string`, `new_string`, `replace_all?` | `replace_all` が true でない限り一意の一致を要求するリテラル置換。ポリシープラグイン付きでは、事前の `read` と変更されていないファイルを要求する |

フィールド名は Claude Code と既存の harness ツールスキーマに合わせて snake_case である。`write` と `edit` のパス説明は、コンテンツや置換文字列より前に `file_path` を出力するようモデルに求める。これはストリーミング表示を導くが、JSON メンバー順序を強制しない。成功はコンパクトなエンベロープ（読み取りウィンドウ、画像参照、または `Created file`/`Updated file` の確認）を返し、`write`/`edit` は UI 表示用のリプレイ可能な diff カードメタデータを導出する。

### 設定

すべてのキーはオプションである。`read`、`readImage`、`write`、`edit` スイッチはデフォルトで `true`。スイッチを `false` にすると、そのツールとそのガイダンスを省略する。4 つとも無効にできる。`readImage` を有効にしても、依然として添付ストアと画像対応モデルが必要である。`read` を無効にしても読み取り上限の検証は残る。

| キー | デフォルト | 意味 |
|---|---|---|
| `read` | `true` | `read` とそのガイダンスを登録する |
| `readImage` | `true` | 添付ストアがマウントされている間 `read_image` を登録する |
| `write` | `true` | `write` とそのガイダンスを登録する |
| `edit` | `true` | `edit` とそのガイダンスを登録する |
| `readLimit` | `2000` | 1 回の `read` 呼び出しが返す行数のデフォルトかつ最大値 |
| `readMaxLineLength` | `2000` | 切り詰め前に 1 行あたり保持される文字数 |
| `readMaxBytes` | `51200` | 1 回の `read` 呼び出しで選択された行のバイト上限。オーバーフローは上限付きフッターでウィンドウを終了する |
| `readStreamMinSize` | `10485760` | このサイズ以上（またはサイズ不明）のファイルはメモリに全体をロードせずストリームする |

生成される[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-tool-fs)が、受け付けられるすべてのフィールドとその JSDoc の網羅的なソースである。

`fs-observation-policy` がマウントされ `read` が無効な場合でも、`write` はファイルを作成でき、成功した書き込みや編集はそのセッション内の以降の変更に必要なバージョンを記録する。既存の未観測ファイルは保護されたままである。`read` を無効にしてもポリシーは緩まない。既存ファイルが観測済みになるには、別のファイルシステムリーダーが `fs/observed` を発する必要がある。

### ポリシーとサンドボックスの動作

`read` と `read_image` のパス認可は完全に `ctx.fs` に属する。メディアタイプの宣言とファイルシグネチャは、`read_image` がそのバックエンドの返すバイトを受け入れるかどうかだけを決める。

ポリシープラグインがマウントされている場合、`write` と `edit` は `fs/*` intent スロットからガードを得るため、未読み取りのターゲットや古い観測は `FS_NOT_OBSERVED` または `FS_STALE_VERSION` と回復手順で失敗する。閉じ込め型バックエンド（`fs-sandbox`）では、`write`/`edit` はさらに `sandbox_permissions` と `justification` を告知する。拒否された変更は同じターンでのエスカレーションヒント付きの `[sandbox: file access denied under <mode> mode]` マーカーを返し、承認された再試行はその 1 回の呼び出しに対して厳密に広いモードを刻印してよい。justification は現在のユーザーリクエストの言語を使うようモデルに求める。

### 失敗と回復

失敗は `Error: <message>` として正規化され、呼び出し元のために構造化コードが保持される。安定したメッセージには `file_path must be a non-empty string`、`limit must be less than or equal to <max>`、`cannot read "<path>": not found`、`cannot read "<path>": not a regular file`、および画像ルートの拒否 `cannot read "<path>" as an image: model "<model>" does not declare image input; switch to an image-capable model to read images` が含まれる。`FS_NOT_OBSERVED` は、ポリシーとプロバイダーのどちらが操作を拒否したかに関係なく、`cannot modify "<path>": file has not been read — read the file, then retry` に正規化される。`FS_STALE_VERSION` はプロバイダーの理由を保持し、`— re-read the file, then retry` を付加する。再読み取りが不在を確認した後、`edit` は古い対処法を繰り返す代わりに `FS_NOT_FOUND` を報告し、`write` はガード付きの作成を使う。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

このセクションはツールスイートの背後にある設計判断を説明し、それを実現するコードを指し示す。観測可能な動作は[このパッケージを使う](#use-this-package)で完全に扱っている。

### 設計コンセプト

ツールは実行者であり、ポリシーはイベントゲートである。ツールはポリシーサービスを注入せず、キャッシュも検査しない。各変更は `ctx.waterfall` を通じて単一の intent スロットにガードを求め、各操作は成功した後にのみ `fs/observed` を発する。読み取りはプロバイダーの `stat` をちょうど 1 回行う（タイプとサイズのルーティングと観測バージョン）。変更は行わない。ガードは intent スロットから来て、プロバイダーがそのロックの下で再チェックするためである。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: `Config`、ツール構成、`read_image` の添付ゲート |
| [`src/read.ts`](src/read.ts) | `read` 実行者: stat 1 回、ストリーミング判断、ウィンドウ構築、観測 |
| [`src/read-image.ts`](src/read-image.ts) | `read_image` 実行者: ルートとメディアタイプのゲート、有界バイト、添付保存 |
| [`src/write.ts`](src/write.ts) | `write` 実行者: intent waterfall、アトミック書き込み、観測 |
| [`src/edit.ts`](src/edit.ts) | `edit` 実行者: intent waterfall、リテラル編集、観測 |
| [`src/read-render.ts`](src/read-render.ts) | Cordis 非依存のウィンドウ処理とエンベロープフォーマット |
| [`src/sandbox.ts`](src/sandbox.ts) | `write`/`edit` が共有するエスカレーション API: ポリシー解決と拒否マーカーのマッピング |
| [`src/error.ts`](src/error.ts) | ガード付き変更の失敗に対する安定したモデル向け診断 |
| [`src/mutation-result.ts`](src/mutation-result.ts) | 成功した変更の観測と正規の結果パス |

### ツールごとのフロー

4 つのツールはすべて 1 つのフロー形状を共有する。呼び出し元セッションの cwd でパスを解決し、該当するゲートを実行し、プロバイダー操作をちょうど 1 回行い、成功した後にのみ `fs/observed` を発する。`read` と `read_image` はタイプとサイズのルーティングのために `stat` を 1 回払い、`write` と `edit` は払わない。ガードが intent スロットから来るためであり、プロバイダーの失敗は型付きの `FsError` 結果として現れる。ツールごとの実行者は `src/read.ts`、`src/read-image.ts`、`src/write.ts`、`src/edit.ts` にある。

### 観測と並行性

`fs/observed` は操作が成功した後にプレーンな `ctx.emit` で発火する。リスナーは契約上、同期的で副作用のみのレコーダーであるため、非同期または失敗しうる観測はこのイベントに属さない。`read` は並行スケジューリングを選ぶ。その唯一の変更が同期的なバージョンレコーダーだからである。レコーダーの競合は、後の `write` または `edit` がターゲットロックの下でバージョンを再チェックするときにフェイルクローズし、両方の変更ツールは排他的なままである。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときにこれらのページを読む。ツールから、それが構成する契約、バックエンド、ポリシーへと進む。

- [ファイルシステムサブシステム](../../../docs/subsystems/filesystem.md) — 網羅的なプロバイダー契約、ポリシーイベント、エラー分類。
- [dsh-fs](../fs/README.md) — これらのツールが消費する `ctx.fs` 契約。
- [fs-local](../fs-local/README.md) — これらのツールが実行される対象のホストファイルシステムバックエンド。
- [fs-sandbox](../fs-sandbox/README.md) — エスカレーションフィールドを追加するサンドボックス強制バックエンド。
- [fs-observation-policy](../fs-observation-policy/README.md) — `fs/*` イベントを通じて変更をガードするポリシープラグイン。
- [生成されるツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-fs) — このパッケージが登録する網羅的なスキーマ。

-----

<a id="model-experience"></a>
## モデル体験

### システムプロンプト

#### モデルが見るもの

組み立て時に、各ガイダンスセクションは `ctx.tools.get(name, scope)` を確認し、そのツールがそのエージェントに見える間だけレンダリングする。write の段落は edit が可視の間だけ edit を推奨する。以下に示すテキストは 3 つのツールすべてが利用可能なときは変わらない。制限、その解除、ツール登録の変更は次の組み立てで有効になる。同じチェックは、直接のエージェント制限と、記述子から復元された歴史的サブエージェントフィルター（`run_code` の背後の PTC ケイパビリティを含む）でも機能する。write/edit の read-before-mutation の文は観測ポリシーを説明するものであり、`read` という名前のツールの呼び出しを要求するものではない。それらは `read` が隠されているときも残る。ポリシーは依然として変更をガードし、`command: view` を伴う `str_replace_editor` のような別の観測操作が同じファイル観測を確立できる。ツールの可視性はこの前提条件を無効にしない。

##### read ガイダンス

```markdown
Use the read tool — not shell commands like cat — to inspect text files. Use offset and limit to continue reading large files.
```

##### write ガイダンス

```markdown
Read an existing file before overwriting it with write (the default fs-observation-policy requires it) and prefer edit for targeted changes.
```

##### edit ガイダンス

```markdown
Read a file before editing it (the default fs-observation-policy requires it), unless you just created or edited it in this session.
```

#### トークンへの影響

ガイダンスのコストは、可視のツールとその適用可能なツール横断の推奨に従う。

#### KV キャッシュへの影響

可視のツールセット、プラグインスコープ、ガイダンステキストが変わらない間はプレフィックス安定である。制限やプラグインライフサイクルの変更は、最初に変わったセクションから再利用を無効化しうる。

### ツールスキーマ

#### モデルが見るもの

モデルは生成された [`read`、`read_image`、`write`、`edit` のスキーマ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-fs)を snake_case の引数とともに見る。画像ツールは永続的な添付ストアがマウントされている間だけ現れる。そのスキーマはルート非依存で、厳格なゲートが実行時に拒否する。スコープ付きツール制限は任意の定義を 1 つのエージェントから取り除ける。

#### トークンへの影響

そのツールビューでは、すべてのリクエストに固定のスキーマコストがかかる。

#### KV キャッシュへの影響

可視のツール定義とその順序が変わらない間はプレフィックス安定である。登録ライフサイクルやスコープ付き制限は、最初に変わったスキーマトークンから再利用を無効化しうる。

### read の結果

#### モデルが見るもの

成功した read は正確に `<path><resolvedPath></path>`、改行、`<type>file</type>`、改行、`<content>`、`<lineNumber>: <text>` としての番号付き行、空行、1 つのフッター、`</content>` である。フッターは正確に `(Output capped. Showing lines <start>-<end>. Use offset=<next> to continue.)`、`(Showing lines <start>-<end> of <total>. Use offset=<next> to continue.)`、または `(End of file - total <total> lines)` である。長い行は正確に `... (line truncated to <max> chars)` で終わる。見つからない read も `FS_NOT_FOUND` を返すが、呼び出し元セッションのために不在確認を記録する。外部で削除されたファイルを再読み取りした後、再試行された `write` はプロバイダーの no-replace ガードを通じて安全に再作成できる。

#### トークンへの影響

read の出力は `readLimit`、`readMaxLineLength`、`readMaxBytes` で上限付きである。保持された呼び出しと結果はコンパクションまで再送される。

#### KV キャッシュへの影響

追記のみ。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しない。

### 画像 read の結果

#### モデルが見るもの

成功した `read_image` は `<path><resolvedPath></path>`、`<type>image</type>`、およびメディアタイプ、正規化された寸法、バイトサイズを示す `<content>` エンベロープを返し、続いて画像自体がネイティブの画像ブロックとして続く。結果は次のモデルリクエストの前に、その永続参照とともにログに記録される。

#### トークンへの影響

画像はコンパクションまで以降のすべてのリクエストで課金される。各呼び出しは添付ストアの `maxImageBytes`/`maxImagePixels`/`maxImageDimension` によって独立に制限される。繰り返しの成功呼び出しは履歴を蓄積し、コンテンツアドレッシングが重複排除するのは保存バイトのみで、リクエストごとのトークンコストは重複排除しない。

#### KV キャッシュへの影響

追記のみ。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しない。

### write と edit の結果

#### モデルが見るもの

Write は正確に 5 行のエンベロープ `<path><resolvedPath></path>`、`<type>file</type>`、`<content>`、`Created file` または `Updated file`、`</content>` を返す。Edit は正確に `The file <resolvedPath> has been updated successfully.`、または `replace_all` の場合は `The file <resolvedPath> has been updated. All occurrences were successfully replaced.` を返す。書き込みまたは置換テキスト全体はアシスタントのツール呼び出し引数に残る。

#### トークンへの影響

成功テキストは小さいが、大きな変更引数と結果はコンパクションまで再送される。

#### KV キャッシュへの影響

追記のみ。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しない。

### ツールエラー

#### モデルが見るもの

失敗は `Error: <message>` として正規化される。このパッケージの安定した検証および読み取りメッセージは `file_path must be a non-empty string`、`limit must be less than or equal to <max>`、`old_string must be a non-empty string`、`old_string and new_string must differ`、`cannot read "<path>": not found`、`cannot read "<path>": not a regular file`、`offset <offset> is out of range for "<path>" (<total> lines)`、`cannot read "<path>": the <ext> extension does not declare a supported image format; read_image accepts PNG/JPEG/WebP/GIF files, including extension-less files in those formats`、`cannot read "<path>": the file content is not a supported image format; read_image accepts PNG/JPEG/WebP/GIF`、`cannot read "<path>": the bytes do not decode as a supported PNG/JPEG/WebP/GIF image; the file may be truncated or corrupt`、`cannot read "<path>" as an image: model "<model>" does not declare image input; switch to an image-capable model to read images`、および不一致の修復 `cannot read "<path>": the <ext> extension declares <type>, but the bytes use a different image format; rename the file to match its actual format if it is PNG/JPEG/WebP/GIF, or convert it to one of those formats`（拡張子なしの不一致は `cannot read "<path>": the file signature claims <type>, but the bytes decode as a different image format; the file may be corrupt` を報告する）である。16 ビット変換の失敗は `cannot read "<path>": the 16-bit PNG could not be converted to the normalized 8-bit sRGB form; convert it to an 8-bit PNG/JPEG/WebP and retry` を報告する。プロバイダーとポリシーのテンプレートはそれぞれのパッケージ README に引用されている。モデル向けエラーラッパーは、すべての `FS_NOT_OBSERVED` ソースを `cannot modify "<path>": file has not been read — read the file, then retry` に正規化する。`FS_STALE_VERSION` はプロバイダーの理由を保ち、`— re-read the file, then retry` を加える。どちらも構造化エラーコードと元の原因を保持する。その再読み取りが不在を確認した後、`edit` は古い対処法を繰り返す代わりに `FS_NOT_FOUND` を報告し、`write` はガード付きの作成を使う。

#### トークンへの影響

失敗した呼び出しだけがこれらの保持トークンを追加する。

#### KV キャッシュへの影響

追記のみ。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しない。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、ツールスイートが不向きになる、または特別な運用上の注意を要する場合を定義する。これらは現在のパッケージ制約であり、一般的なファイルシステムの比較でもタスクバックログでもない。

- **モデル向けのディレクトリ一覧は出荷されない** — `ctx.fs.listDir` はスキルディスカバリーなどのプロバイダーコードに使われ、兄弟の `dsh-tool-fs-search` パッケージがファイルシステムシームを拡張するのではなく、ripgrep を基盤とする `glob` と `grep` を提供する。
- **`read` が扱うのは UTF-8 テキストファイルのみ** — 画像は別の `read_image` ツールを使う。PDF、音声、動画は先送りのままである。ディレクトリをターゲットにすると `FS_NOT_REGULAR_FILE` になる。
- **拡張子で宣言されるメディアタイプ** — 拡張子が宣言タイプを選択し、添付ストアのマジックバイト検証が権威のままである。誤った拡張子の下にある正しい形式の画像は、sniff されるのではなくリネームの対処法付きで拒否される。ファイルシグネチャから識別されるのは拡張子のないパスのみである。
- **オブジェクトパスはソース受け入れに再入する** — 正規化された添付オブジェクトへの `read_image` はそのバイトを新しいソースとして再受け入れするため、`maxImageBytes`/`maxMessageImageBytes` が正規化画像のバイトバジェットを下回るデプロイは、`ctx.attachments.readImage` がまだ提供するオブジェクトパスを拒否しうる。出荷デフォルトは正規化バジェット（4 MiB）をソース上限（20 MiB）のはるか下に保つ。
- **インライン画像プレビューは UI 構成に乗る** — ツール結果カードは、添付プレゼンテーションプラグインが埋めるブラウザーの `tool.call.images` スロットを通じて画像を描画する。そのプラグインのない UI は代わりに結果のエンベロープテキストを表示する。
- **添付領域のツールはない** — エージェントはファイルシステムパスがあれば、別の利用可能なツールで画像を切り抜いてよい。パスのない貼り付けまたはドラッグされた画像は高解像度で再読み取りできない。
- **タイムアウトサーフェスはない** — `read`/`write`/`edit` はタイムアウト引数を取らず、タイムアウトバジェットも宣言しない。キャンセルは `exec.signal` にのみ乗る（[プロバイダーの根拠](../README.md)）。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
