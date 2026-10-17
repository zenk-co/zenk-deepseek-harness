---
description: "skill グループマップ: プロバイダーから検出し、セッションカタログと skill ツール経由で読み込む再利用可能なエージェント指示。"
kind: "package-group"
---

# skill/ — skill ケイパビリティファミリー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

skill ファミリーにより、エージェントとユーザーは再利用可能なタスク指示を必要なときだけ検出して読み込める。カタログを結合して名前ごとに1つの指示セットを公開するには `skill/` を使い、プロジェクト・カスタム・ユーザーディレクトリーの検出には `skill-filesystem`、Word・PowerPoint・Excel ワークフローには `skill-office` を選ぶ。モデルにソート済みで durable なセッションカタログを提供し、`skill` ツール経由で全文指示を読み込み、`/name` による直接呼び出しを受け付けるには `tool-skill` を追加する。異なるソースも同じモデル可視形式を生成し、モデルアクセスには少なくとも1つのソースが必要である。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`skill/`](skill/README.md) | 任意のプロバイダーからの skill カタログを統合し、名前に対する勝者を解決するレジストリー | `ctx.skills` |
| [`skill-filesystem/`](skill-filesystem/README.md) | プロジェクト、カスタム、ユーザーディレクトリーから skill を検出し、変更を監視する | `ctx.skills` に登録する |
| [`skill-office/`](skill-office/README.md) | Word、PowerPoint、Excel ワークフローを構造化ファイルチェック付きで束ねる | `ctx.skills` に登録する |
| [`tool-skill/`](tool-skill/README.md) | セッション skill カタログとモデル向け `skill` ローダーツールを公開する | `ctx.tools` に登録する |
| [`tool-workspace-dependencies/`](tool-workspace-dependencies/README.md) | Desktop および SDK キャリア向けにバンドル済み Office インタープリターのパスとバージョンを報告する | `ctx.tools` に登録する |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

共有語彙はサブシステムリファレンスから、設計根拠は Agent Note から読み進めること。

- [Skill サブシステムリファレンス](../../docs/subsystems/skills.md) — レジストリー、プロバイダー契約、ローカル検出の優先度、カタログとツール。
- [Skill 呼び出しポリシーリファレンス](skill/README.md) — モデルとユーザーの呼び出し制御。

-----

[`skill-badge`](../experimental/skill-badge/README.md) については実験的なオプショナルケイパビリティを参照すること。

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
