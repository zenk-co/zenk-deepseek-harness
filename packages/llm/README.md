---
description: "LLM ケイパビリティ群。提供者中立な模型呼出服務、DeepSeek と pi-ai 提供者適合子、要求再試行実行、再演意識字数測定。"
kind: "package-group"
---

# llm/ — LLM ケイパビリティ族

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

llm 群は harness の模型呼出ケイパビリティを与える。任意組み立てが模型提供者に要求を流す提供者中立服務 1 つに適合子、提供者固有要求附属、再試行実行、測定を加えたものである。中心 `llm` 包は各插件とセッション記録が使う文、内容塊、流塊語彙を定め、提供者適合子は提供者配線形式をその語彙に翻訳し、DeepSeek 要求拡張插件は模型入力外の寿命所有附属を提供し、`llm-retry` は durable 応答者段階境界で失敗要求を再走させ、`token-meter` は durable 記録から要求と文脈圧を測る。この頁は群を写像し、各包 README が包ごと契約を所有する。

## 目次

- [パッケージ群](#packages)
- [関連文書](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ群

| パッケージ | 役割 | ctx 鍵 |
|---|---|---|
| [`llm/`](llm/README.md) | 登録済み提供者適合子経由で 1 模型呼出を流し、harness 文、塊、流塊語彙を共有する | `ctx.llm` |
| [`llm-deepseek/`](llm-deepseek/README.md) | 共有 Messages 規約、要求設定、模型能力 | — |
| [`llm-deepseek-api-key/`](llm-deepseek-api-key/README.md) | 公式経路用 API 鍵認証と探索 | `ctx.llm` |
| [`llm-deepseek-account/`](llm-deepseek-account/README.md) | 勘定 token 認証、無効化、探索 | `ctx.llm` |
| [`llm-pi-ai/`](llm-pi-ai/README.md) | 手宣言門廊を含む pi-ai 目録と配線規約で設定済み提供者経路に給仕する | `ctx.llm` に登録 |
| [`deepseek-llm-api-extensions/`](deepseek-llm-api-extensions/README.md) | 公式 DeepSeek 要求に寿命所有最上位項目を登録する | `ctx.deepseekLlmApiExtensions` |
| [`plugin-package-inventory-deepseek/`](plugin-package-inventory-deepseek/README.md) | 公式 DeepSeek 要求に有効 Loader 包目録を提供する | `dsh_plugin_packages` に提供 |
| [`llm-retry/`](llm-retry/README.md) | durable 応答者段階境界で各提供者方針下に失敗模型要求を再試行する | `agent/request-error` を聴く |
| [`token-meter/`](token-meter/README.md) | 固定発見法で durable セッション記録から要求と文脈圧を測る | `ctx.tokenMeter` |

-----

<a id="related-documentation"></a>
## 関連文書

- [LLM 流 subsystem](../../docs/subsystems/llm-streaming.md) — 文と塊型、組立済み模型要求、`StreamChunk` 規約、適合子契約。
- [字数計 subsystem](../../docs/subsystems/token-meter.md) — `ctx.tokenMeter` 背後の測定意味論。
- [双 LLM 適合子](../../.agents/notes/implemented/architecture/2026-06-13-twin-llm-adapters.md) — DeepSeek 経路が構造の異なる適合子 2 つを出荷する理由。
- [経路付き模型文脈](../../.agents/notes/implemented/architecture/2026-07-20-routed-model-context-and-compaction-policy.md) — 循環が模型要求を経路付け文脈を圧縮する仕方。

<a id="dev-note"></a>
## 開発メモ

なし。
