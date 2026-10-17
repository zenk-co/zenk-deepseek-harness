# ユーザーインタラクション

日本語 | [English](user-questions.en.md) | [中文](user-questions.zh.md)

[dsh-user-questions](../../packages/interaction/user-questions) の user-questions シーム。エージェントが続行する前に人間の回答を必要とするとき、ツールまたはパーミッションプラグインが使用するプロバイダー中立な語彙である。エージェントスコープの waterfall リスナーが利用可能な UI サーフェスを構成し、接続されたクライアントへ中継されるリスナーも含む。

ソース: [`packages/interaction/user-questions/src/index.ts`](../../packages/interaction/user-questions/src/index.ts)

## 質問オプション

`AskUserQuestionOption` は 1 つの選択可能な選択肢を表す。`label` はユーザー向けの選択肢テキストであり、モデル向けの選択値でもある。`description` はオプションの UI ヘルプテキストである。

```ts type-equiv
/** One selectable answer offered to the user. */
interface AskUserQuestionOption {
  /** User-facing label. */
  label: string
  /** Optional extra context rendered by capable UIs. */
  description?: string
}
```

## 表示意図

`AskUserQuestionIntent` は既知の決定種別をオプションで宣言する。意図を追加できるように `kind` でタグ付けされる。タグを認識しない UI は汎用の選択肢リストを描画する。意図は表示のみを変える。意図を尊重する UI は汎用 UI が送るのと同じ選択肢ラベルで回答するため、呼び出し元はどちらでも同じ回答フィールドを読む。`approve` は選択肢の順序に頼るのではなく、肯定の選択肢を名指しする。`ask()` は型では表現できない 2 つの主張を拒否する。すなわち、自身の質問のどの選択肢も名指ししない `approve` と、`detail` のない質問に対する意図である。

```ts type-equiv
/**
 * A caller-declared presentation intent: the question IS this kind of
 * decision, so a UI that recognises the tag may present it as such instead of as a
 * generic option list. Tagged so further intents can be added; a UI that does
 * not know a tag renders the generic flow, and the answer encoding is identical
 * either way — an intent changes presentation only, never the protocol.
 */
type AskUserQuestionIntent = {
  /** A plan submitted for review: `detail` is the plan markdown `ask()` requires, and the decision approves or declines it. */
  kind: 'plan-review'
  /**
   * The option label that approves the plan; every other option declines it.
   * Named rather than positional so no UI infers the verdict from option order.
   * An `approve` naming no option of its own question is rejected at `ask()`.
   */
  approve: string
  /** Logged tool invocation whose arguments contain the reviewed plan. */
  callId?: ToolCallId
}
```

## 質問項目

`AskUserQuestionItem` はリクエスト内の 1 つの質問である。呼び出し元は安定した `id` を供給し、それは回答と共にエコーバックされるため、バッチ化された質問はルーティング可能なままである。オプションの `detail` は、プロバイダーが質問と共に描画するが選択可能な選択肢ラベルには含めない補足テキストを運ぶ。

```ts type-equiv
/** One question in a user-questions request. */
interface AskUserQuestionItem {
  /** Stable caller-provided question id, echoed in the answer. */
  id: string
  /** The question to display. */
  question: string
  /** Optional supporting detail rendered with the question but kept out of option labels. */
  detail?: string
  /** Optional short heading/group label. */
  header?: string
  /** Optional choices the UI can render as a menu. */
  options?: AskUserQuestionOption[]
  /** Whether more than one option may be selected. Defaults to single-select. */
  multiSelect?: boolean
  /** Optional presentation intent for capable UIs; absent asks for the generic option list. */
  intent?: AskUserQuestionIntent
}
```

## 質問リクエスト

`AskUserQuestionRequest` はパッケージをまたぐリクエストである。`questions` は配列なので、UI は関連するプロンプトを 1 つのフローで提示しつつ、回答ごとに安定した id を保てる。存在する場合、`agent` は正確なライブの呼び出し元である。interaction シームは、ライブレジストリがそのインスタンスをランタイムルートとして識別する間のみそれを受け入れる。

```ts type-equiv
/** Request for a human answer. */
interface AskUserQuestionRequest extends AskUserQuestionRequestEvent {}
```

