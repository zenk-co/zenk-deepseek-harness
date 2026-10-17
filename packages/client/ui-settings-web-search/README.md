---
description: "dsh Web クライアントのプラグインページにある DeepSeek Web 検索プロバイダーの設定ページ:その API キー・エンドポイント・要求ごとの検索予算。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-web-search

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

サイドバーの**プラグイン**を開き、Official グループの**Web 検索**を選ぶと、プロバイダーのキー・エンドポイント・1 要求あたりの検索可能回数を設定できる。ページは入力を段階化し、保存時にのみ書く。キーは設定文書ではなく資格情報領域越しに書かれるため、その原文は応答に乗らない。ページはホストが `web-search-deepseek` 名前空間を提供する間存在する。

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

Official グループの**Web 検索**カードがページを開く。**API キー**は毎回空で始まり、キーが設定されているか否かのみを報告する。キーなしでは DeepSeek アカウントモデルを使う会話のみが既定エンドポイント越しに検索できる。アカウント署名で認証する検索であるためであり、空下書きは保存済みキーを保ち、操作部品はプロセス環境が供給するキーなど、ここから書けない資格情報では無効になる。**エンドポイント**と**要求ごとの最大検索回数**は実効値を描画し、上書き後は**上書き済み**証票と**既定に戻す**を持ち、空で保存するとリセットとして保存される。**保存**まで何も書かれず、ページを離れると下書きは捨てられる。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

ホスト側は空の `apply` であり、パッケージがクライアントモジュールシステムがブラウザー側を提供するための Loader 行を保持するためだけに存在する。ブラウザー側は `ctx.configForms.get` 経由で `web-search-deepseek` 名前空間を束縛し、段階化フォームを `ui-primitives` の共有 `SettingsFormModel` 上の `WebSearchCardController` に保つ。キーはフォーム唯一の秘密操作部品であり、その書き込みは節の `apiKeyEnv` が指名する参照（指名なしでは `DEEPSEEK_API_KEY`）配下で `remote.credentials.set` へ行き、成功は `remote.credentials.describe` から読み戻される。制御側は範囲変更時と、監視参照の `credentials/reference-updated` をホストが報告したときに資格情報を読み直す。モデルページで書かれたキーは設定節を変えないためである。ページは `ctx.configForms.whileServed` 経由でプラグインページの `plugins.item` スロットに `WebSearchCard` を登録する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [ui-plugin-manager](../ui-plugin-manager/README.md) — プラグインページと、ページが登録する `plugins.item` スロット。
- [ui-settings](../ui-settings/README.md) — 設定スコープと、ページが乗る提供名前空間監視。
- [ui-primitives](../ui-primitives/README.md) — ページが描画する設定フォームモデルと欄。
- [credentials](../../credentials/README.md) — キーが書き込まれる資格情報参照シーム。
- [web-search-deepseek](../../web/web-search-deepseek/README.md) — 名前空間を登録するプロバイダー。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはモデル面を登録しないブラウザー側設定面であるため。

#### KV キャッシュ効果

なし。このパッケージはプロバイダー要求を組み立ても送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **名前空間の 3 欄** — プロバイダーのモデル・API バージョン・トークン予算は合成値のままである。ページはキー・エンドポイント・検索予算のみを編集する。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
