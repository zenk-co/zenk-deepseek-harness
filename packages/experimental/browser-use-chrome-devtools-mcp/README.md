---
description: "Operate Chromium through Chrome DevTools MCP with separate browser state for each live Session."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-browser-use-chrome-devtools-mcp

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Chrome DevTools MCP を使ってページを検査し、上流ツール経由で Chromium を操作します。プロバイダーは作成または再開の完了前にセッションの MCP 接続を初期化し、ターンまたぎで保持します。別ブラウザーを起動するか、現在のタブとログイン状態を持つ既存ブラウザーに 1 セッションをアタッチします。この公開 experimental パッケージは明示的にマウントした場合のみ有効化されます。

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

セッションの作成または再開前に両エントリーをマウントします。エージェント、ツール、システムプロンプト、作業ディレクトリーサービスを提供するプロファイル構成で使います。このプロバイダーの読み込みや再読み込みは既に有効なセッションは取り込みません。ブラウザーインストールは上流ランタイムに従います。既存 Chromium インストールの選択には `executablePath` を使います。

```yaml
- name: '@deepseek-ai/dsh-browser-use'
- name: '@deepseek-ai/dsh-experimental-browser-use-chrome-devtools-mcp'
  config:
    mode: launch
    headless: true
```

既存ブラウザーを操作するには `mode: attach` を使い、`endpoint` に HTTP(S) デバッグ URL または WS(S) ブラウザーエンドポイントを設定します。新規ライブセッションは初期化中にアタッチメントを確保し、アンロードまで保持します。アタッチメントが使用中の場合、その有効化はこのブラウザーなしで続行し、以降のターンで再試行しません。解放後、新規作成または再開した有効化が取得できます。別セッションからの直接呼び出しは失敗します。クリーンアップは切断し、外部ブラウザーとページは実行したまま残します。

| Field | Default | Meaning |
|---|---|---|
| `mode` | required | `launch` or `attach`, fixed for this provider activation |
| `headless` | `true` | Launch without a visible window |
| `executablePath` | upstream discovery | Chromium executable for launch |
| `endpoint` | required for attach | Existing browser debugging endpoint |
| `toolCallTimeoutMs` | MCP client default | Per-call timeout in milliseconds |

[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-experimental-browser-use-chrome-devtools-mcp)は受け付けるフィールドを列挙します。ブラウザーモードの選択はプロファイルまたはプリセットです。

プロセス全体のシステムプロンプト `toolOrder` を設定する場合、ブラウザーツールは `<unlisted-tools>` の下に残してください。ブラウザーツール名を明示的に列挙すると、ブラウザー接続のないセッションでプロンプト組立てが失敗することがあります。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

プロバイダーはピン留め npm エントリーを解決し、現在の Node 実行ファイル配下で起動します。サービングプロセスの前に一時プロトコルプローブが先行することがあります。[共有ランタイム](../browser-use-runtime/README.md)は待機エージェント初期化、セッションごとの直列化、クリーンアップを所有し、[MCP クライアント](../../mcp/mcp-client/README.md)は転送、検出、結果投影を所有します。

ブラウザー状態はライブセッションがアタッチされている間ターンまたぎで存続します。MCP サーバーはセッションの検証済み現作業ディレクトリーで起動し、以降のセッションディレクトリー変更後も起動ディレクトリーを保持します。破棄はリソース解放前にサーバー終了を待ちます。再読み込み後の再開は新規ブラウザーランタイム状態で開始します。保存済み会話履歴は Cookie やページを復元しません。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Browser use](../../../docs/subsystems/browser-use.md) — provider selection and Session ownership.
- [Browser-use service](../../browser-use/browser-use/README.md) — exclusive provider registration.
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) — upstream installation and browser behavior.

-----

<a id="model-experience"></a>
## モデル体験

### ブラウザーツールとスクリーンショット

#### モデルが見るもの

ツールは上流の説明と JSON スキーマを `mcp__chrome-devtools-mcp__<tool>` 名で保持します。テキストとスクリーンショットは通常のツール結果パイプラインとセッションログを使います。スクリーンショットにはアタッチメントストアと画像対応モデルルートが必要です。他ルートには MCP 画像診断が届きます。MCP クライアントはリソースヘルパーと帰属サーバー命令も公開します。ブラウザー命令はこのセッションが接続を所有した後にのみ表示されます。対象リソース要求も同じ所有権を強制します。

#### トークン効果

カタログ、リソースヘルパー、サーバー命令がツール定義とプロンプトテキストを加えます。呼び出しは引数、テキスト、許容画像をセッション履歴に加えます。インライン画像バイトはモデル可視履歴外に留まります。

#### KV キャッシュ効果

不変のカタログはツール定義プレフィックスを保持します。結果は履歴に追記されます。プロバイダーまたはカタログ変更はプレフィックス再利用を減らすことがあります。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

統合はピン留めサーバーのブラウザーおよびツール制限を保持します。

- Chromium のみです。Firefox と WebKit は選択できません。
- 起動失敗やキャンセルはセッション作成または再開を拒否し、クライアントクリーンアップを起動します。切断クライアントは再試行されません。原因修正後は新規セッションを作成するか、既存セッションをアンロードして再開してください。
- アタッチメント排他はこのプロバイダーインスタンスにローカルです。他プロセスやブラウザーユーザーは同じページを変更できます。
- 共有リソースサーバー目録は継承サーバー名を表示することがあります。他セッションのブラウザーへのアクセスは付与しません。
- キャンセルはブラウザーに到達済みのナビゲーション、クリック、その他アクションを取り消しません。
- ツールスキーマはピン留め experimental 依存に従い、DSH 安定性約束はありません。
- 利用統計は無効です。性能ツールを含む他機能は上流動作を保持します。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
