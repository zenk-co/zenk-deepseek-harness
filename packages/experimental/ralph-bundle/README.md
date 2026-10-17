---
description: "明示的に要求された繰り返し作業を新しいエージェントで実行する。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-ralph-bundle

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

すべてのエージェントに実験的な Ralph ツールをグローバルツールとして追加し、人が要求した繰り返し作業を新しい子エージェントで実行する。Web と Desktop ではオフのまま出荷される。プラグインで選択すると有効になる。

## 目次

- [このパッケージの使い方](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [関連情報](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と将来の課題](#known-limitations-and-deferred-work)
- [開発ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの使い方

Web または Desktop でプラグインを開き、Official の **Ralph loops** を有効にする。オフに切り替えるとプロファイル層が削除される。

バンドルの有効化または無効化により、動作中の Host 内のグローバルツールが登録または削除されるため、ミニマルを含むすべてのプリセットのすべてのエージェントは次のリクエストから変更を反映する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の詳細 — クリックして展開</summary>

[`cordis.patch.yml`](cordis.patch.yml) は Host グループ `optional-ralph` を挿入し、独自の `workflowEngine` を分離してグローバルツール層に `tool-ralph` を登録する。後段のプロファイルパッチは行 ID 指定でそのツールの設定を置き換えたり無効化したりできる。オーバーライドだけではバンドルは選択されない。[プロファイルコンポーザー](../../boot/app-boot/README.md) がパッチ順序とエラーを所有する。

</details>

-----

<a id="further-exploration"></a>
## 関連情報

[ケイパビリティ実装](../tool-ralph/README.md)

-----

<a id="model-experience"></a>
## モデル体験

[ケイパビリティ実装](../tool-ralph/README.md) 経由で間接的に関わる。同実装がモデルコンテキストと結果を所有する。

#### KV キャッシュへの影響

この層はリクエスト内容を直接追加しない。ツール、プロンプト、結果に由来するキャッシュ効果はケイパビリティ実装が所有する。バンドルの切り替えはライブセッションのツール一覧を変更し、キャッシュ済みリクエストプレフィックスを1回無効化する。

## 既知の制限と将来の課題

<a id="known-limitations-and-deferred-work"></a>

- Ralph はループ実行に人による明示的な意図を必要とし、ラウンドを重ねると相当量のモデルトークンを消費しうる。そのワークフローエンジンは他のワークフローツールから分離されている。

-----

<a id="dev-note"></a>
### 開発ノート

<details>
<summary>メンテナー向けコンテキスト — クリックして展開</summary>

なし。

</details>
