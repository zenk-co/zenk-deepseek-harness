---
description: "プラグイン、UI、オーケストレーターがエージェントを構築または拡張するための、Agent ハンドル、ライブレジストリ、プロセスローカルなイニシエータースコープ、および agent/* イベント語彙。"
kind: "package-reference"
---

# @deepseek-ai/dsh-agent

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-agent` を使うと、ライブエージェントの作成や再開、フォローアップまたはステアリング入力の送信、モデル向けコンテキストの注入、作業のキャンセル、アイドル完了の待機ができる。プラグイン、UI、フック、オーケストレーターは、エージェントのアクティビティを観察またはインターセプトし、他のエージェントに影響を与えずに 1 つのエージェントにケイパビリティを適用することもできる。コードが公開 `Agent` API を通じてライブエージェントを制御または拡張する必要がある場合に選ぶ。`dsh-agent-loop` のようなエージェントドライバーと組み合わせる。このパッケージ自体はモデルリクエストを作成しない。イニシエーターの帰属はプロセスローカルであり、ワーカー、プロセス、永続キュー、および再起動をまたいで明示的に運ばなければならない。

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

ライブエージェントが存在する場所ならどこでも `dsh-agent` をマウントする。これは `ctx.agents` と、プラグイン、UI、フック、オーケストレーターが操作対象とする `Agent` ハンドルを提供する。ドライバーがファクトリーを登録するまでサービスは不活性である。出荷済みのドライバーは `dsh-agent-loop` なので、最小の有用な構成は両方をロードする。

### エージェントの作成または再開

`ctx.agents.create()` は 1 つの identity の下に新しいエージェントとセッションを構築する。`ctx.agents.resume()` は永続化されたセッションをロードし、その上にエージェントを再構築する。どちらも登録されたファクトリーに委譲し、`AgentHandle` を返す。これはそのエージェントを破棄できる唯一のオブジェクトである。どちらの操作のオプションでも `parentAgent` を設定すると結果はランタイム子になり、省略するとランタイムルートになる。`get(id)`、`list()`、`roots()` はライブエージェントを見つけ、`isOwnedBy(id, parent)` はその正確なライブ関係を検査する。

```text
const handle = await ctx.agents.create({
  sessionId,
  agentOptions: { provider: 'deepseek', model: 'deepseek-chat' },
})
// later:
await handle.dispose()   // stops the loop, unregisters, removes the session, unwinds the scope
```

`AgentOptions` は初期の provider/model ルート、オプションのアダプター所有 `reasoningEffort`、およびオプションの正の `maxTokens` 出力上限を供給する。ループは正確なモデルの reasoning サポートを検証し、アダプターのデフォルトを解決し、実効値をリクエストヘッダーに記録し、各会話リクエストに適用する。オプションの `setup(agentCtx, agent)` コールバックは、エージェントが公開される前にそのスコープ付き世界を構成する。`agentCtx` が登録を所有し、明示的な未公開 Agent がその Session を提供する。Context に逆方向の Agent プロパティはない。スコープ付きツール、プロンプトセクション、リスナーは作成アナウンスより前に存在する。setup は構成専用である。エージェントを駆動するのは作成が解決した後にのみ行う。

### エージェントの会話を駆動する

ハンドルのメソッドは、識別された user ロールメッセージをエージェントのインボックスにルーティングする。`followup()` は通常の次ターンプロンプトをキューに入れてドライバーを起こす。`steer()` は次ステップの入力を提出してドライバーを起こす。`inject()` はドライバーを起こさずにモデル向けコンテキストを追加するため、次に許可されたステップで着地する。`cancel(cause)` はアクティブなアクティビティを中断し、`keepInbox` が設定されていない限り保留中の作業をクリアする。`whenIdle()` はエージェント全体が静止状態に達した後に解決する。

```text
handle.agent.followup({
  content: [{ type: 'text', text: 'Summarize this workspace.' }],
  source: { kind: 'user' },
})
handle.agent.steer({
  content: [{ type: 'text', text: 'Focus on the tests.' }],
  source: { kind: 'my-plugin' },
})
await handle.agent.whenIdle()
```

### 登録を 1 つのエージェントにスコープする

`Agent.ctx` はエージェントのスコープ付きコンテキストである。それを通じて行われた登録 (ツール、プロンプトセクション、変数、イベントリスナー、制限) はそのエージェントだけに適用され、破棄時に巻き戻される。エージェントプリセットが、隣接するセッションに影響を与えずに 1 つのセッションへ異なるケイパビリティセットを与えるために使うのも同じ機構である。

### 実行中の作業をインターセプトまたは観察する

`agent/*` イベントにより、プラグインはループパッケージに依存せずにライブ作業へ作用できる。`agent/pre-step` は提案されたステップを拒否したり、そこに入るメッセージを置き換えたりできる。`agent/request-error` はリスナーが失敗したモデルリクエストを再試行できるようにする。`agent/turn-stopping` は、それ以外は完了したターンが閉じる前に実行され、ステアリングによってターンを開いたままにできる。`agent/assistant-stream` は、プロセスローカルな 1 つの Assistant 試行の順序付けられた start、一時的な chunk、end フレームを運ぶ。start はその試行のターンとステップを名指しし、chunk インデックスは 0 から密に続き、`end.index` は次の chunk 位置である。ループは完全なコンパクトストリームを 1 つの `assistant/message` または `assistant/attempt` としてコミットされた end フレームより前にコミットするため、ライブイベントはリプレイソースではなく表示データのままである。`agent/status`、`agent/created`、`agent/disposed` は UI と連携状態を駆動し、メッセージごとの `agent/inbox/*` 通知はインボックス射影を同期させ続ける。正確なシグネチャ、ディスパッチモード、およびペイロード契約は [core サブシステムページ](../../../docs/subsystems/core.md#cordis-surface)の生成領域にある。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションでは、このパッケージが上記の動作をどのように実現するかを説明する。観察可能な契約は[このパッケージを使う](#use-this-package)で網羅されている。

### 設計概念

このパッケージは 1 つの分離に基づいて構築されている。公開 `Agent` サーフェスとレジストリはここにあり、構築と駆動は登録されたファクトリーの背後でループパッケージにある。したがってコンシューマーは `dsh-agent` に依存し、`dsh-agent-loop` には決して依存しないため、ドライバーは差し替え可能なままである。第 2 の考えはイニシエータースコープである。`AsyncLocalStorage` チェーンが、そのエージェントが開始する非同期ドライバー作業を通じて正確なライブ `Agent` を運ぶため、ドライバーの下のヘルパーはすべての呼び出しでエージェントを転送しなくても自分の作業を帰属できる。

### ステップの受付

`PreStepDecision` は `{ kind: 'reject' }` または `{ kind: 'enter', messages, startsRequestSeries? }` のいずれかである。enter ブランチは、識別された完全な凍結メッセージバッチを含む。受け入れてもそれはコミットされない。組み立てと `step/start` の後、ループがシステムプロンプトとユーザーバッチをコミットする前に、`agent/request` と `prepareCall()` がルートを解決する。どちらの非同期フェーズ中のキャンセルも両方をコミットしない。`startsRequestSeries: true` は別個のモデルメッセージ系列を宣言する。ラップするリスナーは、どちらかを意図的に置き換えない限り、その宣言とバッチを保つ。クレームは提供されたメッセージをインボックスから除き、クレーム後に挿入されたメッセージは後の境界まで保留のままである。

### 永続インボックス

`Agent.inbox` は構造的な `Inbox` インターフェースのみを公開し、射影の語彙はこのパッケージに留まる。dsh-agent-loop はパッケージ内部の `ReactLoopInbox` と標準 `inbox` 射影を所有する。その具体的なインボックスを構築することで、射影レジストリが永続 `agent/inbox/spliced` フォールド用の登録を 1 つだけ所有することが保証される。レジストリはライブの `{ 'next-turn', 'next-step' }` 状態の唯一のオーナーのままである。再構築は、両方の保留リストにまたがる安全でない、または範囲外の splice 座標と重複 `MessageId` を拒否し、違反したイベント seq を報告する。

`Inbox` は保留中の `nextTurn` と `nextStep` メッセージを公開し、`append`、`prepend`、`replace`、`remove`、`clear`、および `splice` を通じてそれらを変更する。通常の削除と `clear()` は永続的なキャンセルである。ステップ境界で、ループの内部実装は純粋な削除 splice を通じて保留中の入力をクレームする。ライブ通知は意図的にメッセージ単位で最小限である。`agent/inbox/inserted { message }`、`agent/inbox/claimed { message, turn }`、および `agent/inbox/discarded { message }` の 3 つである。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリ: `AgentRegistry`、ファクトリースロット、イニシエータースコープ、`CreateAgentOptions`/`ResumeAgentOptions` |
| [`src/runtime-types.ts`](src/runtime-types.ts) | `Agent`、構造的 `Inbox`、`AgentStatus`、および `agent/*` イベント宣言 |
| [`src/types.ts`](src/types.ts) | `AgentOptions`、キャンセル原因、およびインボックス射影の語彙 |
| [`src/dispatch.ts`](src/dispatch.ts) | `agentEvents` 融合ディスパッチャーと `assembleContextFor(agent)` |
| [`src/consumed-work.ts`](src/consumed-work.ts) | `foldConsumedWork(events)`: ログの消費済み作業が何になったか |
| [`src/model-selection.ts`](src/model-selection.ts) | `installModelSelection`: 1 つの選択を組み立てとルーティングに結合する |
| [`src/archive-admission.ts`](src/archive-admission.ts) | Workspace レジストリのアーカイブ受付の `turn` ファミリー: 実行中のターンとその user 原因キャンセル |

### レジストリとライフサイクル

`AgentRegistry` はライブエージェントごとに、そのキャリアと作成者関係を伴う 1 つのエントリを保つ。構築済みのエージェントを使う前に `register()` を待機して、source `startup` を持つ直列の作成リスナーを完了させる。非同期ファクトリーは分割された `enter()`/`announce()` のペアを使うため、setup と初期化はロールバックで覆われたままである。作成中に要求されたデタッチは、待機対象のすべてのリスナーが決着するのを待ち、各デタッチは正確なエントリに束縛されるため、古いディスポーザーが後から同じ id で置き換えられたものを除去することはできない。テアダウンはループを停止して排出し、スコープを巻き戻し、エージェントをデタッチし、次にセッションをデタッチする。id はプライベートなクリーンアップ後に再利用可能になる。

レジストリはまた、公開するすべての Agent について Workspace レジストリのアーカイブ受付 ([シーム](../../workspace/workspace/README.md)) に応答する。`workspace/session-activity` は、Session の Agent が実行中の間、承認や回答を待っているターンを含めて `turn` ファミリーを報告し、`workspace/session-stop` はユーザー自身の停止と同じ方法でそのターンをキャンセルする。すなわち `agent.cancel({ kind: 'user' })` だが、停止ボタンの `keepInbox` は伴わないため、キュー済みの入力はログ済みのインボックス splice と共に破棄され、後からアーカイブ済み Session を起こすことはない。決着まで待機されるものは何もない。ライブ Agent のない Session には実行し得るターンがない。`turn` キーは [`src/types.ts`](src/types.ts) から `SessionActivityKindMap` にマージされるため、ファミリーを描画する Client はそのために `@deepseek-ai/dsh-agent/types` をインポートする。

### イニシエータースコープ

各ドライバーはその全ライフタイムを `ctx.agents.withInitiator(agent, ...)` の内部で実行するため、継承された非同期チェーンはそのエージェントを観察する。`withoutInitiator()` は、共有タイマーのような無関係なプロセスローカル作業のためにそれを隠す。この境界はプロセスローカルな帰属のみである。周囲の存在はライブネスの証明でも認可でもなく、ワーカー、プロセス、永続化、および wire の境界では明示的な identity が権威のままである。テアダウンは新しい境界を拒否し、返された Promise の境界を排出させてから、基盤ストレージを無効化する。詳細な契約は[イニシエータースコープの決定](../../../.agents/notes/implemented/architecture/2026-07-15-agent-initiator-scope.md)が所有する。

### 所有権の不変条件

`AgentHandle` のディスポーザーはケイパビリティである。コンシューマーの中で、その保持者だけがエージェントを破棄できる。登録されたファクトリープロバイダーは構造的な共同オーナーである。スコープ付きエージェントはそのプロバイダーのサービス API に依存するためである。プロバイダーのアンロードは、それが作成したすべてのライブハンドルを停止して排出する。`ctx.agents.get(id)` は依然として裸の `Agent` を返す。ハンドルはそれを作成したコンシューマーにのみ公開される。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

ほとんどのコンシューマーにはパッケージレベルの契約で十分である。周辺領域と設計根拠が必要な場合に以下を読む。

- [Core サブシステム](../../../docs/subsystems/core.md) — ループマップ、`Agent` ハンドル、インターセプト決定、および生成サービス API。
- [agent-loop パッケージ](../agent-loop/README.md) — エージェントを作成、駆動、破棄するデフォルトドライバー。
- [Session サブシステム](../../../docs/subsystems/session.md) — ハンドルの背後の永続ログと派生履歴。
- [イニシエータースコープの Agent Note](../../../.agents/notes/implemented/architecture/2026-07-15-agent-initiator-scope.md) — 境界とテアダウンの契約。
- [Core グループマップ](../README.md) — core パッケージ群の構成方法。

-----

<a id="model-experience"></a>
## モデル体験

### ユーザー、ステアリング、および注入メッセージ

#### モデルが見るもの

`followup`、`steer`、`inject` は、識別された user ロールメッセージとして所有セッションに供給される。受け入れられた内容は、モデルが後のステップで読む派生履歴の一部になる。`agent/pre-step` とその他の宣言済みイベントにより、プラグインは提案されたステップを拒否したり、永続的なリクエスト材料を追加したりできる。`installModelSelection` は、モデルリクエストを送信することになる異なる provider/model ルートに対して組み立てられた最初のステップに `[model changed: assistant turns above this point were generated by <previous>; the session continues with <next>]` を追加する。プロバイダー名が現れるのは切り替えがプロバイダーをまたぐ場合のみで、reasoning effort のみの変更は何も追加しない。空の最初の決定と、提供されたメッセージを除く決定は、リクエストなしの結果のままである。リクエストステップがヘッダーをログする前に失敗した場合、永続的な以前のルートが変わっていないため、次のリクエストステップは通知を再び受け取る。

#### トークンへの影響

受け入れられた内容は保持履歴または反復されるセッションプレフィックスになる。ブロックされた内容はリクエストトークンに寄与しない。発行される各モデル切り替え通知はそのテキストを保持履歴に追加する。サイズは呼び出し元とプラグインに依存する。

#### KV キャッシュへの影響

受け入れられた履歴とステアリングは追記のみである。ブロックされた提出はリクエストを送信しない。セッションプレフィックスはそのループインスタンス内で安定しており、新しい、または再開されたインスタンスは異なるプレフィックスを確立することがある。

### エージェントスコープのリクエスト構成

#### モデルが見るもの

`agent.ctx` を通じた登録はプロンプトセクションやツールをシャドウでき、未公開の setup 中にエージェント専用のインターセプターを設置できるため、1 つのエージェントは隣接するものとは異なるプロンプトとツールセットを見る。モデル選択はプロンプト組み立てより前に 1 つの provider/model/effort 値を捕捉し、同じステップのリクエストに適用する。後からの並行変更は別のステップを待つ。

#### トークンへの影響

provider/model の切り替えごとに、短い保持 user ロール通知を 1 つ追加する。その他のスコープ付きコントリビューションはそのエージェントのみに影響し、破棄時に消える。

#### KV キャッシュへの影響

切り替え通知は以前の履歴の後に追記され、そのプレフィックスを保つ。一方、ルート変更により新しいプロバイダーやモデルがそれを再利用できなくなることがある。プロンプトセクション、ツール定義、またはリクエストリスナーを変更する setup やリロードは、影響を受ける最初のリクエストトークンからの再利用を無効化し得る。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このパッケージに特別な注意が必要な場合を定義する。これらは現在のパッケージの制約であり、タスクバックログではない。

- **イニシエータースコープはプロセスローカルである** — ワーカー、子プロセス、HTTP、永続キュー、および再起動は、必要な identity を明示的にマテリアライズしなければならない。
- **周囲の identity はライブネスより長生きし得る** — コンシューマーはライフサイクルに敏感な作業の前に、`agent.status`、キャンセル、および所有ケイパビリティの契約を引き続き確認する。
- **作成リスナーは初期化ライフタイムを共有する。** `agent/created` リスナーは `agent.whenIdle()` や自身のオーナーの破棄を待機してはならない。これらの操作は作成の完了を待つためである。必要な非同期のツールとプロンプトのインストールが完了してからのみ戻る。
- **`cancel()` はデフォルトでインボックスをクリアする** — 実行中のターンと、キュー済みおよびステアリングの作業を中断する。`cancel(cause, { keepInbox: true })` はターンのみを中断して保留項目を保持する。ターンを実行したままステップのみを中断する方法はない。
- **追加される各 `UserMessage` はちょうど 1 つの `MessageSource` を運ぶ** — 複数のプラグインからのコントリビューションが 1 つのメッセージにマージされると 1 つの source に畳まれるため、メッセージは複数のプロデューサーを名指しできない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発者ノートはメンテナー向けの作業コンテキストであり、明示的に非権威である。未解決で未決定の方向性: 委譲を超えるエージェント間チャネル — 共有状態、子出力のストリーミング、バックグラウンドまたはポーリングのセマンティクスは現在の委譲シームの外に留まる。また `SessionStartSource` の値 `'clear'`/`'compact'` はエミッターのないまま予約されており、駆動サブシステム待ちである。

</details>
