# ホスト全体の Schedule

日本語 | [English](schedule.en.md) | [中文](schedule.zh.md)

Schedule はリマインダーをセッションのアクティブ化とは独立に保存し、元のセッションへ配信します。このページは [`types.ts`](../../packages/schedule/schedule/src/types.ts) 由来の永続化向けおよびモデル向けの型を記録します。構成とリマインダーの枠付けは [パッケージ README](../../packages/schedule/schedule/README.md) が所有します。

## 永続化レコード

`ScheduleId` はグローバルに一意な [branded id](core.md#branded-ids) です。バージョン 1 の `schedule` ストレージドメインは `tasks` テーブルを所有し、各エントリは `ScheduleRecord` を元の `sessionId` に結び付け、保存される `status: 'active' | 'inactive'` と任意の `lastDelivery` を持ちます。status を欠くレコードは、履歴セッションの走査や再作成なしに `active` へ正規化されます。作成時は対象を RFC 3339 UTC の `scheduledAt` へ正規化します。`after` は送信された遅延を保持し、`every` は固定間隔を保持し、`daily` と `weekly` は正規化されたローカルの `time` と明示的な `timeZone` を保持し、`cron` は正規化された 5 フィールドの `expression` と明示的な `timeZone` を保持します。daily・weekly・cron のデコードは、確定した瞬間と保存されたゾーン表記を保持します。保存されるタスクレコードは必須の `title` を宣言します。これはタスク表示が示す短い名前です。作成時は `title` が必須であり、指示文から導出することはありません。保存レコードが `title` を省略することは許されません。`title` が欠落している、トリミング後に空白のみになる、トリミングされていない、または 120 文字を超えるレコードは、`ScheduleLogError` で永続化デコードに失敗します。schedule ドメインはバックアップ・アンド・スキップの方針を宣言しないため、このような保存タスクが 1 件あると、除外されるのではなくドメイン全体のオープンが拒否されます。タスクを削除するのは明示的な削除のみです。以前に物理削除されたタスクが復元または捏造されることはありません。

```ts type-equiv
/** Durable one-shot reminder created from a positive delay. */
interface AfterScheduleRecord {
  /** Globally unique task identity. */
  readonly id: ScheduleId
  /** Rule discriminator for a delayed one-shot reminder. */
  readonly kind: 'after'
  /** Required stored task name; already trimmed, non-empty, and at most 120 characters. */
  readonly title: string
  /** Trimmed reminder content supplied at creation. */
  readonly prompt: string
  /** Positive safe-integer delay accepted at creation. */
  readonly afterSeconds: number
  /** Four-digit-year RFC 3339 UTC target. */
  readonly scheduledAt: string
}
```

```ts type-equiv
/** Durable one-shot reminder created from an absolute instant. */
interface AtScheduleRecord {
  /** Globally unique task identity. */
  readonly id: ScheduleId
  /** Rule discriminator for an absolute one-shot reminder. */
  readonly kind: 'at'
  /** Required stored task name; already trimmed, non-empty, and at most 120 characters. */
  readonly title: string
  /** Trimmed reminder content supplied at creation. */
  readonly prompt: string
  /** Four-digit-year RFC 3339 UTC target. */
  readonly scheduledAt: string
}
```

```ts type-equiv
/** Durable fixed-rate reminder aligned to creation or its most recent interval edit. */
interface EveryScheduleRecord {
  /** Globally unique task identity. */
  readonly id: ScheduleId
  /** Rule discriminator for a fixed-rate recurring reminder. */
  readonly kind: 'every'
  /** Required stored task name; already trimmed, non-empty, and at most 120 characters. */
  readonly title: string
  /** Trimmed reminder content supplied at creation. */
  readonly prompt: string
  /** Fixed safe-integer interval, never below one minute. */
  readonly everySeconds: number
  /** Next anchor-aligned occurrence while active, or final occurrence when inactive. */
  readonly scheduledAt: string
}
```

```ts type-equiv
/** Durable daily wall-clock reminder; gaps skip a date and overlaps use the earlier instant. */
interface DailyScheduleRecord {
  /** Globally unique task identity. */
  readonly id: ScheduleId
  /** Rule discriminator for a daily wall-clock reminder. */
  readonly kind: 'daily'
  /** Required stored task name; already trimmed, non-empty, and at most 120 characters. */
  readonly title: string
  /** Trimmed reminder content supplied at creation. */
  readonly prompt: string
  /** Local time normalized to HH:mm:ss.SSS. */
  readonly time: string
  /** Explicit IANA zone; equivalent timing edits retain the stored spelling. */
  readonly timeZone: string
  /** Committed next UTC instant while active, or final occurrence when inactive. */
  readonly scheduledAt: string
}
```

```ts type-equiv
/** One-shot task variants. */
type OneShotScheduleRecord = AfterScheduleRecord | AtScheduleRecord
```

```ts type-equiv
/** Recurring Host task variants. */
type RecurringScheduleRecord = EveryScheduleRecord | DailyScheduleRecord | WeeklyScheduleRecord | CronScheduleRecord
```

```ts type-equiv
/** Reminder rule and target, stored with its original Session binding. */
type ScheduleRecord = OneShotScheduleRecord | RecurringScheduleRecord
```

## 絶対時刻入力

`at` セレクターは、オフセットを厳密に含む RFC 3339 文字列か、正確なローカルカレンダーオブジェクトのいずれかです。ローカル形式はツール境界で解釈を明示的に保ちます。

```ts type-equiv
/** Structured local-calendar input accepted by creation and timing edits. */
interface LocalAtInput {
  /** Four-digit ISO calendar date. */
  readonly date: string
  /** Local wall-clock time with optional one-to-three digit milliseconds. */
  readonly time: string
  /** Explicit UTC or IANA Area/Location zone. */
  readonly time_zone: string
}
```

```ts type-equiv
/** Absolute selector accepted by creation and timing edits. */
type AtInput = string | LocalAtInput
```

出荷される Web 構成は `schedule` サービスと `ui-schedule` タスクページをマウントします。時刻の読み取りと 4 つのリマインダーツールはプリセットが所有します。`standard`・`cordis`・`ptc` は `time-context` と `@deepseek-ai/dsh-tool-schedule` を一緒に宣言し、`minimal` はどちらも宣言しません。これら 3 プリセット内の `tool-subagent` 行と `tool-subagent-fork` 行は 4 ツールを拒否し、各ツールは委譲された呼び出し元を `subagent_session` で拒否するため、委譲された子はツールを見ることも呼び出しを受け付けられることもありません。time-context は、開いているターンに曖昧さのないブラウザーゾーンが 1 つある場合に、そのリクエストローカルなゾーンで修飾のない自然言語の日付・時刻を解釈するようモデルに指示します。ブラウザーゾーンの記録が混在または欠落している場合は、モデルに問い合わせるよう指示します。この指針は永続化されるセッションの既定値ではありません。モデルは文字列形式ではオフセットを、ローカル形式では `time_zone` を引き続き渡す必要があり、Schedule がブラウザー・セッション・プロセス・モデルのコンテキストを読むことはありません。

Schedule は、不正なオフセットやゾーン、オフセットのない文字列、未来でない対象、夏時間の欠落期間内のローカル時刻を拒否します。夏時間の重複期間は最初の早い方の瞬間を選択します。作成成功時は正規化された UTC の `scheduledAt` のみを保存するため、リプレイが周囲のタイムゾーン状態に依存することはありません。

<a id="daily-wall-clock-input"></a>
## 日次ウォールクロック入力

`daily` は、`after_seconds`・`at`・`every_seconds`・weekly セレクター・cron セレクターと並ぶ、相互に排他的な作成セレクターの 1 つです。たとえば `daily: { time: '23:00:00', time_zone: 'Asia/Shanghai' }` は、該当する各ローカル日付でそのゾーンの 23:00 を選択します。exact オブジェクトには日付・オフセット・間隔のフィールドはありません。

```ts type-equiv
/** Daily local-time selector accepted by creation and timing edits. */
interface DailyInput {
  /** Local HH:mm:ss time with optional one-to-three fractional digits. */
  readonly time: string
  /** Explicit UTC or IANA Area/Location zone. */
  readonly time_zone: string
}
```

作成時は 1〜3 桁の小数部を任意に伴う `HH:mm:ss` を要求し、うるう秒と `24:00` を拒否し、明示的な IANA ゾーンを正規化して、`time` を `HH:mm:ss.SSS` として保存します。最初の `scheduledAt` は作成時刻より厳密に後です。存在しないローカル時刻や日付全体はスキップされ、重複期間はローカル日付ごとに早い方の瞬間を 1 回選択します。その早い方の瞬間が過ぎている場合、遅い方の重複は対象になりません。制約されるのは UTC 対象年の 0001〜9999 のみであり、UTC 範囲の端にあるローカル日付は 0 年や 10000 年に入る場合があります。

保存された次の対象は確定した UTC の瞬間です。ホストのデコーダーと再起動は、その瞬間をタイムゾーン規則に対して再解決せずに保持し、有効な保存済みゾーンエイリアスは正規名が変わっても読み取り可能です。後続の対象はホストの現在の IANA データを使います。次の対象は、配信決定より後であり、かつ選択された出現の日付より後のローカル日付にある必要があります。将来の UTC 対象を表現できない場合、作成は `time_out_of_range` で失敗します。

## 固定レート入力とキャッチアップ

`every_seconds` は 60 秒以上の safe-integer 間隔であり、作成時刻に合わせられます。日次のウォールクロック時刻ではなく経過時間を測ります。`every_seconds: 86400` はオフセット変更をまたいで `daily` の代用にはなりません。プロトコルは共有クールダウンやレコード横断の受け入れ規則を提供しません。後述の cron セレクターはウォールクロックのタイミングであり、固定レート間隔ではありません。

ホストが期限切れの Every・Daily・Weekly・Cron レコードを抱えて起動した場合、期限到来分のうち最新の出現のみを送信します。Every は配信決定後の現在の間隔アンカーに合う最初の対象へ進み、Daily・Weekly・Cron は前後のローカル日付規則に従います。逃した出現が蓄積されることはありません。次の UTC 対象を表現できない場合、配信はレコードを最新の受領証とともに inactive として保持します。

ワンショットは個別のフォローアップを生成します。同じスキャンで同じセッション向けに期限到来した繰り返しレコードは、`renderRecurringReminderBatchFraming` で描画される 1 つのフォローアップを共有し、レコードごとに最新の出現を 1 件含みます。1 分の最小値は固定レート間隔にのみ適用されます。配信は対象エージェントがアイドルになるのを待ちません。

<a id="cron-wall-clock-input"></a>
## Cron ウォールクロック入力

`cron` は相互に排他的な作成セレクターの 1 つです。その exact オブジェクトは、厳密な 5 フィールド Vixie 式 `minute hour day-of-month month day-of-week` と明示的な IANA ゾーンのみを持ちます。たとえば `cron: { expression: '*/15 9-17 * * 1-5', time_zone: 'Asia/Shanghai' }` です。フィールドの範囲は次のとおりです。

| フィールド | 許容範囲 | 注記 |
|---|---|---|
| minute | 0-59 | |
| hour | 0-23 | |
| day-of-month | 1-31 | |
| month | 1-12 | |
| day-of-week | 0-7 | `0` と `7` はどちらも日曜日を意味します。 |

各フィールドは `*`・単一値・`a-b` 範囲・`n >= 1` の `*/n` または `a-b/n` ステップ、およびそれらの形式のコンマ区切りリストを受け付けます。それ以外はすべて、問題のフィールド名を示すメッセージとともに `invalid_rule` で拒否されます。`L`・`W`・`#` 演算子、`JAN`・`MON` 名、`@daily` 形式のマクロ、秒フィールド付きの 6 フィールド式、範囲外の値、反転した範囲、ゼロステップ、空フィールドが該当します。この方言は 5 フィールドのため最小間隔は 1 分であり、分未満のスケジューリングは引き続き未対応です。

作成時は式を保存前に正規化します。正規化は各フィールドを一致する値集合へ展開し、その集合を決定的に再符号化します。重複値はつぶされ、隣接する値と範囲は統合され、一様なステップは `a-b/n` として、または `*` で始まったフィールドではスターステップとして（全値なら `*`、そうでなければ最も広いスターステップの歩みと残りの値）書かれ、ステップ `1` は落とされ、日曜日は `0` と書かれます。`*` で始まらなかったフィールドがスターステップになることはありません。各フィールドのスター標識を保持することこそが、後述の日・週ルールを保存式全体で Vixie に忠実に保ちます。永続化デコーダーは正規化されていない保存式を拒否します。

最初の対象は、そのゾーンでのローカル日付と時刻が一致する、厳密に未来の最初の瞬間です。Daily と Weekly のローカル時刻解決を再利用します。存在しないローカル時刻はスキップされ、曖昧な時刻はその日付について早い方の出現を 1 回取ります。確定した UTC の `scheduledAt` は再起動時に再計算されません。

日フィールドと曜日フィールドは Vixie の意味論に従います。一致する値とは無関係に、テキストが `*` で始まるフィールドがスターです。したがって `*/1` と `*/2` はスターであり、`1-31` と `0-7` は制限付きです。どちらかのフィールドがスターの場合、ローカル日付は両フィールドが一致したときのみ一致します。どちらもスターでない場合、どちらかのフィールドが一致したときに一致します。

cron のデコードは確定した瞬間と保存されたゾーン表記を保持し、正規化されていない保存式を拒否します。cron は現行ホストの `ScheduleRecord` にのみ属します。凍結された履歴セッションデコーダーはこれを受け付けません。

## 履歴セッションの変更

バージョン 1 の `schedule/change` イベントは履歴セッションデータとして引き続きデコード可能です。その作成型とフォールド型は `LegacyScheduleRecord` を使い、After・At・Every のみを受け付けます。Daily・Weekly・Cron は現行ホストの `ScheduleRecord` にのみ属します。ホストレコードのデコーダーは凍結された履歴デコーダーとは別です。タイトルが存在する前に書かれた作成レコードは `title` を持たないため、履歴デコーダーはその欠落メンバーを許容する一方、ホストデコーダーは引き続きそれを要求します。履歴イベントはストレージドメインに格納されず、配信を予定しません。これらのイベント内の既存リマインダーは `schedule_create` による明示的な再作成が必要です。暗黙のセッション移行や古い `at` レコードの変換は行われません。

```ts type-equiv
/**
 * Frozen Session event and fold vocabulary; daily rules belong only to Host storage.
 *
 * A version-1 event written before titles existed persists no `title` member, so
 * `after`, `at`, and `every` decode without one and stay readable. The Host task
 * record requires the member and never persists a record without it.
 */
type LegacyScheduleRecord =
  | LegacyAfterScheduleRecord
  | LegacyAtScheduleRecord
  | LegacyEveryScheduleRecord
```

```ts type-equiv
/** Creates one durable reminder record. */
interface ScheduleCreateChange {
  readonly version: 1
  readonly operation: 'create'
  readonly schedule: LegacyScheduleRecord
}
```

```ts type-equiv
/** Deletes one currently active reminder. */
interface ScheduleDeleteChange {
  readonly version: 1
  readonly operation: 'delete'
  readonly id: ScheduleId
}
```

```ts type-equiv
/** Records that one active one-shot reminder entered the durable dispatch history. */
interface OneShotScheduleDispatchChange {
  readonly version: 1
  readonly operation: 'dispatch'
  readonly id: ScheduleId
}
```

```ts type-equiv
/** Records one fixed-rate decision and advances directly past missed occurrences. */
interface EveryScheduleDispatchChange {
  readonly version: 1
  readonly operation: 'dispatch'
  readonly id: ScheduleId
  /** Wall-clock decision time used to select the latest due occurrence. */
  readonly acceptedAt: string
}
```

```ts type-equiv
/** Durable dispatch shapes supported by the current rule set. */
type ScheduleDispatchChange = OneShotScheduleDispatchChange | EveryScheduleDispatchChange
```

```ts type-equiv
/** Strict version-1 durable Schedule mutation union. */
type ScheduleChange = ScheduleCreateChange | ScheduleDeleteChange | ScheduleDispatchChange
```

履歴デコーダーとフォールドは、不明なバージョン・余分なフィールド・再利用された id・不正な遷移を拒否します。このイベントは [永続化カタログ](../persistence-catalog.md#schedulechange--log-only) に引き続き索引付けされます。セッション履歴は有効タスクの権威ではありません。

## 有効ビューと管理

ツール値は、保存レコードと現在のウォールクロックから導出されたタイミングを組み合わせます。ホストは配信に必要な場合に元のセッションを復元します。タスクの一覧表示と削除はそのセッションをアクティブ化しません。

```ts type-equiv
/** Current delivery timing derived from the durable record and wall clock. */
type ScheduleState = 'scheduled' | 'overdue'
```

```ts type-equiv
/** Host-driven delivery resumes the original Session when needed. */
type ScheduleDeliveryMode = 'host'
```

```ts type-equiv
/** Complete model-facing view of one active reminder. */
type ScheduleView = ScheduleRecord & {
  /** Whether the target remains in the future. */
  readonly state: ScheduleState
  /** Reminder delivery never leaves the owning session. */
  readonly deliveryMode: ScheduleDeliveryMode
}
```

[ツールカタログ](../tool-catalog.md#deepseek-aidsh-tool-schedule) は `schedule_create`・`schedule_list`・`schedule_delete`・`schedule_update` のスキーマを所有し、[`@deepseek-ai/dsh-tool-schedule`](../../packages/schedule/tool-schedule/README.md) がそれをマウントする各プリセットへ提供します。ホストサービスは保存と配信を所有します。作成・削除・更新はストレージドメインへの書き込みを確認応答します。ホスト全体のキューは、これらの変更を期限到来の配信に対して直列化します。タスクの削除は既にキューに入ったメッセージを除去しません。モデルツールは現在のセッションを対象にし、共有ホストの create・list・update・delete メソッドは明示的なセッション束縛を受け付けます。`create` と `update` は、委譲深度が 0 を超える委譲子が所有するセッションを `subagent_session` で拒否し、そのようなセッションへ配信は到達できません。4 つのモデルツールはツール層で委譲された呼び出し元を拒否する一方、`list`・`catalog`・`history`・`delete` はそのセッションへの提供を続けます。作成時はトリミング後に空でなく 120 文字以内の `title` が必須です。欠落・空白・長過ぎるタイトルは `invalid_prompt` で拒否され、作成時に指示文から導出することはありません。作成ビューと一覧ビューは指示文とともに保存された `title` を運び、`title` が欠落または不正な保存レコードはデコード時に拒否されます。

```ts type-equiv
/** Reminder creation selector, shared by the model consumer and Host service. */
interface ScheduleCreateRequest {
  /** Non-empty reminder text. */
  prompt: string
  /** Required task name of at most 120 characters, non-empty after trimming; names the card, detail heading, and task lists. */
  title: string
  /** Relative one-shot delay in seconds. */
  after_seconds?: number
  /** Absolute one-shot target. */
  at?: AtInput
  /** Fixed recurrence interval in seconds. */
  every_seconds?: number
  /** Daily wall-clock time in an explicit IANA zone. */
  daily?: DailyInput
  /** Weekly wall-clock time and explicit ISO weekday set in an IANA zone. */
  weekly?: WeeklyInput
  /** Five-field cron expression evaluated in an explicit IANA zone. */
  cron?: CronInput
}
```

```ts type-equiv
/** Session-scoped task list, without Agent activation. */
interface ScheduleListRequest {
  /** Original Session binding. */
  sessionId: SessionId
}
```

```ts type-equiv
/** Delete request identifying a task within its original Session binding. */
interface ScheduleDeleteRequest extends ScheduleListRequest {
  /** Task to remove. */
  id: ScheduleId
}
```

```ts type-equiv
/** Successful `schedule_delete` value, including the non-mutating not-found result. */
type ScheduleDeleteResult =
  | { readonly id: ScheduleId; readonly deleted: true }
  | { readonly id: ScheduleId; readonly deleted: false; readonly code: 'schedule_not_found' }
```

## Web カタログ

Remote の `schedule.catalog()` メソッドは、有効と無効のホストタスクを元のセッション束縛とともに、`scheduledAt` の昇順、次に `id` の辞書順で返します。セッションのアクティブ化や履歴読み取りなしに Schedule ドメインのみを読みます。ブラウザー利用者はこのブラウザーセーフな型を受け取ります。

```ts type-equiv
/** Durable Session inbox delivery acknowledgment, not model execution completion. */
interface ScheduleDeliveryReceipt {
  /** Canonical UTC target of the delivered occurrence. */
  readonly scheduledAt: string
  /** Canonical UTC time sampled after Session persistence acknowledged delivery. */
  readonly deliveredAt: string
  /** Identity of the delivered message, shared by tasks in one recurring batch. */
  readonly messageId: MessageId
}
```

```ts type-equiv
/** Browser-safe retained reminder with its original Session binding. */
type ScheduleCatalogEntry = ScheduleRecord & {
  /** Session receiving this reminder when it becomes due. */
  readonly sessionId: SessionId
  /** Inactive reminders remain visible but never schedule another delivery. */
  readonly status: 'active' | 'inactive'
  /** Most recent durably acknowledged inbox delivery, when available. */
  readonly lastDelivery?: ScheduleDeliveryReceipt
}
```

Remote の `schedule.list({ sessionId })`・モデルの `schedule_list`・セッションヘッダーのカタログは有効タスクのみを返します。モデルビューの導出タイミング `state` は、保存されたライフサイクル `status` とは区別されます。削除はエントリの元の束縛で `schedule.delete({ sessionId, id })` を使います。不一致の束縛は not found を返します。モデルツールは現在のエージェントのセッションを提供し、全体のユーザーインターフェースは選択されたタスクの束縛を提供します。束縛チェックだけでは呼び出し元の認可は確立しません。ペイロードのない `schedule/changed` イベントはクライアントの一覧を無効化し、再接続したクライアントは現在の状態を改めて取得します。

出荷される Web 構成はホストケイパビリティとともに `ui-schedule` をマウントします。[クライアントパッケージ](../../packages/client/ui-schedule/README.md) はカタログ・空状態・削除コントロールを所有します。このページは全件・有効・無効のタスクを別々に絞り込み、無効の詳細と元セッションのコントロールを詳細タブストリップに保持し、明示的に確認された削除を要求します。Rules タブと Records タブは、タスク設定と遅延ページングされる保存済み受領証を分離します。受領証も inactive 状態もモデルの実行を裏付けません。

## タイミング編集

`schedule.update({ sessionId, id, expected, change })` はセッションをアクティブ化せずに有効タスクを編集します。`expected` は余分なメタデータ付きのカタログエントリではなく、観測された完全な `ScheduleRecord` です。ホストはディスパッチや削除と同じ FIFO 内で現在のレコードと比較します。通常の配信が編集中に対象を進める場合があり、その古いスナップショットは現在の規則を上書きせず `schedule_conflict` を返します。欠落または不一致の束縛は `schedule_not_found` を返し、無効タスクは `schedule_ended` を返します。

```ts type-equiv
/** Timing-only edit; it may select a different recurrence kind than the stored record, and one-shot targets use an absolute `at`. */
type ScheduleTimingChange =
  | { readonly kind: 'at'; readonly at: AtInput }
  | { readonly kind: 'every'; readonly every_seconds: number }
  | { readonly kind: 'daily'; readonly daily: DailyInput }
  | { readonly kind: 'weekly'; readonly weekly: WeeklyInput }
  | { readonly kind: 'cron'; readonly cron: CronInput }
```

```ts type-equiv
/** Compare-and-update request within the original Session binding. */
interface ScheduleUpdateRequest extends ScheduleDeleteRequest, ScheduleUpdateContent {
  /** Complete record observed when editing began, including the committed target. */
  readonly expected: ScheduleRecord
  /** New timing; its kind may differ from the stored record's kind, and an omitted value keeps the committed target. */
  readonly change?: ScheduleTimingChange
}
```

```ts type-equiv
/** Successful current record, non-mutating lookup/conflict failure, or invalid name/instruction/timing. */
type ScheduleUpdateResult =
  | { readonly id: ScheduleId; readonly updated: boolean; readonly record: ScheduleRecord }
  | ScheduleUpdateMiss
  | ScheduleToolError
```

変更された Daily 規則は、保存されたローカル時刻とゾーンの意味論で厳密に未来の最初の対象を計算します。変更された Cron 規則は式を正規化し、同じローカル日付・欠落・早い方の重複規則で厳密に未来の最初の対象を計算します。変更された Every 間隔は、受け付けられた保存時刻にその間隔を加えた新しいアンカーを開始します。After や At のタスクは、同じ id の At レコードとして異なる絶対対象を受け取れます。これらの操作は保存された `title`・プロンプト・元のセッション束縛・ライフサイクル状態・すべての保存済み受領証を保持します。変更は異なる繰り返し種別を選択することもでき、同じ id・title・プロンプト・セッション束縛・状態・保存済み受領証で新しい規則から対象を再計算します。同等に正規化される規則は `updated: false` と変更なしのレコードを返します。保存の書き換え・対象のリセット・変更イベントの発行は行いません。表記が異なるだけの同等な Cron 式はこのような no-op です。比較は正規化された式と正規化されたゾーンを使うためです。

入力検証は既存のタイミングエラーを用います。変更された絶対対象は FIFO スロット実行時にも未来でなければなりません。成功したタスク put は変更通知とタイマー再計算に先行します。保存とライフサイクルの失敗は拒否されます。キャンセルはキューと初期化の待機後に確認されますが、実行中の書き込みを巻き戻せません。ワンショットレコードは編集形式の IANA ゾーンではなく UTC の瞬間を保持します。タイミング編集は履歴セッションイベントを追加しません。モデルは `schedule_update` により同じインプレース更新に到達します。これはタスクを削除して再作成するのではなく、読み取ったレコードと保存レコードを比較します。

## 保存済み配信記録

`schedule.history({ sessionId, id, limit })` はセッションをアクティブ化せずに保存済み受領証を読み取ります。明示的な limit は 1〜100 の safe-integer です。ページはウォールクロック順ではなく逆追加順に従い、任意のメッセージ id カーソルは前ページの最古レコードを除外します。新しい到着がそのカーソルをずらすことはありません。欠落タスクや誤ったセッション束縛は `schedule_not_found` を返し、不明なカーソルは空の成功ページではなく `delivery_cursor_not_found` を返します。

```ts type-equiv
/** Saved inbox delivery with its immutable sent prompt when recorded by this Host. */
interface ScheduleDeliveryRecord extends ScheduleDeliveryReceipt {
  /** Prompt sent for this occurrence; unavailable for legacy receipts. */
  readonly prompt?: string
}
```

```ts type-equiv
/** Explicitly bounded saved-delivery query within one Session binding. */
interface ScheduleDeliveryHistoryRequest extends ScheduleDeleteRequest {
  /** Required safe-integer page size from 1 through 100. */
  limit: number
  /** Message identity of the oldest entry in the previous page; excluded from this page. */
  before?: MessageId
}
```

```ts type-equiv
/** Configured limits applied when appending one task's delivery receipt. */
interface DeliveryRetentionBounds {
  /** Retained window in days, measured back from the acknowledgment being appended. */
  readonly days: number
  /** Maximum retained records per task; the newest survive. */
  readonly records: number
}
```

```ts type-equiv
/** Newest-first saved deliveries, or a non-mutating task/cursor lookup failure. */
type ScheduleDeliveryHistoryResult =
  | {
    readonly id: ScheduleId
    readonly records: ScheduleDeliveryRecord[]
    /** Whether earlier delivery records may be unavailable; missing receipts are never reconstructed. */
    readonly earlierRecordsUnavailable: boolean
    /** True only after an append removed saved records; absent legacy evidence is false. */
    readonly earlierRecordsPruned: boolean
    /** Current Host retention configuration, also used by the delivery writer. */
    readonly retention: DeliveryRetentionBounds
    /** Oldest returned message identity, present only when older saved records remain. */
    readonly nextBefore?: MessageId
  }
  | { readonly id: ScheduleId; readonly code: 'schedule_not_found' | 'delivery_cursor_not_found' }
```

新しいタスクは空の履歴で初期化されます。履歴のない古いタスク行は既存の最新受領証のみを公開し、以前の記録を利用不可と示し、読み取りで書き換えられることはありません。以後の確認応答はその受領証を保持し、指示スナップショット付きの実際の新しい受領証を追加します。失われた履歴や欠落したレガシーの指示スナップショットが再構築されることはありません。同一のタスク行書き込みが履歴・最新受領証・状態・次の対象を確定します。明示的なタスク削除は将来の配信を止め、タスク行を保存済み受領証とともに除去し、`list` と `catalog` から取り除きます。会話メッセージには影響しません。保存済み配信記録は、追加時に設定された `deliveryHistoryDays` ウィンドウ（各受領証の `deliveredAt` から遡って測定）と `deliveryHistoryRecords` 上限まで刈り込まれます。追加された最新受領証は必ず残り、刈り込まれたウィンドウは以前の記録を利用不可と示します。ページングは保存サイズや指示バイト数ではなく、返された記録数を区切ります。

## ホスト配信

ホストは起動時に永続化タスクを読み取り、タイマーを最も早い有効対象に合わせます。無効タスクは照会可能ですが、以後配信を予定しません。配信時はコールドセッションを含め、セッションコントローラー経由で元のセッションを解決します。復元後にウォールクロックを再測定し、ロールバック後に期限到来でなくなったものを除外します。それらのタスクはタイマー義務を保持します。Goal も個別の Run 完了記録もディスパッチに参加しません。

プラグイン由来の `followup()` はメッセージをセッション受信箱へ同期的に追加します。セッションフラッシュ成功後、1 回のタスクレコード put が指示スナップショット付きの保存済み配信を追加し、最新の `ScheduleDeliveryReceipt` をワンショットの `inactive` 状態または繰り返しタスクの次の対象と状態とともに保存します。同じバッチ内の繰り返しタスクは受領証の `messageId` を共有し、各受領証はそのタスクの配信出現時刻を保持します。配信が現在のターンを誘導・中断することはなく、モデルの完了を待ちません。

セッションの解決・メッセージのキュー入れ・永続化の確認の失敗は、タスクを保存したままホスト警告を報告します。後の管理変更やホスト再起動が再試行します。セッション永続化とタスク put はストア間でアトミックではありません。受信箱永続化後・タスク put 前のクラッシュは配信を重複させ得ます。受領証はこの隙間を閉じません。Schedule はモデル結果の確認応答・実行中断・外部通知チャネルを提供しません。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成されます（doc-sync 内の `pnpm run verify-cordis-catalog` で鮮度を検証、`pnpm run gen-cordis-catalog` で再生成）。言語面の差異はロケール固有の対訳文書パスのみです。署名ブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持します。ディスパッチモードは [primer](../cordis-primer.md#dispatch-modes) で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にあります。

<a id="ctxschedule--scheduleservice"></a>

### `ctx.schedule` — `ScheduleService`

共有管理サービス。読み取り・削除・タイミング編集はセッションをアクティブ化しません。

`sessionPersistence` は直接呼ばれるサービスではなくロード順の要件です。配信は `ctx.sessions.flush()` が `session/flush` リスナーの参加を報告した場合にのみ確定し、このサービスを提供する永続化バックエンドはそのリスナーを登録するプラグインです。

```ts cordis-catalog
/**
 * Create a reminder bound to the caller-selected Session without activating it.
 *
 * The request must supply a title; a missing, blank-after-trim, or over-long
 * title rejects with `invalid_prompt` instead of deriving one from the prompt.
 * A Session a delegated child owns rejects with `subagent_session`, because delivery
 * can never reach it: the child is one whose delegation depth is above zero.
 * The record is built from the clock reading taken before the request joins the
 * serialized queue, so a create that waits behind a longer operation keeps its
 * request-time anchor and may already be due when the queue reaches it.
 * @param sessionId - Original Session receiving the reminder.
 * @param request - Validated tool selector, required title, and reminder content.
 * @param signal - Optional cancellation checked before persistence begins, including after FIFO waits.
 * @returns The durably stored schedule. Cancellation does not roll back an in-flight write.
 */
async create(sessionId: SessionId, request: ScheduleCreateRequest, signal?: AbortSignal): Promise<ScheduleRecord>

/**
 * Read the selected Session's active tasks without resuming its Agent.
 * @param request - Session whose task list is requested.
 * @returns Persisted reminders in storage order.
 */
@Remote('list') async list(request: ScheduleListRequest): Promise<ScheduleRecord[]>

/**
 * Read all active and inactive Host reminders with their original Session bindings.
 * A deleted reminder has no row, so it is absent here.
 * Does not activate Sessions or read Session history.
 * @returns Reminders ordered by scheduledAt ascending, then lexicographically by id.
 */
@Remote('catalog') async catalog(): Promise<ScheduleCatalogEntry[]>

/**
 * Read saved inbox deliveries without activating or reading the original Session.
 * The task's own row supplies its binding, so its records stay readable through this lookup.
 * @param request - Session binding, task identity, explicit limit, and optional exclusive message cursor.
 * @returns Newest-first deliveries in append order, or a task/cursor lookup failure.
 * @throws ScheduleInputError when limit is not a safe integer from 1 through 100.
 */
@Remote('history') async history(request: ScheduleDeliveryHistoryRequest): Promise<ScheduleDeliveryHistoryResult>

/**
 * Delete one task belonging to the selected Session, leaving queued messages intact.
 *
 * The row is removed: the task no longer schedules, leaves `list` and `catalog`, and its
 * saved delivery records go with it. A task bound to a Session a delegated child owns
 * stays deletable even though creation and timing edits refuse that binding, so a task
 * stored before that rule existed remains removable.
 * @param request - Session and exact task identity.
 * @param signal - Optional cancellation checked before persistence begins, including after FIFO waits.
 * @returns Whether that Session owned a deleted task. Cancellation does not roll back an in-flight write.
 */
@Remote('delete') async delete(request: ScheduleDeleteRequest, signal?: AbortSignal): Promise<ScheduleDeleteResult>

/**
 * Update the name, instruction, and timing of an active task within the original Session
 * binding without activating the Session or changing saved deliveries.
 *
 * Each supplied field replaces its stored value; an omitted field keeps it. A name or
 * instruction change alone does not reset the committed target. A Session a delegated
 * child owns returns the non-mutating `subagent_session` result, so an edit cannot
 * re-arm a task bound to a Session delivery can never reach, and the Web editor can
 * explain the refusal through the ordinary result it already renders.
 * @param request - Task binding, complete observed record, and any combination of timing, name, and instruction.
 * @param signal - Cancellation checked after domain readiness and FIFO waits, before persistence begins.
 * @returns The committed record, unchanged record for a no-op, or a non-mutating input/lookup/conflict/refusal result.
 * Storage and lifecycle failures reject; cancellation after a write starts does not roll it back.
 */
@Remote('update') async update(request: ScheduleUpdateRequest, signal?: AbortSignal): Promise<ScheduleUpdateResult>
```

Types: [SessionId](core.md)

Source: [`packages/schedule/schedule/src/index.ts`](../../packages/schedule/schedule/src/index.ts)

<a id="schedule-events"></a>

### `schedule/*` events

<a id="schedulechanged--emit"></a>

#### `schedule/changed` — emit

永続化タスク集合が変更されました。クライアントは全体タスクとセッション有効カタログを再取得します。

```ts cordis-catalog
/** Durable task set changed; clients refetch global task and Session-active catalogs.
 * @mode emit
 */
'schedule/changed'(): void
```

Source: [`packages/schedule/schedule/src/types.ts`](../../packages/schedule/schedule/src/types.ts)
<!-- END GENERATED cordis-surface -->
