# ユーザー承認

日本語 | [English](approval.en.md) | [中文](approval.zh.md)

[dsh-user-approval](../../packages/interaction/user-approval) のユーザー承認シームは 1 つの問いに答える: この特定のアクションを続行してよいか? 共有されたリクエスト/結果の語彙、`ctx.approval` ディスパッチサービス、`approval/request` アンサラーウォーターフォール、ログ専用の監査ペア、セッションごとの `ask`/`never` ポリシーを所有する。UI チャネルは人間のアンサラーを提供してよい。[ACP 自動化ブリッジ](../../packages/acp/acp)は、自身のエージェント向けにワンショットの機械判断を提供する。[dsh-tools](../../packages/core/tools) や [dsh-tool-bash](../../packages/shell/tool-bash) などの呼び出し元は閉じた結果を消費し、`allowed-once` でない限りフェイルクローズする。

ソース: [`packages/interaction/user-approval/src/index.ts`](../../packages/interaction/user-approval/src/index.ts)

## アイデンティティと結果

すべてのリクエストは新しい `ApprovalRequestId` を受け取る。このブランドは `approval/asked` と `approval/decided` の監査イベントを対にするが、承認 ID をツール呼び出しやエージェント/セッションの ID と相互交換可能にはしない。

```ts type-equiv
/**
 * Pairs one `approval/asked` audit event with its `approval/decided`.
 * Service-issued (one fresh id per {@link ApprovalService.request} call).
 */
type ApprovalRequestId = Branded<'ApprovalRequestId'>
```

`ApprovalOutcome` は閉じており、フェイルクローズである。`allowed-once` は問い合わせされたアクションのみを許可し、呼び出し元は `rejected`、`cancelled`、`unavailable` で拒否する。欠落した、所有していない、例外をスローする、または規約に適合しないアンサラーは、ゲートを開くのではなく `unavailable` になる。

```ts type-equiv
/**
 * Closed approval outcomes: a one-shot grant, explicit rejection, withdrawn
 * request, or unavailable answerer. Callers fail closed on `unavailable`.
 */
type ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'
```

## セッションごとのポリシー

`ApprovalPolicy` は、対話型アンサラーが実行される前に何が起こるかを決定する。`ask` は構成されたアンサラーチェーンに委任し、その無応答のデフォルトは `unavailable` である。`never` はアンサラーを一切ディスパッチせずに決定論的に `rejected` を返す。実効値はセッションログ内の最後の `approval/policy` イベントであり、なければサービス設定にフォールバックする。コンシューマーは `ctx.approval.effectivePolicy(session)` でそれを読み取り、`setApprovalPolicy(session, policy)` が唯一の書き込み経路であるため、リプレイがオーバーライドを再構築する。

```ts type-equiv
/**
 * A session's approval policy — what happens to an {@link ApprovalService}
 * ask BEFORE any interactive answerer sees it:
 *
 * - `'ask'` (the default) — delegate to the composed answerers; with none
 *   composed the chain falls through to the fail-closed `'unavailable'`.
 * - `'never'` — never prompt anyone: every ask resolves `'rejected'`
 *   deterministically. The strict headless stance (CI, unattended runs) and
 *   the policy whose outcome is knowable without asking.
 */
type ApprovalPolicy = 'ask' | 'never'
```

どちらのポリシーも、キャッシュ安全なランタイムコンテキストスナップショットに現在の完全な意味を寄与する。ソース指定された `user/message` が耐久性のあるモデル可視入力であり、承認状態の変更は、描画されたシステムプロンプトを保持する `system/message` ノードに触れることなく、保持された履歴の後に新しい完全なスナップショットを追加する。

## 承認リクエスト

`ApprovalRequest` は、問いをルーティングして監査するのに十分な精度でエージェントとツールのアクションを識別する。ツール引数は意図的に省略される。アンサラーは、ずれる可能性のある 2 つ目のコピーを描画するのではなく、`callId` を通じてすでにストリームされたツール呼び出しにプロンプトを添付する。オプションの `displayReason` はリクエスター所有のロケール文字列を表示に運び、`reason` は監査テキストのままである。

```ts type-equiv
/**
 * Readonly same-process permission question. `callId` links to an already
 * presented tool call, so arguments are not duplicated here.
 */
interface ApprovalRequest extends ApprovalRequestEvent {
  /**
   * The agent on whose behalf the question is asked. Routes the question (a
   * UI answerer only answers for agents it owns) and receives the audit
   * events on its session log.
   */
  readonly agent: Agent
  /** The tool the question is about (presentation and audit). */
  readonly toolName: string
  /**
   * The exact tool call being decided, when the asker has one — lets a UI
   * attach the prompt to the tool call it already streamed.
   */
  readonly callId?: ToolCallId
  /** The asker's human-readable explanation of WHY it is asking. */
  readonly reason?: string
  /**
   * Aborting withdraws the question: the request settles `'cancelled'`
   * immediately and a late answer from a still-pending answerer is discarded.
   */
  readonly signal?: AbortSignal
}
```

