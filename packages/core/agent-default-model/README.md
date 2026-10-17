---
description: "どのモデルで新規作成エージェントが開始するかを選択、設定、デバッグするユーザーとメンテナーのための、デプロイ既定モデル選択。"
kind: "package-reference"
---

# @deepseek-ai/dsh-agent-default-model

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

セッションが指定しない場合に新規作成エージェントへ共有既定プロバイダーとモデルを与える。プロバイダー、モデル、reasoning effort はライブ設定フィールドである。保存された選択は有効プロファイルパッチを更新し、後の読み取りに適用される。セッションごとの選択はエントリーポイントが所有したままである。

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

明示的なモデル経路なしにエージェントが作成される場所にはどこでもこのパッケージをマウントする。サービスは 1 つの問いに答える。新規エージェントはどのモデルを使うべきか。エージェントを作成するエントリーポイントは既定値を再実装せずにそれを参照する。

### 既定値の設定

構成はプロバイダーとモデルを必須とする。コンシューマーは設定エディターがマウントされていない場合でもライブ参照を読む。

```yaml
- name: '@deepseek-ai/dsh-agent-default-model'
  config:
    provider: deepseek
    model: deepseek-chat
```

| フィールド | 既定値 | 意味 |
|---|---|---|
| `provider` | 必須 | 新規エージェント用の登録済みプロバイダー経路 |
| `model` | 必須 | 新規エージェント用のプロバイダー所有モデル id |

生成された[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-agent-default-model)は受け付けるすべてのフィールドを列挙する。`reasoningEffort` は任意である。それなしに選択を保存するとプロファイルの完全設定上書きからそのフィールドが除去される。

### 既定値の読み取りと変更

`currentSelection()` は新規作成エージェントのための切り離された `{ provider, model, reasoningEffort? }` を返す。`saveSelection()` は後のエージェントのために完全な選択を格納する。

```text
const selection = ctx.agentDefaultModel.currentSelection()
await ctx.agentDefaultModel.saveSelection({ provider, model, reasoningEffort: 'high' })
```

設定エディターがなければ `saveSelection()` は何もしない。サービスはカタログ所属を検証しない。モデル要求を開くコンシューマーが利用可能性診断を所有する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

この節はサービスが上記の動作を実現する仕組みを説明する。観察可能な契約は[このパッケージを使う](#use-this-package)でカバーする。

### 設計概念

サービスは検証済み設定参照を保持し、`currentSelection()` でそれらを標本化する。`saveSelection()` は提出値を捕捉し、重なる呼び出し元を含めて提出順にプロファイル書き込みを直列化する。各呼び出し元は自身の書き込み失敗を観察する。拒否された書き込みは後の保存を妨げない。セッション固有の選択はコンシューマー側で優先される。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | ライブ既定選択とプロファイルに支えられた書き込み |

### 動作注記

`currentSelection()` は切り離された選択を返す。捕捉された選択は、後の操作が更新された設定参照を読む間も安定したままである。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

ほとんどのコンシューマーにはパッケージレベルの契約で十分である。周囲の領域が必要な場合に以下を読む。

- [Core サブシステム](../../../docs/subsystems/core.md) — `Agent` ハンドルと `AgentOptions` 経路選択。
- [agent-loop パッケージ](../agent-loop/README.md) — エージェントが要求時にプロバイダーとモデルを解決する仕組み。
- [生成された設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-agent-default-model) — 受け付けるすべての設定フィールドとそのソース宣言。
- [Core グループマップ](../README.md) — core パッケージ群の構成方法。

-----

<a id="model-experience"></a>
## モデル体験

エントリーポイントにサービスが供給する `ModelSelection` を通じた間接的なもの。要求組み立てとプロバイダーアダプターはモデル可視要求を所有する。

#### KV キャッシュへの影響

既定値変更はそこから後に解決するエージェントにのみ影響する。要求ログがすでに選択を指名している既存セッションはその選択を保持するため、このサービスは確立済みプレフィックスを無効化しない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限はサービスの範囲を定義する。これらは現在のパッケージの制約であり、タスクバックログではない。

- **プロセス全体で 1 つの既定値** — サービスは単一の既定値を所有する。セッションごとのモデル選択はエントリーポイントの責務のままである。
- **永続化にはプロファイル設定エディターが必要** — それがなければ、既定値の保存は選択を保持しない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
