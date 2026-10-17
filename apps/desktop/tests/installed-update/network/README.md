---
description: "1 つの検証済みインストール更新テストアプリケーション向けの運用者所有 Windows ネットワーク障害と復旧。"
---

# テストアプリケーションのネットワーク障害

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

インストール済み認定アプリケーションの送信通信のみを遮断し、更新再試行の前にその正確な規則を除去する。ツールはアダプター・VPN・プロキシ・ファイアウォールプロファイルを決して無効にしない。実際の通信遮断は運用者の観測のままである。テストはすべてのファイアウォールコマンドレットを代用する。

## 目次

- [準備](#prepare)
- [遮断と復元](#operate)
- [証拠と制限](#evidence)
- [開発者ノート](#dev-note)

<a id="prepare"></a>

## 準備

バージョン 1 パッケージ検証を完了し、そのバージョンを[手順](../README.md)どおりにインストールする。展開済みペイロードではなく、インストール済み実行可能ファイルを指定すること。リポジトリルートからその計画を準備する:

```powershell
node --import tsx apps/desktop/scripts/prepare-installed-update-network.ts "<run.json>" "<installed-test.exe>" "<verification/result.json>"
```

準備側はバージョン 1 の識別子と署名証拠・正確なテストファイル名・一致する実行可能ファイルバイトを要求する。Windows 短縮パスを解決し、材料実行内の実行可能ファイルを拒否する。ネットワーク状態を変えずに `network-fault/plan.json` のみを書き込む。元の計画を保持すること。除去可能な 1 規則を識別するものである。インストール登録は依然として独立した運用者検証を要する。

<a id="operate"></a>

## 遮断と復元

これらは実際のファイアウォール認定の報告ではなく、保留中の手動手順である。管理者ターミナルを使い、遮断の前に復元コマンド入りの 2 つ目のターミナルを準備する。各呼び出しは新しい記録を書く。`Status` は既定であり、ファイアウォール状態を変えない。実行方針オプションはこの PowerShell プロセスにのみ影響し、システム方針を変えない。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File apps/desktop/scripts/installed-update-network.ps1 -Plan "<plan.json>" -Action Status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File apps/desktop/scripts/installed-update-network.ps1 -Plan "<plan.json>" -Action Block
powershell.exe -NoProfile -ExecutionPolicy Bypass -File apps/desktop/scripts/installed-update-network.ps1 -Plan "<plan.json>" -Action Restore
```

遮断を開始し、その確認待ちを残したまま受け渡しを開始する。前向きの進捗の後、表示された `BLOCK <run-id>` 確認を入力する。スクリプトはプログラム固有送信遮断を 1 件作る前に実行可能ファイルバイトと規則不在を再確認する。実際の受け渡し失敗を観測して取得すること。規則作成だけでは不十分である。復元を実行して `RESTORE <run-id>` と入力し、一致する規則を除去してから自分で再試行を押す。状態報告は規則不在でなければならない。失敗を強い出すために無関係な規則を変えてはならない。

<a id="evidence"></a>

## 証拠と制限

スクリプトは時刻付き段階と最終成否を `network-fault/records/<id>/events.jsonl` に流す。エラーで止まり、再試行も作成失敗後の黙った規則除去もしない。不確かな結果の後も復元を明示的に実行する。復旧は規則の名前・所有権説明・方向・動作・正確なプログラムパスを検証し、実行可能ファイルの現存を要求しない。不在の規則は安全な無操作であり、一致する外部規則は除去しない。

Windows は[プログラム固有送信規則](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/configure-with-command-line)を支援する。ローカル方針・既存接続・確認前に終わる受け渡しは意図した遮断を妨げうる。PersistentStore 内の規則は実効通信遮断を証明しない。アプリケーションを開いたまま、その失敗と後続の成功再試行を観測すること。いずれかがなければ試行を不完全として記録する。規則は除去まで残り、再起動をまたぐ。計画と復旧用ターミナルを利用可能に保ち、テスト規則が残ったまま更新をインストールしないこと。

<a id="dev-note"></a>

## 開発者ノート

ローカル計画検証と実際の PowerShell 制御フローには不活性テストがある。実際の規則作成・実効遮断・復旧は運用者の認可済みインストールアプリ実行を要する。
