---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-09-19-external-subagent-catalog

日本語 | [English](2026-09-19-external-subagent-catalog.en.md) | [中文](2026-09-19-external-subagent-catalog.zh.md)

## 概要

ローカルセッションを持たない子のために親カタログエントリへ external モードを追加する。

## 目次

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## 宣言

```yaml persistence-change
schemaVersion: 1
id: 2026-09-19-external-subagent-catalog
baseline: false
changes:
  - root: "event:subagent/catalog"
    previous: "2026-09-20-unknown-child-catalog"
    after: "53750b9abf61efb7992b0aadc3e247ec927449c63266df28230fd1139f5590ac"
    decision: same-version
```

<a id="compatibility"></a>
## 互換性

既存のバージョン 0 とバージョン 1 のワンショットおよび継続可能ファクトは引き続き有効であり、バージョン 1 は unknown モードも保持する。新しい外部実行は分離マーカー無しにモード external でペイロードバージョン 2 を書く。作成は一つのメンバーシップファクトを書き、実行とクリーンアップはそれを更新しない。重複した子 id は引き続き無効である。これはリリース済み世代やセッションフォーマットバージョンを変更しない。

<a id="verification"></a>
## 検証

対象を絞ったカタログ、外部起動、ネイティブ V4 復元、クライアントナビゲーション、制御ツールテストが合格した。外部メンバーシップ、履歴ローカルモード、無効マーカー拒否、ナビゲート不能な外部リーフ、重複子拒否をカバーする。

<a id="dev-note"></a>
## 開発ノート

None.
