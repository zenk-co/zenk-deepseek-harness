# セッションタイトル

日本語 | [English](session-title.en.md) | [中文](session-title.zh.md)

[`@deepseek-ai/dsh-session-title`](../../packages/session/session-title) が所有する、永続的な最新優先のタイトル状態と、任意の非同期プロバイダー語彙。共有実行モジュールが正確な補助リクエストレコードを所有します。タイミング、フォールバック、失敗、フォークの動作はパッケージ README が所有し、完全なイベント宣言は生成された[永続カタログ](../persistence-catalog.md)が所有します。

ソース: [`packages/session/session-title/src/index.ts`](../../packages/session/session-title/src/index.ts), [`packages/session/session-title-llm/src/index.ts`](../../packages/session/session-title-llm/src/index.ts)

## 永続的なタイトル状態

`SessionTitleProviderId` は、プロバイダーが生成したリビジョンに対して記録されます。`SessionTitleEventData` はタイトルの導出に使われた正確な人間メッセージの seq を列挙し、`SessionTitleSnapshot` は `ctx.sessionTitle.get()` と `foldSessionTitle()` が返す永続イベントエンベロープの事実を追加します。`title` プロジェクションは、そのバージョン 1 の状態とクライアントビューをタイトル文字列または `null` のみとして保つため、既存の永続キャッシュ行は読み取り可能なままです。

```ts type-equiv
/** Identifies one session-title provider registration. */
type SessionTitleProviderId = Branded<'SessionTitleProviderId'>
```

```ts type-equiv
/** Exact auxiliary model route that produced a title. */
interface SessionTitleModelIdentity {
  /** Registered LLM provider route. */
  readonly provider: string
  /** Provider model id. */
  readonly model: string
}
```

```ts type-equiv
/** Durable ownership record for an accepted session title. */
type SessionTitleSource =
  | { readonly kind: 'fallback' }
  | {
    readonly kind: 'provider'
    readonly provider: SessionTitleProviderId
    readonly model?: SessionTitleModelIdentity
  }
  | {
    /** Explicit user rename: pins the title — automatic generation stops scheduling. */
    readonly kind: 'user'
  }
```

```ts type-equiv
/** Payload of the log-only `session/title` event. */
interface SessionTitleEventData {
  /** Normalized non-empty title text. */
  readonly title: string
  /** Exact human `user/message` seqs used to derive this title; empty for an explicit user rename. */
  readonly messageSeqs: SessionSeq[]
  /** Whether the built-in fallback, a registered provider, or the user supplied the title. */
  readonly source: SessionTitleSource
}
```

```ts type-equiv
/** Latest folded title plus the title event's durable envelope facts. */
interface SessionTitleSnapshot extends SessionTitleEventData {
  /** Seq of the latest `session/title` event. */
  readonly eventSeq: SessionSeq
  /** Timestamp of the latest `session/title` event. */
  readonly updatedAt: number
}
```

## 補助リクエストレコード

共有実行モジュールは、モデルを呼び出す前に、検証済みでディスパッチ可能な各タイトルリクエストを記録します。ペイロードは、モデル可視のシステム入力とメッセージ入力、ルーティング、出力制限、解決済みの推論エフォート、プロバイダー所有権、ソースメッセージの帰属を、後で生成が失敗した場合でも再現します。

```ts type-equiv
/** Exact model-visible request recorded before one auxiliary title dispatch. */
interface SessionTitleLlmRequestEventData {
  /** Registered title-provider identity responsible for the request. */
  readonly titleProvider: SessionTitleProviderId
  /** Exact human `user/message` seqs represented in `messages`. */
  readonly messageSeqs: SessionSeq[]
  /** Exact auxiliary LLM route. */
  readonly route: SessionTitleModelIdentity
  /** Exact auxiliary system prompt. */
  readonly system: string
  /** Exact auxiliary message list. */
  readonly messages: Message[]
  /** Exact auxiliary output-token cap. */
  readonly maxTokens: number
  /** Resolved reasoning effort when recorded; older requests can omit it. */
  readonly reasoningEffort?: ReasoningEffortId
}
```

## プロバイダーの入力と出力

サービスは、適格なメッセージを 1 つのリビジョンを通してスナップショットし、各プロバイダー呼び出しの直前に、それが確保したフォールバックを含む最新の受理済みタイトルをスナップショットします。プロバイダーはそのリクエストからの seq のみを返します。サービス所有の受理が順序を検証し、タイトルを正規化し、バイト制限を適用して、ソースメッセージの seq とソース種別と共にタイトルを追記します。

