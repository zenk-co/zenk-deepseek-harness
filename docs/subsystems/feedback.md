# メッセージフィードバック

日本語 | [English](feedback.en.md) | [中文](feedback.zh.md)

[`@deepseek-ai/dsh-message-feedback`](../../packages/feedback/message-feedback) は、個々の assistant メッセージに対する編集可能なフィードバックを所有する。正規のセッションログは `feedback/message-put` と `feedback/message-delete` を保存する。不変のセッションレベル備考は `feedback/record` のままで、2 種類のフィードバックが分類される `FeedbackCategory` 分類表とともに [`@deepseek-ai/dsh-command-feedback`](../../packages/feedback/command-feedback) が所有する。3 つともログのみのイベントであり、モデルコンテキストには決して入らない。

ソース: [`packages/feedback/message-feedback/src/types.ts`](../../packages/feedback/message-feedback/src/types.ts)

## 公開型

```ts type-equiv
/** Opaque compare-and-set token for one exact feedback item revision. */
type MessageFeedbackVersion = Branded<'MessageFeedbackVersion'>
```

```ts type-equiv
/** The human's overall judgment of one assistant message. */
type MessageFeedbackRating = 'positive' | 'negative'
```

```ts type-equiv
/** One current feedback value and its opaque mutation token. */
interface MessageFeedbackItem {
  /** Stable identity of the assistant message inside the owning Session. */
  readonly messageId: MessageId
  /** Overall positive or negative judgment. */
  readonly rating: MessageFeedbackRating
  /** Optional explanation, preserved verbatim after validation. */
  readonly note?: string
  /** Category the human filed the judgment under. */
  readonly category?: FeedbackCategory
  /** Equality-only token replaced by every material create or update. */
  readonly version: MessageFeedbackVersion
  /** Host-assigned creation time in Unix epoch milliseconds. */
  readonly createdAt: number
  /** Host-assigned time of the most recent material update. */
  readonly updatedAt: number
}
```

```ts type-equiv
/** A material creation or edit, retaining its complete current value. */
interface MessageFeedbackPut {
  /** Owning Session; inherited feedback in a fork belongs to its parent. */
  readonly sessionId: SessionId
  /** Value after this mutation, including the original creation time. */
  readonly item: MessageFeedbackItem
}
```

```ts type-equiv
/** A material deletion of one current feedback item. */
interface MessageFeedbackDelete {
  /** Session that owns the deleted feedback. */
  readonly sessionId: SessionId
  /** Message whose feedback was removed. */
  readonly messageId: MessageId
}
```

```ts type-equiv
/** Read all message feedback belonging to one persisted Session lifecycle. */
interface MessageFeedbackListRequest {
  /** Session whose feedback events should be read. */
  readonly sessionId: SessionId
}
```

```ts type-equiv
/** Current feedback values for one Session, in first-creation order. */
interface MessageFeedbackListValue {
  /** Fresh immutable item snapshots. */
  readonly items: readonly MessageFeedbackItem[]
}
```

```ts type-equiv
/** Create or replace feedback for one assistant message. */
interface MessageFeedbackPutRequest {
  /** Persisted Session that owns the target message. */
  readonly sessionId: SessionId
  /** Target assistant-message identity. */
  readonly messageId: MessageId
  /** Desired overall judgment. */
  readonly rating: MessageFeedbackRating
  /** Optional non-blank explanation. */
  readonly note?: string
  /** Optional category; absent keeps the item uncategorized. */
  readonly category?: FeedbackCategory
  /** Observed item version, or `null` to require that no item exists. */
  readonly ifVersion: MessageFeedbackVersion | null
}
```

```ts type-equiv
/** Delete feedback for one message after observing its current version. */
interface MessageFeedbackDeleteRequest {
  /** Session that owns the feedback. */
  readonly sessionId: SessionId
  /** Message whose feedback should be absent after this operation. */
  readonly messageId: MessageId
  /** Observed item version; ignored when the item is already absent. */
  readonly ifVersion: MessageFeedbackVersion
}
```

