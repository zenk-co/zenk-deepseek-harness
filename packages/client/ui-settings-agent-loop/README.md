---
description: "dsh web クライアントの Plugins ページにある agent loop の設定ページ。agent-loop 名前空間の並列ツール呼び出し上限を扱う。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-agent-loop

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

サイドバーで **Plugins** を開き、Official グループの **Agent loop** を選択すると、1 ステップで同時に実行できる並列安全なツール呼び出しの数を設定できる。このページは入力内容をいったん保持し、保存時にのみ書き込み、ユーザーが上書きした値には印を付け、デプロイのデフォルトにリセットする手段を提供する。このページは Host が `agent-loop` 名前空間を提供している間だけ存在する。

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

Official グループの **Agent loop** カードがこのページを開く。**Parallel tool calls** は、1 ステップ内でループが同時に実行する呼び出し数を制限する。フィールドには有効な値が表示され、上書きされるとその横に **Overridden** バッジと **Reset to default** が付く。**Save** するまで何も書き込まれず、ページを離れると下書きは破棄され、空のフィールドはリセットとして保存され、数値でないテキストは保存をブロックし、その旨がフィールドの下に表示される。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

Host 側は空の `apply` であり、このパッケージが Loader 行を持ち、クライアントのモジュールシステムがブラウザー側を提供するためにだけ存在する。ブラウザー側は `ctx.configForms.get` を通じて `agent-loop` 名前空間をバインドし、`ui-primitives` の共有 `SettingsFormModel` 上で `AgentLoopCardController` にステージングしたフォームを保持し、`ctx.configForms.whileServed` を通じて `AgentLoopCard` を Plugins ページの `plugins.item` スロットへ登録する。ページの文言はこのパッケージの `settings.agentLoop` 辞書にある。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [ui-plugin-manager](../ui-plugin-manager/README.md) — Plugins ページと、このページが登録する `plugins.item` スロット。
- [ui-settings](../ui-settings/README.md) — 設定スコープと、このページが利用する提供済み名前空間の監視。
- [ui-primitives](../ui-primitives/README.md) — このページが描画する設定フォームモデルとフィールド。
- [agent-loop](../../core/agent-loop/README.md) — `agent-loop` 名前空間を登録するループ。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはモデル向けの面を登録しない、ブラウザー側の設定面である。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストの組み立てや送信を行わない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **名前空間のフィールドは 1 つだけ** — Host セクションが持つのは並列上限のみである。構成される `agents` 配列は起動構成であってユーザー設定ではなく、ここにフィールドはない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
