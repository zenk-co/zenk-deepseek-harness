# 適用範囲付き登録

日本語 | [English](scope.en.md) | [中文](scope.zh.md)

[scope パッケージ](../../packages/core/scope) は 1 つの登録文脈に、応答者ごとの可視性と共有寿命所有の両意味を持たせる同一性、運搬子、適用範囲層語彙を供給する。Cordis サービスではなく蔵書素材であり、[agent-scope 実行時設計参照](../../packages/core/agent-loop/README.md)が寿命根拠を所有し、包 [README](../../packages/core/scope/README.md) が呼出可能 API と濾過意味論を所有する。

源: [`packages/core/scope/src/index.ts`](../../packages/core/scope/src/index.ts) と [`packages/core/scope/src/store.ts`](../../packages/core/scope/src/store.ts)。

## 同一性と送出運搬子

`ScopeKey` は不透明な対象同一性である。出荷循環は生きている `Agent` 対象を自身鍵として使うが、素材は対象を決して検査しない。

```ts type-equiv
/** An opaque, identity-compared scope key. */
type ScopeKey = object
```

`Scoped<T>` は `scopeTarget(base, key)` が返す不透明経路受手上の製作時銘である。適用範囲濾過イベント宣言はこの運搬子を `this` 型として要求し、真のイベント主題は明示引数のままである。

```ts type-equiv
/**
 * A routing-only event receiver built by {@link scopeTarget}. The type
 * parameter records the subject type for dispatch checking; the carrier does
 * not expose the subject's properties. Event payloads carry the real subject.
 */
type Scoped<T extends object> = object & { readonly [ScopedBrand]: T }
```

## 所有登録文脈

`Scope` は印付き登録文脈を 2 つの解体経路と対にする。`rawDispose` は順序複合エフェクトに要る厳密 Cordis 破棄子同一性を保ち、`dispose()` は直接と競合呼出者向け公開共有静寂境界である。

```ts type-equiv
/** A minted registration scope and its quiescent disposal boundaries. */
interface Scope {
  /** Context through which scope-owned registrations are made. */
  ctx: Context
  /** Exact Cordis disposer, used when nesting this scope in an ordered composite effect. */
  rawDispose: () => Promise<void> | void
  /** Dispose every scope-owned registration; racing calls await the same completion. */
  dispose(): Promise<void>
}
```

## 適用範囲付き登録層

`ScopeLayer` は全域または厳密適用範囲水準での 1 登録の完全寄与を表す。具体層は複数名付き表と無名表を集約しうる。全層空により `ScopedLayers` は兄弟表を捨てずに適用範囲状態を回収できる。

```ts type-equiv
/** One scope's aggregate contribution to a registry. */
interface ScopeLayer {
  /** Whether every table in this layer is empty. */
  isEmpty(): boolean
}
```

`ScopedLayers<L>` は熱心全域層と遅延作成厳密適用範囲層を所有する。読みは層を作らない。`peek(undefined)` は上掛けなしを意味し、`merge()` は挿入順全域名項目の後に適用範囲影を実体化する。登録は可視性と Cordis エフェクト所有の両方に 1 文脈を使い、任意通知の前に同期取消 1 つを集め、Cordis 厳密破棄子を返し、完全 `ScopeLayer` が空の場合にのみ適用範囲層を回収する。

`NamedEntries<V>` は挿入順参照と呼出者所有重複誤りを伴う生き反復を供給する。`AnonymousEntries<V>` は各追加に唯一同一性を与え、等値が独立に残る。反復は 1 つの非空表世代内では生き続け、表排出は既存反復子を後続挿入から切り離す。両者は冪等厳密項目取消を返す。共有 `EntryValues` 実装界面は公開されない。
