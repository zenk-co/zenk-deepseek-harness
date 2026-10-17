---
kind: upgrade-guide
description: "The `agent-instructions` row no longer accepts `dshHome`; instruction loading always resolves the harness home from `$DSH_HOME` or `~/.dsh`."
---

# 指示読み込みは一つのハーネスホームを解決する

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

`@deepseek-ai/dsh-agent-instructions` は `dshHome` 設定フィールドを削除した。プラグインは他のすべてのハーネスコンシューマーと同様に `@deepseek-ai/dsh-home-paths` の `resolveDshHome()` 経由でハーネスホームを解決する。ホームは設定され非空白の場合 `$DSH_HOME`、それ以外はチルダ展開付きで `~/.dsh` である。

`cordis.yml`、プロファイルパッチ、`--patch` オーバーレイが `agent-instructions` 行に引き続き `dshHome` を設定しても効果は無い。その行は stray キーを保持しプラグインは無視するため、指示読み込みはプロセスホームに従う。`dsh-skill-filesystem` や `dsh-shell-env` のような他のプロバイダーは独自の home フィールドを保持する。この削除は指示ローダーのみを対象とする。

## 移行手順

1. `cordis.yml`、`$DSH_HOME/cordis.patch.yml`、`$DSH_HOME/profiles/<profile>/cordis.patch.yml`、およびすべての `--patch` オーバーレイ内の `agent-instructions` 行から `dshHome` を削除する。
2. オーバーライドが非既定ホームを指していた場合は、代わりにプロセス用に `DSH_HOME` をエクスポートし、すべてのハーネスコンシューマーがそのホームを読むようにする。
3. `dsh --profile <profile> --dump-config` で `agent-instructions` 行が残りのフィールドのみ列挙すること、そのファイル存在時に新規セッションの初回リクエストが `Instructions from: $DSH_HOME/AGENTS.md` (または `~/.dsh/AGENTS.md`) を示すことを確認する。
