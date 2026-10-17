---
description: "dsh アプリバイナリーの起動方法を束ねる boot パッケージグループ: 環境読み込み、プロファイルとパッチ層、明確な起動失敗、アプリ所有のコマンドライン。"
kind: "package-group"
---

# boot/ — 共有アプリバイナリー起動処理

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

boot グループはプロファイルアプリケーションを起動し、そのインストール済み構成を管理する。`app-boot` は設定を解決して Loader を起動し、`cmdline` はアプリケーション引数を提供し、`plugin-manager` は CLI と共有する現在プロファイル操作を公開する。各パッケージの詳細は各パッケージ README が所有する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`app-boot`](app-boot/README.md) | `cordis.yml` から dsh アプリを起動する。`.env` を読み込み、プロファイルとパッチ層を適用し、起動失敗を明確に報告する（バイナリー向けライブラリー） | (バイナリー向けライブラリー) |
| [`cmdline`](cmdline/README.md) | アプリがフラグ、`--help`、終了コードを所有できるようにする。ランチャーのフラグより後ろのすべてをそのまま渡す | `cmdlineArgs`、`appExit` |
| [`hmr`](hmr/README.md) | パッケージ変更に伴うモジュールと設定のリロードを調整する | `hmr` |
| [`config-editor`](config-editor/README.md) | Loader 照合経由で有効なプロファイル設定を永続化する | `configEditor` |
| [`plugin-manager`](plugin-manager/README.md) | 共有 CLI 操作経由で現在プロファイルのプラグインとバンドルパッケージを管理する | `pluginManager` |
| [`plugin-market`](plugin-market/README.md) | Discover と `plugin_market` ツール向けにユーザーが設定したプラグインマーケットインデックスを読む | `pluginMarket` |

<a id="related-documentation"></a>
## 関連ドキュメント

- [dsh アプリ](../../apps/cli/README.md) — 起動シーケンスにこれらのヘルパーを消費する `dsh` バイナリー。
- [プロファイルバンドル](../bundle/README.md) — `dsh --profile` 構成がマウントするインストール可能なパッチ層。
- [dsh-home-paths](../util/home-paths/README.md) — 両パッケージが構築するハーネスホーム解決。
- [dsh-cmdline](cmdline/README.md) — ランチャーではなくアプリがフラグ体系を所有する仕組み。

- [プロファイル管理](../../docs/subsystems/boot.md) — サービスメソッドと結果レコード。

<a id="dev-note"></a>
## 開発ノート

なし。
