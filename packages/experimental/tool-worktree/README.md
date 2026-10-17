---
description: "新しいローカル Git ワークツリーを作成し、現在のセッションディレクトリを変更するモデルツール。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-tool-worktree

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

GUI プラグインマネージャーから Git ワークツリーを追加し、モデルが 1 呼び出しで新しい Git ワークツリーを作成・入室できるようにする。この任意バンドルはハーネスと共にインストールされ、選択されるまで無効のままである。ネイティブツール呼び出しと PTC プログラムは同じ型付き結果を受け取り、既存ファイル方針が作成を統治する。

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

GUI で**プラグイン → Official → Git ワークツリー**を開き、スイッチを入れる。バンドルは [worktree ランタイム](../worktree/README.md) とこのツールを一緒に読み込む。出荷プロファイルではすべて無効である。切ると既存チェックアウトやブランチを削除せずに `create_worktree` が消える。組み込み `working_directory` ツールは引き続き利用できる。

明示的コンポジションでは、worktree ランタイムとツールレジストリの後にこのファンクションプラグインをマウントする。

```yaml
- name: '@deepseek-ai/dsh-experimental-worktree'
- name: '@deepseek-ai/dsh-experimental-tool-worktree'
```

`create_worktree({ name?: string, from?: string })` を呼ぶ。成功は正規チェックアウト `path`・新規 `branch`・固定 `baseCommit`・由来 `repositoryRoot` を返し、呼び出しセッションの現在作業ディレクトリを変更する。離れるには `working_directory({ cd: path })` を呼ぶ。チェックアウトとブランチは残る。正確なスキーマとモデル向き説明は[生成ツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-experimental-tool-worktree)が所有する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

[`cordis.patch.yml`](cordis.patch.yml) は `worktree` ランタイム行と `tool-worktree` 利用者行を挿入する。[`src/index.ts`](src/index.ts) は 1 つの型付きツールを登録する。ランタイム作成が Git 動作・取り消し・作業ディレクトリ変更を所有する。ツールはランタイム記録を正規値として返し、その記録を JSON として描画する。そのホスト提示は汎用カードを使う。破棄でツールの登録が外れる。

ツールが worktree ランタイムと独立に状態を保持しないため、実行時不変条件の伴走文書は公開しない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [Worktree ランタイム](../worktree/README.md) — 設定・作成意味・書き込み権限。
- [作業ディレクトリ](../../session/working-directory/README.md) — セッションコンテキストと退出操作。
- [ツール作成](../../../docs/cookbook/adding-a-tool.md) — 正規結果と純粋提示。

-----

<a id="model-experience"></a>
## モデル体験

### 作成ツール

#### モデルが見るもの

[ツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-experimental-tool-worktree)は `create_worktree` を定義する。各成功結果は作成チェックアウトの正規パス・ブランチ・基準コミット・由来チェックアウトの最上位ディレクトリを含む。失敗呼び出しは操作エラーを報告する。

#### トークン効果

スキーマはマウント中に要求ごとの固定費を持つ。各呼び出しは引数と上限付き作成結果またはエラーを通常ツール履歴に追記する。

#### KV キャッシュ効果

変更のないツールスキーマは既存接頭辞を保持する。呼び出しは従来履歴の後に追記され、作業ディレクトリサービスは成功ディレクトリ変更を後続要求向けに別途記録する。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **呼び出しエージェントが必須** — ツールはセッションディレクトリを変更するため、エージェントなしの呼び出しを拒否する。
- **作成のみ** — 検査・マージ・チェックアウトやブランチの削除はこのツールの外であり、[ランタイム制限](../worktree/README.md#known-limitations-and-deferred-work)も適用される。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
