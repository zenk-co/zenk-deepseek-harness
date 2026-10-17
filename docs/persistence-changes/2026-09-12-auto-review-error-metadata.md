---
description: "永続化型遷移とその互換性承認を記録する。"
kind: persistence-change
---

# 2026-09-12-auto-review-error-metadata

日本語 | [English](2026-09-12-auto-review-error-metadata.en.md) | [中文](2026-09-12-auto-review-error-metadata.zh.md)

## 概要

永続化済み PTC ディスパッチにオプショナルな構造化エラーメタデータを、永続化済みネイティブツールエラーにオプショナルなユーザー向け理由を追加する。どちらの追加もセッション形式バージョンを維持する。

## 目次

- [宣言](#declaration)
- [互換性](#compatibility)
- [検証](#verification)
- [開発ノート](#dev-note)

<a id="declaration"></a>
## 宣言

```yaml persistence-change
schemaVersion: 1
id: 2026-09-12-auto-review-error-metadata
baseline: false
changes:
  - root: "event:tool/ptc-dispatch"
    previous: "2026-09-11-initial"
    after: "b5d66eaebed4da391b13498623b11142222149fbf5e025975dbc6d94f0d06796"
    decision: same-version
  - root: "event:tool/result"
    previous: "2026-09-11-initial"
    after: "3a803805bdeb805f32b229e399fb7258be8e32a89f89063a7c99957cfea942f7"
    decision: same-version
```

<a id="compatibility"></a>
## 互換性

既存の tool/ptc-dispatch イベントは error を省略でき、既存の tool/result エラーは reason を省略できる。PTC ディスパッチイベントはモデル履歴に入らず、ネイティブツール結果リプレイは data.message を投影し、エラーメタデータを含めない。古いリーダーはモデルリプレイを変更せずにこれらの追加を無視できる。現在の Web リーダーは存在しない理由を受け入れ、記録済みエラー ID が一致する場合にのみ Auto review 拒否の詳細を表示する。権限モードは既存イベント内の文字列のままであり、auto の選択は宣言済み永続化型変更を導入しない。ヘッダー、イベントエンベロープ、既存値型の変更はなく、隣接マイグレーションも不要である。

<a id="verification"></a>
## 検証

pnpm exec vitest run scripts/persistence-changes.spec.ts scripts/persistence-schema.spec.ts が64テスト通過した。対象を絞った権限、Auto review、ツール実行、エージェントループ、サブエージェント継承、TypeScript SDK 所有者テストは10ファイル390テスト通過し、ネイティブおよび PTC 拒否メタデータを含む。uv run --python 3.10 --group test --project python/sdk pytest python/sdk/tests/test_client.py -k preserves_auto_review_errors が1テスト通過した。永続化プレビューは2つのオプショナル追加のみを分類し、バージョン上げを要求しなかった。

<a id="dev-note"></a>
## 開発ノート

なし。
