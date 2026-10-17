---
description: "dsh-v0.1.5-alpha.2 向け遡及セッション永続型と隣接版変更。"
kind: persistence-release
---

# 永続版: dsh-v0.1.5-alpha.2

日本語 | [English](dsh-v0.1.5-alpha.2.en.md) | [中文](dsh-v0.1.5-alpha.2.zh.md)

## 概要

deliverables/presented と subagent/catalog が加わる。feedback 記録は任意 category を得て、feedback/record 文は任意になり、書記形式は 3 のままである。

## 目次

- [版証拠](#evidence)
- [宣言](#declaration)
- [構造変更](#changes)
- [検証](#verification)
- [開発メモ](#dev-note)

-----

<a id="evidence"></a>
## 版証拠

この概算後埋めは読み取りと形式検証を支え、同時代の互換承認ではない。抽出と適用範囲の限りは[書庫参照](README.md)を見ること。

| 項目 | 記録値 |
|---|---|
| 源札 | `dsh-v0.1.5-alpha.2` |
| 源日時 | 2026-09-09T14:13:03.000Z |
| 版記録 | Release 対象あり。 |
| 前版 | [dsh-v0.1.5-alpha.1](dsh-v0.1.5-alpha.1.md) |
| セッション書記版 | 3 |
| 再構成目録 | <!-- persistence-release-inventory:start -->59 roots / 462 types<!-- persistence-release-inventory:end --> |
| この snapshot | [dsh-v0.1.5-alpha.2.schema.json](dsh-v0.1.5-alpha.2.schema.json) |

この札での書記版定数の源証拠。

- `packages/core/session/src/types.ts`: `export const SESSION_FORMAT_VERSION = 3`

<a id="declaration"></a>
## 宣言

```yaml persistence-release
schemaVersion: 1
tag: dsh-v0.1.5-alpha.2
previous: dsh-v0.1.5-alpha.1
sessionFormatVersion: 3
changes:
  - root: event:deliverables/presented
    before: null
    after: 13d3d180f977bf78081d487ffa0ecb75857349bcab29a5a3fb48189fca2a6176
  - root: event:feedback/message-put
    before: 3b04fde0dc763cf84fbde7b6611b3194dd56d95d0c0bf0204311640468d586e1
    after: b5086d249e8502e9ead1d39156bb8d559bde7951cac0f14ce150345b4e42a2bf
  - root: event:feedback/record
    before: fb9df8180a202f3c845d5aa6a81697b2f7213f6735abc17535a55656be60a575
    after: b54940ff095c17e874c5be03815f4c2145a256cf3a1d34dae4ab2f7769dfffe8
  - root: event:subagent/catalog
    before: null
    after: ae1f7110feeec697b8cab42b68f7709aa7b3279764099dfb53c25890d2e5c871
```

<a id="changes"></a>
## 構造変更

<!-- persistence-release-changes:start -->

検出された変更根 4 件と構造差 5 件。下の査読要件は比較用現行規則で算出され、歴史的適合、移行正当、実行時互換を主張しない。

| 経路 | 変更 | 査読要件 |
|---|---|---|
| `event:deliverables/presented` | `root-added` | `not-required` |
| `event:feedback/message-put.data.item.category` | `optional-property-added` | `not-required` |
| `event:feedback/record.data.text` | `property-made-optional` | `not-required` |
| `event:feedback/record.data.category` | `optional-property-added` | `not-required` |
| `event:subagent/catalog` | `root-added` | `not-required` |

<!-- persistence-release-changes:end -->

<a id="verification"></a>
## 検証

抽出は正準図、根 digest、到達型 digest 検証を通り、歴史面イベント向け元の任意 `surfaceOp` のみを許した。木内検査は各札を前任から再構成し、前後値、snapshot 適用範囲、二言語機械宣言を検証する。

```sh
pnpm run verify-persistence-releases
```

<a id="dev-note"></a>
## 開発メモ

なし。
