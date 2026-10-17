---
description: "dsh web クライアントの Plugins ページにあるシェルエグゼキューターの設定ページ: shell 名前空間のコマンドタイムアウトとストリームごとの出力上限。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-shell

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

サイドバーの **Plugins** を開き、Official グループの **Shell** を選択して、1 つのコマンドが実行できる時間と各出力ストリームがメモリに残る量を設定する。ページは入力内容をステージングし、保存時にのみ書き込み、ユーザーが上書きした値をマークし、それぞれをデプロイメントのデフォルトに戻すリセットを提供する。ページは Host が `shell` 名前空間を提供している間だけ存在するので、ローカルシェルエグゼキューターのないデプロイメントにはその痕跡が一切現れない。

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

Official グループの **Shell** カードがページを開く。**Command timeout (ms)** はそれより長く実行されるコマンドを終了させ、**Output cap per stream (bytes)** はそれを超える出力を一時ファイルにスピルする。どちらも有効値 — 構成されたデフォルトに対するユーザーの上書き — を表示し、ユーザーが上書きしたフィールドには **Overridden** バッジが付き、その隣に **Reset to default** がある。**Save** までは何も書き込まれない。ページを離れるとドラフトは破棄され、空のフィールドはリセットとして保存され、数値でないテキストは保存をブロックし、フィールドの下にその旨を表示する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

Host 側は空の `apply` であり、パッケージが Loader 行を保持してクライアントモジュールシステムがブラウザー側にサービスを提供するためだけに存在する。ブラウザー側は、構成されたシェルエグゼキューターエントリー (Windows 以外では `bash-sandbox`、Windows では `pwsh-sandbox`) を `ctx.configForms.get` でバインドし、ステージングされたフォームを `ui-primitives` の共有 `SettingsFormModel` 上で `ShellCardController` に保持し、`ShellCard` を `ctx.configForms.whileServed` を通じて Plugins ページの `plugins.item` スロットに登録する。これは Host がいずれかのエントリーを提供している間登録し、停止すると撤回する。ページのコピーはこのパッケージの `settings.shell` 辞書にあり、`SettingsForm` フレームはそのコピーを props として受け取る。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [ui-plugin-manager](../ui-plugin-manager/README.md) — Plugins ページと、ページが登録する `plugins.item` スロット。
- [ui-settings](../ui-settings/README.md) — 設定スコープと、ページが利用する提供名前空間のウォッチ。
- [ui-primitives](../ui-primitives/README.md) — 設定フォームモデルと、ページがレンダリングするフィールド。
- [bash-local](../../shell/bash-local/README.md) — `shell` 名前空間を登録するエグゼキューター。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはモデルサーフェスを登録しないブラウザー側の設定サーフェスであるため。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立てることも送信することもない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **ページは構成されたエグゼキューターに従う** — POSIX と PowerShell のエグゼキューター系は `shell` 名前空間を共有する。ホストはそのうちちょうど 1 つを構成するので、提供されるスキーマはプラットフォームごとに異なる (PowerShell は `pwshPath` を追加する) が、ページはどちらでも同じ 2 つのフィールドを編集する。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
