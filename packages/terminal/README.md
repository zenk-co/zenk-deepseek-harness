---
description: "永続ターミナルサービスと、対話的な bash または pwsh を起動するシェルバックエンドのパッケージマップ。"
kind: "package-group"
---

# terminal/ — 永続 PTY ケイパビリティファミリー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`terminal/` ファミリーにより、エージェントは作業ディレクトリー、環境変数、動作中の子プロセスを含め、対話的なシェルや REPL セッションをツール呼び出しをまたいで存続させられる。所有者分離のセッション管理には `terminal/`、サンドボックス化された対話的 bash または pwsh セッションには `terminal-bash/` を使う。対話入力やワンショット bash コマンドに残せない状態が必要なタスクではこのファミリーを選ぶこと。セッションは1つのハーネスプロセスにローカルであり、再起動を超えて存続しない。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

このグループは1つのセッションサービスと1つのシェルバックエンドを含む。完全な契約は子 README が所有し、共有語彙と生成サービスサーフェイスはサブシステムリファレンスが所有する。

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`terminal/`](terminal/README.md) | セッションサービス: 所有者スコープのセッション、不透明 ID、厳密な所有者フェンシング、待機付きクリーンアップ | `ctx.terminals` |
| [`terminal-bash/`](terminal-bash/README.md) | シェルバックエンド: 共有サンドボックスポリシー下での対話的 bash または pwsh、準備完了検出と有界出力 | `ctx.terminals` 上にバックエンドを登録する |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

共有型とサービスサーフェイスはサブシステムリファレンスから、設計根拠と延期された境界は Agent Note から読み進めること。

- [Terminal サブシステムリファレンス](../../docs/subsystems/terminal.md) — ID、バックエンドとセッションの契約、send readiness、有界読み取り、生成済み `ctx.terminals` API。
- [永続 PTY Agent Note](../../.agents/notes/implemented/feature/2026-07-16-persistent-pty-sessions.md) — 設計判断、代替案、将来の課題。
- [ケイパビリティシーム](../../docs/capability-seams.md) — このファミリーが従う Service Definition / Service Provider / Consumer 分割。

[実験的なオプショナルケイパビリティ](../experimental/tool-terminal/README.md) の [`tool-terminal`](../experimental/tool-terminal/README.md) も参照すること。

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
