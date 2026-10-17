---
description: "デスクトッププロバイダーを 1 つ選択・登録するための computer-use ケイパビリティーパッケージ。"
kind: "package-group"
---

# packages/computer-use

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

computer-use プロバイダーによりモデルはデスクトップを観測・操作できる。このグループは排他的プロバイダー登録を所有する。各プロバイダーは自身の操作、ツール、プラットフォーム要件を所有し、実験的 Cua Driver プロバイダーは experimental グループに属する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

プロバイダーを 1 つ選択し、共有登録サービスをマウントする。

| Package | Role | ctx key |
|---|---|---|
| [`computer-use`](computer-use/README.md) | Exclusive named provider registration | `ctx.computerUse` |

<a id="related-documentation"></a>
## 関連ドキュメント

- [コンピューター利用](../../docs/subsystems/computer-use.md) — capability ownership and provider choices.
- [実験的パッケージ](../experimental/README.md) — Cua Driver MCP and native providers.

<a id="dev-note"></a>
## 開発者ノート

None.