## ディスパッチと監査

`ctx.approval.request(req)` は、リクエスト元のセッションが開いているターンの中にあることを要求する。`approval/asked` を追加し、1 つの結果を取得し、対応する `approval/decided` を追加して、その結果で解決する。`never` ポリシーはウォーターフォールディスパッチの前にサービス内部で強制されるため、後から `prepend` で登録されたアンサラーでもそれを回避できない。アンサラーは、リクエストを所有する場合は結果を返し、委任する場合は `next()` を呼び出す。最初の回答が単一の決定スロットを占める。

監査イベントはログ専用であり、モデルのトランスクリプトには入らない。モデル可視の動作は、呼び出し元が導出するツール結果と現在のランタイムコンテキストスナップショットである。サービスの破棄はそのコンテキストへの寄与を削除し、アンサラーリスナーは所有するプラグインに独立して effect バインドされる。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される(doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。再生成は `pnpm run gen-cordis-catalog`)。言語版の違いは、ロケール固有のペアドキュメントパスのみである。シグネチャブロックは `ts cordis-catalog` フェンスを使用し、元のソース JSDoc を保持する。ディスパッチモードは [primer](../cordis-primer.md#dispatch-modes) で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxapproval--approvalservice"></a>

### `ctx.approval` — `ApprovalService`

アンサラーの前にセッションポリシーを適用し、すべての ask/結果ペアをリクエスト元セッションに記録する承認サービス。決定論的なポリシー変更を、ランタイムコンテキストスナップショットと切替通知を通じてモデルに公開する。

```ts cordis-catalog
/**
 * Switch one live agent's policy and queue the transition for its next model
 * step. Session initialization uses {@link setApprovalPolicy} directly
 * because there is no previously visible policy to change.
 * @param agent - the live agent whose policy is changing.
 * @param policy - the new effective policy.
 */
setPolicy(agent: Agent, policy: ApprovalPolicy): void

/**
 * Ask the composed answerers to decide one readonly same-process request.
 * The service borrows the request, agent, session, and live signal directly.
 * The request requires an open turn because the audit pair must be enclosed
 * by the durable log's commit/replay boundary; an idle ask rejects before
 * appending anything. The answerer phase always produces an outcome: an
 * aborted signal yields `'cancelled'`, a missing or throwing answerer yields
 * `'unavailable'` (fail closed), and a rogue non-vocabulary return value is
 * normalized to `'unavailable'`. A failure that prevents either audit append
 * from committing still rejects because returning an unlogged decision would
 * violate the pair. Session contains post-commit observer failures, so an
 * authoritative append cannot reject the request or suppress its matching
 * audit event.
 * @param req - the pending decision (agent, tool identity, reason, signal).
 * @returns the closed outcome; `'allowed-once'` is the only grant.
 * @throws when no turn is open or either audit event fails before the session
 *   append commit point.
 */
async request(req: ApprovalRequest): Promise<ApprovalOutcome>

/**
 * Read the session override without applying the configured default.
 * @param session - session whose log supplies the override.
 * @returns the last logged policy, or `undefined` without one.
 */
overrideOf(session: Session): ApprovalPolicy | undefined
```

型: [Agent](core.md) · [Session](session.md)

ソース: [`packages/interaction/user-approval/src/index.ts`](../../packages/interaction/user-approval/src/index.ts)

<a id="approval-events"></a>

### `approval/*` イベント

<a id="approvalrequest--waterfall"></a>

#### `approval/request` — ウォーターフォール

構成されたアンサラーに 1 つの決定を求める。結果を返してリクエストを主張するか、`next()` を呼び出して委任する。スコープフィルター付きディスパッチ(`@deepseek-ai/dsh-scope`): エージェントスコープのリスナーはそのエージェントのみを受け取る。

```ts cordis-catalog
/**
 * Ask composed answerers for one decision. Return an outcome to claim the
 * request or call `next()` to delegate. Scope-filtered dispatch
 * (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
 * @param req - pending approval request.
 * @mode waterfall
 */
'approval/request'( this: Scoped<Agent>, req: ApprovalRequestEvent, next: () => Promise<ApprovalOutcome>, ): Promise<ApprovalOutcome>
```

型: [Agent](core.md) · [Scoped](scope.md)

ソース: [`packages/interaction/user-approval/src/types.ts`](../../packages/interaction/user-approval/src/types.ts)
<!-- END GENERATED cordis-surface -->
