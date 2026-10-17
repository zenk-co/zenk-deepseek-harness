---
description: "すべてのエージェント操作の背後にある永続レコードを構築・検査・拡張するユーザーとメンテナー向けの、イベントソーシング方式のセッションログとインメモリストア。"
kind: "package-reference"
---

# @deepseek-ai/dsh-session

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-session` はモデル可視のあらゆる事実を追記専用のセッションログに記録し、その記録からモデル履歴を派生させる。コンシューマーは履歴イベントを保持したままセッションを検査、再生、フォーク、フラッシュできる。コンパクションは置き換えられたエントリーを削除せずにアクティブな会話から隠す。永続化バックエンドを追加しない限りセッションはメモリに留まり、永続性チェックポイントは設定されたバックエンドを待つ。エージェントが再構築可能なセッションレコードを必要とする場所ではこのパッケージを選ぶ。モデルを呼び出すことはない。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

セッションが必要なすべての場所で `dsh-session` をマウントする。これはイベントソーシング方式の `Session` インスタンスをメモリ内に作成して保持する。永続ストレージは、`session/event` フィードを購読する永続化プラグインによって上に重ねられる。

### セッションを作成して検査する

`ctx.sessions.create()` は呼び出し元ファイバーに束縛されたライブセッションを構築する。`get(id)` と `list()` はセッションを見つけ、`fork()` はライブセッションの安定したプレフィックスから子セッションを作成する。

```text
const session = ctx.sessions.create(sessionId, { meta: { cwd: '/workspace' } })
ctx.sessions.get(sessionId)      // the live session
ctx.sessions.list()              // every live session, in creation order
```

### 追記と派生

`session.append(type, data, opts?)` は 1 つの型付きイベントをコミットする — ペイロードをスナップショットしてフリーズし、ロスレス JSON として検証し、オブザーバーに通知する。`session.deriveMessages()` はログをモデルが見る `Message[]` へ投影する。インクリメンタルかつキャッシュ付きで行う:

```text
session.append('user/message', { role: 'user', content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } },
  { surfaceOp: 'append' })
