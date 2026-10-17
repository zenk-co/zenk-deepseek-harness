---
description: "Enable team collaboration, tools, and the Web roster and task board with one experimental bundle."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-agent-team-profile

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-experimental-agent-team-profile` は 1 つのバンドルで [Agent Teams](../agent-team/README.md) 協調、ツール、Web UI を有効化します。チームメイトに作業を委譲し、Web でメンバー、共有タスク、チームメイトセッションを表示します。通常サブエージェント委譲と重複グローバル子制御は無効です。Workflow は新規子をまだ作成できます。バンドルは dsh 無効で出荷されます。Plugins ページから有効化するか、初期化済みプロファイルに追加してください。

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

### プロファイルへのインストール

初期化済みプロファイルにパッケージを追加し、リードに作業委譲を求めるタスクを実行します:

```sh
dsh plugin --profile headless add @deepseek-ai/dsh-experimental-agent-team-profile
dsh --profile headless "Use Agent Teams to split this task between two teammates, wait, and summarize."
```

プロファイルは `@deepseek-ai/dsh-base` を既に含まなければなりません。この層はその Subagent サービスとプロバイダー行を消費します。`dsh plugin --profile <name> remove @deepseek-ai/dsh-experimental-agent-team-profile` でパッケージを除去すると、プロファイルの順序付き層一覧からバンドルが除去されます。

Web または Desktop の Plugins ページで Agent Teams を有効化するとツールと UI の両方が有効化されます。CLI Web プロファイルには次を使います:

```sh
dsh plugin --profile web add @deepseek-ai/dsh-experimental-agent-team-profile
```

既存プロファイルの `package.json` では、`dsh.profile.bundles` に `@deepseek-ai/dsh-experimental-agent-team-profile` を残し、別の `@deepseek-ai/dsh-experimental-agent-team-web-profile` エントリーを除去します。`ui-agent-team` を対象とするユーザーパッチは引き続き適用されます。

### 得られるもの

層は Agent Teams ドメインとそのスコープ付き作成、名簿、メッセージング、中断、待機、タスクボードツールを追加します。直接委譲は新規およびフォークコンテキストに対応する `spawn_teammate` を使います。`subagent` と `subagent_fork` ツールおよび重複グローバル子制御は無効です。Workflow はベースプロファイルの `spawn` プロバイダーを保持し、基盤 Subagent サービスと両プロバイダーはチームメイトと workflow から利用可能です。

Web と Desktop 会話では [Team UI](../client-ui-agent-team/README.md) がメンバー名簿と共有タスクボードを表示し、チームメイトセッションを開きます。同じバンドルスイッチがツールとブラウザー UI を制御します。Plugins ページは無効中も含め、バンドルの [icon](icon.svg) を `package.json.icon` 宣言から読みます。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

パッケージのランタイム内容は [`cordis.patch.yml`](cordis.patch.yml) です。`dsh-base` 適用後にパッチが `tool-subagent-control`、`tool-subagent-list-agents`、`tool-subagent`、`tool-subagent-fork` を無効化し、Team サービス、ツール、UI を明示プロバイダーと制限付きで挿入します。UI プラグインは不活性ホストエントリーを持ちます。Web Client ローダーのみブラウザーエントリーをマウントするため、headless に Web サーバーは不要です。

| File | Role |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | Ordered patch over `dsh-base` |
| [`src/index.ts`](src/index.ts) | Empty module entry; the patch is the runtime content |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Experimental packages](../README.md) — incubation status and publication policy.
- [Agent Teams service](../agent-team/README.md) — durable roster and task board, plus direct messaging.
- [Agent Teams tools](../tool-agent-team/README.md) — the Team-scoped model tool surface.
- [Agent Teams browser UI](../client-ui-agent-team/README.md) — roster, task board, and teammate session navigation.
- [Base bundle](../../bundle/base/README.md) — the profile layer this patch extends.

-----

<a id="model-experience"></a>
## モデル体験

### チームポリシーとツール

#### モデルが見るもの

Team ポリシーとスキーマは [`@deepseek-ai/dsh-experimental-tool-agent-team`](../tool-agent-team/README.md) に属します。このバンドルは構成のみ変更します。Team スコープの `list_agents`、`send_message`、`interrupt_agent` が無効化グローバル継続可能子制御を置換します。`spawn_teammate` は直接委譲ツールです。Workflow の `agent()` 呼び出しは新規ワンショット子を作成します。そのプロンプトはタスクに必要なコンテキストを含まなければなりません。

#### トークン効果

バンドルは `@deepseek-ai/dsh-experimental-tool-agent-team` が記述する Team ポリシーとツールスキーマを追加します。独自のプロンプトテキストは加えません。

#### KV キャッシュ効果

バンドルパッチと設定ツールスキーマが不変の間、共有システムプロンプトとツールスキーマはプレフィックス stable を保ちます。Team 同一性はランタイムコンテキストスナップショット経由で追記されます。[Team ツール](../tool-agent-team/README.md#model-experience)はスナップショット再利用を定めます。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- **Opt-in only** — パッケージはインストール無効で出荷されます。出荷 CLI、Web、SDK、ACP、Python プロファイルはいずれも有効化しません。
- **Workflow child tools** — [Team ツール可視性制限](../tool-agent-team/README.md#known-limitations-and-deferred-work)は workflow 子にも適用されます。
- **Shared checkout** — すべてのチームメイトは同じ作業ディレクトリーを観測します。このバンドルは worktree 分離もファイルシステムロックも加えません。
- **Preset-scoped child controls** — Web プリセットは独自スコープに継続可能 Subagent 制御をまだマウントできます。このトップレベルバンドルはそれらの登録を置換しません。
- **Base profile required** — パッチは `dsh-base` 提供の行 ID と Subagent プロバイダーに依存します。単独プロファイルではありません。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
