---
description: "永続シェル・画像読み取り・自動文脈圧縮・セッション作業ディレクトリツールを備えたスタンドアロン SDK プロファイル。共有基盤バンドルなしの最小クロス平台コーディングエージェント用。"
kind: "package-bundle"
---

# `@deepseek-ai/dsh-sdk-minimal`

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

SDK クライアントが小さく明示的なコーディングエージェントランタイムを必要とする場合に `dsh --profile sdk-minimal` を使う。既定では、平台選択の永続シェル、`read_image`、`working_directory` を広告し、セッションを非圧縮 JSONL で永続化し、SDK 初期化要求からモデルを選ぶ。完全な Cordis ツリーを提供し、`dsh-base`、Web、設定、管理資格情報、テレメトリー、テキストファイルツール、ワークスペース指示、スキル、ジョブ、サブエージェントを除外する。その danger 全 access ポリシーはプロセスが利用できる任意パスをシェルが変更できるようにするため、分離ワークスペースでのみ使う。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

プロファイルを直接起動するか Python SDK から選ぶ。明示 `DSH_HOME` を提供し、使い捨てワークスペースを使い、`DEEPSEEK_API_KEY` 経由でモデル資格情報を提供する。

```sh
export DSH_HOME=/absolute/path/to/example-dsh-home
dsh --profile sdk-minimal
```

`DSH_CONTEXT_WINDOW` は適合器の助言カタログにないモデルの代替容量を設定する。`DSH_SYSTEM_PROMPT` は既定 persona を置換する。SDK 初期化要求が唯一のモデル選択であり、環境既定を上書きする。

永続的な外部依存の管理には `dsh plugin --profile sdk-minimal` を使う。プロファイル・ホーム・順序付き `--patch` ファイルは行を置換したり完全既定ツリーの上にバンドルを挿入したりできる。出荷テンプレートは起動時にのみパッチを適用する。

このプロファイルはちょうど 1 件の永続シェル stack をマウントする。Linux と macOS では Bash、Windows では PowerShell である。両 stack は 300 秒 timeout と所有者スコープのターミナル 1 件を使い、他平台の行は無効のままである。

すべての出荷プロファイルと同様に [MCP リソース](../../mcp/mcp-resources/README.md) を 1 回マウントする。サーバー追加には [MCP クライアントエントリ](../../mcp/mcp-client/README.md) のみを設定する。他プロバイダーがマウントしたクライアントも設定済みとして数える。呼び出し側スコープにサーバー設定がない場合、MCP はプロンプト文やツールを提供せず、既定はシェル、`read_image`、`working_directory` ツールのままである。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

バンドルの単一挿入は完全なアプリケーションツリーである。SDK stdio 起動と JSON-RPC 提供、環境設定済み DeepSeek 適合器 1 件、明示エージェント中核、条件付き MCP リソースツール、ローカルファイルシステム、画像添付、自動文脈圧縮、サブプロセスサービス、セッション作業ディレクトリ状態とそのツール、平台選択の永続シェル PTY、`$DSH_HOME/sessions` 配下の非圧縮 JSONL 永続化である。他バンドルを継承しないため、追加の行はすべて明示プロファイル変更である。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 完全なスタンドアロンプロファイルツリーとその環境基盤既定値 |
| [`src/index.ts`](src/index.ts) | バンドルパッケージ入口 |
| [`tests/sdk-minimal.spec.ts`](tests/sdk-minimal.spec.ts) | 厳密な構成・プロファイル名・平台選択の検査 |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [Python SDK 例](../../../python/sdk/examples/README.md) — 明示ハーネスホームに対して Python からこのプロファイルを起動する。
- [SDK アプリケーションバンドル](../sdk-app/README.md) — 完全版と最小版の SDK プロファイルが再利用する JSON-RPC アプリケーション層。
- [基盤バンドル](../base/README.md) — このプロファイルが意図的に省く完全な製品基盤。

-----

<a id="model-experience"></a>
## モデル体験

### 最小コーディングエージェント構成

#### モデルが見るもの

システムプロンプトは `DSH_SYSTEM_PROMPT` または `You are a helpful software engineer assistant.` である。MCP サーバー設定がない場合、広告ツールは `read_image`、`working_directory`、Linux/macOS の所有者スコープ永続 `bash` または Windows の `pwsh` である。必須ユーザー文脈は現行ディレクトリを提供する。任意実行時文脈、テキストファイルツール、ワークスペース指示、スキル、ジョブ制御、ハーネス同一性はない。

#### トークン効果

既定では安定 persona 1 件、ツールスキーマ 3 件、初期ディレクトリと以降変更のユーザー文脈である。設定済み MCP サーバーはそのツール、共有リソースツール、利用可能サーバー指示を追加する。画像はモデル入力トークンを消費する。画像が経路予算を超える場合、[画像 offload](../../compaction/compaction-image-offload/README.md) は古い画像出現を添付/パスプレースホルダーに恒久的に置換し、要求または圧縮要約を再試行する。自動圧縮は文脈圧力が設定しきい値に達すると追加の要約要求を送り、古いモデル可視履歴をその要約に置換する。耐久性のある JSONL ログはそれらのイベントを保持する。

#### KV キャッシュ効果

固定 persona・平台・プロバイダー・モデル・バンドルパッチ stack に対して安定である。圧縮は要求履歴の一部を置換し、キャッシュ再利用を減らし得る。画像 offload も最初の変更画像でキャッシュ再利用を終える。プロファイル変更は次プロセスに反映される。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- **構成は共有製品サービスを意図的に省く** — 設定、管理資格情報、ポリシー preset、テレメトリー、Web ツール、完全な既定ツール名簿が必要な場合は `dsh --profile sdk` を選ぶ。
- **画像読み取りには画像対応モデルが必要** — 画像入力を宣言する適合器の経路を選ぶ。テキスト専用経路はツール誤差を返す。画像は `$DSH_HOME/attachments/v1` 配下に保存される。
- **圧縮は自動である** — プロファイルパッチ経由で [compaction-basic](../../compaction/compaction-basic/README.md) を設定する。SDK プロンプト文は `/compact` や他のスラッシュコマンドを実行しない。
- **ユーザーパッチはツリーを拡大し stdout を壊し得る** — プロファイルカスタマイズは信頼済みアプリケーション構成であり、通常文を stdout に書くプラグインは JSON-RPC framing を壊し得る。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
