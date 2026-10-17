# 初めてのプラグイン

日本語 | [English](index.en.md) | [中文](index.zh.md)

この手引きは最小の Harness プラグインを作り Web UI に読み込む。[ソースから走らせる経路](../../../../README.md#run-from-source)を完了したリポジトリ複製から始めること。

## ローカル計画を作る

リポジトリ根から手引き用の作業計画を作る。

```sh
mkdir -p scratch-plugin/src
```

## プラグインとは何か

Harness ではプラグインは `apply` 関数を表出する TypeScript 単位である。枠組みはプラグイン読み込み時に `apply` を呼び、プラグインがケイパビリティを登録する `ctx` 文脈対象を渡す。

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'my-plugin'

export function apply(ctx: Context) {
  // Register capabilities here.
}
```

これが完全な構成である。

## プラグインファイルを作る

`scratch-plugin/src/my-plugin.ts` を作成する。

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'hello-plugin'

export function apply(ctx: Context) {
  // Required dependencies are ready before apply runs.
  console.log('[hello-plugin] plugin loaded!')
}
```

## cordis.yml に登録する

リポジトリ根から `pwd` を走らせ、ローカルプラグインを挿入する Web オーバーレイとして `scratch-plugin/cordis.yml` を作る。下の `/absolute/path/to/deepseek-harness` を表示された経路に置き換えること。

```yaml
- insert:
    - id: hello
      name: '/absolute/path/to/deepseek-harness/scratch-plugin/src/my-plugin.ts'
```

プラグイン経路は絶対でなければならない。パッチファイルは構成を提供するが、ローダーが単位経路を解決するプロファイル directory を変えない。

そのオーバーレイで Web UI を起動する。

```sh
pnpm dsh web --patch ./scratch-plugin/cordis.yml
```

`http://127.0.0.1:3080` を開く。起動中に端末へ `[hello-plugin] plugin loaded!` と表示される。

## 自動片付け

`ctx` 経由で登録したもの — イベント待ち受け、ツール、タイマー — はプラグインのアンロード時に片付けられる。removeListener や clearInterval を手で呼ぶ必要はない。

接続のような明示的片付けの要る資源には、破棄子を与えるために `ctx.effect()` を使う。

```ts
import type { Context } from '@deepseek-ai/cordis'

export function apply(ctx: Context) {
  ctx.effect(() => {
    const timer = setInterval(() => {
      console.log('heartbeat')
    }, 5000)

    // The returned function runs when the plugin unloads.
    return () => clearInterval(timer)
  })
}
```

## 依存を宣言する

プラグインが `tools` や `llm` のような他サービスを消費する場合は `inject` で宣言する。

```ts ignore-check
import type { Context } from '@deepseek-ai/cordis'

export const name = 'my-tool-plugin'
export const inject = ['tools']

export function apply(ctx: Context) {
  // ctx.tools is ready here.
  ctx.tools.register(/* ... */)
}
```

枠組みはプラグイン読み込み前に必須サービスすべてを待つ。

## 3 つのプラグイン形式

関数単位に加え、プラグインはオブジェクト形式やクラス形式を使える。

### オブジェクト形式

```ts
import type { Context } from '@deepseek-ai/cordis'

export default {
  name: 'my-plugin',
  inject: ['tools'],
  apply(ctx: Context) {
    // ...
  },
}
```

### クラス形式

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

export default class MyService extends Service {
  static inject = ['tools']

  constructor(ctx: Context) {
    super(ctx, 'myService')
    // Perform synchronous initialization in the constructor.
  }
}
```

関数形式は大半の場合に十分である。プラグインが他プラグインへのサービスを提供する場合にクラス形式を使う。[サービスと依存](..//framework/service.md) を見ること。

## 次の手順

- [ツールを作る](./tool.md) — ツール定義 DSL を学ぶ
- [プラグイン設定](./config.md) — 利用者設定を受け付ける
- [Cordis 手引き](../../../cordis-tutorial/index.md) — 土台のプラグインフレームワーク。API 鍵なしの作業 directory から組み立てる
