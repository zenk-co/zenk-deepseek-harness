---
description: "Retrospective Session persistence types and adjacent-release changes for dsh-v0.1.0-rc.7."
kind: persistence-release
---

# 永続化リリース: dsh-v0.1.0-rc.7

日本語 | [English](dsh-v0.1.0-rc.7.en.md) | [中文](dsh-v0.1.0-rc.7.zh.md)

## 概要

assistant/chunk replayState が unknown から、必須 response と任意 blocks を持つオブジェクトに変更された。ライターフォーマットは 0 のままである。

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
| ソースタグ | `dsh-v0.1.0-rc.7` |
| ソース日時 | 2026-08-17T11:03:17.000Z |
| リリース記録 | Release オブジェクトあり。 |
| 前リリース | [dsh-v0.1.0-rc.6](dsh-v0.1.0-rc.6.md) |
| セッションライターバージョン | 0 |
| 再構築インベントリ | <!-- persistence-release-inventory:start -->47 roots / 376 types<!-- persistence-release-inventory:end --> |
| このスナップショット | [dsh-v0.1.0-rc.7.schema.json](dsh-v0.1.0-rc.7.schema.json) |

このタグにおけるライターバージョン定数のソース証拠:

- `packages/core/session/src/types.ts`: `export const SESSION_FORMAT_VERSION = 0`

<a id="declaration"></a>
## 宣言

```yaml persistence-release
schemaVersion: 1
tag: dsh-v0.1.0-rc.7
previous: dsh-v0.1.0-rc.6
sessionFormatVersion: 0
changes:
  - root: event:assistant/chunk
    before: 7fd942b2189b8dbf6e1a2c7b026e9ddd1e7dba3fbe5645708a76f4cddabb281d
    after: de04e4ae000cc4422a15fb86dce7c398c8a9970ac963b6f7f785e2276a939e62
```

<a id="changes"></a>
## 構造変更

<!-- persistence-release-changes:start -->

変更されたルート 1 件と構造差分 1 件を検出。下記のレビュー要件は現行ルールによる比較用に算出したものであり、歴史的準拠、移行正確性、実行時互換性を主張するものではない。

| パス | 変更 | レビュー要件 |
|---|---|---|
| `event:assistant/chunk.data.chunk.replayState` | `type-changed` | `review-required` |

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
