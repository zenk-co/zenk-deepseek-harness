---
description: "ジョブ群マップ。バックグラウンドジョブ制御（レジストリ契約、プロセスローカル保存、モデル向けジョブツール）。群を移動するユーザーとメンテナー向け。"
kind: "package-group"
---

# jobs/ — バックグラウンドジョブ能力ファミリー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

jobs 群はバックグラウンド作業の能力ファミリーである。長時間作業を実行するツールはそれをジョブとして登録し、所有エージェントは自ターンを阻まずに読み取り・待機・一覧・取消ができる。ジョブは開始したエージェントセッションに属するため、1 エージェントが他者の作業を見ることはなく、完了は poll ではなくセッション内で所有エージェントに配送される。群はレジストリ契約（`jobs`）、そのプロセスローカル保存（`jobs-local`）、完了通知付きモデル向け制御ツール（`tool-jobs`）に分かれる。

## 目次

- [パッケージ](#packages)
- [関連文書](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`jobs`](jobs/README.md) | バックグラウンドジョブ契約を定義する。id、所有権、ライフサイクル、完了リスナー | `ctx.jobs` |
| [`jobs-local`](jobs-local/README.md) | このプロセスでジョブを実行・保存し、所有者ごとに隔てる | `ctx.jobs` に登録 |
| [`tool-jobs`](tool-jobs/README.md) | モデルにジョブの読み取り・一覧・kill と完了通知配送を行わせる | `ctx.tools` に登録 |

-----

<a id="related-documentation"></a>
## 関連文書

- [バックグラウンド task ランタイムサブシステム](../../docs/subsystems/jobs.md) — ジョブ型、snapshot フィールド、`ctx.jobs` API。
- [汎用長時間実行ツールランタイムリファレンス](jobs/README.md) — バックグラウンドジョブ runtime 背後の設計。
- [job-registry シームエージェントノート](../../.agents/notes/archived/architecture/2026-07-26-job-registry-seam.md) — 所有者隔離レジストリ契約とその根拠。

-----

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
