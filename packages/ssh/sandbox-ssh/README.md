---
description: "Remote file-effect confinement for compositions using SSH filesystem and subprocess providers."
kind: "package-reference"
---

# @deepseek-ai/dsh-sandbox-ssh

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-sandbox-ssh` は SSH サブプロセスプロバイダーが起動するプロセス用に `ctx.sandbox` を提供する。リモートホストはインストール済みローカルサンドバックエンドを選択し、各呼び出しのポリシーをそこで適用する。Bash と Node は同じバックエンドの強制レベル、拒否シグネチャ、ランナー失敗分類を受ける。

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

共有の [`SSH 接続`](../ssh/README.md)、SSH ファイルシステム、SSH サブプロセスプロバイダーと共にこのプロバイダーをマウントする。パッケージ固有の設定はない。実行中のリモートヘルパーを通じて各ポリシーとコマンドを解決するため、`confine(argv, policy, signal)` の待機を行う。

完全な `read-only` または `workspace-write` ポリシーを渡す。ワークスペースはリモートホスト上で解釈・正規化される。`danger-full-access` については利用者が `confine()` を迂回する。接続が追加のローカル/リモートポリシーフラグを作り出すことはない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

実行中のヘルパーはポリシールートを正規化し、読み込んだサンドボックスプロバイダーに強制 argv、強制レベル、ランナー失敗証拠を問い合わせる。SSH サブプロセスプロバイダーは返された argv を直接実行し、fd 7 トランスポートと管理プロセスの存続期間を所有する。取り消しやバックエンド利用不可は、呼び出し元が起動コマンドを受け取る前に拒否される。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [プロセスサンドボックスサブシステム](../../../docs/subsystems/sandbox.md) — ポリシーの意味と強制開示。
- [ローカルサンドボックスプロバイダー](../../sandbox/sandbox-local/README.md) — リモートホストが継承するバックエンドとプラットフォーム制限。

-----

<a id="model-experience"></a>
## モデル体験

既存のサンドボックス利用者を通じて間接的に関与する。利用者はモード、拒否、強制を報告し、承認表示とモデル引数を所有する。

#### KV キャッシュへの影響

このプロバイダーはリクエストプレフィックス内容を提供しない。利用者がモデル可視のツールと結果を所有する。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

- ファイル効果モードはネットワークアクセスやプロセス可視性を制限しない。リモートの `partial` バックエンドは partial のままである。
- SSH ホストとインストール済みヘルパーは信頼されたインフラである。ダイジェスト検査とファイル効果制限は、敵対的ホストに対するセキュリティ境界を確立しない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
