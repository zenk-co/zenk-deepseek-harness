# 3. サービス

日本語 | [English](03-services.en.md) | [中文](03-services.zh.md)

**サービス**は 1 プラグインが提供し、他プラグインが `ctx` 越しに消費する名前付きケイパビリティである。ハーネスでは `ctx.tools`・`ctx.llm`・`ctx.agents` がサービスである。利用者はプロバイダーをインポートせず、`'tools'` のようなケイパビリティを指名するため、設定は利用者を変えずにプロバイダーを選べる。

## サービスを提供する

`tmp/cordis-tutorial` に `greeter.ts` を作る:

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    greeter: GreeterService
  }
}

export class GreeterService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'greeter')
  }

  greet(who: string) {
    return `Hello, ${who}!`
  }
}

export const name = 'greeter'

export function apply(ctx: Context) {
  ctx.plugin(GreeterService)
}
```

2 断片が協働する:

- **実行時**: `super(ctx, 'greeter')` は `greeter` 名でインスタンスを登録する。以降どのプラグインも `ctx.greeter` としてそれに届く。登録はエフェクトであり、プロバイダーのアンロードでサービスは消える。
- **コンパイル時**: `declare module '@deepseek-ai/cordis'` 塊は TypeScript 宣言統合である。`Context` インターフェースに `greeter` を加え、どこでも `ctx.greeter` が型検査を通るようにする。コードを生成せず、これがなくてもサービスは実行時に動作するが、利用者は型安全を失う。

`Service` サブクラスはそれ自体がプラグインであり（第 1 章のクラス形態）、`ctx.plugin(GreeterService)` は他のものと同様にそれをマウントする。

## `inject` でサービスを消費する

`consumer.ts` を作る:

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'consumer'
export const inject = ['greeter']

export function apply(ctx: Context) {
  console.log(ctx.greeter.greet('world'))
}
```

`inject` はこのプラグインが必要とするサービスを列挙する。Cordis は列挙サービスがすべて存在するまでプラグインを PENDING に保つため、`apply` 内では `ctx.greeter` の準備が保証される。`cordis.yml` 内の読み込み順は関係ない。ファイル順ではなく依存関係がプラグイン開始時期を決める。

組み立てと実行:

```yaml
- name: './greeter.ts'
- name: './consumer.ts'
```

```
Hello, world!
```

`cordis.yml` 内の 2 行を入れ替えて再実行する。同じ出力である。`./greeter.ts` を丸ごと除いてみる。利用者は PENDING のまま何も出力しない。衝突も部分実行もない。PENDING ファイバーは Node イベントループも生かさないため、他に動作するものがないコンポジションは黙って 0 終了する。その状態の診断は[第 6 章](06-composition-and-hmr.md)に示す。

## 依存関係は読み込み後も追跡される

`inject` は一度きりの起動検査ではない。実行中に必須サービスが消えると（プロバイダーがアンロードまたはホット置換されると）、依存するすべてのプラグインもアンロードされ、サービスが戻ると再読み込みされる。エフェクト（[第 2 章](02-lifecycle-and-effects.md)）と組み合わせることで、実行中の利用者が利用不能サービスへの参照を保持し続けるのを防ぐ。自身の登録は依存消失時に巻き戻される。

だから設定でのサービス置換も動作する。`dsh-bash-local` エントリーをアンロードし、別の `shell` プロバイダーをマウントすると、`'shell'` を注入するすべてのプラグインは新実装に対してきれいに再起動する。

## 任意依存関係

`inject` は強い要件向けである。なくても生きられるケイパビリティには `inject` を跳ばし、利用箇所で探る:

```ts ignore-check
export function apply(ctx: Context) {
  // undefined when no provider is loaded; the plugin still runs.
  const greeter = ctx.get('greeter')
  console.log(greeter?.greet('maybe') ?? 'no greeter available')
}
```

## 名前付け

サービス名はアプリケーションごとに 1 つの平坦な名前空間に生きる。自身のサービスには目立つ接頭辞や名前空間を付けよ（ハーネスは `tools` や `llm` のような素名を主張する）。ハーネスが登録するすべての名前は[サブシステムページ](../subsystems/core.md)上の生成 `cordis-surface` 領域に一覧がある。

次: [イベント](04-events.md) — 共有サービスなしの通信。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
