---
description: "JavaScript entry for the prebuilt Landlock launcher and asynchronous POSIX flock."
kind: "package-library"
---
# @deepseek-ai/node-addon-system

日本語 | [English](README.en.md) | [中文](README.zh.md)

`./landlock-run` エントリは Landlock ランチャーパス、適用プローブ、付与引数、プロトコル定数をエクスポートする。独立した `./flock` エントリは `tryLockExclusive(fd): Promise<void>` をエクスポートする。どちらのエントリのインポートも `system.node` を読み込まない。パッケージにルートエクスポートは無い。

ロック操作は `LOCK_EX | LOCK_NB` を非同期に試みる。完了まで呼び出し元所有の記述子を開いたまま保つ。競合は `EAGAIN`/`EWOULDBLOCK` で拒否され、他のシステムコール失敗も拒否し、エラーはコード、正の errno、`syscall: 'flock'` を運ぶ。ネイティブ設定エラーも同じプロミスを拒否する。開かれたファイル記述に対する最後の記述子を閉じるとロックが解放される。バインディングは記述子を開いたり、複製したり、閉じたり、明示的にアンロックしたりしない。

任意の OS/CPU プラットフォームパッケージがバイナリを運ぶ。その `~x.y.z` 依存範囲は同一マイナーバージョン内の後のパッチを許す。Linux は `bin/landlock-run` と分離した `bin/glibc/system.node` / `bin/musl/system.node` を持ち、macOS は `bin/system.node` を持つ。欠落または読み込み不能な flock バインディングは取得を拒否し、インストール時コンパイルは無い。Landlock は既存の fail-closed プロトコルを持つ分離した実行可能ファイルのままであり、未対応カーネル/プラットフォームは使用不能をプローブする。

2 つの C ソースは監査可能性のために出荷される。ワークスペースの [アーキテクチャ](../../docs/architecture.md)、[対応表](../../docs/support-matrix.md)、[CLI 契約](../../docs/cli-contract.md) を参照。
