---
description: "Save active profile configuration and apply it through Loader."
kind: "package-reference"
---

# @deepseek-ai/dsh-config-editor

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

アクティブプロファイルのパッチにプラグイン設定を保存し、直ちに適用する。書き込みはディスクに触れる前に完全な候補を検証し、プロファイル変更や HMR と直列化する。不正な値や上位層のオーバーライドがある場合、ファイルは変更されない。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と後回しにした作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

<a id="use-this-package"></a>
## このパッケージを使う

Loader と `profileContext` のあるプロファイルアプリケーションにこのサービスをマウントする。設定フィールドはない。

```yaml
- id: config-editor
  name: '@deepseek-ai/dsh-config-editor'
```

ライブフィールドに限定したフォームには [settings](../../settings/settings/README.md) を使用する。完全な設定を編集する呼び出し元は `ctx.configEditor.edit()` を使用できる。通常のフィールドは Loader の通常ライフサイクルを保持する。

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

[エディター](src/index.ts)は候補を導出する前に外部変更を調整し、他のプロファイル操作と並べてプロファイルマニフェストをロックし、設定オーバーライドを不可分に置換する。置換値の外側にある YAML コメントと `!!js` 式を保持する。調整失敗時は以前のドキュメントを復元し、以前のパッチを再読み込みする。

設定読み取りは、プロファイル設定オーバーライドのないエントリ用に 1 つの構成を共有する。オーバーライドされたエントリは自身のオーバーライドのみを除去して個別に構成される。プロファイル挿入と他エントリのオーバーライドは有効のままである。返される設定は切り離され、読み取り間で構成はキャッシュされない。

</details>

<a id="further-exploration"></a>
## さらに調べる

- [プロファイル読み込み](../app-boot/README.md) — パッチ構成。
- [HMR](../hmr/README.md) — 再読み込み調整。
- [Settings](../../settings/settings/README.md) — スキーマ由来フォーム。

<a id="model-experience"></a>
## モデル体験

モデル向けプラグインが消費する設定値を通じて間接的に関与する。

#### KV キャッシュへの影響

リクエストプレフィックスを変更する利用者がキャッシュ効果を決定する。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

- 編集対象はアクティブプロファイルパッチである。ホームパッチとコマンドラインオーバーレイは優先順位用に読み取られるが、書き込み対象ではない。
- 完全な設定オーバーライドは通常フィールドを保持するが、現在の生値をプロファイル層に固定する。
- プロファイルのルート Include が所有する一意にアドレス指定されたエントリのみ編集可能である。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
