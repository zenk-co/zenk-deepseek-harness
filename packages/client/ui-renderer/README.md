---
description: "Browser UI renderer: React bindings for ordinary Slots and reusable Component Factories, ctx.uiRenderer, and the assembled dsh web application root."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-renderer

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-client-ui-renderer` は組み立て済み dsh Web クライアント GUI をマウントします。完全なクライアントプラグイン名簿が確定した後、ブートカーネルが `ctx.uiRenderer.mount(container)` を呼び出し、フレームワークフリーのブートページをハイドレートして次のペイント前に完全 React アプリケーションに切り替えます。業務プラグインは型付き props でセッションとワークスペースデータを受け取るプレーン React コンポーネントのままです。自前で購読を配線することはありません。レンダラーはランタイムの素の observable ソースをスロット出口のセレクターフックにバインドします。Web シェルとブートカーネルが唯一の直接コンシューマーであるため、構成が React レンダリング GUI を求める場合ちょうどそのときに必要です。

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

このパッケージはインフラです。Web シェルとブートカーネルが唯一の直接コンシューマーです。React レンダリング GUI を求める場合に構成は必要です。`dsh-client-web` は名簿を読み込み、すべてのエントリー有効化を待ってから `ctx.uiRenderer.mount(container)` を呼びます。

### マウントが行うこと

`mount(container)` はスロットレンダラーを導入し、存在すれば既存ブート DOM をハイドレートし、次のペイント前に組み立て済みアプリケーションをコンテナーにレンダリングし、React ルートをアンマウントする disposer を返します。レンダラーは唯一のコンテキストレベル `renderSlot('root')` 呼び出しを行います。登録済みルート占有者が製品レイアウトとドキュメントメタデータを所有します。

### 業務プラグイン向け

業務プラグインは通常 Slot エントリーまたは再利用可能 Component Factory を登録します。レンダラーはランタイムのセッションおよびワークスペース observable ソースをレンダー位置のセレクターフックにバインドします。プラグインは導出 Component props 経由で標準スコープ props を受け取ります。レンダラーをインポートも React 内部に触れることもありません。レンダラー作成のすべての Component は Factory 出現をレンダリングでき、Factory はパッケージ間で実装値を共有せずに呼び出し側選択ローカル Component を公開できます。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

このパッケージは 1 つの境界を実現します。オブジェクト層 (ランタイム、React フリー) が業務状態を所有します。このレンダラーは ctx-to-React 統合が行われる唯一の場所です。スロットレンダラー、`SessionProvider`、`useSyncExternalStore` アダプターです。

### 有効化とマウント

プラグインは `slots`、`sessions`、`layout` の後に有効化します。`createSlotRenderer()` を導入し、`uiRenderer` サービスを反映します。`mountApp` はブートカーネルの `[data-dsh-boot]` 要素を探します。存在すれば `BootHandoff` 経由でハイドレートし (読込中 DOM を保持する 1 フレームパススルー)、なければ新規ルートを作成してレンダーを同期フラッシュします。

### スロットバインディング

`createSlotRenderer` はスロットレジストリーを React に接続します。通常エントリーリストと Factory 定義がリアクティブソースになり、各出口または出現は導入済みレンダラー経由でレンダリングします。業務プラグインは素の observable ソースを型付き `hooks` 経由で渡します。レンダラーは uSES アダプター経由でレンダー位置にバインドします。Factory Store ファクトリーは出現が最初に実体化するまで遅延のままです。その排他ハンドルは永続化を拒否し、レンダー時記録は弱参照に留まり、べき等 effect はマウント済み出現のみ強保持し、effect 再送でも同一性を保持します。Factory エラーは共有定義を放棄せず通常監督チャネルを使います。定義とそのフォールバックローカル Component は定義に対して報告し、呼び出し側選択ローカル Component は呼び出し側登録に対して報告し、各境界は独自スコープ化身でリセットします。

### 同一性

React、React DOM、Cordis、ui-slots、ui-primitives は Web シェルの静的モジュールテーブル経由で 1 つのブラウザー同一性を保持します。このパッケージは動的クライアントバンドルとして到達します。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

周辺機構と構成モデルを扱うページです。

- [ui-slots](../ui-slots/README.md) — このレンダラーが React にバインドするスロットレジストリー純粋コア。
- [web](../web/README.md) — 名簿を読み込み `mount` を呼ぶシェル。
- [ui-session](../ui-session/README.md) — 標準セッションソースとフックを提供し、このレンダラーがバインドするアダプター。
- [Web client architecture](../../../docs/subsystems/web-client.md) — 読込チェーン、オブジェクト層、層化レッドライン。
- [Slot system standard](../../../.agents/notes/implemented/architecture/2026-07-22-slot-type-chain-implementation.md) — definitive composition model.
- [Component Factories](../../../.agents/notes/implemented/architecture/2026-09-10-component-factories-and-local-slots.md) — reusable definitions, local Component selection, and occurrence lifetimes.

-----

<a id="model-experience"></a>
## モデル体験

None, as the package is a browser-side render assembly that registers nothing model-facing.

#### KV キャッシュ効果

なし。このパッケージはプロバイダーリクエストを組み立てず送信もしません。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、アプリケーションフレームが現れる条件と領域ごと準備が進む範囲を定めます。これらは現行パッケージの制約です。

- **The first application frame waits for every client entry** — ブートカーネルはローダー名簿確定後にのみマウントポイントを引き渡します。領域ごと準備は deferred のままです。
- **Slot rendering has no Suspense integration or per-entry lazy loading** — レンダラーは完全プラグイン名簿確定後にルートをマウントします。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
