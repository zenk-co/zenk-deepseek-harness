# ポストモーテム 0001: 接続時に ACP サーバーがクラッシュ — `export default` がプラグインの `inject` を落とした

日本語 | [English](0001-acp-default-export-drops-inject.en.md) | [中文](0001-acp-default-export-drops-inject.zh.md)

ステータス: 解決済み（PR #41 `feat/acp-2-bridge` で修正）

## エグゼクティブサマリー

完全なユニットカバレッジにもかかわらず、2 つの統合ミスが ACP を壊した。デフォルトエクスポートが Loader に `inject` を破棄させ、トレースされたオプショナルサービスのルックアップがシャドウ境界を越えて失敗した。手でマウントしたテストは両方の経路を迂回していた。修正はキー不要の実 Loader カバレッジと、プラグインエクスポートおよびオプショナルサービスアクセスのパッケージルールを追加した。

## 概要

ACP サーバー（`dsh --profile acp`、`@deepseek-ai/dsh-acp`）は、実際のエディター（Zed）が接続した瞬間にクラッシュした。最初の `session/new` リクエストは `Internal error: cannot get property "agents" without inject` を返し、`session/load` は `sessionPersistence` について同じものを返した。ブリッジは、178 個のグリーンなユニットテストと 100% の行カバレッジにもかかわらず、本番では完全に機能していなかった。2 つの独立したバグが同じエラー文字列の背後に隠れており、テストスイートは同じ理由で両方を見逃した。すべてのテストが、プラグインの実際のロード方法やサービスの実際の解決方法を走らせない経路でプラグインをマウントしていた。

## 影響

ACP サーバーは 1 つのセッションも作成・ロードできなかった — エディターが最初に呼ぶ 2 つの RPC である。エージェントを Zed に配線した者は誰でも即座のハード障害を得た。データ損失はない（クラッシュ前に何も永続化されなかった）。コストは完全に「機能が動かない」ことと、その理由を突き止めるデバッグ時間（2 回分）だった。

## タイムライン

- ブリッジ（RFC 010）は、コーデック、インメモリトランスポート、生成されたプロトコルメッセージ、失敗経路、HMR の完全なユニットスイート、キーゲート付きの実 API e2e、キー不要の stdout 純度 e2e とともに着地した。すべてグリーン、100% カバレッジ。
- 実際の Zed セッションは `session/new` で直ちに `cannot get property "agents" without inject` により失敗した。
- 調査は当初 Cordis の「traceable/shadow」理論を追求し（もっともらしく、メカニズムは実在する — Bug #2 を参照）、次にベンダーの `reflect.ts` 内の実際のファイバーウォークを計装し、実サブプロセスを実行した。トレースは、スローが `apply()` の 179 行目で *プラグインロード時* に、シャドウのない ROOT ファイバー上で起きたことを示し、`session/new` についてシャドウ理論を反証した。
- 根本原因 #1 を発見: 紛れ込んだ `export default apply`。それを削除すると `session/new` が修正された。
- 削除すると Bug #2 が露呈した。`session/load` は依然として `sessionPersistence` でスローした — 真に別個のメカニズム（シャドウウォーク）であり、修正を分離して実サブプロセスを再実行することで確認された。

## 根本原因 #1 — `export default apply` がプラグインの `inject` を落とす（`session/new` を壊した）

`packages/acp/acp/src/index.ts` は *名前空間プラグイン* である。リポジトリの他のすべてのプラグイン（`invariants`、`llm-deepseek`、`tool-bash`、`tui`、…）と同じく、`name`、`inject`、`Config`、`apply` を別々の名前付きエクスポートとしてエクスポートする。しかし、*さらに* 他のどのプラグインにもない 1 行で終わっていた:

```ts ignore-check
export const name = 'acp'
export const inject = ['agents', 'sessions', 'sessionPersistence']
export function apply(ctx: Context, config: AcpConfig): void { /* … */ }
// …
export default apply   // ← the bug
```

プラグインが `cordis.yml` からロードされるとき、cordis Loader はインポートされたモジュールを `Loader.unwrapExports`（`vendor/loader/src/index.ts`）を通じて正規化する:

```ts ignore-check
unwrapExports(exports: any) {
  if (isNullable(exports)) return exports
  exports = exports.default ?? exports        // ← prefers `.default`
  if (!exports.__esModule) return exports
  return exports.default ?? exports
}
```

