---
description: "パッケージ識別子・実行時要件・DSH プラグインメタデータ向けの共有 TypeScript 宣言。"
kind: "package-library"
---

# @deepseek-ai/dsh-package-manifest

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

パッケージメタデータには `DshPackageManifest` を、`dsh` 配下の公開欄には `DshManifest` を、1 領域向けには `DshClientManifest` などの構成員型を使う。各読み手が JSON 構文解析・検証・既定解決を所有する。

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

パッケージルートからインポートする。自身のソース検査だけなら開発依存で、公開宣言がこれらの型を参照するなら製品依存で使う。

```ts
import type { DshClientManifest, DshPackageManifest } from '@deepseek-ai/dsh-package-manifest'

const client: DshClientManifest = { platform: 'web' }
const manifest: DshPackageManifest = {
  name: 'example-dsh-plugin',
  version: '1.0.0',
  engines: { node: '>=24', dsh: '0.1.5-alpha.1' },
  dsh: {
    manifestVersion: 1,
    bundle: { patch: './cordis.patch.yml' },
    client,
  },
}
```

`DshPackageManifest` は DSH が使う package.json 欄を記述し、`name` と `version` が必須である。網羅的な npm スキーマではない。ローカルプロファイル読み手は `Partial<DshPackageManifest>` を使う。プロファイルに公開バージョンは不要なためである。`DshManifest` は `dsh` 配下の公開作成者欄のみを記述する。`DshBundleManifest.patch` は 1 つのパッチファイルパスまたはその順序付き一覧であり、各々パッケージルート相対である。ランチャーは一覧を 1 バンドル層として順に適用する。TypeScript はサンプルを検査して `import type` を消去する。これらのインターフェースは JSON を構文解析もファイル書き込みもしない。

次のメタデータ欄は任意である。省くと形式バージョンまたは適合ホストバージョンが未宣言のままとなり、読み手は既定値を推測しない。

| フィールド | 意味 |
|---|---|
| `dsh.manifestVersion` | マニフェスト形式識別子。宣言形式は `1` であり、npm パッケージバージョンやセッション形式バージョンとは独立である。 |
| `engines.dsh` | 作成者が宣言する適合 DSH バージョンの SemVer 範囲（正確なプレリリースバージョンを含む）。この欄は `engines.node`・`engines.npm` の横にあり、engines オブジェクトは `dsh` を省ける。 |

`LocalizedText` は原文または必須英語フォールバック付きの言語対応表を運ぶ。`PluginLocalizedMeta` は任意の表示題名・説明、パッケージルートの `package.json.icon` または出力 `<specifier>/icon` から解決される画像データ URL、インストール済みプラグイン向けのメタデータ診断を運ぶ。[アプリ起動](../../boot/app-boot/README.md)がこれらの値を読む。このパッケージはその型のみを供給する。

公開コンポジション宣言は [`src/types.ts`](src/types.ts) で定義される。内部 `configTrees`・`sessionFormatMigration`・生成 `moduleFallback` メタデータはそのイメージパッカー・カタログ・ランチャー読み手の所有のままにあり、公開型はそれらを公開しない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

パッケージルートは [`src/types.ts`](src/types.ts) からの宣言を再出力するだけである。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [プロファイルランチャー](../../boot/app-boot/README.md#profiles) — マニフェスト読み込みとコンポジション。
- [公開パッケージメタデータ](../../../.agents/notes/implemented/architecture/2026-09-10-public-package-manifest.md) — 欄配置と読み手所有。

<a id="model-experience"></a>
## モデル体験

なし。このパッケージは型のみを出力するため。

#### KV キャッシュ効果

型宣言はモデル入力を増やさないため、プロバイダーキャッシュ再利用に影響しない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **静的型付けのみ。**利用者は使う JSON 欄を読み取って検証し、共有宣言を実行時データに適合させる。パッケージは構文解析器・取得ヘルパー・ファイル検査・既定値を供給しない。
- **適合性は宣言的。**現在のインストーラーとローダーは `dsh.manifestVersion` も `engines.dsh` も強制しない。範囲の宣言は非適合ホストを拒否も SemVer 構文を検証もしない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
