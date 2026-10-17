# プランモード

日本語 | [English](plan.en.md) | [中文](plan.zh.md)

プランモードはエージェントごとの記録されるコラボレーション状態であり、[dsh-plan-mode](../../packages/plan/plan-mode)（`ctx.planMode`、`PlanModeController`）が所有する。有効な間、デプロイ所有のガイダンス節が各モデルリクエストに含まれる。プランモードは**ソフトなガイダンス**である。[サンドボックスモード](sandbox.md)と[承認ポリシー](approval.md)は独立に制限を強制し、プラン状態を読み書きしないため、デプロイでは別々に構成する。このパッケージは任意であり、エージェントループは依存しない。`plan:policy` プロンプト節を提供し、`exit_plan_mode` ツールと `/plan` コマンドを登録する。根拠は[設計リファレンス](../../packages/plan/plan-mode/README.md)が持ち、モデル体験と制限の詳細は[パッケージ README](../../packages/plan/plan-mode/README.md)が持つ。

Source: [`packages/plan/plan-mode/src/index.ts`](../../packages/plan/plan-mode/src/index.ts)

## 記録される状態と回復

`plan/mode`（`{ active: boolean }`）はログ専用・値全体置換の[セッションイベント](session.md)である。耐久性がありリプレイ可能で、モデル transcript には入らない。任意登録の `plan` ユニットは、コミット済みモード、コマンド決着、最新リクエストヘッダー時点に記録されたモードを畳み込む。`ctx.planMode` はその状態を `stateOf()` 経由で読む。レジストリ、`plan` キー、`turnBoundary` キーのいずれかが欠けている場合、最初の依存アクセスは失敗する。クライアントが受け取るのは `{ active, pending }` のみであり、再開・フォーク・コンパクションはいずれもログから両方を回復する。完全なイベント宣言は[永続化ログイベントカタログ](../persistence-catalog.md)にある。

## 保留中の選択とプリステップ追記

