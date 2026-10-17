# LLM アダプター

日本語 | [English](llm-adapter.en.md) | [中文](llm-adapter.zh.md)

このガイドでは、新しい LLM プロバイダーを Harness に接続します。

## 概要

LLM アダプターは `LlmAdapter` を拡張し、`stream()` を実装することで、Harness のプロバイダー中立なリクエストをプロバイダー API 呼び出しに変換し、応答を Harness チャンクに逆変換します。

## 最小実装

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'

class MyAdapter extends LlmAdapter {
  private apiKey: string

  constructor(apiKey: string) {
    super()
    this.apiKey = apiKey
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // 1. Convert options.messages to the provider format.
    // 2. Call the streaming API.
    // 3. Convert the response into StreamChunk values.
  }
}

export interface Config {
  apiKey: string
  providers: string[]
}

export const Config: Schema<Config> = Schema.object({
  apiKey: Schema.string().required(),
  providers: Schema.array(Schema.string()).required(),
})

export const name = 'my-llm-adapter'
export const inject = ['llm']

export function apply(ctx: Context, config: Config) {
  const adapter = new MyAdapter(config.apiKey)
  ctx.llm.registerAdapter(config.providers, adapter)
}
```

## StreamChunk プロトコル

`stream()` は次のプロトコルでチャンクを yield します:

```ts
import { brandString } from '@deepseek-ai/dsh-brand'
import type { StreamChunk, ToolCallId } from '@deepseek-ai/dsh-llm'

async function* exampleChunks(): AsyncIterable<StreamChunk> {
  // 1. Start each content block with block-start.
  yield { type: 'block-start', index: 0, blockType: 'text' }

  // 2. Stream text through text-delta.
  yield { type: 'text-delta', index: 0, text: 'Hello' }
  yield { type: 'text-delta', index: 0, text: ' world' }

  // 3. End each content block with block-end and the complete block.
  yield {
    type: 'block-end',
    index: 0,
    block: { type: 'text', text: 'Hello world' },
  }

  // 4. Tool-call block.
  yield { type: 'block-start', index: 1, blockType: 'tool-call' }
  yield {
    type: 'tool-call-delta',
    index: 1,
    id: brandString<ToolCallId>('call-123'),
    name: 'bash',
    argumentsDelta: '{"command":"ls"}',
  }
  yield {
    type: 'block-end',
    index: 1,
    block: {
      type: 'tool-call',
      id: brandString<ToolCallId>('call-123'),
      name: 'bash',
      arguments: '{"command":"ls"}',
    },
  }

  // 5. Token usage.
  yield { type: 'usage', usage: { inputTokens: 100, outputTokens: 50 } }

  // 6. Finish reason.
  yield { type: 'finish', reason: { kind: 'stop' } }
  // Alternatively, { kind: 'tool-calls' } requests tool execution.
}
```

### 主要な規則

- すべての `block-start` に対応する `block-end` があります。
- `index` は 0 から増加し、コンテンツブロックの順序を識別します。
- `tool-call-delta` は `argumentsDelta` に生 JSON テキストを運び、一度にまとめて、または複数チャンクに分けて送ります。
- `finish` は最後のチャンクです。
- `usage` は `finish` より前に送出します。

## GenerateOptions

`stream()` は公開された `GenerateOptions` 型を受け取ります。これにはモデル、アダプター所有の reasoning-effort ID、会話履歴、システムプロンプト、ツールスキーマ、生成パラメーター、停止シーケンス、中止シグナルが含まれます。`@deepseek-ai/dsh-llm` が公開する TypeScript 型を正として扱ってください。サポートするフィールドをプロバイダー API にマッピングします。プロバイダーがフィールドに対応できない場合、黙って破棄せず、安定したコードを持つ `LlmError` をスローしてください。

`resolveModel(provider, model, signal?)` をオーバーライドして、正確なプロバイダー/モデル同一性に任意の `context` および `reasoning` メタデータを加えて 1 回の検索で返します。reasoning メタデータは順序付きの不透明 ID と表示名、および任意の設定済み既定値を含みます。アダプターの正となる選択可能リストを保持し、上流ケイパビリティ API が返す場合の `off` も含め、それらの値をコア enum に格上げしないでください。非同期検索では任意のシグナルを尊重し、キャンセルと破棄が静止に到達するようにします。サービスは集約を検証し、サポート外の明示的 effort を `stream()` の前に拒否します。`reasoning` の省略は、そのモデルに選択可能な reasoning-effort ケイパビリティがないことを意味します。

## アダプターの登録

```ts ignore-check
ctx.llm.registerAdapter(['my-provider'], adapter)
```

最初の引数はアダプターが処理するプロバイダールートの一覧です。`GenerateOptions.provider` が登録済みアダプターを選択し、`GenerateOptions.model` はライフサイクル登録なしのアダプター所有モデル ID を渡します。アダプターがセレクター向けにモデル選択肢を宣伝できる場合、`listModels()` をオーバーライドしてください。

## cordis.yml からの利用

```yaml
- id: my-llm
  name: './src/my-llm-adapter.ts'
  config:
    apiKey: !!js process.env.MY_API_KEY
    providers:
      - my-provider

- id: agent-loop
  name: '@deepseek-ai/dsh-agent-loop'
  config:
    agents:
      - id: main
        provider: my-provider
        model: my-model-v1
```

## リファレンス実装

リポジトリには完全な実装が含まれています:

- `packages/llm/llm-deepseek/` — Messages API を使う DeepSeek アダプター
- `packages/llm/llm-pi-ai/` — 異なる API 形式を使う Pi AI アダプター

同じハーネス契約が異なるプロバイダー SDK 上で実装されている様子を、2 つの同梱アダプターで比較してください。

## エラー処理

アダプターは転送およびプロトコル失敗を、安定したコードを持つ `LlmError` 値としてスローします。エージェントループは診断とポリシーのためにエラーとコードを保持し、通常の `Error` を自動変換しません。すべてのプロバイダー HTTP リクエストは `attributionHeaders()` をマージし、`options.signal` を転送しなければなりません。

```ts
import {
  attributionHeaders,
  LlmAdapter,
  LlmError,
  type GenerateOptions,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'

class HttpAdapter extends LlmAdapter {
  constructor(private readonly endpoint: string) {
    super()
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...attributionHeaders(),
      },
      body: JSON.stringify({ model: options.model, messages: options.messages }),
      ...options.signal ? { signal: options.signal } : {},
    })
    if (!response.ok) {
      throw new LlmError(`Provider API error: ${response.status}`, 'PROVIDER_HTTP_ERROR')
    }
    // A real adapter parses the response and emits the complete chunk sequence.
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
```
