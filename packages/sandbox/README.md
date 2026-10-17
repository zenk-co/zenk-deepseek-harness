---
description: "The process-sandbox package group: the confinement seam, per-platform backends, the shared policy resolver, and the Windows write-restriction rung."
kind: "package-group"
---

# packages/sandbox

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`sandbox/` グループはサブプロセス実行をファイル効果ポリシーに制限する。コマンドは `read-only` で実行されるか、セッションワークスペース配下のみ書き込み可能（`workspace-write`）か、無制限（`danger-full-access`）で実行される。4 つのパッケージがこれを提供する。制限サービス（`sandbox/`）、Linux・macOS・Windows 用のプラットフォーム別バックエンド（`sandbox-local/`）、共有ポリシーリゾルバー（`sandbox-policy/`）、Windows 書き込み制限バックエンド（`sandbox-windows-acl/`）である。ポリシーに拒否された制限呼び出しは、ユーザー承認によるワンショット昇格を経て再試行できる。制限は同一ワールドのみである。ホストカーネルとファイルシステムを共有し、コンテナー・microVM・リモート実行器はここに登録するのではなくケイパビリティ全体を置換する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ

4 つのパッケージが制限の役割を担う。網羅的な契約と呼び出しごとのポリシー意味はサブシステムリファレンスが所有する。

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`sandbox/`](sandbox/README.md) | 制限サービス契約。モード、強制、呼び出しごとのポリシー、昇格語彙 | `ctx.sandbox` |
| [`sandbox-local/`](sandbox-local/README.md) | プラットフォーム別制限バックエンド。Linux bwrap 次に Landlock、macOS Seatbelt、Windows 制限トークン | `ctx.sandbox` に登録 |
| [`sandbox-policy/`](sandbox-policy/README.md) | 共有ポリシーホーム。すべての強制ファミリー用のデプロイデフォルトとセッションごとのモードオーバーライド | `ctx.sandboxPolicy` |
| [`sandbox-windows-acl/`](sandbox-windows-acl/README.md) | Windows 書き込み制限。制限された子はワークスペースとプライベート一時ディレクトリにのみ書き込み可能 | —（`sandbox-local` が win32 バックエンドとしてマウント） |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

まず共有語彙のサブシステムリファレンスから始め、次に制限決定とそのクロスファミリー拡張を読む。

- [プロセスサンドボックスサブシステム](../../docs/subsystems/sandbox.md) — モード、呼び出しごとのポリシー、ラップ argv 方言、フェイルクローズドエラー。
- [歴史的サブプロセスサンドボックス決定](../../.agents/notes/archived/feature/2026-07-06-sandbox.md) — ケイパビリティ境界、昇格手順、延期フェーズ。
- [クロスファミリーファイルサンドボックスリファレンス](../fs/fs-sandbox/README.md) — 共有ポリシーホームとサンドボックス化ファイルシステムプロバイダー。
- [Windows ACL 制限トークンサンドボックス決定](../../.agents/notes/implemented/feature/2026-08-08-windows-acl-restricted-token-sandbox.md) — mxc や AppContainer ではなく生 ACL 制限トークンを選んだ理由。

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
