---
description: "web GUI host 半分の包地図。HTTP と SPA 服務器、作業域 directory 選択実装、応用内開き起動経路、插件目録投影、明示製品事象報告。"
kind: "package-group"
---

# host/ — web-GUI host 半分

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`host/` 群は web GUI の HTTP(S) 服務器、構築 Web 殻に給仕する SPA dist 服務器、共通縫目背後で置換し合う生、閲覧、適応組立包を伴う作業域 directory 選択縫目、作業域 directory を導入済み応用で開く応用探査と起動経路、読取専用插件目録投影、明示製品事象報告を与える。これら包は製品包である。browser 輸送は [`client/`](../client/README.md) にあり、組立応用は [`dsh-base` bundle](../bundle/base/cordis.patch.yml) を起動する [`apps/cli`](../../apps/cli/README.md) であり、`apps/web/` 下に web 応用に給仕する。選択後端は共有縫目背後で置換し合う。

## 目次

- [パッケージ群](#packages)
- [関連文書](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ群

包群は host 役割を演じる。各包 README が契約と設定を所有する。

| 包 | 役割 | ctx 鍵 |
|---|---|---|
| [`webserver/`](webserver/README.md) | Browser HTTP 服務器。名付き経路、上書、索引摘み、後退座 | `ctx.webServer` |
| [`frontend-static/`](frontend-static/README.md) | webserver 後退座上の SPA dist 服務器 | `ctx.webServer` を消費 |
| [`directory-picker/`](directory-picker/README.md) | 作業域 directory 選択縫目。ケイパビリティ契約と誤り語彙 | `ctx.directoryPicker` |
| [`directory-picker-native/`](directory-picker-native/README.md) | host 表示の運用者用生 OS 選択後端 | `ctx.directoryPicker` に登録 |
| [`directory-picker-browse/`](directory-picker-browse/README.md) | 遠隔 client を含む応用内 directory 閲覧後端 | `ctx.directoryPicker` に登録 |
| [`directory-picker-auto/`](directory-picker-auto/README.md) | 起動時に合う後端を載せる host 適応選択子 | 後端を載せる |
| [`open-in-app/`](open-in-app/README.md) | 作業域 directory を導入済み応用で開く応用探査、図標、起動経路 | `ctx.webServer` を消費 |
| [`plugin-inventory/`](plugin-inventory/README.md) | 現在 Loader 項目の読取専用投影 | Remote `pluginInventory/list` |
| [`product-telemetry-otel/`](product-telemetry-otel/README.md) | OTLP/HTTP 上の明示製品利用事象 | `ctx.productTelemetry` |

-----

<a id="related-documentation"></a>
## 関連文書

輸送と作業域記録は subsystem 参照から始め、Web client 背後の層化決定へ進む。

- [HTTP 服務器 subsystem](../../docs/subsystems/web-server.md) — webserver の経路、照合順、設定。
- [作業域 subsystem](../../docs/subsystems/workspace.md) — directory 選択が供給する作業域記録。
- [Web 設定木起動と輸送層化](../boot/app-boot/README.md) — Web 輸送層の所有。
- [製品計量](../../docs/subsystems/product-telemetry.md) — 明示解析事象提出。

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
