# サービスと依存関係

日本語 | [English](service.en.md) | [中文](service.zh.md)

サービスは 1 プラグインが他プラグインに公開するケイパビリティです。`inject` はプラグインが必要とするサービスを宣言します。

## サービスとは何か

Harness では `tools`、`llm`、`agents` はサービスです。各々は `ctx` 上の名前付きケイパビリティです:

```ts ignore-check
ctx.tools    // ToolRuntime service
ctx.llm      // LLM service
ctx.agents   // Agent service
```

任意のプラグインは他プラグインが消費するサービスを提供できます。

## サービスの消費

既存サービスを使うには `inject` を宣言します:

```ts ignore-check
export const inject = ['tools']

export function apply(ctx: Context) {
  // ctx.tools exists and is ready here.
  ctx.tools.register(/* ... */)
}
```

`apply` 実行時、`inject` が宣言するすべてのサービスは準備完了です。サービスが未準備の場合、プラグインは実行せず待機します。

## サービスの提供

### Service の拡張

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

export default class MetricsService extends Service {
  static inject = ['llm']  // A service may depend on other services.

  constructor(ctx: Context) {
    super(ctx, 'metrics')  // 'metrics' is the service name.
  }

  // Public service method.
  record(event: string, value: number) {
    // ...
  }
}
```

このプラグイン読込み後、コンシューマーはサービスに `ctx.metrics` としてアクセスします:

```ts ignore-check
export const inject = ['metrics']

export function apply(ctx: Context) {
  ctx.metrics.record('tool_call', 1)
}
```

### 型の宣言

TypeScript 宣言マージで `ctx.metrics` の型を付けます:

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    metrics: MetricsService
  }
}

export default class MetricsService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'metrics')
  }

  record(event: string, value: number) { /* ... */ }
}
```

## 依存関係の動作

### 必須および任意の依存関係

```ts ignore-check
// Required: the plugin does not load while the service is absent.
export const inject = ['tools']

// Optional: omit inject and query with ctx.get() at the use site.
export function apply(ctx: Context) {
  const metrics = ctx.get('metrics')
  metrics?.record('plugin_loaded', 1)
}
```

### サービスが消えるとき

アプリケーション実行中に必要なサービスが消えた場合、たとえばそのプロバイダーがアンロードされた場合:

1. 依存プラグインは自動破棄されます。
2. サービス復帰時に再読込します。

これにより存在しなくなったサービスをプラグインが呼ぶことを防ぎます。

## サービス分離

`cordis.yml` はサービスを分離できるため、別プラグイン群は同じサービスの別インスタンスを見ます:

```yaml
- id: group-a
  name: '@deepseek-ai/cordis-plugin-group'
  group: true
  isolate:
    shell: true
  config:
    - name: '@deepseek-ai/dsh-bash-local'
      config:
        timeoutMs: 5000
    - name: './src/plugin-a.ts'

- id: group-b
  name: '@deepseek-ai/cordis-plugin-group'
  group: true
  isolate:
    shell: true
  config:
    - name: '@deepseek-ai/dsh-bash-local'
      config:
        timeoutMs: 60000
    - name: './src/plugin-b.ts'
```

`plugin-a` と `plugin-b` はそれぞれ自グループの Bash インスタンスを見、群またぎの効果はありません。

## 組込み Harness サービス

リポジトリーはサービス名、公開メソッド、ソース位置を各サービスの[サブシステムページ](../../../subsystems/core.md)に生成します。プラグイン開発中はそれら生成領域とサービスの TypeScript インターフェースを使います。2 つ目の静的一覧を維持しません。

## 次の手順

- [Event system](./events.md) — communicate between plugins without tight coupling
- [Capability layering](../practice/index.md) — use services as capability interfaces
