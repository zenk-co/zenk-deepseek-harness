---
description: "Browser-use provider registration for deployments that enable one browser backend at a time."
kind: "package-reference"
---

# @deepseek-ai/dsh-browser-use

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

デプロイでは一度に 1 つの browser-use プロバイダーを有効にできる。別のプロバイダーを読み込むと、登録済みプロバイダー名で失敗する。各プロバイダーは独自のツールを提供し、ブラウザーセッションを所有する。このパッケージはモデル可視のツールやブラウザー操作を追加しない。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と後回しにした作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

選択したプロバイダーと並べて、サービスを 1 回マウントする（Cordis 構成内）:

```yaml
- name: '@deepseek-ai/dsh-browser-use'
```

このサービスに設定はない。プロバイダープラグインは `browserUse` をインジェクトし、`ctx.browserUse.register(BrowserUseProviderName(name))` を呼び出す。このブランドは `@deepseek-ai/dsh-browser-use/brand` からエクスポートされる。返されるエフェクト破棄子がその登録を解放する。

プロバイダーはツール呼び出しの受け付けを停止し、リソースを閉じ、登録を解放する前に所有する作業を待機する。`ctx.browserUse.providerName` は解放まで登録名を報告する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

1 つのプライベート名がスロットを所有する。プラグインのアンロード時に Cordis エフェクトが提供物を除去し、繰り返された破棄子が後の登録を除去することはない。[ソース](src/index.ts)にはブラウザーオブジェクト、操作インターフェース、リソースライフサイクル、プロバイダーセレクターは含まれない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [Browser use](../../../docs/subsystems/browser-use.md) — プロバイダー選択とセッション所有権。
- [Playwright MCP プロバイダー](../../experimental/browser-use-playwright-mcp/README.md) — Playwright ブラウザーツール。
- [Chrome DevTools MCP プロバイダー](../../experimental/browser-use-chrome-devtools-mcp/README.md) — Chromium の検査と制御。
- [Stagehand プロバイダー](../../experimental/browser-use-stagehand-native/README.md) — AI 支援付きネイティブブラウザー操作。

-----

<a id="model-experience"></a>
## モデル体験

なし。このレジストリーはプロバイダー名を記録するだけである。

#### KV キャッシュへの影響

登録によってモデルリクエストは変わらない。プロバイダー所有のツールとガイダンスが、それぞれのリクエストプレフィックスへの影響を決定する。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

このサービスは Cordis サービスインスタンス内での登録を制限する。

- **ブラウザー所有権** — プロバイダーはブラウザーリソースを所有し、セッション分離を強制する。このサービスはブラウザー状態を格納しない。
- **プロバイダー選択** — プロバイダーは設定で選択する。モデルは実行時に登録済みバックエンドを切り替えられない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
