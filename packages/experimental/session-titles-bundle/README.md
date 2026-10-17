---
description: "Refresh session titles as new human prompts arrive."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-session-titles-bundle

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

会話の対象となる人間プロンプトから実験的セッションタイトルを生成する。先頭プロンプトのタイトルプロバイダーを置換し、プリセット横断で適用される。Web と Desktop ではオフのまま出荷される。有効にするには Plugins で選択する。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と後回しにした作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

Web または Desktop で Plugins を開き、Official 内の **Conversation-following titles** を有効にする。オフに切り替えるとプロファイル層が除去される。

切り替えにより、既存と新規セッションのタイトルプロバイダーが変わる。対象の人間プロンプトまたは明示的更新がタイトル要求を起動する。モデルには、既存の生成タイトルが主要トピックやタスクを表している間は正確に維持するよう求められる。自動更新はユーザーがピン留めしたタイトルを保持する。エージェントツールカタログは変わらない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装詳細 — クリックで展開</summary>

[`cordis.patch.yml`](cordis.patch.yml)はホスト上にプロバイダーを提供する。後のプロファイルパッチはその設定をオーバーライドできる。[プロファイルコンポーザー](../../boot/app-boot/README.md)がパッチ順序とエラーを所有する。層は置換を選択する前に `session-title-llm` を無効にする。選択解除でデフォルトプロバイダーが復元される。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

[ケイパビリティ実装](../session-title-all-prompts-llm/README.md)

-----

<a id="model-experience"></a>
## モデル体験

[ケイパビリティ実装](../session-title-all-prompts-llm/README.md)を通じて間接的に関与する。同実装がモデルコンテキストと結果を所有する。

#### KV キャッシュへの影響

層はリクエスト内容を直接追加しない。ツール・プロンプト・結果からのキャッシュ効果はケイパビリティ実装が所有する。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

- 自動タイトル失敗時は以前のタイトルを保持する。4096 バイトのタイトル入力予算には、提供された場合の現在の生成タイトルが含まれ、過大な入力は会話履歴を切り詰める代わりに拒否される。

-----

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けコンテキスト — クリックで展開</summary>

なし。

</details>
