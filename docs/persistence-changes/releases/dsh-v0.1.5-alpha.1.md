---
description: "dsh-v0.1.5-alpha.1 の遡及セッション永続化型と隣接リリース変更。"
kind: persistence-release
---

# 永続化リリース: dsh-v0.1.5-alpha.1

日本語 | [English](dsh-v0.1.5-alpha.1.en.md) | [中文](dsh-v0.1.5-alpha.1.zh.md)

## 概要

ライター形式は 2 から 3 に進む。system/message が追加され、EpochHeader は system を除去する。Surface 置換フィールドは start/end から startSeq/endSeq に変わり、tool/code-dispatch イベントキーは tool/ptc-dispatch キーになる。

## 目次

- [リリース証拠](#evidence)
- [宣言](#declaration)
- [構造変更](#changes)
- [検証](#verification)
- [開発メモ](#dev-note)

-----

<a id="evidence"></a>
## リリース証拠

このおおよそのバックフィルは読み取りと形式検証を支える。同時代の互換性承認ではない。抽出と対象範囲の制限は[アーカイブリファレンス](README.md)を見る。

| 項目 | 記録値 |
|---|---|
| ソースタグ | `dsh-v0.1.5-alpha.1` |
| ソース日付 | 2026-09-08T15:25:45.000Z |
| リリース記録 | Release オブジェクトあり。 |
| 前リリース | [dsh-v0.1.3-alpha.2](dsh-v0.1.3-alpha.2.md) |
| セッションライターバージョン | 3 |
| 再構成目録 | <!-- persistence-release-inventory:start -->57 roots / 443 types<!-- persistence-release-inventory:end --> |
| このスナップショット | [dsh-v0.1.5-alpha.1.schema.json](dsh-v0.1.5-alpha.1.schema.json) |

このタグ時点のライターバージョン定数のソース証拠。

- `packages/core/session/src/types.ts`: `export const SESSION_FORMAT_VERSION = 3`

<a id="declaration"></a>
## 宣言

```yaml persistence-release
schemaVersion: 1
tag: dsh-v0.1.5-alpha.1
previous: dsh-v0.1.3-alpha.2
sessionFormatVersion: 3
changes:
  - root: SessionEventEnvelope
    before: 04184edc061905410cc7e3db8d5c7cf393d739c89eb523ba8bad3831fb23ba95
    after: 5776e5553ff2dfe3f5bc202dbb1e7c9f93e35a531aebb7764c23b2b6153b2ccc
  - root: SessionHeader
    before: 15918d785bdccedf0dba204622c75591bfb833bbf107ae0894bbc44cfbd73c1d
    after: 2a8b114637e66faab5fae1c6e2fba65320db6224c80f5f36c5bf32f937154d03
  - root: event:assistant/message
    before: 83f26c7a856f772e6ffd9a5a144e5aaccf771ac54cef41948f99eed99e1a25a7
    after: a58ca1bed502d425a8b65cac02f59717498cd296de9513c6f81b83b791c20e9b
  - root: event:request/context
    before: f6b733e38d46dde3f8ab1ade2be3362abb6642eb97982a98ee64a57ff60d0c28
    after: 37cbc9cf06d494cfe5c67f078af1605eacb8e4c2c853e9e26455b73de0ee7ccf
  - root: event:request/header
    before: 1de6c9c8764045ea9a1357bae6ccbbd57c19f6f337f8f25697c919c7cc9abf16
    after: 8ea13bcd983eab596dbfd41c5c2b62a0b318b71cd2a987a6fd752c6ced7e4489
  - root: event:system/message
    before: null
    after: 0ae7ccdc1cc5d9d43772ebd5c7357ff509011c3a6ba188d9c274d33df2542c42
  - root: event:tool/code-dispatch
    before: f8dc5624cd0c942a069063ae0d90a61d821b4fddd1d967dcded91cf17933e708
    after: null
  - root: event:tool/code-dispatch-start
    before: 9eb21c10fc675e1fa4184e5eecc9697aa87054ffd836d49428174897f0e64b62
    after: null
  - root: event:tool/ptc-dispatch
    before: null
    after: da807583a19f4ebe2bc9115c9686016e1521e405bdfaced296ae652b91e8e5f6
  - root: event:tool/ptc-dispatch-start
    before: null
    after: ec38b5949af8eacaf00df002f4acbe344f934f8a061e9cdc65a52a48e5f6dd93
  - root: event:tool/result
    before: eacefd48000720582725ccfc6ff7a0ac02755a1a3c57a8f9754125f99aab6c1b
    after: cc3e270ab982cbafff602b753647b6f056decb7fe4fd523afd2f157a65c3d622
  - root: event:user/message
    before: a57a77f18de7b37b724293830a57064696895d69f2afcd2c0264f41cd13ba980
    after: 2e49ede7fb3a592cce8919ebe982f6ca1c1f67abe4def359ffc028c85e6d1ad8
```

<a id="changes"></a>
## 構造変更

<!-- persistence-release-changes:start -->

12 件の変更ルートと 25 件の構造差分を検出。下のレビュー要件は比較専用の現行規則で算出し、履歴適合、移行正当性、ランタイム互換性を主張しない。

| パス | 変更 | レビュー要件 |
|---|---|---|
| `SessionEventEnvelope` | `union-variants-changed` | `review-required` |
| `SessionHeader.version` | `type-changed` | `review-required` |
| `event:assistant/message.sourceEventSeqs` | `property-removed` | `review-required` |
| `event:assistant/message.surfaceOp` | `property-made-required` | `review-required` |
| `event:assistant/message.surfaceOp.end` | `property-removed` | `review-required` |
| `event:assistant/message.surfaceOp.start` | `property-removed` | `review-required` |
| `event:assistant/message.surfaceOp.endSeq` | `required-property-added` | `review-required` |
| `event:assistant/message.surfaceOp.startSeq` | `required-property-added` | `review-required` |
| `event:request/context.data.systemPromptUpdate` | `optional-property-added` | `not-required` |
| `event:request/header.data.header.system` | `property-removed` | `review-required` |
| `event:system/message` | `root-added` | `review-required` |
| `event:tool/code-dispatch` | `root-removed` | `review-required` |
| `event:tool/code-dispatch-start` | `root-removed` | `review-required` |
| `event:tool/ptc-dispatch` | `root-added` | `not-required` |
| `event:tool/ptc-dispatch-start` | `root-added` | `not-required` |
| `event:tool/result.surfaceOp` | `property-made-required` | `review-required` |
| `event:tool/result.surfaceOp.end` | `property-removed` | `review-required` |
| `event:tool/result.surfaceOp.start` | `property-removed` | `review-required` |
| `event:tool/result.surfaceOp.endSeq` | `required-property-added` | `review-required` |
| `event:tool/result.surfaceOp.startSeq` | `required-property-added` | `review-required` |
| `event:user/message.surfaceOp` | `property-made-required` | `review-required` |
| `event:user/message.surfaceOp.end` | `property-removed` | `review-required` |
| `event:user/message.surfaceOp.start` | `property-removed` | `review-required` |
| `event:user/message.surfaceOp.endSeq` | `required-property-added` | `review-required` |
| `event:user/message.surfaceOp.startSeq` | `required-property-added` | `review-required` |

<!-- persistence-release-changes:end -->

<a id="verification"></a>
## 検証

抽出は正規グラフ、ルートダイジェスト、到達可能型ダイジェストの検証に合格し、元の任意 `surfaceOp` を履歴 surface イベントに限り許可した。ツリー内検査は各タグをその先行タグから再構成し、変更前後の値、スナップショット対象範囲、バイリンガルマシン宣言を検証する。

```sh
pnpm run verify-persistence-releases
```

<a id="dev-note"></a>
## 開発メモ

なし。
