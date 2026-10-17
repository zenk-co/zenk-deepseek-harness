---
description: "Linux と macOS 向けに組み込み Node ランタイム付き SSH ヘルパー実行ファイルをビルド・検証する。"
kind: "package-library"
---

# @deepseek-ai/dsh-ssh-helper-runtime

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Node や npm パッケージをインストールせずにリモートマシンで SSH ヘルパーを実行する。各アーカイブは実行ファイル、そのネイティブリソース、完全性メタデータを含む。プライベートキャリアーは既存 SSH プロバイダー経由で管理プロセス、ターミナル、サンドボックス、組み込み PTC ワーカーをサポートする。プロジェクトコマンドは引き続きリモートマシン自身の開発道具を使う。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

### ビルドとインストール

このプライベートワークスペースはリリースアーカイブを作る。プロファイルプラグインでも npm CLI でもない。依存関係をインストールしたチェックアウトから現在のネイティブプラットフォームをビルドする。

```sh
pnpm exec tsx scripts/build-exe-for-ssh-helper.ts
```

ビルダーは Node 24、C/C++ コンパイラー、その Node インストール由来の開発ヘッダーを要する。Linux は追加で `musl-gcc` を要する。その node-pty アドオンは glibc ベースラインを満たさなければならない。[ネイティブワークフロー](../../../.github/workflows/build-exe-for-ssh-helper.yml)はパッケージ前に互換アドオンを準備する。`--target` はネイティブ対象を 1 件選び、`--skip-build` は準備済み JS/ネイティブ出力を再利用し、`--dry-run` はビルドせずに対象と依存宣言を検証する。

| 対象 | ネイティブアーカイブ | 確認済みデプロイベースライン |
|---|---|---|
| `node24-linux-x64` | `linux-x64` | glibc 2.28 |
| `node24-linux-arm64` | `linux-arm64` | glibc 2.28 |
| `node24-macos-x64` | `macos-x64` | macOS 14 デプロイ対象 |
| `node24-macos-arm64` | `macos-arm64` | macOS 14 デプロイ対象 |

出力は `dist-exe/ssh-helper/` 配下にある。各 `dsh-ssh-helper-<version>-<platform>-<arch>.tar.gz` は対の `.sha256` ファイルを持つ。アーカイブは `dsh-ssh-helper`、`native/system/`、ライセンス、`manifest.json` を含む。macOS は追加で `dsh-ssh-helper-spawn-helper` を含む。マニフェストはソースコミット、ソースツリーが dirty か、組み込み Node バージョン、プロトコル、すべてのペイロードファイルのダイジェストと権限を記録する。

アーカイブチェックサムを検証し、ディレクトリ全体をプロジェクト外のバージョン付きランタイム位置と置換一時マウントに展開する。ネイティブリソースは実行ファイルの脇に保つ。インストールは読み取り専用でよい。ヘルパーユーザーは書き込み可能な一時/キャッシュ位置を要する。[`dsh-ssh`](../ssh/README.md) を `launch: { kind: "executable" }`、絶対 `helper` パス、マニフェスト由来の実行ファイル SHA-256 で設定する。クライアントは `ctx.ssh.ptcLaunch` 経由で組み込み PTC 呼び出しを得る。

### 検証と公開

[成果物検証器](../../../scripts/verify-ssh-helper-artifact.ts)は `--archive` と任意 `--report` パスを受け付ける。アーカイブを検証して移設し、インストールファイルを読み取り専用にし、新しいネイティブキャッシュを共有する 2 件の並行ローダー構成を実行する。それらの構成は SSH プロバイダー経由でファイル、プロセス、PTY、ネイティブ flock、PTC を exercise する。macOS はチェックアウトとホスト Node を拒むポリシー配下でもワーカーを実行する。`--sandbox=required` は真の閉じ込めを要求する。Linux の追加 `--backend=landlock-run` チェックは bwrap 調査を利用不可にし、パッケージ済み Landlock ランナーを要求する。

[OpenSSH 検証器](../../../scripts/verify-ssh-helper-ssh.ts)は Linux `--archive` を受け付ける。Node インストールなしの一時 glibc 2.28 SSH サーバーを作り、リリースと使い捨て公開鍵のみマウントし、本番接続を exercise する。その可搬性レーンはカーネル閉じ込め主張をしない。そのチェックはネイティブホストレーンが所有する。テストアイデンティティ、ホスト鍵、ポート、ワークスペースは実行プライベートである。

通常の PR と master CI は SSH 実行ファイルをビルドせずにソースとビルドスクリプトのチェックを実行する。ヘルパー起動、ネイティブ依存、パッケージの変更ではマージ前に[ネイティブワークフロー](../../../.github/workflows/build-exe-for-ssh-helper.yml)を手動実行すること。選択対象を受け付け、既定で全 4 件である。`CI master` は手動 `ssh-helper` スイートも公開する。[リリース (SSH ヘルパー)](../../../.github/workflows/publish-ssh-helper.yml) は既定 `publish=false` である。選択 ref から全 4 対象をビルドし、クリーンビルド由来の完全な同コミット証拠を検証する。`publish=true` では一致する `dsh-v<version>` タグを要求し、テスト済みアーカイブと `SHA256SUMS` をその GitHub リリースに添付する。欠落リリースはドラフトとして作られる。公開前にネイティブ検証は必須のままである。デプロイ対象検査だけでは最古 macOS バージョンでの実行は確立しない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

キャリアーはリポジトリのパッチ済み `pkg --sea` パイプラインで閉じた依存集合を埋め込む。そのエントリーは SSH ヘルパー、管理サブプロセスランナー、PTC ワーカーを振り分ける。共有[デプロイヘルパー](../../../scripts/executable-packaging.ts)は Python SDK ビルダーにも提供する。本番デプロイはビルド道具起動前に開発インストール状態を復元するため、pnpm の自動依存チェックはそれらを刈り込めない。

オペレーティングシステムは Landlock と PTY ランチャーを真のファイルから実行しなければならない。プロセスローカル解決フックはシステムパッケージを同梱ネイティブディレクトリに向ける。node-pty は既存の実行ファイル相対 spawn ヘルパー規約を使う。バイナリ検査はパッケージ前に組み込みネイティブモジュールを、公開前に外部リソースをカバーする。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [SSH 接続](../ssh/README.md) — 認証、呼び出し、ライフサイクル。
- [PTC Node ランタイム](../../ptc-runtime/ptc-runtime-node/README.md) — 明示的ワーカ起動と実行上限。
- [SSH サブシステム](../../../docs/subsystems/ssh.md) — リモート実行座標。

-----

<a id="model-experience"></a>
## モデル体験

なし。このプライベートプロセスキャリアーはモデル向けツールもプロンプト内容も登録せず、そのコンシューマーが操作結果を所有するためである。

#### KV キャッシュへの影響

キャリアーは要求プレフィックス内容を加えない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- Windows と musl ベース Linux はビルド対象ではない。サンドボックス利用可否は引き続き対象カーネルとシステム道具に依存する。
- 自動ダウンロード、デプロイ、更新、接続 UI はアーカイブ生産とは別である。
- 実行ファイルはプライベートワーカー呼び出しを受け付け、任意 Node CLI 引数は受け付けない。プロジェクト `node` コマンドと入れ子 JavaScript サブプロセスは自身の Node インストールを要する。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
