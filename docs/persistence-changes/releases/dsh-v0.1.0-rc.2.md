---
description: "dsh-v0.1.0-rc.2 の Session 永続化型の回顧と隣接リリース間の変更。"
kind: persistence-release
---

# 永続化リリース: dsh-v0.1.0-rc.2

日本語 | [English](dsh-v0.1.0-rc.2.en.md) | [中文](dsh-v0.1.0-rc.2.zh.md)

## 概要

再構成された永続化ルートダイジェストはすべて直前の alpha/RC タグと一致する。ライターフォーマットは 0 のままである。

## 目次

- [リリース証跡](#evidence)
- [宣言](#declaration)
- [構造上の変更](#changes)
- [検証](#verification)
- [開発メモ](#dev-note)

-----

<a id="evidence"></a>
## リリース証跡

このおおよそのバックフィルは読み取りと形式検証を支援するもので、同時代の互換性承認ではない。抽出とカバレッジの制限については[アーカイブの参照](README.md)を参照すること。

| 項目 | 記録値 |
|---|---|
| ソースタグ | `dsh-v0.1.0-rc.2` |
| ソース日付 | 2026-08-13T09:23:52.000Z |
| リリース記録 | タグのみ。リリースオブジェクトなし。 |
| 前回リリース | [dsh-v0.1.0-rc.1](dsh-v0.1.0-rc.1.md) |
| Session ライターバージョン | 0 |
| 再構成インベントリ | <!-- persistence-release-inventory:start -->47 roots / 374 types<!-- persistence-release-inventory:end --> |
| 本スナップショット | [dsh-v0.1.0-rc.2.schema.json](dsh-v0.1.0-rc.2.schema.json) |

このタグにおけるライターバージョン定数のソース証跡:

- `packages/core/session/src/types.ts`: `export const SESSION_FORMAT_VERSION = 0`

<a id="declaration"></a>
## 宣言

```yaml persistence-release
schemaVersion: 1
tag: dsh-v0.1.0-rc.2
previous: dsh-v0.1.0-rc.1
sessionFormatVersion: 0
changes: []
```

<a id="changes"></a>
## 構造上の変更

<!-- persistence-release-changes:start -->

正規化されたルート型とその推移ダイジェストは直前のタグから変更されていない。

<!-- persistence-release-changes:end -->

<a id="verification"></a>
## 検証

抽出は正準グラフ、ルートダイジェスト、および到達可能型ダイジェストの検証に合格し、履歴サーフェスイベントに限り元来の任意 `surfaceOp` を許可する。ツリー内のチェックは各タグをその前任から再構成し、前後の値、スナップショットカバレッジ、およびバイリンガルの機械宣言を検証する。

```sh
pnpm run verify-persistence-releases
```

<a id="dev-note"></a>
## 開発メモ

なし。
