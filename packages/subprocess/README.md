---
description: "サブプロセスグループマップ: 共有子プロセスサービスとそのローカルホストプロバイダー。グループ内を移動するユーザーとメンテナー向け。"
kind: "package-group"
---

# subprocess/ — サブプロセスケイパビリティファミリー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

ハーネスが実行するすべての子プロセスとターミナルセッション（bash コマンド、言語サーバー、永続シェル、プロセス外サブエージェントバックエンド）は、1つの共有サービス（`ctx.subprocess`）経由で開始・観測・終了され、ローカルプロバイダーがホストマシン上でそれらを実行する。これは独立した製品機能ではない。消費側ケイパビリティシームが各プロセスの意味を決定し、コマンドセマンティクス、期限、モデル向け提示は消費側に属する。このグループは実行ファイル lookup、有界出力キャプチャ（spill 回復付き）、プロバイダー管理のプロセス範囲（開示済みの弱いフォールバック付き）、すべての子プロセス向けにスクラブ済み開始環境を提供する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`subprocess`](subprocess/README.md) | 子プロセスサービスを定義する: 実行ファイル lookup、管理されたプロセス起動、実際のターミナルセッション | `ctx.subprocess` |
| [`subprocess-local`](subprocess-local/README.md) | サポート対象ではネイティブ管理範囲付きで、対象外では明示的に弱いフォールバックでホストプロセスとターミナルを実行する | `ctx.subprocess` に登録する |
| [`win32-process`](win32-process/README.md) | サンドボックスと通常のプロセス作成、stdio、Job 割り当て、ポーリング、待機、ハンドルクリーンアップのための共有 Win32 バインディングを所有する | ライブラリー — ctx キーなし |

このサービスは消費者リロードをまたいでプロセス寿命を保持する。プロセスが何を意味するか（bash コマンド、言語サーバー）と、それを形作るすべての既定値は消費者が所有する。

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [Subprocess サブシステム](../../docs/subsystems/subprocess.md) — 起動仕様、出力リーダー、結果、管理済み `DSH_*` 環境。
- [Subprocess シーム Agent Note](../../.agents/notes/archived/architecture/2026-07-26-subprocess-seam.md) — bash 実行器のプロセス側半分が独自シームになった理由。

-----

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
