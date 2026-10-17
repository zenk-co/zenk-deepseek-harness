---
description: "load_workspace_dependencies ツール: バンドルされた Python、Node.js、pnpm ペイロードへの絶対パス。その場で使うか Harness ホーム配下にインストールする。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-workspace-dependencies

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

自前のスクリプトランタイムを出荷するデプロイメント (Desktop のプライマリランタイム、またはコンテナイメージ層) は、システムインタープリターを探索する代わりにバンドルされた Python、Node.js、pnpm の場所をエージェントが尋ねられるようこのツールをマウントする。ツールは絶対パスと記録済み配布バージョンを返す。`PATH` もパッケージマネージャー設定も変えない。ペイロードは初回使用時に Harness ホーム配下にコピーされるか (Desktop)、ある場所で使われる (読み取り専用キャリアー)。

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

ツールレジストリの隣にペイロードディレクトリ付きでプラグインをマウントする。設定検証は空でない `source` を要求し、空の `root` 値をアクティブ化前に拒否する。両パスは絶対でなければならない。バンドルされた Office スキル (`@deepseek-ai/dsh-skill-office`) は既定インタープリターにこのツールを名前で参照する。

### 最小構成

```yaml
- name: '@deepseek-ai/dsh-tool-workspace-dependencies'
  config:
    source: /path/to/primary-runtime
```

| フィールド | デフォルト | 意味 |
|---|---|---|
| `source` | 必須 | `runtime.json` と `dependencies/` を運ぶ絶対ペイロードディレクトリ。 |
| `root` | 未設定 | Harness ホーム配下の絶対インストールディレクトリ。設定時: 初回呼び出しでペイロードがそこにコピーされ、`runtime.json` が変わらない間再利用される。未設定時: ペイロードを検証してその場で使う。何もコピーしない。 |

### ペイロードレイアウト

`runtime.json` は `desktopVersion`、`platform` (`win32`、`darwin`、`linux` のいずれか)、`arch`、任意 `payloadDigest`、トップレベル `python`、任意 `node`/`pnpm` バージョン、完全な `pythonPackages` 配布バージョンマップを記録する。pnpm エントリーは Node.js を要する。numpy と pandas を含む Python ライブラリーは `pythonPackages` にのみ現れる。エントリーは `dependencies/` 配下にある。`python/bin/python3` (Windows では `python/python.exe`) とその下の `site-packages`、宣言されていれば `node/bin/node` と `node/node_modules` と `pnpm/bin/pnpm.mjs` である。プラットフォームまたはアーキテクチャーが実行プロセスと異なるマニフェストは拒否される。

macOS と Linux では、ビルダーは `python` と `python3` を兄弟バージョン付きインタープリターへの相対リンクとして保持する (例: `python3.12`)。インストールはこの 2 件の別名を保存し、他のリンクを実体化する。別名検証は正確な兄弟ファイル名と通常ターゲットファイルを要求する。リンクを保存できないキャリアー (Python wheel を含む) はサポートされる通常コマンドファイルを保持する。Windows は通常の `python.exe` ファイルを保つ。

パッケージ済み `sdk` プロファイルは既定でバンドル Python と Office スキルを使う。`DSH_PRIMARY_RUNTIME` はリソース位置を上書きし、空値はオプトアウトである。キャリアー既定のないソース起動は引き続きオプトインである。独立したスキル選択は[ランタイム構成](../../../python/sdk-runtime/README.md)を参照すること。スキルリソース欠落は起動警告を出す。無効または不完全な外部ランタイムペイロードは初回ツール呼び出しを失敗させる。プロファイル構成変更は SDK プロセスの再起動を要する。

### キャリアーペイロードのビルド

依存関係をインストールしたリポジトリチェックアウトから、`CI=true pnpm run prepare:primary-runtime --target linux-x64 --output /tmp/dsh-office` で `primary-runtime/` と `office-skills/` を書き出す。共有[ダウンロードロック](../../../scripts/primary-runtime/lock.json)は `linux-arm64`、`mac-arm64`、`mac-x64`、`win-x64` もカバーする。`--python-only` は Node.js と pnpm を省く。`--cache` はハッシュ検証済みアーカイブキャッシュを選ぶ。エントリーはネイティブ対象にのみインタープリターと Office 読み書きチェックを実行する。クロス対象ビルドはデプロイ前にその対象ホストでそれらのチェックを要する。

コンテナーは両ディレクトリを不変イメージレイヤーにコピーし、`DSH_PRIMARY_RUNTIME` を絶対 `primary-runtime/` パスに設定できる。SDK はそのペイロードをその場で問い合わせる。Desktop は同じビルダーを使い、Harness ホームのインストールと署名チェックを保持する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

`readPrimaryRuntime` とビルドスモークチェックは `parsePrimaryRuntime` を共有する。これはフラットマニフェストを検証し、重複する正規化配布名を拒否する。レガシー `components` メタデータはメモリー内で正規化され、その一貫性チェックを保持する。欠落したレガシー配布マップは空になる。フラットとレガシーの混在バージョン値は拒否される。読み取りはメタデータを書き換えず、同等な正規化マニフェストはインストール済みペイロードを再利用できる。`workspaceDependencyPaths` はプラットフォーム固有エントリーを導出する。`installPrimaryRuntime` はステージングディレクトリにコピーし、宣言済みインタープリターとスクリプトがファイルであることとパッケージルートがディレクトリであることを要求し、失敗時は以前のツリーを保持したまま定位置に交換する。`resolvePrimaryRuntime` はコピーせずに同じエントリーを検証する。ツールはプラグイン存続期間中の最初の成功準備をメモ化する。

| ファイル | 責務 |
|---|---|
| [`src/index.ts`](src/index.ts) | マニフェスト検証、パス導出、その場とインストール済みの準備、ツール登録。 |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [Office スキル](../skill-office/README.md) — インタープリターにこのツールを呼ぶワークフロー。
- [ツールレジストリ](../../core/tools/README.md) — 登録とスキーマ。

-----

<a id="model-experience"></a>
## モデル体験

### ツールスキーマ

#### モデルが見るもの

モデルは生成済み [`load_workspace_dependencies` スキーマ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-workspace-dependencies) を見る。

#### トークンへの影響

ツールが見えるリクエストごとに固定スキーマコスト。記述はバンドルされた Office ライブラリーを名指しするため、モデルはスキルを先に読み込まずにインタープリターを選べる。

#### KV キャッシュへの影響

ツール定義と可視性が変わらない間プレフィックス安定。

### ツール結果

#### モデルが見るもの

絶対 `python` と `pythonPackages` パス、`runtime.json` 由来の `pythonDistributions`、ペイロードが宣言していれば `node`、`nodePackages`、`pnpm` を持つ JSON オブジェクト 1 件。繰り返し呼び出しは同じオブジェクトを返す。

#### トークンへの影響

呼び出しごとに数百文字。パスが大半を占める。

#### KV キャッシュへの影響

ターン履歴中の追加専用ツール結果。プロンプト区分は加えない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- Linux 対象は glibc を要する。musl ペイロードはロックされない。
- その場で使う Windows ペイロードはキャリアーから既に実行可能でなければならない。その場モードは権限修復を行わない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

</details>
