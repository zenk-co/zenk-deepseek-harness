---
description: "Linux 閉じ込めと POSIX セッション書き込みロック向けのビルド済みシステムプリミティブ。"
kind: "package-library"
---
# @deepseek-ai/node-addon-system

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Linux では `landlock-run` 実行ファイルでサブプロセスを閉じ込め、`./flock` エントリーで POSIX 書き込みロックを取得する。プラットフォームパッケージはビルド済みバイナリーを含み、消費者のインストール時にネイティブコードをビルドしない。Landlock ポリシーとセッションライフサイクルは呼び出し側が所有する。

## 目次

- [使い方](#use)
- [サポート](#support)
- [開発](#development)

## 使い方

`@deepseek-ai/node-addon-system/landlock-run` は Landlock 向けに `launcherPath`、`probe`、`grantArgs` をエクスポートする。その実行ファイル名、フラグ、失敗セマンティクスは [CLI 契約](docs/cli-contract.md) で定義される。

[flock 動作契約](docs/flock-contract.md) は記述子、プロセス、勧告ロックのセマンティクスを独立したネイティブテストに対応付ける。

`@deepseek-ai/node-addon-system/flock` は `tryLockExclusive(fd): Promise<void>` をエクスポートする。完了まで記述子を開いたままにすること。取得はノンブロッキング排他 flock を使い、競合時は `EAGAIN` または `EWOULDBLOCK` で拒否され、開いているファイル記述に対する最後の記述子を閉じるとロックが解放される。[エントリー README](packages/entry/README.md) を参照すること。

どちらのエントリーのインポートもアドオンを読み込まない。Landlock 実行ファイルが欠けているとプローブは使用不可となり、flock バインディングが欠けていると取得は拒否される。どちらのパスも自動コンパイルやサポート外動作の暗黙の許可を行わない。

## サポート

Linux x64/arm64 パッケージは静的な Landlock 実行ファイルと glibc/musl 用の個別 `system.node` ファイルを含む。macOS x64/arm64 パッケージは `system.node` のみを含む。Landlock には加えて強制モードの Linux カーネルが必要であり、Windows は Harness の既存ロック実装を使う。[サポートマトリクス](docs/support-matrix.md) がビルダーと検証所有者を命名する。

## 開発

このディレクトリーから `pnpm build:ts` でエントリーをビルドし、`pnpm build:native` でホストの宣言済みネイティブペイロードをビルドし、`pnpm build:test-oracle` で独立した flock システムコールフィクスチャをビルドする。その後 `pnpm test` でエントリー、ロック、パッケージング、利用可能なカーネル動作をテストする。Linux の完全ビルドには musl-gcc が必要であり、macOS は cc を使う。ルートの `pnpm run build:native-system` はソーステスト用に現在のホストアドオンのみをビルドする。

[アーキテクチャ](docs/architecture.md)、[パッケージング](docs/packaging.md)、[リリース手順](docs/release.md) が実装と公開の詳細を所有する。

### 開発ノート

なし。
