---
description: "デリバラブルグループマップ: ターンがユーザーに手渡すものを記録する Host プラグイン。明示的なファイル納品と観測されたワークスペース変更。"
kind: "package-group"
---

# packages/deliverables

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

デリバラブルファミリーは、ターンがユーザーに手渡すものをクライアントのみが読む durable セッションイベントとして記録する。`present` ツールはモデルが納品した最終ファイルを宣言し、ワークスペース変更レコーダーは git スナップショットと全体ファイルキャプチャからターンが変更したファイルをその行数とともに記録し、各ファイルの比較を提供する。Web の [デリバラブルプラグイン](../client/ui-deliverables/README.md) は両方をターン末尾に描画する。納品ファイルとターンごとの変更を表示する製品にはこのファミリーを選ぶこと。`present` には `ctx.tools` と `ctx.fs` が必要であり、レコーダーには `ctx.subprocess` と git 実行ファイルが必要である。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`tool-present`](tool-present/README.md) | 既存ファイルを `present` ツール経由で最終納品物として宣言する | `ctx.tools` に登録する |
| [`workspace-changes`](workspace-changes/README.md) | 最上位ターンの変更ファイルを git 作業ツリースナップショットと全体ファイルキャプチャから要約し、その比較を提供する | `ctx.workspaceChanges` を提供する。`session/event` を購読し、`workspace/changes` を追加する |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [Deliverables サブシステム](../../docs/subsystems/deliverables.md) — `PresentedFile` と `WorkspaceChangesSummary` の語彙、2つの durable イベント、要約サービス。
- [Web デリバラブル](../client/ui-deliverables/README.md) — これらのイベントを描画するターン末尾カードとファイル言及。
- [Present はワークスペースソースファイルを宣言する](../../.agents/notes/implemented/feature/2026-09-08-present-workspace-source-files.md) — 納品の決定。
- [ターン変更ファイルカード](workspace-changes/README.md) — スナップショット設計とカバレッジ規則。

-----

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
