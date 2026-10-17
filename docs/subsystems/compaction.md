# コンパクション

日本語 | [English](compaction.en.md) | [中文](compaction.zh.md)

コンパクションシーム — bash と同様に分割された[ケイパビリティシーム](../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.md): サービス定義 ([dsh-compaction](../../packages/compaction/compaction)、`ctx.compaction`)、サービスプロバイダー ([dsh-compaction-basic](../../packages/compaction/compaction-basic) などのバックエンド)、人間のコンシューマー ([dsh-command-compact](../../packages/compaction/command-compact))。コンパクションは**1 つのオプションのケイパビリティ**であり、エージェントループの背骨の一部ではない。そのためその語彙は [core.md](core.md) ではなくここにある。トークナイザーまたはテンプレートベースのバックエンドは、同じインターフェースを実装する兄弟パッケージである。bash と異なり、このインターフェースは必然的に `dsh-session` と `dsh-llm` に依存する。その動詞はエージェント所有の `Session` に作用し、永続サマリーイベントは `ContentBlock` 語彙を使う ([コンパクションのケイパビリティシームリファレンス](../../packages/compaction/compaction/README.md)を参照)。

ソース: [`packages/compaction/compaction/src/types.ts`](../../packages/compaction/compaction/src/types.ts)

## `compaction/*` セッションイベント

コンパクションは宣言マージを通じて [`SessionEventMap`](session.md) を 3 つのイベント型で拡張する。3 つとも**ログのみ**である — ロック、サマリー、選択された範囲、影に隠されたイベント seq、トークン数、モデル呼び出しを記録し、サーフェスには参加しない。`SurfaceEventType` は意図的に拡張されない (モデルに届くのはメッセージを生成するイベントのみである)。そのためサマリー自体は `surfaceOp: { op: 'replace', startSeq, endSeq }` を伴う別個の `user/message` に乗る — サマリーコンパクションが行う唯一のサーフェスミューテーションである。[歴史的 Agent Note](../../.agents/notes/archived/feature/2026-06-18-compaction-capability-seam.md)が `user/message` を再利用する根拠を記録している。

| イベント | ペイロード | 役割 |
|---|---|---|
| `compaction/start` | `{ turn }` | ログに記録されるロックを取得する。数値は開いている自動ターンを識別し、`null` は単独の手動試行を識別する |
| `compaction/summary` | `{ summary, rawOutput?, llmStreamCall?, shadowedRange, shadowedSeqs, shadowedTokenCount, provider, model, maxTokens?, usage? }` | 安全なサマリープロジェクション、オプションの完全なプロバイダー出力と usage、このコンテキストの `ctx.llm.stream()` を通じた正確に 1 回の呼び出しで結果を生成した場合の `llmStreamCall: true` マーカー (完全な `rawOutput` を要求する)、影に隠されたサーフェス境界ペア (`start`/`end` seq — 数値区間ではなく位置スパン)、サーフェス順の影に隠された seq、推定トークン数、要約呼び出しのエンベロープ (`provider`、`model`、適用された場合はその生成上限) — ワンショットリクエストがログ + コードから再構築できるように記録される (再構築可能性の Agent Note)。マーカーのない `rawOutput` は呼び出し経路を識別しない |
| `compaction/end` | `{ turn, error? }` | 同じ数値または null のオーナーでロックを解放する (`error` は失敗した試行を記録する) |

ロックは**操作全体**を囲む。最初に `compaction/start` が追記され、次に要約、`compaction/summary` レコード、`user/message` 置換がすべて着地し、その後にだけ `compaction/end` が来る。最後にロックを解放することで、操作途中のクラッシュは、コンパクションが完了したと偽って主張する `compaction/end` ではなく、検出可能な孤立ロック (対応する `compaction/end` のない `compaction/start`) になる。

マーカーはロックの時点であり、排他的なコンテナではない。要約が保留中の間に、無関係なアイドル注入が単独の手動 start と end の間に現れることがある。手動経路は選択された位置スパンのみを再検証するので、注入されたコンテキストは置換チェックポイントの後も生き残る。ライブの未対応 start はすべての入り口をブロックする。より新しい `session/end-seed` より前の未対応 start は以前のライフサイクルからの古い証拠であり、無視される。

