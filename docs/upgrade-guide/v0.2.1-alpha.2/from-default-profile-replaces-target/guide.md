---
kind: upgrade-guide
description: "`--from-default-profile` now replaces an existing custom profile instead of refusing it."
---

# `--from-default-profile` は既存プロファイルを置き換える

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

`dsh --profile <name> --from-default-profile <template>` は、対象プロファイル存在時に以前は `profile "<name>" already exists` で失敗し、残留した対象ディレクトリを拒否した。現在は対象ディレクトリを毎回テンプレートの新鮮なコピーで置き換え、起動するか、設定ダンプフラグ付きでは構成を印字する。以前のディレクトリは削除される。その `package.json` 依存、インストール済み `node_modules`、`cordis.patch.yml` を含む。出荷プロファイル名は文字大小を問わず引き続き対象として拒否される。

繰り返しコマンドを実行する人、例えばスクリプトやショートカットで `dsh rescue --from-default-profile web` を実行し、後の実行がプロファイルのプラグインやパッチを保持すると期待する人が影響を受ける。

## 移行手順

1. 既存プロファイルをリセットせず起動するには、オプションを落とす: `dsh rescue --from-default-profile web` の代わりに `dsh rescue` を実行する。
2. リセットをまたいでローカル変更を残すには、コマンド実行前に `$DSH_HOME/profiles/<name>/cordis.patch.yml` をコピーし、次に `dsh plugin --profile <name> add <package>` でプロファイルのプラグインを再インストールしてパッチを復元する。
3. 移行を確認する: `dsh rescue --from-default-profile web --help` の後、`$DSH_HOME/profiles/rescue/package.json` は依存を列挙しない。
