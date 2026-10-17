---
description: "dsh-v0.1.1-rc.1 の回顧的なセッション永続化型と隣接リリースの変更。"
kind: persistence-release
---

# 永続化リリース: dsh-v0.1.1-rc.1

日本語 | [English](dsh-v0.1.1-rc.1.en.md) | [中文](dsh-v0.1.1-rc.1.zh.md)

## 概要

permission/preset は既定値、選択、推論値付きで任意の origin を獲得する。writer 形式は 0 のままである。

## 目次

- [リリース証跡](#evidence)
- [宣言](#declaration)
- [構造的変更](#changes)
- [検証](#verification)
- [開発者ノート](#dev-note)

-----

<a id="evidence"></a>
## リリース証跡

この近似バックフィルは読み取りとフォーマット検証を支えるものであり、同時代の互換性承認ではない。抽出とカバレッジの限界は[アーカイブリファレンス](README.md)を参照。

| 項目 | 記録値 |
|---|---|
| ソースタグ | `dsh-v0.1.1-rc.1` |
| ソース日付 | 2026-08-21T06:21:44.000Z |
| リリース記録 | リリースオブジェクトあり。 |
| 前回のリリース | [dsh-v0.1.0-rc.8](dsh-v0.1.0-rc.8.md) |
| セッション writer バージョン | 0 |
| 再構成インベントリー | <!-- persistence-release-inventory:start -->51 roots / 407 types<!-- persistence-release-inventory:end --> |
| このスナップショット | [dsh-v0.1.1-rc.1.schema.json](dsh-v0.1.1-rc.1.schema.json) |

このタグにおける writer バージョン定数のソース証跡:

- `packages/core/session/src/types.ts`: `export const SESSION_FORMAT_VERSION = 0`

<a id="declaration"></a>
## 宣言

```yaml persistence-release
schemaVersion: 1
tag: dsh-v0.1.1-rc.1
previous: dsh-v0.1.0-rc.8
sessionFormatVersion: 0
changes:
  - root: event:permission/preset
    before: 5c45bf4c544a7211dcd8ba6ba7e5f1bc39b49e7a9df9d5cbdc8e87c22771b37b
    after: 7271e4b771406aaf06014c2269edd6cb68055bb8b8686571730813ce0ababc22
```

<a id="changes"></a>
## 構造的変更

<!-- persistence-release-changes:start -->

1 個の変更ルートと 1 個の構造的差異を検出した。以下のレビュー要件は比較のみを目的として現在の規則で計算されたものであり、歴史的な準拠、マイグレーションの正しさ、ランタイム互換性を主張するものではない。

| パス | 変更 | レビュー要件 |
|---|---|---|
| `event:permission/preset.data.origin` | `optional-property-added` | `not-required` |

<!-- persistence-release-changes:end -->

<a id="verification"></a>
## 検証

抽出は正規グラフ、ルートダイジェスト、到達可能型ダイジェストの検証に合格し、元の任意の `surfaceOp` は歴史的サーフェスイベントに対してのみ許容された。ツリー内チェックは各タグをその前身から再構成し、before/after 値、スナップショットカバレッジ、バイリンガルの機械宣言を検証する。

```sh
pnpm run verify-persistence-releases
```

<a id="dev-note"></a>
## 開発者ノート

なし。