```ts type-equiv
/** One eligible human text message exposed to title providers. */
interface SessionTitleUserMessage {
  /** Source `user/message` event seq. */
  readonly seq: SessionSeq
  /** Exact concatenated text-block content. */
  readonly text: string
}
```

```ts type-equiv
/** Automatic generation cadence owned by a registered provider. */
type SessionTitleAutomaticMode = 'first-prompt' | 'all-prompts'
```

```ts type-equiv
/** Immutable input supplied to one title-provider call. */
interface SessionTitleProviderRequest {
  /** Live session being titled. */
  readonly session: Session
  /** All eligible human messages through this generation revision. */
  readonly messages: readonly SessionTitleUserMessage[]
  /** Exact current logged main-request route, when one has been recorded. */
  readonly route?: SessionTitleModelIdentity
  /**
   * Latest accepted title captured at invocation, including an accepted
   * fallback whose event may follow the last eligible message. Absent before
   * any title is accepted. The provider decides whether and how to use it.
   */
  readonly currentTitle?: SessionTitleSnapshot
  /** Cancellation for supersession, disposal, timeout composition, or the explicit caller. */
  readonly signal: AbortSignal
}
```

```ts type-equiv
/** Provider output before service-owned normalization and log acceptance. */
interface SessionTitleProviderResult {
  /** Proposed title text. */
  readonly title: string
  /** Exact seqs from `request.messages` used by this result. */
  readonly messageSeqs: readonly SessionSeq[]
  /** Auxiliary LLM route, when generation used a model. */
  readonly model?: SessionTitleModelIdentity
}
```

```ts type-equiv
/** One optional asynchronous title implementation registered with the service. */
interface SessionTitleProvider {
  /** Stable id of the provider recorded with the title. */
  readonly id: SessionTitleProviderId
  /** When new human prompts start automatic generation. */
  readonly automatic: SessionTitleAutomaticMode
  /**
   * Produce one title revision.
   * @param request - message snapshot, current title, current route, session, and cancellation.
   * @returns proposed title plus exact input seqs and the optional provider/model route used to generate it.
   */
  generate(request: SessionTitleProviderRequest): Promise<SessionTitleProviderResult>
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成 (doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。再生成は `pnpm run gen-cordis-catalog`) — 各言語側で異なるのはロケール固有の対訳ドキュメントパスだけです。署名ブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保ちます。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にあります。

<a id="ctxsessiontitle--sessiontitleservice"></a>

### `ctx.sessionTitle` — `SessionTitleService`

ログに基づくタイトルフォールドと非同期フォールバック生成。

```ts cordis-catalog
/**
 * Read the latest folded title from one live or replayed session.
 * @param session - session whose log is the title source of truth.
 * @returns latest title snapshot, or `undefined` before eligible input.
 */
get(session: Session): SessionTitleSnapshot | undefined

/**
 * Accept an explicit user title. Appends a `session/title` event with the
 * `user` source, which pins the title: in-flight automatic generation is
 * superseded and later user messages schedule none (an explicit
 * {@link SessionTitleService.refresh} remains the deliberate unpin).
 * @param session - exact live session to rename.
 * @param title - raw user input; normalized before acceptance.
 * @returns the accepted title snapshot.
 * @throws {SessionTitleInvalidError} when the title normalizes to empty.
 * @throws {Error} when the session is not live or the service is disposed.
 */
rename(session: Session, title: string): SessionTitleSnapshot

/**
 * Explicitly retry the registered provider, or materialize the built-in
 * fallback when no provider is registered.
 * @param session - exact live session to refresh.
 * @param signal - optional caller cancellation.
 * @returns latest accepted title, or `undefined` when no eligible text exists.
 */
async refresh(session: Session, signal?: AbortSignal): Promise<SessionTitleSnapshot | undefined>

/**
 * Register the sole optional title provider. Disposal aborts its pending and
 * active work; a replacement may register once disposal has started, and the
 * closing provider's late results never commit.
 * @param provider - provider identity, cadence, and generation function.
 * @returns exact Cordis effect disposer, which settles after active calls quiesce.
 */
register(provider: SessionTitleProvider): () => Promise<void>
```

型: [Session](session.md)

ソース: [`packages/session/session-title/src/index.ts`](../../packages/session/session-title/src/index.ts)
<!-- END GENERATED cordis-surface -->
