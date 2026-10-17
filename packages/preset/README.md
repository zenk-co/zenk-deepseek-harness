---
description: "このグループは通常の Cordis 設定を通じてエージェントケイパビリティを宣言し、選択とランタイムリビジョンを管理する。ホストはエージェントループを共有し、各エージェントは選択したリビジョンのツール、プロンプト、スキルを見る。"
kind: "package-group"
---

# packages/preset

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このグループは通常の Cordis 設定を通じてエージェントケイパビリティを宣言し、選択とランタイムリビジョンを管理する。ホストはエージェントループを共有し、各エージェントは選択したリビジョンのツール、プロンプト、スキルを見る。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

<a id="packages"></a>
## パッケージ

| Package | Role | ctx key |
|---|---|---|
| [agent-preset-registry](agent-preset-registry/README.md) | Selection, revision retention and profile editing | `ctx.agentPresets` |
| [agent-preset](agent-preset/README.md) | Declarative child plugins and metadata | — |
| [persona](persona/README.md) | Composable Agent persona | — |

<a id="related-documentation"></a>
## 関連ドキュメント

- [スコープ](../../docs/subsystems/scope.md)
- [Cordis](../../docs/cordis-primer.md)
- [エージェントプリセット](../../.agents/notes/implemented/architecture/2026-09-18-declarative-agent-presets.md)

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

None.

</details>