デフォルトエクスポートが存在すると、`exports.default ?? exports` は **素の `apply` 関数** に解決される。素の関数には `inject`、`name`、`Config` プロパティがない — それらはモジュール名前空間上の *兄弟* の名前付きエクスポートとして存在しており、`.default` へのアンラップが名前空間を捨ててしまった。Loader は空の `inject` からプラグインのファイバーを構築した。

その結果、`apply` は **注入されたサービスなし** のファイバーで実行された。最初の行 `const agents = ctx.agents` がファイバーツリー（ROOT → Include → Loader → ROOT）を歩き、どのファイバーのストアにも `agents` を見つけられず、ルートファイバーに到達して（`runtime === null`）`cannot get property "agents" without inject` をスローした。クラッシュは *ロード時* であり、後のリクエストハンドラーではない — 失敗したトレースでは、たまたまそのリクエストがロードを引き起こしただけだった。

**修正:** `export default apply` を削除する。Loader はモジュール名前空間を使い、`inject`/`name`/`Config` を尊重し、`apply` は宣言されたサービスを実際に付与するファイバー内で実行される。

## 根本原因 #2 — オプショナルサービスの読み取りが traceable シャドウ経由で inject ガードに引っかかる（`session/load` を壊した）

まず #1 を修正すると `session/new` は動作したが、`session/load` は依然として `cannot get property "sessionPersistence" without inject` をスローした。こちらは *まさに* Cordis の traceable/shadow メカニズムであり、正確に理解する価値がある。

`session/load` は `agents.resume(...)` を呼び、それが `AgentLoop.resume()` に委譲し、それが `this.ctx.sessionPersistence` を読んだ。`AgentLoop` の `static inject` は意図的に `sessionPersistence` を含んでいない — それを注入すると、永続化しないデモは決してロードされないバックエンドを永遠に待ち続けることになる。このサービスは別の兄弟プラグイン/ファイバーが提供し、日和見的に読まれる。

Cordis のサービスアクセスはコンテキストプロキシ（`vendor/cordis/src/reflect.ts`）を通る。サービスのメソッドが外部ファイバーから得た *traceable プロキシ* を通じて呼び出されるとき（ここではブリッジファイバーが `ctx.agents.resume` を呼び、レジストリが `this.factory` — `AgentLoop` — を呼び出し元に束縛された新しい traceable プロキシとして再ラップして返す）、`createShadowMethod`（`vendor/cordis/src/utils.ts`）が `this` を *シャドウ* オブジェクトに再束縛し、その `ctx` は `AgentLoop` 自身の構築コンテキストを指す `[symbols.shadow]` を運ぶ。したがって `resume` 内部では、`this.ctx.sessionPersistence` の解決でプロキシハンドラーがシャドウのファイバーからファイバーウォークを開始する:

```ts ignore-check
// reflect.ts get handler
let fiber = (ctx[symbols.shadow] as Context ?? ctx).fiber   // ← starts at AgentLoop's fiber
while (true) {
  const impl = fiber.store?.[prop]
  if (impl) return getTraceable(ctx, impl.value)
  if (prop in fiber.inject) { /* inactive-context error */ }
  if (!fiber.runtime) throw error                            // ← reached root, throw
  if (fiber.parent[symbols.isolate][prop] !== key) throw error
  fiber = fiber.parent.fiber                                 // ← ancestor-only
}
```

ウォークは **祖先のみ** である。`sessionPersistence` は `AgentLoop` のファイバーストアにも（`static inject` にない）、ルートへ向かうどの祖先にもない（*兄弟* ブランチに住んでいる）ので、ウォークはルートファイバーに到達してスローする。

なぜインメモリの `AgentLoop` resume テストはこれを捉えなかったのか。テストコードから直接 `ctx.agents.resume(...)` を呼ぶからである — *どのプラグインファイバーの外* で。そこでは `ctx.fiber.runtime` が `null` なので、プロキシハンドラーは早期バイパスを取る:

```ts ignore-check
if (!ctx.fiber.runtime) return ctx.reflect.get(prop, false)   // ← direct global-store lookup, no fiber walk
```

`ctx.reflect.get(name, false)` は isolate シンボルでキー付けされたグローバルサービスストアへの直接ルックアップである — ファイバートポロジーを完全に無視し、サービスを見つける。したがってトップレベルのテストからは読み取りは機能し、シャドウ経由で到達する実際のプラグインファイバー内部からはスローする。ブリッジはまさに後者である。

