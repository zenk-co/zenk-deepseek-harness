---
description: "Linux x64 向けのプリビルド Landlock ランチャーと POSIX flock アドオン。"
kind: "package-library"
---
# @deepseek-ai/node-addon-system-linux-x64

日本語 | [English](README.en.md) | [中文](README.zh.md)

このプラットフォームパッケージは静的 musl 実行ファイル `bin/landlock-run` と Node-API v8 アドオン `bin/glibc/system.node`・`bin/musl/system.node` を含む。エントリーは実行中 Node プロセスの libc に一致するアドオンを選び、Landlock 実行ファイルは両 libc 系で使える。

このパッケージに JavaScript やインストールビルドスクリプトは含まれない。プラットフォーム prepack は完全なペイロード、ELF アーキテクチャー、Node-API エクスポート、ランチャー実行可能性を検査し、インストール成果物リハーサルはバイトを検査してネイティブ動作を実行する。ワークスペースの [サポートマトリクス](../../docs/support-matrix.md) を参照。
