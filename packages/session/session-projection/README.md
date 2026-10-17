---
description: "ログ由来のセッション単位状態の現在の全量値をクライアントのキャリアへ提供する開発者向け、および駆動契約のメンテナー向けの session-projection レジストリ。"
kind: "package-reference"
---

# @deepseek-ai/dsh-session-projection

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

クライアントが生のイベントログを再生することなく、現在のセッション単位状態 — todo、ゴール、conversation 統計など — を必要とするときに `dsh-session-projection` を使う。ドメインはコミットされたセッションイベントからの同期プロジェクションを定義し、クライアントはスナップショットと変更通知を通じて完全な、スキーマ検証済みの JSON 値を受け取る。スナップショットは返されるすべての値が反映する最後のイベントを識別するので、キャリアは状態を対応する履歴カットと対にできる。プロジェクション状態はコールド読み取りを高速化するためにチェックポイント化でき、host 専用のプロジェクションは host にプライベートなまま残る。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらなる探索](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

クライアントのキャリアがログ由来のセッション状態の現在の値を必要とするところに `dsh-session-projection` をマウントする。ドメインプラグインがユニットを登録し、キャリアがスナップショットを読み、変更フィードを購読する。どちらも他方を知らない。

### いつ選ぶか

ドメインが、クライアントが再導出なしに見るべき状態 — todo リスト、ゴールスナップショット、conversation 統計 — を保つときに選ぶ。レジストリはユニットをコミットされたイベント上で積極的に駆動するので、登録済みユニットの値は構造上常に最新である。クライアントが読まない host 専用の帳簿付けには使わないこと: `wire` ブロックのないユニットは host 専用のままである。host のリーダーはプラグインの `inject` で `sessionProjections` を宣言するか、レジストリまたは必須キーが欠落しているときに明示的に失敗する。コントリビューターは `ctx.inject(['sessionProjections'], ...)` を通じてオプションの登録を保つことができる。

### プロジェクション単位を定義する

ドメインは状態キーごとに 1 つの `ProjectionDefinition` を提供する: キー、状態スキーマ、初期状態、同期フォールド `apply(state, event)`、状態をクライアントビューに投影するオプションの `wire` ブロック、および状態フィールドまたはフォールドのセマンティクスが変わるたびにバンプされる `stateVersion` である:

```text
const definition = {
  key: 'todo',
  stateSchema: todoStateSchema,
  stateVersion: 1,
  init: (_header, _inheritedEventCount) => ({ items: [] }),
  apply: (state, event) => event.type === 'todo/upsert'
    ? { items: event.data.items }
    : state,
  wire: {
    viewSchema: todoViewSchema,
    view: state => ({ items: state.items }),
  },
}
```

`init(header, inheritedEventCount)` は軽量なメタデータと正確なフォーク継承カットの両方を受け取る。そのカットを `firstLiveSeq` や `session/end-seed` から推測してはならない。`apply` は同期でなければならず、ユニットに関係しないイベントには同じ状態参照を返さなければならない — 変更されていない参照は下流の作業がゼロであることを意味する。レジストリは連続する生の `wire.view` 結果を `Object.is` で比較する。オブジェクトまたは配列のビューは、内部のみの状態変更をまたいで公開を抑制するために参照を再利用しなければならない。構造的に等しい新しいオブジェクトも依然として変更である。状態を持つログイベントは、素のデルタではなく変更後の完全な状態を運ばなければならない。

### 登録と読み取り

`register(definition)` はユニットをインストールする。同じキーと `stateVersion` を持つ登録者はそのセルを共有し、互換性のないバージョンまたは無効な `stateVersion` はスローする。登録は呼び出し元ファイバー上のエフェクトなので、最後のアンロードがキーとそのキャッシュされたセルを取り除く。返されたディスポーザーを同じファイバー上の複合 `ctx.effect()` に yield して、依存するクリーンアップを通じてユニットを利用可能に保つことができる。キャリアは `snapshot(session)` でクライアント可視のすべてのユニットにわたる一貫した同期カット — `{ asOfSeq, values }`、ここで `asOfSeq` はすべての値が反映する最後のイベントの seq — を読み、`onChanged(listener)` で変更ごとの通知を購読する。`stateOf(session, key)` は無関係なビューを計算せずに 1 つのユニットのライブな読み取り専用 host 状態を読む。

```text
const dispose = ctx.sessionProjections.register(definition)
const { asOfSeq, values } = ctx.sessionProjections.snapshot(session)
```

プロジェクション状態を必要とするドメインは `sessionProjections` を Cordis サービス依存関係として宣言する。オプションのコントリビューターは `ctx.inject(['sessionProjections'], …)` の下で登録してよい。キャリアは `ctx.get('sessionProjections')` を使い、レジストリが存在しないときはそのブロックやフレームを省略する。

### 永続化されたチェックポイント

すべてのユニットの状態は — クライアント可視も host 専用も同様に — `checkpoint(session)` を通じてチェックポイント化され、姉妹の [session-projection-cache](../session-projection-cache/README.md) がそれらのチェックポイントを永続化するので、コールド読み取りは完全なログロードをスキップする。チェックポイントのウォーターマークは `SessionSeqCursor`（空のログでは `-1`）を使い、リプレイの開始は `SessionLogOffset` を使う。`restoreFloor` と `restore` は、既存のイベントとログのギャップを混同せずに読み取りレシピを実装する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションでは駆動機構とユニット契約を説明する。観察可能な契約は[このパッケージを使う](#use-this-package)で網羅されている。

### 設計概念

このパッケージはケイパビリティシームの Service Definition と駆動ロールである: フレームワークが駆動し、ドメインが計算する。レジストリは `session/event` を 1 回購読し、コミットされたすべてのイベントがすべての登録済みユニットの `apply` を積極的に通る（セルは最初のタッチで遅延構築される）。最初の `Object.is` ゲートは状態参照が変更されていないときにビュー作業をスキップし、2 スロットのライブ駆動キャッシュが前回の生のビューを再利用し、2 番目の `Object.is` ゲートが生のビュー参照が変更されていない間の公開を抑制する。キャリアは自身のページスライスと同じティックで `snapshot()` を読む。これが `asOfSeq` を 1 つの一貫したカットにしている。誤って非同期になったビューは Promise を返し、`wire.viewSchema.parse` に失敗する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: `SessionProjectionRegistry` サービス、`ProjectionDefinition`、スナップショットとチェックポイントの機構 |
| [`src/types.ts`](src/types.ts) | マージ拡張可能な `SessionProjectionMap` と `SessionProjectionStateMap` の型テーブル |

### 駆動とチェックポイントのフロー

コミットされた 1 つのイベントが、登録順にすべての登録済みユニットを駆動する。生のビューが `Object.is` で変わるクライアント可視ユニットは、スキーマ検証済みのビューと原因となった seq で変更フィードに通知する。ライブ駆動は前回と現在の生のビューを保持し、スナップショットとコールド読み取りは完全な独立した読み取りのままである。`checkpoint(session)` は永続化キャッシュのために、デタッチされた `(key → {ver, seq, val})` 行をユニットごとに 1 つ返す。`restoreFloor` は最低の使用可能ウォーターマークの 1 つ下のイベントにテール読み取りを固定し、縮んだログが検出されるようにする。`restore` は永続化された行を保存されたサフィックス上に再フォールドし、`ver` が一致しない行または保存された終端を超えるイベントを主張する行を破棄する。

</details>

-----

<a id="further-exploration"></a>
## さらなる探索

パッケージレベルの契約では足りないときにこれらのページを読むこと。ユニット契約から、読み取りモデルサブシステムと永続化キャッシュへと進む。

- [Session projections サブシステム](../../../docs/subsystems/session-projection.md) — プロジェクションユニット契約、駆動セマンティクス、生成されたサービス API。
- [Session 永続化サブシステム](../../../docs/subsystems/persistence.md) — プロジェクションが畳み込むイベントログ。
- [Session projection cache](../session-projection-cache/README.md) — コールド読み取りが完全なログロードをスキップできるようにする永続化チェックポイント。
- [Session パッケージマップ](../README.md) — 隣接する永続化、タイトル、テレメトリのパッケージ。
- [Session-projection RFC](../../../.agents/notes/proposed/architecture/2026-07-27-session-projection-and-command-log.md) — プロジェクションとコマンドログの設計根拠。

-----

<a id="model-experience"></a>
## モデル体験

なし。プロジェクションレジストリはすでにログに記録されたセッション状態のクライアント向け読み取りモデルを提供し、モデル向けのものを何も登録しない。

#### KV キャッシュ効果

なし。プロジェクションはプロバイダーリクエストを組み立てず、送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、プロジェクションレジストリが大規模で注意を要する箇所を定義する。これらは現在のパッケージ制約であり、タスクバックログではない。

- **すべてのテールページがすべてのクライアント可視キーを運ぶ** — キーごとのオプトアウトや遅延キーリクエストの形式はまだない。値が UI 規模の全量状態である間は許容でき、ドメインの値が大きくなったら再検討する。
- **ユニットテーブルはプロセス全体なので、キーの存在はセッション単位のケイパビリティシグナルではない** — 任意のエージェントプリセットが登録したキーがすべてのセッションのスナップショットに現れる。クライアントはキーの不在を機能の不在として扱うのではなく、値を読まなければならない。
- **積極的駆動はイベントごとにすべてのユニットに触れる** — 構造上安価である（全量値ルールと状態/ビューの参照ゲート）が、ホットパスならユニットごとのイベント種別プリフィルターが正当化される。
- **レジストリのセルはメモリ内にのみ住む** — 再起動は最初のタッチでログを畳み込んで再構築する。`dsh-session-projection-cache` をマウントする構成は代わりに永続化された行からそのフォールドをシードする。
- **同期ユニットの規律は部分的にしか機械的でない** — `wire.viewSchema.parse` は Promise を返すビューを拒否するが、ブロックする `apply` や壊れた非セッション状態を読む `apply` はレビューの関心事である。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
