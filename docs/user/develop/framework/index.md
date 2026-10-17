# プラグインとライフサイクル

日本語 | [English](index.en.md) | [中文](index.zh.md)

この頁は Cordis プラグイン模型とライフサイクル状態機械を述べる。

## ファイバー状態機械

読み込まれた各プラグインは次の状態を持つ **Fiber** 適用範囲を所有する。

```
PENDING → LOADING → ACTIVE
                 ↘ FAILED
ACTIVE → UNLOADING → DISPOSED
```

| 状態 | 意味 |
|------|------|
| PENDING | 宣言済みだが必須依存が未整 |
| LOADING | 依存が整い `apply` が実行中 |
| ACTIVE | プラグインが動作中 |
| FAILED | `apply` が誤りを送出した |
| UNLOADING | プラグインが解体中で資源を破棄中 |
| DISPOSED | プラグインが完全に解体済み |

## 依存駆動読み込み

`inject` 付きプラグインは読み込み前に必須サービスすべてを待つ。

```ts ignore-check
export const inject = ['tools', 'llm']

export function apply(ctx: Context) {
  // ctx.tools and ctx.llm are ready here.
}
```

必須サービスが消える場合、例えば提供子置換中は、プラグインは自動的に解体し (ACTIVE → DISPOSED)、サービス復帰時に再び読み込む。

## 自動片付け

`ctx` 経由の各登録はプラグイン解体時に解かれる。

```ts ignore-check
export function apply(ctx: Context) {
  // Event listener: removed automatically on unload.
  ctx.on('some-event', handler)

  // Custom resource: the returned disposer runs on unload.
  ctx.effect(() => {
    const connection = createConnection()
    return () => connection.close()
  })
}
```

枠組みはこれらの操作すべてを追跡して破棄する。
- `ctx.on(event, handler)` — イベント待ち受け
- `ctx.tools.register(tool)` — ツール登録
- `ctx.llm.registerAdapter(names, adapter)` — LLM アダプター登録
- `ctx.effect(() => cleanup)` — 任意資源

解体中、破棄子呼び出しは登録の逆順に始まるが、複数の非同期破棄子は並行に走り連続完了保証はない。順序依存の片付けは単一 `ctx.effect()` から返す 1 つの破棄子に入れ、そこで段階を連続待機する。

## 入れ子文脈

`ctx.plugin()` は親文脈を継承するが独立寿命を持つ子 Fiber を作る。

```ts ignore-check
export function apply(ctx: Context) {
  // Register a child plugin.
  ctx.plugin(childPlugin)

  // The child has its own Fiber and unloads with its parent.
}
```

## 破棄意味論

プラグイン実体を早く止めるには。

```ts
import type { Context } from '@deepseek-ai/cordis'

declare const ctx: Context
declare function myPlugin(ctx: Context): void

const fiber = ctx.plugin(myPlugin)

// Dispose it manually later.
await fiber.dispose()
```

`dispose` は次を保証する。
1. プラグイン所有の全登録が外される。
2. 子プラグインは再帰的に解体される。
3. 返す約束は全非同期片付け完了後に解決する。

## 熱置換 (HMR)

`cordis.yml` から `@deepseek-ai/dsh-hmr` を読み込むと、プラグイン源文件の編集が次を発動する。

1. 旧プラグインを解体し、その登録を片付ける。
2. 新符号を読み込む。
3. 新 `apply` を走らせる。

プラグイン登録は自ら片付くため、熱置換は旧実体の登録を残さない。

## 寿命例

```ts ignore-check
export function apply(ctx: Context) {
  console.log('plugin loading')

  ctx.effect(() => {
    console.log('effect registered')
    return () => console.log('effect cleaned up')
  })
}
```

読み込み表示。
```
plugin loading
effect registered
```

解体表示。
```
effect cleaned up
```

## 次の手順

- [サービスと依存](./service.md) — 他プラグインへケイパビリティを表す
- [イベント機構](./events.md) — プラグイン間で連絡する
- [Cordis 手引き](../../../cordis-tutorial/index.md) — Cordis 実行時に対する同寿命、サービス、イベントを段階的に組み立てる
