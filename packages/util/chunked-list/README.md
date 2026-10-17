---
description: "投影状態用の不変追加専用一覧。有界追加写し、挿入順反復、Zod 検査点検証付き。"
kind: "package-library"
---

# @deepseek-ai/dsh-chunked-list

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-chunked-list` は呼出者が全収集を写さずに初期一覧版を保ちつつ値を追加できる。呼出者は挿入順に全値を反復し、自身値 schema で JSON 検査点を検証できる。副応答者目録は不変投影状態にそれを使う。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに探る](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と後回しの作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

不変版と JSON 適合貯蔵の要る追加専用収集にこの一覧を使う。空一覧は `undefined` であり、追加は既存節を変えずに新頭を返す。一覧は貯蔵値を参照で共有するため、呼出者はそれらを不変として扱わなければならない。

```ts
import { appendChunkedList, iterateChunkedList } from '@deepseek-ai/dsh-chunked-list'

const first = appendChunkedList(undefined, 'first')
const second = appendChunkedList(first, 'second')
console.log([...iterateChunkedList(second)])
```

例は `['first', 'second']` を生じ、`first` は依然元の値のみを含む。`chunkedListSchema(valueSchema)` は JSON 検査点を検証し、未知項目、不正値、空または過大塊を拒む。含む項目が空一覧も許す場合は schema に `.optional()` を使う。操作は[源契約](src/index.ts)を見ること。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

最新塊は最大 64 値を貯める。追加はその塊までを写し旧節を共有するため、有界 O(1) 作業である。容量は貯蔵配置を制御し、全一覧長ではない。反復は全 N 値を O(N) 時間で訪れ、古い方から新しい方へ塊を訪れるのに O(N / 64) 作業域を使う。単一容量定数が追加繰上と再帰 Zod 検証を統治する。

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | 持続一覧操作と検査点検証 |
| [`tests/chunked-list.spec.ts`](tests/chunked-list.spec.ts) | 版隔離、順序、構造共有、検査点受容の適用範囲 |

</details>

-----

<a id="further-exploration"></a>
## さらに探る

- [実用包地図](../README.md) — 共有素材。
- [副応答者目録決定](../../../.agents/notes/implemented/architecture/2026-09-01-parent-owned-subagent-catalog.md) — 投影状態が塊を使う理由。

-----

<a id="model-experience"></a>
## モデル体験

なし。この収集は模型対面の何も登録しない。

#### KV キャッシュへの影響

ここからは模型要求に何も入らないため、提供子緩衝再利用は変わらない。

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>

- **追加専用到達** — 除去や無作為到達の要る呼出者は他収集が必要である。
- **再帰検査点** — JSON 直列化と schema 検証は実行時入れ子限りに従うままである。貯蔵値は呼出者の直列化形式を支えなければならない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
