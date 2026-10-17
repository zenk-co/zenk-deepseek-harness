---
description: "純粋な隣接セッションフォーマット計画、ロスレス JSON 値検査、ヘッダーのみのマイグレーション、物理コーデック配送。"
kind: "package-library"
---

# @deepseek-ai/dsh-session-format

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-session-format` を使うと、現在のセッションを直接復元する永続化コード、または物理行を 1 回ずつ消費しながら隣接マイグレーションの唯一の連続を構成できる。復元は呼び出し元所有のパース済み値を中間成果物コピーや凍結なしにステートフルな段階を通じて転送する。物理フレーミング、圧縮、不変な生成命名、排他的公開、Cordis ライフサイクル動作はこのライブラリの範囲外である。

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

### 使う場合

物理セッションヘッダーを分類し、現在の論理値を復元し、リリース済みの隣接マイグレーションを構成しなければならない永続化またはフォーマットカタログのコードからこのライブラリを使う。Cordis プラグインではなく、プロファイルのマウント行はない。

### エントリーポイント

```text
const catalog = createSessionFormatCatalog({ currentVersion, codecs, currentEncoder, migrations, restoreCurrent, restoreTransformedCurrent, restoreCurrentHeader })
const descriptor = catalog.readHeader(physicalHeader)
const restore = catalog.createRestore(physicalHeader, { recovery: 'recoverable', validation: 'transformed' })
for (const row of physicalRows) restore.decodeRow(row)
const current = restore.finish()
const headerRecord = catalog.encodeCurrentHeader(current.header, current.inheritedEventCount)
const eventRecords = current.events.map(catalog.encodeCurrentEvent)
```

`createSessionFormatCatalog()` はサポートする各表現のための各バージョン 1 つのコーデック、現在のレコードエンコーダー、隣接バージョン対ごとの 1 つのマイグレーション、現在の成果物とヘッダーの復元器を受け取る。`readHeader()` はイベントを読まずに `current`、`migration-required`、`unsupported`、`malformed` のいずれかの記述子を返す。ボディ読み取り器は復元を 1 つ作成し、パース済みの物理行を各々 `decodeRow()` に通し、最後に `finish()` を 1 回呼ぶ。書き込み器はそのヘッダーとイベントをレコードごとに符号化する。確立されたレコード意味は安定したままである。[互換性レビュー](../../../.agents/notes/implemented/process/2026-10-08-session-reader-compatibility-review.md)は同バージョン追加を統治する。

`recovery` オプションは厳密な行失敗か回復可能な接尾辞扱いかを選択する。`validation: 'current'` はインストール済みの現在のフォーマット検証をすべて適用する。`validation: 'transformed'` は歴史的マイグレーション後にリリース済みの現在のフォーマット検証を適用し、すでが現在の入力にはそのコーデックの物理検証のみを受けさせる。

回復可能なデコーダーは受け入れ済み論理プレフィックスを返す。コーデックは不正または順序欠落の行 1 つとその未コミット接尾辞を落としてよいが、後にデコードされた `turn/end` が元の問題を致命化する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

チェーンは構築時に一意で隙間のない順序を検証する。ソースカットは EOF まで不明な場合がある。ヘッダーカットを要求する段階はその不在を拒否し、マーカー起点の段階は放出イベントからそれを導出する。各段階は終了時に正確な目標カットを返し、事前宣言されたカットは一致しなければならない。カタログは状態付き隣接イベント変換器を持つ 1 つの行デコーダーを構成し、その有界状態と最終的な現在イベントのみを保持し、`finish()` 時に目標検証を行う。その結果を公開するかどうかと方法を決めるのは呼び出し元のみである。

| ファイル | 役割 |
|---|---|
| [`src/chain.ts`](src/chain.ts) | 隣接計画構築と現在のバイパス |
| [`src/catalog.ts`](src/catalog.ts) | 物理バージョン配送とヘッダー分類 |
| [`src/json.ts`](src/json.ts) | デタッチされたロスレス JSON スナップショットと共通座標検査 |
| [`src/filename.ts`](src/filename.ts) | 永続化、エクスポート、フィクスチャが共有する正規 `session[.vN].jsonl` ベース名 |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [リリース済み v0 から v1 の辺](../session-format-v0-to-v1/README.md) — 凍結された歴史的デコードと identity 変換。
- [静的カタログ](../session-format-catalog/README.md) — ファーストパーティのコーデックとマイグレーション集成。
- [JSONL 永続化](../session-persistence-jsonl/README.md) — 永続的なフレーミングと生成公開。

-----

<a id="model-experience"></a>
## モデル体験

### セッション復元

#### モデルが見るもの

直接は何もない。コンシューマーは `deriveMessages()` を通じて検証済み現在成果物からモデル履歴を再構成する。

#### トークンへの影響

直接のトークンはゼロ。

#### KV キャッシュへの影響

直接の影響はない。現在履歴を変えるマイグレーションは要求再構成が所有するキャッシュ identity を変え得る。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **最終的な現在履歴は常駐する** — ストリーミングは有界の中間状態のみを保持するが、返される現在のイベント配列と必要な順序再対応表はイベント数に対して O(イベント数) になる。
- **隣接する整数バージョンのみ** — このライブラリはスパン、安定イベント identity、一般参照書き換え代数を公開しない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
