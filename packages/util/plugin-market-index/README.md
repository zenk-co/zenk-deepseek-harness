---
description: "DSH 読手と索引生成子用の插件市場索引形式 1 検証と導入引数。"
kind: "package-library"
---

# dsh-plugin-market-index

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

插件市場索引の形式 1 用の実行時依存なし検証子。導入可能 DSH bundle を表示附属とともに列挙する単一 JSON 文件である。[形式 Agent Note](../../../.agents/notes/implemented/feature/2026-10-02-plugin-market-index-format.md) が文書を定め、この包はその実行規則集合である。DSH の [`dsh-plugin-market`](../../boot/plugin-market/README.md) はそれで索引を読み、索引生成子は公表前にそれで出力を検証する。

## 目次

- [このパッケージを使う](#use-this-package)
- [API](#api)
- [モデル体験](#model-experience)
- [既知の制限と後回しの作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

服務でも插件でもない蔵書である。`ctx` なし、登録なし、状態なし、入出力なし。

取ってきた文書を JSON として構文解析し、値と読んだ URL を `parseMarketIndex` に渡す。最初に破った規則が違反値の JSON 経路付き `MarketIndexError` を送出する。成功結果は形式が定めない員を落とし、欠けた `metadata` 群、`keywords`、`labels`、`sortKeys`、`engines` を空値で満たし、各插件の `versions` を降順 SemVer 先後で順序付け、各相対 `icon` 参照を絶対 URL に置換する。

`marketInstallTarget(name, version)` で版 1 つを導入する。厳密 pnpm 仕様を返し、npm 用は `name@version`、Git 用は任意 `path:` 媒介子付き確定固定 `git+https` URL であり、版が名指す場合は先に問う登録所も返す。

-----

<a id="api"></a>
## API

```ts
import { MarketIndexError, marketInstallTarget, parseMarketIndex } from '@deepseek-ai/dsh-plugin-market-index'
```

| 表出 | 役割 |
|---|---|
| `parseMarketIndex(value, indexUrl)` | 検証済み `MarketIndex`。最初に破った規則に `MarketIndexError` を送出する。 |
| `marketInstallTarget(name, version)` | その厳密版を導入する `{ spec, registry? }`。 |
| `MarketIndexError` | `path` と `reason` を運ぶ検証失敗。 |
| `MAX_INLINE_ICON_BYTES` | 行内 `data:` 図標の最大復号荷。32 KiB。 |
| `MarketIndex`, `MarketPlugin`, `MarketVersion`, `MarketEngines`, `MarketSource`, `MarketRepository`, `MarketIndexMetadata`, `MarketPluginMetadata`, `MarketDeclaration`, `MarketSortKeyDeclaration`, `MarketInstallTarget` | 検証済み記録型。 |

<a id="model-experience"></a>
## モデル体験

`dsh-plugin-market` 経由で間接的に関わり、その `plugin_market` 道具が検証済み插件を模型に返す。

#### KV キャッシュへの影響

自身のものはなし。插件を運ぶ道具結果がその要求の緩衝動作を所有する。

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>

- **生成子義務は未検査** — 検証子は `name`、`version`、`publishTimestamp`、`engines.dsh`、表示項目が述べる包と合うか、包が bundle を宣言するかを検証できない。
- **寸法上限なし** — 呼出者は構文解析前に文書を限る。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
