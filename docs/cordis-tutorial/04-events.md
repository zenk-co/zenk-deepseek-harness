# 4. イベント

日本語 | [English](04-events.en.md) | [中文](04-events.zh.md)

サービスは直接呼び出しを支える。**イベント**を使うと、プラグインはどのプラグインが聞いているかを知らずに何かを告知できる。ハーネスはツール結果、モデル要求、承認決定などの相互作用にイベントを使う。

## 宣言、発行、受信

`tmp/cordis-tutorial` に `stats.ts` を作成する。物事を数えて各変更を告知するサービスである。

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    stats: StatsService
  }
  interface Events {
    'stats/report'(name: string, count: number): void
  }
}

export class StatsService extends Service {
  private counts = new Map<string, number>()

  constructor(ctx: Context) {
    super(ctx, 'stats')
  }

  bump(name: string) {
    const next = (this.counts.get(name) ?? 0) + 1
    this.counts.set(name, next)
    this.ctx.emit('stats/report', name, next)
  }
}

export const name = 'stats'

export function apply(ctx: Context) {
  ctx.plugin(StatsService)
}
```

`interface Events` マージは第 3 章の `interface Context` マージのイベントシステム版である。イベント名とリスナーシグネチャを宣言するため、`ctx.emit` と `ctx.on` は完全に型付けされる。`namespace/action` 命名規則によりフラットなイベント名前空間は読みやすく保たれる。

`reporter.ts` を作成する。

```ts ignore-check
import type { Context } from '@deepseek-ai/cordis'
import type {} from './stats.ts'

export const name = 'reporter'
export const inject = ['stats']

export function apply(ctx: Context) {
  ctx.on('stats/report', (name, count) => {
    console.log(`[stats] ${name} -> ${count}`)
  })
  ctx.stats.bump('tool_call')
  ctx.stats.bump('tool_call')
  ctx.stats.bump('prompt')
}
```

`import type {} from './stats.ts'` 行は実行時には何もインポートしない。TypeScript が宣言マージを見るために存在する。構成して実行する。

```yaml
- name: './stats.ts'
- name: './reporter.ts'
```

```
[stats] tool_call -> 1
[stats] tool_call -> 2
[stats] prompt -> 1
```

`ctx.on()` はエフェクトであるため、リスナーはプラグインと共に消える。手動の `removeListener` 記帳は一切不要である。

## 配送モード

`emit` は 5 つの配送モードの 1 つである。イベントがどれを使うかは契約の一部であり、リスナーが値を返せるか、並行実行できるか、互いに短絡できるかを決める。

| モード | 呼び出し | 意味 |
|---|---|---|
| emit | `ctx.emit(name, ...args)` | 同期ブロードキャスト。返された Promise と値は待機も収集もされない。 |
| parallel | `await ctx.parallel(name, ...args)` | すべてのリスナーが並行実行される。一緒に待機される。 |
| serial | `await ctx.serial(name, ...args)` | リスナーは順番に実行され、待機される。最初の非 `null`・`false`・`undefined` 戻り値が勝ち、残りを停止する。 |
| bail | `ctx.bail(name, ...args)` | serial の同期版。 |
| waterfall | `ctx.waterfall(name, ...args, next)` | Around ミドルウェア。以下参照。 |

すべてのハーネスイベントは、所有する[サブシステムページ](../subsystems/core.md)上の生成リファレンスにモードを文書化する。

## ウォーターフォール: 変換または短絡

ウォーターフォールはインターセプトを動かすモードである。各リスナーは引数に加えて `next()` 継続を受け取る。`next()` の戻り値を変換することも、`next()` を呼ばずに復帰してチェーンの残りを短絡することもできる。Cordis ドキュメントが veto と呼ぶものである。`waterfall-demo.ts` を作成する。

```ts
import type { Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Events {
    'demo/transform'(input: string, next: () => Promise<string>): Promise<string>
  }
}

export const name = 'waterfall-demo'

export function apply(ctx: Context) {
  // Listener 1: wrap the downstream result.
  ctx.on('demo/transform', async (input, next) => {
    const downstream = await next()
    return downstream.toUpperCase()
  })

  // Listener 2: short-circuit when it owns the decision.
  ctx.on('demo/transform', async (input, next) => {
    if (input.includes('blocked')) return '** blocked **'
    return next()
  })

  void (async () => {
    console.log(await ctx.waterfall('demo/transform', 'hello', async () => 'hello'))
    console.log(await ctx.waterfall('demo/transform', 'blocked words', async () => 'blocked words'))
  })()
}
```

`cordis.yml` をこのファイルだけに向けて実行する。

```
HELLO
** BLOCKED **
```

2 行目をたどる。リスナー 1 が先に実行され、`next()` を呼び、それがリスナー 2 を起動する。リスナー 2 は `blocked` を見て `next()` を呼ばずに復帰する。最も内側の既定値（`ctx.waterfall` に渡した関数）は決して実行されない。そしてリスナー 1 は復路で置換メッセージを大文字化する。

従うべき規律はこうである。**観察や注釈だけを行う waterfall リスナーは `next()` を呼ばなければならない**。それなしに復帰することは意図的な短絡である。ログ記録リスナーで `next()` を忘れると、下流全員の既定動作を黙って飲み込んでしまう。これはこのリポジトリの常設規則である（[waterfall セマンティクス](../cordis-primer.md#cordis-waterfall-semantics)）。

ハーネスは協調するプラグインがラップまたは回答し得る決定にウォーターフォールを使う。[`agent/request`](../subsystems/core.md#agentrequest--waterfall) はプラグインによるモデル呼び出し設定の置換を可能にし、[`approval/request`](../subsystems/approval.md#approvalrequest--waterfall) はユーザー代わりのポリシー回答を可能にする。

次へ: [設定](05-config.md) — `cordis.yml` からのプラグインオプション。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
