---
kind: upgrade-guide
description: "Stored credentials now precede environment fallbacks when the store is mounted; the shipped headless profile omits stored authentication."
---

# 保存キーがエクスポート変数より優先される

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

以前のリリースでは、`$DSH_HOME/.credentials.yaml`（デフォルトでは `~/.dsh/.credentials.yaml`）内の同名 `refs` エントリよりも、エクスポートされた環境変数が使用されていた。これは `DEEPSEEK_API_KEY=… dsh`、シェルプロファイルのエクスポート、CI シークレット、コンテナーの `-e` 値に適用されていた。その名前がエクスポートされている間、Models ページはその名前のキーを保存できなかった。

現在は保存エントリが優先される。エクスポート変数は、その名前の値がファイルに保存されていない間のみ適用され、`$cwd/.env` と `$DSH_HOME/.env` は両方の後でのみ適用される。Models ページは、その名前がエクスポートされていてもキーを保存・置換できる。

出荷 `headless` プロファイルは代わりにクレデンシャルストア、認可、DeepSeek アカウントプロバイダーを無効にする。起動環境、プロジェクト `.env`、Harness ホーム `.env` の順に使用し、`.credentials.yaml` には触れない。保存済み API キーとサインインはデフォルトで headless ジョブを認証しなくなった。Web、SDK、ACP はストアを保持する。

影響を受けるのは、harness ホームが `refs` 配下に値を保存し、`dsh` を起動するプロセスが同名をエクスポートしている場合である。そのようなホームをマウントしたコンテナーも含まれる。リクエストはエクスポートされたものではなく保存キーを使用するようになる。`.credentials.yaml` のない新規 harness ホームで開始する CI ジョブやコンテナーは影響を受けない。理由は[保存クレデンシャル優先順位](../../../../.agents/notes/implemented/architecture/2026-10-09-stored-credential-precedence.md) Agent Note に記録されている。

## 移行手順

1. `$DSH_HOME/.credentials.yaml` 内の `refs` 配下の名前と、シェル・CI ジョブ・コンテナーがエクスポートする変数を比較する。片方にしか存在しない名前は対処不要である。
2. 両方に存在する名前ごとに、求めるアカウントであれば保存キーを保持する。そうでなければ `refs` 配下のその名前の行を削除する。実行中の harness はファイルを再読み込みするため、再起動なしに次のリクエストがエクスポート変数を読み込む。
3. headless ジョブでは、必要なキーをエクスポートして `dsh headless "<task>"` を実行する。保存キーやサインインを使い続けるには、3 行の [headless 復元パッチ](../../../../packages/bundle/headless/README.md#credentials)を適用する。ストレージ復元により保存優先の優先順位も復元される。既存のプロファイル・ホーム・コマンドオーバーレイが同梱行をオーバーライドできるため、実効構成の確認時は `dsh headless --dump-config` を検査する。
4. 意図したリクエストアカウントであること、必要な箇所で起動プロセスが空でない値をエクスポートしていることを確認する。クレデンシャル値を出力せずに名前と存在を確認する。保存クレデンシャルのみに依存する headless 実行は失敗するようになる。ストレージ復元か、対応する環境認証の提供で解決する。
