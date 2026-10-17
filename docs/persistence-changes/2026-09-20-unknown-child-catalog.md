---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-09-20-unknown-child-catalog

日本語 | [English](2026-09-20-unknown-child-catalog.en.md) | [中文](2026-09-20-unknown-child-catalog.zh.md)

## 概要

読み取り不能な履歴上の子を subagent/catalog に unknown モードで保持する。

## 目次

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## 宣言

```yaml persistence-change
schemaVersion: 1
id: 2026-09-20-unknown-child-catalog
baseline: false
changes:
  - root: "event:subagent/catalog"
    previous: "2026-09-11-initial"
    after: "3abae7324356f155cb42450c00b806d134ec93bd6439d2063b8d724162d58604"
    decision: same-version
```

<a id="compatibility"></a>
## 互換性

カタログペイロード v0 は不変である。ペイロード v1 は unknown モードを追加し、現在のリーダーは v0 と v1 を受け付ける。完全なファクトは引き続き v0 を使う。移行は未知の子に v1 を出す。既存ログの書き換えは不要であり、セッションヘッダーは V4 のままである。古いリーダーは v1 を拒否する。分類器は、古いペイロード代替案がすべて不変のままの場合にのみ上位イベントペイロードバージョンを許す。同一バージョンでの拡張と古いリーダーの削除は引き続き破壊的である。

<a id="verification"></a>
## 検証

移行、復元、投影、Web 回帰が未知メンバーシップと子ローカルエラーを保持する。分類器テストは、前任者を保持した上位ペイロードバージョンを受け付け、同一バージョン追加、無効バージョン、古い代替案の変更・削除、ヘッダー/サーフェス変更を拒否する。

<a id="dev-note"></a>
## 開発ノート

None.
