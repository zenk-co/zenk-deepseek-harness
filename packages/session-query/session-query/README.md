---
description: "コンシューマーとバックエンド作者向けの統合セッション履歴クエリサービス: ライブおよび永続セッションログに対する正確な読み取り、関係トレース、プロバイダー非依存のフィルター。"
kind: "package-reference"
---

# @deepseek-ai/dsh-session-query

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-session-query` は、アプリケーションコードがセッション履歴を一覧表示、フィルター、読み取り、検索し、境界付きのイベントコンテキストを検査し、セッションやイベントの関係をトレースできるようにする。読み取りは永続化されたコピーよりライブセッションを優先し、1 つの一貫した観測からデタッチされたクローンを返す。正確な読み取り、フィルター、トレースはサポートされる任意のストレージ構成で動作する。ランク付き全文検索には `dsh-session-query-sqlite` などのバックエンドが必要である。アプリケーションコードがモデルに提示された履歴へプログラム的にアクセスする必要がある場合に使用する。

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

セッションサービスやストレージバックエンドに直接触れることなくセッション履歴を読み取りまたは検索する必要がある場合、アプリケーションコードから `ctx.sessionQuery` を使用する。このサービスは具象バックエンドプラグインによって提供される — 同梱の構成は `@deepseek-ai/dsh-session-query-sqlite` ([README](../session-query-sqlite/README.md)) をマウントする — ので、このパッケージが単独でマウントされることはない。以下はバックエンドが構成されていれば `ctx.sessionQuery` で利用できる。

### できること

| 操作 | 得られるもの |
|---|---|
| `listSessions()` | すべての論理セッション (新しい順)。`live` と `persisted` の可用性フラグと任意の `formatStatus` 付き |
| `readSession(id)` | セッションをライブにすることなく、リプレイ検証済みの完全な生イベントログ |
| `filterSessions(filters)` | AND 結合されたメタデータと可用性述語に一致するセッション |
| `filterEvents(id, filters)` | メタデータとリテラルテキスト述語に一致するセマンティックイベントドキュメント |
| `readTitleSnapshots(ids)` | セッションごとの最新の折りたたみ済みタイトル。ソースヘッダーに束縛される |
| `listEvents(id)` / `readSurface(id)` | 軽量なイベントごとのレコード、または完全な現在のモデルサーフェス |
| `readEvent(request)` | 1 つの完全なイベントとその周辺の境界付き生ログウィンドウ |
| `traceSession(id)` | 既知の祖先チェーンと再帰的な子孫ツリー |
| `traceEvent(request)` | 1 つのイベントの位置的な置換と、引用されたソースイベントの関係 |
| `searchSessions(request)` / `searchEvents(request)` | 全文検索ページ。マウントされたバックエンドによって実装される |

ボディを持たないレコードは `SessionHeader.isSeeded` のみを公開する。イベントボディを返す読み取り (`readSession`、`readSurface`、`readEvent`) と保持された `SessionObservation` の値は、正確な `inheritedEventCount` も運ぶので、呼び出し元はログからカットを推測することなく、継承されたイベントと所有イベントを区別できる。

### フィルター

`SessionResultFilter` は id、nullable な cwd、作成時刻範囲、nullable な parent、またはソース可用性でセッションを絞り込む。`SessionEventResultFilter` は seq/time 範囲、イベント型、サーフェス、またはリテラルテキストでイベントを絞り込む。フィルター配列は AND 結合され、1 つの節内のリスト値は OR 結合される。空のリスト値は何にも一致せず、範囲は両端を含み、不正な範囲や未知の閉じたユニオンの値は `SESSION_QUERY_INVALID_FILTER` で失敗する。

テキスト節は、抽出されたセマンティックテキストに対するリテラルで大文字小文字を区別せず空白を柔軟に扱うスキャンであり、全文クエリではない。任意の部分文字列の再現にはこれを使用し、ランク付き全文結果が必要な場合はマウントされたバックエンドの検索メソッドを使用する。

### 構成

継承される設定項目は、マウントされたバックエンドの構成を通して設定する:

| フィールド | 既定値 | 意味 |
|---|---|---|
| `readWindowMax` | `50` | `readEvent` が受け入れる `before`/`after` の生イベント最大数 |
| `persistedReadConcurrency` | `4` | 1 回のバッチタイトル読み取りにおける並行永続ログ読み取り数 |
| `preparedSessionCacheSize` | `5` | `observeSession` 読み取りをまたいで再利用するために保持されるコールド準備済み Session 観測数 |

### 失敗とリカバリー

失敗は安定した `SessionQueryError.code` で型付けされる。遭遇するもの: id が存在しない場合の `SESSION_QUERY_SESSION_NOT_FOUND`、1 つのセッションのライブ観測と永続観測が不変ヘッダーで食い違う場合の `SESSION_QUERY_SOURCE_CONFLICT`、マウントされた永続化が読めない場合の `SESSION_QUERY_PERSISTENCE_FAILED`、永続レコードが Session 検証に失敗するか、ライブまたは準備済み観測が投影計算に失敗した場合の `SESSION_QUERY_CORRUPT_SESSION`、ロードされたログがサーフェス契約を破る場合の `SESSION_QUERY_INVALID_SURFACE`。投影の失敗は元のエラーを `cause` として保持する。既知のライブセッションを対象とする読み取りは永続化を参照しないので、失敗するバックエンドが現在のインメモリ履歴を読めなくすることはない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションでは、サービス背後の設計決定を説明し、それを実現するコードを示す。観察可能な挙動は[このパッケージを使う](#use-this-package)で完全に説明されている。

### 設計哲学

このサービスは 1 つの分離と 3 つのコミットメントに基づいて構築されている:

- **ライブ優先の論理コーパス。** すべての読み取りは 1 つの一貫した観測を解決する: ライブの `ctx.sessions` が優先し、任意の `ctx.sessionPersistence` が残りを埋め、競合する不変ヘッダーはマージではなく失敗する。
- **デタッチされた結果。** 返されるすべてのヘッダー、イベント、レコードはクローンされる。ライブ状態や保持された購読を公開するものはない。
- **正確な読み取りは具象、検索は抽象。** 読み取り、フィルター、トレースはここで 1 度実装される。バックエンドが所有する抽象サーフェスは 2 つの全文メソッドのみである。
- **1 つの正規サーフェス折りたたみ。** `listEvents`、`readSurface`、`traceEvent` は同じ `dsh-session` 折りたたみでログ全体を検証するので、検索とトレースはモデル履歴の派生と一致する。

決定の履歴は[統合サービス決定](../../../.agents/notes/archived/architecture/2026-07-23-unified-session-query-service.md)、[トレースノート](../../../.agents/notes/archived/feature/2026-07-13-session-query-tracing.md)、[SQLite プロバイダーノート](../../../.agents/notes/archived/feature/2026-07-10-sqlite-session-query-provider.md)にある。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | サービス定義: 抽象 `SessionQueryEngine`、具象読み取り、構成検証 |
| [`src/corpus.ts`](src/corpus.ts) | ライブ優先のコーパス解決、任意の永続化バインディング、バッチ投影 |
| [`src/observation.ts`](src/observation.ts) | 境界付きのリビジョンキー付き準備済み Session キャッシュを備えたライブ優先のポイント観測 |
| [`src/cold-read.ts`](src/cold-read.ts) | インメモリの中断ターンクローザーを備えたハンドルベースのコールドログ読み取り |
| [`src/types.ts`](src/types.ts) | 公開レコード、フィルター、リクエスト、ページ型 |
| [`src/config.ts`](src/config.ts) | 継承構成と閉じた `SessionQueryError` 分類 |
| [`src/filters.ts`](src/filters.ts) | プロバイダー非依存の述語とリテラルテキストスキャン |
| [`src/extraction.ts`](src/extraction.ts) | イベント型ごとのファーストパーティのセマンティックテキスト抽出 |
| [`src/documents.ts`](src/documents.ts) | サーフェス対応のセマンティックドキュメント投影 |
| [`src/tracing.ts`](src/tracing.ts) | ワンショットのセッション系統とイベント関係のトレース |
| [`src/sources.ts`](src/sources.ts) | 不変ヘッダーの互換性チェック |

### コーパス解決

`SessionCorpus` は任意の `ctx.sessionPersistence` をファイバーを通して束縛し、各読み取りをライブ優先で解決する: 既知のライブターゲットは永続化を参照せずにスナップショットされ、そうでなければセッションが一覧化され、短命な読み取りハンドルを通して完全に読み取られ、クローン前にライブアタッチメントの有無が再チェックされる。ターン途中でライターがクラッシュしたコールドログは、メモリ内で `interruptedTurnClosers` によって釣り合わされる — 永続化が読み取りによって変更されることはない。ヘッダーの互換性は、一覧化された観測とロードされた観測の間でアサートされる。バッチタイトル読み取りは 1 回のメタデータ一覧化と境界付き並行読み取りを実行し、セッションごとの失敗を分離しつつ、キャンセルはバッチ全体を拒否する。

### 観測キャッシュ

`observeSession` は一覧化の事前チェックなしでポイント観測を構築する。ライブ観測はカットを現在のログ長に固定し、最初の読み取りで `events` を具体化するので、ヘッダー、カーソル、または投影のみのコンシューマーがログをコピーすることはない。ログは追記しか行われないので、遅い最初の読み取りでも正確にそのプレフィックスが得られる。コールドパスはまず保存されたセッションを stat し、永続化インスタンスと `stat` リビジョンでキー付けされた自身の境界付きキャッシュを参照する: 変更のないリビジョンは、ログを再読み取りせずに復元された未公開 Session を再利用し、変更されたリビジョンまたは置き換えられた永続化インスタンスはハンドルシームを通して再ロードし、エントリーを置き換える。キャッシュは `preparedSessionCacheSize` 個のエントリーを LRU 追い出しで保持し、アクティブな観測リースにピン留めされたエントリーが追い出されることはなく、読み取り中にライブになったセッションはライブパスを再試行する。

### 読み取りとトレース

`readSession` は resume の検証を再利用するために `Session.create` を通してログをリプレイする。`readSurface`、`listEvents`、`traceEvent` は 1 つの `foldSurface` パスを共有し、イベントを `current`、`shadowed`、`log-only` に分類し、0 始まりの連続 seq、サーフェスマーカーの適格性、置換または引用の整合性を検証する。違反があれば `SESSION_QUERY_INVALID_SURFACE` で失敗する。トレースはワンショットである: セッション系統はコーパスを 1 度読み取り、親と子孫ツリーを決定論的にたどり、イベントトレースは位置的な置換子を最終ノードまでたどりつつ、引用元リンクを非推移的に保つ。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときにこれらのページを読む。共有クエリ語彙から具象バックエンドと決定の証拠へと進む。

- [Session Query subsystem reference](../../../docs/subsystems/session-query.md) — 完全な型レベルの契約: レコード、フィルター、検索ページ、系統、境界付き読み取り、エラー。
- [dsh-session-query-sqlite](../session-query-sqlite/README.md) — 同梱の全文バックエンドとそのインデックスライフサイクル。
- [dsh-tool-session-query](../../experimental/tool-session-query/README.md) — このサービス上に構築されたモデル向けのコンシューマー。
- [Session query relationship tracing](../../../.agents/notes/archived/feature/2026-07-13-session-query-tracing.md) — トレースのセマンティクスと検証境界。
- [SQLite FTS5 session search](../../../.agents/notes/archived/feature/2026-07-10-sqlite-session-query-provider.md) — 検索サーフェスの実装と調整の方法。

-----

<a id="model-experience"></a>
## モデル体験

なし。この信頼されたクエリサービスはクローンされたレコードを呼び出し元にのみ公開し、モデル向けのものを何も登録しない。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立てることも送信することもない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このパッケージが不適切な選択となる、または特別な運用上の注意を要する条件を定義する。これらは現在のパッケージ制約であり、タスクのバックログではない。

- **呼び出し元の認可はない** — これは信頼されたコンテキスト全体のインフラストラクチャである。モデルツールや UI が、呼び出し元が検査できるセッションを制限しなければならない。
- **プロバイダーコーディネーターやフォールバックはない** — サービスは検索に関して抽象的であるため、構成は具象バックエンドをマウントしなければならない。検索プロバイダーレジストリやフォールバック実装は存在しない。
- **正確な読み取りはログ全体をリプレイする** — `readSession`、`readSurface`、`filterEvents`、イベントトレースは完全な論理ログをロードして検証するので、非常に大きな履歴は呼び出しごとに完全な検査コストを払う。`listSessions` は軽量のままである。
- **リテラルテキストスキャンであり全文検索ではない** — `text` フィルターは抽出されたドキュメントを正規表現でスキャンし、ランク付けしない。ランク付き検索にはマウントされたバックエンドが必要である。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発者ノートはメンテナー向けの作業コンテキストである: 未解決の設計上の問いと、決定されていない方向性。明示的に非権威である — 出荷済みの挙動、制限、受け入れられた根拠は、上記のセクション、パッケージコード、リンクされた Agent Notes にある。

#### 将来: エクストラクターと検索プロバイダーのレジストリ

引用されたソースイベントを通る再帰的走査、エクストラクターと検索プロバイダーのレジストリ、追加のモデル向けサーフェスは先送りされている。[tool-session-query README](../../experimental/tool-session-query/README.md) が現在のコンシューマーサーフェスを文書化している。

</details>
