# プラグインのパッケージ化とインストール

日本語 | [English](publish.en.md) | [中文](publish.zh.md)

前のチュートリアルでは、`--patch` オーバーレイを通じてローカルプラグインをロードした。このチュートリアルでは、それをインストール可能な **バンドル** としてパッケージ化し、`dsh plugin add` で **プロファイル** にインストールし、合成後の設定を決めるレイヤー順序を説明する。`dsh` CLI がインストール済みであることを前提とする。先に [プラグイン構成](./config.md) を完了すること。

代わりに新しいソースチェックアウトを使う場合は、[run-from-source セクション](../../../../README.md#run-from-source) を完了し、このチュートリアルの `hello-plugin` ディレクトリをリポジトリルートに置き、残りの `dsh ...` コマンドをそこから `pnpm dsh ...` として実行する。ビルドとランチャーの動作は [source execution](../../../../apps/cli/reference/README.md#source-execution) を参照。

## 2 つの概念、2 つのマニフェスト

インストールは 2 つの概念の上に成り立っている。どちらも `package.json` で記述されるが、`dsh` キーの下に異なる種類のマニフェストを持ち、異なる問いに答える:

- **バンドル** は構成レイヤーを出荷する npm パッケージである。そのマニフェストは `dsh.bundle` を宣言し、「このパッケージは何を貢献するか」に答える。すなわち、プラグイン行を挿入または上書きするパッチファイルである。
- **プロファイル** は `$DSH_HOME/profiles/<name>` 配下のディレクトリで、1 つの実行可能な構成を記述する。そのマニフェストは `dsh.profile` を宣言し、「どのバンドルが、どの順序でこのセットアップを構成するか」に答える。

バンドルはあなたが作成して配布するものであり、プロファイルはユーザーが `dsh --profile <name>` で起動するものである。両方であるものはない。

### バンドルマニフェスト

パッケージディレクトリを作成する:

```sh
mkdir -p hello-plugin
```

```
hello-plugin/
├── package.json       # declares dsh.bundle
├── cordis.patch.yml   # the layer applied when a profile lists this bundle
└── index.js           # plugin modules the patch rows reference
```

`hello-plugin/package.json` を作成する:

```json
{
  "name": "dsh-hello-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "files": ["index.js", "cordis.patch.yml"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

プラグインエントリポイントを持つ `hello-plugin/index.js` を作成する:

```js
export const name = 'hello-plugin'

export function apply() {
  console.log('[hello-plugin] plugin loaded!')
}
```

`hello-plugin/cordis.patch.yml` を作成する。パッチは、あなたが書いた `--patch` オーバーレイと同様の YAML 配列だが、プラグイン行が相対ソースパスではなく名前でパッケージを参照する点が異なる。これにより Node の解決がインストール済みコードを見つける:

```yaml
- insert:
    - id: hello
      name: dsh-hello-plugin
```

`patch` はファイルの順序付きリストも受け入れる。たとえば `["./base.patch.yml", "./web.patch.yml"]` である。ランチャーはそれらをその順序で 1 つのレイヤーとして適用し、各ファイルの相対プラグインパスはそのファイルの隣で解決される。`dsh.bundle` 宣言のないパッケージもインストールできるが、プレーンな依存関係としてだけである。`dsh plugin` は警告を出力し、レイヤーを有効化しない。そのパッケージ形式は、ユーザーが有効化するプラグインではなく、プラグインパッケージが import するライブラリに使う。

バンドルがサポートする DSH リリースを `engines.dsh` SemVer 範囲で宣言する。たとえば `"engines": { "dsh": ">=0.2.0 <0.3.0" }` である。インストールとプロファイル起動は、実行中の DSH が満たさない範囲のバンドルを拒否する。`engines.dsh` がない場合は、代わりにその `@deepseek-ai/dsh*` peer 依存関係の範囲をチェックする（[rule](../../../../packages/boot/app-boot/README.md#profiles)）。

### プロファイルマニフェスト

プロファイルディレクトリは 2 つのファイルを保持する:

- `package.json` — プロファイルのツリー外プラグイン依存関係（pnpm が管理）と、順序付き `bundles` リストを持つ `dsh.profile` マニフェスト。
- `cordis.patch.yml` — ユーザー自身のパッチレイヤー。すべてのバンドルレイヤーの後に適用される。

プロファイルマニフェストを手書きすることはない。`dsh --profile <name> --from-default-profile <template>` が出荷済みアプリケーションテンプレートから作成またはリセットでき、`dsh plugin` は base に支えられたプロファイルを作成し、そのインストール済みバンドルリストを維持する。作成ルールは [CLI 動作リファレンス](../../../../apps/cli/reference/README.md#profile-boot) が所有する。次の節でプラグインの手順を示す。

## プロファイルへインストール

`dsh plugin --profile <name> <args...>` はプロファイルディレクトリ内の pnpm に転送されるので、すべての pnpm 動詞が動作する。`hello-plugin` を含むディレクトリから、パッケージチェックアウトをインストールする:

```sh
dsh plugin --profile demo add ./hello-plugin
```

最初の使用でプロファイルが初期化され（最初のバンドルとして `@deepseek-ai/dsh-base` を持つ）、pnpm がチェックアウトをリンクし、パッケージが `dsh.bundle` を宣言しているので `dsh` がバンドルを `dsh.profile.bundles` に追記する:

```json
{
  "name": "dsh-profile-demo",
  "private": true,
  "dependencies": {
    "dsh-hello-plugin": "link:/path/to/hello-plugin"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "dsh-hello-plugin"
      ]
    }
  }
}
```

リンクされたチェックアウトは独自の `node_modules` を保持する。プラグインがホストとインスタンスを共有しなければならない dsh パッケージは、harness パッケージと同様に `peerDependencies` と `devDependencies` の両方で宣言する。そのマニフェストのルックアップ位置で、実行中の dsh のランタイム解決に存在する peer はインストール側のコピーを使い、devDependency のコピーは型チェッカーとスタンドアロンテストに奉仕する。独立してバージョン管理されるサードパーティ依存関係とステートレスな dsh ユーティリティは `dependencies` に置く。

通常のリンクされた import は Node の祖先順に従い、各ディレクトリの現在の peer 宣言をチェックする。より近い物理パッケージが、より上位の peer 宣言より優先される。リンクターゲットは `package.json` を欠くことができる。そのマニフェストの隣に物理的な `node_modules` がなくても、祖先 peer は適用される。明示的な `require.resolve(..., { paths })` は常にネイティブであり、プロファイル内のパスも含む。これらのルールは npm、Desktop、ソース起動で共有される。ロード済みモジュールを無効化したり、peer バージョン範囲を検証したりはしない。スコープとファイルクエリの動作は [resolution rules](../../../../.agents/notes/implemented/architecture/2026-09-19-profile-resolution-lookup-order.md) を参照。

広いチェックアウトをリンクしても、実行中インストール自身のパッケージディレクトリに peer インターセプションは適用されない。ターゲットがプロファイル内 — その pnpm ストアを含む — にとどまるリンクは、外部のリンク済みルートではなくプロファイル所有のインストール内容のままである。重複する外部リンクはルックアップ順序を変えない。各リクエストは依然としてその importer のディレクトリから始まる。

起動せずにレイヤーを検証し、次に起動する:

```sh
dsh --profile demo --dump-config   # shows a "# == dsh-hello-plugin" layer
dsh --profile demo
```

`dsh plugin --profile demo remove dsh-hello-plugin` は依存関係とレイヤーの両方を削除する。

## ロード順序

有効な設定は、空のルートの上に次の順序で適用して合成される:

1. プロファイルの `dsh.profile.bundles` リストに挙がった各バンドルパッチをリスト順に — 最初に `@deepseek-ai/dsh-base`、次に各インストール済みバンドルを追加された順に。
2. プロファイル自身の `cordis.patch.yml`。
3. ホームレベルの `$DSH_HOME/cordis.patch.yml` — すべてのプロファイルが共有するマシンローカルの設定。
4. 各 `--patch <path>` オーバーレイを argv 順に。

アプリ引数は別のパッチレイヤーではない。サーフェスバンドルは、以下で説明する通常のアプリ所有サービスを通じてそれらを解決できる。

後のレイヤーが行ごとに優先され、パッチはキーを深くマージするのではなく、行の `config` 値全体を置き換える。バンドル作者にとっての 2 つの帰結:

- あなたのパッチは `id` で以前のレイヤーの行を上書きできる — [the `dsh-web-app` bundle](../../../../packages/bundle/web-app/cordis.patch.yml) が `dsh-base` の行を上書きするのと同じ方法で — ただし、変更したキーだけでなく行が必要とするすべてのキーを書き直さなければならない。
- ユーザーはあなたのパッケージに触れずにプロファイルの `cordis.patch.yml` であなたの行を上書きできるので、ユーザーが維持しそうな設定既定値を優先し、残りはスキーマに委ねる。

同梱バンドル名は常に dsh インストール自体から解決される。pnpm が管理するのはツリー外パッケージだけなので、あなたのバンドルは `@deepseek-ai/dsh-base` が存在して最新であることを当てにできる。

## サーフェスバンドルに独自のコマンドラインを持たせる

実行可能なアプリを定義するバンドルは、通常のプロバイダープラグインをマウントする:

```yaml
- id: hello-startup
  name: 'dsh-hello-plugin/startup'