これらのバリアントは `declare module '@deepseek-ai/dsh-session/types'` ブロックの内部でマージされるため — 他のサブシステムページのトップレベル型とは異なり — ドリフトチェックされる ` ```ts type-equiv ` ブロックとしては貼り付けられない (`verify-type-equiv` の抽出器はトップレベル宣言を名前でしか照合しない)。上のペイロード表がカタログエントリーであり、権威あるフィールドについてはソースリンクをたどる。

<a id="image-offload"></a>
## 画像オフロード

`compaction-image-offload` は `image/offload` 宣言とその純粋なメッセージプロジェクションを所有する。各ターゲットは現在の入力ノードと正確な深さ優先の画像出現を識別する。イベントはノードとメッセージの同一性を保持し、`surfaceOp` を運ばない。[パッケージ README](../../packages/compaction/compaction-image-offload/README.md)が復旧ポリシー、登録、デタッチされたリプレイを所有する。

```ts type-equiv
/** Exact input-image occurrences selected by one durable offload decision. */
interface ImageOffloadTarget {
  /** Current message-producing event containing these occurrences. */
  seq: SessionSeq
  /** Zero-based depth-first image indexes within the immutable message. */
  imageIndexes: number[]
}
```

## `CompactionResult`

成功したコンパクションが呼び出し元に返すもの: 簿記イベントの seq、安全なサマリープロジェクション、影に隠された範囲と seq、推定トークン数。

```ts type-equiv
/** Result of a successful compaction operation. */
interface CompactionResult {
  /** Stable identity shared by this compaction's complete durable lifecycle. */
  compactionId: CompactionId
  /** Human command that initiated this compaction, when it was manual. */
  sourceCommandId?: CommandId
  /** The seq of the appended `compaction/start` event. */
  startSeq: SessionSeq
  /** The seq of the appended `compaction/summary` event. */
  summarySeq: SessionSeq
  /** The seq of the appended `compaction/end` event. */
  endSeq: SessionSeq
  /** The summary content blocks produced by the backend. */
  summary: ContentBlock[]
  /**
   * The surface-boundary pair that was shadowed: the seqs of the first
   * (`start`) and last (`end`) surface nodes of the replaced range. A
   * surface-POSITION span, not a numeric seq interval — after a prior replace
   * lands a fresh high-seq summary node at an older range's position, `start`
   * can be GREATER than `end`. {@link CompactionResult.shadowedSeqs} is the
   * authoritative set of shadowed nodes, in surface order.
   */
  shadowedRange: { start: SessionSeq; end: SessionSeq }
  /** The seqs of all shadowed surface nodes, in surface order. */
  shadowedSeqs: SessionSeq[]
  /** Estimated token count of the shadowed content. */
  shadowedTokenCount: number
}
```

## サービス

自動呼び出し元はポリシーが実行される理由を明示する。実装は確認されたオーバーフローを通常のプレッシャーより積極的に扱ってよい。

```ts type-equiv
/** Why automatic policy is asking a backend to consider compaction. */
type CompactionTrigger = 'pressure' | 'context-overflow'
```

`CompactionEngine` は、自動の `pressure` または `context-overflow` ポリシーのために `compactIfNeeded(agent, trigger, signal)` を、プレッシャー未満でも有用なアイドルセッションの削減 1 回のために `compactNow(agent, signal)` を、明示的な包含的サーフェス範囲のために `compactRegion(...)` を公開する。`compactNow()` はターン間のエージェントメンテナンスとして実行され、有用な範囲が存在しない場合は何も書かずに `null` を返し、要約の前に単独の `turn: null` ブラケットを記録し、後のキュー済みプロンプトが新しいサーフェスから導出される前に閉じた試行をフラッシュする。すべてのバックエンドは置換 `user/message` ソースを `compactCheckpointSource(compactionId, sourceCommandId?)` で作成する。クライアントと wire のコンシューマーはそのコンストラクター、`CompactionCheckpointSource`、`isCompactCheckpointSource()` を Cordis 非依存の `@deepseek-ai/dsh-compaction/checkpoint` サブパスからインポートし、パッケージルートは Host コンシューマーのためにそれらを再エクスポートする。必須のトランザクション同一性が置換チェックポイントを相関させ、述語は認識をどのバックエンドからも独立に保つ。実装は供給されたシグナルを要約へ転送しなければならない。シームは価格 API を所有しない。シングルトン [`ctx.tokenMeter`](token-meter.md) が推定とリプレイを直接所有し、`dsh-compaction-basic` が保持、イベント順序付け、ルーティングされた要約呼び出し、それらの設定を所有する。

想定される手動失敗は `ManualCompactionErrorCode` を使う:

```ts type-equiv
/** Expected failure classes for an explicit idle-session compaction request. */
type ManualCompactionErrorCode =
  | 'busy'
  | 'cancelled'
  | 'changed'
  | 'summary'
  | 'commit'
  | 'persistence'
