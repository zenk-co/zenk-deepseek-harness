---
kind: upgrade-guide
description: "The Automation tasks optional bundle is removed; the Web composition mounts Schedule itself."
---

# Automation tasks バンドルの削除

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

v0.2.0-rc.2 では、Plugins ページで Automation tasks をオンにすると `$DSH_HOME/profiles/<name>/package.json` 内の `dsh.profile.bundles` に `@deepseek-ai/dsh-experimental-schedule-bundle` が追加された。そのバンドルは `time-context`、`schedule`、`ui-schedule` 行を挿入した。

次回リリースでバンドルを削除する。`@deepseek-ai/dsh-web-app` はすべての Web プロファイルに `schedule` と `ui-schedule` をマウントし、`standard`、`cordis`、`ptc` プリセットは時計読み取りと 4 つの `schedule_*` ツールを宣言する。`minimal` はどちらも宣言しない ([詳細](../../../subsystems/schedule.md))。

プロファイル読み込みは `dsh.profile.bundles` から `@deepseek-ai/dsh-experimental-schedule-bundle` を削除し `package.json` を書き換える。他のマニフェストフィールドは保持される。保存済みタスクと配信記録はディスクに残り、引き続き使用される。

## 移行手順

1. 影響を受ける各プロファイルで `dsh` を一度起動する。手動編集は不要である。別ツールが書き込むプロファイルディレクトリは `dsh.profile.bundles` からそのエントリを自ら落とさなければならない。
2. `schedule` と `ui-schedule` へのオーバーライドは `cordis.patch.yml` または `--patch` オーバーレイに残す。Web 構成がそれらの行を持つ。時計行はプリセットに属するため、トップレベルの `time-context` へのオーバーライドは行に一致しなくなる。削除する ([time-context](../../../../packages/context/time-context/README.md))。
3. 確認: `dsh.profile.bundles` がバンドルを列挙せず、Plugins ページに失敗した Automation tasks エントリが無く、サイドバーに以前保存したリマインダー付き Automation tasks が表示される。
