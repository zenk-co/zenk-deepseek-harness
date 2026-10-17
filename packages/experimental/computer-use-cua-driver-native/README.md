---
description: "Cua Driver コンピューター利用ツールをネイティブ npm SDK から実行し、耐久スクリーンショットと明示的ホストデスクトップ権限を備える。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-computer-use-cua-driver-native

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Cua Driver を使うと、別個の CLI やアプリケーションをインストールせずにデスクトップウィンドウを検査・操作できる。ネイティブ npm 依存が DSH host 内で動作し、Cua Driver 自身のツールを公開する。スクリーンショットは耐久添付を通じて画像対応モデルに届く。この公開済み experimental パッケージは起動 host のデスクトップ権限を要求し、明示的な構成選択のままである。

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

ツールレジストリとシステムプロンプトを既に供給する構成にプロバイダーをマウントする。

### 最小構成

```yaml
- name: '@deepseek-ai/dsh-computer-use'
- name: '@deepseek-ai/dsh-experimental-computer-use-cua-driver-native'
```

プロバイダーに構成フィールドはない。[package.json](package.json) で宣言された正確な Cua Driver npm バージョンを読み込み、その同一プロセス既定値を使う。ネイティブ import、ランタイム初期化、不正カタログ、重複ツール名、占有済み computer-use 登録の失敗は有効化を拒み、所有リソースをロールバックする。登録されるプロバイダー名は `cua-driver-native` である。
スクリーンショットを受け取るには、画像入力を明示宣言する添付ストアとモデルルートを使う。[MCP 結果アダプター](../../mcp/mcp-client/README.md)が画像受付と診断動作を所有し、プログラム呼び出し元はモデルが画像を受け取れない場合も正規の素の結果を保持する。呼び出しは Cua Driver の上流ツールパラメーターと結果を使う。

### Host 要件

ネイティブ依存はプラットフォームバイナリを npm 任意依存経由で供給する。任意依存を有効のままにする。DSH を起動するアプリケーションにデスクトップ権限を与える。このプロバイダーは権限を持つアプリをインストールも OS 付与変更もしない。ネイティブ Echo ランタイムは host プロセスを共有するため、ネイティブクラッシュがそのプロセスを終了させうる。別個の Cua Driver アプリケーションが権限と実行を所有すべき場合は[インストール済み MCP プロバイダー](../computer-use-cua-driver-mcp/README.md)を使う。

### インストール済み SDK の検証

リポジトリルートから、インストール済みネイティブ依存に対するこのオプトインチェックを実行する。ツールを検出し、`prompt: false` で権限状態を読み、ティアダウンを検証する。スクリーンショットを取得せず、入力を送らず、OS 権限を要求しない。`NODE_USE_ENV_PROXY` を消去すると、テスト設定前に Node が起動シェルのプロキシを取り込むのを防げる。

```sh
env -u NODE_USE_ENV_PROXY DSH_COMPUTER_USE_NATIVE_E2E=1 node node_modules/vitest/vitest.mjs run --config vitest.e2e.config.ts packages/experimental/computer-use-cua-driver-native/tests/native.e2e.ts
```

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

プロバイダーはネイティブコード読み込み前に共有 computer-use 登録を予約する。子プラグインが検出、モデルツール、ガイダンス、ネイティブ Echo ランタイムを所有する。親は子ティアダウンがツール除去、ネイティブ呼び出しと画像ケイパビリティ受付の中断、決着待ち、ネイティブシャットダウン完了を終えるまで登録を保持する。キャンセルはアプリケーションへ既に届いた入力を取り消さない。

| ファイル | 役割 |
|---|---|
| [src/index.ts](src/index.ts) | ネイティブ Echo ランタイム所有、カタログ検証、ツール登録、プロバイダーガイダンス |

