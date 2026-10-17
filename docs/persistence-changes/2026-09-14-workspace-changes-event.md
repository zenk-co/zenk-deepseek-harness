---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-09-14-workspace-changes-event

日本語 | [English](2026-09-14-workspace-changes-event.en.md) | [中文](2026-09-14-workspace-changes-event.zh.md)

## 概要

トップレベルターンが変更したファイルを記録するログのみ workspace/changes イベントを追加する。

## 目次

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## 宣言

```yaml persistence-change
schemaVersion: 1
id: 2026-09-14-workspace-changes-event
baseline: false
changes:
  - root: "event:workspace/changes"
    previous: null
    after: "e308ccf867a5398e316e0af8cb6ce238a8d33a63b9b384c8250a686786285f72"
    decision: same-version
```

<a id="compatibility"></a>
## 互換性

同一セッションフォーマットバージョン内の新しいルート。既存ログはそのようなイベントを含まず引き続き有効であり、それ以前のリーダーはそれを運ぶログを拒否する。すべての読み取り必須イベントと同様である。イベントは Web バンドルの workspace-changes プラグインによってのみ追加され、モデル可視になることは決してない。Web 変更ファイルカードが唯一のコンシューマーであり、ターンごとの最新イベントを読む。

<a id="verification"></a>
## 検証

pnpm exec vitest run packages/deliverables/workspace-changes packages/client/ui-deliverables: 165 テスト合格。snapshots/web/changed-files-turn は記録済みイベントを Web プロファイル経由でリプレイする。

<a id="dev-note"></a>
## 開発ノート

None.
