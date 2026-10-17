---
kind: upgrade-guide
description: "JobId はレジストリーのライフタイムを越えて 1 つのバックグラウンド実行を識別するようになった。"
---

# バックグラウンドジョブ ID は 1 つの実行を識別する

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

ジョブレジストリーは `<kind>-N` ではなく `<kind>-<short-uuid>` を返す。サフィックスは 16 文字の小文字 UUID 16 進数である。同じ `JobId` がライブ制御、`job/registered`、`job/settled` に現れ、ライフサイクルレコードはもはや `executionId` を運ばない。識別子は引き続き所有者認可のままである。既存のセッション履歴は変わらず、そのジョブを再開しない。

## 移行

1. 開始結果や `jobs.list()` が返した正確な ID を `job_output` と `job_kill` に渡す。待機には `wait: true` 付き `job_output` を使う。種別と序数から ID を組み立てるコードを削除する。
2. SDK ライフサイクルイベントを `data.jobId` で対応付ける。`JobExecutionId` のインポートと、それをプロセス内 `jobId` に対応付けるコードを削除する。
3. 新しいジョブの登録と確定が同じ `jobId` を含み、後のレジストリーインスタンスが異なるものを発行することを検証する。
