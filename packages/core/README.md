---
description: "中心群地図。durable セッション記録、 system-prompt 組立、道具登録、応答者語彙、既定循環から成る製品 API 背骨。"
kind: "package-group"
---

# packages/core

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

durable セッション履歴を記録し、system prompt を組み立て、道具を表し、既定模型を選び、模型ターンを走らせる応答者を作り広げるには中心包を使う。これらの包は全組み立てが使う共有 API を定め、実行可能製品組立は [`packages/bundle`](../bundle/README.md) 下にある。応答者動作を作る場合やそれらケイパビリティの 1 つを置換する場合はこの群を選び、既定の走行可能組み立てが要る場合は [`dsh-base`](../bundle/base/README.md) から始めること。

## 目次

- [パッケージ群](#packages)
- [関連文書](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ群

| パッケージ | 役割 | ctx 鍵 |
|---|---|---|
| [`scope/`](scope/README.md) | 1 応答者の寄与を隔てる適用範囲付き登録とイベント経路 | 蔵書 — ctx 鍵なし |
| [`session/`](session/README.md) | 各応答者履歴が導く追加専用セッションイベント記録 | `ctx.sessions` |
| [`system-prompt/`](system-prompt/README.md) | 順序節、道具 schema、変数からの system-prompt 組立 | `ctx.systemPrompt` |
| [`tools/`](tools/README.md) | 循環が送出する道具登録と防護実行管路 | `ctx.tools` |
| [`agent-tool-presentation/`](agent-tool-presentation/README.md) |  preset 用応答者ごと道具表示選択子 | ctx 鍵なし |
| [`agent/`](agent/README.md) | 插件が計画する `Agent` 把手とその生き登録、イベント | `ctx.agents` |
| [`agent-default-model/`](agent-default-model/README.md) | 配備既定模型選択。新応答者に入口点が当てる | `ctx.agentDefaultModel` |
| [`agent-loop/`](agent-loop/README.md) | 既定応答者駆動。応答者を作りターンと段階寿命を走らせる | `ctx.agentLoop` |

`scope` は共有適用範囲素材を供給し、`agent` は公開 `Agent` 契約を所有し、`agent-loop` はその既定実装であるため、拡張插件は `agent` に依存し、駆動は交換可能なままである。`agent-default-model` は独自もののない会話に入口点が当てる配備選択を所有する。走行可能組み立ては [`packages/bundle`](../bundle/README.md) 下にあり、この群は交換可能背骨片のみを所有する。

-----

<a id="related-documentation"></a>
## 関連文書

- [中心 subsystem](../../docs/subsystems/core.md) — 包ごとの循環地図と `Agent` 把手契約。
- [セッション subsystem](../../docs/subsystems/session.md) — セッションイベント語彙と導出履歴。
- [system-prompt subsystem](../../docs/subsystems/system-prompt.md) — prompt 節、動的文脈、道具 schema 型。
- [道具 subsystem](../../docs/subsystems/tools.md) — 道具実行管路と表示語彙。
- [適用範囲付き登録 subsystem](../../docs/subsystems/scope.md) — これら登録が築く適用範囲層素材。
- [体系](../../docs/architecture.md) — ターン流れと新動作の行き先。
- [基本 bundle](../bundle/base/README.md) — 既定製品組み立て。
- [SDK 最小 bundle](../bundle/sdk-minimal/README.md) — 故意に小さい機能集合の完全単立組み立て。

-----

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
