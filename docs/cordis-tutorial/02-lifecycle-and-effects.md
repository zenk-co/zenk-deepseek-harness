# 2. ライフサイクルとエフェクト

日本語 | [English](02-lifecycle-and-effects.en.md) | [中文](02-lifecycle-and-effects.zh.md)

Cordis プラグインは設定編集、ホットリロード、明示的な破棄、必須サービスの喪失によりアンロードされうる。Cordis API 経由の登録はエフェクトであり、所有プラグインのアンロード時に解かれる。これらの API の外で管理する資源は `ctx.effect()` で包まなければならない。

## エフェクト

Cordis がまだ管理していない資源 — タイマー、接続、ウォッチャー — は `ctx.effect()` で包み、破棄子を返す。

`tmp/cordis-tutorial` に `lifecycle.ts` を作成する。

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'lifecycle-demo'

function heartbeat(ctx: Context) {
  console.log('heartbeat plugin loading')
  ctx.effect(() => {
    const timer = setInterval(() => console.log('tick'), 200)
    return () => {
      clearInterval(timer)
      console.log('heartbeat cleaned up')
    }
  })
}

export function apply(ctx: Context) {
  // Mount a child plugin and keep its fiber to dispose it later.
  const fiber = ctx.plugin(heartbeat)
  // The demo timer is itself an effect: if THIS plugin is unloaded first,
  // the pending callback is cancelled instead of firing on a dead app.
  ctx.effect(() => {
    const timer = setTimeout(async () => {
      await fiber.dispose()
      console.log('disposed')
      process.exit(0)
    }, 700)
    return () => clearTimeout(timer)
  })
}
```

`cordis.yml` をそれに向ける。

```yaml
- name: './lifecycle.ts'
```

実行する (`node --import tsx ../../vendor/cordis/bin.js`) と次を得る。

```
heartbeat plugin loading
tick
tick
tick
heartbeat cleaned up
disposed
```

注目すべき 3 点。

- `ctx.plugin(heartbeat)` は関数をプラグインとしてコードからマウントする — YAML ローダーが各設定項目に行うのと同じ操作である。関数プラグインに `apply` メソッドは不要であり、Cordis は関数を直接呼び出し、その名前は診断にのみ使う。`apply` メソッドが必要なのはオブジェクト形式 `ctx.plugin({ apply(ctx) { /* ... */ } })` のみである。呼び出しは 1 つの読み込み済みプラグイン実体へのランタイムハンドルである**ファイバー**を返す。
- エフェクト本体は読み込み中に走り、返す破棄子はアンロード中に走る。プラグイン寿命の資源について破棄子を自分で呼ぶことはない。
- `fiber.dispose()` は非同期破棄子を含むプラグインの片付け全体 — およびそれがマウントした子プラグインの再帰的アンロード — の完了後に解決する。

## ファイバー状態機械

読み込まれた各プラグイン実体は次の状態を遷移するファイバーを所有する。

```
PENDING → LOADING → ACTIVE → UNLOADING → DISPOSED
                  ↘ FAILED
```

- **PENDING** — 宣言済みだが必須サービス (第 3 章) がまだ利用できない。
- **LOADING / ACTIVE** — `apply` が実行中 / 完了済み。
- **FAILED** — `apply` または設定検証が送出した。
- **UNLOADING / DISPOSED** — 破棄子が実行中 / すべて解体済み。

PENDING には[第 6 章](06-composition-and-hmr.md)で再会する。そこでは「プラグインが何も表示しないのはなぜか」への通常の答えである。

## 既にエフェクトであるもの

`ctx.effect()` を自分で書くことは稀である。組み込み登録 API が既にエフェクトだからである。

- `ctx.on(event, listener)` — リスナーはアンロード時に外される ([第 4 章](04-events.md))。
- `ctx.plugin(child)` — 子は親とともに破棄される。
- サービス登録はエフェクトである。`ctx.tools.register(...)` のような harness レジストリも返す破棄子を呼び出し元プラグインに結び付けるため、自動的に巻き戻る ([第 7 章](07-into-the-harness.md))。

Cordis が管理しない資源は `ctx.effect()` 内で取得し、それを解放する破棄子を返す。Cordis はホットリロードを含むアンロード中にその解放を呼び出す。

順序の注意点が 1 つある。破棄子は登録の逆順に開始するが、複数の**非同期**破棄子は並行に走る。終了手順を順に走らせる必要がある場合は 1 つの破棄子にまとめ、そこで待機する。

次: [サービス](03-services.md) — プラグインがケイパビリティを共有する仕組み。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