```ts type-equiv
/** Idempotent deletion acknowledgement. */
interface MessageFeedbackDeleteValue {
  /** Stable postcondition shared by the first deletion and every retry. */
  readonly absent: true
}
```

```ts type-equiv
/** No persisted Session header exists for the requested id. */
interface MessageFeedbackSessionNotFound {
  readonly code: 'session-not-found'
  readonly sessionId: SessionId
}
```

```ts type-equiv
/** The id does not name a derived, append-origin assistant message. */
interface MessageFeedbackTargetNotFound {
  readonly code: 'target-not-found'
  readonly sessionId: SessionId
  readonly messageId: MessageId
}
```

```ts type-equiv
/** A material mutation did not match the addressed item's current version. */
interface MessageFeedbackVersionConflict {
  readonly code: 'version-conflict'
  /** Authoritative current item, or `null` when it does not exist. */
  readonly current: MessageFeedbackItem | null
}
```

```ts type-equiv
/** A supplied note contains no non-whitespace character. */
interface MessageFeedbackNoteBlank {
  readonly code: 'note-blank'
}
```

```ts type-equiv
/** A supplied note exceeds the configured UTF-8 byte limit. */
interface MessageFeedbackNoteTooLarge {
  readonly code: 'note-too-large'
  readonly maxBytes: number
  readonly actualBytes: number
}
```

```ts type-equiv
/** Failures shared by the public message-feedback operations. */
type MessageFeedbackFailure =
  | MessageFeedbackSessionNotFound
  | MessageFeedbackTargetNotFound
  | MessageFeedbackVersionConflict
  | MessageFeedbackNoteBlank
  | MessageFeedbackNoteTooLarge
```

```ts type-equiv
/** Successful public operation result. */
interface MessageFeedbackSuccess<T> {
  readonly ok: true
  readonly value: T
}
```

```ts type-equiv
/** Rejected public operation result with a stable business failure. */
interface MessageFeedbackRejected<E extends MessageFeedbackFailure> {
  readonly ok: false
  readonly error: E
}
```

```ts type-equiv
/** Result returned by the message-feedback `list` operation. */
type MessageFeedbackListResult =
  | MessageFeedbackSuccess<MessageFeedbackListValue>
  | MessageFeedbackRejected<MessageFeedbackSessionNotFound>
```

```ts type-equiv
/** Result returned by the message-feedback `put` operation. */
type MessageFeedbackPutResult =
  | MessageFeedbackSuccess<MessageFeedbackItem>
  | MessageFeedbackRejected<
    | MessageFeedbackSessionNotFound
    | MessageFeedbackTargetNotFound
    | MessageFeedbackVersionConflict
    | MessageFeedbackNoteBlank
    | MessageFeedbackNoteTooLarge
  >
```

```ts type-equiv
/** Result returned by the message-feedback `delete` operation. */
type MessageFeedbackDeleteResult =
  | MessageFeedbackSuccess<MessageFeedbackDeleteValue>
  | MessageFeedbackRejected<MessageFeedbackSessionNotFound | MessageFeedbackVersionConflict>
```

## セッションフィードバック型

ソース: [`packages/feedback/command-feedback/src/types.ts`](../../packages/feedback/command-feedback/src/types.ts)

```ts type-equiv
/** One of the fixed feedback categories; the ids are durable log vocabulary. */
type FeedbackCategory =
  | 'task-result'
  | 'instruction-following'
  | 'product-interaction'
  | 'service-stability'
  | 'resource-cost'
  | 'security-privacy-permission'
  | 'other'
```

```ts type-equiv
/**
 * One recorded human remark about a Session. Both members are optional: a
 * submission with neither still records that the human asked for the
 * Session to be reviewed, which is what authorizes log delivery.
 */
interface FeedbackRecord {
  /** Free-text remark with surrounding whitespace removed; never empty when present. */
  readonly text?: string
  /** Category the human filed the remark under. */
  readonly category?: FeedbackCategory
}
```

