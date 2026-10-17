---
description: "POSIX SSH プロバイダー群: 共有接続、リモートファイルシステム、管理サブプロセス、ファイル作用サンドボックス。"
kind: "package-group"
---

# ssh/ — POSIX リモート実行プロバイダー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

この群は、Harness をローカルに置いたまま、1 つの POSIX SSH ホスト上でファイル、通常プロセス、ターミナル、サンドボックス強制を実行する。共有 OpenSSH 接続とインストール済みヘルパーが既存のファイルシステム、サブプロセス、サンドボックスの各インターフェースを支える。プロバイダー所有パスを尊重する利用者を持つ headless またはカスタムプロファイルで使うこと。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

<a id="packages"></a>
## パッケージ

| Package | Responsibility | Service |
|---|---|---|
| [`ssh`](ssh/README.md) | 接続、ヘルパー識別、転送ライフサイクル | `ctx.ssh` |
| [`ssh-helper-runtime`](ssh-helper-runtime/README.md) | プライベートな Node 不要実行形式ディストリビューション | — |
| [`fs-ssh`](fs-ssh/README.md) | リモートファイル識別、読み取り、保護付き不可分変異 | `ctx.fs` |
| [`subprocess-ssh`](subprocess-ssh/README.md) | 実行形式探索、プロセス、制御ストリーム、ターミナル | `ctx.subprocess` |
| [`sandbox-ssh`](sandbox-ssh/README.md) | リモートファイル作用の閉じ込めと強制ファクト | `ctx.sandbox` |

<a id="related-documentation"></a>
## 関連ドキュメント

- [SSH サブシステム](../../docs/subsystems/ssh.md) — 共有実行座標と転送所有権。
- [POSIX SSH 決定](../../.agents/notes/implemented/architecture/2026-09-11-posix-ssh-runtime.md) — 代替案、帰結、検証要件。

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

リモートケイパビリティ実装は共有の非同期ターミナル・キャンセルインターフェースを保持する。リモートパス文字列からローカルパスアクセスを推測してはならない。

</details>
