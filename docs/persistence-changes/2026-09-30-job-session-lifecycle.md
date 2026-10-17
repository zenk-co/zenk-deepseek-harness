---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-09-30-job-session-lifecycle

日本語 | [English](2026-09-30-job-session-lifecycle.en.md) | [中文](2026-09-30-job-session-lifecycle.zh.md)

## 概要

所有されたジョブ登録と確定を、一意の JobId、本来のタイムスタンプ、作成したツール呼び出し、プロデューサーの完了報告とともに記録する。

## 目次

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## 宣言

```yaml persistence-change
schemaVersion: 1
id: 2026-09-30-job-session-lifecycle
baseline: false
changes:
  - root: "event:job/registered"
    previous: null
    after: "f5520c1d261ca86ea03735799c311a0a9ede8babb588cf0a65422576d2ee0ad1"
    decision: same-version
  - root: "event:job/settled"
    previous: null
    after: "edd37b1e4974af648633014435572089b1e8fb71910468a0767a7e28fdd22abf"
    decision: same-version
```

<a id="compatibility"></a>
## 互換性

セッションエンベロープを変更せずに必須ジョブイベント種別を追加する。新しい JobId はライブ制御と durable なペアリングの両方に種別接頭辞付き UUID を使う。履歴セッションには作り物のジョブ履歴を付与しない。古いビルドは未知の必須イベントを拒否する。producerReported は検証済みリソース解放ではなく完了プロミスの履行を表す。

<a id="verification"></a>
## 検証

レジストリとスナップショット正規化テストが因果順序と一意な JobId をカバーする。CLI と SDK のスナップショットが実行中の登録、確定、通知を検証する。アプリケーション終了中の不完全な終端履歴は [ジョブライフサイクル契約](../subsystems/jobs.md#session-lifecycle-records) が許容する。

<a id="dev-note"></a>
## 開発ノート

None.
