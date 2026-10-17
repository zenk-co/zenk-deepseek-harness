# ツールを構築する

日本語 | [English](tool.en.md) | [中文](tool.zh.md)

このチュートリアルでは Web UI に `greet` ツールを追加する。先に [最初のプラグイン](./index.md) を完了し、`scratch-plugin` ディレクトリを残しておく。

## ツールプラグインを作成する

`scratch-plugin/src/my-plugin.ts` を以下に置き換える:

```ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'greet-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet someone by name.',
    parameters: {
      name: { type: 'string', required: true, description: 'The name to greet' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      return `Hello, ${args.name}!`
    },
  }))
}
```

`inject` は Cordis にツールレジストリを待たせる。`defineTool` は `parameters` から `args` を推論・検証し、`execute` は `output.schema` で宣言された正規値を返し、`output.render` はその値をモデル向けコンテンツに変換する。

## ツールを実行して呼び出す

開発コマンドが動いていなければ再起動する:

```sh
pnpm dsh web --patch ./scratch-plugin/cordis.yml
```

`http://127.0.0.1:3080` を開いて尋ねる: `Use the greet tool to greet Ada.` モデルは `greet` を呼び出せ、`Hello, Ada!` をツール結果として受け取る。

## 次の手順

- [プラグイン設定](./config.md) — あいさつを構成可能にする。
- [ツール作成リファレンス](../../../cookbook/adding-a-tool.md) — ネストしたスキーマ、正規値、バックグラウンド作業、ポリシーフック、PTC モード、UI カードを調べる。
- [ケイパビリティの層化](../practice/index.md) — 置換可能なケイパビリティをサービス定義、サービスプロバイダー、コンシューマーの各パッケージに分割する。
