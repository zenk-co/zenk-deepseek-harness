---
description: "Host と browser 包用の環状両端待ち行列。償却定時待ち行列操作、除去項目の即時放出、有界空き貯蔵を要する場合に使う。"
kind: "package-library"
---

# @deepseek-ai/dsh-deque

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-deque` は Host と browser 包が各除去後に残り全項目を動かさずに長生き過程内待ち行列を排出できる。呼出者は尾に項目を追加し、先頭に前置し、先頭から償却定時操作で取り除く。両端待ち行列は項目順と裏付け貯蔵放出を所有し、各利用者は依然起床、失敗、取消、容量、過負荷動作を所有する。

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

### 使う場合

非同期作業にまたがり項目が溜まりうり、利用者が先入先出除去、任意先頭挿入、明示待ち行列消去を要する場合に `Deque<T>` を使う。最大寸が先頭除去費を無意味にする有限地域作業一覧は配列のままでよい。

### 入口点

両端待ち行列を取り込み、尾に項目を追加し、型が `undefined` を含みうる項目を取り除く前に `size` を確かめる。

```ts
import { Deque } from '@deepseek-ai/dsh-deque'

const frames = new Deque<string>()
frames.pushBack('first')
frames.pushFront('before-first')

while (frames.size > 0) {
  console.log(frames.popFront())
}
```

手法は待ち行列上限を課さず利用者失敗を翻訳しない。厳密 TypeScript 契約は [`src/index.ts`](src/index.ts) を見ること。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

両端待ち行列は環状配列に項目を貯める。項目除去はその枡を即時に消し、幾何成長と四分満収縮は写し作業を償却定時に保ち、先頭指標が無限に増える空き貯蔵を保ち続けるのを防ぐ。

### 源地図

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | 環状両端待ち行列操作と裏付け貯蔵寿命 |
| [`tests/deque.spec.ts`](tests/deque.spec.ts) | 先入先出、先頭挿入、巻回、成長、圧縮、消去、再利用の適用範囲 |
| [`benchmarks/drain.ts`](benchmarks/drain.ts) | 増大待ち行列寸にまたがる再現排出計時 |

</details>

-----

<a id="further-exploration"></a>
## さらに探る

- [実用包地図](../README.md) — 包群にまたがり共有される他の無依存素材。
- [線形流待ち行列決定](../../../.agents/notes/archived/bug-fix/2026-08-28-linear-stream-queue-drain.md) — 製品流が配列先頭除去の代わりにこの両端待ち行列を使う理由。

-----

<a id="model-experience"></a>
## モデル体験

なし。この過程内収集は模型対面の何も登録しない。

#### KV キャッシュへの影響

ここからは模型要求に何も入らないため、提供子緩衝再利用は変わらない。

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>

- **容量方針なし** — 両端待ち行列は項目を限らず、合体も拒否もしない。各利用者は流に適した過負荷動作を定めなければならない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
