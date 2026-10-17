---
description: "シェルエグゼキューター、サンドボックス、およびモデルに面する bash と pwsh ツールを選択・構成するデプロイとメンテナーのための bash ケイパビリティファミリー。"
kind: "package-group"
---

# shell/ — bash ケイパビリティファミリー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

shell グループはエージェントにコマンド実行を提供する: フォアグラウンドコマンドを実行してその上限付き出力を読む、またはバックグラウンドプロセスを開始してポーリングする。POSIX では Bash、Windows では PowerShell を使う。コンポジションごとにちょうど 1 つのエグゼキューター実装がマウントされる。サンドボックスエグゼキューターはすべてのコマンドをサンドボックスケイパビリティを通じて閉じ込め、モデルに面する `bash` と `pwsh` ツールはマウントされたエグゼキューターの上に乗る。POSIX には Bash エグゼキューター、Windows には PowerShell エグゼキューターを選び、コマンドにファイルレベルの閉じ込めが必要な場合はサンドボックス版を選ぶ。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`shell`](shell/README.md) | エグゼキューター契約を定義する: フォアグラウンド実行、バックグラウンドハンドル、リクエスト解決 | `ctx.shell` |
| [`bash-local`](bash-local/README.md) | POSIX で Bash コマンドを新しい `bash -c` プロセスとして実行する | `ctx.shell` を登録 |
| [`bash-sandbox`](bash-sandbox/README.md) | サンドボックスケイパビリティを通じて閉じ込めた Bash コマンドを実行し、拒否を事実として報告する | `ctx.shell` を登録 |
| [`pwsh-local`](pwsh-local/README.md) | Windows で PowerShell コマンドを新しい `pwsh -Command` プロセスとして実行する | `ctx.shell` を登録 |
| [`pwsh-sandbox`](pwsh-sandbox/README.md) | サンドボックスケイパビリティを通じて閉じ込めた PowerShell コマンドを実行する | `ctx.shell` を登録 |
| [`shell-env`](shell-env/README.md) | すべてのシェルコマンドが受け取る管理された `DSH_*` 環境を供給する | `ctx.shellEnv` |
| [`tool-bash`](tool-bash/README.md) | Bash 実行とバックグラウンドジョブを `bash` ツールとしてモデルに公開する | `ctx.tools` に登録 |
| [`tool-bash-persistent`](tool-bash-persistent/README.md) | モデルのシェル呼び出しを 1 つのオーナー分離された永続 Bash セッションで実行する | `ctx.tools` に登録 |
| [`tool-pwsh`](tool-pwsh/README.md) | PowerShell 実行を `pwsh` ツールとしてモデルに公開する | `ctx.tools` に登録 |
| [`tool-pwsh-persistent`](tool-pwsh-persistent/README.md) | モデルのシェル呼び出しを 1 つのオーナー分離された永続 PowerShell セッションで実行する | `ctx.tools` に登録 |

プロファイル層がちょうど 1 つのエグゼキューター実装（win32 層は POSIX 行を pwsh のものに差し替える。2 つをマウントするとロード時に重複サービス登録で大声に失敗する）と、必要なモデルに面するツールを選択する。サンドボックスコンポジションは `ctx.sandbox` プロバイダーと `ctx.sandboxPolicy` も選択する。出荷される配線は[ベースバンドル](../bundle/base/cordis.patch.yml)が所有する。

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [Bash エグゼキューターサブシステム](../../docs/subsystems/shell.md) — 共有の request/spec 語彙、結果、バックグラウンドプロセス、完全なサービス契約。
- [サンドボックスサブシステム](../../docs/subsystems/sandbox.md) — サンドボックスエグゼキューターが消費する閉じ込めケイパビリティ。

<a id="dev-note"></a>
## 開発者ノート

なし。