session.deriveMessages()         // the derived model history
```

サーフェスイベント（`system/message`、`developer/message`、`user/message`、`assistant/message`、`tool/result`）は、型付きイベントと append 入力の両方で `surfaceOp` を必要とする。置換は正確に `{ op: 'replace', startSeq, endSeq }` を使用し、現在のサーフェス順での両端を含む `SessionSeq` 端点を取る。アシスタントメッセージは自身の正確でコンパクトなプロバイダーストリームを埋め込み、`sourceEventSeqs` を禁止する。既知のログ専用イベントは両方のメタデータフィールドを禁止し、メッセージを生成しない。

`developer/message` はツール追加名と、以前の `request/header` への `headerSeq` 参照を格納する。参照は追加が存在するときに正確に必要であり、各名前はそのヘッダー内の正確に 1 つの完全なスキーマを識別しなければならない。削除はヘッダー参照なしでツールを名指す。履歴ヘッダーは再起動、フォーク、サーフェス置換をまたいで利用可能なままである。現在のレジストリと最新のヘッダーが、以前の追加の定義を選択することはない。`sourceEventSeqs` は派生と置換されたノードを引き続き記述する。

プラグインは内容を変更するイベントを `@messageProjection` で宣言し、`ctx.sessions.registerMessageProjection()` を通じて純粋な定義を登録する。Session はイベントを受け入れる前に定義を呼び出し、その不変のメッセージ更新をキャッシュする。定義が欠けている場合、append と restore は拒否される。使用中の定義のアンロードもキャッシュされた読み取りをブロックする。デタッチされたコンストラクターと `foldSurface(events, projections)` は明示的な定義を必要とする。再構築器はフォールドの `projectedMessages` を `deriveEventMessage()` に渡す。ライブインスタンスメソッドは同じプロジェクションを自動的に適用する。[プラグイン所有のメッセージプロジェクション](../../../.agents/notes/implemented/architecture/2026-09-11-plugin-owned-message-projections.md)が所有権とオフライン組み立てを定義する。

append、シード/リストア、およびイベントの採用/スナップショットは、入力を正規化する代わりに、あらゆる `header.system` と、正確に空の任意リクエストヘッダーフィールド（`tools: []`、`adapterDefaults: {}`）を拒否する。ツール結果の `data.error` は、ファーストクラスメッセージが `isError === true` を持つ場合にのみ許可される。失敗アイデンティティは任意のままである。拒否された append は、ログ、派生状態、イベントフィードを変更しない。採用はイベントローカルのメタデータを検証するが、参照された履歴や置換メンバーシップは検証しない。

`system/message` はレンダリングされたシステムプロンプトを保持する。最初のものがサーフェスノード 0 であり、準備済み呼び出しケイパビリティが承認を統治する。空でないレンダリングは、能力のないルートでは最初のシステムノードで統合され、継続中の `in-history` 系列ではキャッシュされた履歴の後に追記される。空のシステムノードはメッセージに投影されないため、プロンプトのクリアには、最新のものだけでなく、アクティブなすべてのシステムノードのログ記録された空置換が必要である。サーフェスフォールドは、ノード 0 が `system/message` である間、それを覆う置換を拒否する（置換イベント自体が正確にそのノードに対する `system/message` である場合を除く）。一方、後発のシステムノードは保護を持たず、コンパクション範囲がそれらをシャドウしてもよい（[決定](../../../.agents/notes/implemented/architecture/2026-09-02-system-prompt-as-surface-node.md)）。

### ログを読む

`session.seq` は配列を実体化せずに現在のログ長を読み取り、`session.eventAt(seq)` はシーケンス番号で 1 つの受け入れ済みでディープフリーズされたイベントを読む。`session.snapshotEvents(fromSeq?, toSeqExclusive?)` は半開区間のフリーズされた安定したスナップショットを実体化する。完全な現在のスナップショットは次の append までキャッシュされる。`eventAt()`、`snapshotEvents()`、`ownEvents()` は非推奨である。既存のロジックは今のところ移行されないままでもよいが、新しい本番呼び出しは禁止されている。リポジトリのテストファイルは、スコープ付き lint 許可の下でこれら 3 つのリーダーを使用してよい（[ポリシー](../../../.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md)）。長さだけを必要とする呼び出し元は `seq` を使う。

セッションログの位置には 2 つの数値型を使用する。`SessionSeq` は既存のイベントまたは両端を含むイベントウォーターマークを識別し、`SessionLogOffset` はギャップ、プレフィックス長、または読み取り境界を識別し、イベント数に等しくてもよい。`SessionSeqCursor` は `-1` の「まだイベントなし」値を追加し、`OptionalSessionSeq` は不在がデータである場合に `null` を使う。コンストラクターは非負の安全な整数を検証し、ブランドは実行時に消えるため、永続 JSON と wire の値は通常の数値のままである。

<a id="write-experimental-plugin-records"></a>

### 実験的プラグインレコードを書き込む

`appendPluginRecord(session, type, data)` は `packages/experimental/` 配下のパッケージ用に 1 つのプラグインレコードを追記する。`verify-plugin-record-callers` チェックは、このリポジトリ内の他の本番呼び出し元を拒否する。このリポジトリ外のプラグインもこれを呼び出してはならないが、それを検査できるリポジトリチェックはない。

各レコードは `@deepseek-ai/dsh-session/types` を通じて `PluginRecordMap` に宣言し、所有する実験的パッケージの `src/` に説明と明示的なペイロード型注釈を置く。名前は `plugin:<owner>/<record>` を使用する。`owner` はパッケージ名 `@deepseek-ai/dsh-experimental-<owner>` のサフィックスである。たとえば `plugin:pi-extensions/entry` である。TypeScript は各名前とペイロードをその宣言に対して検査し、ライターの実行時 JSON スナップショットはロスレスに保存できない値を拒否する。拡張定義またはその他の動的名は、宣言されたレコードのペイロード内に置く。

[実験的永続化カタログ](../../../docs/experimental-persistence-catalog.md)は、現在のプラグインレコード宣言を、そのオーナー、説明、ペイロード型注釈、ソースファイルとともに列挙する。これらの宣言は、`SessionEventMap`、展開された永続化スキーマ、リリース済みの型履歴、`KNOWN_SESSION_EVENT_TYPES` とは別のままである。レコードは `ignorable: true` を持ち、認識しないビルドはそれを保持し、読み取り時にスキップする。レコードがモデル可視のサーフェスに入ることはない。再開とフォークはログの残りとともにそれらを運び、Session フォーマットの移行はベストエフォートでそれらを保持する。

`pluginRecordOf(event)` はイベントをレコードとして返すか、その他のイベントに対して `undefined` を返す。各イベントをこれに渡す `ctx.sessionProjections` ユニットは、再開時にプラグイン状態を再構築する。現在のマップが名前を宣言していても、その `data` は `unknown` のままである。以前のビルドが異なるペイロードを書き込みうることと、V3 から V4 へのフォーマット端が未知の ignorable な V3 イベントを同じ `plugin:` 名前空間に改名しうることから、オーナーは使用前にそれを検証する。宣言の削除または改名は、保存されたレコードを破棄しない。[ignorable イベントの決定](../../../.agents/notes/implemented/architecture/2026-08-30-retain-ignorable-external-session-events.md)が互換性ポリシーを所有する。

### セッションをフォークする

`ctx.sessions.fork(source, boundary?, childSessionId?)` は、ライブソースから正確な両端を含むイベントプレフィックス（デフォルト: 最後のイベント）をコピーする。`dsh-session/fork` の `buildForkSeed` は、コピーされたイベントの後に継承マーカーを置き、オープンなステップにのみ欠落したエラーツール結果を追加し、そのステップとターンを `forked` 理由で閉じる。閉じられたステップとターンは、歴史的な欠落結果も含めて変更されない。マーカーとクローザーは子に属し、`inheritedEventCount` はコピーされたプレフィックスのみを数える。

論理フィールド `SessionHeader.isSeeded` は、位置を表す整数を露出することなく、フォーク履歴が存在するかどうかを報告する。`Session.inheritedEventCount` は正確に検証された `SessionLogOffset` を保持する。`ownEvents()` はそのカット以降のイベントを返し、`isOwnSeq(seq)` は既存の子所有の位置のみを受け入れる。低レベルのシード付きコンストラクターは明示的な `seed` と `inheritedEventCount` を供給しなければならない。コンストラクターシードは継承プレフィックスの後に子所有のセットアップイベントを含むことがあるためである。

### 永続状態をフラッシュする

`ctx.sessions.flush(session)` は待機可能な永続性チェックポイントをディスパッチする。すべての永続化リスナーがフラッシュし、呼び出しはそれらすべての後に決着する。即時の永続性バリアを必要とするプロデューサーは、ライトビハインドがドレインされたと仮定するのではなく、これを待機する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションでは、このパッケージが上記の動作をどのように実現するかを説明する。観察可能な契約は[このパッケージを使う](#use-this-package)で扱う。

### 設計概念

このパッケージはイベントソーシングに基づいて構築されている。`Session` は型付き `SessionEvent` の追記専用ログであり、それ以外のすべて — モデル履歴、トランスクリプト、テレメトリー、タイトル、永続化 — はそのストリームから派生する。サーフェスは派生プロジェクションである。インクリメンタルマネージャーが append 候補を検証し、コミットされたイベントから順序付きビューを前進させ、位置ベースの置換のために `replaceGeneration` を、置換とプラグイン所有のメッセージ変更のために `contentGeneration` を追跡する。モデル可視とはログ記録済みを意味する。モデルリクエストに到達するものは何でもログから再構築可能でなければならない。決着に到達した各モデル試行は 1 つのイベントをコミットする。`assistant/message` は組み立てられたモデル可視メッセージとそのコンパクトなタイム付きストリームを運び、`assistant/attempt` は失敗、再試行、キャンセル、ストリームエラーの試行をモデル履歴に追加することなく保持する。決着前のプロセスの強制終了は永続的な試行ストリームを残さない。

### リクエストヘッダー

`request/header` は、理由 `initial`、`resume`、`change`、`series` を伴う、非履歴リクエストエンベロープの完全な正規スナップショットを格納する。明示的なメッセージ系列の開始、サーフェス置換、またはプラグイン所有のメッセージ変更は、エンベロープが変更されていなければ `series` スナップショットを書き込み、同時に変更された場合は `startsSeries: true` を使用する。同一系列のステップ、リトライ、通常の後続ターンは最新のスナップショットを継承する。`adapterDefaults` はアダプターが解決した値と明示的な設定を区別し、`foldRequestHeader()` は最新のスナップショットを選択する。この自己完結型レコードは、メッセージ系列ごとの増加と引き換えに、部分ウィンドウのレンダリングと正確な再構築をサポートする。詳細は[再構築可能リクエストの Agent Note](../../../.agents/notes/implemented/architecture/2026-07-05-reconstructable-requests.md)が所有する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー。`SessionStore` サービス、ストアライフサイクル、`fork`、`flush` |
| [`src/types.ts`](src/types.ts) | `SessionEventMap`、`SessionEvent`、`UserMessage`、`SessionHeader`、`TurnEndReasonMap` |
| [`src/surface.ts`](src/surface.ts) | 順序付きサーフェスプロジェクション、置換検証、`deriveEventMessage` |
| [`src/request-header.ts`](src/request-header.ts) | `request/header` の畳み込みと再構築 |
| [`dsh-util-values`](../../util/values/README.md) | 共有のロスレス JSON 検証とデタッチされたスナップショット |
| [`src/repair.ts`](src/repair.ts) | 失敗したステップ、中断されたログ、フォークシードのための共有ツール結果リカバリー |

### append の検証

すべての append は共有の反復的な `snapshotJsonValue()` パスを使用する。これは各ネスト値を 1 回だけ読み取り、検証し、コピーするため、ステートフルなゲッターが検証とストレージに別の値を供給することはできない。ロスレス JSON でないペイロード（BigInt、循環、疎配列、`-0`、異質なプロトタイプ）は、バックエンドのフラッシュ前に append サイトで拒否される。append パスは各 `SessionSeq` を構築する。サーフェスイベントはさらに、マーカー形状、引用されたソースイベントシーケンス、置換のための完全なシャドウノードカバレッジを検証する。

### 共有リカバリー

`ToolCallRecovery` はイベント履歴を保持せずに、コミットされたイベントから未回答のリクエストを追跡する。AgentLoop はライブステップを観察する。クラッシュリカバリーとフォークシード構築は、`openTurnClosers` を通じてプレフィックスを再生する。ライブの失敗とクラッシュリカバリーはデフォルトで中断結果の文言を使用し、フォーク構築はフォーク原因を渡して独自の再試行ガイダンスを選択する。呼び出し元はステップを閉じる前にリカバリー結果を追記する（[参照](../agent-loop/README.md)）。

### 派生履歴

`deriveMessages()` はディープフリーズされたプロジェクションをキャッシュし、呼び出しごとに新しい配列を返す。サーフェスイベント型（`system/message`、`developer/message`、`user/message`、`assistant/message`、`tool/result`）は、記録されたメッセージアイデンティティと内容を供給する。空の内容の system ノードと developer ノードはメッセージに投影されない。プラグイン所有のプロジェクションは、記録されたメッセージを変更せずに派生内容を変更する。置換とプロジェクション決定はキャッシュを無効化する。埋め込まれた Assistant ストリームと `assistant/attempt` イベントは、再生と診断のデータに留まる。通常のプロンプトと注入されたコンテキストは、型固有またはソース固有の自動ラッパーなしで投影される。記録された内容内のあらゆるフレーミングはプロデューサーが所有する。

### リクエストヘッダー

ループは、各ループインスタンス境界と変更時に、完全な正規 `request/header` スナップショット（呼び出し設定、アダプターデフォルト、組み立てられたツールスキーマ — レンダリングされたシステムプロンプトは `system/message` サーフェスノードであり、ヘッダー状態ではない）をログに記録する。`foldRequestHeader(events)` は最新のスナップショットを選択してそれを再構築し、すべての会話リクエストをログの純粋関数にする。ルートメタデータ（`request/context`）は別個のログ状態であり、provider、model、容量、または `systemPromptUpdate` モードが異なる場合にのみ追記される。これはプロンプトとユーザー承認の後に実際の準備済み呼び出しのモードを記録するのであって、その承認決定を供給するのではない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

ほとんどのコンシューマーにはパッケージレベルの契約で十分である。周辺ドメインが必要なときにこれらを読む。

- [Session subsystem](../../../docs/subsystems/session.md) — 完全なイベント語彙、サーフェス型、生成されたサービス API。
- [Persistence subsystem](../../../docs/subsystems/persistence.md) — バックエンドがこのログをどのように永続化するか。
- [Core subsystem](../../../docs/subsystems/core.md) — セッションに書き込み、そこから派生するループ。
- [Generated persistence catalog](../../../docs/persistence-catalog.md) — すべてのセッションイベントと、そのペイロードおよび宣言サイト。
- [Core group map](../README.md) — コアパッケージがどのように構成されるか。

-----

<a id="model-experience"></a>
## モデル体験

### 派生メッセージ履歴

#### モデルが見るもの

モデルは、`system/message`、`developer/message`、`user/message`、`assistant/message`、`tool/result` サーフェスエントリーからの完全なメッセージを、ログ記録されたプロジェクションを適用した状態で受け取る（システムプロンプトが最初）。アイデンティティ、ロール、ソース、および変更されていないブロックは元の値を保つ。プロジェクションがアイデンティティを鋳造することはない。直接のプロンプトと注入されたコンテキストは別個の `user/message` イベントのままであり、そのソースが帰属を保つ。埋め込まれたストリーム、`assistant/attempt`、境界、その他のログ専用の事実はメッセージを追加しない。

#### トークンへの影響

追記されたサーフェスエントリーは後のステップで再送される。`replace` サーフェス操作は、生のログレコードを削除することなく、シャドウされたエントリーを将来の入力から取り除く。

#### KV キャッシュへの影響

追記されたサーフェスエントリーは再利用可能なプレフィックスを保つ。`replace` 操作は、基盤のイベントログが追記専用のままであっても、シャドウされた最初のメッセージから再利用を無効化する。

### ツール結果のリカバリーとフォーク結果

#### モデルが見るもの

リカバリーが、永続的な `tool/call` を持たないアシスタントのツールリクエストを見つけた場合、その合成 `TOOL_NOT_STARTED` 結果は `The tool call was interrupted before the Harness recorded it as started. Retry it if it is still needed.` と述べる。永続的な `tool/call` に結果がない場合、その `TOOL_OUTCOME_UNKNOWN` 結果は `The tool call was interrupted after it was recorded, but no result was durably recorded. Its outcome is unknown. Decide whether to retry from the tool semantics: retry only if the operation is read-only or idempotent; if it may have side effects, first verify external state or ask the user. Do not retry blindly.` と述べる。フォーク生成の結果は継承されたレコードのみを記述する。親は選択されたイベントの後に呼び出しを開始または完了した可能性がある。`TOOL_NOT_STARTED` はプレフィックスに start レコードが含まれないことを意味し、`TOOL_OUTCOME_UNKNOWN` は start はあるが結果がないことを意味する。どちらもモデルに、読み取り専用または冪等な操作のみをそれ以上の確認なしで再試行するよう伝える。副作用のある操作には外部検証またはユーザー入力が必要である。[fork 参照](src/fork.ts)を参照。

#### トークンへの影響

無傷のセッションではゼロトークンである。修復された各呼び出しは、保持されたリスク固有のエラーテキストを後のリクエストに追加する。

#### KV キャッシュへの影響

追記のみ。新たに可視化された内容は再利用可能なリクエストプレフィックスに従い、既存の KV キャッシュエントリーを無効化しない。

### ログ記録されたリクエストヘッダー

#### モデルが見るもの

Session はリクエストヘッダーからアクティブなツールスキーマと呼び出し設定を再構築する。プロバイダー固有の遅延宣言と保持宣言はディスパッチ時に派生される。`toolHistory()` はコミットされたヘッダーと developer メッセージに対するステートフルな畳み込みをキャッシュし、後続の読み取りでは未見のイベントのみを消費する。追加を履歴の `headerSeq` を通じて解決し、不変のスナップショットを返し、明示的なリクエスト系列または保持定義の変更で宣言を再開する。変更されていない定義で保持名を復元すると系列が継続し、記録された追加がそれを再提示する。ループリクエストとコンパクション呼び出しの両方がこの状態を使用する。一致する更新レコードを欠くヘッダーは、完全なアクティブ宣言を使用する。同名スキーマの変更は許可され、`in-history` ルートでもプレフィックスの再利用を無効化する。履歴ツールに対する登録時の拒否は先送りされている（[根拠](../../../.agents/notes/implemented/architecture/2026-09-20-dynamic-tool-updates.md)）。システムプロンプトは `deriveMessages()` の一部のままである。ヘッダーイベントはメッセージやプロンプトのコピーを追加しない。

#### トークンへの影響

ログ記録による重複トークンはゼロである。システムノードとスキーマは依然として通常のリクエストごとのコストを負う。

#### KV キャッシュへの影響

ログ記録は無効化を引き起こさず、正確な再構築がリクエストプレフィックスの同一性を保つ。設定やスキーマが変更された後発のヘッダーは、その最初の差分から再利用を無効化しうる。サーフェスノード 0 を置換するプロンプト変更は最初のトークンから再利用を無効化する一方、履歴内追記はキャッシュされた履歴までのプレフィックスを再利用可能に保つ。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、セッションストアが特別な注意を必要とする状況を定義する。これらは現在のパッケージ制約であり、タスクバックログではない。

- **ライブソースの Store API** — 永続化されているがアンロードされたソースは Host 観察パスを使用する。フォークはオープンなテールのみを閉じ、以前に閉じられたステップの欠落結果を修復しない。
- **`SESSION_FORMAT_VERSION` は[現在の論理表現](../../../docs/session-format-status.md)を名指す** — 現在のリーダーは廃止された `header.system` を拒否し、`system/message` ペイロードと保護先頭の書き換えを検証する。履歴ヘッダーと履歴イベントは隣接フォーマットパッケージに属する。[隣接移行チェーン](../../session/session-format-catalog/README.md)は `Session` を構築する前にサポート対象の履歴を変換し、書き込みオープンパスは現在フォーマットの後継のみを公開する。同バージョンの未知イベントは、エンベロープの明示的な `ignorable` マーカーを必要とする。これは安全な構造移行を約束するものではない（[メカニズム](../../../.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.md)）。変更がバージョン上げを必要とするかどうかは[リーダー互換性](../../../.agents/notes/implemented/process/2026-10-08-session-reader-compatibility-review.md)が決定する。
- **`TurnEndReasonMap` は ACP 名の `refusal` / `max_turn_requests` バリアントを省略する** — プロデューサー制: アダプターまたはループがそれらを最初に発行したときに導入される。
- **フォークを超えるセッションツリーはない** — 分岐したセッション上の pi 形式のエントリーツリーは、コンシューマーが境界ベースのフォーク以上のものを必要としない限り先送りである。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
