---
description: "Give Agents tools to search and read earlier sessions from the current workspace."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-session-search

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

すべてのエージェントに、過去セッションを検索する 5 つの実験的読み取り専用グローバルツールを提供する。内容インデックスは最初の検索時に開かれ、すべてのエージェントで共有される。バンドルは Web と Desktop でオフのまま出荷される。有効にするには Plugins で選択する。

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

Web または Desktop で Plugins を開き、Official 内の **Session search** を有効にする。オフに切り替えるとプロファイル層が除去される。

バンドルの有効化・無効化により、実行中 Host 内でグローバルツールが登録・除去される。そのため minimal を含むすべてのプリセットで、すべてのエージェントが次のリクエストで変更を認識する。

このバンドルはエージェント検索ツールを有効にする。サイドバー検索は既存動作を保持する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装詳細 — クリックで展開</summary>

[`cordis.patch.yml`](cordis.patch.yml)は Host グループ `optional-session-search` を挿入し、グローバルツール層にツールを登録する。後のプロファイルパッチは行を id でオーバーライドできる。[プロファイルコンポーザー](../../boot/app-boot/README.md)がパッチ順序とエラーを所有する。

グループは遅延 `:memory:` インデックスを持つ分離 `sessionQuery` プロバイダーを所有し、バンドルをオフにすると解放される。ホストのメタデータサービスは `openAt: never` を保持する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

[ケイパビリティ実装](../tool-session-query/README.md)

-----

<a id="model-experience"></a>
## モデル体験

[ケイパビリティ実装](../tool-session-query/README.md)を通じて間接的に関与する。同実装がモデルコンテキストと結果を所有する。

#### KV キャッシュへの影響

層はリクエスト内容を直接追加しない。ツール・プロンプト・結果からのキャッシュ効果はケイパビリティ実装が所有する。バンドルの切り替えによりライブセッションのツールリストが変わり、キャッシュ済みリクエストプレフィックスが 1 回無効になる。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

- バンドルは最初の検索後に 1 つのインメモリインデックスを保持する。インデックスはアプリケーション再起動後、またはバンドルのオフ・オン切り替え後に再構築される。検索は認可されたワークスペースに限定されたままである。

-----

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けコンテキスト — クリックで展開</summary>

なし。

</details>
