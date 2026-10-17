---
description: "The agent-plane presentation selector for users and maintainers choosing, configuring, or debugging which form of its tools an agent preset's models see."
kind: "package-reference"
---

# @deepseek-ai/dsh-agent-tool-presentation

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

[エージェントプリセット](../../preset/agent-preset-registry/README.md)で `dsh-agent-tool-presentation` を使い、モデルがすべてのネイティブツールスキーマを見るか、生成 SDK 付き `run_code` のみ見るかを固定します。各プリセットは独立に選択できるため、ネイティブと PTC エージェントはツールカタログを共有せず 1 プロセスを共有できます。`ptc` 選択は互換 PTC ランタイムを要求します。それを持たない配置は最初のプロンプト前にマウント時にプリセットを拒否します。このパッケージ存在時の `mode` フィールドは必須であり、パッケージ省略は配置既定を保持します。

## 目次

- [このパッケージの利用](#use-this-package)
- [実装の理解](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの利用

エージェントプリセットにこの行を追加し、そのプリセットに参加するすべてのエージェントのツール視認を固定します。`native` は可視各ツールスキーマを関数定義として提示します。`ptc` は `run_code` 転送と生成 SDK、および直接呼出しは `run_code` のみという規則のみ提示します。何も宣言しないエージェントは [`dsh-tools`](../tools/README.md) 行の配置全体 `mode` を得ます。

### プリセットへの行追加

```yaml
- name: '@deepseek-ai/dsh-agent-tool-presentation'
  config:
    mode: ptc
```

| Field | Default | Meaning |
|---|---|---|
| `mode` | required | `native` — every schema; `ptc` — `run_code` plus generated SDK |

生成済みの[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-agent-tool-presentation)は受け付ける全フィールドの網羅的な情報源です。`mode` が必須であり既定化されないのは、この行のないプリセットが配置既定を継承するためです。

### PTC モードの要件

`ptc` 選択は言語に登録済み SDK レンダラーを持つ構成済み PTC ランタイム (`ctx.ptcRuntime`) を必要とします。TypeScript ランタイムは [`dsh-ptc-runtime-node`](../../ptc-runtime/ptc-runtime-node/README.md) 経由で出荷され、TypeScript と Python の両 SDK レンダラーは `dsh-tools` 組込みです。そのようなランタイムを構成しない配置に対して PTC モードを選択するプリセットはマウントを拒否し、この行を名指しするため、失敗はセッション最初の要求ではなく操作者が対処できる場所に届きます。

### エージェントごとに 1 プレゼンテーション

1 エージェントは 1 プレゼンテーションを宣言します。同じ構成の 2 つ目の宣言はマージではなく拒否されます。「モデルが見る形はどれか」への 2 回答は上書きではなく矛盾です。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

この節ではパッケージが上記動作を実現する方法を説明します。観測可能な契約は [Use this package](#use-this-package) で扱っています。

### 設計概念

ツールレジストリーはプリセットに移動できません。そのコンシューマーはすべてホストプレーンです。エージェントループはスケジューラーを読み、API プロキシーはプレゼンターを読み、すべてのツールプラグインはそこに登録します。サービスはすべてのコンシューマーが共に移動する場合のみ下位移動します。プリセットが所有できるのはそのレジストリーのプレゼンテーションです。`ctx.tools.presentAs()` はマウントスコープ向けに宣言し、それはプリセットの常設マウントであるため、宣言はそのプリセットに参加するすべてのエージェントを覆い、PTC モードプリセットは 1 プロセスでネイティブと並走します。セッションごとではなく構成ごとに 1 行です。

### ソースマップ

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: `mode` config, `apply` wiring `ctx.tools.presentAs` for the mounting scope |

### 動作注記

`native` は即時適用されます。PTC モードは代わりに `ctx.ptcRuntime` (ホストプレーンサービス) を待ちます。ランタイムを構成しない配置に対して PTC モードを選択するプリセットはこの行を保留し、`dsh-agent-preset-registry` はこの id を名指してマウントを拒否します。`presentAs` 自体が effect であるため、宣言はこの行と共に巻き戻り、それを所有する 2 つ目のラッパーはありません。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

パッケージレベルの契約は多くのコンシューマーに十分です。周辺ドメインが必要な場合に読みます。

- [tools package](../tools/README.md) — the tool presentation modes and `presentAs` API.
- [agent-presets package](../../preset/agent-preset-registry/README.md) — how presets compose agents and their standing mounts.
- [Node ptc-runtime package](../../ptc-runtime/ptc-runtime-node/README.md) — the TypeScript runtime a PTC mode needs.
- [historical PTC mode executor-collapse note](../../../.agents/notes/archived/bug-fix/2026-08-07-ptc-executor-collapse.md) — why the announced and callable surfaces stay the same.
- [Core group map](../README.md) — how the core packages compose.

-----

<a id="model-experience"></a>
## モデル体験

間接的に、`dsh-tools` で選択するツールプレゼンテーション経由です。行は `dsh-tools` が所有する 2 投影の選択のみ行い、独自のプロンプト、スキーマ、結果は登録しません。

#### KV キャッシュ効果

直接無効化なし。プレゼンテーションはエージェント構成時に固定されるため、その要求プレフィックスはセッション存続期間 stable です。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、この行に特別な注意が必要になる条件を定めます。これらは現行パッケージの制約であり、タスクバックログではありません。

- **The runtime stays host-plane** — プリセットは PTC モードを選択できますが、必要な TypeScript ランタイムは提供できません。それを構成しない配置は PTC プリセットを構成できません。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
