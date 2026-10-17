# プラグインマーケット

日本語 | [English](plugin-market.en.md) | [中文](plugin-market.zh.md)

## 概要

プラグインマーケットとは、インストール可能な DSH バンドルをタイトル、アイコン、作者、バージョンとともに一覧する 1 つの JSON インデックスファイルである。実験的な **Custom plugin markets** バンドルを有効にすると、Plugins ページの **Discover** タブでマーケットを閲覧し、確認後に一覧のバージョンをインストールできる。マーケットを公開するには、インデックスファイルを作成または生成し、そのアイコンファイルとともに任意の静的ホストから配信する。

## 目次

- [Discover を有効にする](#turn-on)
- [閲覧とインストール](#browse-and-install)
- [インデックスの公開](#publish-an-index)
- [リファレンスジェネレーターでインデックスを生成する](#generate-an-index)
- [インデックス形式リファレンス](#index-format)
- [さらに調べる](#further-exploration)

<a id="turn-on"></a>
## Discover を有効にする

**Plugins** を開き、**Experimental plugins** の横の **More** を選択し、**Custom plugin markets** を見つけて有効にする。**Installed** の隣に **Discover** タブが現れ、Creator モードに読み取り専用の `plugin_market` ツールが追加される。バンドルを無効にすると、両方とも再び削除される。

DSH はインデックスソースを同梱していない。**Discover** を選択し、**Add index source** を選び、インデックスファイルの URL を入力する。URL は `http:` または `https:` を使用する必要があり、ユーザー名、パスワード、`#` フラグメントを含んではならない。ネットワーク経路上の誰もが `http:` インデックスを変更できる(それが一覧するインストールスペックも含む)ため、管理下にないネットワーク経由で到達するマーケットには `https:` を使用する。各ソースは現在のプロファイルに属する。

<a id="browse-and-install"></a>
## 閲覧とインストール

ツールバー左側のマーケットメニューでソースを切り替えられ、**Manage index sources…** を開くと、各ソースの最後のエラーが表示される。検索は名前、作者、キーワード、およびあらゆる言語のタイトル、説明、カテゴリ、ラベルに一致し、タイプミスを許容する。結果は別の並び順を選ぶまで最良一致順で表示される。**Labels** メニュー、カテゴリピル、**Sort** メニューは、マーケットが宣言するカテゴリ、ラベル、ソートキーを使用し、**Publish date** は各プラグインの最新バージョンで並べ替える。

各カードはプラグインの推奨バージョンを表示する: 実行中の DSH と互換性があり、プレリリースでない最高バージョン、またはプラグインがプレリリースタグのないバージョンを一覧していない場合は互換性のある最高のプレリリースである。**Install** はそのバージョンのソース(npm パッケージとレジストリ、または Git リポジトリ、コミット、ディレクトリ)を含む確認を開く。確認すると通常のプラグインインストールが開始され、互換性チェックとレジストリチェックも含まれる。この確認なしにインストールされるものはない。

カードを選択するとそのページが開く。**Versions** リストは一覧されたすべてのバージョンを互換性とともに表示し、DSH が受け入れる任意のバージョン(古いリリースやプレリリースを含む)に **Install** を提供する。**Installed**、**Update available**、**Provided by DSH** と表示されたカードは、代わりにインストール済みバンドルを開く。

マーケットはサードパーティのコンテンツである。各プラグインのタイトル、説明、アイコン、作者、ソースはマーケットが選ぶ。DSH はファイル形式をチェックするが、それらの主張はチェックしない。信頼できるソースのみを追加し、インストール前に確認画面でソースを確認する。

<a id="publish-an-index"></a>
## インデックスの公開

インデックスは UTF-8 の JSON ファイルで、デフォルトで最大 128 MiB であり、2xx ステータスでリダイレクトなしに配信される。GitLab Pages、GitHub Pages、https 背後のオブジェクトストアなど、任意の静的ホストに置く。

アイコンはインラインまたは別ファイルにできる。インラインアイコンはインデックス内の base64 `data:` URL である。追加のリクエストは不要だが、インデックスが大きくなる。別ファイルのアイコンは URL である。相対アイコンは、Web ページの画像がページに対して解決されるのと同じように、インデックス URL に対して解決される。`https://market.example/dsh/index.json` のインデックスでは、`"icon": "icons/foo.svg"` は `https://market.example/dsh/icons/foo.svg` をロードする。したがって、インデックスと `icons/` ディレクトリを並べて公開すれば、ファイルを編集せずに任意のホストで機能する。別オリジン(スキーム、ホスト、ポート)の絶対アイコン URL は `https:` を使用しなければならない。

以下は、npm プラグイン 1 つと Git モノレポのプラグイン 1 つを含む最小のインデックスである:

```json
{
  "format": 1,
  "title": { "en": "Team plugins", "zh": "团队插件" },
  "plugins": [
    {
      "name": "dsh-plugin-foo",
      "title": "Foo",
      "description": "Adds the foo tool",
      "icon": "icons/foo.svg",
      "author": "Jane Doe",
      "homepage": "https://github.com/jane/dsh-plugin-foo#readme",
      "repository": { "url": "https://github.com/jane/dsh-plugin-foo" },
      "versions": [
        { "version": "1.1.0", "publishTimestamp": 1790476800, "source": { "type": "npm" }, "engines": { "dsh": ">=0.2.0-rc.2" } },
        { "version": "1.0.0", "publishTimestamp": 1788000000, "source": { "type": "npm" } }
      ]
    },
    {
      "name": "@team/dsh-bar",
      "versions": [
        {
          "version": "0.3.0",
          "publishTimestamp": 1789000000,
          "source": {
            "type": "git",
            "url": "https://gitlab.example.com/team/dsh-plugins",
            "commit": "3f9c2e1d8a4b6c0e7f1a2b3c4d5e6f708192a3b4",
            "path": "packages/bar"
          }
        }
      ]
    }
  ]
}
```

DSH は以下のいずれかのルールに違反するとインデックス全体を拒否し、**Manage index sources…** のソースの下に、違反した値の JSON パスとともに理由を表示する。

<a id="generate-an-index"></a>
## リファレンスジェネレーターでインデックスを生成する

リポジトリには、プレーンなリストからインデックスを構築する[リファレンスジェネレーター](../../../apps/plugin-market-generator/README.md)が含まれている。1 行につき 1 つの npm パッケージ名または https の Git リポジトリ URL を書く。空白行と `#` で始まる行は無視される:

```text
@team/dsh-foo
https://gitlab.example.com/team/dsh-plugins
```

DSH のチェックアウトから実行する:

```sh
pnpm --filter @deepseek-ai/dsh-plugin-market-generator start --input plugins.txt --output site/index.json --title "Team plugins"
```

npm パッケージの場合、インデックスは非推奨でなく `dsh.bundle` を宣言するすべてのバージョンを一覧する。Git リポジトリの場合、デフォルトブランチでバンドルパッケージを見つけ、`vX.Y.Z`、`X.Y.Z`、`<name>@X.Y.Z` タグのバージョン、およびデフォルトブランチ上の各パッケージのバージョンを一覧する。タイトル、説明、アイコン、作者、ホームページは各プラグインの最高バージョンから取得する。パスは pnpm を実行したディレクトリからの相対である。

ジェネレーターはファイルをダウンロードして読むだけであり、パッケージをインストールしたりそのコードを実行したりすることは決してない。リストの隣の `.plugin-market-cache` にキャッシュを保持するため、繰り返し実行では新しいバージョンとコミットのみがダウンロードされる。上記のとおり、出力ディレクトリ(`index.json` とその `icons/` ディレクトリ)を公開する。

<a id="index-format"></a>
## インデックス形式リファレンス

`LocalizedText` と記されたテキストフィールドは文字列か、小文字の言語 ID をキーとする文字列のオブジェクト(例: `{ "en": "Foo", "zh": "甲" }`)である。オブジェクトは `en` を含まなければならない。DSH が知らないメンバーは無視される。

| インデックスフィールド | 必須 | 意味 |
|---|---|---|
| `format` | はい | `1`。 |
| `title`, `description` | `title` のみ | マーケットの名前と説明。`LocalizedText`。 |
| `metadata.categories`, `metadata.labels` | いいえ | id を `{ "title": LocalizedText }` にマッピングするオブジェクト。 |
| `metadata.sortKeys` | いいえ | id を `{ "title": LocalizedText, "order": "asc" \| "desc" }` にマッピングするオブジェクト。`order` は初期の並び方向。 |
| `plugins` | はい | マーケットのデフォルト順のプラグイン。 |

| プラグインフィールド | 必須 | 意味 |
|---|---|---|
| `name` | はい | インデックス内で一意の npm パッケージ名。 |
| `title`, `description` | いいえ | `LocalizedText`。タイトルがない場合、カードは `name` を表示する。 |
| `icon` | いいえ | 上記のとおり、インラインの `data:` URL(SVG、PNG、JPEG、または WebP、最大 32 KiB)または URL。 |
| `author` | いいえ | 表示テキスト。 |
| `homepage` | いいえ | プラグインに関するページの絶対 `https:` または `http:` URL。プラグインページがリンクする。 |
| `repository` | いいえ | `{ "url": string, "directory"?: string }`: ソースリポジトリの Web ページと、その中のパッケージディレクトリ。プラグインページはそれを **Source code** としてリンクする。 |
| `metadata.category` | いいえ | 宣言された 1 つのカテゴリ ID。 |
| `metadata.labels` | いいえ | 宣言されたラベル ID。 |
| `metadata.sortKeys` | いいえ | 宣言されたソートキー ID(ダウンロード数や評価など)を数値にマッピングするオブジェクト。 |
| `versions` | はい | 任意の順序で少なくとも 1 つのバージョン。 |

| バージョンフィールド | 必須 | 意味 |
|---|---|---|
| `version` | はい | 正確な SemVer バージョン。プラグイン内で一意。 |
| `publishTimestamp` | はい | Unix 秒での公開時刻。 |
| `source` | はい | `{ "type": "npm", "registry"?: url }`、または `{ "type": "git", "url": https-url, "commit": 40-hex-sha, "path"?: directory }`。 |
| `engines.dsh` | いいえ | このバージョンが動作する DSH バージョンの SemVer 範囲。省略時は任意を意味する。 |

DSH は npm バージョンを `name@version` としてインストールし、`registry` が存在する場合はそれを最初に尋ねる。Git バージョンは `git+<url>.git#<commit>` としてインストールし、サブディレクトリ内のパッケージには `&path:/<path>` を付ける。`engines.dsh` はパッケージ自身の `engines.dsh` と一致するべきであり、DSH はインストール時にそれを再チェックする。それを持たないパッケージは、代わりにその `@deepseek-ai/dsh*` ピア依存関係に対してチェックされる。[形式ノート](../../../.agents/notes/implemented/feature/2026-10-02-plugin-market-index-format.md)がすべてのルールを定義する。

<a id="further-exploration"></a>
## さらに調べる

- [Discover タブリファレンス](../../../packages/client/ui-plugin-market/README.md)は、タブのコントロールと状態を説明する。
- [プラグインマーケットサービス](../../../packages/boot/plugin-market/README.md)は、フェッチ制限、キャッシュ、`plugin_market` ツールを扱う。
- [インデックスバリデータ](../../../packages/util/plugin-market-index/README.md)は、公開前にインデックスをチェックするためにジェネレーターが使用できるライブラリである。

## Dev Note

なし。
