---
description: "ビジネスコンシューマー向けの共有テレメトリートランスポートプラグイン。"
kind: "package-group"
---

# telemetry/ — shared reporting

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このグループは製品分析とフィードバック認可のセッションアップロードで共有される報告インフラを提供する。ビジネスプラグインがイベント、アイデンティティー、認可、編集を選択し、トランスポートプラグインがエンコードと配送を所有する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

<a id="packages"></a>
## パッケージ

| Package | Role |
|---|---|
| [`otel`](otel/README.md) | Cordis service creating independent ordinary-event and byte-bounded Session-log channels |

<a id="related-documentation"></a>
## 関連ドキュメント

- [OTel サブシステム](../../docs/subsystems/otel.md) — shared service and consumer ownership.

<a id="dev-note"></a>
## 開発者ノート

None.
