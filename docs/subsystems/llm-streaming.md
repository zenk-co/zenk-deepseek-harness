# LLM ストリーミング

日本語 | [English](llm-streaming.en.md) | [中文](llm-streaming.zh.md)

[`packages/llm`](../../packages/llm/README.md) 由来の会話・ストリーミング型: 永続化される `Message` 値、リクエスト専用のユーザー入力、共有の `ContentBlock` バリアント、完全に組み立てられたモデルリクエスト、生の `StreamChunk` プロトコル、すべてのアダプターが実装しなければならないアダプターコントラクト、そして共有のアセンブラー。[コアパッケージ](core.md)は毎ターンこれらの値を保持してログに記録する; このページではそれらを宣言する。

Source: [`packages/llm/llm/src/types.ts`](../../packages/llm/llm/src/types.ts)

<a id="content-blocks-and-messages"></a>

## コンテンツブロックとメッセージ

会話は `Message` の列であり、メッセージは型付き **コンテンツブロック** の配列である。ブロックの共用体は `ContentBlockMap` から導出される。

Source: [`packages/llm/llm/src/types.ts`](../../packages/llm/llm/src/types.ts)

```ts type-equiv
/**
 * Merge-extensible content blocks keyed by `type`. New core blocks must land
 * with adapter, UI, and compaction support. Tool-change blocks belong to
 * developer messages; `projectToolUpdates` selects what each route receives.
 */
interface ContentBlockMap {
  'text': TextBlock
  'reasoning': ReasoningBlock
  'image': ImageBlock
  'file': FileBlock
  'tool-call': ToolCallBlock
  'tool-addition': ToolAdditionBlock
  'tool-removal': ToolRemovalBlock
}
```

ブロックインターフェース (完全なフィールドはソース参照): `TextBlock` (`text`)、`ReasoningBlock` (可視テキストとは異なる思考内容)、`ImageBlock` (永続化される[画像添付](attachment.md))、`FileBlock` (永続化される逐語的[ファイル添付](attachment.md)であり、リクエスト組み立てがすべてのルート向けに扱うテキストへ投影する)、および `ToolCallBlock` (`id: ToolCallId`、`name`、生 JSON の `arguments`)。ツール結果は `toolCallId`、結果 `content`、任意の `isError` を持つ一級の `ToolResultMessage` 値であり、コンテンツブロックではない。`ContentBlock = ContentBlockMap[ContentBlockType]`。新しいモダリティは、そのアダプター、UI、コンパクション、永続化リプレイの各経路がそれを尊重する場合にのみ、マージ拡張可能なマップに属する。開発者向けツール変更ブロックは、解決済みルートケイパビリティに従って投影される。

画像アクセスは、永続化される添付や決定的なリクエスト画像バージョンではなく、リクエスト直列化に属する。`resolveImageAttachmentAccess()` は、添付プロバイダーの任意のホストオブジェクトパスと、現在のツール実行ファイルシステム向けにコンシューマーが提供したマッピングを組み合わせる。結果はそのリクエストでのみ利用可能であり、`variantId` には関与しない。

Source: [`packages/llm/llm/src/content.ts`](../../packages/llm/llm/src/content.ts)

```ts type-equiv
/** Execution-world path that model tools can use to read one normalized attachment. */
interface ImageAttachmentAccess {
  /** Absolute path to immutable normalized bytes; callers must treat it as read-only. */
  readonlyPath: string
}
```

Source: [`packages/llm/llm/src/message.ts`](../../packages/llm/llm/src/message.ts)

`Message` は、識別子付きの不変な role/source/content 値である。モデルが生成したアシスタントメッセージは、それを生成したプロバイダーとモデルを名指しし、ソース内に任意のアダプタープライベートなリプレイデータを運ぶ:

```ts type-equiv
/** Provider/model identity and adapter-private replay data for an assistant message. */
interface AssistantProviderMetadata {
  /** Provider route that produced the message. */
  provider: string
  /** Provider model id that produced the message. */
  model: string
  /**
   * Lossless-JSON adapter state needed to replay the provider response.
   * `LlmRuntime` exposes it to a target adapter only when that adapter instance
   * currently owns both this historical provider and the target provider.
   */
  replayState?: unknown
}
```

```ts type-equiv
/** Any persisted conversation message, discriminated by its `role`. */
type Message = MessageRoleMap[keyof MessageRoleMap]
```