ツール定義は既存 MCP 結果アダプターを再利用する。Cua Driver の JSON カタログがスキーマを定め、その素の結果が正規テキスト、構造化出力、画像バイトを供給する。computer-use サービスはプロバイダー名と排他登録のみを運ぶ。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [Computer-use サービス](../../computer-use/computer-use/README.md) — 排他的な名前付き登録。
- [MCP クライアント](../../mcp/mcp-client/README.md) — 共有結果と画像射影。
- [Cua Driver SDK](https://cua.ai/docs/reference/cua-driver/sdk-reference) — 上流ランタイム API と host 機能。

-----

<a id="model-experience"></a>
## モデル体験

### システムプロンプト

#### モデルが見るもの

ネイティブツールがマウントされている間、プロバイダーは次の computer-use ガイダンスを提供する。

##### ネイティブ Cua Driver ガイダンス

```markdown
Cua Driver native computer-use tools operate the host desktop. Discover the exact app and window, then get a fresh window snapshot before acting. Use element_token from that snapshot, or coordinates from its screenshot. A new snapshot of that window invalidates its earlier element tokens. Select either target or the legacy pid/window_id fields; do not combine them.

Prefer background delivery. A refusal does not authorize a foreground retry. Verify the requested outcome from fresh state after an action; a delivered click alone does not prove the outcome. After cancellation, inspect current state before retrying because completed input is not rolled back. Other sessions and applications may change the same desktop.

On macOS, cursor-overlay operations may return facility_unavailable even when screenshots and input work.
```

#### トークンへの影響

この固定ガイダンスはプロバイダーのマウント中にシステムプロンプトトークンを追加する。上流ガイダンスリソースは自動読み込みされない。

#### KV キャッシュへの影響

不変のガイダンスは繰り返しプロンプトプレフィックスを保つ。マウント・除去・編集はそのプレフィックスを変え、キャッシュ再利用を減らしうる。

### 検出された Cua Driver ツールと結果

#### モデルが見るもの

ツールは上流名の前に `cua_driver_native__` プレフィックスを付け、上流の説明と入力スキーマを保持する。上流ツールの拒否はツールエラーになる。対応スクリーンショットは結果テキストの隣に耐久画像参照として現れ、正規の素の結果はプログラム呼び出し元が利用可能なままである。

#### トークンへの影響

検出カタログは各リクエストにツール定義を追加する。アクセシビリティツリー、結果テキスト、受付済みスクリーンショットは呼び出しごとにコンテキストを追加する。素の base64 は実行ローカル正規値に残り、モデル履歴に複写されない。

#### KV キャッシュへの影響

不変のカタログはツール定義プレフィックスを保つ。ツール結果はセッション履歴に追記される。プロバイダーやカタログの置換はモデル可視ツールを変え、プレフィックス再利用を減らしうる。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

このパッケージは上流ドライバーのプラットフォームとアプリケーションの制限を継承する。

- **Host 権限とグラフィックスセッション** — npm インストールはデスクトップアクセスを付与せずグラフィカルセッションも作らない。
- **ネイティブカーソルオーバーレイ** — ヘッドレス macOS Node host では、スクリーンショットとバックグラウンド入力が使えてもオーバーレイ操作が `facility_unavailable` を返すことがある。
- **共有デスクトップ** — プロバイダーはセッション向けにウィンドウや完全ワークフローを予約しない。他の呼び出し元やアプリケーションが呼び出し間に同じデスクトップを変えうる。
- **キャンセル** — abort された呼び出しは入力を届け済みの場合がある。再試行前に新しい状態を検査すること。プロバイダーはアンロード中に SDK シャットダウンを待つが、ネイティブアクションのロールバックは約束しない。
- **シャットダウン失敗** — ネイティブシャットダウンが失敗すると登録は占有されたままである。別の computer-use プロバイダーをマウントする前に host を再起動すること。
- **Experimental リリース** — ツールスキーマはピン留め上流 SDK に従い、DSH 安定性約束はない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
