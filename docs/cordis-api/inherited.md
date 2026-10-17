<!-- scripts/gen-cordis-catalog.ts により生成される — 手動で編集しないこと。
     `pnpm run gen-cordis-catalog` を実行して再生成する。 -->

# Inherited Cordis API

ハーネス層を超えてすべてのプラグインが見るフレームワーク `ctx` メンバーとイベント。固定ベンダーソース（[ベンダリングポリシー](../../vendor/README.md)）であり、ハーネスページがリポジトリ所有の語彙に集中できるよう簡潔に要約する。詳細な Context、Fiber、Registry、Service API は [context.md](context.md)、[fiber.md](fiber.md)、[registry.md](registry.md)、[service.md](service.md) で生成され、イベント配送メソッドは [events.md](events.md) にある。

このファイルはソースから生成される（`scripts/gen-cordis-catalog.ts`）。`pnpm run verify-cordis-catalog`（`doc-sync` の一部）で鮮度を検証する。手で編集しないこと。シグネチャブロックは `ts cordis-catalog` フェンスを使い、各イベントまたはサービスメソッドの直前に元のソース JSDoc を含む。doc-typecheck はこれらの素の宣言断片を跳ばす。シグネチャ内の型名はそれを文書化するページにリンクする。

## 継承 `ctx` メンバー（cordis core + loader/hmr/timer）

- `ctx.on / ctx.once` — イベントリスナーを登録する（破棄可能）。（[`vendor/cordis/src/events.ts:34`](../../vendor/cordis/src/events.ts)）
- `ctx.emit / ctx.parallel / ctx.serial / ctx.bail / ctx.waterfall` — イベントを配送する（同期・待機・先着 bail・短絡チェーン）。（[`vendor/cordis/src/events.ts:34`](../../vendor/cordis/src/events.ts)）
- `ctx.plugin / ctx.inject` — プラグインを読み込む・必要なサービスを宣言する。（[`vendor/cordis/src/registry.ts:164`](../../vendor/cordis/src/registry.ts)）
- `ctx.effect` — ファイバーに結び付けられた破棄可能な副作用を登録する。（[`vendor/cordis/src/fiber.ts:9`](../../vendor/cordis/src/fiber.ts)）
- `ctx.get / ctx.set / ctx.provide / ctx.accessor / ctx.mixin` — 低水準サービスストアアクセスと束縛。（[`vendor/cordis/src/reflect.ts:7`](../../vendor/cordis/src/reflect.ts)）
- `ctx.extend / ctx.isolate / ctx.intercept` — 子コンテキストを導出する（スコープ付きサービス・分離・インターセプト）。（[`vendor/cordis/src/context.ts:42`](../../vendor/cordis/src/context.ts)）
- `ctx.root / ctx.fiber / ctx.registry / ctx.reflect / ctx.events / ctx.logger` — 実行中コンテキストグラフへの周囲ハンドル。（[`vendor/cordis/src/context.ts:16`](../../vendor/cordis/src/context.ts)）
- `ctx.timer（+ interval / timeout / throttle / debounce）` — 破棄可能なタイマーヘルパー。`timer` キーは実行時に提供される。対応する 4 つのヘルパーは ctx に直接 mixin される（Pick 経由で宣言）。（[`vendor/timer/src/index.ts:4`](../../vendor/timer/src/index.ts)）
- `ctx.loader` — アプリを起動した設定ローダー（ローダー配下に存在）。（[`vendor/loader/src/index.ts:30`](../../vendor/loader/src/index.ts)）

## 継承イベント（cordis core + loader/hmr/timer）

- `internal/plugin` — プラグインファイバーが作成された。（[`vendor/cordis/src/events.ts:331`](../../vendor/cordis/src/events.ts)）
- `internal/status` — ファイバーがライフサイクル状態を変えた。（[`vendor/cordis/src/events.ts:333`](../../vendor/cordis/src/events.ts)）
- `internal/service` — サービス束縛のインターセプトフック（core 生産者なし）。（[`vendor/cordis/src/events.ts:341`](../../vendor/cordis/src/events.ts)）
- `internal/update` — ウォーターフォール: ファイバー設定更新が適用されている。（[`vendor/cordis/src/events.ts:343`](../../vendor/cordis/src/events.ts)）
- `internal/config` — ウォーターフォール: ファイバー設定が検証前に解決されている。（[`vendor/cordis/src/events.ts:339`](../../vendor/cordis/src/events.ts)）
- `internal/get` — ウォーターフォール: サービスがストアから読まれている。（[`vendor/cordis/src/events.ts:345`](../../vendor/cordis/src/events.ts)）
- `internal/set` — ウォーターフォール: サービスがストアに書かれている。（[`vendor/cordis/src/events.ts:347`](../../vendor/cordis/src/events.ts)）
- `internal/listener` — リスナーが登録された。（[`vendor/cordis/src/events.ts:349`](../../vendor/cordis/src/events.ts)）
- `internal/dispatch` — イベントがリスナーに配送されている。（[`vendor/cordis/src/events.ts:351`](../../vendor/cordis/src/events.ts)）
- `exit` — プロセスがシグナルで終了している。（[`vendor/loader/src/index.ts:25`](../../vendor/loader/src/index.ts)）
- `loader/config-update` — ローダー設定ツリーが変わった。（[`vendor/loader/src/index.ts:26`](../../vendor/loader/src/index.ts)）
- `loader/entry-init` — 設定エントリーが初期化されている。（[`vendor/loader/src/index.ts:27`](../../vendor/loader/src/index.ts)）
- `loader/partial-dispose` — エントリーがリロード時に部分破棄されている。（[`vendor/loader/src/index.ts:28`](../../vendor/loader/src/index.ts)）
- `loader/patch-context` — リロード中にコンテキストにパッチが当たっている。（[`vendor/loader/src/index.ts:41`](../../vendor/loader/src/index.ts)）
- `loader/volatile-update` — volatile 設定値が再マウントなしに実行中ファイバーにコミットされた。所有ファイバーにのみ配送される。（[`vendor/loader/src/index.ts:34`](../../vendor/loader/src/index.ts)）
