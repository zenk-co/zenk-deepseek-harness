---
description: "open-in-app の Host 側: インストール済みのエディター、Git GUI、ターミナル、ファイルマネージャーを macOS、Windows、Linux 上で検証済みのランチャーに解決し、カタログ、アイコン、起動エンドポイントを 3 つの webServer ルートとして提供する。"
kind: "package-reference"
---

# @deepseek-ai/dsh-host-open-in-app

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-host-open-in-app` を[ブラウザー側の対となるパッケージ](../../client/ui-open-in-app/README.md)と一緒に使うと、ユーザーはワークスペースディレクトリをインストール済みのエディター、Git GUI、ターミナル、ファイルマネージャーで開ける。本パッケージは固定のアプリケーションカタログを提供し、Host が検証できるエントリだけを表示する。新たにインストールしたアプリケーションは再起動後に現れ、見つからなくなったランチャーは検出時に削除される。リクエストにはデプロイのブラウザー認証と Host オリジンの信頼チェックが必要である。検出と起動のコマンドは設定可能な期限を使用し、起動したアプリケーションに継承済みの資格情報を渡さない。

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

本パッケージは、`webServer`、`connection`、`subprocess` を備えたコンポジションにマウントする。通常はブラウザー側の [`dsh-client-ui-open-in-app`](../../client/ui-open-in-app/README.md) の隣に置く。Host がカタログ内のインストール済みアプリケーションを少なくとも 1 つ解決できていれば、この 2 つが Web の Session ヘッダーに “Open In...” スプリットボタンを表示する。

### いつ選ぶか

ローカルのエディター、Git GUI、ターミナル、ファイルマネージャーの隣で作業するユーザーがいて、ワークスペースディレクトリをそこへワンクリックで開きたい Web デプロイに選ぶ。Host 側のコードから OS 既定のアプリケーションで 1 つのパスを開く用途には選ばない。それは `dsh-apiproxy` の `openPath` である。本パッケージの主題は *どの* アプリケーションで開くかであり、アプリケーションごとの解決とランチャーを扱う。

### 最小構成

```yaml
- name: '@deepseek-ai/dsh-host-open-in-app'
  config:
    probeTimeoutMs: 10000
    iconTimeoutMs: 10000
    launchWatchMs: 1000
