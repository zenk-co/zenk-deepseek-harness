# 6. コンポジションと HMR

日本語 | [English](06-composition-and-hmr.en.md) | [中文](06-composition-and-hmr.zh.md)

これまでに作ったすべてのケイパビリティはプラグインであり、`cordis.yml` がアプリケーションのプラグインツリーを選ぶ。この章ではそのコンポジションを変更し、プラグインをホットリロードし、読み込まれないプラグインを診断する。

## エントリーは名前以上のもの

設定エントリーは `name` と `config` を超えるメタデータを受け付ける:

```yaml
- id: greeter          # stable identity for this entry
  name: './greeter.ts'
- id: consumer
  name: './consumer.ts'
  disabled: true       # keep the entry, skip mounting it
```

`id` はエントリーに安定した識別子を与え、ローダーが既存エントリーへの編集と削除＋追加を区別できるようにする。`disabled: true` はエントリーを削除せずにプラグインのマウントを外す。戻せばプラグイン（とそのサービスを PENDING しているすべて）が再び読み込まれる。

グループはエントリーのサブリストを入れ子にし、1 単位で読み込み・破棄する。`isolate` はグループにサービス名の独自インスタンスを与え、2 つのグループが互いに影響せず異なる設定の `shell` プロバイダーを参照できる。[Cordis 入門](../cordis-primer.md)と[サービス分離の例](../user/develop/framework/service.md#service-isolation)が詳細を扱う。

## ホットモジュールリプレースメント

アンロードでエフェクトが解放され（[第 2 章](02-lifecycle-and-effects.md)）、読み込みが依存関係に従うため（[第 3 章](03-services.md)）、HMR は実行中のプラグインをアンロード・再読み込みで置換できる。`@deepseek-ai/dsh-hmr` プラグインはファイルを監視し、保存時にまさにそれを行う。

`tmp/cordis-tutorial` に `cordis.yml` を書く:

```yaml
- id: logger
  name: '@deepseek-ai/cordis-plugin-logger-console'
- id: timer
  name: '@deepseek-ai/cordis-plugin-timer'
- id: hmr
  name: '@deepseek-ai/dsh-hmr'
  config:
    root: ['.']
- id: hello
  name: './hello.ts'
```

2 つの支援プラグインが一覧に加わった。HMR は Cordis ロガーサービス経由で記録するため、コンソール出力先がなければそのメッセージは見えず、`timer` サービスを `inject` してデバウンスするため、`@deepseek-ai/cordis-plugin-timer` がなければ永久に PENDING のまま黙り続ける。その沈黙が次の節の主題である。

HMR はローダーのネイティブヘルパー経由で Node のローダー内部を読む。Cordis を tsx 配下で実行する:

```sh
node --import tsx ../../vendor/cordis/bin.js
```

`hello.ts` を編集してログメッセージを変え、保存する:

```
hello from my first plugin
2026-07-22 15:44:36 [I] hmr watching [ '.' ]
2026-07-22 15:44:39 [I] hmr reload plugin at hello.ts
hello from my EDITED plugin
```

古いインスタンスはアンロードされ（すべてのエフェクトが巻き戻され）、新しいコードが読み込まれ、`apply` が再実行された。Ctrl-C でプロセスを止める。`cordis.yml` 自体の編集も検出される。ローダーは `id` でエントリーを差分し、変わったものだけマウント・破棄・再設定する。だから上記エントリーには明示的な `id` が付いている。`id` のないエントリーは読み込みのたびに生成 id を得るため、設定ファイルの編集後は自身の行が変わっていなくても削除＋追加と数えられ、再マウントされる。

## 読み込まれないプラグインの診断

依存関係駆動の読み込みの裏返しとして、`inject` に誰も提供しないサービス名を書いたプラグインは永久に待ち、何も出力しない。エラーにならない。プロバイダーが後からマウントされるかもしれないため、PENDING は正当な状態である。

状態は直接見られる。すべてのコンテキストはプラグインレジストリを列挙できる。`diagnose.ts` を作る:

```ts
import { FiberState, type Context } from '@deepseek-ai/cordis'

export const name = 'diagnose'

export function apply(ctx: Context) {
  setTimeout(() => {
    for (const runtime of ctx.registry.values()) {
      for (const fiber of runtime.fibers) {
        if (fiber.state === FiberState.PENDING) {
          console.log(`${fiber.name} is PENDING — a required service is missing`)
        }
      }
    }
  }, 500)
}
```

そして満たせない依存を持つプラグイン `needs-timer.ts`:

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'needs-timer'
export const inject = ['timer']

export function apply(ctx: Context) {
  console.log('needs-timer loaded')
}
```

```yaml
- name: './needs-timer.ts'
- name: './diagnose.ts'
```

実行する（素の `node --import tsx ../../vendor/cordis/bin.js`。Ctrl-C で止める）:

```
needs-timer is PENDING — a required service is missing
```

`inject: ['timer']` にプロバイダーがいない。一覧に `- name: '@deepseek-ai/cordis-plugin-timer'` を加えるとプラグインは読み込まれる。プラグインが何もせず何も報告しないときはファイバー状態を調べること。PENDING 絞り込みなしの反復では、設定ファイル自体をマウントするプラグイン（Loader、Include）も ACTIVE ファイバーとして表示される。

次: [ハーネスの世界へ](07-into-the-harness.md) — 実際のハーネスサービスに対する同じパターンである。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
