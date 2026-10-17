---
description: "workspace グループマップ: 永続ワークスペースエンティティ群、耐久ディレクトリ記録、ヘッダー検証済みセッションメンバーシップ。グループを行き来するユーザーとメンテナー向け。"
kind: "package-group"
---

# packages/workspace

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

ワークスペース群では、ホスト製品が名前付きプロジェクトの順序付き一覧を保持し、各プロジェクトのセッションをディレクトリごとに束ねられる。ユーザーはそれらのプロジェクトとセッションを閲覧し、セッションを削除せずに束ねから隠し、フォルダーやセッション履歴を削除せずにプロジェクトを削除できる。隠したセッションや削除したセッションは束ねなし履歴として引き続き利用できる。永続的なプロジェクト面にはこの群を選ぶこと。セッションストレージと永続化バックエンドが必要であり、モデル向けにツール、プロンプト、セッションイベントは公開しない。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| Package | Role | ctx key |
|---|---|---|
| [`workspace`](workspace/README.md) | 各ディレクトリで実行したセッションを伴う名前付き順序付きプロジェクトを提供する | `ctx.workspaceRegistry` |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [ワークスペースサブシステム](../../docs/subsystems/workspace.md) — プロジェクトとそのセッションの権威ある機能契約。
- [ドメイン KV ストレージ Agent Note](../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.md) — プロジェクト記録の背後にあるストレージ設計。
- [ワークスペース UI 製品フロー Agent Note](../../.agents/notes/archived/feature/2026-07-25-workspace-ui-product-flow.md) — 初回起動がセッション履歴からプロジェクトを構築する方法と GUI の順序付け。
- [歴史的なワークスペース登録削除決定](../../.agents/notes/archived/feature/2026-07-27-workspace-registration-deletion.md) — プロジェクトの削除がフォルダーやセッションを決して削除しない理由。

-----

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
