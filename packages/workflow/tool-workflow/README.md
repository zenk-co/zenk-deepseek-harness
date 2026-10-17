---
description: "モデルに公開される workflow ツール: サブエージェントをファンアウトする JavaScript オーケストレーションスクリプトを実行します。モデル駆動オーケストレーションを選択または設定するユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-workflow

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-tool-workflow` は、モデルが多数のサブエージェントに委譲する JavaScript オーケストレーションを実行し、最終的な JSON 値を返せるようにします。ユーザーがワークフローまたは大規模なマルチエージェントオーケストレーションを明示的に要求した場合にのみ使用してください。1、2 件の委譲には通常のサブエージェント呼び出しを優先します。フォアグラウンド実行はすべての作業を待ちます。キャンセルまたは異常な完了は部分的な成功ではなくエラーを返します。`run_in_background: true` は所有ジョブ ID を即座に返し、ライブ出力を公開します。デプロイは `toolName` でツール名を変更でき、`maxResultChars` でレンダリング結果を制限できます。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送りされた作業](#known-limitations-and-deferred-work)
- [開発ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

`workflow` ツールは、モデルが書いたオーケストレーションスクリプトを実行し、作業を多数のサブエージェントにファンアウトして、スクリプトの最終 JSON 値を返します。ユーザーがワークフローまたは大規模なマルチエージェントオーケストレーション（多数ファイルの監査、移行、多角的な調査）を明示的に求めた場合にのみ使用してください。1、2 件の委譲には通常のサブエージェント呼び出しを優先します。

### ツールの呼び出し

モデルは 3 つのパラメーターと 1 つのフラグを送信します。`meta`（必須の識別データ: `name`、`description`、およびオプションの `whenToUse` と `phases`）、`script`（必須のプレーンな JavaScript 本体 — `export const meta` 文は含みません。そのパラメーター説明が本体のルールを運び、ツール説明がフック契約を運びます）、`args`（オプションの JSON オブジェクト。スクリプトに `args` グローバルとして公開されます。裸のリストはフィールドで包んで、wire スキーマが正直なままになるようにしてください）、および `run_in_background`（オプション。`enableRunInBackground` が成立する間のみ存在します）です。

フォアグラウンドの成功はエンベロープ `{ kind: 'foreground', runId, agentsStarted, result }` を返し、モデルには `workflow "<name>" completed (<count> agent<optional-s>).` に続けて `Return value:` と整形された JSON としてレンダリングされます。開始できないワークフロー — スクリプト解析や meta 検証の失敗 — は、モデルが修正できるエラーを返します。キャンセルと実行の失敗は `Error: workflow run was cancelled` または `Error: workflow run failed: <error>` を返します。部分的な出力が成功として報告されることはありません。

### 実行中に期待できること

スクリプトの実行中、親ターンは待機します。ツールは実行を開始し、その結果を待ち、常にそれを破棄するため、スクリプトとその子はすべてのパスで静止状態に達します — 親ステップの中止シグナルからブリッジされるキャンセルも含みます。モデルが見るのは 1 つの最終結果のみで、中間の子メッセージは見えません。子自身の作業は親の会話に入りません。

### バックグラウンド実行

`run_in_background: true` は `{ kind: 'background', jobId, runId }` を即座に返します。実行は所有された `workflow` ジョブとして `ctx.jobs` に登録されるため、セッションヘッダーのジョブ一覧はジョブの出力リングからその `phase()`、`log()`、メンバーのライフサイクル行をライブでストリームし、行の進捗行は現在のフェーズを追跡します。ツールステップのシグナルは実行に届きません — それをキャンセルするのは `job_kill`、一覧の停止コントロール、オーナーの破棄です。確定はジョブの確定です。完了した実行はジョブの結果と同じレンダリング済み戻り値を運び（完了通知がそれを告知し、確定後のモデルの最初の `job_output` がそれを 1 回運びます）、キャンセルされた実行は kill 理由とともに `killed` で確定し、失敗した実行はスクリプトの失敗メッセージとともに `failed` で確定します。ライブのジョブレジストリと呼び出し元にサービスするコントローラーがない場合、呼び出しは失敗し、不足している構成要素を挙げます。

### 設定

| フィールド | デフォルト | 意味 |
|---|---|---|
| `toolName` | `workflow` | 登録するモデル向けツール名。 |
| `maxResultChars` | `50000` | レンダリング結果の上限。長い JSON は通知付きで切り捨てられます。 |
| `enableRunInBackground` | `true` | `run_in_background` を公開します。無効化された呼び出しも拒否されます。 |

生成される [設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-tool-workflow) が、受け付けられるすべてのフィールドの網羅的な情報源です。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションでは、コンシューマーがエンジンからどのように分離されているか、実行ライフサイクルとレコードがどう機能するかを説明します。観測可能な動作は [このパッケージを使う](#use-this-package) で完全に説明されています。

### 設計概念

コンシューマーはモデル向けスキーマ、`tool:<toolName>` システムプロンプトガイダンス、結果エンベロープを所有します。スクリプトの解析、実行、上限、キャンセルは `ctx.workflowEngine` の背後にあり、PTC エンジンは `run_code` と Node プロセス閉じ込めを共有します。使用ガイダンスはデプロイのペルソナではなく、ツールプラグインにプロンプトセクションとして同梱されます。

### 実行ライフサイクル

`execute` は実行を開始し、常に実行を破棄する `try/finally` の中で `run.result` を待ちます。`exec.signal` は `run.cancel()` にブリッジされ、開始前にすでに中止されているケースも含みます。`completed` 以外の停止理由はその理由を報告する `isError` 結果にマップされます。完了は `{ kind, runId, agentsStarted, result }` をレンダリングし、Native レンダラーはその射影のみを `maxResultChars` で切り捨てます。

### バックグラウンドライフサイクル

バックグラウンド呼び出しはジョブスターター内で `jobs.start` を通じて実行を登録するため、同期のエンジン拒否は何も登録せず、アドミッションプレフライトはエンジンが spawn する前に実行されます。ジョブの `done` は `run.result` から連鎖します。破棄（破棄の失敗は警告され、レジストリに拒否が投げられることはありません）、ミラーの停止、次に停止理由をジョブ結果にマップします。リングミラー（`src/record.ts`）はプラグインごとに 1 回 `workflow/phase`、`workflow/log`、メンバーイベントを購読し、追跡された実行の `JobHandle` フェイス（行には `append`、フェーズには `updateProgress`）にルーティングします。確定後に遅れて届いたイベントは追跡された実行を見つけられず、確定済みジョブへの append はレジストリ内部で破棄されます。

### 永続セッションレコード

ルート転送実行（`exec.parent` が存在しない）の場合、ツールは 4 つのログ専用イベントで実行を呼び出し元 Agent のセッションに投影します。`start()` が戻った後の run-start、`run.id` でフィルタリングされたメンバーの開始と終了、そして結果が利用可能になり破棄が静止状態に達した後にのみ run-end です。ネストされた転送呼び出しは通常どおり実行されますがレコードを書きません。最初のセッション append 失敗は、その実行の以降の記録を警告 1 件とともに無効化し、ツール結果やクリーンアップを変えずに、レコードなしまたは合法な連続プレフィックスのいずれかを残します。

エンジンの `workflow/phase` と `workflow/log` イベントには、このツールからの行ごとの永続サーフェスはありません。セッションログは意図的に実行とメンバーのライフサイクルのみを記録し、Web トランスクリプトはそれらのレコードから導出されます。バックグラウンド実行の行は代わりにジョブ観察レコードを通じて人間に届きますが、これは設計上一時的です。

### レンダーインテント

[render-intent Agent Note](../../../.agents/notes/implemented/architecture/2026-07-02-tool-render-intent-union.md) に従い事前に決定済みです。`workflow: <meta.name>` というタイトルの `generic` カードで、`args.meta.name` から直接読み取ります — プレゼンテーションは args の純粋関数です — スクリプトテキストは `rawInput` として運ばれます。結果も generic カードを保ちます。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: ツール登録、実行ライフサイクル、バックグラウンドジョブ登録、レコーダー配線 |
| [`src/record.ts`](src/record.ts) | バックグラウンド実行のライブ進捗をジョブの出力リングへミラーリング |
| [`src/types.ts`](src/types.ts) | 4 つのログ専用レコードイベントペイロードとその `SessionEventMap` 宣言 |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

ツールレベルの契約では足りないときにこれらのページを読んでください。共有された workflow モデルからエンジンと比較可能な委譲ツールへと進みます。

- [Workflow サブシステム](../../../docs/subsystems/workflow.md) — シーム契約、開始リクエスト、イベントペイロード。
- [Workflow シーム](../workflow/README.md) — ツール背後の実行と結果の語彙。
- [PTC workflow エンジン](../workflow-ptc/README.md) — スクリプトを実行するエンジン。
- [subagent ツール](../../subagent/tool-subagent/README.md) — 1、2 件の子のための通常委譲の代替手段。
- [グループマップ](../README.md) — workflow ケイパビリティファミリーとそのパッケージ。
- [historical Dynamic workflows Agent Note](../../../.agents/notes/archived/feature/2026-07-05-dynamic-workflows.md) — シーム設計とその決定。

-----

<a id="model-experience"></a>
## モデル体験

### システムプロンプト

#### モデルが見るもの

このプラグインの登録スコープ内のすべての親リクエストは、以下の workflow ガイダンスを受け取ります。スコープ付きツール制限は、独立して登録されたこのガイダンスを削除せずにスキーマを隠すことができます。

##### Workflow ガイダンス

```markdown
Use the <toolName> tool ONLY when the user explicitly asks for a workflow or for large multi-agent orchestration: you write a JavaScript script (the tool description documents the exact format) that fans work out across many subagents with phases and structured results. For one or two delegations, prefer plain subagent calls.
```

#### トークンへの影響

プラグインがアクティブな間、リクエストごとに小さな固定のガイダンスコストです。

#### KV キャッシュへの影響

プラグインスコープとガイダンステキストが変わらなければプレフィックス安定です。アクティブ化または破棄は、このプロンプトセクションからの再利用を無効化する可能性があります。

### ツールスキーマ

#### モデルが見るもの

可視のとき、生成されるデフォルトの [`workflow` スキーマ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-workflow) は完全な JavaScript フックとメタデータ契約を運びます。`toolName` は定義の名前を変更でき、モデルはスクリプト、メタデータ、オプションの args を送信します。

#### トークンへの影響

ツールが可視の各リクエストで大きな固定スキーマコストです。

#### KV キャッシュへの影響

`toolName`、定義、可視性が変わらなければプレフィックス安定です。名前変更、プラグインライフサイクル、スコープ付き制限は、このスキーマからの再利用を無効化する可能性があります。

### ツール呼び出し履歴と結果

#### モデルが見るもの

モデルが書いた完全なスクリプト、メタデータ、args はアシスタントのツール呼び出しに残ります。フォアグラウンドの成功は正確に `workflow "<name>" completed (<count> agent<optional-s>).`、改行、`Return value:`、改行、データ依存の整形済み JSON です。上限に達すると、新しい行に `… [truncated: <omitted> more characters]` が追加されます。バックグラウンドの受け入れは正確に `workflow "<name>" started in the background as job <jobId>. Its return value arrives with the completion notice; check on it with job_output, stop it with job_kill.` で、同じレンダリング済みの値が後でジョブの完了通知と `job_output` を通じてモデルに届きます。失敗は正確に `Error: workflow run was cancelled`（オプションで ` (<error>)` が付く）、`Error: workflow run failed: <error-or-unknown error>`、または防御的に `Error: workflow run ended abnormally (<reason>)` です。所有エージェントのない呼び出しは `Error: workflow tool requires a calling agent (exec.agent was undefined)` になります。中間の子メッセージは省略されます。

#### トークンへの影響

呼び出しトークンは大きくなり得て、コンパクションまで残ります。結果のレンダリングは `maxResultChars` で制限されます。子モデルのトークンは親の保持コンテキストとは別です。

#### KV キャッシュへの影響

追記専用です。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しません。

## 既知の制限と先送りされた作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、ツールがまだサポートしていないことを定義します。それらは現在の制約であり、タスクバックログではありません。

- **バックグラウンド実行はモデルに中間値を報告しない** — 確定前の `job_output` はステータスのみを返します。戻り値は完了時に全体として届き、キャンセルは依然として部分出力を破棄します。
- **`args` はオブジェクトでなければならず、Native 結果テキストには上限がある** — 呼び出し元は最上位の配列やスカラーをフィールドで包みます。正規の workflow 結果は完全なままですが、`maxResultChars` を超える JSON は取得ハンドルの背後に保存されるのではなく、モデル向け射影で切り捨てられます。
- **ワークフローポリシーはツール登録ごとに固定される** — プロバイダー選択、上限、ツール名はデプロイ設定であり、モデル呼び出しの引数ではありません。
- **永続レコードはトップレベルかつ観察用** — ネストされた PTC モードのディスパッチは記録されず、記録の失敗は実行を変えずに意図的に不完全なプレフィックスへと劣化します。
- **バックグラウンド実行を再生する記録セッションシナリオはまだない** — ユニットと実エンジン構成のスイートがこのパスをカバーし、スナップショットツリーはスキーマとプロンプトテキストのみを固定します。

<a id="dev-note"></a>
### 開発ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発ノートはメンテナー向けの作業コンテキストです。未決定のオープンな方向性を扱います。明示的に非権威です — 出荷される動作、制限、受け入れられた根拠は、上のセクション、パッケージコード、リンクされた Agent Note にあります。

オープンな方向性: 射影をクリップする代わりに切り捨てられた JSON を取得ハンドルの背後に保存すること。トップレベルを超えたネストされたディスパッチの記録。バックグラウンドパスのための記録セッションシナリオ。

</details>
