---
description: "ツール呼び出しをまたいでシェルプロセスを存続させる。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-terminal-bundle

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

すべてのエージェントに6つの実験的なグローバルターミナルツールを追加する。このバンドルはプラットフォームシェルバックエンドを持つ分離されたターミナルレジストリーを所有し、ターミナルはエージェントが所有する。Web と Desktop ではオフのまま出荷される。プラグインで選択すると有効になる。

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

Web または Desktop でプラグインを開き、Official の **Persistent terminals** を有効にする。オフに切り替えるとプロファイル層が削除される。

バンドルの有効化または無効化により、動作中の Host 内のグローバルツールが登録または削除されるため、ミニマルを含むすべてのプリセットのすべてのエージェントは次のリクエストから変更を反映する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の詳細 — クリックして展開</summary>

[`cordis.patch.yml`](cordis.patch.yml) は Host グループ `optional-persistent-terminals` を挿入し、グローバルツール層にツールを登録する。後段のプロファイルパッチは行 ID 指定でその行を上書きできる。[プロファイルコンポーザー](../../boot/app-boot/README.md) がパッチ順序とエラーを所有する。

</details>

-----

<a id="further-exploration"></a>
## 関連情報

[ケイパビリティ実装](../tool-terminal/README.md)

-----

<a id="model-experience"></a>
## モデル体験

[ケイパビリティ実装](../tool-terminal/README.md) 経由で間接的に関わる。同実装がモデルコンテキストと結果を所有する。

#### KV キャッシュへの影響

この層はリクエスト内容を直接追加しない。ツール、プロンプト、結果に由来するキャッシュ効果はケイパビリティ実装が所有する。バンドルの切り替えはライブセッションのツール一覧を変更し、キャッシュ済みリクエストプレフィックスを1回無効化する。

## 既知の制限と将来の課題

<a id="known-limitations-and-deferred-work"></a>

- ターミナルは作成したエージェントに属する。POSIX は Bash、Windows は PowerShell を使い、このバンドルは他のターミナルレジストリーを共有しない。

-----

<a id="dev-note"></a>
### 開発ノート

<details>
<summary>メンテナー向けコンテキスト — クリックして展開</summary>

なし。

</details>
