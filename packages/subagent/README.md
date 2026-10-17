---
description: "The subagent package group: the delegation seam, its in-process and out-of-process backends, and the model-facing delegation tools."
kind: "package-group"
---

# subagent/ — サブエージェントケイパビリティ群

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

サブエージェントパッケージ群により、エージェントはタスクを子に委譲し、子の作業を継続し、作成したすべての子を検出できる。分離作業には新規インプロセス子を、以前の会話が重要な場合は履歴シード付きインプロセス子を、ACP・Codex・Claude Code・他の Harness ランタイムによる子にはアウトオブプロセス子を選択する。モデル向けツールにより、エージェントは隣接エージェントへのメッセージ送信、作業の中断、子ステータスの一覧も行える。各子は、実行中か保存済みかにかかわらず親から可視のままである。プロバイダー固有のセットアップと制限は各パッケージ README が文書化する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`subagent/`](subagent/README.md) | 委譲サービスを定義する。プロバイダーレジストリー、ワンショット実行、継続可能な子、検出 | `ctx.subagents` |
| [`subagent-spawn-in-process/`](subagent-spawn-in-process/README.md) | 新規インプロセス子を実行する | `ctx.subagents` に登録 |
| [`subagent-fork-in-process/`](subagent-fork-in-process/README.md) | 親の完了済み履歴をシードしたインプロセス子を実行する | `ctx.subagents` に登録 |
| [`subagent-acp/`](subagent-acp/README.md) | Agent Client Protocol 上でアウトオブプロセス子を実行する | `ctx.subagents` に登録 |
| [`subagent-codex/`](subagent-codex/README.md) | 公式 app-server プロトコルを通じて実際の Codex 子を実行する | `ctx.subagents` に登録 |
| [`subagent-claude-code/`](subagent-claude-code/README.md) | 公式 Agent SDK を通じて実際の Claude Code 子を実行する | `ctx.subagents` に登録 |
| [`subagent-dsh-sdk/`](subagent-dsh-sdk/README.md) | TypeScript SDK を通じてアウトオブプロセス Harness 子を実行する | `ctx.subagents` に登録 |
| [`tool-subagent/`](tool-subagent/README.md) | 委譲をモデルに公開する | `ctx.tools` に登録 |
| [`tool-subagent-control/`](tool-subagent-control/README.md) | 隣接エージェントのメッセージ送信、中断、一覧をモデルに公開する | `ctx.tools` に登録 |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [サブエージェントサブシステム](../../docs/subsystems/subagent.md) — サービス契約、プロバイダー契約、終了結果の意味。
- [歴史的サブエージェントケイパビリティシーム](../../.agents/notes/archived/feature/2026-06-21-subagent-capability-seam.md) — 委譲ケイパビリティ群の設計記録。
- [継続可能なサブエージェント](../../.agents/notes/implemented/feature/2026-07-28-continuable-subagent-conversations.md) — フォローアップターンを受ける durable な子。
- [tool-subagent-control README](tool-subagent-control/README.md) — フォローアップ、中断、一覧のサーフェス。

<a id="dev-note"></a>
## 開発メモ

なし。
