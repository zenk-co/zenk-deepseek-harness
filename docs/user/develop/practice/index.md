# 3 役割ケイパビリティ設計

日本語 | [English](index.en.md) | [中文](index.zh.md)

このページは 2 部構成である。3 役割ケイパビリティパターンの概念リファレンスと、1 つのケイパビリティを構築する上級チュートリアルである。先に[基本プラグインパス](../basic/index.md)と[サービスチュートリアル](../framework/service.md)を完了すること。

## 概念リファレンス

ケイパビリティが Bash 実行のように置換可能なプロバイダーを必要とするほど汎用的である場合、Harness は 3 つの役割、すなわち**サービス定義**、**サービスプロバイダー**、**コンシューマー**に分離する。役割が独立に進化または置換される必要がある場合に別パッケージに置く。そうでない場合、パッケージは複数の役割を所有してよい。完全なケイパビリティがそのシームである。個々の役割はシームではない。

## Bash の例

Bash 実行ケイパビリティは以下から構成される。

- **サービス定義**（`dsh-shell`） — Cordis サービスと Bash 要求・結果型を定義する
- **サービスプロバイダー**（`dsh-bash-local`） — ローカルマシンでコマンドを実行する
- **コンシューマー**（`dsh-tool-bash`） — ケイパビリティをモデル呼び出し可能なツールとして公開する

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  dsh-shell   │────▶│  dsh-bash-local  │     │ dsh-tool-bash│
│(definition) │     │    (provider)     │     │(consumer/tool)│
└─────────────┘     └──────────────────┘     └──────────────┘
       ▲                                            │
       └────────────────────────────────────────────┘
                    inject: ['shell']
```

## 分割の利点

### プロバイダーを置換する

1 つのサービス定義は `cordis.yml` を通じて選択される複数のプロバイダーを持てる。

```yaml
# Local execution
- name: '@deepseek-ai/dsh-bash-local'

# Replace this row with another package that provides the same service.
```

プロバイダーが変わってもサービス定義とツールは変わらないままである。

### 独立に進化する

- サービス定義は呼び出し元が契約に依存した後はめったに変わらない。
- サービスプロバイダーは性能と安全性を独立に改善できる。
- コンシューマーはケイパビリティのモデルへの見せ方を変えられる。

### 依存を分離する

- サービスプロバイダーはサービス定義に依存する。
- コンシューマーはサービス定義に依存する。
- サービスプロバイダーとコンシューマーは**互いに依存しない**。

[ケイパビリティシームリファレンス](../../../capability-seams.md)は現在の組み込みファミリーとパッケージリンクを所有する。

## チュートリアル: 3 役割ケイパビリティを開発する

### ステップ 1: サービス定義を書く

```ts ignore-check
// packages/my-cap/my-cap/src/index.ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    myCap: MyCapService
  }
}

export abstract class MyCapService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'myCap')
  }

  /** Execute the capability. */
  abstract execute(request: MyCapRequest): Promise<MyCapResult>
}

export interface MyCapRequest {
  input: string
}

export interface MyCapResult {
  output: string
}
```

### ステップ 2: サービスプロバイダーを書く

```ts ignore-check
// packages/my-cap/my-cap-local/src/index.ts
import type { Context } from '@deepseek-ai/cordis'
import { MyCapService, type MyCapRequest, type MyCapResult } from '@deepseek-ai/dsh-my-cap'

class MyCapLocal extends MyCapService {
  async execute(request: MyCapRequest): Promise<MyCapResult> {
    // Local provider behavior.
    return { output: request.input.toUpperCase() }
  }
}

export const name = 'my-cap-local'

export function apply(ctx: Context) {
  ctx.plugin(MyCapLocal)
}
```

### ステップ 3: コンシューマーを書く

```ts ignore-check
// packages/my-cap/tool-my-cap/src/index.ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'tool-my-cap'
export const inject = ['tools', 'myCap']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'my_cap',
    description: 'Execute my capability.',
    parameters: {
      input: { type: 'string', required: true },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      const result = await ctx.myCap.execute({ input: args.input })
      return result.output
    },
  }))
}
```

### cordis.yml でそれらを構成する

```yaml
- name: '@deepseek-ai/dsh-my-cap-local'
- name: '@deepseek-ai/dsh-tool-my-cap'
```

## 設計要点

- **先回りして分割しない** — 役割が独立に進化する必要がある場合にのみ別パッケージを使う。単純なツールプラグインはそうではない。
- **サービス定義が要求・結果型を所有する** — サービスプロバイダーとコンシューマーはサービス定義パッケージにのみ依存する。
- **明示は暗黙に勝る** — `run()` 内部に `?? default` 式を隠すのではなく、明示的な `resolve(request): Spec` 手順で既定値を解決する。

## 次の手順

- [LLM アダプター](./llm-adapter.md) — LLM プロバイダーを実装する
