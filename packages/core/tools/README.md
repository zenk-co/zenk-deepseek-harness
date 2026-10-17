---
description: "モデル向けツールを登録、制限、表示、デバッグするツール作者とメンテナーのための、ツールレジストリと実行パイプライン。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tools

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-tools` を使うと、モデルに型付きケイパビリティを公開し、呼び出しを検証し、allow/deny/ask ポリシーを強制し、通常のツール失敗でターンを終了することなく最終化された結果を返せる。`mode` でネイティブな Function Calling または [PTC モード](#ptc-mode)を選ぶ。エージェントは `presentAs` でデフォルトを上書きできる。ツール作者は `defineTool` で型付きパラメーターと出力、協調的タイムアウト、並列安全性、オプションの UI 表示を宣言する。モデルは許可された各ツールの宣言された名前、説明、パラメータースキーマを見る。エージェントごとの制限はその可視セットを狭められる。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と延期された作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

各 `run_code` プログラムは開始時に Session の現在の作業ディレクトリを取得する。ネストされたディレクトリ変更は以降のツール呼び出しに影響するが、実行中のプログラムは初期ディレクトリを保つ。

エージェントがツールを呼ぶ場所に `dsh-tools` をマウントする。これが提供する `ctx.tools` は、すべてのツールプラグインが登録し、ループがディスパッチするレジストリである。ツールを登録すれば可視になるだけで十分である。レジストリはそのスキーマをシステムプロンプトの組み立てに自動的に供給する。

### ツールを登録する

`defineTool` は型付きツール定義を構築する。モデル向けの名前、説明、パラメータースキーマ、正規の出力宣言、および宣言された JSON 値のみを返す `execute` 本体である。モデルの引数は実行前に検証され、不正な入力は通常のエラー結果になる。

正規値は実行に属する。Session は代わりにレンダリングされたコンテンツとオプションのプレゼンテーションメタデータを記録する。そのコンテンツを置換または墨消ししても、プログラマティックな呼び出し元が利用できる正規値は取り除かれない。そのアクセスを拒否しなければならないポリシーは、実行をブロックするか値を置換する必要がある。

```ts
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

declare const ctx: Context

