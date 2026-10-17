---
description: "プラグインマネージャーから実験的なカスタムプラグインマーケットを有効にする。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-plugin-market-bundle

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このオプションバンドルはカスタムプラグインマーケットをマウントする。すなわち、ユーザーが追加したプラグインマーケットのインデックスを読み取る Host の [`pluginMarket`](../../boot/plugin-market/README.md) サービスと、プラグインページの Web [Discover タブ](../../client/ui-plugin-market/README.md)である。出荷時のプロファイルでは無効のままである。

## 目次

- [このパッケージの使い方](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [モデル体験](#model-experience)
- [既知の制限と将来の課題](#known-limitations-and-deferred-work)
- [開発ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの使い方

Web サイドバーで **Plugins** を開き、**Experimental plugins** の横の **More** を選んで **Custom plugin markets** をオンにする。オンにするとメインリストにも表示される。ページには **Installed** と **Discover** のタブが表示され、**Discover** はインデックスソースの追加とそのバンドルのインストールを行う。バンドルをオフにすると Discover タブと `plugin_market` ツールが削除される。保存済みのインデックスソースはプロファイルに残る。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>メンテナー向け詳細 — クリックして展開</summary>

静的な `cordis.patch.yml` は、`plugin-manager` のようなプロファイルなしでは無効な `plugin-market` サービス行と、`ui-plugin-market` ブラウザー行を挿入する。Creator プリセットは `tool-plugin-market` 行を保持する。そのプラグインは `pluginMarket` がマウントされている間のみ `plugin_market` を登録するため、このバンドルなしでは行が待機もツール表示も行わない。プラグインページは `plugins.tab` エントリーが存在する場合にのみタブを表示するため、このバンドルを知らなくてよい。

</details>

-----

<a id="model-experience"></a>
## モデル体験

`pluginMarket` サービス経由で間接的に関わる。バンドルをオンにすると、Creator プリセットは [`dsh-plugin-market`](../../boot/plugin-market/README.md#model-experience) に記録された読み取り専用の `plugin_market` ツールを獲得する。

#### KV キャッシュへの影響

バンドルのオン/オフ切り替えは Creator セッションのツールスキーマを1つ増減させ、後続リクエストのキャッシュ済みリクエストプレフィックスを変更する。

## 既知の制限と将来の課題

<a id="known-limitations-and-deferred-work"></a>

- 公式マーケットは存在しない。Discover にはユーザーが追加したインデックスソースのみが並ぶ。

-----

<a id="dev-note"></a>
### 開発ノート

<details>
<summary>メンテナー向け詳細 — クリックして展開</summary>

なし。

</details>