## 回答

プロバイダーは質問 id ごとに 1 つの回答項目を返す。`selected` は選択された選択肢ラベルを含み、`custom` はユーザーが自由記述の「その他」回答を入力した場合にそれを運ぶ。単一選択の質問では、`custom` は選択された選択肢を上書きし、`selected` は空である。複数選択の質問では、`custom` は `selected` のラベルを補足し得る。UI は、それ以外は完了したバッチの中でスキップされた質問を保持するために、`selected` が空で `custom` のない項目を使うこともできる。

```ts type-equiv
/** Answer to one question. */
interface AskUserQuestionAnswerItem {
  /** The answered question id. */
  id: string
  /** Selected option labels. May accompany custom text for a multi-select question. */
  selected: string[]
  /** Optional free-text "Other" answer. */
  custom?: string
}
```

```ts type-equiv
/** The human's answer. */
interface AskUserQuestionAnswer {
  /** Structured answers keyed by question id. */
  answers: AskUserQuestionAnswerItem[]
}
```

時間制限付き回答者は `wait: { callId, timed: true }` を受け取る。call id はカードとフォアグラウンド待機を識別する。Client は `attachWait` を呼び出して待機をクレームし、その残り時間を取得する。transport はこれらのフィールドを検査も書き換えもせずに元のイベントを転送する。`timed` のない `wait` は、カードキー付きの無期限リクエストを識別する。`wait` がない場合は、カードキーのないブロッキングリクエストを識別する。

```ts type-equiv
/** Client-safe payload declared for the user-question answerer waterfall. */
interface AskUserQuestionRequestEvent {
  /** Questions to display. */
  questions: AskUserQuestionItem[]
  /** Agent identity projected to the corresponding Client Context in transit. */
  agent?: Agent
  /** Cancellation lifetime of the pending request. */
  signal?: AbortSignal
  /**
   * Tool call the Client card is keyed by. Timed answerers attach to the
   * business wait stream before starting their local countdown.
   */
  wait?: {
    /** Tool call the Client card is keyed by. */
    callId: ToolCallId
    /** True for a foreground wait that requires a Client claim; absent for indefinite waits. */
    timed?: boolean
  }
}
```

## 時間制限付き質問と遅延返信

時間制限付き質問は、有限のフォアグラウンドウィンドウを待ってから、エージェントに独立した作業を続行させる。ユーザーがウィンドウ内で回答すると、ツールは回答バッチを返す。そうでない場合、`TimedUserQuestionResult` は `{ pending: true, callId }` になる。pending はその質問がまだ回答可能であることを意味し、空の回答、拒否、確認、または許可ではない。

```ts type-equiv
/** Timed ask result returned when the foreground answer window closes. */
type TimedUserQuestionResult = AskUserQuestionAnswer | { pending: true; callId: ToolCallId }
```

Client のクレームはビジネス Remote ストリームであり、Gateway の配信ではない。`TimedQuestionWait` は元の Host 期限を保持し、クレームが存在しない間のみタイマーを動かす。その `attachWait` ストリームは現在の残り時間を yield し、Client は自身のクロックでカウントダウンする。フォーカス、編集、および Take 時間はローカルに留まる。ストリームのキャンセルはそのクレームを解放し、最後のクレームが去った後、Host は元の期限を再開する。無人のタイムアウトはフォアグラウンド waterfall のプライベートシグナルを中断し、Turn をキャンセルせずに pending を返す。Gateway と `api-remotes` に質問固有のタイミングポリシーはない。