**修正:** オプショナルサービスは `ctx.get('sessionPersistence')` で読む。これはアクティブ状態チェックを保ちながらグローバルな isolate キー付きストアを使う。直接プロパティ読み取りは、プラグインの宣言された注入セットにあるサービスには引き続き適切である。

## なぜすべてのテストが見逃したか（本当の失敗）

両方のバグは 1 つの根本的なプロセスの欠落を共有する: **どのテストも、プラグインを実際のロード経路や実際の呼び出しトポロジーを通じて走らせていなかった。**

- インメモリハーネスは、プラグインオブジェクトを手で構築してブリッジをマウントする: `ctx.plugin({ name, inject, apply })`。これは `inject` を手動で供給するので、Bug #1 を再現し得ない — `unwrapExports` は *Loader* だけが呼び、`ctx.plugin` は決して呼ばない。`ctx.plugin(NamespaceImport)` でさえ捉えなかっただろう。
- 同じハーネスはすべてを 1 つのルートコンテキストに平坦にマウントするので、そこから到達する `AgentLoop` の resume はトップレベル（`!runtime` バイパス）で走るか、起点が依然としてルート上で解決されるシャドウを通じて走る — Bug #2 の祖先ウォーク失敗を覆い隠す。
- 唯一のキー不要 e2e は `initialize` を送り、stdout 純度をチェックした。`initialize` はファクトリーに決して到達しないので、両方のバグを素通りした。
- `session/new`/`session/load` を走らせた唯一のテストはキーゲート付きだったので、CI（キーなし）はそれをスキップした — そしてローカルでは、古いビルド済み `lib/`（旧コード入り）がたまたまモジュール解決を満たしたから「通過」しただけだった。

100% の行カバレッジはその間ずっと満たされていた。カバレッジは行が *実行された* ことを証明するだけであり、機能が *出荷される形で* 動くかについては何も言わない。

## 追加されたガードレール

- **`export default apply` を削除**（`packages/acp/acp/src/index.ts`） — Bug #1 の修正。
- **`AgentLoop.resume` が `this.ctx.get('sessionPersistence')` を読む**（`packages/core/agent-loop/src/index.ts`） — Bug #2 の修正。シャドウウォークの罠を説明するコメント付き。
- **実 stdio 上のキー不要 `session/new` e2e**（`apps/cli/tests/profiles/acp/tests/acp.e2e.ts`）: プロファイルを実 Loader 経由のサブプロセスとして起動し、`session/new` が解決することをアサートする。これは API キーなしで Bug #1 に対して大声で失敗する。`export default apply` を復元すると失敗することを検証済み。
- **e2e スポーンにおける `TSX_TSCONFIG_PATH`**: サブプロセスは一時的な cwd から走り、そこでは tsx が上方探索でリポジトリルートの tsconfig `paths` マップを見つけられない — そのため dsh-* の import は黙ってビルド済み `lib/` にフォールバックしていた。tsx をリポジトリの tsconfig に向けると解決が cwd 非依存になり、テストが *ソース* を走らせ、古びた可能性のあるビルドではなくなることを保証する。
- **[docs/testing.md](../testing.md) のルール**: 「実際のエントリー経路をテストする」。行カバレッジは動作カバレッジではない — 将来のすべてのプラグインのために教訓を成文化する。

## 教訓

- 名前空間プラグインとデフォルトエクスポートは cordis Loader の下で相互排他的である。名前空間形式（`name`/`inject`/`Config`/`apply`）を選び、`export default` を追加しない — `unwrapExports` が名前空間を破棄する。
- プラグインが日和見的に読むが `static inject` で宣言しないサービスには、`ctx.get(name)` を使い、決して `ctx.<name>` を使わない。プロパティプロキシは祖先のみのファイバーウォークで解決し、外部のシャドウを通ると失敗する。`ctx.get(name)` はトポロジー非依存のルックアップである（そして既定で厳格 — 非アクティブなバックエンドはティアダウン中に返されるのではなく `undefined` として読まれる）。
- 手でプラグインを構築するテストは、プラグインがどうロードされるかを検証できない。少なくとも 1 つのテストが実 Loader/エクスポート経路をエンドツーエンドで走らせなければならない。看板の操作がモデルを呼ばない場合、そのテストは API キーを必要としない — したがってキーゲートの背後ではなく CI に属する。
- 理論ではなくトレースを信じる。優雅なシャドウの説明は実在したが *2 番目* のバグだった。*1 番目* は 1 行のエクスポートミスであり、もっともらしいが誤った数時間の推論の後、ファイバーウォークの `console.error` が数分で見つけた。
