---
description: "永続ハーネスエージェントを起動する利用者と保守者向けの、自動化専用 ACP stdio アプリケーションプロファイル。"
kind: "package-bundle"
---

# `@deepseek-ai/dsh-acp-app`

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

[`dsh-base`](../base/README.md) 上の `dsh` プロファイルバンドルとしての自動化専用 ACP stdio アプリケーション。ベースの無効モジュール HMR 方針を継承し、パッチはコーディングエージェント persona と既定モデルルートを設定し、アプリ所有のゼロオプションコマンドプロバイダーをマウントし、そのプロバイダーが呼び出しを受け付けてから [`dsh-acp`](../../acp/acp/README.md) を開始する。したがって `dsh --profile acp --help` は stdin も stdout も確保せずにヘルプを書いて終了する。

## 目次

- [このパッケージを使う](#use-this-package)
- [標準自動化ワークフロー](#standard-automation-workflow)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

起動プロバイダーは stdin EOF をランチャーの上限付き成功終了に束縛する。ACP 接続終了・SIGINT・SIGTERM は終了前にブリッジ所有のエージェントとルートプロファイルツリーを排出する。stdout は改行区切り ACP JSON-RPC フレーム専用である。バンドルはモデル生成セッション題名を無効にする。ACP が題名面を公開しないためであり、決定性フォールバック題名は補助モデル要求なしに耐久のままである。継承した投影キャッシュは ACP 作成セッションを後続利用者向けに検査点化する。その耐久バリアは対象ログ接頭辞ごとにキャッシュ行公開前に流し、そうでなければ合体する JSONL 実行を分割する場合がある。デプロイは別のアプリバイナリではなく、プロファイルバンドルとパッチファイルで異なる完全コンポジションを選ぶ。

出荷行は `deepseek-official` と `deepseek-v4-flash` でセッションを作成し、後続パッチはその行の完全な設定を置換できる。ベースプロファイルはアダプター・ツール・永続化・方針・設定・資格情報と、ACP クライアントが供給するセッションごとのワークスペースを所有する。

-----

<a id="standard-automation-workflow"></a>
## 標準自動化ワークフロー

ACP v1 SDK クライアントは `dsh --profile acp` を初期化し、絶対 `cwd` と任意の標準 stdio/HTTP MCP 宣言でセッションを作成し、広告された `model` または `reasoning_effort` を選び、標準意味更新を観測しながら促し、最後に `session/close` を呼ぶ。別プロセスは同じプロファイル永続化ルートに対して `session/list` と `session/resume` を使える。resume はその要求が供給する MCP 宣言を再接続し、履歴を再送しない。

完全な支援メソッド行列・MCP 信頼モデル・更新対応付け・停止理由は [`dsh-acp` プロトコル契約](../../acp/acp/README.md#standard-acp-v1-surface)にある。このプロファイルは非公開メソッド・ケイパビリティ・`_meta`・環境変数・輸送欄を追加しない。キーレス制御面適合性テストは公開 ACP SDK 越しに実際のプロファイルを駆動する。

<a id="model-experience"></a>
## モデル体験

### ACP コーディングエージェント persona

#### モデルが見るもの

プロファイルは一次ガイダンスの前に `You are a coding agent powered by the {{model}} model.` を供給し、ACP ルートが `{{model}}` を解決する。各セッションは [`dsh-working-directory`](../../session/working-directory/README.md) から必須利用者役コンテキストで現在ディレクトリを受け取る。

#### トークン効果

1 つの短い安定 persona に、データ依存のベースプロンプト節と選択ツールスキーマを加えたもの。

#### KV キャッシュ効果

固定プロファイル・プロバイダー・モデル・ツール名簿では安定である。出荷 ACP プロファイルは起動時限定パッチを使うため、プロファイル変更は次プロセスで有効になる。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **プロファイルは ACP ブリッジを省ける** — 独自 ACP 起動プロファイルはこのバンドルまたは別の `dsh-acp` 行を保持しなければならず、さもなければ相手に応答するピアがいない。
- **利用者プラグインは stdout 純度を破りうる** — プロファイルと起動ごとのパッチは信頼されたアプリケーションコンポジションである。出荷バンドルはプロトコル外 stdout を書かないが、任意に挿入されたプラグインを封じ込めることはできない。
- **設定変更には再起動が必要** — `acp-app` バンドルは YAML で HMR を無効にするため、1 つの stdio 接続が置換ブリッジやエージェント依存を観測することは決してない。


<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