```

| フィールド | 既定値 | 意味 |
|---|---|---|
| `probeTimeoutMs` | 必須 | カタログ解決の Host コマンド（`xcode-select`、Windows のレジストリ読み取り）に対するコマンドごとの期限（ミリ秒）。 |
| `iconTimeoutMs` | 必須 | アイコン抽出の Host コマンド（macOS では `plutil`/`sips`、Windows では PowerShell による抽出）に対するコマンドごとの期限（ミリ秒）。 |
| `launchWatchMs` | 必須 | 起動ごとの早期失敗の監視ウィンドウ。ウィンドウが閉じた時点でまだ実行中のランチャーは起動成功とみなされ、そのまま実行を続ける。したがってこの値は、open ルートが起動成功を保持する時間の上限を定める。 |

3 つの期限は独立しているため、1 つの操作を調整しても別の操作の応答時間は変わらない。タイムアウトは失敗の上限でありレイテンシ予算ではないので、控えめな解決/アイコンの値はコマンドが正常なときには何のコストもかからない。生成される[構成カタログ](../../../docs/config-catalog.md#deepseek-aidsh-host-open-in-app)が、受け付けるすべてのフィールドの網羅的な情報源である。

### カタログとその解決方法

カタログは固定のホワイトリストで、エディターと IDE（Cursor、VS Code と Insiders、Windsurf、Zed、Sublime Text、Xcode、Android Studio、JetBrains の IntelliJ IDEA、PyCharm、WebStorm、PhpStorm、GoLand、Rider、RustRover）、Git GUI（Fork、Sourcetree、GitHub Desktop、Tower、GitKraken、SmartGit、Sublime Merge）、ターミナル（Ghostty、Warp、iTerm2、kitty、Terminal、Windows Terminal、Git Bash、GNOME Terminal、Konsole）、およびプラットフォームごとのファイルマネージャー（Finder、File Explorer、`xdg-open`）を網羅する。各エントリはプラットフォームごとのランチャー候補を優先順に宣言し、どの候補も **検証済みランチャー**——この Host が実際に保持している成果物——を返す。素のインストール記録は返さない:

- **macOS** は既知のアプリケーションディレクトリ（`/Applications`、`~/Applications`）でエントリのバンドル綴りを確認し、`open -a <解決済みバンドル>` を起動する。Xcode は `xcode-select -p` に従うため、Beta 版や名前を変更したインストールも見つかる。Launch Services への問い合わせやディスクスキャンは実行しない。
- **Windows** は `App Paths` レジストリキーを読み、次にアンインストール記録（ディスク上の実行ファイルを証明できるものだけを保持）、次に既知のインストールパス、そしてバージョン付きインストールディレクトリを使うアプリケーションでは最新のものを読む。GitHub Desktop はバージョン付き実行ファイルを同梱の `cli.js` とともに解決し、コマンドシェルを介さずにサポート対象の `github open <path>` 動作を呼び出す。レジストリの読み取りはバッチ化され、解決パスごとにルートごと 1 回の `reg.exe query` で済む。
- **Linux と Windows の CLI 名**はコンポジションの subprocess ケイパビリティを通じてプロセス内で解決する（PATH/PATHEXT の stat。シェルも `which` も使わない）。CLI が PATH 上にない Linux の GUI エントリは、その XDG デスクトップエントリの検証済み `TryExec`/`Exec` 実行ファイルにフォールバックする。`xdg-open` ファイルマネージャーエントリは、Host がディスプレイサーバーを通知している場合にのみ現れる。

### 何を期待すべきか

[起動環境](../../util/launch-environment/README.md)の継承プロセス層に空でない `SSH_CONNECTION` または `SSH_TTY` が含まれる場合、アプリケーション一覧は空になり、Web ヘッダーは記憶された選択も含めて Open In を非表示にする。プロジェクトおよびユーザーの `.env` の値は SSH 起動を成立させない。Host はアプリケーションのプローブを省略し、利用できないアプリケーションに対するアイコン要求と起動要求を拒否する。この規則は、SSH セッションがディスプレイや VS Code の IPC 接続を伴う場合にも適用される。ランチャーが SSH マーカーを両方とも取り除くリモートデプロイは識別できない。

解決は遅延実行され、Host プロセスごとに 1 回、それを必要とする最初のリクエストで行われる。アプリケーションのインストールは次の再起動で有効になり、アンインストールは即座に自己修復する——起動時に実行ファイルが消えていることを検出すると、そのエントリだけを再解決し、もはや何も証明できなければ一覧から落とす。アイコンルートは抽出可能なすべてのプラットフォームで本物のアプリケーションアイコンを配信する。macOS ではバンドルの `.icns` を 128px PNG として、Windows では実行ファイルに関連付けられたアイコンを 32px PNG として、Linux ではデスクトップエントリの hicolor テーマのアイコン（PNG または SVG）を配信する。アイコンが欠けている場合は 404 を返し、ブラウザー側は汎用グリフを描画する。

### `./shared` サブパス

ルートパスとワイヤペイロードの型は、ブラウザーセーフな `./shared` サブパスとして公開される（定数と型のみで、ランタイムの実体はない）。ブラウザー側パッケージはこれをクライアントバンドルにインライン化する。ルートまたはペイロードの変更は `src/shared.ts` に入り、両方のパッケージがそこから取り込む。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

Linux のデスクトップエントリのフィールドとアイコンは共有の [native-command](../../util/native-command/README.md) ヘルパーを使用する。ディレクトリ用のランチャーは本パッケージのインストール済みアプリケーションカタログから、ファイルハンドラーはオペレーティングシステムの関連付けから来る。

<details>
<summary>実装内部 — クリックして展開</summary>

本パッケージはデータテーブルと 3 つの役割に分かれる。[`src/catalog.ts`](src/catalog.ts) はコンパイル時のテーブルである。各エントリのプラットフォームごとのロケーター連鎖（`fixed`、`app`、`xcode`、`cli`、`file`、`scan`、`app-paths`、`install-record`、`github-desktop`、`desktop`）に加え、Linux ではアイコンを所有するデスクトップエントリ id を持つ。[`src/resolver.ts`](src/resolver.ts) はテーブルをこの Host に対して解決する。1 回のパスでカタログ id から検証済み起動（プライマリと任意のフォールバックの argv、およびアイコンソース）へのマップを生成し、バッチ化された Windows レジストリの読み取りを 1 回共有する。argv による起動は、資格情報を除去した環境（`scrubbedParentEnv`）と明示的なアダプター項目でデタッチして spawn し、アダプターが GUI を別途起動する CLI プロセスを隠さない限り Windows の GUI プロセスを可視のまま保つ。`shell-open` 起動（ファイルマネージャー）は、同じ監視ウィンドウの下で `dsh-native-command` のパスオープナーを通じて OS シェルの open 動詞を実行する。spawn の `ENOENT` は `missing` として分類されるため、ルートは古いエントリを更新できる。[`src/icons.ts`](src/icons.ts) はプラットフォームごとにアイコンを抽出する。macOS では解決済みバンドルに対する `plutil`/`sips`、Windows では解決済み実行ファイルに対する生成された PowerShell の `ExtractAssociatedIcon` スクリプト（位置引数の `-File` によりパスがコマンドライン解析に入らない）、Linux ではデスクトップエントリ/hicolor/pixmaps のファイルシステム探索である。

[`src/index.ts`](src/index.ts) は 3 つのルートを `ctx.webServer` に登録する。`GET /open-in-app/apps`（解決マップのキー）、`GET /open-in-app/icon/<id>`（抽出されたアイコン。プロセスごとにメモリ内でキャッシュ）、`POST /open-in-app/open`（マップの検証済みランチャーを直接起動する。再検出は決してしない）。すべてのルートはまずコンポジションの `connection` サービスに拒否判定を求める。完全な信頼の話——Host/Origin フェンスとブラウザー認証——の唯一の拠り所は [`src/index.ts`](src/index.ts) のモジュールコメントにある。このフェンスに加えて、open ルートはワイヤ上でボディを検証する。`application/json` メディアタイプ、64 KiB の上限、解決済みで利用可能なカタログ id、既存ディレクトリを指す絶対パスである。解決とアイコンのコマンドはそれぞれの期限の下、[`@deepseek-ai/dsh-native-command`](../../util/native-command/README.md)（argv のみで、シェルは使わない）を通じて実行される。PATH 名はプロセス内の `ctx.subprocess.resolveExecutable()` を通る。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [dsh-client-ui-open-in-app](../../client/ui-open-in-app/README.md) — これらのルートを消費するブラウザー側のスプリットボタン。
- [dsh-subprocess](../../subprocess/subprocess/README.md) — プロセス内 PATH 解決とクリーンアップ済みの子環境を提供するケイパビリティ。
- [dsh-native-command](../../util/native-command/README.md) — 解決とアイコンのコマンド用のシェルなし Host コマンドランナー。
- [dsh-host-webserver](../webserver/README.md) — 3 つの HTTP エンドポイントを運ぶルートレジストリ。
- [Host パッケージマップ](../README.md) — 本パッケージが属する GUI Host ファミリー。

-----

<a id="model-experience"></a>
## モデル体験

なし。本パッケージは人間のために Host アプリケーションを開くだけで、プロンプト、メッセージ、スキーマ、ストリーム、ツール結果のいずれにも触れない。

#### KV キャッシュへの影響

なし。本パッケージはプロバイダーリクエストを組み立てたり送信したりしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **カタログはビルド時に固定される。** デプロイが独自のエディターや Git GUI を cordis.yml から追加することはできない。リストを拡張するには `OPEN_IN_APP_CATALOG` とブラウザー側パッケージの辞書を同時に拡張する。オペレーティングシステムは既知のアプリケーションを特定できるが、インストール済みのすべてのアプリケーションがワークスペースディレクトリを受け入れるか、どの起動プロトコルを必要とするかまでは確立できない。そのため本パッケージは OS のアプリケーション一覧を無制限に列挙しない。構成可能なカスタムハンドラーは引き続き先送りである。ユーザーが指定するラベルはロケール所有の製品コピーではなくユーザーデータである。
- **macOS の検出は既知パスのみ。** カタログの綴りを超えて改名されたバンドルや、`/Applications` と `~/Applications` の外へ移動されたバンドルは検出されない。Launch Services への問い合わせはなく（ネイティブの LaunchServices/NSWorkspace 参照にはリポジトリが持たないアドオンが必要）、ディスクスキャンは意図的に行わない。
- **アイコンの忠実度はプラットフォームに縛られる。** Windows のアイコンは `ExtractAssociatedIcon` による 32px で、ネイティブアドオンなしで標準 .NET が出せる最大であり、高 DPI ディスプレイではややぼやけて表示されうる。Linux のアイコンは hicolor テーマと pixmaps のみに従い、ユーザーが選択中のアイコンテーマには従わない。いくつかのエントリ（デスクトップエントリを持たない CLI 専用ランチャー）にはアイコンソースがなく、汎用グリフのままである。
- **新規インストールは再起動後に現れる。** 解決は Host プロセスごとに 1 回実行される。自己修復するのはアンインストール方向だけである（欠けたランチャーはその場でその 1 エントリを再解決する）。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

昇格の決定——Host と `ui-` パッケージの分割、Typert Remote ではなく素の webServer ルートを使う理由、カタログをコンパイル時固定に保つ理由、リゾルバーの再設計（検証済みランチャー、1 回の解決パス、クリックごとの再検出なし）、3 つの期限による構成、プラットフォームごとのアイコン戦略と却下した代替案——は[歴史的な昇格の Agent Note](../../../.agents/notes/archived/feature/2026-08-25-promote-open-anywhere-plugin.md) に記録されている。

</details>
