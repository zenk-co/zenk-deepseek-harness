---
kind: upgrade-guide
description: "dsh plugin reads --profile only before the forwarded pnpm arguments and prints its own help."
---

# `dsh plugin` オプション配置

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

`dsh plugin` は、認識しない最初のトークンから始まる転送 pnpm 引数より前にある `--profile` のみを読み、独自のヘルプを持つ。以前はコマンドライン上のどこにある `--profile <name>` も受け付け、独自のヘルプは無く、`-h` と `--help` をどの位置からでも pnpm に転送した。

転送引数が pnpm コマンドから始まる場合、そのコマンド以降はすべて (`-h`、`--help`、`--profile` を含め) 逐語的に pnpm に届く。それ以外の位置では、先行 pnpm オプション (例 `--filter <selector>`) の後も含め、`-h` または `--help` は `dsh plugin` のヘルプを印字して終了コード 0 で終了する。`--profile` を pnpm コマンドの後または先行 pnpm オプションの後に置くスクリプトは `required option '--profile <name>' not specified` で失敗し、`dsh plugin --profile <name> --help` は pnpm のヘルプを印字しなくなる。

## 移行手順

1. `--profile <name>` をすべての pnpm 引数より前に移動する: `dsh plugin add <package> --profile <name>` を `dsh plugin --profile <name> add <package>` に置き換える。
2. 一つのコマンド用の pnpm ヘルプはそのコマンドの後で要求し、pnpm オプションもその後に置く。例 `dsh plugin --profile <name> add --help`。pnpm の一般ヘルプには `help` を転送する: `dsh plugin --profile <name> help`。
3. `dsh plugin --help` が `Usage: dsh plugin [options] [args...]` を印字すること、手順 1 と 2 のコマンドが pnpm に届くことを確認する。
