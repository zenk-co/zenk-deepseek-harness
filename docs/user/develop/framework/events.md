# イベント機構

日本語 | [English](events.en.md) | [中文](events.zh.md)

イベントは Cordis プラグイン間の中心的な通信機構である。Harness は疎結合な拡張点としてそれらを広く使う。

## 基本的な使い方

### イベントを待ち受ける

```ts ignore-check
ctx.on('event-name', (payload) => {
  // Handle the event.
})
```

### イベントを発する

```ts ignore-check
ctx.emit('event-name', payload)
```

## イベント様式

Cordis は異なる相互作用契約向けに複数のイベント様式を提供する。

### emit — 放送

全リスナーが同期に走り、戻り値は無視される。

```ts ignore-check
// Emit
ctx.emit('my-plugin/ready', { id: 'worker-1' })

// Listen
ctx.on('my-plugin/ready', ({ id }) => {
  console.log(`${id} is ready`)
})
```

### bail — 短絡

リスナーは順に走り、`null`、`false`、`undefined` 以外の最初の結果が最終結果になる。

```ts ignore-check
// Dispatch
const result = ctx.bail('some-check', input)

// Listen: a returned value stops later listeners.
ctx.on('some-check', (input) => {
  if (shouldBlock(input)) return 'blocked'
  // Return null, false, or undefined to continue to the next listener.
})
```

### serial — 順序実行

リスナーは登録順に走り、非同期結果は待機される。`null`、`false`、`undefined` 以外の最初の結果が後続の実行を止める。

```ts ignore-check
await ctx.serial('setup-phase', context)
```

### waterfall — 管路

各リスナーは下流結果を包んで処理連鎖を形作れる。リスナーは下流へ委ねるために **`next()` を呼ばなければならない**。呼び出しの省略は管路を短絡する。

```ts ignore-check
// Dispatch
const output = await ctx.waterfall('my-plugin/transform', input, async () => input)

// Listen: next() is mandatory.
ctx.on('my-plugin/transform', async (_input, next) => {
  const downstream = await next()
  return downstream.trim()
})
```

::: warning
waterfall リスナーは **`next()` を呼ばなければならない**。省略は設計どおり管路を短絡し、横取りと門番動作を可能にする。
:::

## 型付きイベント

Harness は型安全なイベントのために TypeScript 宣言マージを使う。

```ts
import '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Events {
    'my-plugin/ready': (payload: { id: string }) => void
    'my-plugin/check': (input: string) => boolean | undefined
    'my-plugin/transform': (input: string, next: () => Promise<string>) => Promise<string>
  }
}

// ctx.on('my-plugin/ready', ...) and ctx.emit('my-plugin/ready', ...)
// are now inferred correctly.
```

## Cordis イベントとセッション記録

Harness Cordis イベントは `agent/pre-step`、`agent/request`、`agent/request-error`、`tools/result`、`session/event` を含む `namespace/action` 名を使う。生成済み `cordis-surface` 領域が[サブシステムページ](../../../subsystems/core.md)に完全な署名と様式を記録する。

`turn/*`、`step/*`、`tool/call`、`tool/result`、`compaction/*` は同名 Cordis イベントではなく durable なセッションイベント型である。それらを観測するには `session/event` を待ち受けて `event.type` を調べる。

## イベントリスナーはエフェクトである

`ctx.on()` で登録したリスナーは所有プラグインのアンロード時に自動的に外される。

```ts ignore-check
export function apply(ctx: Context) {
  // This listener is removed when the plugin disposes.
  ctx.on('tools/result', handler)
}
```

## 例: 記録プラグイン

このプラグインはツール呼び出しと結果を記録する。

```ts
import type { Context } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-tools'

export const name = 'tool-logger'

export function apply(ctx: Context) {
  ctx.on('tools/result', (exec, result) => {
    console.log(`[tool] ${exec.name}(${JSON.stringify(exec.arguments)})`)
    const text = result.content
      .map(block => block.type === 'text' ? block.text : '')
      .join('')
    console.log(`[tool result] ${text.slice(0, 100)}`)
  })
}
```

## 次の手順

- [ケイパビリティ層化](../practice/index.md) — ケイパビリティ界面の中でイベントを理解する
- [LLM アダプター](../practice/llm-adapter.md) — 完全な LLM バックエンドを実装する
