---
description: "dsh-v0.1.0-rc.8 の回顧的な Session 永続化型と隣接リリースの変更。"
kind: persistence-release
---

# 永続化リリース: dsh-v0.1.0-rc.8

日本語 | [English](dsh-v0.1.0-rc.8.en.md) | [中文](dsh-v0.1.0-rc.8.zh.md)

## 概要

4 件の team/* イベントと team-message 利用者メッセージ由来種別が追加され、assistant/message は任意の interrupted を得る。ライター形式は 0 のままである。

## 目次

- [リリース証拠](#evidence)
- [宣言](#declaration)
- [構造変化](#changes)
- [検証](#verification)
- [開発者ノート](#dev-note)

-----

<a id="evidence"></a>
## リリース証拠

この概算バックフィルは読み取りと形式検証を支援するものであり、同時代の適合性承認ではない。抽出とカバー範囲の制限は[アーカイブ参照](README.md)を見ること。

| 項目 | 記録値 |
|---|---|
| ソースタグ | `dsh-v0.1.0-rc.8` |
| ソース日付 | 2026-08-19T15:11:50.000Z |
| リリースレコード | Release オブジェクトあり。 |
| 前回リリース | [dsh-v0.1.0-rc.7](dsh-v0.1.0-rc.7.md) |
| セッションライター版 | 0 |
| 再構築インベントリ | <!-- persistence-release-inventory:start -->51 ルート / 403 型<!-- persistence-release-inventory:end --> |
| このスナップショット | [dsh-v0.1.0-rc.8.schema.json](dsh-v0.1.0-rc.8.schema.json) |

このタグにおけるライターバージョン定数の由来証拠:

- `packages/core/session/src/types.ts`: `export const SESSION_FORMAT_VERSION = 0`

<a id="declaration"></a>
## 宣言

```yaml persistence-release
schemaVersion: 1
tag: dsh-v0.1.0-rc.8
previous: dsh-v0.1.0-rc.7
sessionFormatVersion: 0
changes:
  - root: event:agent/inbox/spliced
    before: dea3a1d5640e0306a486f92b725a01b57e69439277978ca09dc246fb40016b90
    after: 7a0b347ba6a465a7813490036bde98bdc658609c6de9545ba58be26c372c5030
  - root: event:assistant/message
    before: 390aeb83383643633a1935f09f84fe19d2aee8d4f500a8de70f88d388562cc50
    after: fb7d974e1945b4c8e72ee540daf64eb9e81984030ff52e1a97a4e1f71b9dd2f9
  - root: event:session/title-llm-request
    before: 796a77af2c1452392f0cc62b99fba2d404d1c9eb10a8a2510a808fba6053cf24
    after: ee6c879669bb83325e4cd3011227f238bf51765744990fc4bb12089d6dd6563a
  - root: event:team/member
    before: null
    after: 31d13edbb5fe2f8b7a38056320a8a06275ee4426e0abf12d4741818beda5a9c9
  - root: event:team/message/delivered
    before: null
    after: c53bff743470c8bf11be698ced047072744ef088cce663a774b456d7a8982516
  - root: event:team/message/queued
    before: null
    after: 577054184d5f038bd96d6db70b76983a2bb62a8eea8eeed8ca3b0d47af0f462a
  - root: event:team/task
    before: null
    after: 1688a2451eef9da19eaf45f12c8a27df07b1a6e56fa57ba603118f5201bb435b
  - root: event:user/message
    before: 18c8d77777545808f232cd8d7730ce270cb1b737edd3eaa45e0da9436fd37a13
    after: e7eec68e39f9f44b2e53d799e5d5dd08f559558a27e93eb2a272782f040be50a
```

<a id="changes"></a>
## 構造変化

<!-- persistence-release-changes:start -->

8 変更ルートと 8 構造差分を検出。下記のレビュー要件は現在の規則で比較用に算出したものであり、歴史的な適合・移行正当性・実行時適合性を主張しない。

| パス | 変化 | レビュー要件 |
|---|---|---|
| `event:agent/inbox/spliced.data.inserted[].source` | `union-variants-changed` | `review-required` |
| `event:assistant/message.data.interrupted` | `optional-property-added` | `not-required` |
| `event:session/title-llm-request.data.messages[].source` | `union-variants-changed` | `review-required` |
| `event:team/member` | `root-added` | `not-required` |
| `event:team/message/delivered` | `root-added` | `not-required` |
| `event:team/message/queued` | `root-added` | `not-required` |
| `event:team/task` | `root-added` | `not-required` |
| `event:user/message.data.source` | `union-variants-changed` | `review-required` |

<!-- persistence-release-changes:end -->

<a id="verification"></a>
## 検証

抽出は正規グラフ・ルートダイジェスト・到達可能型ダイジェストの検証に通り、元の任意 `surfaceOp` は歴史的 surface イベントにのみ許す。ツリー内検査は各タグを前任から再構成し、前後値・スナップショットカバー・バイリンガル機械宣言を検証する。

```sh
pnpm run verify-persistence-releases
```

<a id="dev-note"></a>
## 開発者ノート

なし。
