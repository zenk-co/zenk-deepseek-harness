---
kind: upgrade-guide
description: "HMR では、インストール済みパッケージに対するインストールは already-installed で失敗する。アップグレードでは先にパッケージを削除する。"
---

# インストール済みプラグインパッケージへの上書きインストールは HMR で拒否される

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

HMR で動作するプロファイル（出荷プロファイルはすべて該当）では、`pluginManager.installBundle(spec)` は従来、プロファイルが既に依存しているパッケージに対して pnpm を実行し、旧バージョンが動作し続ける中で `restart-required` を報告していた。現在は pnpm の実行前に失敗し、スペックがインストール済みパッケージを指名する場合（バージョンの有無を問わないレジストリ名、ローカルディレクトリ、あるいは依存保存時の git や tarball のスペック）には `application: 'failed'` と `error.code: 'already-installed'` で失敗し、プロファイルファイルを一切変更しない。同じスペックのインストールを繰り返しても `changed: false` ではなく同様に失敗する。

これは、`@deepseek-ai/dsh-api-remotes/client` の Host API とリモートクライアントを経由する `installBundle()` の呼び出し元、およびエージェントの `plugin_manager` ツール（`install_bundle`）に影響する。プラグイン管理を担うバンドルなど、削除できないインストール済みパッケージは、HMR の動作中に上書きインストールできなくなる。Web ページの公式プラグイン向け更新ボタンは、パッケージを削除してから新バージョンをインストールするようになった。HMR なしでは、インストール済みパッケージへの上書きインストールは従来どおり pnpm を実行し `restart-required` を報告する。

## 移行

1. インストール済みパッケージの別バージョンや別配置をインストールするには、まず `removeBundle(name)` を呼び出し、次に `installBundle(spec)` を呼ぶ。エージェントツールでは `remove_bundle` の後に `install_bundle` を呼ぶ。削除によりバンドルのプラグインは停止し、そのパッケージのマッピングは破棄されるため、新バージョンは新規にマッピングされて再起動なしに開始する。
2. コードが `ManagementError['code']` を網羅的に分岐している場合は、`already-installed` コードを処理する。
3. 移行を確認する。パッケージの再インストールが `already-installed` を返すこと、および `removeBundle` の後に同じ `installBundle` 呼び出しが新しい `version` とともに `applied` を返すこと。