```

`changed` と `summary` はサマリー置換なしで失敗した試行を閉じて永続化する。復旧中に記録された画像の省略は有効なままである。`commit` は部分的なミューテーションの後に続くことがある。`persistence` は、インメモリブラケットが閉じたがフラッシュが失敗したことを意味する。キャンセルは別個のままで、必要なクリーンアップの後に正確なアボート理由を throw する。

プレッシャーコンパクションはリクエスト導出の前に `agent/pre-step` waterfall で実行される。プレッシャーまたは正規オーバーフローが該当すると、compaction-basic は範囲選択の前にオプションの [`ctx.toolResultPruner`](../../packages/compaction/compaction-tool-result-pruner/README.md) を呼び出し、`ctx.tokenMeter` を通じて再計測し、サマリーなしでサーフェスを進めることができる。失敗リクエストの復旧は、失敗したステップが閉じた後に `agent/request-error` を通じて実行され、たとえプルーニング後に後続のサマリー作業が throw しても、サーフェス置換の世代が進んだときにのみ再試行アクションを返す。キャンセルは依然として優先される。リージョン境界はツール呼び出し/結果のペアリングを保つが、ターン全体は保たないので、1 つのサイズ超過ターンの早くに閉じたステップをコンパクトできる。しきい値、保持末尾ポリシー、オーバーフロー上限、失敗処理は `dsh-compaction-basic` が所有する。

サービス定義は、seq の前後でのツール呼び出し/結果ペアリングチェックのために `toolPairingBalancedBefore(session, seq)` と `toolPairingBalancedAfter(session, seq)` をエクスポートする。どちらも現在のサーフェスメンバーシップを検証し、欠落した seq と孤立した結果を拒否する。[パッケージ契約](../../packages/compaction/compaction/README.md#tool-pairing-boundaries)がそれらのキャッシュ挙動を定義する。

## ツール結果プルーニングの結果

オプションのツール結果プルーニングサービスは、各永続的なコンテンツ置換と、集約された Unicode コードポイント削減量を報告する。その公開結果型は [`compaction-tool-result-pruner/src/types.ts`](../../packages/compaction/compaction-tool-result-pruner/src/types.ts) にある。

```ts type-equiv
/** Cited source event and size accounting for one landed surface replacement. */
interface PrunedEntry {
  /** Full-fidelity tool-result event shadowed by the replacement. */
  readonly originalSeq: SessionSeq
  /** Newly appended pruned tool-result event. */
  readonly replacementSeq: SessionSeq
  /** Tool call shared by the original and replacement. */
  readonly callId: ToolCallId
  /** Original text size in Unicode code points. */
  readonly charsBefore: number
  /** Replacement text size in Unicode code points. */
  readonly charsAfter: number
}
```

```ts type-equiv
/** Aggregate outcome of one stable-surface pruning pass. */
interface PruneResult {
  /** Replacements in the snapshotted surface order. */
  readonly pruned: readonly PrunedEntry[]
  /** Total Unicode code points removed across replacements. */
  readonly charsRemoved: number
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxcompaction--compactionengine-abstract-seam"></a>

### `ctx.compaction` — `CompactionEngine` (abstract seam)

Abstract compaction service. Implementations own trigger policy, retention, and summarization, and may consume a separate measurement service. A successful run replaces the selected surface span with one summary node and prevents concurrent compaction of the same session. The replacement user message uses compactCheckpointSource with the transaction identity so consumers recognize and correlate it independently of the backend. Load one implementation per context as `ctx.compaction`.

```ts cordis-catalog
/**
 * Consider automatic compaction for one explicit trigger. Pressure policy
 * uses the latest durable routed request, while context-overflow policy may
 * force a useful balanced reduction even below the normal threshold. Return
 * `null` when no safe range can be compacted. A single oversized retained
 * unit or request envelope cannot be repaired through surface compaction.
 *
 * @param agent - agent context owning the session surface and routing options.
 * @param trigger - normal pressure or provider-confirmed context overflow.
 * @param signal - cancellation signal; model-backed implementations must forward it.
 * @returns the compaction result, or `null` if no compaction was needed.
 */
abstract compactIfNeeded( agent: CompactionAgentContext, trigger: CompactionTrigger, signal: AbortSignal, ): Promise<CompactionResult | null>

/**
 * Explicitly compact useful history even below automatic pressure thresholds.
 * Implementations synchronously start an idle task before any asynchronous
 * work, select a useful range without writing on a no-op, then
 * append a standalone `compaction/start` before summarization. That durable
 * marker is the compaction lock until one `compaction/end` attempt. Later waking
 * prompts remain accepted in FIFO order and start only after the optional
 * durability checkpoint and idle-task settlement. Context injected while the
 * summary runs may sit between the marker pair; only the selected span must
 * remain stable.
 *
 * @param agent - idle agent whose durable history should be compacted.
 * @param signal - cancellation scoped to this compaction request.
 * @param sourceCommandId - initiating command identity for a manual compaction.
 * @returns the compaction result, or `null` when no safe useful range exists.
 * @throws {@link ManualCompactionError} for expected busy, agent-cancellation,
 * changed-span, summarization/shrink, commit-stage, or persistence failures;
 * an aborted request preserves its exact abort reason. Failed attempts remain
 * visible in the log.
 */
abstract compactNow( agent: ManualCompactAgentContext, signal: AbortSignal, sourceCommandId?: CommandId, ): Promise<CompactionResult | null>

/**
 * Forcibly compact a range of surface nodes into a single summary node.
 * `start` and `end` name an inclusive span by surface position, not numeric seq
 * order; replacements can make visible seqs non-monotonic. Both edges must be
 * balanced so assistant tool calls remain paired with their results. A model-
 * backed implementation forwards cancellation and rejects active, missing,
 * reversed, or unbalanced ranges. The target session is `agent.session`.
 * Its replacement user message must use {@link compactCheckpointSource} with
 * the transaction's `CompactionId`.
 * Use {@link toolPairingBalancedBefore} and {@link toolPairingBalancedAfter}
 * for the edge checks.
 *
 * @param start - first surface seq, inclusive.
 * @param end - last surface seq, inclusive.
 * @param agent - context whose session is mutated and whose routing options guide summarization.
 * @param signal - optional cancellation; model-backed implementations must forward it.
 * @throws when compaction is active or the range is missing, reversed, or unbalanced.
 * @returns the appended event seqs, summary, replaced range, and token accounting.
 */
abstract compactRegion( start: SessionSeq, end: SessionSeq, agent: CompactionAgentContext, signal?: AbortSignal, ): Promise<CompactionResult>
```

Types: [CommandId](commands.md) · [SessionSeq](session.md)

Source: [`packages/compaction/compaction/src/index.ts`](../../packages/compaction/compaction/src/index.ts)

<a id="ctxtoolresultpruner--toolresultpruner"></a>

### `ctx.toolResultPruner` — `ToolResultPruner`

Deterministic head/middle/tail pruning for current tool-result surface nodes.

```ts cordis-catalog
/**
 * Measure text content in Unicode code points; non-text blocks cost zero.
 * @param blocks - tool-result content to measure.
 * @returns total Unicode code points across text blocks.
 */
measureContent(blocks: readonly ContentBlock[]): number

/**
 * Replace an over-budget text middle while retaining rich-block order.
 * Text slicing is by Unicode code point, not UTF-16 code unit, so a retained
 * boundary cannot split a surrogate pair. Grapheme clusters may still split.
 * @param blocks - original tool-result content.
 * @returns pruned content, or `null` when the text is within budget.
 */
pruneContent(blocks: readonly ContentBlock[]): ContentBlock[] | null

/**
 * Prune every over-budget tool result from one stable current-surface snapshot.
 * Each replacement preserves the complete event data except for `content`,
 * cites the shadowed node so replay can recover the replacement input, and is
 * immediately preceded by a `compaction/prune` shadow-price event pricing the
 * shadowed node through the injected token meter, so pure consumers can
 * subtract it without per-node state.
 * @param session - session whose current surface is rewritten.
 * @returns landed replacements and aggregate Unicode-code-point savings.
 * @throws when the session rejects a replacement; replacements committed
 * earlier in the pass remain durable.
 */
pruneSession(session: Session): PruneResult
```

Types: [ContentBlock](llm-streaming.md) · [Session](session.md)

Source: [`packages/compaction/compaction-tool-result-pruner/src/index.ts`](../../packages/compaction/compaction-tool-result-pruner/src/index.ts)

<a id="compaction-events"></a>

### `compaction/*` events

<a id="compactionsummary-error--waterfall"></a>

#### `compaction/summary-error` — waterfall

Recover a failed summary request by synchronously recording a durable change to its selected input. Return true only after making progress; the provider re-derives and re-prices the selection before retrying. Call next() when the failure cannot be recovered. Decisions survive a later summary failure or cancellation.

```ts cordis-catalog
/**
 * Recover a failed summary request by synchronously recording a durable
 * change to its selected input. Return true only after making progress;
 * the provider re-derives and re-prices the selection before retrying.
 * Call next() when the failure cannot be recovered. Decisions survive a
 * later summary failure or cancellation.
 * @param payload.session - session containing the selected input.
 * @param payload.sourceEventSeqs - selected message events in request order.
 * @param payload.error - failure thrown by the summarizer.
 * @param payload.signal - optional compaction cancellation signal.
 * @param next - delegate to the next recovery listener.
 * @mode waterfall
 */
'compaction/summary-error'(payload: { session: Session; sourceEventSeqs: readonly SessionSeq[]; error: unknown; signal?: AbortSignal }, next: () => boolean): boolean
```

Types: [Session](session.md) · [SessionSeq](session.md)

Source: [`packages/compaction/compaction/src/index.ts`](../../packages/compaction/compaction/src/index.ts)
<!-- END GENERATED cordis-surface -->