`DeveloperMessage` は、`developer` ロールで会話順に増分エージェントセッション変更を記録する。`ToolAdditionBlock.toolName` は、含む Session イベントの履歴ヘッダー参照が選択した定義を有効化し、`ToolRemovalBlock.toolName` は有効な定義を削除する。両ブロックは他のメッセージロールでは拒否される。`deferLoading` は追加レコードを必要とせずに定義の遅延読み込みを独立に要求する。ヘッダーバインディングは [Session](../../packages/core/session/README.md)、プロバイダーサポート制限は [LLM パッケージ](../../packages/llm/llm/README.md#known-limitations-and-deferred-work)を参照。`ToolUpdate` は、解決済み・準備済みモデルメタデータ上で `in-history` または `addition-only` である。`GenerateOptions.toolHistory` は `ToolHistory` を運ぶ: 初期 `tools` と順序付き `updates` であり、各々が開発者 `messageId` を履歴的に解決された `additions` に束縛する。ランタイムはこの状態をプロバイダー宣言へ投影する; ログ済みヘッダー内の有効ツール一覧は変更しない。

メッセージの由来自体がマージ拡張可能な総和型である:

```ts type-equiv
/**
 * Where a message (or injected content) came from, in the harness's own
 * vocabulary. Merge-extensible sum type — each producer declares its own
 * `kind` in its own module; there is no shared catch-all `plugin` kind.
 * Model and tool sources answer their role messages; user messages carry any
 * producer's kind, and consumers fall through unknown kinds.
 */
interface MessageSourceMap {
  user: { kind: 'user' }
  model: ModelMessageSource
  tool: ToolMessageSource
  'system-prompt': SystemPromptMessageSource
}
```

プロデューサー同一性と表示形態は独立である。`kind` は*誰がこれを生成したか*に答え、任意の `form` は*どのような種類の情報か*に答え、コンシューマーが表示方法を決める。複数のプロデューサーが 1 つの形態を共有でき、1 つのプロデューサーがセッションを通じて複数の形態を送出できる。値は意味的であり一度に 1 つずつ増える; 欠落または未知の値は文書化された既定値を使い、不透明なコンテンツとして表示される:

```ts type-equiv
/**
 * The kind of information in producer-supplied context, declared by the
 * producer in the same `MessageSource`.
 *
 * `MessageSource.kind` answers *who produced this*; `form` answers *what kind
 * of thing it is*, and the two axes are deliberately independent — several
 * producers share one form, and one producer may emit more than one form over
 * a session.
 *
 * The vocabulary is SEMANTIC, never visual: a value states that the content is
 * a file's instructions or a catalog of available items, and a consumer decides
 * what that looks like. Colors, icons, ordering, and collapse defaults are the
 * consumer's business and must not enter this union. It grows one value at a
 * time as producers gain the structured fields their form needs; an absent or
 * unknown value is the documented default, presented as opaque content.
 */
type ContextForm =
  /** Instructions read out of workspace files the model is expected to follow. */
  | 'instructions'
  /** A catalog of items available in this session, republished as it changes. */
  | 'catalog'
  /** Current state, where a later snapshot from the same producer supersedes an earlier one. */
  | 'snapshot'
  /** A one-off account of something that just happened; it supersedes nothing. */
  | 'notice'
  /** A message another agent addressed to this one. */
  | 'relay'
  /** Material lifted out of another session's log, possibly reduced on the way in. */
  | 'recall'
```

```ts type-equiv
/** One named contribution to a `snapshot`-form context, in assembly order. */
interface ContextSnapshotSection {
  /** The contributing subsystem's name. */
  readonly name: string
  /** That contribution's model-facing text, exactly as assembled. */
  readonly text: string
}
```

```ts type-equiv
/**
 * Producer-declared {@link ContextForm} and the fields that form requires,
 * mixed into the source types that carry one.
 *
 * Discriminated by `form` so a producer cannot select a form without the
 * fields needed to present it: a `notice` must record its one-line
 * account, a `snapshot` its sections. Omitting `form` stays valid — an
 * undeclared context is the documented default.
 */
type ContextFormed =
  | { readonly form?: never }
  | { readonly form: 'instructions' }
  | { readonly form: 'catalog' }
  | {
    readonly form: 'snapshot'
    /** The named contributions this snapshot assembled, in order. */
    readonly sections: readonly ContextSnapshotSection[]
  }
  | {
    readonly form: 'notice'
    /** One-line account of what happened, shown without expanding the row. */
    readonly summary: string
  }
  | { readonly form: 'relay' }
  | { readonly form: 'recall' }
```

<a id="streamchunk--the-raw-protocol"></a>

## `StreamChunk` — 生プロトコル

ストリーミング応答は複数の型付きブロック (テキスト、推論、複数のツール呼び出し) を織り交ぜる。`index` が各差分をそのブロックに結び付け、`block-end` が完全に組み立てられた `ContentBlock` を運ぶため、コンシューマーが差分を自前で再組み立てする必要はない。これは**クローズド**な判別共用体であり — `type` 上の `switch` は `assertNever` で終わるため、バリアントの追加はそれを扱わなければならないすべてのコンシューマーでコンパイルを壊す。

```ts type-equiv
/**
 * Adapter-private lossless-JSON state for replaying a successful response,
 * carried by a terminal `finish` chunk and stored on the assembled assistant
 * message's model source. Both halves stay opaque to the harness; only the
 * split is shared vocabulary, so assembly can keep stored metadata aligned
 * with stored content without reading either half.
 */
interface ReplayEnvelope {
  /** Response-level adapter-private metadata (ids, native stop reason). */
  response: unknown
  /**
   * Per-block adapter-private metadata, one entry per emitted block in
   * first-seen stream order. When assembly drops a block it drops the entry at
   * the same position; entries whose length does not match the emitted block
   * count discard the whole envelope. An adapter whose metadata is independent
   * of block structure omits this field and the envelope passes through
   * assembly unchanged.
   */
  blocks?: readonly unknown[]
}
```

```ts type-equiv
/**
 * Raw streaming protocol emitted by adapters.
 * Block indexes correlate interleaved deltas, and `block-end` carries the
 * assembled block. Adapters emit usage before the terminal finish and nothing
 * afterward; tool arguments remain raw JSON strings. An adapter implementation
 * may throw, but `LlmRuntime.stream()` normalizes that failure to a terminal
 * `error` or `aborted` finish before exposing it to consumers.
 */
type StreamChunk =
  | { type: 'block-start'; index: number; blockType: ContentBlockType }
  | { type: 'text-delta'; index: number; text: string }
  | { type: 'reasoning-delta'; index: number; text: string }
  | { type: 'tool-call-delta'; index: number; id: ToolCallId; name?: string; argumentsDelta: string }
  | { type: 'block-end'; index: number; block: ContentBlock }
  | { type: 'usage'; usage: TokenUsage }
  | {
    type: 'finish'
    reason: FinishReason
    /** Replay metadata for a successful response; see {@link ReplayEnvelope}. */
    replayState?: ReplayEnvelope
  }
```

<a id="compact-assistant-streams"></a>

## コンパクトなアシスタントストリーム

`AssistantStreamAccumulator` は各 `StreamChunk` を元の safe-integer タイムスタンプと対にし、`AssistantStreamRecord[]` を生成する。同一ブロック向けの連続するテキスト・推論・ツール引数差分は、`time0`、正確なタイムスタンプ間隔、元の差分ごとの配列 1 エントリーを持つ 1 レコードになる; その他のチャンクはタイムスタンプ付きの生レコードのまま残る。この表現は、トークン境界の結合や終端・使用量・ブロック・失敗・リプレイの事実の欠落なしに、繰り返されるイベントエンベロープを取り除く。

`snapshot()` は切り離された不変ストリームを返す。`expandAssistantStream()` は、正確な時刻付きチャンク列を再現する前に、レコードキー、メンバー数、インデックス、タイムスタンプ、ツール呼び出し同一性、ロスレス JSON を厳密に検査する。Session ログは、表面結果向けには `assistant/message` に、表面メッセージのない試行向けには `assistant/attempt` にこのストリームを埋め込む。

プロセス局所の `agent/assistant-stream` フレームがライブ表示を運ぶ。永続化リプレイと復元検証は埋め込まれた確定物を依然として展開する; テレメトリー、トークン会計、Host フォールドはコンパクトなレコードを直接読む。レコード単位のリーダー (`assistantStreamFirstTokenTime`、`assistantStreamHasVisibleContent`、`assistantStreamHasVisibleText`、`lastAssistantStreamChunk`、`assistantStreamChunks`、`joinAssistantStreamText`、`assembleAssistantStream`、およびランごとの `runFirstTokenTime` と `runFirstVisibleTime`) は、早期終了付きでレコード上を一走査してコンシューマーの問いに答えるため、大きな履歴は確定物ごとに O(メンバー) 展開ではなく O(レコード) で済む ([フォールド参照](../../packages/llm/llm/README.md))。`expandAssistantStream()` は、永続化境界で読まれるレコードと全メンバーを必要とするコンシューマー向けの検証経路であり続ける。

## `LlmFailure`

throw された失敗もインバンドの最終アダプター失敗も、1 つの直列化可能なプロバイダー中立ペイロードに正規化される。`providerRetryAfterMs` はプロバイダーが要求した検証済みの正の遅延であり、再試行決定ではない; `ProviderRequestId` は診断用の不透明なブランド付き文字列である。

```ts type-equiv
/** Serializable provider or transport failure facts; policy decides whether they are retryable. */
interface LlmFailure {
  /** Human-readable provider or transport failure. */
  readonly message: string
  /** Stable provider-neutral machine-routing code. */
  readonly code: string
  /** HTTP status returned by the provider, when available. */
  readonly status?: number
  /** Provider-requested delay in milliseconds, when valid and available. */
  readonly providerRetryAfterMs?: number
  /** Opaque provider-issued request identifier for diagnostics. */
  readonly requestId?: ProviderRequestId
  /**
   * With code `IMAGE_OFFLOAD_REQUIRED`: how many more of the oldest retained
   * image occurrences the route needs offloaded before the same request fits
   * its exact byte accounting. `dsh-compaction-image-offload` records the
   * selected occurrences in an `image/offload` event and retries the step.
   */
  readonly offloadImages?: number
}
```

## リクエスト画像の価格付け

リクエスト画像に視覚トークンを課金するプロバイダーのアダプターは、`LlmAdapter.imageRequestPricing` をオーバーライドしてルートごとの価格付けを宣言し、`ctx.llm.imageRequestPricing(provider, model)` がコンシューマー向けにそれを同期的に解決する。トークンメーターは測定ごとにルーティング済みモデルの価格付けを解決するため、コンパクション圧力、保持、範囲選択は、ルーティング済みリクエストが実際に送る通りに画像履歴へ価格を付ける; DeepSeek アダプターは、保持された各出現をモデルごとのリクエストターゲットで公開 vision 会計により価格付けし、ログ済み画像オフロード決定で選ばれた各出現をそのプレースホルダーテキストとして価格付けする一方、完了済みリクエストについてはプロバイダー使用量が権威ある基準であり続ける。

```ts type-equiv
/**
 * Request price of one ordered image occurrence under one exact model route's
 * request projection. Every occurrence resolves to the pair the wire actually
 * carries: provider visual tokens for a retained image, plus the model-visible
 * text sent with or instead of it (request-preview handle, offload placeholder,
 * or text-only substitution). The caller prices `text` with its own text
 * estimator so provider pricing never fixes a text tokenization.
 */
interface LlmImageRequestPrice {
  /** Provider visual tokens for the retained request image; 0 when only text represents this occurrence. */
  visualTokens: number
  /** Model-visible text sent for this occurrence, to be priced by the caller's text estimator. */
  text: string
}
```

```ts type-equiv
/**
 * Provider-side request-image pricing for one exact model route. Implemented
 * by adapters whose provider charges visual tokens; consumers (the token
 * meter) resolve it synchronously per measurement, so implementations must not
 * perform I/O.
 */
interface LlmImageRequestPricing {
  /**
   * Price every image occurrence of one request projection.
   * @param images - surface image blocks in request order, one entry per occurrence; an `offloaded` block
   *   is priced as its placeholder text.
   * @returns one price per occurrence, aligned by index with `images`.
   */
  priceImages(images: readonly ImageBlock[]): readonly LlmImageRequestPrice[]
}
```

## アダプターコントラクト

すべてのアダプターは以下に従わなければならず (MUST)、すべてのコンシューマーはそれらに依存できる:

- **`usage` は `finish` の前に、`finish` の後には何もない。** 両方をプロバイダーのストリーム終端マーカーまで遅延させるため、末尾の使用量のみのチャンクが順序を壊すことはない。
- **ツール呼び出しの `arguments` は端から端まで生 JSON 文字列のまま。** 部分断片は `argumentsDelta` でストリーミングする; 解析済みオブジェクトを返すプロバイダーは `block-end` で再文字列化する。
- **公認のエラー経路は 2 つ、1 つの `LlmFailure` 型。** 失敗は `stream()` から THROW するか (輸送/プロトコルエラー)、`finish {kind:'error'|'aborted', failure}` でストリームを終えるか (ストリーム途中で throw できないアダプター向けのプロバイダーインバンドエラー) のいずれかである。`LlmError.failure` は同じ `LlmFailure` を運ぶ。呼び出しがアダプターを選択した後、ストリームは throw された正確な `Error` オブジェクトを保持し、不変の事実と提供側登録の不変な再試行ポリシーをその呼び出しに関連付ける; エージェントループは試行ストリームを `assistant/attempt` としてコミットし、失敗したステップを閉じ、エラー、事実、不変の過去再試行事実、提供ポリシー、ターン信号を `agent/request-error` に提供する。処理リスナーは待機した修復の後に `{ kind: 'retry' }` を返す; 回復がなければ構造化失敗がターンエラーとなり、その試行では表面アシスタントメッセージもツール副作用もコミットされない。
- **1 アダプター呼び出しは 1 プロバイダー試行。** アダプターはライブラリー再試行を無効化する。エージェント単位の回復は別の永続化番号付きターンを開く; 直接の `ctx.llm.stream()` 呼び出し元は単一試行のままである。
- **プロバイダーの停滞は輸送層で有界である。** 出荷される両リモートアダプターは正の有限な `streamIdleTimeoutMs` を 5 分既定で公開する。ウォッチドッグはイテレーター `next()` が未解決の間のみ作動し、リクエスト全体で 1 つの安定した信号を使い、自身の期限切れを `TIMEOUT` に写像し、より早い呼び出し元中止を `ABORTED` として保持する。
- **コンテキスト溢れは 1 つの正準コードを持つ。** 両 DeepSeek アダプターは明示的なプロバイダー詳細を `isContextWindowExceededError()` で分類し、throw された HTTP `LlmError` としての到着かインバンド終了エラーかにかかわらず `CONTEXT_WINDOW_EXCEEDED` を表出する。コンシューマーはプロバイダーテキストではなくコードで振り分ける。
- **空の補完は再試行可能なエラーであり、無言の成功ではない。** 両アダプターは、コンテンツブロックを運ばなかった終端 `stop` 終了を、正準 `EMPTY_RESPONSE` コード付きの `finish {kind:'error'}` へ写像し、`dsh-llm-retry` は既定でそれを再試行する。
- **すべてのプロバイダー HTTP リクエストはアプリ帰属ヘッダーを運ぶ。** アダプターは `attributionHeaders()` (下記) — `User-Agent` 基準 — を送り、ワイヤーレベルのテストでそれを証明する。
- **リプレイ状態はアダプター所有であり、その分割は共有である。** 成功した `finish` は `ReplayEnvelope` を運んでもよい: 不透明な応答単位メタデータと任意のブロック単位エントリーであり、送出ブロック列と整列する。整列はハーネスのボキャブラリーである — 組み立てがブロックを落とすとき同じ位置のエントリーも落とすため、格納メタデータは常に格納コンテンツを記述する。ループは枝刈り済みエンベロープを組み立て済みアシスタントメッセージとともに格納する。後のリクエストでは、`LlmRuntime` は履歴プロバイダーと対象プロバイダーが現在まったく同じアダプターインスタンスに登録されている場合にのみ状態を渡す。そのアダプターは状態を検証し、モデル間・プロバイダー間変換を所有する; 他のアダプターはプロバイダー/モデルフィールド付きのプロバイダー中立コンテンツを受け取り、プライベート状態は受け取らない。永続化コンテンツが権威であり続ける: 読み取り側アダプターが使えない格納状態は、その 1 メッセージを診断付きでプロバイダー中立変換へ降格させるのであり、リクエストを失敗させない。

## `ResolvedRetryPolicy`

再試行設定はルート登録の前に不変の判別共用体へ解決される。通常モードは `mode: 'normal'`、有限の `maxRetries`、`retryableCodes`、必須の `initialDelayMs`、`maxDelayMs`、`jitterRatio` を運び、常時モードは `mode: 'always'` と同じ必須バックオフフィールドを有限上限なしに運ぶ。プロバイダーポリシーの省略は 5 回再試行の通常既定を使う。層状設定は常時モード切替後に通常専用の `maxRetries` や `retryableCodes` を残すことがある; リゾルバーはそれら非活性フィールドを無視し、純粋な常時ポリシーを捕捉する。`LlmRuntime.providerRetryPolicy(provider)` は登録値を返し、`llmRetryPolicyOf(stream)` は呼び出しが提供登録を選択した後に捕捉された値を返すため、後のルート破棄や置換が進行中の失敗の回復ポリシーを変えることはない。任意入力フィールドの一覧は[生成設定カタログ](../config-catalog.md)にある。

## `AppIdentity` — アプリ帰属

すべてのアダプターがプロバイダーへ送る静的な公開アプリケーション同一性 ([`packages/llm/llm/src/attribution.ts`](../../packages/llm/llm/src/attribution.ts))。`attributionHeaders(identity?)` はそれを標準 `User-Agent` ヘッダーのみに写像する; OpenRouter 固有のアプリ帰属ヘッダーはこのコントラクトでは意図的にサポートされない。既定の `APP_IDENTITY` はパッケージマニフェストからバージョンを取得する; すべてのフィールドは公開プロダクト事実であり — シークレット、パス、セッション id、ユーザーごとの識別子はなく、リクエストごとの何ものも値を左右してはならない。

```ts type-equiv
/**
 * Static public application identity sent to LLM providers.
 *
 * Every field is a public product fact, safe on every request: no secrets,
 * local paths, session ids, prompt text, or per-user identifiers belong here,
 * and nothing per-request may influence the values.
 */
interface AppIdentity {
  /** `User-Agent` product token (lowercase, hyphenated). */
  product: string
  /** Product version; sourced from package metadata, never hand-copied. */
  version: string
  /** Repository home URL of the app, used as the `User-Agent` comment. */
  url: string
}
```

## `TokenUsage`

呼び出しごとのトークン会計。カウントは**互いに素**である: `inputTokens` は非キャッシュ入力のみであり、キャッシュ入力は別途報告され、課金入力は 3 者の合計である。キャッシュヒットを単一プロンプト合計に畳み込むプロバイダー (DeepSeek の `prompt_tokens`) のアダプターはそれらを差し戻して引く。任意の `totalTokens` は、プロバイダーから保持されたか権威ある集計カウンターから再構成された、プロンプト+出力の正確な集計カウントであり、利用不可または不整合の場合はアダプターが省略する。`reasoningTokens` は存在する場合、すでに出力トークンに含まれる参考詳細であり、合計に再加算してはならない。

```ts type-equiv
/**
 * Token accounting for one model call (cache fields are optional).
 *
 * Counts are DISJOINT: `inputTokens` is uncached input only; cached input is
 * reported separately as `cacheReadTokens`/`cacheWriteTokens` (billed input =
 * sum of the three). Adapters whose providers fold cache hits into a total
 * prompt count (DeepSeek's `prompt_tokens`) subtract them out.
 */
interface TokenUsage {
  inputTokens: number
  outputTokens: number
  /**
   * Exact full-call total including aggregate prompt and output tokens.
   *
   * Adapters preserve a provider total or derive it from authoritative
   * aggregate prompt/output counters; they omit it when unavailable or
   * inconsistent.
   */
  totalTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}
```

## `BlockAssembler`

`BlockAssembler` ([`packages/llm/llm/src/assembler.ts`](../../packages/llm/llm/src/assembler.ts)) は、`StreamChunk` ストリームを `ContentBlock` 群、使用量、終了理由、リプレイ状態へ折り畳む単一の共有実装である。ループは生チャンクをログに記録しながら同じチャンクをアセンブラーに流し、組み立て済みアシスタントコンテンツをそれを生成したプロバイダーとモデルとともに格納する。折り畳みを再実装せずに組み立て結果を必要とするコンシューマーはこれを使う。

1 つの保持/破棄決定がコンテンツとメタデータの両方を覆う: `max-tokens` 終了は切り詰められた呼び出しの実行が安全でないためすべてのツール呼び出しを落とし、同じ決定がリプレイエンベロープのブロック単位エントリーを落とした各位置で枝刈りする。したがって組み立てが何を除去しても `blocks()` と `replayState` は矛盾し得ない。

```ts public-api
/**
 * Incrementally assembles raw {@link StreamChunk}s into complete
 * {@link ContentBlock}s and a final assistant {@link Message}.
 *
 * The agent loop feeds it while logging raw chunks for replay fidelity, then
 * reads `blocks()` / `message()` / `usage` / `finish` once the stream ends,
 * or `interruptedBlocks()` when cancellation cut the stream short.
 *
 * Tolerant of delta-only protocols (no block-start/end); deltas arriving for
 * an index already closed by `block-end` are ignored (malformed stream) so a
 * misbehaving adapter cannot grow memory or corrupt a completed block.
 */
declare class BlockAssembler {
  /**
   * Feed one chunk into the assembly state.
   * @param chunk - the next raw chunk, in stream order.
   */
  push(chunk: StreamChunk): void;
  /**
   * Assemble all blocks seen so far, in stream order.
   * @returns one block per seen index, except that max-token truncation drops
   *   tool calls that cannot be executed safely; an open block assembles from
   *   its accumulated deltas (an unknown block type never closed by `block-end` throws).
   */
  blocks(): ContentBlock[];
  /**
   * Assemble the prefix an interrupted stream can safely finalize: closed and
   * open text/reasoning blocks with non-whitespace content, in stream order.
   * Tool calls are omitted because interruption precedes dispatch; retaining
   * one would require a fabricated result. Open unknown blocks are also omitted.
   * @returns the kept blocks; empty when nothing streamed before the interruption.
   */
  interruptedBlocks(): ContentBlock[];
  /** Usage from the `usage` chunk; undefined until one arrives. */
  get usage(): TokenUsage | undefined;
  /** Finish reason from the `finish` chunk; `{kind: 'stop'}` when the stream ended without one. */
  get finish(): FinishReason;
  /**
   * Replay metadata from the terminal finish chunk, if any, with per-block
   * entries pruned in step with {@link blocks}. Undefined when the envelope's
   * entries do not align with the emitted blocks.
   */
  get replayState(): ReplayEnvelope | undefined;
  /**
   * The assembled assistant message.
   * @param source - provider/model attribution (without the `kind` tag) for the assembled message.
   * @returns a frozen assistant-role message over `blocks()` (same open-block assembly rules).
   */
  message(source: Omit<ModelMessageSource, 'kind'>): AssistantMessage;
}
```

<a id="the-model-request-and-result"></a>

## モデルリクエスト

1 モデル呼び出しは完全に組み立てられた `GenerateOptions` である。アダプターは生の [`StreamChunk`](#streamchunk--the-raw-protocol) ストリームで答え、コンシューマーは [`BlockAssembler`](#blockassembler) でそれを組み立てる。

Source: [`packages/llm/llm/src/types.ts`](../../packages/llm/llm/src/types.ts)

プロバイダーとモデルの発見は小さなプロバイダー中立記述子を使う。モデルカタログは助言的である: ルーティングは依然として登録済みプロバイダーをキーとする。

アダプターの登録はハンドルを返す: ディスポーザーと、ルート集合がユーザー設定可能なプラグインが必要とする不可分なルート置換である。

```ts type-equiv
/**
 * What {@link LlmRuntime.registerAdapter} returns: the disposer, plus an
 * atomic route replacement for the same adapter instance.
 */
interface AdapterRegistrationHandle {
  /** Release every route this registration currently holds. */
  (): void
  /**
   * Replace this registration's routes with `providers`, keeping the same
   * adapter instance. The candidate set is validated in full first — a
   * conflict with another adapter, an invalid name, or bad provider metadata
   * throws and leaves the current routes untouched — and the swap itself is
   * one synchronous section, so no request can observe a gap. An empty array
   * is legal here (a settings section that emptied holds zero routes while
   * staying registered), unlike an empty initial registration.
   *
   * Throws `LlmError` with code `REGISTRATION_DISPOSED` once the registration
   * has been released: its routes are gone and its disposer has already run,
   * so anything registered afterwards would have no owner left to release it.
   * @param providers - the complete next route set for this registration.
   */
  replace(providers: string[]): void
}
```

```ts type-equiv
/** Display metadata for one registered provider route. */
interface LlmProviderInfo {
  /** Provider route key used by {@link GenerateOptions.provider}. */
  id: string
  /** Human-readable provider name for selectors and diagnostics. */
  name: string
}
```

アダプタープラグインはさらに、`registerConfigurableProviders()` を通じて動作*し得る*ルートを宣言し、各々のユーザー設定セクションを指し示すため、設定サーフェスはルート登録前に休止プロバイダーを提供できる。

```ts type-equiv
/**
 * One provider route an adapter plugin can activate through configuration,
 * whether or not the route is currently registered. Configuration surfaces
 * merge this directory with `listProviders()` to offer every configurable
 * provider alongside its live/dormant state.
 */
interface LlmConfigurableProvider {
  /** Provider route key this entry activates when configured. */
  provider: string
  /** Human-readable provider name for configuration surfaces. */
  displayName: string
  /** User-settings namespace whose section configures this provider. */
  settingsNs: string
  /**
   * Path from that namespace's section root to this provider's profile
   * object; empty when the whole section is the profile.
   */
  settingsPath: readonly string[]
  /**
   * Whether the owning adapter knows this route only because configuration
   * declared it — a gateway or self-hosted server it ships nothing about.
   * Absent means the adapter draws no such distinction; false means it does
   * and this route is one of its own. Only the adapter can answer: a stored
   * profile is how a user-added route AND a corrected shipped one both look
   * from outside.
   */
  declared?: boolean
  /**
   * Route endpoint the adapter uses when the profile sets no `baseURL`; the
   * adapter may still send an individual model to that model's own endpoint.
   * Absent when the route has no fixed endpoint.
   */
  defaultBaseURL?: string
  /** Environment variables used to construct a provider endpoint; absent when none are reported. */
  baseURLEnv?: readonly string[]
  /** Authentication the adapter performs when the profile names no credential reference; absent when it reports none. */
  nativeAuth?: LlmNativeAuth
  /** Configuration diagnostic for repair; unaffected models may remain serviceable. */
  error?: string
}
```

設定エディターは、エンドポイントや資格情報参照を未設定のままにするプロファイル向けに `defaultBaseURL`、`baseURLEnv` 由来のエンドポイント設定変数、`nativeAuth` を表示する。両変数一覧は名前のみを含み、値を決して含まない。

```ts type-equiv
/** Authentication a provider route performs without a credential reference in its profile. */
interface LlmNativeAuth {
  /** Environment variables the route's authentication reads, in lookup order; empty when it reads none. */
  env: readonly string[]
  /** Whether a stored OAuth sign-in can authenticate the route. */
  oauth: boolean
}
```

```ts type-equiv
/** One adapter-discovered model; catalog membership is advisory, not request validation. */
interface LlmModelInfo {
  /** Provider route that owns this model entry. */
  provider: string
  /** Model id passed to {@link GenerateOptions.model}. */
  id: string
  /** Human-readable model name for selectors. */
  name: string
  /** Optional user-facing distinction from otherwise similar models. */
  description?: string
  /** Accepted request modalities; absent means unknown, while an explicit omission is negative capability. */
  inputModalities?: readonly ModelModality[]
}
```

正確性に敏感なメタデータは助言的カタログとは別に解決され、正確なルートを提供するアダプターが所有する。コンテキスト容量、アダプター呼び出し既定、推論選択肢、システムプロンプト更新モードは 1 つの正確モデル結果を共有するため、コンシューマーは権威あるモデル解決を繰り返さない。`SystemPromptUpdate` は単一値 `'in-history'` を持つ: モデルは `messages` 内の任意位置の最新の `system` メッセージを完全な有効システムプロンプトとして読むため、エージェントループはメッセージ 0 を書き換える代わりにキャッシュ済み履歴の後に変更プロンプトを追記できる ([決定規則](../../packages/core/agent-loop/README.md#understand-the-implementation)); モード欠落は先頭システムメッセージのみが読まれることを意味し、`normalizeModelInfo` は他の値を `INVALID_MODEL_INFO` で拒否する。

```ts type-equiv
/** Provider-owned context capacity for one exact provider/model route. */
interface LlmModelContext {
  /** Maximum combined request and response context in tokens. */
  contextWindow: number
}
```

推論エフォートは別の正確ルートケイパビリティである。コアは識別子にブランドを付けるが値を列挙しない; 各アダプターがエフォート昇順の選択肢、表示名、任意のデプロイ既定を所有する。順序付けは、予測トークン使用量・コスト・遅延ではなく、選択可能なコントロールを比較する。

```ts type-equiv
/** Adapter-owned identifier for one model's selectable reasoning effort. */
type ReasoningEffortId = Branded<'ReasoningEffortId'>
```

```ts type-equiv
/** Display metadata for one adapter-owned reasoning effort. */
interface LlmReasoningEffortInfo {
  /** Opaque stable value accepted by {@link GenerateOptions.reasoningEffort}. */
  id: ReasoningEffortId
  /** Human-readable effort name for selectors and diagnostics. */
  name: string
  /** Optional user-facing distinction from otherwise similar efforts. */
  description?: string
}
```

```ts type-equiv
/** Selectable reasoning efforts for one exact provider/model route. */
interface LlmModelReasoningInfo {
  /** Supported efforts from least to greatest selectable reasoning effort, not predicted token use or latency. */
  efforts: readonly LlmReasoningEffortInfo[]
  /**
   * Adapter-configured default materialized into requests when callers omit
   * an effort. Absence preserves the provider's own default.
   */
  defaultEffort?: ReasoningEffortId
}
```

```ts type-equiv
/** Exact-route model metadata resolved by its owning adapter. */
interface LlmResolvedModelInfo extends LlmModelInfo {
  /** Provider-owned context capacity when known. */
  context?: LlmModelContext
  /** Adapter-configured per-request output cap materialized when callers omit one. */
  defaultMaxTokens?: number
  /** Adapter-owned selectable reasoning levels when exposed. */
  reasoning?: LlmModelReasoningInfo
  /** Declared mid-conversation system prompt handling; absent means only a leading system message is read. */
  systemPromptUpdate?: SystemPromptUpdate
  /** Declared mid-conversation tool declaration handling; absent means every request declares the complete tool list. */
  toolUpdate?: ToolUpdate
}
```

補助呼び出し元は、永続化同一性やソースなしにユーザーコンテンツを提供できる。既存の `Message[]` 履歴は依然として有効なリクエスト入力である。Session 書き込み、Agent 配送、記録済みタイトル要求は引き続き永続化メッセージを要求する。

```ts type-equiv
/** User input for one LLM request; it has no durable Session identity or source. */
interface RequestUserInput {
  readonly role: 'user'
  readonly content: UserMessage['content']
  readonly id?: never
  readonly source?: never
}
```

```ts type-equiv
/** A durable conversation message or a user input used only for one request. */
type RequestMessage = Message | RequestUserInput
```

```ts type-equiv
/** A single model request, fully assembled. */
interface GenerateOptions {
  /** Registered provider route selecting the adapter instance. */
  provider: string
  model: string
  /** Adapter-owned reasoning effort selected for this exact model. */
  reasoningEffort?: ReasoningEffortId
  /**
   * Ordered conversation messages, exactly as the provider sees them. A
   * loop-built request passes the derived history (dsh-agent-loop), whose
   * leading system-role message carries the system prompt; a hand-built
   * one-shot may include identity-free user inputs.
   */
  messages: RequestMessage[]
  /**
   * System prompt text for one-shot callers; adapters map it to the provider's
   * system slot ahead of `messages`. Loop-built requests leave it undefined.
   */
  system?: string
  /** Tool schemas (adapters map to the provider's `tools` field). */
  tools?: ToolSchema[]
  /** Session-folded tool history used for route projection; omission sends complete declarations without tool updates. */
  toolHistory?: ToolHistory
  temperature?: number
  maxTokens?: number
  /**
   * Stop sequences: generation halts as soon as the model produces any one of
   * these strings (adapters map to the provider's stop field, e.g. OpenAI
   * `stop`). The stop string itself is not included in the output.
   */
  stop?: string[]
  signal?: AbortSignal
  /**
   * Session identity stamped by the loop for request routing. Replay uses it
   * to separate cursors; adapters may map it to model-hidden transport metadata.
   */
  sessionId?: Branded<'SessionId'>
  /**
   * Provider-neutral classification for an auxiliary model call. Adapters may
   * map the purpose to model-hidden transport metadata. Ordinary conversation
   * requests leave it unset.
   */
  purpose?: 'compaction' | 'session-title'
}
```

モデル応答が停止した理由はマージ拡張可能な理由である。終端プロバイダー失敗はストリーミングコントラクトの [`LlmFailure`](#llmfailure) を運ぶ:

```ts type-equiv
/**
 * Why a model response stopped.
 * Merge-extensible so adapters can surface provider-specific reasons.
 */
interface FinishReasonMap {
  'stop': { kind: 'stop' }
  'tool-calls': { kind: 'tool-calls' }
  'max-tokens': { kind: 'max-tokens' }
  'aborted': { kind: 'aborted'; failure: LlmFailure }
  'error': { kind: 'error'; failure: LlmFailure }
}
```

`FinishReason = FinishReasonMap[keyof FinishReasonMap]`。`TokenUsage` (互いに素なキャッシュフィールドを持つ呼び出しごとの会計) の詳細は[下記](#tokenusage)。

`GenerateOptions.tools` は `ToolSchema` を運ぶ — モデルへ送られる通りのツールの JSON スキーマ記述である。それがループが毎ステップ組み立てるリクエストの一部であるまさにその理由で、dsh-tools ではなく dsh-llm で宣言されている:

```ts type-equiv
/**
 * JSON-schema description of a tool, as sent to the model.
 *
 * Declared here (not in dsh-tools) because it is part of {@link GenerateOptions};
 * dsh-tools' ToolDefinition and dsh-system-prompt's PromptAssembly both import
 * it from this package.
 */
interface ToolSchema {
  /**
   * Requests deferred loading of the tool definition into model context,
   * independently of whether a tool-addition block records the tool.
   * Uses Anthropic's defer_loading terminology.
   */
  deferLoading?: true
  name: string
  description: string
  /** JSON Schema object for the arguments. */
  parameters: Record<string, unknown>
}
```

モデル向け `ToolSchema` はワイヤー型である; それを生成する登録済み `ToolDefinition` (スキーマ + `execute`) は [tools.md](tools.md) にある。

サーフェスがまだ下書き中のプロバイダーにはルートもカタログもないため、問い合わせは別に記述される: リクエストはユーザーが編集中の下書きを運び、返答は提供しなければならないカタログではなくサーフェスが採用し得る候補である。

```ts type-equiv
/**
 * One interrogation of a provider endpoint that configuration has not stored
 * yet. Configuration surfaces send the draft a user is still editing, so the
 * request carries the endpoint and credential directly instead of naming a
 * route: a provider being added has no route to name.
 */
interface LlmModelDiscoveryRequest {
  /**
   * Route the draft is editing, when it edits an existing one. A route whose
   * adapter already knows its models answers from that knowledge instead of
   * asking the endpoint — the adapter's own registry is the better answer, and
   * it costs no network call.
   */
  provider?: string
  /**
   * Endpoint to interrogate. Optional because a route the adapter already
   * describes needs none; a route it does not must supply one.
   */
  baseURL?: string
  /** Wire protocol the endpoint speaks, when the draft names one. */
  api?: string
  /** Credential for this interrogation alone; the harness never stores it. */
  apiKey?: string
}
```

```ts type-equiv
/**
 * One model an endpoint reports about itself. Every field but the id is
 * optional because most provider listings disclose an id and nothing else;
 * a surface adopting one of these still owes the capacities its adapter needs.
 */
interface LlmDiscoveredModel {
  /** Model id the endpoint accepts. */
  id: string
  /** Human-readable name when the endpoint supplies one. */
  name?: string
  /** Maximum combined request and response context, when disclosed. */
  contextWindow?: number
  /** Maximum output tokens, when disclosed. */
  maxTokens?: number
  /** Accepted input types when disclosed by the catalog or endpoint; absent means unknown. */
  inputModalities?: readonly ModelModality[]
}
```

### リクエストエンベロープ: `LlmCallConfig` とログ済みヘッダー

ループはログ済み状態から各リクエストを構築する。`EpochHeader` は呼び出し設定を記録し、アダプター既定が提供したフィールドを印付けし、完全な `request/header` スナップショットを通じて権威ある返却ツール順序 (`toolOrder` で設定され、未設定時は辞書式) を記録する。描画済みプロンプトは導出履歴である — 表面ノード 0 の `system/message` と、`in-history` ルートが追記した後のシステムノード — ので、ヘッダーと導出履歴の組み合わせがリクエストをセッションログから再構成可能にする。[session.md](session.md#the-request-header-event-requestheader) と[再構成可能性 Agent Note](../../.agents/notes/implemented/architecture/2026-07-05-reconstructable-requests.md)を参照。

`agent/request` は凍結された呼び出し設定シードを受け取り、プロバイダー、モデル、推論エフォート、サンプリングを切り替える置換を返してもよい。ウォーターフォール前に、ループはアダプター既定として印付けされた値を取り除くため、正確モデル準備が選択ルートの現在値を実体化する; 印のない明示設定は提案に残る。ウォーターフォール後に、準備はサポートされない明示エフォート id をクランプなしに拒否し、ターン信号の下で有効設定とアダプター既定が提供したフィールドをログに記録する。ステップ受理時、このウォーターフォールと準備は組み立てと `step/start` の後、システムプロンプトと受理済みユーザーバッチのコミット前に実行する; いずれかの間のキャンセルはいずれもコミットしない。準備済みケイパビリティがプロンプト照合を統治し、呼び出しはディスパッチを通じて 1 つのアダプター登録を保持する。`llm/stream` に届くリクエストは deep-frozen であり変更は throw し、プロセス局所のループ同一性を運ぶため、観測者は別にログ記録された凍結補助呼び出しと会話リクエストを混同しない。

ワイヤー上では、ループ構築リクエストは導出履歴のみである: 描画済みプロンプトは先頭の `system` ロールメッセージ (表面ノード 0、`system/message` イベント) として運ばれ、準備済み呼び出しが `systemPromptUpdate: 'in-history'` を宣言する場合、空でない変更プロンプトがキャッシュ済み履歴の後に後の `system` ロールメッセージとして続き、モデルはそれを有効プロンプトとして読む; リクエストの `system` フィールドは未設定である — `GenerateOptions.system` はタイトルプロバイダーなどの直接ワンショット呼び出し元用である。空の描画は、以前のリクエストが複数のプロンプト版を保持していた場合でも、導出履歴にシステムメッセージを残さない。ログ済みリクエストは、ターンの最初のステップでは最新の `user/message` で終わり、後のステップでは前ステップのツール結果で終わる。

FIXME(call-config-shape): revisit which remaining fields are genuinely epoch-level for cache purposes (`model` and the model-owned reasoning effort are explicit; the sampling scalars sit here out of caution).

```ts type-equiv
/** Concrete generation settings; omitted controls use the selected route's defaults. */
interface LlmCallControls {
  reasoningEffort?: ReasoningEffortId
  temperature?: number
  maxTokens?: number
  stop?: string[]
}
```

```ts type-equiv
/**
 * Provider, model, reasoning effort, and sampling scalars of one conversation's
 * requests. Every field maps 1:1 onto the same-named `GenerateOptions` field;
 * the loop builds requests from the logged header rather than accepting these
 * per call.
 */
interface LlmCallConfig extends LlmCallControls {
  provider: string
  model: string
}
```

```ts type-equiv
/**
 * Synchronous, pure configuration of one call before defaults and validation.
 * Compose functions in the desired order; later writes replace earlier ones.
 * The returned controls cannot change the captured route. Errors reject
 * preparation before dispatch; only the resolved configuration is recordable.
 * @param controls - detached, deeply frozen proposed controls, without defaults.
 * @param model - detached, deeply frozen metadata from the captured adapter generation.
 * @returns concrete controls; omitted fields receive the route's defaults.
 */
type ConfigureCall = (
  controls: Readonly<LlmCallControls>,
  model: Readonly<LlmResolvedModelInfo>,
) => LlmCallControls
```

```ts type-equiv
/**
 * Effective config fields supplied by exact-model adapter resolution rather
 * than by the caller's request proposal.
 */
interface LlmCallConfigAdapterDefaults {
  reasoningEffort?: true
  maxTokens?: true
}
```

## 公式 DeepSeek リクエスト拡張

`ctx.deepseekLlmApiExtensions` は `deepseek-official` リクエスト上の追加トップレベルフィールド向けのプロバイダー固有レジストリーである。コントリビュータープラグインは `register(field, provider)` で 1 フィールドを要求する; アダプターは基本ボディの直列化後に `prepare(request)` を呼び、HTTP 前に返却フィールドをマージする。準備済み `accept()` トランザクションは 2xx 後に実行されるため、コントリビューターは輸送・プロバイダー拒否を受け入れとして扱わずに配送状態をコミットできる。準備が throw するコントリビューターはログ記録されて当該リクエストから省かれ、受け入れ失敗はリクエストを失敗させずにログ記録される; 基本フィールド衝突は `REQUEST_EXTENSION` を使いモデルリクエストを失敗させる。直列化に失敗したマージ済みボディは拡張フィールドなしで送られ、受け入れはスキップされてプロバイダープラグインが省かれたフィールド名をログに記録する。

[ワイヤー参照](../deepseek-llm-api-wire-extensions.md)は正確なリクエストヘッダー、拡張トランザクション、フィールドバージョン、受信者義務を定義する。出荷コンポジションは、ロスレス増分正準ログ接尾辞として [`dsh_session_log`](../../packages/session/session-log-deepseek/README.md) を、完全な有効 Loader-backed パッケージ集合として [`dsh_plugin_packages`](../../packages/llm/plugin-package-inventory-deepseek/README.md) を登録する。これらのフィールドはモデルメッセージの外に留まり、pi-ai アダプター経路には存在しない。

## サービスとプロバイダーコントラクト

`LlmAdapter` はプロバイダーコントラクトである: サブクラス化し、`stream()` を実装し、1 アダプターインスタンスを `ctx.llm.registerAdapter(providers, adapter)` で登録する。`GenerateOptions.provider` が登録済みアダプターを選択し、`GenerateOptions.model` はそのアダプターへ渡されライフサイクル開始時に登録されている必要はない。重複プロバイダールートは不可分に失敗する。任意の `providerRetryPolicy()` は通常既定付きでルートごとに捕捉され、`providerInfo()` と非同期 `listModels()` は切り離されたセレクターメタデータで `LlmRuntime.listProviders()` / `listModels()` に供給する。そのカタログはリクエストホワイトリストではなく助言的である: アダプターは権威であり続け、未掲載モデル id を受け入れてもよい。1 回の非同期 `resolveModel()` 照会は、正確なモデル同一性と任意の正確性敏感なコンテキスト容量、アダプター設定の `defaultMaxTokens`、任意のデプロイ既定付きの順序付きモデル所有推論 id を返す; フィールド欠落は無効なカタログ所属ではなく利用不可メタデータまたはプロバイダー所有動作を意味する。リゾルバーは任意のキャンセルを受け取り、中止後に速やかに確定しなければならない。`LlmRuntime.resolveModelInfo()` は集約を検証して切り離す。最終アダプター境界では、`resolveCallConfig()` は `maxTokens` 欠落時のみ出力既定を実体化し、推論を検証・実体化するため、直接呼び出しはいずれの設定済み動作も迂回できない; 直接ディスパッチは当該解決の待機前に 1 登録を捕捉する。エージェントループは代わりに `prepareCall()` を使い、モデル解決・永続化ヘッダーログ・ディスパッチを通じて同じ登録を保ち、当該照会由来の切り離されたコンテキストメタデータを保持し、どの設定フィールドをアダプターが既定化したかを報告する。アダプター照会は `llm/stream` ウォーターフォールの終端継続で起こるため、リスナーは照会前に呼び出しを短絡したり可変ワンショットリクエストを振り向けたりできる。AgentLoop は外側ウォーターフォールがストリームハンドルを返した時点でリクエスト試行を観測する; その限定境界は遅延終端アダプターが構築されたことやプロバイダー I/O を開始したことを証明しない。`block-start` / `block-end` の `index` 相関とアセンブラーの組み合わせにより、アダプターは整形式チャンクを送出するだけでよい — ブロック再組み立ては各アダプターの問題ではない。[architecture.md](../architecture.md#turn-flow) は 1 ターン内で `ctx.llm.stream()` と `llm/stream` ウォーターフォールが位置する場所を示す。

```ts type-equiv
/** One model call whose config and adapter registration were resolved together. */
interface PreparedLlmCall {
  /** Detached, deep-frozen config with any adapter-owned default materialized. */
  readonly config: LlmCallConfig
  /** Immutable retry policy captured with the adapter registration. */
  readonly retryPolicy: ResolvedRetryPolicy
  /** Detached context metadata resolved with the registration-bound call. */
  readonly context?: LlmModelContext
  /** Exact model modalities captured with the adapter dispatch generation. */
  readonly inputModalities?: readonly ModelModality[]
  /** Exact model system prompt update mode captured with the adapter dispatch generation. */
  readonly systemPromptUpdate?: SystemPromptUpdate
  /** Exact model tool update mode captured with the adapter dispatch generation. */
  readonly toolUpdate?: ToolUpdate
  /** Config fields materialized by the captured adapter rather than proposed by the caller. */
  readonly adapterDefaults: LlmCallConfigAdapterDefaults
  /**
   * Dispatch this call once through the registration captured during
   * preparation. The request's call-config fields must match {@link config};
   * reuse or mismatch fails with `INVALID_PREPARED_CALL`.
   * @param options - fully assembled request carrying the prepared config.
   * @returns the chunk stream, including the `llm/stream` waterfall.
   */
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>
}
```

```ts public-api
/**
 * Provider-wire adapter for the harness message and stream vocabulary. Register implementations
 * with `ctx.llm.registerAdapter(providers, adapter)`. Every provider HTTP request must include
 * `attributionHeaders()`; prove the headers are added in the wire request or library header hook. The direct-fetch
 * DeepSeek and library-backed pi-ai adapters meet this contract through different internals.
 */
declare abstract class LlmAdapter {
  /**
   * Describe one provider route owned by this adapter.
   * @param provider - a route passed to `registerAdapter()` for this instance.
   * @returns detached display metadata whose id must equal `provider`.
   */
  providerInfo(provider: string): LlmProviderInfo;
  /**
   * Return the provider-owned retry policy captured with this route.
   * @param _provider - a route passed to `registerAdapter()` for this instance.
   * @returns a resolved policy, or `undefined` to use the normal defaults.
   */
  providerRetryPolicy(_provider: string): ResolvedRetryPolicy | undefined;
  /**
   * Resolve provider-side request-image pricing for one exact model route.
   * The default declares none, so consumers fall back to their own neutral
   * estimate. Implementations must answer synchronously without I/O; the
   * token meter resolves this per measurement.
   * @param _provider - a route passed to `registerAdapter()` for this instance.
   * @param _model - exact model id passed to {@link GenerateOptions.model}.
   * @returns route-owned image pricing, or `undefined` when the route declares none.
   */
  imageRequestPricing(_provider: string, _model: string): LlmImageRequestPricing | undefined;
  /**
   * Resolve the image dimensions and byte target this adapter sends to the model.
   * The default preserves normalized images; adapters that resize must override it.
   * @param _provider - registered provider route.
   * @param _model - exact model id.
   * @param image - normalized image whose request projection is being resolved.
   * @returns the same target used by request serialization, before provider-internal processing.
   */
  imageRequestTarget(_provider: string, _model: string, image: ImageAttachmentRef): ImageRequestTarget;
  /**
   * List models this adapter can currently advertise for one owned provider.
   * Core routing accepts unlisted model ids; catalog-driven entry points such
   * as the GUI may require membership. Adapters used there must advertise
   * their available models; the base empty catalog offers no GUI selection.
   * @param _provider - one provider route owned by this adapter.
   * @returns discoverable models in adapter-preferred order.
   */
  listModels(_provider: string): Promise<readonly LlmModelInfo[]>;
  /**
   * Resolve all metadata available for one exact model. This query is
   * independent of the advisory catalog and does not validate request routing.
   * @param provider - one provider route owned by this adapter.
   * @param model - exact model id passed to {@link GenerateOptions.model}.
   * @param _signal - cancellation for this exact-model lookup; asynchronous
   *   implementations must settle promptly after it aborts.
   * @returns provider/model identity plus any context, call-default, and reasoning metadata.
   */
  resolveModel(
    provider: string,
    model: string,
    _signal?: AbortSignal,
  ): Promise<LlmResolvedModelInfo>;
  /**
   * Bind exact model metadata and the eventual request dispatch to one adapter generation.
   * Dynamic adapters override this so settings changes between preparation and
   * dispatch cannot combine one generation's capabilities with another's endpoint.
   * @param provider - registered provider route.
   * @param model - exact model id.
   * @param signal - cancellation for model resolution.
   * @returns model metadata and a one-generation stream entry point.
   */
  async prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
  /**
   * Stream one model call as raw chunks. The only required method.
   * @param options - the fully-assembled request; implementations must honor `options.signal`.
   * @returns the chunk stream, obeying the adapter contract documented on `StreamChunk`.
   */
  abstract stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
```

`ContentBlockType` (`index` 相関ブロックが運ぶキー集合) は上記の [`ContentBlockMap`](#content-blocks-and-messages) から導出される。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成 (doc-sync 内の `pnpm run verify-cordis-catalog` で鮮度を検証; `pnpm run gen-cordis-catalog` で再生成) — 言語面の差異はロケール固有の対訳文書パスのみである。署名ブロックは `ts cordis-catalog` フェンスを使い元のソース JSDoc を保持する; ディスパッチモードは [primer](../cordis-primer.md#dispatch-modes) で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxdeepseekllmapiextensions--deepseekllmapiextensionregistry"></a>

### `ctx.deepseekLlmApiExtensions` — `DeepSeekLlmApiExtensionRegistry`

公式 DeepSeek リクエスト向けの独立所有トップレベルフィールドのレジストリー。

```ts cordis-catalog
/**
 * Register the sole provider of one top-level request field. Registration is effect-scoped.
 * @param field - declaration-merged field owned by the provider.
 * @param provider - request-time field preparation and optional acceptance behavior.
 * @returns disposer that releases the field.
 */
register<K extends keyof DeepSeekLlmApiExtensionMap>( field: K, provider: DeepSeekLlmApiExtensionProvider<DeepSeekLlmApiExtensionMap[K]>, ): () => Promise<void>

/**
 * Prepare every currently registered field from one immutable base request.
 * A provider whose preparation throws, or whose value cannot be cloned, is omitted
 * from this request; the first such failure per field is logged. Only cancellation rejects. Field values are cloned
 * and frozen; providers retain no mutable alias to the outgoing request.
 * @param request - exact serialized request facts before extension fields.
 * @returns detached fields and their idempotent joint acceptance transaction.
 */
async prepare(request: DeepSeekLlmApiExtensionRequest): Promise<PreparedDeepSeekLlmApiExtensions>
```

Source: [`packages/llm/deepseek-llm-api-extensions/src/index.ts`](../../packages/llm/deepseek-llm-api-extensions/src/index.ts)

<a id="ctxllm--llmruntime"></a>

### `ctx.llm` — `LlmRuntime`

抽象 `llm` サービス: アダプターレジストリーとストリーミングモデル呼び出し API であり、`llm/stream` ウォーターフォールで傍受可能。

```ts cordis-catalog
/**
 * Register an adapter for the given provider routes. Throws `LlmError` with code
 * `DUPLICATE_ADAPTER` if any provider already has an adapter (all-or-nothing).
 * Disposed with the fiber.
 * @param providers - every provider route this adapter should serve.
 * @param adapter - the adapter that streams calls for those providers.
 * @returns the disposer, carrying {@link AdapterRegistrationHandle.replace}.
 */
registerAdapter(providers: string[], adapter: LlmAdapter): AdapterRegistrationHandle

/**
 * Describe provider routes with a registered adapter.
 * @returns detached provider metadata in registration order.
 */
@Remote listProviders(): LlmProviderInfo[]

/**
 * Declare provider routes an adapter plugin can activate through
 * configuration. Registration is all-or-nothing: an empty list, invalid
 * entry, or a provider already declared by any registration throws
 * `LlmError` without registering the rest. Disposed with the fiber.
 * @param entries - every configurable provider this plugin owns.
 * @returns a handle that withdraws all of them, and can atomically replace them.
 */
registerConfigurableProviders(entries: readonly LlmConfigurableProvider[]): DirectoryRegistrationHandle

/**
 * List every declared configurable provider, registered or dormant.
 * @returns detached directory entries in declaration order.
 */
@Remote listConfigurableProviders(): LlmConfigurableProvider[]

/**
 * Offer to interrogate provider endpoints on behalf of the settings
 * namespace this plugin owns. The namespace is the key because that is what
 * a configuration surface already holds from the configurable-provider
 * directory, and because a provider being *added* has no route to name yet.
 * Disposed with the fiber.
 * @param settingsNs - the namespace whose profiles this discovery serves.
 * @param discover - interrogates one endpoint and must honor the supplied signal.
 * @returns the disposer that withdraws the offer.
 */
registerModelDiscovery( settingsNs: string, discover: ( request: LlmModelDiscoveryRequest, signal?: AbortSignal, ) => Promise<readonly LlmDiscoveredModel[]>, ): () => void

/**
 * Interrogate one provider endpoint for the models it advertises. The
 * request describes a draft, not a stored route, so nothing here reads or
 * writes settings or credentials — the caller owns both, and the reply is
 * candidate metadata a surface may offer for adoption.
 * @param settingsNs - namespace whose registered discovery serves this draft.
 * @param request - the endpoint, protocol, and one-shot credential to use.
 * @param signal - caller cancellation.
 * @returns the advertised models, deduplicated in endpoint order.
 */
async discoverModels( settingsNs: string, request: LlmModelDiscoveryRequest, signal?: AbortSignal, ): Promise<LlmDiscoveredModel[]>

/**
 * Remote adapter for one draft provider interrogation.
 * @param settingsNs - namespace whose registered discovery serves this draft.
 * @param request - endpoint, protocol, and one-shot credential to use.
 * @param signal - caller cancellation supplied by the Remote carrier.
 * @returns advertised models in endpoint order.
 * @throws RemoteError with `llm/model-discovery-rejected` when discovery refuses or fails.
 */
@Remote('discoverModels') async remoteDiscoverModels( settingsNs: string, request: LlmModelDiscoveryRequest, signal: AbortSignal, ): Promise<LlmDiscoveredModel[]>

/**
 * Resolve the retry policy captured when one provider route was registered.
 * @param provider - registered provider route to inspect.
 * @returns the provider-owned policy, with normal defaults already resolved.
 */
providerRetryPolicy(provider: string): ResolvedRetryPolicy

/**
 * Resolve provider-side request-image pricing for one exact route, or
 * `undefined` when the provider is unregistered or declares none. Unknown
 * providers degrade to `undefined` rather than throwing because callers
 * price durable history whose route may no longer be mounted.
 * @param provider - provider route named by a request header.
 * @param model - exact model id named by the same header.
 * @returns the owning adapter's image pricing for the route, when declared.
 */
imageRequestPricing(provider: string, model: string): LlmImageRequestPricing | undefined

/**
 * Resolve the image projection for an exact registered model route.
 * @param provider - registered provider route.
 * @param model - exact model id.
 * @param image - normalized image reference.
 * @returns dimensions and byte target used by the adapter's request serializer.
 */
imageRequestTarget(provider: string, model: string, image: ImageAttachmentRef): ImageRequestTarget

/**
 * Resolve the exact text one durable file occurrence contributes to every
 * provider request in the current execution environment.
 * @param ref - durable verbatim file reference from model history.
 * @returns the same deterministic handle text used at adapter dispatch.
 */
fileRequestText(ref: FileAttachmentRef): string

/**
 * Discover models advertised by one registered provider. Catalog membership
 * does not constrain core routing. Catalog-driven entry points may restrict
 * selection and submission to the advertised models.
 * @param provider - registered provider route to inspect.
 * @returns detached model metadata in adapter-preferred order.
 */
async listModels(provider: string): Promise<LlmModelInfo[]>

/**
 * Resolve and validate all metadata from the adapter that owns one exact
 * route. The result is detached from adapter-owned objects; catalog
 * membership remains advisory and does not control request routing.
 * @param provider - registered provider route to inspect.
 * @param model - exact model id passed to the adapter.
 * @param signal - optional cancellation for adapter-owned asynchronous lookup.
 * @returns exact model identity plus available context and reasoning metadata.
 */
async resolveModelInfo( provider: string, model: string, signal?: AbortSignal, ): Promise<LlmResolvedModelInfo>

/**
 * Validate a conversation call config against its exact model capability and
 * materialize adapter-configured defaults. Unsupported explicit efforts
 * reject before provider I/O; no clamping or aliasing is performed. This
 * standalone query does not bind a later dispatch; use {@link prepareCall}
 * when logging and streaming must share one adapter registration.
 * @param config - provider/model route and optional request controls.
 * @param signal - optional cancellation for adapter-owned capability lookup.
 * @returns a detached config only when a default must be materialized.
 */
async resolveCallConfig(config: LlmCallConfig, signal?: AbortSignal): Promise<LlmCallConfig>

/**
 * Resolve one call under its current adapter registration. The returned
 * one-shot handle keeps that registration across header logging and dispatch,
 * so HMR cannot combine one adapter's capability result with another adapter.
 * An optional synchronous callback selects concrete controls using captured
 * model metadata. Defaults and validation apply to its result. Callback
 * failures and cancellation reject preparation before dispatch.
 * @param config - provider/model route and optional concrete request controls.
 * @param signal - optional cancellation for adapter-owned capability lookup.
 * @param configure - pure control selection, called once before defaults and validation.
 * @returns a prepared config and its registration-bound stream entry point.
 */
async prepareCall( config: LlmCallConfig, signal?: AbortSignal, configure?: ConfigureCall, ): Promise<PreparedLlmCall>

/**
 * Stream one model call as raw chunks (token-level deltas). Replay state is
 * retained only when the same adapter instance owns its historical provider
 * and the target provider. Final adapter selection remains fixed through
 * asynchronous exact-model resolution and dispatch. Adapter selection,
 * dispatch, and iteration failures become terminal `error` or `aborted`
 * finish chunks; middleware, nested-call, cleanup, and consumer failures
 * remain thrown.
 * @param options - the full request; `options.provider` selects the adapter.
 * @returns the chunk stream, possibly wrapped by `llm/stream` listeners.
 */
stream(options: GenerateOptions): AsyncIterable<StreamChunk>
```

Types: [FileAttachmentRef](attachment.md) · [ImageAttachmentRef](attachment.md) · [ImageRequestTarget](attachment.md)

Source: [`packages/llm/llm/src/index.ts`](../../packages/llm/llm/src/index.ts)

<a id="llm-events"></a>

### `llm/*` events

<a id="llmadapters-updated--emit"></a>

#### `llm/adapters-updated` — emit

プロバイダートポロジーが変わった: アダプターがルートを登録/登録解除したか、設定可能プロバイダーディレクトリーがエントリーを得失した。このペイロードなしレジストリー通知は各コミット点 (登録破棄を含む) で発火する; コンシューマーは新状態向けに `listProviders()`、`listModels()`、`listConfigurableProviders()` を読み直す。観測者の失敗は封じ込められ、レジストリー変更を拒否できない。

```ts cordis-catalog
/**
 * The provider topology changed: an adapter registered or unregistered
 * routes, or the configurable-provider directory gained or lost entries.
 * This payload-free registry notification fires at each commit point
 * (including registration disposal); consumers re-read `listProviders()`,
 * `listModels()`, or `listConfigurableProviders()` for the new state.
 * Observer failures are contained and cannot veto the registry mutation.
 * @mode emit
 */
'llm/adapters-updated'(): void
```

Source: [`packages/llm/llm/src/types.ts`](../../packages/llm/llm/src/types.ts)

<a id="llmstream--waterfall"></a>

#### `llm/stream` — waterfall

すべてのストリーミングモデル呼び出しを囲むウォーターフォール (再試行、リプレイ、ルーティング)。LlmRuntime に束縛される; 解決済みアダプターのストリームに届くには `next()` を呼び、短絡するには自身のチャンクを yield する。

```ts cordis-catalog
/**
 * Waterfall around every streaming model call (retry, replay, routing).
 * Bound to the {@link LlmRuntime}; call `next()` to reach the resolved
 * adapter's stream, or yield your own chunks to short-circuit.
 * @param options - the full request. A LOOP-built request carries the
 *   process-local {@link markAgentLoopRequest} identity and arrives deep-frozen
 *   (mutation throws): its content is a pure function of the session log (the
 *   reconstructability Agent Note), so listeners read it, never rewrite it.
 *   Hand-built calls do not carry that marker; callers own their request
 *   inputs and must keep them unchanged until the stream settles.
 * @mode waterfall
 */
'llm/stream'(this: LlmRuntime, options: GenerateOptions, next: () => AsyncIterable<StreamChunk>): AsyncIterable<StreamChunk>
```

Source: [`packages/llm/llm/src/index.ts`](../../packages/llm/llm/src/index.ts)
<!-- END GENERATED cordis-surface -->
