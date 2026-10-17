---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-05-ptc-operation-metadata

日本語 | [English](2026-10-05-ptc-operation-metadata.en.md) | [中文](2026-10-05-ptc-operation-metadata.zh.md)

## 概要

永続化されたネスト PTC ツール結果に任意の純粋表示用メタデータを追加し、履歴が操作時のディレクトリとファイル対象を保持できるようにする。

## 目次

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## 宣言

```yaml persistence-change
schemaVersion: 1
id: 2026-10-05-ptc-operation-metadata
baseline: false
changes:
  - root: "event:tool/ptc-dispatch"
    previous: "2026-09-16-session-format-v4"
    after: "d66e11dddf5dfa3c71547e2cbd7b0608824cd8d6243fc16f532017ff28e8fba5"
    decision: same-version
```

<a id="compatibility"></a>
## 互換性

meta の無い既存 tool/ptc-dispatch 記録は引き続き有効である。任意の JsonValue フィールドは正規プログラム値、モデル可視コンテンツ、ツール同一性、メッセージ順序を変更しない。記録された相対対象の無い履歴呼び出しは安全な利用不能ナビゲーションを保つ。ライターと承認済みベースラインは V4 のままである。

<a id="verification"></a>
## 検証

963 件の対象テストが影響する 6 ランタイム/UI ソースのファイル単位 100% カバレッジで合格した。実際のネストシェルと相対ファイルシステム回帰、凍結メタデータ制御、TypeScript SDK 45 テスト、Python SDK 29 テスト、所有する 3 件のキーレス refresh/replay が合格した。

<a id="dev-note"></a>
## 開発ノート

None.