すべてのセッションイベントはターンに囲まれるため、ユーザー選択は次に受け入れられたターン内プリステップがリクエスト導出前に追記するまで保留のままとなり、それがどのターンで起きてもよい。選択が継続を強制することは決してないため、ターンの最後に受け入れられたプリステップの後に行われた選択は後のターンで追記される。`set(agent, active)` は保留中の選択を記録し（対象が記録済みまたは既に保留中の状態と等しい場合は何もしない）、`get(agent)` は `{ active: boolean; pending?: boolean }` を返す。すなわち現在のステップ組立に使われた記録済み状態と、追記待ちの選択済み状態である。
エージェント実行中に唯一の追記点は先頭に追加された `agent/pre-step` リスナーである。提案されたすべてのリクエストステップを観察し、ターン 1 ステップ 1 やリクエスト回復リトライも含み、下流リスナーを先に呼び出し、それらがステップを受け入れた後にのみ追記する。プロンプト受付はターンの前に起きるため `plan/mode` を追記できず、プロンプト時点でなされた選択は、その選択が開始するターンの最初に受け入れられたターン内プリステップによって追記される。追記失敗はターンを阻めず、選択は後の受け入れられたターン内プリステップ向けに保留のまま残る。追記されたユーザー選択はプラグイン由来の `user/message` 通知も 1 件記録するが、これは最後に記録されたリクエストヘッダーが他方の状態を述べていた場合に限るため、モデルはコンテキストが変わったときにちょうど知らされ、冗長に知らされることはない。ターンの最後に受け入れられたプリステップの後に行われた選択はプロセス内にとどまり、別の受け入れられたターン内プリステップの前にプロセスが終了すると失われる（[README の制限](../../packages/plan/plan-mode/README.md#known-limitations-and-deferred-work)）。

## 構成

```ts type-equiv
/** Deployment-owned plan guidance. */
interface PlanModeConfig {
  /** Guidance rendered as the `plan:policy` prompt section while plan mode is active. */
  section: string
}
```

欠けている・空白・非文字列の `section` や未知のキーは、無視されるのではなくプラグイン読み込み時に失敗する。プランモードが有効な間、正確な `section` テキストが order 50 で `plan:policy` [システムプロンプト節](system-prompt.md)として描画され、無効なプランモードは何も寄与しない。

## 終了ツールと `/plan` コマンド

[`exit_plan_mode`](../tool-catalog.md#deepseek-aidsh-plan-mode)はプランモードが無効な間も登録されたままなので、プランモードへの出入りはプロンプト節だけを変え、リクエストツールカタログは決して変えない。プランモード外での実行は失敗する。プランモード中は `#` 見出しで始まる完全な Markdown プランを要求し、[ユーザー質問シーム](user-questions.md)を通じてレビューに提示する。承認は `{ approved: true }` を返し、次に受け入れられたターン内プリステップで追記されるサイレント（ナレーションなし）の保留中終了を記録する。そのためプランガイダンスはアシスタントの現在のツールバッチの残りを通じて有効であり続け、ツール結果自体が遷移を報告する。継続はユーザーフィードバックを運ぶ失敗呼び出しとなるため、モデルは改訂して再提示する。却下されたレビューは `{ approved: false }` を返してターンを終えるため、ユーザーの次のメッセージまでプランモードは有効のままである。対話チャネルの欠如やレビュー中のサービスリロードも、黙ってプランモードを抜けるのではなく呼び出しを失敗させる。
[`ctx.commands`](commands.md) が構成されている場合、プラグインは `/plan [off|message]` を登録する。素の `/plan` はプランモードを選択し、その他の空でないメッセージはプランモードを選択した上でテキストを `agent.steer()` 経由で投入するため、プランガイダンス下で次ステップの通常の記録済みユーザーメッセージになる。正確な引数 `off` は無効を選択し、これは追記前に保留中の入口を取り消し、リクエストから可視になる前に取り消す。

## サービス

`ctx.planMode` は記録されたプラン状態を所有し、ステップ開始時に選択済み状態を適用・ナレーションし、`plan:policy` 節、`/plan` コマンド、安定した終了ツールを所有する。`get`/`set` シグネチャは生成された[サービスカタログ](#ctxplanmode--planmodecontroller)にある。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成（doc-sync の `pnpm run verify-cordis-catalog` で鮮度を検証、`pnpm run gen-cordis-catalog` で再生成）。言語面が異なるのはロケール固有の対訳文書パスのみである。シグネチャブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md)にある。

<a id="ctxplanmode--planmodecontroller"></a>

### `ctx.planMode` — `PlanModeController`

`ctx.planMode`: 記録されたプラン状態を所有し、ステップ開始時に選択済み状態を適用・ナレーションし、`plan:policy` 節、`/plan` コマンド、安定した終了ツールを所有する。クライアントキャリアは射影の切り詰められた `{ active, pending }` ビューを公開する。

```ts cordis-catalog
/**
 * Read the logged plan state and any selected state awaiting the next
 * accepted in-turn pre-step.
 *
 * @param agent The agent to read.
 * @returns Current logged state plus a pending selection, when present.
 */
get(agent: Agent): { active: boolean; pending?: boolean }

/**
 * Select whether plan mode should be active. Between turns the method
 * appends the change immediately because no in-turn pre-step will run until
 * another prompt starts a turn. The open-turn fold is the idle signal:
 * agent status stays `running` through post-turn checkpointing, when no
 * further in-turn pre-step runs. During an open turn the selection remains
 * pending until the next accepted in-turn pre-step. Repeated selection of
 * the current or already-pending state is a no-op.
 *
 * @param agent The agent to switch.
 * @param active Whether plan mode should be active.
 * @returns what happened: `committed` (logged now), `queued` (awaiting the
 * next accepted in-turn pre-step), `cancelled` (an opposite pending selection
 * was cleared; the logged state already matches), or `noop` (already in that
 * state).
 */
set(agent: Agent, active: boolean): 'committed' | 'queued' | 'cancelled' | 'noop'
```

Types: [Agent](core.md)

Source: [`packages/plan/plan-mode/src/index.ts`](../../packages/plan/plan-mode/src/index.ts)
<!-- END GENERATED cordis-surface -->
