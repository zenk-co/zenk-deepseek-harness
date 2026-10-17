---
description: "dsh-v0.1.2-alpha.3 の遡及的セッション永続化型と隣接リリース変更。"
kind: persistence-release
---

# 永続化リリース: dsh-v0.1.2-alpha.3

日本語 | [English](dsh-v0.1.2-alpha.3.en.md) | [中文](dsh-v0.1.2-alpha.3.zh.md)

## 概要

再構築された永続化ルートダイジェストはすべて直前の alpha タグと一致する。ライター形式は 0 のままである。

## 目次

- [リリース証跡](#evidence)
- [宣言](#declaration)
- [構造上の変更](#changes)
- [検証](#verification)
- [開発ノート](#dev-note)

-----

<a id="evidence"></a>
## リリース証跡

この概算バックフィルは読み取りと形式検証を支えるものであり、当時の互換性承認ではない。抽出とカバレッジの制限は [アーカイブリファレンス](README.md) を参照すること。

| 項目 | 記録値 |
|---|---|
| ソースタグ | `dsh-v0.1.2-alpha.3` |
| ソース日付 | 2026-08-31T15:53:17.000Z |
| リリースレコード | Release オブジェクトあり。 |
| 直前リリース | [dsh-v0.1.2-alpha.2](dsh-v0.1.2-alpha.2.md) |
| セッションライター版 | 0 |
| 再構築インベントリー | <!-- persistence-release-inventory:start -->54 ルート / 417 型<!-- persistence-release-inventory:end --> |
| このスナップショット | [dsh-v0.1.2-alpha.3.schema.json](dsh-v0.1.2-alpha.3.schema.json) |

このタグにおけるライター版定数のソース証跡:

- `packages/core/session/src/types.ts`: `export const SESSION_FORMAT_VERSION = 0`

<a id="declaration"></a>
## 宣言

```yaml persistence-release
schemaVersion: 1
tag: dsh-v0.1.2-alpha.3
previous: dsh-v0.1.2-alpha.2
sessionFormatVersion: 0
changes: []
```

<a id="changes"></a>
## 構造上の変更

<!-- persistence-release-changes:start -->

正規化ルート型とその推移ダイジェストは直前タグから不変である。

<!-- persistence-release-changes:end -->

<a id="verification"></a>
## 検証

抽出は正規グラフ、ルートダイジェスト、到達可能型ダイジェストの検証を通過し、歴史的サーフェイスイベント向けに元からオプショナルな `surfaceOp` のみを許可した。ツリー内チェックは各タグを直前タグから再構築し、前後値、スナップショットカバレッジ、バイリンガル機械宣言を検証する。

```sh
pnpm run verify-persistence-releases
```

<a id="dev-note"></a>
## 開発ノート

なし。
