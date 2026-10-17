---
description: "ネイティブディレクトリピッカーサーフェス。ワークスペースディレクトリフロー用にローカル Desktop またはホスト OS チューザーを駆動するブラウザー側。選択操作を選ぶユーザーとメンテナーのためのもの。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-directory-picker-native

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは Web GUI のネイティブディレクトリ選択サーフェスを提供する。ワークスペースフローがディレクトリを求めると、描画なしのブラウザー占有者がローカルマシン上でオペレーティングシステム独自のチューザーを開き、単一の結果（選択パス、取り消し、失敗）を報告する。`ui-workspace` が宣言する 2 つのディレクトリフロー スロットを埋め、1 つの `cordis.yml` 行でネイティブ選択操作のクライアント側を構成する。ブラウザーがホストと同じマシンで動作する場合に選ぶ。インプロセスとリモートブラウザーのデプロイは代わりに [`-browse`](../ui-directory-picker-browse/README.md) サーフェスが必要である。

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

このプラグインを `ui-workspace` とホストバックエンド [`dsh-host-directory-picker-native`](../../host/directory-picker-native/README.md) と並べてマウントする。1 つの `cordis.yml` 行がネイティブ選択操作全体を構成する。ワークスペース追加やピッカーフローがディレクトリ要求を開くと、ユーザーはオペレーティングシステムのフォルダーダイアログを見る。選択パスはワークスペースフローに採用され、取り消しはダイアログを閉じる。

ローカル Electron アプリケーションでは、このフローは狭い preload ディレクトリピッカーブリッジを使う。取り消しと失敗はホストチューザー経由で再試行しない。通常 Web はホスト呼び出しを使う。別の browse 構成は常にホストディレクトリを列挙する。

### 選ぶ場合

ブラウザーがホストと同じマシンで動作し、OS ダイアログをそこで開ける場合にこのサーフェスを選ぶ。ブラウザーがリモートまたはインプロセスでローカルチューザーが存在しない場合は [`-browse`](../ui-directory-picker-browse/README.md) サーフェスを選ぶ。2 つのサーフェスは同じスロットを埋めるため、切り替えはコード変更ではなく構成変更である。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

両スロット登録は入れ子の `ctx.slots.inject()` 呼び出しを通じて 1 つのトランザクションエフェクトとしてインストールされる。宣言エントリーのいずれかが後に有効化したり宣言を置換したりし得るためである。占有者は `open` の立ち上がり辺りごとに 1 回武装するため、再レンダーが 2 つ目のチューザーを起動することはない。決着は ref に乗るため、回答は所有者の最新ハンドラーに到達する。アンマウント（HMR が占有者を置換）は決着を全体として破棄する。wire に要求ごとの中止はなく、ネイティブチューザーは回答まで生き残り、その回答はどこにも届かない。node 側はホスト名簿にプラグインを残す空の `apply` である。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

選択サーフェスでは足りない場合に以下のページを読む。ブラウザー側からホストバックエンドとそれが埋めるスロットへ進む。

- [dsh-host-directory-picker-native](../../host/directory-picker-native/README.md) — このサーフェスが駆動する OS チューザーバックエンド。
- [ui-workspace](../ui-workspace/README.md) — ディレクトリフロースロットを宣言し、選択会話を所有する。
- [ui-directory-picker-browse](../ui-directory-picker-browse/README.md) — リモートとインプロセスのデプロイのためのアプリ内閲覧代替。
- [Web クライアントアーキテクチャ](../../../docs/subsystems/web-client.md) — ブラウザープラグイン行がスロットを読み込み登録する仕組み。

-----

<a id="model-experience"></a>
## モデル体験

なし。ディレクトリチューザーはブラウザー chrome であり、ここにあるものはモデル要求に届かない。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダー要求を組み立てず送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限はネイティブチューザーが適合する場合を定義する。これらは現在のパッケージの制約であり、一般的なピッカー比較でもタスクバックログでもない。

- **開いているチューザーの取り消しなし** — wire に要求ごとの中止はないため、ローカル表示上のチューザーをブラウザーから閉じることはできない。破棄された決着は無視される。
- **ローカルキャリアのみ** — Electron ダイアログはローカルパスを選択する。通常 Web はホストチューザーを開く。リモートブラウザーとインプロセスのデプロイは `-browse` 構成を使う。プラットフォーム失敗は所有者の再試行可能なフォルダーダイアログを通じて現れる。
- **Linux 自動選択** — zenity または kdialog がなければ、Desktop でもホストは browse を選択する。Electron ダイアログは使われない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