`userQuestions` Session 射影は、既存のイベントを回答可能な質問セットと確定済みセットに畳み込む。待機状態、フォーカス状態、または期限はログに記録されない。各 `request/header` はモデルが見た正確なツールスキーマを記録する。ネイティブ呼び出しが追跡されるのは、そのヘッダーが `timeout` パラメーター付きの時間制限付き `ask_user_question` スキーマを宣言している場合のみである。ブロッキングのレガシーツールはそれを決して宣言しない。ネイティブ `tool/call` が質問を開く。`tool/result` がそれを `continued` とマークするのは、pending ペイロードを運ぶか、Session 再開修復が追記する合成 `TOOL_OUTCOME_UNKNOWN` 結果である場合のみである。回答バッチはそれをそのバッチと共に `settled` へ移し、失敗はそれを落とす。`run_code` PTC サブコールは、その `tool/ptc-dispatch` 結果が pending のとき射影に入る。リクエストヘッダーが公開するのは `run_code` のみであるにもかかわらず、である。遅延返信は、そのメッセージが `user/message` として受け入れられるときに、継続中の質問をそのメッセージから読み出した回答バッチと共に `settled` へ移す。時間制限付き呼び出し自身の結果がタイムアウトを記録しているため、トランスクリプト行がユーザーが最終的に選んだものを他に読む場所はない。キュー済みの返信は受け入れ前にキャンセルでき、質問は回答可能なままになる。テキストに可読なバッチを運ばない返信は、その呼び出しを回答なしで確定させる。アクティブでない呼び出しを名指しする返信は何も変えない。

```ts type-equiv
/** `open` while the tool call may still return the answer; `continued` once the answer can only arrive as a new turn. */
type UserQuestionState = 'open' | 'continued'
```

```ts type-equiv
/** One unanswered timed `ask_user_question` call reconstructed from the Session log. */
interface PendingUserQuestion {
  readonly callId: ToolCallId
  readonly questions: readonly AskUserQuestionItem[]
  readonly state: UserQuestionState
}
```

```ts type-equiv
/**
 * One timed `ask_user_question` call and the answers it settled with: the
 * batch its own result carried when the user answered inside the window,
 * otherwise the batch its late reply carried, because that call's own result
 * recorded the timeout. A transcript row reads what the user finally answered
 * from here, and only a call listed here was a timed one.
 */
interface SettledUserQuestion {
  /** The settled call. */
  readonly callId: ToolCallId
  /** The recorded batch, one entry per question; empty when the late reply carried none. */
  readonly answers: readonly AskUserQuestionAnswerItem[]
}
```

```ts type-equiv
/**
 * Both halves of one Session's timed `ask_user_question` state, as every
 * Client reads them. A call made while the blocking legacy tool was in
 * effect appears in neither half.
 */
interface UserQuestionProjectionView {
  /** Calls that can still take an answer, in ask order. */
  readonly active: readonly PendingUserQuestion[]
  /** Calls an answer settled, in settlement order. */
  readonly settled: readonly SettledUserQuestion[]
}
```

open の質問は waterfall を通じてのみ回答を受け付ける。`continued` になると、`answer` Remote メソッドが所有エージェント用のユーザーメッセージをキューに入れ、アイドルであれば起こす。メッセージはソース `user-question-reply`、結果 `answered`、および `answer_to_pending_question` ペイロードを持つ。このメソッドは open または未知の呼び出しに対して `false` を返し、Host 再起動後でも 2 度目のキュー済み返信を `REPLY_QUEUED` で拒否し、不完全または重複した回答バッチを `BAD_ANSWER` で拒否する。

Client パネルを閉じても何も送信されない。フォアグラウンドのタイムアウトはツールの待機のみを終了する。継続中の質問に期限はなく、返信が受け入れられるまで回答可能なままである。

Host 再起動後、Remote 層は Session が再び開かれるときにルートエージェントを再開する。遅延返信はその後、新しいターンに入る。

## エラー

`UserQuestionError` は `HarnessError` を拡張するため、`ctx.tools.execute()` は `EMPTY_QUESTIONS`、`BAD_INTENT`、`NO_PROVIDER`、`ASK_ABORTED`、または UI 側のキャンセルのようなモデル向けツール失敗に対して `{ name, code }` を保持する。

