---
description: "dsh-v0.1.2-alpha.4 向け遡及セッション永続型と隣接版変更。"
kind: persistence-release
---

# 永続版: dsh-v0.1.2-alpha.4

日本語 | [English](dsh-v0.1.2-alpha.4.en.md) | [中文](dsh-v0.1.2-alpha.4.zh.md)

## 概要

論理 SessionHeader は任意 seedLength を必須 isSeeded に置換する一方、物理 JSONL 頭は依然 seedLength を宣言する。subagent-report と coordinator 利用者文出所変種は agent-message になる。書記形式は 0 のままである。

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
| 源札 | `dsh-v0.1.2-alpha.4` |
| 源日時 | 2026-09-01T15:37:26.000Z |
| 版記録 | Release 対象あり。 |
| 前版 | [dsh-v0.1.2-alpha.3](dsh-v0.1.2-alpha.3.md) |
| セッション書記版 | 0 |
| 再構成目録 | <!-- persistence-release-inventory:start -->54 roots / 415 types<!-- persistence-release-inventory:end --> |
| この snapshot | [dsh-v0.1.2-alpha.4.schema.json](dsh-v0.1.2-alpha.4.schema.json) |

この札での書記版定数の源証拠。

- `packages/core/session/src/types.ts`: `export const SESSION_FORMAT_VERSION = 0`

<a id="declaration"></a>
## 宣言

```yaml persistence-release
schemaVersion: 1
tag: dsh-v0.1.2-alpha.4
previous: dsh-v0.1.2-alpha.3
sessionFormatVersion: 0
changes:
  - root: SessionHeader
    before: a50373168c4935222b1681223d919a56d095ce37ad45c5ba2c20d75235adf937
    after: 001ed6f66d67fac9cb9594b55f13557db94174fe5d5954789bb5a2d6d5927226
  - root: event:agent/inbox/spliced
    before: ee796690277eafbcda4437478de7a8f01d983424d6238fe472df9b3b0d97a89f
    after: 15cdff6391d58ea00d7e2fe113b663d5479cbb3fd1af26717ad933c770bca081
  - root: event:session/title-llm-request
    before: 61651f4ca07ab9ebef773d82fafbcb74d39190a255c69ecc36084046123a9cb4
    after: 2cfb71f7819bc88a6bccbffa8b7ae5664233af6f6e1dfb068db25e2e17ddd8c7
  - root: event:user/message
    before: e23368db1646a9ac10d2bd4629084fdff583a1db2c83ffaa3f2f201d0c45f3e4
    after: e950c87ba49bd8175b8a670b319a599d5ed14cde996540d5ba91a141fad68781
```

<a id="changes"></a>
## 構造変更

<!-- persistence-release-changes:start -->

検出された変更根 4 件と構造差 5 件。下の査読要件は比較用現行規則で算出され、歴史的適合、移行正当、実行時互換を主張しない。

| 経路 | 変更 | 査読要件 |
|---|---|---|
| `SessionHeader.seedLength` | `property-removed` | `review-required` |
| `SessionHeader.isSeeded` | `required-property-added` | `review-required` |
| `event:agent/inbox/spliced.data.inserted[].source` | `union-variants-changed` | `review-required` |
| `event:session/title-llm-request.data.messages[].source` | `union-variants-changed` | `review-required` |
| `event:user/message.data.source` | `union-variants-changed` | `review-required` |

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
