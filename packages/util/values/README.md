---
description: "Lossless JSON validation, detached snapshots, deep freezing, structural equality, and exhaustive-union helpers for runtime packages."
kind: "package-library"
---

# @deepseek-ai/dsh-util-values

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

呼び出し側はケイパビリティパッケージのインポートなしに、損失なし JSON の検証、ストリーム引数の読取、JSON スナップショットの分離、公開値の deep freeze、JSON 互換データの比較、到達不能分岐の終了ができます。各ストリーム呼び出しは独自の `PartialArguments` リーダーを使います。`PartialArguments.EMPTY` はフィールドなしの共有封印ビューです。

## 目次

- [このパッケージの利用](#use-this-package)
- [実装の理解](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの利用

### JSON データの検証またはスナップショット

述語には `isJsonValue()` を使い、呼び出し側が分離コピーも必要な場合は `snapshotJsonValue()` を使います。両者は損失なし JSON ルートのみ受け付けます。`null`、真偽値、負ゼロ以外の有限数、文字列、密な組込み配列、列挙可能文字列キーを持つプレーンまたは null プロトタイプレコードです。循環、疎配列、シンボルまたは列挙不可 own プロパティー、関数、クラスインスタンスは拒否されます。

```ts
import { isJsonValue, snapshotJsonValue, type JsonValue } from '@deepseek-ai/dsh-util-values'

declare const input: unknown

if (!isJsonValue(input)) throw new TypeError('expected lossless JSON')
const snapshot = snapshotJsonValue(input) as JsonValue
```

### ストリーム引数の読取

`PartialArguments` は JSON オブジェクトのトップレベルフィールドを遅延読取します。`append()` は断片を走査や結合なしに別々に保持します。リーダーは新しいキー/値範囲を索引付けし、未要求内容を飛ばします。要求文字列のみ復号または計数し、要求された完全な非文字列値のみ解析します。`complete()` は検証済み内容ではなく閉じ区切りを報告します。`invalid` は索引付けや内容読取で既に発見したエラーを報告します。ツール入力検証の代替ではありません。

`refresh()` は公開時に prior 観測回答への変更を報告します。途中の読取は保留変更を確認しません。完了比較前に内容を評価するため、復号エラーが完了更新を抑制できません。文字列リーダーは復号テキスト、有界接頭辞、正確な UTF-16 長を提供し、変更検出向けに任意の step と offset を持ちます。`settle(finalText)` は断片を完全テキストと直接比較します。等価入力は同じビューを封印してキャッシュを保持します。欠落または競合デルタは新規封印ビューを生成します。`fromText()` と `fromObject()` も追記を拒否する封印ビューを作成します。`isSealed` は内容の走査や観測なしにその追記制限を読みます。`closed()` は閉じた外側オブジェクトや失敗索引付けも含みます。戻り値の区別は [the readers](src/partial-json.ts) を見てください。

### キー付き値の公開、比較、保持

`deepFreeze(value)` はオブジェクトグラフをその場で凍結し、同じ値を返します。列挙可能文字列キーの子をたどり、ライブ `AbortSignal` オブジェクトは意図的に可変のまま残します。`deepEqualJson(a, b)` は JSON 互換配列とレコードを構造比較します。呼び出し側は比較前に hostile または無制約値を検証しなければなりません。

`WeakMapWithValues<Key, Value>` は弱いオブジェクトキー検索と強保持の挿入順 `values` 集合を組み合わせます。各値は 1 キーに属します。所有者は対応ライフサイクル境界で `delete(key)` または `clear()` を呼ばなければなりません。コレクションは自動クリーンアップしません。

### 判別共用体の閉鎖

閉じた判別共用体の default 分岐で `assertNever(value, context?)` を使います。新規バリアント追加はすべての網羅 switch で TypeScript コンパイル失敗となり、宣言型を逃れたランタイム値は任意のコンテキストラベル付きでスローします。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

JSON 検証器は明示作業スタックを使い、有効祖先チェーンのみ追跡するため、深く入れ子の値は JavaScript 呼出しスタックを消費せず、繰返し非循環参照は有効のままです。組込み配列とプレーンオブジェクトは実行エンジンのネイティブコンストラクター表現で JavaScript レルムまたぎに認識されます。スナップショット書込みは `__proto__` のような名前も含め own データプロパティーを使います。値操作は引数のみから結果を導出します。`WeakMapWithValues` はインスタンス所有の関連のみ保存します。

### ソースマップ

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | JSON value type, validation and snapshot traversal, structural equality, deep freezing, weak-key/strong-value associations, and exhaustive-union failure |
| [`src/partial-json.ts`](src/partial-json.ts) | Lazy top-level argument scanning and observed-answer change detection |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Utility package map](../README.md) — adjacent stateless helpers.
- [Session subsystem](../../../docs/subsystems/session.md) — durable events that require lossless JSON.
- [Tools subsystem](../../../docs/subsystems/tools.md) — schema validation and canonical tool results built on `JsonValue`.

-----

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- **`deepEqualJson` assumes JSON-compatible inputs** — 一般オブジェクト比較子ではなく、プロトタイプ、シンボル、アクセサー、循環、マップ、集合の意味は定めません。
- **`deepFreeze` follows enumerable string-keyed children** — 任意ホストオブジェクトを不変データ化せず、ライブ `AbortSignal` インスタンスを意図的に飛ばします。
- **`WeakMapWithValues` requires explicit cleanup and unique values** — 所有キーの削除またはコレクションクリアまで値は強保持され、1 値を複数キーで共有してはなりません。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
