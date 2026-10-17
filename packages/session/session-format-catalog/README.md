---
description: "Build-static first-party Session format codec and adjacent migration assembly for persistence readers."
kind: "package-library"
---

# @deepseek-ai/dsh-session-format-catalog

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-session-format-catalog` はマウント済みプラグインに相談せず、永続化に 1 つの決定論的セッション形式リーダーを与えます。最古対応形式から[現行ライター形式](../../../docs/session-format-status.md)までのコーデックと隣接エッジを組み立て、モジュール初期化時に完全な無間隙チェーンを確認し、`sessionFormatCatalog` 経由で物理発送、ヘッダー限定分類、単一パス行復元、現行記録符号化を公開します。

## 目次

- [このパッケージの利用](#use-this-package)
- [実装の理解](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの利用

### 利用すべき場面

機能プラグインのマウント前に完全なファーストパーティーリリース形式目録を必要とする永続化および test-support リーダーからこのライブラリーをインポートします。機能構成はそのエントリーを登録も並替えもしません。

### エントリーポイント

```text
const descriptor = sessionFormatCatalog.readHeader(physicalHeader)
const catalog = createSessionFormatCatalogWithChildren(childFacts)
const restore = catalog.createRestore(physicalHeader, { recovery: 'recoverable', validation: 'transformed' })
for (const row of physicalRows) restore.decodeRow(row)
const current = restore.finish()
const headerRecord = sessionFormatCatalog.encodeCurrentHeader(current.header, current.inheritedEventCount)
const eventRecords = current.events.map(sessionFormatCatalog.encodeCurrentEvent)
```

パッケージルートから `sessionFormatCatalog` をインポートします。JSONL およびフィクスチャーリーダーは 1 つの restore を作成し、解析済み物理行を `decodeRow()` に送り、最後に一度 `finish()` を呼びます。ライターは返却現行成果物を `encodeCurrentHeader()` と `encodeCurrentEvent()` で直列化します。一覧は `readHeader()` を呼び、イベント本体を開きません。

製品履歴読取は `{ recovery: 'recoverable', validation: 'transformed' }` を選択します。ワーカーおよびフィクスチャー検証は `{ recovery: 'strict', validation: 'current' }` を選択します。変換検証は移行後に release-current 規則を実行しますが、既に現行の入力には導入済み意味検証を意図的に飛ばします。

カタログは対応履歴リーダーをすべて直接含みます。プロファイルは機能プラグインのマウントでエッジの追加、除去、並替えはできません。`dsh-session` への peer 依存は導入済み現行イベント語彙と現行復元規則を提供し、履歴エッジ検証器は凍結のままです。ブラウザー安全 `./message-projections` 公開は分離コンストラクターとサーフェス畳み込み向けに現行プラグイン所有インタープリターを組み立てます。回復リスナーはマウントしません。

`createSessionFormatCatalogWithChildren(childFacts)` は組立て時に明示子証拠を V3→V4 に束縛します。[catalog-completion 仕様](../session-format-v3-to-v4/README.md) を見てください。`historicalSessionFormatCatalog` は固定 release-V3 イベント語彙で V0〜V3 を復元し、子前提条件をそのカタログ再帰完了なしに収集します。無視可能 V3 拡張は導入済みライターが名前を知っていても不透明のままです。分離 transcript 再送は明示的に空配列を提供します。永続化は利用可能な完全直接子集合を収集しなければなりません。提供証拠はカタログ存続期間不変に保ちます。各 restore は独立ステージ状態を所有します。静的 `sessionFormatCatalog` はヘッダーとネイティブ現行形式読取を対応します。履歴本体読取は子束縛カタログが必要です。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

[`src/generated.ts`](src/generated.ts) はコーデックとエッジ順序の静的所有者です。[`src/current.ts`](src/current.ts) は最終ヘッダー、エンベロープ、メッセージ、サーフェス、シード、現行要求ヘッダー検証を導入済みセッション意味に委譲します。低レベルコンストラクターはセッション読取開始前に重複コーデック、重複エッジ、間隙、現行バージョン超過エントリーを拒否します。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Migration machinery](../session-format/README.md) — catalog construction and dispatch behavior.
- [Released v0 to v1 edge](../session-format-v0-to-v1/README.md) — codec and validator ownership.
- [Released v1 to v2 edge](../session-format-v1-to-v2/README.md) — Assistant stream embedding and cardinality-changing reference remapping.
- [Released V2 to V3 specification](../session-format-v2-to-v3/README.md#v2-to-v3-specification) — transformations, preservation, and refusal.
- [V3 to V4 specification](../session-format-v3-to-v4/README.md#v3-to-v4-specification) — conversion, reference remapping, and delivery-generation validation.
- [JSONL persistence](../session-persistence-jsonl/README.md) — immutable generation naming and exclusive publication.

-----

<a id="model-experience"></a>
## モデル体験

### カタログ発送

#### モデルが見るもの

直接なし。カタログは要求再構築が消費する `SessionEvent` 履歴のみ復元します。

#### トークン効果

直接トークンゼロ。

#### KV キャッシュ効果

直接効果なし。復元履歴はそのコンシューマーでキャッシュ同一性を決定します。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- **First-party build inventory only** — 外部移行所有と配布は未対応です。
- **Generated ordering is closed** — ランタイムプラグイン登録は欠落履歴エッジを提供できません。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
