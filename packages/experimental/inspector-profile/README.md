---
description: "Optional Web profile layer for raw Session logs and Chat node inspection."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-inspector-profile

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

この任意バンドルを有効にすると、Sidebar でセッションデータを検査し、下部パネルで NodeJS Inspector を開ける。両方のインスペクターと Host fetch 取り込みを有効にする。バンドル自体は Plugin Manager でデフォルトオフである。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [モデル体験](#model-experience)
- [既知の制限と後回しにした作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

Plugin Manager の official グループで **Developer Tools** を有効にする。これにより現在の Web プロファイル用に `@deepseek-ai/dsh-experimental-inspector-profile` が選択される。

Sidebar の新規タブメニューまたはガイドから **Session Log** を開く。[Session Inspector](../session-inspector/README.md)は選択可能な Raw Log と Chat Group 表示を持つ 1 つのビューを提供する。Raw Log が初期選択である。

**Ctrl/Cmd+Shift+.** を押すと、パッケージ済み DevTools フロントエンドで下部パネルに **NodeJS Inspector** を開閉する。このバンドルの有効化によりローカルデバッグバックエンドと非編集 Host fetch 取り込みが開始される。ユーザーオーバーライドやデバッグ引数は不要である。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

[`cordis.patch.yml`](cordis.patch.yml)はデバッグフラグとは独立に、Session Inspector と NodeJS Inspector バックエンドを `captureFetch: true` で有効にする。デバッグと取り込み動作は Inspector [README](../inspector/README.md) を参照。各プラグインが自身の動作と存続期間を所有する。

</details>

-----

<a id="model-experience"></a>
## モデル体験

なし。このバンドルはモデルコンテキストを提供せずに開発者検査プラグインをマウントするためである。

#### KV キャッシュへの影響

なし。このバンドルはリクエスト内容を追加しない。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

- **Web のみ** — 検査ビューは Web アプリケーションのセッションサービスを必要とする。
- **内部診断** — コンポーネント切り替えは利用可能なままであるが、専用の Web デバッグボタンはない。明示的有効化により非編集取り込みとローカルコード実行が有効になる。[セキュリティ制限](../inspector/README.md#security)を参照。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
