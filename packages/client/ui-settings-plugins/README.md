---
description: "dsh web client 用組込插件設定節。設定誘導項目と機能所有札が登録する札外装。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-plugins

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

配備が出荷する插件を調べるには**組込插件**設定節を使う。この節は殻であり、誘導項目と札行を所有し、その中の各札は他插件が登録する — 読取専用目録が 1 つを出荷する。組込插件の設定は側欄の插件頁で行い、各公式插件自身の同伴包がその頁を登録する。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに探る](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と後回しの作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

設定で**組込插件**を開く。[ui-settings-plugin-inventory](../ui-settings-plugin-inventory/README.md) は目録を節唯一の札として寄与し、頁自体として示される。登録札 2 件目がその行を札群にする。札を寄与しない組み立ての配備は節の空行を示す。

札を寄与するには `id`、`order`、地域化 `label` で `settings.plugins.tab` に登録する。節は項目を順に描き、初選択で札を載せる。機能文案は登録插件の辞書にあるままである。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

この節は `settings.plugins.tab` を宣言する。これは表示が順序札になる根一覧溝であり、単独寄与は頁自体として描かれ、札は初選択後に載ったままであるため探索と目録 snapshot は切替を生き残る。節の `inject` は溝台帳を順序行に投影し、表示は有効地域に従い、台帳版または地域改訂が動くまで緩衝される。Host 側は空 `apply` であり、包が Loader 行を持つためだけにあり、client 単位系が browser 側を給仕する。

</details>

-----

<a id="further-exploration"></a>
## さらに探る

- [ui-settings-plugin-inventory](../ui-settings-plugin-inventory/README.md) — 読取専用目録札。
- [ui-settings](../ui-settings/README.md) — `settings.section` を宣言する領域基盤。
- [ui-plugin-manager](../ui-plugin-manager/README.md) — 公式插件を設定する插件頁。
- [ui-settings-shell](../ui-settings-shell/README.md)、[ui-settings-agent-loop](../ui-settings-agent-loop/README.md)、[ui-settings-subagent](../ui-settings-subagent/README.md)、[ui-settings-web-search](../ui-settings-web-search/README.md) — 公式設定頁。同伴包ごとに 1 つ。

-----

<a id="model-experience"></a>
## モデル体験

なし。この包は模型面を登録しない browser 側設定面であるため。

#### KV キャッシュへの影響

なし。このパッケージは提供子要求を組み立ても送信もしない。

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>

- **節は自身札を持たない** — 機能插件が 1 つを登録するまで空行を描く。殻だけでは節を満たせない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
