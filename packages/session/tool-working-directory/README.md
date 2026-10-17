---
description: "Read the Session’s current directory or enter an existing directory with the same tool. Relative changes use the current directory. The returned absolute path can be passed to other tools."
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-working-directory

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

セッションのカレントディレクトリの読み取りも、既存ディレクトリへの移動も同じツールで行う。相対変更はカレントディレクトリを基準とする。返される絶対パスは他のツールに渡せる。

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

`tools` と `workingDirectory` と並べてマウントする。読み取りには `working_directory({})`、ディレクトリ変更には `working_directory({ cd: "src" })` を呼び出す。このツールに設定フィールドはない。

```yaml
- name: '@deepseek-ai/dsh-tool-working-directory'
```

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

このツールは検証、回復、永続化、コンテキスト通知をディレクトリ所有者に委譲する。正規結果は `cwd` を含み、ネイティブ描画はそのパスを返す。汎用ツールカードは引数と結果を、個別 GUI レンダラーなしに表示する。

ディレクトリ状態と変更をすべて `workingDirectory` に委譲するため、公開される実行時不変条件コンパニオンはない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [作業ディレクトリ](../../../docs/subsystems/working-directory.md) — 共有実行時動作。
- [セッショングループ](../README.md) — durable セッションサービス。
- [テスト](../../../docs/testing.md) — 構成とリプレイ検証。

-----

<a id="model-experience"></a>
## モデル体験

### ツールスキーマと結果

#### モデルが見るもの

[ツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-working-directory)は任意の `cd` 引数と正規の `cwd` 結果を定義する。ディレクトリ通知は `dsh-working-directory` が所有する。

#### トークンへの影響

登録済みスキーマと返されるパスは、ツールが利用可能で呼び出された際にトークンを消費する。

#### KV キャッシュへの影響

ツール可用性の変更によりスキーマコンテキストが変わる。ツール呼び出しは、以前のメッセージを置換せずに通常の呼び出し・結果履歴を追加する。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

- **呼び出しセッションが必須** — このツールはエージェントを必要とし、既存プロセスも書き込み権限も変更しない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
