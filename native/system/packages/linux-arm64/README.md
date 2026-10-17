---
description: "Linux arm64 向けのビルド済み Landlock ランチャーと POSIX flock アドオン。"
kind: "package-library"
---
# @deepseek-ai/node-addon-system-linux-arm64

日本語 | [English](README.en.md) | [中文](README.zh.md)

このプラットフォームパッケージは、静的 musl 実行ファイル `bin/landlock-run` と Node-API v8 アドオン `bin/glibc/system.node` および `bin/musl/system.node` を含む。エントリーは、実行中の Node プロセスの libc に一致するアドオンを選ぶ。Landlock 実行ファイルは両方の libc システムにサービスする。

このパッケージは JavaScript やインストール時のビルドスクリプトを含まない。プラットフォームの prepack は、完全なペイロード、ELF アーキテクチャ、Node-API エクスポート、ランチャーの実行可能性を検査する。インストール済みアーティファクトのリハーサルはバイトとネイティブの振る舞いの実行を検査する。ワークスペースの[サポートマトリックス](../../docs/support-matrix.md)を参照。