```ts type-equiv
/** Record one Session-level remark through the Host Remote. */
interface SessionFeedbackRecordRequest {
  /** Live Session the remark describes. */
  readonly sessionId: SessionId
  /** Free-text remark; blank text is recorded as absent. */
  readonly text?: string
  /** Category the human filed the remark under. */
  readonly category?: FeedbackCategory
}
```

```ts type-equiv
/** Stable postcondition of a recorded remark. */
interface SessionFeedbackRecordValue {
  /** The remark is appended to the Session log; flushing follows the Session's own schedule. */
  readonly recorded: true
}
```

```ts type-equiv
/** No live Session carries the requested id. */
interface SessionFeedbackSessionNotFound {
  readonly code: 'session-not-found'
  readonly sessionId: SessionId
}
```

```ts type-equiv
/** Result returned by the `sessionFeedback.record` operation. */
type SessionFeedbackRecordResult =
  | { readonly ok: true; readonly value: SessionFeedbackRecordValue }
  | { readonly ok: false; readonly error: SessionFeedbackSessionNotFound }
```

## データと並行性

現在のアイテムは、ペイロードの `sessionId` が所有セッションと一致する正規フィードバックイベントから畳み込まれる。各アイテムは positive または negative の評価、オプションのノート、オプションのカテゴリー、Host が割り当てた `createdAt`/`updatedAt` タイムスタンプ、自身の不透明なバージョンを運ぶ。バージョンは等価性のためだけに、かつ対象メッセージに対してのみ比較される。呼び出し元はそれらを順序付けたり合成したりしない。

`put` は厳密な楽観的並行性を使う。既存アイテムへのすべてのリクエストは、ノーオペレーション (保存済みの評価・ノート・カテゴリーを繰り返す put) を含め、現在の `ifVersion` と一致しなければならない。競合は権威ある現在のアイテム (または `null`) を返すので、呼び出し元は別の読み取りなしに、失われた応答や並行編集を調停できる。既に存在しないアイテムの削除は成功する。セッションごとのキューが読み取りとミューテーションを直列化する。コールドミューテーションは読み取り、比較、追記、フラッシュを通じて永続化書き込みハンドルを保持する。一致するノーオペレーションはイベントを追記しない。

## ターゲットとライフサイクルの権限

ライブオーナーのインメモリログが対象セッションの観測を直接供給する。コールド読み取りは `SessionPersistence.open(id, 'read')` ハンドルを使い、ミューテーションは書き込みハンドルを使う。どちらの経路もセッションやエージェントを構築しない。`stat(id)` の事前チェックが確実な不在を分類する。`stat` が確認したセッションの読み取り失敗はインフラストラクチャの失敗として伝播する。`put` は、要求された `MessageId` を持つ、空でない append 起源の `assistant/message` のみを受け入れる。置換起源、usage のみの空、assistant 以外のレコードはフィードバックの対象ではない。

フォークのシードは親のフィードバックイベントを含みうるが、そのペイロードは親の `sessionId` を保持するため、子の現在のフィードバックにはならない。アイテムの削除はトゥームストーンを追記する。以前の評価とノートはログに残る。

## 永続化と Remote 契約

成功したメッセージフィードバックのミューテーションは正規の永続化を待つ。ライブ操作は所有セッションを通じて追記し、参加する `ctx.sessions.flush` リスナーを必要とする。コールド操作は自身の書き込みハンドルを通じて追記しフラッシュする。永続化の失敗は成功を報告せずに伝播する。`maxNoteBytes` は必須で、ノートテキストを UTF-8 バイト数で制限する。Web Host コンポジションは `8192` を設定する。このパッケージは Host の `messageFeedback.list`、`messageFeedback.put`、`messageFeedback.delete` の単項 Remote 契約を `TypertRemoteService` と `@Remote` を通じて公開し、`command-feedback` はライブセッションのセッションレベル備考のために `sessionFeedback.record` を同じ方法で公開する。以下の生成された Cordis API がメソッドレベルの権威である。

プラグインの破棄は操作の受け入れを閉じ、受け入れ済みのセッションごとのキューの作業を排出する。

