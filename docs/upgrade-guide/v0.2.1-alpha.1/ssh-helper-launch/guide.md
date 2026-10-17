---
kind: upgrade-guide
description: "SSH and Node PTC configurations use explicit launch modes, and SSH clients require a matching protocol-2 helper."
---

# SSH ヘルパーと PTC 起動設定

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

カスタム SSH 構成は `cordis.yml` とインストール済みヘルパーの両方を更新しなければならない。`dsh-ssh` はトップレベルの `node`、`bootstrapPath`、`bootstrapHash` を `launch` に置き換え、SSH プロトコル 2 を要求する。`dsh-ptc-runtime-node` は `nodeExecutable` と `bootstrapPath` を `launch` に置き換える。接続の `nodeExecutable` と `bootstrapPath` ゲッターは `ptcLaunch` に置き換えられた。

## 移行手順

1. スクリプトヘルパーの場合、`node`、`bootstrapPath`、`bootstrapHash` を `launch: { kind: node-script }` の下に移動する。`helper`、`helperHash`、`host`、`workspace` は既存の位置に残す。一致するヘルパースクリプトをインストールして `helperHash` を更新し、構成されている場合はブートストラップとそのハッシュを一緒に更新する。
2. パッケージ化ヘルパーの場合、完全なアーカイブを展開し、`launch: { kind: executable }` を設定し、`helper` を実行可能ファイルの絶対リモートパスに、`helperHash` を `manifest.json` からのダイジェストに設定する。
3. リモート PTC プロバイダーを、構成内の既存 JavaScript 設定で `launch: ctx.ssh.ptcLaunch` により構成する。明示的に構成されたローカル Node ワーカーには `launch: { kind: 'node-script', executable: previousNodeExecutable, bootstrapPath: previousBootstrapPath }` を使う。省略されたローカル起動設定は引き続き現プロセスのランタイムを選択する。
4. 構成したプロファイルを開始し、リモートファイル読み取り、プロセスコマンド、PTC 呼び出しを試す。プロトコルまたはダイジェストの不一致は、インストール済みヘルパーとその設定の同時更新を要求する。[SSH デプロイ要件](../../../../packages/ssh/ssh/README.md#use-this-package) を参照。
