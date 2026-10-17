---
kind: upgrade-guide
description: "Web 構成は Schedule 行を運ばなくなる。Automation tasks 任意バンドルがそれらを挿入する。"
---

# Schedule は Automation tasks 任意バンドルに移る

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

v0.1.7-rc.2 では、`@deepseek-ai/dsh-web-app` が `time-context`、`schedule`、`ui-schedule` の各行を `disabled: true` で運んでいた。プラグインページで Schedule を有効化すると、あるいは手動で、`- id: schedule` のような ID 対象の上書き（`disabled: false` 付き）が `$DSH_HOME/profiles/<name>/cordis.patch.yml` や `--patch` オーバーレイに書き込まれた。

次のリリースでは 3 行が Web 構成から削除される。プラグインページの公式グループに Automation tasks として表示される `@deepseek-ai/dsh-experimental-schedule-bundle` がそれらを挿入する。すべてのインストールでバンドルは無効の状態で出荷される。

ID 指定で Schedule を有効化していたプロファイルは、アップグレード後にそれを失う。ローダーは `patch: entry schedule not found`（`time-context` と `ui-schedule` も同様）の警告を出し、`schedule_*` ツールと Automation tasks ページが消え、保存済みリマインダーの配送が止まる。保存済みタスクと配送記録はディスクに残る。

## 移行

1. プラグインを開き、公式グループの Automation tasks を探して有効化する。このスイッチにより `$DSH_HOME/profiles/<name>/package.json` の `dsh.profile.bundles` に `@deepseek-ai/dsh-experimental-schedule-bundle` が追加される。手編集のプロファイルでは、そのエントリを自分で追加する。
2. `deliveryHistoryDays` など、`schedule`、`time-context`、`ui-schedule` の他フィールドを設定する既存の上書きは保持する。バンドルが行を挿入すれば再び適用される。`disabled: false` を設定するだけの上書きは冗長であり、削除できる。
3. 確認する。`dsh web` を再起動し、3 つの ID について `patch: entry ... not found` 警告が起動ログに出ないこと、およびサイドバーに Automation tasks が以前保存したリマインダーとともに表示されること。
