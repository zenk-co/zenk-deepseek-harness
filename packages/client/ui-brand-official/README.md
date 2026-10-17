---
description: "公式ビルドでのみ有効な、サイドバー用公式 DeepSeek Harness ブランド占有物。ブランド表示を選択・置換するユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-official

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは `official` クライアントビルドにサイドバーの DeepSeek Harness マークと名称を与える。その他のビルドプロファイルはシェルの fish マークとローカルビルド表示のままとなり、会話ヒーローは常にアニメーション付き fish を使う。DeepSeek Harness としてブランド化するデプロイ向けに選択し、別の識別子を持つデプロイは置換ブランドパッケージを用意すべきである。ランタイム状態を持たず、モデルリクエストに影響しない。

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

DeepSeek 自身を識別子とするデプロイのブラウザーロスターにこのプラグインをマウントし、`official` プロファイルでクライアントをビルドして占有物を登録する。

### プロファイルの選択

`DSH_CLIENT_BUILD_PROFILE` が描画するブランドを選択する。`official` ビルドはサイドバーに公式マークと名称を表示し、それ以外の値はシェルのフォールバック — fish マークとローカルビルド表示 — のままにする。会話ヒーローはプロファイルにかかわらず `dsh-client-ui-conversation` 由来のアニメーション付きヒーロー fish を表示する。これはフォールバックが既に公式マークであるためである。プラグインはどちらの場合も読み込みと検証を行い、プロファイルで門限されるのは登録のみである。

### ブランドの置換

独自の識別子を持つデプロイはこのパッケージを外し、サイドバースロット — およびこのパッケージがフォールバックのままにするヒーロースロット — を占有する別のパッケージを組み立てる。スロットの占有が唯一の組み立て経路であり、ここにブランド設定面はない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

2 つの占有物は宣言対応の登録集合として 1 つに導入される。入れ子の `ctx.slots.inject()` 呼び出しがサイドバー宣言を待つため、この行が宣言者より先に有効化されても後に有効化されても動作し、宣言が崩壊すれば両占有物を取り下げ、HMR 中に部分的なブランド混交を残さない。ブラウザー側は [`src/client/index.ts`](src/client/index.ts) であり、Node 側は空の Loader 座席である。ブラウザータイトルはビルド環境の関心事 (`DSH_CLIENT_TITLE`) であり、スロット機構の外にある。

</details>

-----

<a id="further-exploration"></a>
## さらに探る

ブランド面だけでは足りない場合にこれらのページを読む。このパッケージが占有するスロットから、それらを描画するシェルへ進む。

- [ui-sidebar](../ui-sidebar/README.md) — `sidebar.brand.mark` と `sidebar.brand.name` を宣言しフォールバックを描画する。
- [ui-conversation](../ui-conversation/README.md) — ヒーロー内の `conversation.hero.brand.mark` を宣言する。
- [Web クライアントアーキテクチャ](../../../docs/subsystems/web-client.md) — ブラウザープラグイン行の読み込みとスロット登録の仕組み。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはブラウザー表示のみを提供し、ここからはモデルリクエストに何も届かない。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立ても送信もしない。

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限はブランド表示の供給方法を定める。ブランド設計の比較や作業 backlog ではなく、現在のパッケージ制約である。

- **単一の占有物集合** — 代替表示は同じスロットを占有する別の Cordis パッケージに属する。
- **ブラウザータイトルは独立** — `DSH_CLIENT_TITLE` は UI スロットではなくビルド時にタイトル文を選択する。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
