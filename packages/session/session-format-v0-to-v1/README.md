---
description: "Frozen released-v0 Session header, event, and packed-row decoder with the identity conversion to v1."
kind: "package-library"
---

# @deepseek-ai/dsh-session-format-v0-to-v1

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは各物理行を復号し、共有レイアウト v1 形式を生成して、リリース済み v0 セッション JSONL を復元します。バージョン 0 をバージョン 1 に変えるほかは検証済みヘッダーとイベントを保持し、v0 永続化が受け付けた有限の legacy 正規化のみ適用します。不正または未対応の履歴記録は現行 restorer 実行前に移行失敗となり、回復用にソースを保持します。移行は凍結ファーストパーティーイベント目録のみ受け付け、以後の形式移行の公開や選択はしません。

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

永続化は `dsh-session-format-catalog` 経由でこのエッジを取得します。機能構成はマウントしません。静的リリース形式カタログの組立てや試験時のみ直接インポートします。

### エントリーポイント

```text
const decoder = releasedV0SessionFormatCodec.createDecoder(physicalHeader, 'recoverable')
for (const row of physicalRows) decoder.decodeRow(row, migrationContext)
const inheritedEventCount = decoder.finish(migrationContext)
const stage = sessionFormatV0ToV1.createStage(stageInput)
stage.transformEvent(event, migrationContext)
const targetInheritedEventCount = stage.finish(migrationContext)
```

`releasedV0SessionFormatCodec` はパック済みアシスタントデルタと範囲符号化ソースイベント参照を含め、正確な v0 ヘッダーと物理行を読みます。そのデコーダーは `emitEvent()` と `emitRun()` 経由でスカラーイベントまたはコーデック所有のコンパクト実行のいずれかを送出します。`sessionFormatV0ToV1` は restore ごとに 1 つの状態付きステージを作成します。静的カタログはそのデコーダーとステージを接続するため、移行は物理行配列を保持しません。`releasedV1SessionFormatCodec` は通常イベント語彙を凍結せず、v1 物理レイアウト向けに同じ行単位デコーダーを公開します。

alpha エッジは凍結目録外のすべてのイベント型を拒否し、`ignorable: true` 印の不明イベントも含みます。予期しないペイロードメンバーも拒否します。`tool/result.meta` と入れ子 PTC `arguments` は明示の不透明 JSON フィールドのまま残り、セッション列解釈なしに保持されます。不明のコンテンツブロック `type`、メッセージソース `kind`、アシスタント終了理由 `kind`、`turn/end` 理由 `kind` アームは所有者不透明 JSON のまま残り、既知アームは構造検証を受けます。

有界の履歴正規化器は `steering/message` を `user/message` に変換し、`compact/*` イベントを `compaction/*` に改名し、`turn/start.trigger` を除去し、引退 `turn/end` 理由を変換し、legacy メッセージ、再試行チェーン、コンパクション群に現行メッセージラッパーと決定論的 ID を付加し、廃止 `request/header.header.messagePrefix` 重複を除去します。引退した `request/header-delta`、`mode/set`、および `request/header` フォールバック理由は移行を拒否します。他のイベント、参照、ソース、ペイロード事実は変更できません。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

物理コーデックは各パック行を不可分に検証し、コンパクト実行として送出し、解析済み入力を変異させません。回復可能復号は完全な不良行を落とし、以降に復号された `turn/end` が不良領域のコミットを証明しない限り prior 接頭辞を保持します。増分正規化器はメッセージ、再試行、開コンパクション同一性のみ保持します。カタログは最終現行成果物に完全関係検証を行います。

| File | Role |
|---|---|
| [`src/codec.ts`](src/codec.ts) | Frozen v0/v1 physical headers, packed rows, and source-event ranges |
| [`src/dispositions.ts`](src/dispositions.ts) | Released-v0 event and payload-member inventory |
| [`src/payload-validation.ts`](src/payload-validation.ts) | Frozen nested payload semantics for every released-v0/v1 event type |
| [`src/relationships.ts`](src/relationships.ts) | Frozen cross-event pairings: turns, steps, tool starts and results, retries, compaction, titles |
| [`src/migration.ts`](src/migration.ts) | Identity edge and legacy normalization |
| [`src/validation.ts`](src/validation.ts) | Exact source and target validation |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Migration machinery](../session-format/README.md) — pure chain and codec contracts.
- [Static catalog](../session-format-catalog/README.md) — build-owned assembly.
- [Session subsystem](../../../docs/subsystems/session.md) — current logical Session semantics.

-----

<a id="model-experience"></a>
## モデル体験

### 履歴復元

#### モデルが見るもの

直接なし。復元後、`deriveMessages()` は v1 配下で不変の正規 release-v0 イベントを見ます。有界の履歴形式は定められた現行ラッパー経由で同じモデル可視内容を生成します。

#### トークン効果

直接トークンゼロ。

#### KV キャッシュ効果

正規 v0 履歴に直接効果なし。有界正規化器は現行ラッパーと決定論的同一性を生成しつつモデル可視内容を保持します。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- **Closed first-party inventory** — 不明の外部プラグインイベントはこの alpha ポリシーで移行拒否となります。
- **One adjacent edge** — このパッケージは公開も以降移行の選択もしません。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
