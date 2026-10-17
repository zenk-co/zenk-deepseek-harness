---
description: "Configure experimental local computer use with an installed Cua Driver MCP executable and exclusive provider registration."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-computer-use-cua-driver-mcp

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

インストール済みの Cua Driver を通じてモデルにローカルデスクトップを操作させます。このパッケージを computer-use サービスと共にマウントすると、ドライバー独自のツール説明、引数、結果を MCP 経由で公開します。インストールとデスクトップ権限は Cua Driver 側に残り、既定で有効になるドライバーはありません。プロバイダーは接続とツールが閉じ切るまで computer use を予約します。同時実行セッションの調整は呼び出し側で行ってください。

## 目次

- [このパッケージの利用](#use-this-package)
- [実装の理解](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの利用

DSH と同じマシンに Cua Driver がインストール・設定済みの場合にこのプロバイダーを選びます。プラットフォームのセットアップは[上流のインストール・権限ガイド](https://github.com/trycua/cua/blob/cua-driver-rs-v0.28.0/libs/cua-driver/README.md)に属します。

### 最小設定

ツールとシステムプロンプトサービスを提供する構成に次の行を追加します。スクリーンショットにはアタッチメントストアと画像入力を宣言するモデルルートも必要です。

```yaml
- name: '@deepseek-ai/dsh-computer-use'
- name: '@deepseek-ai/dsh-experimental-computer-use-cua-driver-mcp'
  config:
    command: cua-driver
    args: [mcp]
```

| Field | Default | Meaning |
|---|---|---|
| `command` | `cua-driver` | Installed executable path or PATH command |
| `args` | `[mcp]` | Arguments passed directly without a shell |
| `toolCallTimeoutMs` | MCP client default | Per-call timeout override in milliseconds |
| `reconnect` | MCP client policy | Optional reconnection overrides |

生成済みの[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-experimental-computer-use-cua-driver-mcp)は受け付けるフィールドを列挙します。タイムアウトと再接続の既定値は [MCP クライアント](../../mcp/mcp-client/README.md) に属します。

### 有効化と所有権

プロバイダーは接続前に `cua-driver-mcp` として登録します。2 つ目の computer-use プロバイダーは有効化に失敗します。このパッケージの別インスタンスも含みます。初期化失敗や初期ツール検出の失敗はこのエントリーを拒否し、クリーンアップ後に登録を解放します。以降の切断では、MCP クライアントの再接続中や試行予算の使い切り中は登録を保持します。解放にはエントリーをアンロードしてください。

モデルには `mcp__cua-driver-mcp__` 固定名前空間のツールが見えます。ツール名、説明、入力スキーマ、正規結果、画像許容は既存の [MCP ブリッジ](../../mcp/mcp-client/README.md) に従います。追加の DSH アクションカタログやプロバイダー選択ツールはありません。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

[`src/index.ts`](src/index.ts) は computer-use 予約と所有 MCP 子プロセスを 1 つの順序付き effect にまとめます。子プロセスのティアダウンは、有効化失敗時も含め、予約 disposer より先に完了します。認証情報スクラブ、サブプロセス終了、ツール同期、キャンセル、 durable 画像プロジェクションは MCP クライアントに属します。

### インストール済みドライバーの検証

リポジトリルートから、Cua Driver 実行ファイルの絶対パスでライブ互換性テストにオプトインします。ツールを検出し、`prompt: false` で `check_permissions` を呼び、ティアダウンを検証します。macOS では `--direct` が起動ホストの権限で MCP プロセス内にランタイムを実行します。既定の `["mcp"]` 引数を使う場合は `DSH_COMPUTER_USE_MCP_ARGS` を省略します。

```sh
DSH_COMPUTER_USE_MCP_EXECUTABLE=/absolute/path/to/cua-driver \
DSH_COMPUTER_USE_MCP_ARGS='["mcp","--direct"]' \
pnpm run test:e2e packages/experimental/computer-use-cua-driver-mcp/tests/installed-driver.e2e.ts
```

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Computer-use service](../../computer-use/computer-use/README.md) — exclusive named registration.
- [MCP client](../../mcp/mcp-client/README.md) — protocol discovery, execution, and image behavior.
- [Cua Driver](https://github.com/trycua/cua/blob/cua-driver-rs-v0.28.0/libs/cua-driver/README.md) — upstream executable and platform setup.

-----

<a id="model-experience"></a>
## モデル体験

### Cua Driver ツールとスクリーンショット

#### モデルが見るもの

インストール済みドライバーが宣伝するツール説明と入力スキーマが `mcp__cua-driver-mcp__<tool>` 名で現れます。成功呼び出しは順序付きテキストと許容スクリーンショットを保持します。未対応画像ルートには MCP ブリッジの診断テキストが届きます。ツール呼び出しと投影結果は通常の実行パイプラインでセッションログに入ります。

#### トークン効果

登録スキーマがモデルリクエストに入り、ツール引数、テキスト結果、許容画像がコンパクションまでコンテキストを加えます。正規インライン画像バイトはセッションイベント外に留まります。durable アタッチメント参照がモデル可視画像を識別します。

#### KV キャッシュ効果

不変のツール検出はツール定義プレフィックスを保持します。カタログ変更は最初の変更スキーマ以降の再利用を無効化することがあります。追加のツール結果は直前のリクエストプレフィックスを保持します。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

このプロバイダーはインストール済みドライバーと MCP ブリッジの対応ケイパビリティに依存します。

- デスクトップアクセスには上流のインストールとプラットフォーム権限が必要です。プラグイン有効化だけではすべてのデスクトップアクションが許可されることは証明されません。
- セッションは 1 つのデスクトップを共有します。一度に 1 つの computer-use ワークフローを実行するか、外部で調整してください。登録はセッションアクションを直列化しません。
- ドライバー更新で検出カタログが変わることがあります。プロバイダーにはランタイムのドライバー切替え、専用デスクトップ権限 UI、DSH アクション抽象化はありません。
- 起動期限とリッチ結果制限は [MCP クライアントの制限](../../mcp/mcp-client/README.md#known-limitations-and-deferred-work) に従います。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
