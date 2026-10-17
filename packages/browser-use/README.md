---
description: "ブラウザーバックエンドを 1 つ選択・登録するための browser-use ケイパビリティーパッケージ。"
kind: "package-group"
---

# packages/browser-use

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

browser-use プロバイダーによりモデルは Web ページを検査・操作できる。このグループは排他的プロバイダー登録を所有する。実験的プロバイダーがブラウザーツールを提供し、各セッションのブラウザーリソースを管理する。

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
| [`browser-use`](browser-use/README.md) | Exclusive named provider registration | `ctx.browserUse` |

<a id="related-documentation"></a>
## 関連ドキュメント

- [ブラウザー利用](../../docs/subsystems/browser-use.md) — capability ownership and provider choices.
- [実験的パッケージ](../experimental/README.md) — Playwright MCP, Chrome DevTools MCP, and Stagehand providers.

<a id="dev-note"></a>
## 開発者ノート

None.