```

プラグインは `inject = ['cmdlineArgs']` をエクスポートし、自身の commander プログラムで [`@deepseek-ai/dsh-cmdline`](../../../../packages/boot/cmdline/README.md) の `parseCmdline` を呼び、プログラムのアクションからアプリ所有サービスを提供する。ランチャーはランチャーフラグの後の同じ不変の引数をすべてのプラグインに渡すので、アプリ固有のフラグにランチャーの変更は不要であり、複数のプラグインがそのスナップショットを解析してよい。Loader 行にはランチャーマーカーや特別な種類は不要である。

それらの引数で構成される行は、プロバイダーのサービスを注入し、自身の `!!js` オプションからそれを読む。隣にあるデプロイ値がフォールバックとなる:

```yaml
- id: my-app
  name: '@example/my-app'
  inject: [myAppStartup]
  config:
    port: !!js ctx.myAppStartup.port ?? 8080
```

`--help` ではプロバイダーがサービスを公開しないので、それらの行は決してアクティブ化しない。Loader は構成を一度マウントし、各行の通常の注入を待ち、それからその行の `!!js` 設定を注入されたコンテキストに対して評価する。

## GitHub からのインストール: ビルドスクリプトの落とし穴

レジストリへの公開は必須ではない。ユーザーは git ホストから直接インストールできる:

```sh
dsh plugin --profile demo add github:you/hello-plugin
```

しかし git インストールが取得するのは **ソースであり、ビルド済み成果物ではない**。`build` スクリプトは何も実行しないので、TypeScript パッケージは `lib/` 出力なしで届き、ロードに失敗する。両側で 1 つずつ、2 つのことが必要である:

- **作者** は `prepare` スクリプトを出荷する — pnpm が git インストール後にそれを実行する — これは公開されるエントリポイントをソースからビルドし、自己完結でなければならない。隣接するモノレポチェックアウトのような開発専用コンテキストを前提としてはならない。専用の tsdown 設定はプロジェクト参照や型チェックなしで `src/` をトランスパイルできる。
- **ユーザー** はビルドを許可リストに入れる。pnpm ≥10 は明示的に許可されるまで git 依存関係の `prepare` スクリプトの実行を拒否するので、最初の `add` は失敗する。`dsh` が修正方法を示す。pnpm が出力した正確なパッケージキーをプロファイルの `pnpm-workspace.yaml` にコピーする:

  ```yaml
  allowBuilds:
    dsh-hello-plugin: true
  ```

  そして `add` を再実行する。

その許可は、**インストール時にあなたのマシンでパッケージのコードを実行する権限** として扱う。エージェントが実行されるサンドボックスの外である。ソースを信頼するパッケージだけを許可し、コミットを固定する（`github:you/hello-plugin#<sha>`）ことで、後の push が実行内容を黙って変えられないようにする。

ユーザーに許可を求めたくない場合は、代わりにビルド済み成果物を配布する。どちらの形式もビルド権限を必要としない:

- `pnpm publish` 時に `lib/` をビルドして **npm に公開する**。`dsh plugin add your-package` はビルド済みコードをインストールする。
- `pnpm pack` から **tarball を出荷する**。ユーザーは `dsh plugin add ./hello-plugin-0.1.0.tgz` を実行する。

## 次のステップ

- [プラグインとライフサイクル](../framework/index.md) — 完全なプラグインライフサイクル
- [CLI 動作リファレンス](../../../../apps/cli/reference/README.md) — 正確なレイヤー優先順位、フラグ、プロファイルの仕組み
