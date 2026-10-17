---
description: "Runtime API inspection, process-local runners, and historical Cordis cards."
kind: "package-group"
---

# packages/extensions

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

extensions グループは、エージェント用の読み取り専用実行時 API 検出、プログラム利用者とブラウザー利用者用のプロセスローカルランナー、歴史的生成プラグインカードを提供する。Creator モードは [Plugin Manager](../boot/plugin-manager/README.md) を通じて永続プラグインをインストールする。検査、Host 実行、Client 実行、ブラウザー制御には子パッケージを選択する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`tool-cordis`](tool-cordis/README.md) | 実行時 API 検出用の 2 つの読み取り専用ツール | `ctx.tools` に登録 |
| [`cordis-host-runner`](cordis-host-runner/README.md) | Host 側。定義レジストリー、サンドボックス化 Host 側ライフサイクル、ブラウザークエリに応答する検査レジストリー | `ctx.dynamicCordisRunner` と `ctx.cordisInspect` を提供 |
| [`cordis-client-runner`](cordis-client-runner/README.md) | ブラウザー側。ブラウザー側ソースを評価してライブプラグインにし、実行要求に応答する | client 面。ブラウザー `ctx.dynamicCordisRunner` を提供 |
| [`ui-cordis`](ui-cordis/README.md) | ブラウザーパネルと歴史的ライフサイクルツールカード | client 面。スロットを登録 |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [拡張サブシステム](../../docs/subsystems/extensions.md) — 生成 `ctx.cordisInspect` と `ctx.dynamicCordisRunner` サービス API。
- [生成ツールカタログ](../../docs/tool-catalog.md#deepseek-aidsh-tool-cordis) — 2 つの読み取り専用ツールスキーマ。
- [生成設定カタログ](../../docs/config-catalog.md#deepseek-aidsh-cordis-host-runner) — ランナーが受け付ける設定フィールド。
- [自己参照 Cordis ツールセットリファレンス](cordis-host-runner/README.md) — サンドボックス意味、ライフサイクル、構成の設計ホーム。
- [Client シェルと動的パッケージ Agent Note](../../.agents/notes/implemented/architecture/2026-08-15-client-shells-and-dynamic-packages.md) — クライアント側のパッケージ配置とビルド面。

-----

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

2 つのブラウザー側パッケージは、このサブシステムの二重側パッケージの半分であるため `packages/client/` 配下ではなくこのグループに存在する。client プログラムはクライアント面を通じてそれらをコンパイルし、host プログラムはホストランナーのみを参照する。

</details>
