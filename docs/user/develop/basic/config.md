# プラグイン設定

日本語 | [English](config.en.md) | [中文](config.zh.md)

`cordis.yml` 経由で提供される設定を受け付ける。

## Config 型を定義する

`Config` 型と同名の Schemastery スキーマをエクスポートする。デフォルトはスキーマフィールドに直接置く:

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export const name = 'my-plugin'

export interface Config {
  greeting: string
  maxRetries: number
  verbose?: boolean
}

export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  maxRetries: Schema.number().default(3),
  verbose: Schema.boolean().default(false),
})

export function apply(ctx: Context, config: Config) {
  console.log(config.greeting)  // User value or schema default.
}
```

挿入済みローカルプラグイン行の設定を `scratch-plugin/cordis.yml` に追加する:

```yaml
- insert:
    - id: hello
      name: './src/my-plugin.ts'
      config:
        greeting: 'Hi there'
        maxRetries: 5
```

プラグイン読み込み時、Cordis はエクスポートされたスキーマを使用して設定を検証し、デフォルトを補完する。プレーンオブジェクトを `Config` としてエクスポートしてはならない。Cordis が要求する Standard Schema インターフェースを実装していないためである。

## スキーマ検証

より厳密な検証を表現するには Schemastery を使用する:

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export const name = 'validated-plugin'

export interface Config {
  apiKey: string
  timeout: number
  mode: 'fast' | 'accurate'
}

export const Config = Schema.object({
  apiKey: Schema.string().required(),
  timeout: Schema.number().default(30000),
  mode: Schema.union(['fast', 'accurate']).default('fast'),
})

export function apply(ctx: Context, config: Config) {
  // config is validated and type-safe.
}
```

スキーマはプラグイン読み込み中に実行される。不正な設定は、対処可能なエラーで読み込みを失敗させる。

## 設計原則

### 調整可能な値をハードコードしない

Harness では**2 つのデプロイが異なる値に設定したい可能性のあるものはすべて設定フィールドにすること**が求められる。

```ts
// Wrong: hardcoded timeout.
const TIMEOUT = 30000

// Correct: configurable.
export interface Config {
  timeoutMs: number  // Defaults to 30000.
}
```

テストは、その値をコード編集なしに `cordis.yml` で変更できるかどうかである。

### 不正な設定は大きな失敗にする

自己完結した制約はスキーマで表現し、不正な設定がプラグイン読み込み中に失敗するようにする。サービスや登録済みリソースへの参照には依存性注入が必要である。その契約は[サービスチュートリアル](../framework/service.md)で説明する。

## HMR と共に働く

設定編集によりプラグインはホット置換される。フレームワークは古いインスタンスをアンロードして新しいものを読み込む。登録はエフェクトであり自身をクリーンアップするため、置換によって古いインスタンスの登録が残ることはない。

## 次のステップ

- [プラグインをパッケージしてインストールする](./publish.md) — プラグインをインストール可能なパッケージとして出荷する
- [プラグインとライフサイクル](../framework/index.md) — 完全なプラグインライフサイクルを理解する
- [サービスと依存関係](../framework/service.md) — 他のプラグインにサービスを提供する