デフォルトでは、[`session-log-deepseek`](../../packages/session/session-log-deepseek/README.md) が、その後の適格な DeepSeek リクエストにおいて、通常の `dsh_session_log` サフィックスの一部としてフィードバックを運ぶ。コンポジションは `enabled: false` で無効化できる。フィードバックの記録は LLM リクエストや別個の `dsh_feedback` アップロードを引き起こさない。DeepSeek 以外のルートでは、[OTel バックエンド](../../packages/session/session-telemetry-otel/README.md)が記録されたフィードバックを通じて正規プレフィックスを解放できる。コマンドの確認応答は記録を確認し、セッションと匿名ユーザーを識別する。テレメトリポリシーも配信も報告しない。

## Web サーフェス

[`@deepseek-ai/dsh-client-ui-message-feedback`](../../packages/client/ui-message-feedback) がブラウザー側のコンシューマーである。`@deepseek-ai/dsh-api-remotes` が生成された `messageFeedback` と `sessionFeedback` のコントリビューションをマウントするので、プラグインは `ctx.remote.messageFeedback` と `ctx.remote.sessionFeedback` を呼び、トランスポートには決して触れない。

コントロールは `conversation.chat.assistant-actions` リストスロットの `feedback` エントリー (order 10) である。このスロットは `ui-conversation` が宣言し、確定済み assistant メッセージの IconActions 行の内部に描画する。`AssistantMessageNode` は `assistant/message` イベントからのオプションの `messageId` を運ぶ。このフィールドは中断時に凍結されたパーシャルには存在せず、レンダリングサイトはそれが存在しない場合にスロットをスキップする。ストリップはターンごとに 1 回、締めくくりの assistant メッセージに描画される。Host は append 起源のすべてのステップメッセージを対象として受け入れるが、マルチステップターンの以前のステップは評価可能な本文ではなくツール行を描画するため、UI は Host 契約が許すより狭い集合のみを公開する。

セッションごとに 1 つの `MessageFeedbackController` が、そのセッション内のすべてのメッセージコントロールを支える。単一の `list` 読み取りがトランスクリプト全体をシードし、マウント時に発火するのではなく最初のホバーまたはフォーカスまで遅延される。各ミューテーションは、コントローラーが最後に観測したバージョンを `ifVersion` として送る。`version-conflict` の応答は権威あるアイテムを運ぶので、コントローラーは再取得せずに応答から調停する。ミューテーションはセッションごとに直列化されるため、キューに入った操作はコミット済みバージョンと比較する。注入された `retract` 操作はそのキュー内でコミット済みの評価を再チェックし、並行変更の後ではノーオペレーションになるので、古い UI が素の評価を記録してダイアログを迂回することはできない。`connection/reset` は既に読み取り済みのセッションのみを更新する。

未記録のいずれかの評価を選ぶと、そのセッションのフィードバックダイアログ — `conversation.input.overlay` の `feedback-dialog` エントリー — が開く。7 つのカテゴリーチップと詳細ボックスを備えた共有 Modal カードである。送信は、選択されたカテゴリーとトリムされた説明を伴う選択済みの判断を put するか、どちらも伴わない。成功はダイアログを閉じて確認トーストを表示し、失敗はダイアログと下書きを開いたままにして警告トーストを表示する。同じダイアログは、素の `/feedback` — `ui-commands` が `action` としてルーティングするデコレーション — からそのセッションに対して開き、その後 `sessionFeedback.record` を通じて記録する。`/feedback <text>` は Host コマンド経路を保つ。記録済みの評価をクリックすると、ダイアログを開かずに撤回する。

## 境界と制限

