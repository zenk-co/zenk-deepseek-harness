---
description: "Computer-use provider registration for deployments that enable one desktop driver at a time."
kind: "package-reference"
---

# @deepseek-ai/dsh-computer-use

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

デプロイでは一度に 1 つの computer-use プロバイダーを有効にできる。別のプロバイダーを読み込むと、登録済みプロバイダー名で失敗する。各プロバイダーは独自のツールとデスクトップ操作を提供する。このパッケージはモデル可視のツールを追加せず、並行セッション間の調整も行わない。

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
- name: '@deepseek-ai/dsh-computer-use'
```

このサービスに設定はない。プロバイダープラグインは `computerUse` をインジェクトし、`ctx.computerUse.register(ComputerUseProviderName(name))` を呼び出す。このブランドは `@deepseek-ai/dsh-computer-use/brand` からエクスポートされる。返されるエフェクト破棄子がその登録を解放する。

プロバイダーはツール呼び出しの受け付けを停止し、リソースを閉じ、登録を解放する前に所有する作業を待機する。`ctx.computerUse.providerName` は解放まで登録名を報告する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

1 つのプライベート名がスロットを所有する。プラグインのアンロード時に Cordis エフェクトが提供物を除去し、繰り返された破棄子が後の登録を除去することはない。[ソース](src/index.ts)にはドライバーオブジェクト、操作インターフェース、プロバイダーセレクターは含まれない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [Computer use](../../../docs/subsystems/computer-use.md) — プロバイダー選択と共有デスクトップの制限。
- [Cua Driver MCP プロバイダー](../../experimental/computer-use-cua-driver-mcp/README.md) — インストール済みドライバーを使用する。
- [Cua Driver ネイティブプロバイダー](../../experimental/computer-use-cua-driver-native/README.md) — npm ランタイムを使用する。

-----

<a id="model-experience"></a>
## モデル体験

なし。このレジストリーはプロバイダー名を記録するだけである。

#### KV キャッシュへの影響

登録によってモデルリクエストは変わらない。プロバイダー所有のツールとガイダンスが、それぞれのリクエストプレフィックスへの影響を決定する。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

このサービスは Cordis サービスインスタンス内での登録を制限する。

- **共有デスクトップ** — 並行セッションや別の DSH プロセスが同じデスクトップを操作できる。呼び出し元は computer-use ワークフロー全体を調整する。
- **プロバイダー選択** — プロバイダーは設定で選択する。モデルは実行時に登録済みドライバーを切り替えられない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
