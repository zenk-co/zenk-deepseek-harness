# ツール作成リファレンス

日本語 | [English](adding-a-tool.en.md) | [中文](adding-a-tool.zh.md)

モデルに公開されるツールが満たさなければならない契約のリファレンス。順序立てて最初のツールを作る場合は、[ツールを作る](../user/develop/basic/tool.md)に従う。`packages/shell/tool-bash` が本番品質の 3 パッケージ構成の例である。

## 最小構成

```ts
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'my-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'read_file',
    description: 'Read a file from disk.',          // what the model sees
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute path' },
      limit: { type: 'number' },                     // optional by default
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      // args is TYPED from the schema: { path: string; limit?: number }
      // exec carries immutable identity + token; signal is the operational field
      return readFile(args.path, { encoding: 'utf8', signal: exec.signal })
    },
  }))
}
```

登録は effect ベースである: プラグインファイバーを破棄すると、ツールが登録解除される。スキーマはシステムプロンプトの組み立てに自動的に流れ込む。

## execute() 契約のルール

- **引数は検証済みである。** `defineTool` は `execute` が走る前に、モデルが生成した `arguments` を統合された `ParameterSchemaSpec` に対して検証する (型、必須キー、リテラル制約、exact-one ユニオン、ネストされた値)。そのため `execute` の内部では、引数は `InferArgs` に一致する。明示的なオブジェクトノードは `additionalProperties: true | false` を宣言し、暗黙のパラメータールートはオープンのままである。DSL が表現しない制約 — 例: 空でない文字列、正の数値、フィールド横断ルール — は依然として自分で検査する。直接登録される生の JSON-Schema ツールは、入力検証を自ら負う。
- **登録は読み取り専用の定義を借用する。** 型付けされた同一プロセス内のコントリビューションはシリアライゼーション境界ではない。登録後にそのスキーマを変更したりコールバックを差し替えたりしてはならない。`schemas()` は明示的なモデル向けプロジェクションのみを実体化する。ツールをホットスワップするには、それを所有する effect を破棄して代替を登録する。コールバックのクロージャー内の可変状態は、通常のプラグイン状態のままである。
- **実行アイデンティティは保護される。** レジストリは `arguments` を 1 回の再帰パスで切り離されたロスレス JSON として実体化し、ポリシー開始前にその値をフリーズし、不透明な `exec.token` を割り当てる。`callId`、`name`、`arguments`、`agent`、`token`、必須の呼び出し元所有の `signal`、および任意の外側トランスポート用 `parent` トークンは、ディスパッチを通じて不変のままである。`parent` はアイデンティティ専用であり、生きた外側の実行を公開しない。`args` は読み取り専用入力として扱う。可変ビューを受け取るのはディスパッチを包むラッパーのみであり、ラッパーは期限を課すために必須の `exec.signal` を置き換えて復元できるが、削除はできない。
- **正規の JSON 値を 1 つ宣言して返す。** `output.schema` は `ValueSchemaSpec` を使い、ルートはオブジェクト、配列、スカラー、または null でありうる。`execute` は推論された値のみを返す。レジストリはそれをロスレス JSON としてスナップショットし、検証し、フリーズし、`output.render(args, value)` に渡す。body からコンテンツブロックを返したり、呼び出し元に id やフィールドのために散文を解析させたりしてはならない。
- **throw または無効な値の返却は `isError` を意味する。** レジストリは throw を捕捉し、オブザーバーが走る前にスキーマ、レンダラー、メタデータプロジェクター、ロスレス JSON の失敗を封じ込める。インフラストラクチャーの失敗には throw する。成功したドメイン上の結果は、そのネイティブレンダラーが理想的でない状態 (例: 非ゼロのプロセス終了) を説明する場合でも、正規の値で表現する。
- **`exec.signal` を尊重する。** 発火したら進行中の作業をキャンセルする。
- **`presentationMeta` で永続的なカードデータを射影する (任意)。** `output.presentationMeta(args, value)` は同じ正規の値からリプレイ可能な JSON を導出する。コアはそれを `tool/result` に永続化し `presentResult` に渡すため、結果時点のファクト (例: `write`/`edit` の適用済みハンク) を必要とするカードは、正規の値を永続化せずにリプレイを生き延びる。プロジェクターは、カードを持たないネストされた Code ディスパッチではスキップされる。
- **非同期通知には `exec.agent` を使う。** `agent.inject({ content, source: { kind: 'my-plugin' } })` は、次のモデルリクエストが見る永続コンテキストを追記する — これは起こしではない (アイドルのエージェントはアイドルのままである)。その `kind` はプラグイン内で [`MessageSourceMap`](../subsystems/llm-streaming.md#content-blocks-and-messages) を通じて宣言する: セッションフォーマット V4 は、メッセージ受け入れ時に廃止された `{ kind: 'plugin', plugin: '<name>' }` ラッパーを拒否する。破棄されたエージェントに対しては防護する (try/catch)。

## 長時間実行される作業

`run_in_background` はプロデューサー設定でゲートし、`ctx.jobs.start({ kind, label, owner: exec.agent, run })` で登録する。レジストリはプロデューサー body の前に事前 abort された呼び出しを拒否する。ランタイムは `run()` が作業を開始する前に所有権とタスクコントローラーの可用性を検証し、その後 id、セッションフェンス、汎用制御ツール、通知、オーナーのクリーンアップを供給する。成功したバックグラウンド分岐は `{ kind: 'background', jobId }` のような型付きの正規ハンドルを返す。そのネイティブレンダラーは `started background job bash-1` のような人間向け散文を保持してよいが、PTC モードは id を回収するためにその散文を決して解析してはならない。

spec は同期 `cancel`、リソースのクリーンアップ後に決着する reject しない `done`、および、レジストリがジョブの出力リングへ汲み出す pull 型 `output` ソースか、starter が受け取る `JobHandle` を通じた push のいずれかを供給する。`dsh-tool-jobs` はそのリングからモデルの消費用読み取りをレンダリングする。事前 abort された呼び出しは失敗である。成功時の出力スキーマを満たす id を持つタスクが存在しないためである。`ctx.jobs.start()` が id を公開した後は、`exec.signal` ではなくタスク所有のキャンセルシグナルを使う: 後からの外側呼び出しのキャンセルは、呼び出しの待機を止めるが、公開された作業は殺さない。`job_kill`、オーナーの破棄、サービスのティアダウンがそのライフタイムを所有する。フォアグラウンドの作業は `exec.signal` に結合されたままである。ストリームプロデューサーについては[バックグラウンドジョブランタイムリファレンス](../../packages/jobs/jobs/README.md)と `dsh-tool-bash` を参照。

## 実行ポリシーと観測

デプロイポリシーをツールに組み込まないことを優先する。拡張可能な allow/deny/ask ポリシーには `tools/pre-execute` ([permission-gate の例](extension-cookbook.md#a-hook-plugin-permission-gate-example))、後続のリスナーが取り消せない最終的な単調 deny には `ctx.tools.guard()`、期限、リトライ、メトリクス収集でディスパッチを包むには `tools/execute`、プレゼンテーションコンテンツや返却値の置き換え、結果のブロック、モデル向けコンテキストの添付には `tools/post-execute`、不変の正規化された結果の観測には `tools/result` を使う。コンテンツの置き換えは `value` へのプログラム的アクセスを無傷で残す。機密ポリシーは値をブロックまたは置き換える。サンドボックス実装はツールのエグゼキューター実装内で走ることもできる。[`dsh-tools` README](../../packages/core/tools/README.md#extension-points)が各拡張ポイントの入力、順序、返却値、失敗時の振る舞いを定義する。

## PTC モードは追加作業なしでツールに到達する

[PTC モード](../../packages/core/tools/README.md)では、可視の登録済みツールすべてが、追加の統合なしに `await tools.<name>(args)` として利用できる。生成される `ToolArgsMap` と `ToolOutputMap` は、同じスキーマから正確な引数型と正規返却型を導出し、呼び出しは通常の実行パイプラインに再突入する。成功した呼び出しは、レンダリングされたネイティブコンテンツではなく、ポリシー後の最終的な正規 JSON 値に解決する。失敗した呼び出しは本物の `ToolCallError` で reject する。プログラムが検査できるのはその `name`、`toolName`、人間可読の `message` のみであり、内部エラーコードや失敗ユニオンは検査できない。

`output.schema` は有用なプログラム的 API として設計する: ハンドルとフィールドを直接返し、正直な値である場合はスカラー/配列/null ルートを許し、人間向けの説明は `output.render` に置く。中間値は実行列ローカルであり、永続化もプロンプト切り詰めもされず、バイト上限もないため、プロデューサーの正直な取得境界とプロセスメモリは依然として重要である。設定可能な出力上限とモデル向け spill パイプラインを越えるのは、外側の `run_code` のログ/結果のみである。

## ツールが UI でどのようにレンダリングされるか

ツールの `output.render` はモデル向けコンテンツを返す。その **UI カード**は別個の関心事であり、純粋なプレゼンテーションプロジェクションと任意の `presentCall` / `presentResult` メソッドで宣言する。これらは正規の値と並行して設計する。UI プレゼンテーションを持たないツールは、汎用カード (タイトル = ツール名、入力 = 生の引数) にフォールバックする。

どちらのメソッドも **`card` タグ付きレンダーインテント**を返す — ツールの動作に合うカード種別を選ぶ:

- `presentCall(args)` → `ToolCallView` (PENDING カード):
  - `{ card: 'generic', title, kind?, rawInput?, content?, locations? }` — デフォルト。アイコンのために `kind` を設定し (`read`/`search`/…)、ツールが触れるすべてのファイルについて `locations: [{ path, line? }]` を設定すると、対応するエディターが追従/ジャンプできる。
  - `{ card: 'terminal', title, description?, cwd? }` — この呼び出し自体がシェルコマンドである。`title` がコマンドで、`description` はターミナルカードの上に描画される。(tool-bash.)
  - `{ card: 'diff', title, diffs, locations? }` — この呼び出しはファイルを作成または変更する。`diffs: [{ path, oldText, newText }]` (新規ファイルは `oldText: null`) がインライン diff カードとして描画される。(tool-fs `write`/`edit`.)
- `presentResult(args, { content, isError, meta? })` は完了したカードを返す:
  - `generic` は任意のタイトルとコンテンツを供給する。
  - `terminal` は生の出力と任意の終了メタデータを供給する。各 UI は対応ビューまたはフォールバックビューを描画する。
  - `diff` は適用済みハンクを供給する。多くは `output.presentationMeta` によって導出され、永続化された `result.meta` に載り、リプレイがそれらを再現する。ミューテーションツールは diff 結果を保持する。完了ビューが PENDING カードを置き換えるためである。
  - `read` は永続化された `result.meta` から再構築される完了済みのファイルウィンドウを供給する: ファイル `path`、1 始まりの `offset`、返却された `lines` (各要素はファイルの行番号を保持)、`totalLines`、任意の `lang` ハイライトヒント。`read` ケイパビリティを持たない UI は生の結果コンテンツにフォールバックする。`read` 呼び出しビューは存在しない — read 呼び出しの PENDING 状態は汎用カードのままである。コンテンツは `execute` の後にのみ存在するためである。(tool-fs `read`.)
  - `search` は永続化された `result.meta` から再構築されるディスカバリー結果を供給する: ファイルごとにグループ化されたマッチ (`shape: 'matches'`、grep) またはフラットなパス一覧 (`shape: 'paths'`、glob)、加えて `truncated`/`total` があり、UI が上限付きの結果を完全なものとして提示することはない。ビューは結果テキストを持たず (search カードを持たない UI は生の結果コンテンツにフォールバックする)、`search` 呼び出しビューも存在しない — ディスカバリー呼び出しの PENDING 状態は汎用カードのままである。マッチは `execute` の後にのみ存在するためである。(tool-fs-search `grep`/`glob`.)
  - `web` は完了した Web リトリーバルを供給する。`kind: 'search' | 'fetch'` で判別され (構造化された検索ソースまたはフェッチサマリー)、`result.meta` から導出される。body コピーを持たないため、`web` ケイパビリティを持たない UI は生の結果コンテンツにフォールバックする。(tool-web `web_search`/`web_fetch`.)

厳格なルール (破ると噛みつかれる):

- **純粋性。** これらはライブストリーミング時とセッションログのリプレイ時の両方で走るため、`args` (と結果) の純粋関数でなければならない — I/O なし、セッション状態の読み取りなし、クロック/乱数なし。diff は引数から導出される (`write` が `oldText: null` を使うのは、呼び出し時点のプレゼンターが事前のファイルコンテンツを持たないためである)。セッションコンテキストを供給するのはツールではなく UI アダプターである。`presentCall` の中でファイルの旧コンテンツや作業ディレクトリが欲しくなったら、手を止める — それはプレゼンターではなく、永続的な結果メタデータまたはアダプターに属する。
- **UI 専用の整形はモデル結果に入れない。** フェンス付き ` ```console ` ブロック、diff、相対化されたパス — これらは UI に供するためだけに正規の値やネイティブコンテンツに属するものではない。`output.render` がモデル向けの散文を所有し、`presentationMeta` とカードプレゼンターがリプレイ可能な UI 状態を所有する。`terminal` 結果ビューは生の出力を運び、アダプターがフォールバックの枠付けを加える。
- **`defineTool` は表示パスをソフト検証する。** 不正な形式または古いログ済み引数に対して、ラッパーは throw ではなく `undefined` (汎用フォールバック) を返す — 表示がリプレイをクラッシュさせては決してならない。

ニュートラルな語彙は `dsh-tools` にある。ツールが UI やトランスポートの型を import することはない。この API のコンシューマーは各 `card` を自身のビューにマップする。設計とその理由は [render-intent-union の Agent Note](../../.agents/notes/implemented/architecture/2026-07-02-tool-render-intent-union.md) にある。`dsh-tool-fs` (generic/diff) と `dsh-tool-bash` (terminal) がリファレンス実装である。

## Web クライアントのプレゼンテーション

組み込みの Web クライアントは `presentCall` や `presentResult` を消費しない。Session の `page` と `follow` が生の `tool/call` と `tool/result` イベント (永続化された `result.meta` を含む) を転送する。クライアントプラグインは、`tool.call.toolview` キー付きスロットにワイヤーツール名を登録し、`ToolCallBlock` の引数、コンテンツ、エラー、メタデータ、既存の PTC ディスパッチ `parentCallId`、Session パスファクトからコンポーネント props を導出する。ワイヤー値はローカルで検証し、不正な形式またはサポートされない入力には汎用行を返す。

既存の Web カードが、モデル向けコンテンツではロスレスに保持できない、上限付きの構造化された結果ファクトを必要とする場合は `output.presentationMeta(args, value)` を使う。メタデータに React props や選択されたカードを保存したり、Host ツール実装をブラウザーバンドルに import したり、別のクライアントプレゼンター レジストリを作成したりしない。Host プレゼンテーションメソッドを定義するだけでは、特化された Web カードは追加されない。[クライアント導出プレゼンテーションの Agent Note](../../.agents/notes/implemented/architecture/2026-08-23-client-derived-tool-presentation.md) が所有権、フォールバック、等価性の要件を定義する。

## 検証

[リポジトリのテストポリシー](../testing.md)と所有パッケージのテストドキュメントに従う。出荷されるモデル可視または UI 可視の変更には、そこで指定される組み立て済みカバレッジが必要である。
