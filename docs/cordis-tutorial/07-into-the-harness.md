# 7. ハーネスの世界へ

日本語 | [English](07-into-the-harness.en.md) | [中文](07-into-the-harness.zh.md)

この章ではモデル呼び出し可能なツールをハーネスの `tools` サービスに登録し、ハーネスのツールパイプラインで実行し、結果イベントを観測する。キーレスのままであり、モデルは呼ばない。

## ツールプラグイン

`tmp/cordis-tutorial` に `greet-tool.ts` を作る:

```ts
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'

export const name = 'greet-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet the named person.',
    parameters: {
      name: { type: 'string', required: true, description: 'Who to greet' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      return `Hello, ${args.name}!`
    },
  }))

  // Drive one call through the real execution pipeline, standing in for
  // the model. ToolCallId brands the correlation id a provider would issue.
  void (async () => {
    const result = await ctx.tools.execute({
      callId: brandString<ToolCallId>('demo-1'),
      name: 'greet',
      arguments: { name: 'Cordis' },
      signal: new AbortController().signal,
    })
    console.log('tool replied:', JSON.stringify(result.content))
  })()
}
```

ここのすべてのパターンは前の章由来である。`inject: ['tools']`（[第 3 章](03-services.md)）はツールレジストリが存在するまでプラグインを保持し、`ctx.tools.register(...)` は登録破棄子をプラグインに結び付ける（[第 2 章](02-lifecycle-and-effects.md)）ため、アンロードでツールの登録が外れる。`defineTool` は `parameters` 仕様をモデルに示す JSON Schema に変換し、`args` の型を推論し、`execute` 実行前にモデル供給の引数を検証する。ツールは `output.schema` が宣言する正規値を返し、`output.render` が別に Native と耐久の結果内容を作る。

## 観測プラグイン

`tool-logger.ts` を作る。アプリ内のすべてのツール呼び出しをハーネスの `tools/result` イベント越しに見る別のプラグインである:

```ts
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'

export const name = 'tool-logger'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.on('tools/result', (exec, result) => {
    const text = result.content
      .map(block => (block.type === 'text' ? block.text : ''))
      .join('')
    console.log(`[tool-logger] ${exec.name} -> ${text}`)
  })
}
```

`import type {} from '@deepseek-ai/dsh-tools'` の行はパッケージの宣言統合を引き込み、`'tools/result'` とそのペイロードに型を付ける。第 4 章の `stats.ts` インポートと同じ手つきをパッケージ規模で行うものである。

## 組み立てと実行

```yaml
- name: '@deepseek-ai/dsh-system-prompt'
- name: '@deepseek-ai/dsh-tools'
- name: './tool-logger.ts'
- name: './greet-tool.ts'
```

`@deepseek-ai/dsh-tools` はツールがシステムプロンプトにスキーマを寄与するため `systemPrompt` サービスを `inject` する。だからコンポジションはそのプロバイダーも列挙する。それがなければツールプラグインは[第 6 章](06-composition-and-hmr.md)のとおり PENDING のままである。

```sh
node --import tsx ../../vendor/cordis/bin.js
```

```
[tool-logger] greet -> Hello, Cordis!
tool replied: [{"type":"text","text":"Hello, Cordis!"}]
```

ロガーが先に発火した。`tools/result` は結果実体化の一部として、`execute` のプロミスが呼び出し側に解決する前に送出される。あなたの 2 つのプラグインは互いの存在を知らない。レジストリサービスとイベントがそれらを結ぶ。

## ここから完全なエージェントへ

実際のエージェントはこのコンポジションにプラグインを足したものである。LLM アダプター、エージェントループ、永続化、アプリケーション入口が加わる。[base プロファイル層](../../packages/bundle/base/cordis.patch.yml)と [headless 層](../../packages/bundle/headless/cordis.patch.yml) を比べること。今ならそのエントリーを読める。あなたの `greet-tool.ts` は小さな `--patch` オーバーレイで追加できる。

次に進む先:

- [ツールを組み立てる](../user/develop/basic/tool.md) — プレゼンテーションや豊かなスキーマを含む `defineTool` の続き。
- [3 層ケイパビリティ設計](../user/develop/practice/index.md) — ハーネスが置換可能なケイパビリティをどう構造化するか。
- [サブシステムページ](../subsystems/core.md)上の生成 `cordis-surface` 領域 — 注入・購読できるすべてのものが所有ページごとにある。
- [アーキテクチャ](../architecture.md) — これらのプラグインが生きる全体像。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
