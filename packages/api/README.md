---
description: "アプリケーションの Remote 層のパッケージ対応表:型付きクライアント・ホスト間ケイパビリティ呼び出し・結果・転送イベント。グループ内を移動する利用者と保守者向け。"
kind: "package-group"
---

# api/ — Remote API 層

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`api/` グループはアプリケーションの Remote 層を提供する。クライアント環境はホストで動作する業務ケイパビリティ（ゴール管理・コマンド実行・プラグインインベントリ一覧・ファイルやセッション参照の探索）を型付きメソッド呼び出しとして呼び、結果やストリームを受け取り、開いたストリーム上で上り項目を送り、転送されたホストイベントを観測できる。`remotes` はどのケイパビリティを公開し、各呼び出しがどのセッションのエージェントに届くかを決め、`gateway` は呼び出しとその結果をクライアント・ホスト間で運ぶ。積み重ねはアプリケーション共有 Connection 上で動作する。ストリーミングセッションデータは意図的にその外である。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

下記のパッケージが Remote 層を提供する。網羅的な契約はパッケージ README が所有する。

| Package | Role | ctx key |
|---|---|---|
| [`remotes/`](remotes/README.md) | クライアントが消費できるホストケイパビリティとイベントを選ぶ。 | — |
| [`gateway/`](gateway/README.md) | 型付き単発呼び出し、それぞれのクライアント上りを伴う多重化ストリーム、転送ホストイベントを運ぶ。 | `ctx.typertGateway` / `ctx.remote` |
| [`remote-access/`](remote-access/README.md) | 所有者でないピアが呼べる Remote メソッドを決め、一覧結果を絞り、各ピアのアクセススナップショットを流す。 | `ctx.remoteAccess` / `ctx.remote.remoteAccess` |
| [`job-controller/`](job-controller/README.md) | 1 バックグラウンドジョブの観測記録をクライアントへ流す。 | `ctx.jobController` / `ctx.remote.job` |
| [`session-controller/`](session-controller/README.md) | セッションコマンド・履歴ストリーム・稼働制御状態・エージェント/セッション識別子方針を所有する。 | `ctx.sessionController` / `ctx.remote.session` |
| [`settings-controller/`](settings-controller/README.md) | 設定画面読み書きを所有する。設定領域シーム越し。 | `ctx.settingsController`、`ctx.credentialsController` / `ctx.remote.settings`、`ctx.remote.credentials` |
| [`workspace-controller/`](workspace-controller/README.md) | ワークスペース変更と完全なクライアントワークスペース投影を所有する。 | `ctx.workspaceController` / `ctx.remote.workspace` |
| [`terminal-controller/`](terminal-controller/README.md) | セッション所有の対話シェル・画面復旧・ブラウザーターミナル制御。 | `ctx.terminalController` / `ctx.remote.terminal` |
| [`workspace-files/`](workspace-files/README.md) | 上限付きワークスペースファイルアクセス（`stat`・ページ式 `read`・`list`・計測操作 `changes` 送り）とその上のクライアント `file` 資源提供者を所有する。 | `ctx.workspaceFiles` / `ctx.remote.workspaceFiles` |

Remote 呼び出しはアプリケーション共有 Connection 越しにクライアントからホストへ動作し、ストリーム項目は Gateway 多重器上でホストからクライアントへ流れ、ストリームの上り項目は同じ論理ストリーム上でクライアントからホストへ流れる。API Gateway は Remote 輸送を所有し、制御パッケージはセッション・設定画面・ワークスペース動作を所有する。機能パッケージは Remote 呼び出しに収まらない応答（流し込み受け渡しなど）向けに正確な Connection Fetch 経路を登録する。

-----

<a id="related-documentation"></a>
## 関連ドキュメント

まず API Gateway 参照で Remote 模型を通しで見て、次に共有定義は Typert サブシステムページ、物理担体は Connection を見ること。

- [API Gateway 参照](../../docs/api-gateway.md) — Typert API Gateway の現状参照。プログラミングモデル・生成パイプライン・実行時呼び出し。
- [Typert サブシステム参照](../../docs/subsystems/typert.md) — プロトコル・Gateway・利用者アセンブリが共有する公開契約。
- [Connection](../client/connection/README.md) — すべての Remote 呼び出し背後の RPC 担体・`/api` 信頼 fence・応答封筒。

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
