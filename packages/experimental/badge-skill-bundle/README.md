---
description: "エージェントがドキュメント、プルリクエスト、その他の出力に「powered by dsh」バッジを付けられるようにする。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-badge-skill-bundle

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

プリセットが skill 読み込みを行うエージェントが、ドキュメント、プルリクエスト、その他の出力に「powered by dsh」バッジを付けられるようにする。共有プロバイダーはモデルツールを追加しない。Web と Desktop ではオフのまま出荷される。プラグインで選択すると有効になる。

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

Web または Desktop でプラグインを開き、Official の **DSH badge skill** を有効にする。オフに切り替えるとプロファイル層が削除される。

このスイッチは既存と新規のエージェント向けに Host 全体の skill プロバイダーを追加または削除する。skill 読み込みを公開するプリセットはバッジを使え、ミニマルはツールカタログを変更しない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の詳細 — クリックして展開</summary>

[`cordis.patch.yml`](cordis.patch.yml) は Host 上に `skill-badge` プロバイダー行を提供する。後段のルートパッチはその行を無効化できる。オーバーライドだけではバンドルは選択されない。[プロファイルコンポーザー](../../boot/app-boot/README.md) がパッチ順序とエラーを所有する。

</details>

-----

<a id="further-exploration"></a>
## 関連情報

[ケイパビリティ実装](../skill-badge/README.md)

-----

<a id="model-experience"></a>
## モデル体験

[ケイパビリティ実装](../skill-badge/README.md) 経由で間接的に関わる。同実装がモデルコンテキストと結果を所有する。

#### KV キャッシュへの影響

この層はリクエスト内容を直接追加しない。ツール、プロンプト、結果に由来するキャッシュ効果はケイパビリティ実装が所有する。

## 既知の制限と将来の課題

<a id="known-limitations-and-deferred-work"></a>

- バッジを使うにはプリセットに skill 検出と読み込みが必要である。ミニマルプリセットはこのバンドルで skill ツールを獲得しない。

-----

<a id="dev-note"></a>
### 開発ノート

<details>
<summary>メンテナー向けコンテキスト — クリックして展開</summary>

なし。

</details>
