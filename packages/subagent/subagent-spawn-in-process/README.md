---
description: "新鮮な子への委譲を選択・構成・デバッグするユーザーとメンテナー向けのインプロセス spawn サブエージェントバックエンド。"
kind: "package-reference"
---

# @deepseek-ai/dsh-subagent-spawn-in-process

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-subagent-spawn-in-process` はインプロセスサブエージェントバックエンドである。委譲された各タスクを、このプロセスとそのエージェントファクトリー・LLM・ツールサービスを共有する新鮮な子エージェントで実行する。子は空の会話で開始するため、タスクプロンプトは単独で成立しなければならない。`request.agentOptions` 上書きがない限り、親の作業ディレクトリ・セッション lineage・プロバイダー・モデル・reasoning effort・出力トークン上限を継承する。委譲ツールや API 呼び出しは `spawn` プロバイダー名下でそこに届く。最も安い委譲輸送に選ぶ。子が親の完了会話ターン上に構築しなければならない場合は fork バックエンドを選ぶ。

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

新鮮なインプロセス子へ作業を委譲する構成に、このバックエンドをマウントする。通常パスは明示的である。サブエージェントサービスとこのバックエンドを読み込み、次に `dsh-tool-subagent` のような委譲ツールを `spawn` プロバイダーへ向ける。

### 選ぶ場合

子が親会話を必要とせず、このプロセス内実行が許容できる場合に spawn バックエンドを選ぶ。子が完了済み親ターン上に構築しなければならない場合（その履歴を fork バックエンドが植える）や、子がこのプロセス外で実行しなければならない場合（プロセス外バックエンドが提供する）は避ける。子が既定で親の作業ディレクトリと LLM 選択を継承するため、自己完結プロンプトは書かれたとおりに振る舞う。

### 最小構成

サブエージェントサービスとこのバックエンドを読み込み、次に対象ごとに委譲ツールを 1 件構成する。これは spawn 支援の `subagent` ツールを公開する最小構成である。

```yaml
- name: '@deepseek-ai/dsh-subagent'
- name: '@deepseek-ai/dsh-subagent-spawn-in-process'
- name: '@deepseek-ai/dsh-tool-subagent'
  config:
    provider: spawn
```

| フィールド | 既定値 | 意味 |
|---|---|---|
| `providerName` | `spawn` | `ctx.subagents` に登録されるプロバイダー名 |

生成された[構成カタログ](../../../docs/config-catalog.md#deepseek-aidsh-subagent-spawn-in-process)は受け入れるすべてのフィールドとその JSDoc の網羅的ソースである。

### 委譲が行うこと

1 ツール呼び出しはバックグラウンド子を作り、そのセッション id をただちに返す。子は自身のセッションで働き、親は完了通知で最終回答を受け取る。子は `send_message` 経由でもメッセージを送れる。拒まれた開始は公開子を残さない。ワークフローのようなプログラム呼び出し元は有効化結果を直接 await できる。
明示的 `agentPreset` は現在登録済みプリセットを独立に選択する。省略時は親の有効リビジョンに join する。この選択に対応するのは spawn のみである。persona とツールは[プリセット定義](../../preset/agent-preset-registry/README.md)に属する。コールド再開は共有[子構成ルール](../subagent/README.md#restoring-child-composition)に従う。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションではプロバイダー準備とサブエージェントサービスが所有する有効化ライフサイクルを説明する。

### 設計概念

このバックエンドはプロバイダーを登録し、新鮮な子セッションを準備する。`dsh-subagent` は有効化深度検査、子生成、プリセット合成、構造化出力、結果収集、破棄を所有する。呼び出し元信号は未公開生成を取り消し、公開ハンドルは `dispose()` 経由で取り消して静穏に達する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プロバイダー登録: `Config` スキーマ、ケイパビリティ宣言、`prepareContinuable()` |

### 実行フロー

`startActivation()` はプロバイダーを解決して `prepareContinuable()` を呼び、次に子を生成・公開する。構造化出力は有効化ごとに別々に付随する。呼び出し元は `result` を await でき、`dispose()` で子サブツリー全体が静穏に達するのを待てる。

### 所有権とスコープ

子は継承または独立選択プリセットの下に自身の登録スコープを持つ。親のエージェントローカルツール制限は import されない。バックエンドは他の開始時ケイパビリティと並んで `agentPreset` と `agentOptions` を広告し、サブエージェントマネージャーは子生成中にそれらを適用する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときに、これらのページを読む。共有サブエージェントモデルから兄弟バックエンドと網羅的構成へと進む。

- [サブエージェントサブシステム](../../../docs/subsystems/subagent.md) — 開始要求、結果、ライブ実行、プロバイダー契約。
- [dsh-subagent-fork-in-process](../subagent-fork-in-process/README.md) — 完了済み親ターンを植える兄弟バックエンド。
- [dsh-tool-subagent](../tool-subagent/README.md) — このプロバイダーに届くモデル向け委譲ツール。
- [生成構成カタログ](../../../docs/config-catalog.md#deepseek-aidsh-subagent-spawn-in-process) — 受け入れるすべての構成フィールドとそのソース宣言。

-----

<a id="model-experience"></a>
## モデル体験

### 子エージェント要求

#### モデルが見るもの

新鮮な子はタスク内容を逐語でその唯一のユーザーメッセージとして新しい空の会話で受け取り、既定で親プロバイダー・モデル・reasoning effort・出力トークン上限・作業ディレクトリを伴う。継承または選択プリセットがツールとプロンプト節を供給する。親会話メッセージは含まれない。

#### トークンへの影響

子は新しい独立コンテキストと履歴の代価を払い、親履歴トークンの重複はない。プリセットのプロンプトとツールが繰り返しプロンプト・スキーマ・生成 SDK コストを決める。

#### KV キャッシュへの影響

子のリクエストキャッシュは親から独立である。子履歴は追記専用に成長し、プリセット・生成 SDK・プロバイダー・モデル変更は異なる子プレフィックスを確立する。

### 親ツール結果、間接的に

#### モデルが見るもの

`dsh-tool-subagent` 経由で、親はまず子セッション id を受け、次に最終回答付き完了通知を受ける。子作成メッセージは `send_message` 経由で届く。内部の子ツール呼び出しは子セッションに残る。

#### トークンへの影響

親入力はデータ依存の結果 1 件分成長し、コンパクションまで保持される。

#### KV キャッシュへの影響

追記専用である。新しく可視になる内容は再利用可能なリクエストプレフィックスの後に続き、既存 KV キャッシュエントリを無効化しない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


バックエンドが誤った選択である場合を定める。これらは現在のパッケージ制約である。

- **新鮮とは親 transcript なしを意味する** — 子は cwd、lineage、プロバイダー、モデル、reasoning effort、出力トークン上限を継承するが、親会話は継承しない。完了ターン文脈が必要な場合は fork バックエンドを使う。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
