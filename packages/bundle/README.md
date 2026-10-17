---
description: "共有コア、ブラウザー GUI、ワンショットタスク、ACP、SDK アプリケーション面向けの出来合い dsh プロファイルバンドル。"
kind: "package-group"
---

# bundle/ — プロファイルプラグインバンドル

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このグループは `dsh --profile` が使うインストール可能なパッチ層を対応付ける。各パッケージは `dsh.bundle.patch` を宣言し、ランチャーはそれらのパッチ文書を積み重ねて名前付きプロファイルを組み立てる。`web`、`headless`、`acp`、`sdk` の各プロファイルは `dsh-base` 上に構築され、`sdk-minimal` は完全なツリーを 1 バンドルで供給する。ドメインパッケージはこのディレクトリの外に追加層を宣言できる。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

<a id="packages"></a>
## パッケージ

| Package | Role | ctx key |
|---|---|---|
| [`base`](base/README.md) | base 派生プロファイル向けの共有コア | —（パッチのみ） |
| [`acp-app`](acp-app/README.md) | base 上の自動化専用 ACP stdio アプリケーション | ACP ブリッジをマウントする |
| [`web-app`](web-app/README.md) | base 上のブラウザーアプリケーション層 | Web 行をマウントする |
| [`headless`](headless/README.md) | base 上のワンショットコマンドラインタスクアプリケーション | `headless-runner` |
| [`sdk-app`](sdk-app/README.md) | base 上の SDK JSON-RPC stdio アプリケーション | SDK サーバーをマウントする |
| [`sdk-minimal`](sdk-minimal/README.md) | base も Web も使わない独立の最小 SDK アプリケーション | —（完全なパッチツリー） |

インボックスのバンドルは dsh インストールから解決される。ツリー外のバンドルは `dsh plugin --profile <name> add <package>` でプロファイルにインストールする。

<a id="related-documentation"></a>
## 関連ドキュメント

- [dsh アプリ](../../apps/cli/README.md) — プロファイルを開始する `dsh` コマンド。
- [app-boot](../boot/app-boot/README.md) — プロファイルの解決、層化、カスタマイズ方法。
- [プロファイルプラグインバンドル Note](../../.agents/notes/implemented/architecture/2026-08-05-profile-plugin-bundles.md) — プロファイルとバンドルの構成設計。
- [生成構成グラフ](../../apps/cli/composition.md) — 出荷プロファイルが使う正確な構成。

<a id="dev-note"></a>
## 開発者ノート

なし。