```ts type-equiv
/** Stable error taxonomy for user-questions failures. */
class UserQuestionError extends HarnessError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
    this.name = 'UserQuestionError'
  }
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される（doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。`pnpm run gen-cordis-catalog` で再生成）。言語版はロケール固有の対訳ドキュメントパスだけが異なる。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxuserquestions--userquestionservice"></a>

### `ctx.userQuestions` — `UserQuestionService`

`ctx.userQuestions`: 検証とスコープ付き回答者 waterfall。

```ts cordis-catalog
/**
 * Answer a continued question. The reply is steered into the agent as a
 * user message whose source names the call; that message is also the
 * record that closes the question in the projection.
 * @param agent - Live root agent for the owning Session.
 * @param callId - Continued question identity.
 * @param answer - Complete structured answer batch, one item per question of the call.
 * @returns Whether the question is still continued; an accepted reply stays
 *   queued until the agent admits its user message.
 * @throws {UserQuestionError} `BAD_ANSWER` when the batch does not name each
 *   question of the call exactly once, or `REPLY_QUEUED` when a reply is
 *   already waiting for admission.
 */
@Remote answer(agent: Agent, callId: ToolCallId, answer: AskUserQuestionAnswer): boolean

/**
 * Let one answer UI hold a live timed wait. Closing the stream releases its claim.
 * @param agent - Live root agent owning the question.
 * @param callId - Foreground tool call to attach to.
 * @param signal - Remote stream cancellation, including Client disconnect.
 * @returns One Host-computed remaining duration, or no frames once the wait ended.
 */
@Remote({ mode: 'stream' }) async *attachWait(agent: Agent, callId: ToolCallId, signal: AbortSignal): AsyncIterable<{ remainingMs: number }>

/**
 * Foreground wait whose first settlement the Client decides: the Client
 * rejects with `ASK_TIMED_OUT` when its countdown ends, and this method maps
 * that code to the pending result.
 * @param request - Questions, live owner agent, and abort signal.
 * @param callId - Tool call identity the Client card is keyed by.
 * @param timeoutMs - Positive foreground wait in milliseconds.
 * @returns The answer when it arrives inside the window, otherwise a pending
 *   result, also when no connected Client claimed the request by the deadline.
 * @throws {UserQuestionError} `BAD_TIMEOUT` for a non-integer, non-positive,
 *   or oversized wait.
 */
async askTimed( request: AskUserQuestionRequest & { agent: Agent }, callId: ToolCallId, timeoutMs: number, ): Promise<TimedUserQuestionResult>

/**
 * Ask the scoped answerer waterfall and wait for the user's answer.
 *
 * When a caller supplies an agent, human interaction is valid only for the
 * exact live runtime root. Runtime ownership, not durable session lineage,
 * decides this boundary: an owned child has no human answerer and would
 * block forever, while a lineage-bearing session resumed as a new runtime
 * root may ask normally.
 *
 * @param request Questions, owner agent, and abort signal.
 * @returns The answer chosen or typed by the human.
 * @throws {UserQuestionError} code `ASK_ABORTED` when the supplied signal
 *   is already or becomes aborted, `CALLER_NOT_LIVE` when a supplied agent
 *   is not the registry's exact live instance, or `DELEGATED_CALLER` when
 *   that live agent is owned by another agent.
 */
async ask(request: AskUserQuestionRequest): Promise<AskUserQuestionAnswer>
```

型: [Agent](core.md) · [ToolCallId](core.md)

ソース: [`packages/interaction/user-questions/src/index.ts`](../../packages/interaction/user-questions/src/index.ts)

<a id="user-questions-events"></a>

### `user-questions/*` events

<a id="user-questionsrequest--waterfall"></a>

#### `user-questions/request` — waterfall

構成された回答者に構造化ユーザー入力を求める。回答を返してリクエストをクレームするか、`next()` を呼んで委譲する。スコープフィルターディスパッチ (`@deepseek-ai/dsh-scope`): エージェントスコープのリスナーはそのエージェントのみを受け取る。

```ts cordis-catalog
/**
 * Ask composed answerers for structured user input. Return an answer to
 * claim the request or call `next()` to delegate. Scope-filtered dispatch
 * (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @param request - pending user-question request.
 * @mode waterfall
 */
'user-questions/request'( this: Scoped<Agent>, request: AskUserQuestionRequestEvent, next: () => Promise<AskUserQuestionAnswer>, ): Promise<AskUserQuestionAnswer>
```

型: [Agent](core.md) · [Scoped](scope.md)

ソース: [`packages/interaction/user-questions/src/types.ts`](../../packages/interaction/user-questions/src/types.ts)
<!-- END GENERATED cordis-surface -->
