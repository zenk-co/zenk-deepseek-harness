---
description: "エージェントループテスト向け前提マウント、本番 AgentLoop ドライバー、明示的 Inbox スタブ。"
kind: "package-library"
---

# @deepseek-ai/dsh-agent-loop-testkit

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-agent-loop-testkit` を使って AgentLoop テストに標準前提と本番ループドライバーを与え、繰り返しセットアップをなくす。ハーネスは真のエージェントを作り、耐久イベント、回復、通知、クレーム動作のテスト向けに入力 Inbox の要求を公開する。キュー編集だけ要するコンシューマーテストにはプロセスローカル Inbox スタブを選ぶ。保留入力に決して触れてはならないときは fail-fast Inbox を選ぶ。テストは引き続きアダプター、任意プラグイン、読み込み順序、コンテキスト破棄を所有し、パッケージはモデルに見える動作を加えない。

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

構造エージェントスタブ付きのコンシューマー専用テストは `provideWorkingDirectoryFixture(ctx, defaultDirectory?)` を使える。パス検証、ディレクトリ変更、イベント記録なしにディレクトリ値を提供する。ディレクトリ動作のテストは `mountAgentLoopTestDependencies(ctx, { workingDirectory: true })` と真の一時ディレクトリを使う。

このパッケージは AgentLoop テストに動作サービス位相を与え、本番 Inbox 動作と構造スタブの選択を明示的に保つ。

### 本番エージェントの駆動

耐久 Inbox イベント、投影回復または検証、ライブ Inbox 通知、ループドライバークレームをカバーするときは `mountAgentLoopTestHarness()` を使う。読み込み順序に敏感なコンシューマーは前提の後、エージェント作成の前にマウントする。コンテキストはループとハーネスが返すすべてのエージェントを所有する。

```ts
import { Context } from '@deepseek-ai/cordis'
import { SessionId, type UserMessage } from '@deepseek-ai/dsh-session'
import {
  mountAgentLoopTestDependencies,
  mountAgentLoopTestHarness,
} from '@deepseek-ai/dsh-agent-loop-testkit'

const ctx = new Context()

await mountAgentLoopTestDependencies(ctx)
// Register the test adapter and any load-order-sensitive plugins here.
const harness = await mountAgentLoopTestHarness(ctx)
const agent = await harness.create(SessionId('test-agent'))
declare const message: UserMessage

agent.inbox.append('next-turn', message)
const admitted = harness.claim(agent, 'next-turn', 1)
```

依存ヘルパーはシステムプロンプトとツールレジストリ構成を `options` 経由で転送し、それらサービス自身の既定を超えるテスト既定は提供しない。プラグイン読み込み失敗はヘルパー呼び出しを拒否する。シーケンス前半で活性化されたサービスは引き続きコンテキスト所有であり、コンテキスト破棄時に巻き戻る。

### 構造エージェントスタブの構築

テスト対象が変更可能な保留一覧を要するが耐久性、投影検証、ライブ Inbox 通知、ドライバークレームポリシーを exercise しないときは `createInboxStub()` を使う。スタブは公開キュー操作を 2 件のプロセスローカル配列で実装し、セッションに決して書かない。テスト対象が保留入力に触れてはならないときは `unsupportedInbox()` を使う。すべての変更は最初の予期せぬ依存で throw する。

```ts
import { createInboxStub } from '@deepseek-ai/dsh-agent-loop-testkit'

const agent = {
  // ...
  inbox: createInboxStub(),
}
```

### 使うべきとき

本番ループまたは耐久 Inbox 動作が対象のテストには依存とループのヘルパーを使う。キュー編集だけ要するコンシューマードメインテストには構造スタブを使う。サービス注入失敗や部分位相を探るテストは依存を直接マウントする。ヘルパーはそれらのテストが制御しなければならない配線をちょうど隠すためである。

### 失敗し得ること

ハーネスは LLM アダプターをマウントしない。モデル要求を開始する作業を送る前にアダプターを登録する。すべてのテスト後に所有コンテキストを破棄し、エージェントが静止に達し、スコープ登録が巻き戻るようにする。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

この節はテストユーティリティの設計を説明する。観測可能な動作は[このパッケージを使う](#use-this-package)で完全にカバーされる。

### 設計

`mountAgentLoopTestDependencies` は 6 件のサービスプラグインを固定依存順序でマウントする — LLM、セッション、セッションプロジェクションレジストリ、システムプロンプトレジストリ、ツールレジストリ、次にエージェントレジストリ — `AgentLoop` の手前で止まるため、呼び出し元はループ読み込み順序を制御する。`mountAgentLoopTestHarness` は公開本番プラグインをマウントし、そのサービス経由でエージェントを作り、ループの具体的 Inbox クラスや投影定義を export せずに本番ドライバーのクレーム操作を公開する。[`src/inbox.ts`](src/inbox.ts) はプロセスローカル変更可能スタブと fail-fast の unsupported プレースホルダーのみ含む。投影も耐久イベント実装も所有しない。マウントとドライバー実装は [`src/index.ts`](src/index.ts) にある。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの動作では足りないときにこれらを読むこと。ループからヘルパーがマウントするサービスとそれを使うテストへ進む。

- [エージェントループパッケージ](../../core/agent-loop/README.md) — 本番動作向けにこのヘルパーがマウントする具体的ループ。
- [セッションパッケージ](../../core/session/README.md) — 本番 Inbox 動作が使う耐久イベントログ。
- [LLM パッケージ](../../llm/llm/README.md) — ヘルパーが準備する LLM ランタイムとアダプター界面。
- [テストポリシー](../../../docs/testing.md) — これらのテストが仕えるカバレッジ層。
- [test-support グループマップ](../README.md) — 兄弟ハーネスとサポートパッケージ。

-----

<a id="model-experience"></a>
## モデル体験

なし。これらのテスト専用ユーティリティはモデル要求を組み立てず変更しないためである。

#### KV キャッシュへの影響

なし。パッケージ自体はプロバイダー要求を送らない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

これらの制限はユーティリティが共有しないものを定める。現在のパッケージ制約であり、タスクバックログではない。

- **共有されるのは必須前提脊柱のみ** — アダプター、任意プラグイン、シナリオ固有の読み込み順序、コンテキスト破棄は引き続き呼び出し元所有である。
- **本番ハーネスにアダプター既定なし** — ループを開始するテストは exercise するルートを登録しなければならない。
- **変更可能 Inbox スタブはプロセスローカルのみ** — 耐久イベント、投影回復または検証、ライブ通知、クレームポリシーが問題になるときはハーネス作成エージェントを使うこと。
- **unsupported Inbox は変更を受け付けない** — 保留入力がテスト対象の一部であるときは変更可能スタブまたはハーネス作成エージェントを使うこと。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