ctx.tools.register(defineTool({
  name: 'read_file',
  description: 'Read a file from disk.',
  parameters: {
    path: { type: 'string', required: true, description: 'Absolute file path' },
    offset: { type: 'number' },
    limit: { type: 'number' },
  },
  output: {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  async execute(args, exec) {
    // args is typed: { path: string; offset?: number; limit?: number }
    return readFile(args.path, { encoding: 'utf8', signal: exec.signal })
  },
}))
```

統一スキーマ DSL は `string`、`number`、`integer`、`boolean`、`null`、`array`、`object`、作者専用の `json`、およびちょうど 1 つを選ぶ `oneOf` をサポートする。`InferValue` は 16 段のコンテナーレベルまで正確な型を保ち、その後 `JsonValue` に広がる。生の JSON Schema（`JsonSchemaNode`）は、サブエージェント、ワークフロー、MCP と共有されるワイヤーレベルの対応物である。

### プレゼンテーションモードを設定する

`mode` 設定はモデルが見るものを決める。`native`（可視のすべてのスキーマ）または `ptc`（`run_code` と生成された SDK のみ）である。ランタイムは評価構文、出力構文、状態保持のガイダンスを `executionInstructions` を通じて供給し、このパッケージはツール呼び出しルール、SDK 宣言、画像結果の添付を担う。

```yaml
- name: '@deepseek-ai/dsh-tools'
  config:
    mode: native
```

| フィールド | デフォルト | 意味 |
|---|---|---|
| `mode` | `native` | 可視ツールがモデルにどのように提示されるか: `native` または `ptc` |
| `maxParallelSubCalls` | `10` | `run_code` プログラムの重複するサブ呼び出しの並行上限。`1` で厳密に直列なディスパッチに戻る |

生成される[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-tools)が、受け付けられるすべてのフィールドの網羅的なソースである。非ネイティブモードには、その言語に登録された SDK レンダラーを持つ構成済みの `ctx.ptcRuntime` が必要である。エージェントプリセットは [`dsh-agent-tool-presentation`](../agent-tool-presentation/README.md) で自身のプレゼンテーションを選び、1 つのエージェントは `presentAs(mode)` でデフォルトを覆い隠せる。

### エージェントごとにツールを制限する

`ctx.tools.restrict(filter)` は、1 つのエージェントが継承するグローバルツールに allow または deny マスクを適用する。マスクは交差し、スコープ付き登録は可視のまま残り、制限は dispose されると解除される。`ctx.tools.get(name, scope)` は 1 つのスコープから見たツールを解決する。Host ローカルのプレゼンターコンシューマーは、実行された定義と一致する必要があるとき呼び出し元エージェントを渡す。`ctx.tools.schemas(scope)` は `execute` 関数なしで可視スキーマを返す。

### 呼び出しにポリシーを強制する

`ctx.tools.guard(guard)` は、拡張可能な `tools/pre-execute` waterfall の後に単調な同期ガードを登録する。返された理由は呼び出しを拒否し、後のどのリスナーもその拒否を許可に戻せない。パイプラインのイベントはプラグインにより多くの制御を与える。`tools/pre-execute` は allow/deny/ask を決め、`tools/execute` はタイムアウトや再試行のためにディスパッチを包み、`tools/post-execute` は結果を検査または置換し、`tools/result` は凍結された最終結果を観測する。

ツールの `projectContent` は post-execute ポリシーの前に実行準備済みのコンテンツを導入する。ポリシーは依然としてそれを置換またはブロックしてよい。`finalizeContent` はそれらのポリシーの後にある最終のコンテンツ変換のままである。

### Host プレゼンテーション記述子

ツールは Host ローカルのコンシューマーのために純粋な `presentCall()` と `presentResult()` メソッドを保持できる。組み込みの Web Client はそれらの値を消費しない。`tool.call.toolview` を通じてレンダラーを選び、生の呼び出し引数、結果コンテンツ、失敗状態、永続メタデータからカードの props を導出する。[クライアント導出プレゼンテーションの決定](../../../.agents/notes/implemented/architecture/2026-08-23-client-derived-tool-presentation.md)がこのトランスポート分割を所有する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

このセクションはパッケージが上記の動作をどのように実現するかを説明する。観測可能な契約は[このパッケージを使う](#use-this-package)で扱っている。

### 設計コンセプト

レジストリは型付きの `ToolDefinition` をスコープ付きレイヤーに保持し、リクエスト時にモデル向けの `ToolSchema` セットに投影する。`output`、`execute`、`finalizeContent`、`timeoutMs`、プレゼンテーションコールバックは決してワイヤーに漏れない。すべての呼び出しは固定のパイプラインを実行する。`tools/pre-execute`（拡張可能な allow/deny/ask）→ 登録された単調ガード → `tools/execute`（around-dispatch ラッパー）→ `tools/post-execute`（検査/置換、コンテキストの添付）→ 定義所有の `finalizeContent` → 観測専用の `tools/result` イベント。必須シグナルを置換できるのは `tools/execute` ビューのみで、レジストリは本体の前に呼び出し元シグナルを再融合する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: `ToolRuntime` サービス、設定、レジストリ、実行パイプライン |
| [`src/types.ts`](src/types.ts) | `ToolDefinition`、`ToolExecution`、`ToolExecutionResult`、ガードと決定の型 |
| [`src/schema.ts`](src/schema.ts) | `defineTool` DSL: `ValueSchemaSpec`、`ParameterSchemaSpec`、`InferValue`、`InferArgs` |
| [`src/json-schema.ts`](src/json-schema.ts) | 強制される生の JSON Schema サブセットと検証 |
| [`src/presentation.ts`](src/presentation.ts) | `card` タグ付き UI レンダリング intent |
| [`src/ptc.ts`](src/ptc.ts) | PTC モード: SDK 生成、`run_code` ディスパッチブリッジ、決済 |
| [`src/ts-types.ts`](src/ts-types.ts) | TypeScript SDK 型レンダリング |
| [`src/py-types.ts`](src/py-types.ts) | Python SDK 型レンダリング |

### 実行とキャンセル

各型付き呼び出しは解析済み引数を実体化して凍結し、不透明な相関トークンを割り当て、ポリシーとディスパッチを実行する。pre-execute の拒否は、モデル向けの理由のそばに `ToolErrorInfo` を添付してよい。ネイティブと PTC の永続投影は、その詳細をモデルコンテンツに加えることなく、構造化された名前、コード、オプションのユーザー向け理由を保持する。キャンセルは協調的かつ静止的である。すべてのツール本体は呼び出し元所有の `exec.signal` を受け取り、それを監視しなければならない。本体呼び出し前のキャンセルは `ABORTED_BEFORE_DISPATCH`、呼び出し後は成功した結果のみを `ABORTED` に置き換える。拒否、ラッパー失敗、ツール失敗、ポリシー後失敗、タイムアウト所有の `TOOL_TIMEOUT` はより特定的なままである。未知のツールと例外を投げるツールは構造化エラー（`UNKNOWN_TOOL`）になるため、呼び出しはターンを終了せずに失敗する。

### PTC モード

`ptc` では、レジストリは予約された `run_code` トランスポートと、ロードされたランタイムの言語で生成された決定的な SDK を公開する。各 SDK バインディングは凍結された ToolSchema を取得し、スケジューラーを通じてその実行コンテキストへ渡す。ポリシーの前に、開始された呼び出しはペアリング id、名前、正規化された引数のみを記録し、その settle イベントはレンダリングされた結果、オプションのプレゼンテーションメタデータ、構造化エラーを保持する。メタデータはその呼び出しの正規値から投影されて凍結され、プログラム値もモデルコンテンツも変えない。説明とパラメーターは一時的なままで、Session イベントや SDK 出力に決して入らない。呼び出しは、ネイティブの並行性契約を再利用する実行ごとのプールを通じてスケジュールされる。`ptc` 単独では、他の可視ツールを名指しするモデル直接の呼び出しは、ポリシーの前に `UNKNOWN_TOOL` に解決される。告知されるサーフェスと呼び出せるサーフェスは同じままである。中間バインディング値は実行ローカルであり、外側の `run_code` 結果のみがハードサイズ上限を持つ。

新しいサブ呼び出しは `<parent>:ptc:<n>` id を使う。コンシューマーはこれらの id を不透明として扱い、正確な等価性でイベントを相関させる。復元された歴史的 id は元のバイトを保つ。[PTC モードの決定](../../../.agents/notes/implemented/feature/2026-06-15-ptc.md)が永続的な命名と復元のルールを所有する。

画像を含む成功したサブ呼び出し結果は、`source.kind` が `ptc-mode` に設定された遅延ユーザーメッセージコンテキストになる。他の追加コンテキストは生成元ツールの帰属を保つ。

`run_code` はマウントされたランタイムが上書きをサポートする場合 `timeoutMs` を受け付ける。そのスキーマは設定されたデフォルトと最大値、およびランタイムの使用手順を報告する。Node のデフォルトは 120,000 ms で上限は 600,000 ms、ネストされたツールと承認の待機を含む。より広い `sandbox_permissions` モードは、プログラム開始前に空でない `justification` と承認を要求する。スキーマはその理由を現在のユーザーの言語で書くようモデルに求める。付与はその実行全体に適用され、常設の Session ポリシーとネストされたツールは自身の権威を保つ。プログラムは自動的に再生されない。拒否されたプログラムを明示的に再試行する前に、以前の効果を検査する。保持された PTC 環境は常設のファイルポリシーに従う。PTC はコミットされた Session モード変更を観測し、両方の Node モードで影響を受ける呼び出しを直ちにキャンセルする。以降の PTC 呼び出しは、最新のポリシーを解決する前にネストされたツールのクリーンアップを待つ。ランタイムがプロセスの無効化とクリーンアップを所有し、パーミッションセッターは同期的なままである。1 回限りのエスカレーションは状態所有者を省き、一時的な環境で完了する。常設変数は通常の呼び出しに引き続き利用できる。

<a id="extension-points"></a>
### 拡張ポイント

ツールプラグインは `ctx.tools.register()` を呼び、そのスキーマは自動的にプロンプト組み立てへ流れ込む。`tools/pre-execute` は並べ替え可能な allow/deny/ask ゲートである。`ctx.tools.guard()` はその後に単調な所有者ポリシーを追加する。`tools/execute` はタイムアウト、再試行、メトリクスのために正規化された正規ディスパッチを包む。`tools/post-execute` はコンテンツや値を置換し、フィードバックでブロックし、または順序付きコンテキストを添付してよい。`tools/result` は不変の最終結果を観測する。MCP サーバーはツールを発見し、サーバーのスキーマでそれらを登録する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約はほとんどのコンシューマーに十分である。周辺ドメインが必要なときにこれらを読む。

- [ツールサブシステム](../../../docs/subsystems/tools.md) — パイプラインの全型、スキーマ DSL、生成されるサービス API。
- [生成されるツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-tools) — モデルが受け取る出荷ツールのスキーマ。
- [ツール実行パイプライン](../../../docs/tool-execution-pipeline.md) — 可視化されたパイプライン。
- [ツール追加クックブック](../../../docs/cookbook/adding-a-tool.md) — ステップバイステップのツール作成。
- [協調的キャンセルの Agent Note](../../../.agents/notes/implemented/architecture/2026-07-19-cooperative-tool-cancellation.md) — 完全なキャンセル契約。
- [コアグループマップ](../README.md) — コアパッケージの構成方法。

-----

<a id="model-experience"></a>
## モデル体験

### 通常のツールスキーマ

#### モデルが見るもの

通常モードでは、モデルは各可視定義の正確な名前、説明、JSON Schema を見る。出荷される定義は生成される[ツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-tools)に記録されている。エージェントスコープの制限、シャドウ、拡張登録はそのエージェントの最終ツールセットを変える。

#### トークンへの影響

可視定義に比例するリクエストごとの固定コスト。ツールを隠す制限は、そのエージェントにとってスキーマコスト全体を取り除く。

#### KV キャッシュへの影響

可視定義とその順序が変わらない間はプレフィックス安定である。登録、dispose、スコープ付き制限は最初に変わったスキーマトークンから再利用を無効化しうる。

### PTC モードのスキーマとシステムプロンプト

#### モデルが見るもの

PTC モードは、生成された [`run_code` スキーマ](../../../docs/tool-catalog.md#deepseek-aidsh-tools)、以下の SDK 指示、ロードされたランタイムの言語用に生成された正確な SDK ブロックを公開する。両方のランタイム言語で `code` が `description` より前に並ぶ。これはプレゼンテーション順であり、強制される JSON メンバー順ではない。TypeScript の指示は、関数本体ランタイムには戻り値の例を、REPL ランタイムには印字出力の例を使う。生成された宣言がプログラム専用バインディングであることを示す。現在の `bash` パラメータースキーマが例の引数を受け入れる場合、`tools.bash(...)` を囲む完全な `run_code` 呼び出しも示す。`tools:sdk` セクションはファーストパーティ順 5000 を使い、プロンプト変数の補間を無効にして、両方のランタイム言語でツールの説明とスキーマ内のリテラルな `{{…}}` テキストを保持する。`ptc` では、プロンプトはファーストパーティ順のより早い位置に `tools:ptc-only` ルールも運ぶため、モデルは各ツールが何のためかを読む前に、どのツールを呼んでよいかを読む。

##### bash を伴う TypeScript PTC モードの SDK 指示

```markdown
## Writing code for run_code

`run_code` takes two required arguments: `code`, the body of an async TypeScript function (erasable syntax only — no `enum` or namespaces; type annotations are advisory, the code runs type-stripped), and `description`, a short summary of what the program does. The declarations below are SDK bindings for this program. A declaration does not make its name a directly callable tool; only names supplied as separate tool schemas may be called directly. When no separate `bash` schema is supplied, invoke a declared `bash` binding inside `run_code`:

`run_code({ code: "return await tools.bash({ description: 'Show current directory', command: 'pwd' })", description: "Show current directory" })`

Inside the program:

- Call tools as `await tools.name(args)` — quoted access for exotic names: `tools["my-tool"](args)`. Every call resolves to the tool's typed canonical JSON value. Tool arguments must be lossless JSON.
- A FAILED tool call rejects with `ToolCallError`, whose `toolName` identifies the failed tool and whose `message` is human-readable — `try/catch` it to handle and continue.
- Independent read-only calls MAY overlap under `Promise.all` (safe calls run concurrently; mutating calls run alone, in submission order). Sequence dependent work with `await`.
- Emit results with `return` and/or `console.log(...)`. Only what you print or return is program output. A successful tool result containing an image is attached after the run so you can inspect it on the next step; every other intermediate result stays out of the conversation, so extract just what you need.

Program-only SDK bindings:
```

#### トークンへの影響

可視定義に比例するリクエストごとの固定コスト。PTC モードは普遍的な削減を約束するのではなく、最終ツールのスキーマを生成 SDK テキストと 1 つのトランスポートスキーマで置き換える。

#### KV キャッシュへの影響

PTC モードの選択、生成 SDK、トランスポートスキーマ、可視ツールセットが変わらない間はプレフィックス安定である。モードやフィルターの変更は、最初に変わったプロンプトまたはスキーマトークンから再利用を無効化しうる。

### ツール呼び出し履歴と結果

#### モデルが見るもの

ループはモデルが出力した引数とレジストリの最終コンテンツを保持する。例外を投げた呼び出しや拒否された呼び出しは正確に `Error: <message>` になる。構造化されたユーザー向け失敗詳細はそのメッセージに加えられない。PTC モードは外側プログラムの印字行と戻り値をレンダリングし、両方が空の場合は `(run_code completed with no output)` を、または `Error: code run failed (<kind>): <message>` に続いて条件付きで `Captured output:` とキャプチャされた行をレンダリングする。内側のディスパッチイベントはログ専用のままである。画像を含む成功したサブ結果は、外側の結果の後にソース帰属コンテキストとして追加される。

#### トークンへの影響

引数、結果、追加コンテキストはデータ依存で、コンパクションまで再送される。ツールを隠す制限は、モデルがそれらを呼べるようになる前にスキーマも取り除く。

#### KV キャッシュへの影響

追記のみ。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しない。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、レジストリが特別な注意を要する場合を定義する。これらは現在のパッケージ制約であり、タスクバックログではない。

- **並行性ポリシーはイベントゲートではない** — `executionMode()` は解決されたツール定義を直接読む。プラグインは自身が所有する定義に分類子を宣言できるだけである。
- **`tools/pre-execute` は意図的に `exec.arguments` を書き換えられない** — ログに記録されレンダリングされる引数が実行されたものと同期しなくなる。書き換えの設計は[提案中の Agent Note](../../../.agents/notes/proposed/feature/2026-06-30-pre-tool-input-rewrite.md)である。
- **呼び出し元定義のサブエージェントとワークフローの構造化出力はオブジェクト根のままである** — これはコンシューマーレベルのガードである。共有スキーマ語彙とツール出力はすべての JSON 根をサポートする。
- **定義上の `timeoutMs` は宣言のみ** — レジストリは決して期限を強制しない。強制には `@deepseek-ai/dsh-tool-call-timeout-policy` ラッパーが必要である。
- **PTC モードの SDK 言語はロードされた 1 つのランタイムに従い、プレゼンテーションはツールごとではなくエージェントごとである** — `mode: ptc` は `ctx.ptcRuntime.language` に登録された SDK レンダラーがない限りプロンプト組み立てを拒否する。1 つのエージェント内では、あるツールがネイティブ専用で別のツールが ptc 専用になることはできない。
- **PTC モードの中間値は実行ローカルでバイト上限がない** — セッションリプレイから再構築できず、プロセスまたはワーカーのメモリを枯渇させうる。外側の `run_code` 出力のみがワーカーの設定可能なハード上限を持つ。
- **状態はランタイムに依存する**: デフォルトバックエンドは新規に開始する。REPL バックエンドは存続中の Agent ごとにメモリを保持する。Agent の dispose は解放を待つ。再起動と実行失敗はメモリを消去しうる。モデルに見えるガイダンスが、欠落した変数を再作成する方法を説明する。プログラムと結果は生きたオブジェクトをシリアライズすることなく Session ログに残る。

`defineTool()`、レジストリのスキーマ投影、システムプロンプトの組み立ては `deferLoading: true` を保つ。このマーカーは定義の遅延ロードを要求するもので、`tool-addition` レコードを意味しない。[LLM パッケージ](../../../packages/llm/llm/README.md#known-limitations-and-deferred-work)がプロバイダーの強制の限界を記録している。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