- 操作キューはプロセスローカルである。コールドライターの排除は選択された永続化プロバイダーに依存する。
- 削除は現在のアイテムを削除するのであり、追記専用ログの以前のノートテキストや、既に配信されたサフィックスを削除するのではない。
- ライブデタッチ後、永続化カタログがヘッダーをマテリアライズする前の狭い間隔でのリクエストは `session-not-found` を受け取ることがある。呼び出し元はリタイアのマテリアライズ後に再試行する。
- コールドリクエストは完全なログを読む。サービスにはアイテム数や集約バイトの上限はない。`maxNoteBytes` は各ノートのみを制限する。
- Host 契約は認証済みアクターや監査 ID を記録しないため、信頼された呼び出し元境界を前提とする。
- Web コントロールはチャットビューにのみ表示される。trajectory ビューと waterfall ビューは、その assistant ノードが同じ `messageId` を運んでいても、フィードバックエントリーを描画しない。
- Web コントローラーはフィードバックログイベントを消費しないため、2 つ目のタブの評価は即座ではなく、再接続時または次の競合応答時に可視になる。
- ダイアログは `maxNoteBytes` を事前チェックしない。メッセージに対するサイズ超過の説明は、入力中ではなく送信時に `note-too-large` で失敗する。セッションレベル備考にはサイズ上限がなく、`/feedback` コマンドにもかつてなかった。
- `sessionFeedback.record` はライブセッションのみを対象とし、それ以外には `session-not-found` を返す。ダイアログは、開いている間にセッションがリタイアするとその失敗を報告する。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxmessagefeedback--messagefeedbackservice"></a>

### `ctx.messageFeedback` — `MessageFeedbackService`

Session-log service; cold operations never construct a Session or Agent.

```ts cordis-catalog
/**
 * Read current feedback from the canonical log.
 * @param request - Session to inspect.
 * @returns immutable items or a definite persistence miss.
 */
@Remote('list') list(request: MessageFeedbackListRequest): Promise<MessageFeedbackListResult>

/**
 * Create or replace feedback after checking its current version.
 * Matching no-ops retain the version and append no event.
 * @param request - Target, desired value, and observed item version.
 * @returns the durable item or an explicit business failure.
 */
@Remote('put') put(request: MessageFeedbackPutRequest): Promise<MessageFeedbackPutResult>

/**
 * Delete one item after checking its version; absence succeeds without an event.
 * @param request - Session, message, and observed item version.
 * @returns the stable absent postcondition or an explicit failure.
 */
@Remote('delete') delete(request: MessageFeedbackDeleteRequest): Promise<MessageFeedbackDeleteResult>
```

Source: [`packages/feedback/message-feedback/src/index.ts`](../../packages/feedback/message-feedback/src/index.ts)

<a id="ctxsessionfeedback--sessionfeedbackservice"></a>

### `ctx.sessionFeedback` — `SessionFeedbackService`

Host Remote through which a product surface records a Session-level remark.

```ts cordis-catalog
/**
 * Record one remark on a live Session.
 * @param request - target Session plus the optional text and category.
 * @returns the recorded postcondition, or `session-not-found` when no live
 * Session carries the id.
 */
@Remote('record') record(request: SessionFeedbackRecordRequest): Promise<SessionFeedbackRecordResult>
```

Source: [`packages/feedback/command-feedback/src/index.ts`](../../packages/feedback/command-feedback/src/index.ts)

<a id="feedback-events"></a>

### `feedback/*` events

<a id="feedbackcommitted--parallel"></a>

#### `feedback/committed` — parallel

Observe a durable cold feedback mutation without publishing a live Session. Observers run before write ownership is released and must not await another message-feedback operation for this Session. The payload is borrowed read-only; deep-clone it before transferring ownership (for example, to Session.fromRestore).

```ts cordis-catalog
/**
 * Observe a durable cold feedback mutation without publishing a live Session.
 * Observers run before write ownership is released and must not await
 * another message-feedback operation for this Session. The payload is borrowed
 * read-only; deep-clone it before transferring ownership (for example, to Session.fromRestore).
 * @param inspection - committed canonical prefix, including the feedback as its last event.
 * @mode parallel
 */
'feedback/committed'(inspection: SessionInspection): void
```

Types: [SessionInspection](persistence.md)

Source: [`packages/feedback/message-feedback/src/index.ts`](../../packages/feedback/message-feedback/src/index.ts)
<!-- END GENERATED cordis-surface -->
