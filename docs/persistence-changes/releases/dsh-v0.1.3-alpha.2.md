---
description: "Retrospective Session persistence types and adjacent-release changes for dsh-v0.1.3-alpha.2."
kind: persistence-release
---

# 永続化リリース: dsh-v0.1.3-alpha.2

日本語 | [English](dsh-v0.1.3-alpha.2.en.md) | [中文](dsh-v0.1.3-alpha.2.zh.md)

## 概要

既存の永続化ルートダイジェストを変更せずに feedback/message-put と feedback/message-delete が追加された。ライターフォーマットは 2 のままである。

## 目次

- [リリース証拠](#evidence)
- [宣言](#declaration)
- [構造変更](#changes)
- [検証](#verification)
- [開発メモ](#dev-note)

-----

<a id="evidence"></a>
## リリース証拠

この概算バックフィルは読み取りと形式検証を支援するものであり、同時代の互換性承認ではない。抽出と対象範囲の制限は[アーカイブリファレンス](README.md)を参照。

| 項目 | 記録値 |
|---|---|
| ソースタグ | `dsh-v0.1.3-alpha.2` |
| ソース日時 | 2026-09-07T11:45:35.000Z |
| リリース記録 | Release オブジェクトあり。 |
| 前リリース | [dsh-v0.1.3-alpha.1](dsh-v0.1.3-alpha.1.md) |
| セッションライターバージョン | 2 |
| 再構築インベントリ | <!-- persistence-release-inventory:start -->56 roots / 435 types<!-- persistence-release-inventory:end --> |
| このスナップショット | [dsh-v0.1.3-alpha.2.schema.json](dsh-v0.1.3-alpha.2.schema.json) |

このタグにおけるライターバージョン定数のソース証拠:

- `packages/core/session/src/types.ts`: `export const SESSION_FORMAT_VERSION = 2`

<a id="declaration"></a>
## 宣言

```yaml persistence-release
schemaVersion: 1
tag: dsh-v0.1.3-alpha.2
previous: dsh-v0.1.3-alpha.1
sessionFormatVersion: 2
changes:
  - root: event:feedback/message-delete
    before: null
    after: 3ee93b06f3a125850337602bcdf155d2538c43a5c944ec55b1b3c365152d6796
  - root: event:feedback/message-put
    before: null
    after: 3b04fde0dc763cf84fbde7b6611b3194dd56d95d0c0bf0204311640468d586e1
```

<a id="changes"></a>
## 構造変更

<!-- persistence-release-changes:start -->

変更されたルート 2 件と構造差分 2 件を検出。下記のレビュー要件は現行ルールによる比較用に算出したものであり、歴史的準拠、移行正確性、実行時互換性を主張するものではない。

| パス | 変更 | レビュー要件 |
|---|---|---|
| `event:feedback/message-delete` | `root-added` | `not-required` |
| `event:feedback/message-put` | `root-added` | `not-required` |

<!-- persistence-release-changes:end -->

<a id="verification"></a>
## 検証

抽出は正規グラフ、ルートダイジェスト、到達可能型ダイジェストの検証を通過した。歴史的サーフェスイベント用の元々の任意 `surfaceOp` のみ許可されている。ツリー内検査は各タグを前任から再構築し、前後値、スナップショット対象範囲、バイリンガル機械宣言を検証する。

```sh
pnpm run verify-persistence-releases
```

<a id="dev-note"></a>
## 開発メモ

なし。
