---
description: "The scoped-registration library for plugin authors and maintainers building registries or event surfaces that isolate contributions per agent or per group."
kind: "package-library"
---

# @deepseek-ai/dsh-scope

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-scope` によりプラグイン作者は各エージェントやグループに共有存続期間を持つ分離コントリビューション集合を与えられます。子スコープは祖先コントリビューションを継承し、最も近い定義が優先され、祖先スコープは子孫活動を観測できます。いずれの関係も逆向きには働きません。スコープ破棄はそれが所有するすべてを除去します。エージェントループやプリセットに依存せずエージェント毎・グループ毎の分離を働かせる場合、この依存フリーライブラリーを使います。

## 目次

- [このパッケージの利用](#use-this-package)
- [実装の理解](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの利用

プラグイン作者は `dsh-scope` を使って 1 エージェント (または 1 グループ) に独自の登録世界を与えます。コアグループのレジストリーはその上に構築されます。`agent.ctx` 経由で登録されたツールはそのエージェントにのみ可視です。同じプリミティブは任意のカスタムレジストリーやスコープフィルタードイベントに役立ちます。

### スコープの発行

`createScope(ctx, key)` は `ctx` のファイバー配下にスコープを作成します。その `ctx` はスコープタグを運び、それ経由で登録されたすべてはスコープ可視かつスコープ存続期間です。`dispose()` はスコープ経由のすべての登録を巻き戻します。`rawDispose` はティアダウンを順序付き複合 effect に組み込むための正確な Cordis disposer です。

```text
const scope = createScope(ctx, agent)
scope.ctx.on('agent/status', ({ agent, status }) => track(agent, status))
// later:
await scope.dispose()   // unwinds every registration made through scope.ctx
```

### スコープ付きイベントのルーティング

`scopeTarget(base, key)` はスコープフィルタードイベントが発送する不透明キャリアを構築します。タグなしリスナーはグローバルのままです。`key` でタグ付けされたリスナーはそのキーと子孫向けイベントを受け取ります。キャリアはルーティング状態のみ運び、実対象はイベント引数で運ばれます。

### スコープ付きレジストリー層の構築

レジストリー作者は `ScopedLayers`、`NamedEntries`、`AnonymousEntries` を使って 1 つの eager グローバル層と遅延作成の正確スコープ層を保持します。読取は層を作成せず、`merge()` はスコープチェーン沿いに挿入順の名前付きシャドウを実体化し、`effect()` は同じコンテキストから可視性と所有権を導出します。スコープ層は集約全体が空になった場合のみ回収されます。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

この節では上記動作の実現方法を説明します。観測可能な契約は [Use this package](#use-this-package) で扱っています。

### 設計概念

登録コンテキストが可視性と所有権の両方を決定します。スコープ付きコンテキスト経由の登録はそのスコープで可視であり、それと共に破棄されるため、あるスコープで可視なのに別スコープで破棄されるコントリビューションを防ぎます。プリミティブは信頼済み同プロセスプラグインをルーティングします。サンドボックスでも権限境界でもありません。スコープ付きコンテキストの配布は発行プラグインのサービス解決 API も配布します (解決は発行ファイバーの依存チェーンをたどります)。そのためスコープは、スコープ付き登録が必要とする依存を持つプラグインから発行します。

### ソースマップ

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | `createScope`, `scopeOf`, `scopeTarget`, `bindScopeParent`/`scopeParentOf`/`scopeChainOf`, carrier marks |
| [`src/store.ts`](src/store.ts) | `ScopedLayers`, `NamedEntries`, `AnonymousEntries`, `ScopeLayer` |

### 親チェーン

1 つの関係が両方向を動かします。登録ビューはチェーンを下向きに継承します (子スコープは祖先層を見ます)。一方イベント許容は上向きに広がります (祖先でタグ付けされたリスナーは子孫キー宛て発送イベントを受け取ります)。バインドは一度きりです。既に親を持つキーはスローし、返却バインディングのみ再リンクできます。すべてのリンクは循環を拒否します。`scopeChainOf` は `[key, parent, …]` を近い順で返します。

### イベントフィルタリング

`scopeTarget` はベースの既存 `Context.filter` とスコープ述語を合成します。タグなしリスナーは許容されます。タグ付きリスナーはそのタグが発送キーまたはその祖先の場合のみ許容されます。`key === undefined` はタグなしリスナーのみ許容します。`{ global: true }` リスナーはフィルタリングを回避します。`Scoped<T>` ブランドはキャリアをスコープフィルタードイベントの `this` 型として要求するため、素サブジェクトでの発送はコンパイルエラーです。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

パッケージレベルの契約は多くのコンシューマーに十分です。周辺ドメインと設計根拠が必要な場合に読みます。

- [Scoped registration subsystem](../../../docs/subsystems/scope.md) — the identity, carrier, and layer types.
- [Agent-scope runtime design reference](../agent-loop/README.md) — how the loop builds per-agent scopes.
- [Core group map](../README.md) — how the core packages compose.

-----

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

これらの制限は、プリミティブに特別な注意が必要になる条件を定めます。これらは現行パッケージの制約であり、タスクバックログではありません。

- **Only scope-aware APIs isolate state** — レジストリーは `scopeOf()` で整理し、イベントは `scopeTarget()` 経由で発送しなければなりません。任意 Cordis サービスはスコープ付きコンテキスト経由で呼ばれただけではコンテキストグローバルのままです。
- **A context carries one nearest scope key** — 階層はコンテキストタグではなくキーレベルの親関係に存在します。入れ子スコープコンテキストも単一タグにシャドウし、複数所属ポリシー集合は未対応です。
- **Service reachability comes from the scope minter** — `Scope.ctx` の配布は発行プラグインの注入サービスも配布するため、広い発行者を保持者が後から狭めることはできません。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
