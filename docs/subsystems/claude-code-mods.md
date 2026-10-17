# Claude Code mods: 互換性

日本語 | [English](claude-code-mods.en.md) | [中文](claude-code-mods.zh.md)

このブリッジ経由で mod が Claude Code の下と異なる挙動をするすべての点（Claude Code 2.1.287（[mods リファレンス](https://code.claude.com/docs/en/plugins/mods/reference)とその `claude-code.d.ts`）および 2026-10-01 の [Getting started with Claude Code mods](https://claude.dev/blog/getting-started-with-claude-code-mods/) の記事時点）。各行は Claude Code の挙動、このブリッジの挙動、理由またはフォローアップを示す。ここに挙げられていないものはリファレンスの記載どおりに動作する。この Host が決して発火しないイベント上のフックは、mod のロード時に警告で名指しされ、提供テーブルの外の `$` 呼び出しは `no implementation for <namespace>.<method>` で拒否される。

## パッケージングとロード

| Claude Code | このブリッジ | 理由またはフォローアップ |
|---|---|---|
| 1 つの hooks モジュールを指名する `.claude-plugin/plugin.json` と `hooks/hooks.json` を持つプラグインディレクトリ。`claude --plugin-dir`、マーケットプレイス、`/plugin install` | mod はプラグインである: `defineMod({ name, version, root, userConfig, register })` が hooks モジュールをラップし、ブリッジの後に cordis.yml を通じてマウントする。`plugin.json` と `hooks.json` は読まれない | mods はすべての DSH プラグインが使う唯一のコンポジション機構に参加する。例のディレクトリはマニフェストを保つため、`claude --plugin-dir` でも動作する |
| 型付き既定を持つ `plugin.json` の `userConfig` スキーマ。オプションはロード時に検証される | `userConfig` は `defineMod` 仕様の既定オブジェクトである。プラグインの cordis.yml の `config` がそれを上書きし、文字列、数値、真偽値、文字列リストのレコードとして検証される | マニフェストは読まれない |
| ティア（`user`、`project`、`managed`）と `next.to(e, tier)` | すべての mod は `user` としてロードされる。テスト内の `tier()` は受け入れられて無視され、`next.to` は拒否する | マネージド設定は DSH の概念ではない |
| 編集時の hooks モジュールのホットリロード。`claude plugin validate`、`claude plugin test`、`types/index.d.ts` からの型生成 | これらのコマンドはどれもない。再マウントは同じ評価済みモジュール上で `register` を再実行するため、モジュールレベルの変数は値を保つ | フォローアップは要求時のみ。テストキットの `createModTestKit` が Vitest 内で `claude plugin test` を置き換える |
| hooks モジュールは TypeScript でもよい | `.ts` の hooks モジュールはランチャーがトランスパイルする場所でのみロードされる（ソース起動は行い、ビルド済みインストールは行わない） | DSH は素の Node を出荷する |
| mods はインプロセスで実行され、`$` がホストへの唯一のアクセスである | hooks モジュールは Node のグローバル、アクセスルールなし、プロセスの完全な権限でインプロセス実行される: `$.env` はハーネス環境を読み書きし、`$.http.fetch` は任意の URL に到達し、`$.fs` と `$.tool.call` はセッションとして動作する | mods にサンドボックスは適用されない。プラグインとして実行するつもりの mod だけをマウントすること |
| `import type { … } from 'claude-code'`、`declare module 'claude-code' { interface PluginState }` | `claude-code` モジュール名はこのリポジトリのテストセットアップ内でのみ、ブリッジの型に解決される。その外の mod は `@deepseek-ai/dsh-experimental-claude-code-mods` をインポートする | 型名はブリッジ自身のものである |
| `hooks.json` の `settings hooks` が mod の hooks の隣で実行される | 実行されない。それらには `@deepseek-ai/dsh-hooks-claude-code` をマウントする | 別のブリッジ |

## イベント

| イベント | Claude Code | このブリッジ |
|---|---|---|
| `session.start` | セッションごとに 1 回、最初のプロンプトの前に発火する | ルートエージェントに対して `agent/created` から発火し、最初のターンの前に待たれる。サブエージェントには発火しない |
| `session.end` | セッションごとに 1 回発火する | ルートエージェントに対して `agent/disposed` から発火する。`$.state` は hooks が決着するまで読める |
| `prompt.submit` | `e.text` は入力されたプロンプトであり、`context` エントリーは入力されたままプロンプトの後に 1 つずつブロックになる。プラグインが送信したプロンプトは `origin: { kind: 'plugin', name }` を運ぶ | 同じ。`e.text` はクレームされたバッチ内の人間自身の（`user` ソースの）メッセージのテキストブロックを連結したもので、注入されたコンテキストのみのバッチは何も発火しない。`$.prompt.submit` がキューしたプロンプトは、送信した mod を origin として運ぶ |
| `turn.start`、`turn.complete` | ターンごと。サブエージェントのターンは `agentId` を運ぶ | 同じ。`turn.complete` の `{ text }` は答えの下の行ではなく Host ログに届き、`durationMs` は `turn/start` から計数する |
| `tool.call` | Claude Code のパーミッションチェックの前に実行される。`next({ ...e, command })` はツールが実行される引数を書き換え、`next({ ...e, tool })` は呼び出しを別のツールへ回す | `tools/execute` の周り、ハーネスのパーミッション判断の後に実行される。引数を書き換えたり別のツールを指名したりするフック（または `.catch` ハンドラー）はレポート付きでスキップされる（引数の場合は[ツール入力前書き換え提案](../../.agents/notes/proposed/feature/2026-06-30-pre-tool-input-rewrite.md)を名指しする）。記録された呼び出しは記録されたとおりに実行されるためである。`{ deny }`、`{ result }`、観測、および `next` 後の結果または `isError` の書き換えは記載どおりに機能する |
| `command.run` | mod が登録したコマンドに対して実行される | 同じ |
| `ui.render` | すべてのレンダーサイト（`AbovePrompt`、`Pane`、`ToolUse`、`AssistantMessage`、`Spinner`、…）で発火する | `AbovePrompt` のみで、セッションのバンドの再描画ごとに 1 回発火する。`Pane` フックはテストキットの `$.ui.mount({ component: 'Pane' })` を通じてのみ実行される |
| `tool.check`、`tool.describe`、`tool.list`、`tool.register` | ツール一覧とパーミッションを形成する | 発火しない。`$.tool.register` と `$.tool.list` は `$` 呼び出しとして提供される |
| `turn.step` | モデルステップごと | 発火しない |
| 他のすべてのリファレンスイベント: 他の `prompt.*` イベント、`skill.prompt`、`attribution.text`、`command.describe`、`config.*`、他の `session.*` イベント、`agent.*`、`plugin.register`、`engine.create`、`telemetry.*`、`ui.resolve`、`ui.press`、`ui.input`、`ui.select`、`ui.focus`、`ui.scroll`、`ui.close`、`ui.message` | エンジンが発火する | 登録されるが決して発火せず、ロード時に警告で名指しされる |
| `classic.*` | イベントとしてのクラシック設定フック | 他の未知のイベント名と同じく、`register` で拒否される |
| `<namespace>.<method>` 操作イベント（`fs.read`、`store.set`、…） | 後にロードされた mod の `$` 呼び出しが、それより前にロードされた mod に到達する | 同じ。`tool.call` は代わりにツールパイプラインを通じて届く |

## チェーン

| Claude Code | このブリッジ | 理由 |
|---|---|---|
| フックは `next` を複数回呼べる。呼び出しごとに下のチェーンが再び実行される | `next` は 1 回だけ実行される。2 回目の呼び出しは最初の実行の結果を返す | 記録された呼び出しごとに 1 回のツール実行 |
| フックが `next` の実行中に応答した場合 | 下の実行はフックの答えが決着する前に待たれる。答えの後に下で起きた失敗は報告される | イベントは、それが開始した何も実行されていないときにのみ決着する |
| 10 秒の自己時間予算、`.catch` には 1 秒。`next` と `$` 呼び出し内の時間は `$.clock.sleep` を除き除外される | 同じで、構成可能（`hookTimeoutMs`、`catchTimeoutMs`） | — |
| 結果オブジェクトを返さないことは失敗 | 同じ。`null` は答えとして受け入れられる（空で描画されたサーフェス） | 描くもののない `ui.render` |
| 結果の未知のフィールドは破棄され、誤った型はフックを失敗させる | 型の誤った `prompt.submit` 結果は元のテキストを保ち、文字列のコンテキスト行だけを保持する | 部分的な結果が一般的な唯一のイベントで寛容にする |

## `$` メンバー

| 名前空間 | Claude Code | このブリッジ |
|---|---|---|
| `$.plugin` | `name`、`root`、`tier` | `defineMod` 仕様の `name`、`root` |
| `$.ui` | `resolve`、`invalidate`、`open`、`close`、`panes`、`focus`、`log`、`toast`、`status`、`notice`、`ask`、`blit`、`copy`、`press`、`input`、`select` | `resolve`、`invalidate`、`open`、`close`、`panes`、`log`、`toast`、`status`、`ask`。`open` は理由付きの `{ isPlaced: false }` を返してバンドを再描画する。`log`、`toast`、`status` は Host ログに届く。残りは拒否する |
| `$.command` | `register`、`run`、`list` | 同じ。誰も答えないコマンドの `run` は、登録した mod を名指しして拒否する |
| `$.tool` | `register`、`call`、`list` | 同じ。登録されたツールは `mcp__<plugin>__<tool>` になる。`call` はハーネスパイプラインを実行し、ツールの遅延コンテキストをセッションに注入する |
| `$.prompt` | `submit`、`compose` | `submit`。メッセージは `user` ソースで、`asUser` でない限り `Message from the "<plugin>" mod:` というフレーミングになり、それが発火する `prompt.submit` は mod を origin として名指しする |
| `$.session` | `id`、`cwd`、`root`、`repo`、`model`、`turns`、`messages`、`usage`、`version`、`send`、`append`、`authorize`、`compact`、`surfaces` | `id`、`cwd`、`root`、`model`、`turns`、`messages`、`usage`、`version`。`cwd` はコミット済みの現在のディレクトリを報告し、`root` は元のプロジェクトを保つ。`usage.context.window` は `0` で、トークンメーターがルートのウィンドウを知るまで `percent` はない。`rateLimits` は空である。`version` はこのブリッジを名指しする |
| `$.state` | セッションごと。ホットリロードを越えて生き残る | セッションごと、メモリ内。`ui.render` 中の読み取りはバンドをそのスロットに購読させる |
| `$.store` | プラグインごと、永続 | 同じ。`claude_code_mods` ストレージドメイン内で、プラグインごとに 4 MiB |
| `$.clock` | `now`、`sleep`、`after`、`every`。タイマーはプラグインとともに死ぬ | 同じ。タイマーはそのイベントをスケジュールしたセッションとともにも死に、`sleep` はイベントがキャンセルされると拒否する |
| `$.fs` | `read`、`write`、`list`、`exists`、`stat`、`ancestors` | `ancestors` 以外すべて。ファイルごとに 4 MiB。`stat.mtimeMs` は `0` |
| `$.process` | `run`、`spawn` | `run` のみ。シェルなしの argv、既定の `processTimeoutMs` |
| `$.http` | `fetch` | 同じ。ボディは最大 4 MiB |
| `$.env` | `get`、`set` | 同じ。プロセス環境はすべてのセッションとプラグインで共有される |
| `$.model`、`$.agent`、`$.config`、`$.settings`、`$.mcp`、`$.audio`、`$.telemetry`、`$.turn` | 提供される | `no implementation` で拒否する。`$.model.complete` は記録されたサイドリクエストイベントを待つ |

## 描画

| Claude Code | このブリッジ |
|---|---|
| `Box`、`Text`、`Button`、`Input`、`Spacer`、および Host 自身の要素種別 | `Box`、`Text`、`Button` を `$.ui.resolve(e)` から取得する。ツリーは検証され、`Button` の `onPress` は描画ごとのアクション id の背後で Host にとどまる |
| `Box` の props: `flexDirection`、`padding*`、`gap`、`border*`、`width`、`height`、`overflow`、`scroll` | `flexDirection`、`padding`、`paddingX`、`paddingY`、`gap`、`border`、`borderColor`。他はシリアライズされ、Web のバンドはそれらを無視する |
| `Text` の props: `color`、`bold`、`dimColor`、`italic`、`underline`、`wrap`、`truncate` | `color`（ターミナルパレット名）、`bold`、`dimColor`、`italic`、`underline`。Web のバンドは折り返す |
| `Button` の props: `label`、`hotkey`、`disabled`、`onPress`。素の数字がホットキーを武装させる | `label`、`hotkey`（ヒントとして表示）、`disabled`、`onPress`（クリック） |
| バンドは 1 インスタンス。`hasSurvey`、`isWorking`、`maxRows`、`bodyColumns` がターミナルを反映する | セッションごとに 1 インスタンスで、mod のロード順に参照される。`bodyColumns` と `viewport.columns` はブリッジの `bandColumns`（既定 `120`）、`maxRows` はその `bandRows`（既定 `10`）、`hasSurvey` と `isWorking` は `false`。Web のバンドはスクロールせず折り返す |
| バンドは Host のフレームで、またレンダーが読んだ `$.state` 値が変わったときに再描画される | `session.start` の後、最後の描画が読んだ `$.state` 値が書き込まれたとき、`$.ui.open`、`$.ui.close`、`$.ui.invalidate` の後、各 `tool.call` チェーンと `turn.complete` の決着の後、および押下の後に再描画する。他のタイミングでモジュールレベルの状態を変える mod は、次のトリガーでそれを描画する。押下は時間制限なしで `onPress` を実行する |
| トランスクリプトの横にドッキングされた、`focus` と `scroll` を持つ `Pane` | ペインはない: `$.ui.open` が `{ isPlaced: false }` を返すため、mod はバンドへフォールバックする。テストキットは `Pane` フックを直接マウントする |
| ホットキー、`TextInput`、フォーカス、スクロール、`ui.press`、`ui.input`、`ui.select` | 提供されない。フォローアップ |

## テスト

| `claude-code/testing` | このブリッジ |
|---|---|
| `describe`、`test(name, ($, on) => …)`、`expect`、`mock`、`tier` | このリポジトリ内では同じモジュール名が Vitest の上でそれらを提供する。`test` はテストファイルの場所から mod を推論し（`<mod>/tests/*.test.ts` → `<mod>/index.ts`）、`defineModTests` がそれを上書きする。外では `createModTestKit` と `mock` が `@deepseek-ai/dsh-experimental-claude-code-mods/testing` から来る |
| `on` がエンジンの答えをスタブする。キットは `ui.*` に自分で答える | 同じ。`ui.open` は `{ isPlaced: false }` を返し、`ui.invalidate` と `ui.close` は成功する。`session.cwd`、`process.run`、`fs.*`、`store.*`、`env.*` にはスタブが必要である（`mock.store`、`mock.env`、`mock.clock` は名前空間全体に答える） |
| `$.ui.mount({ plugin, surface, component, props })` → `find`、`findAll`、`press`、`unmount` | 同じ、加えて `tree()` と `text()`。すべての読み取りはロード済みのすべての mod のフックを通じて新しくレンダリングする。`plugin` と `surface` はソース互換のために受け入れられる |
| テスト内の 5 秒のフック予算 | 同じ（`budgetMs`） |

## 例の mods

| mod | ソース | このブリッジを通すと |
|---|---|---|
| Token Weather | 記事のモジュール、型契約、テストを変更なしで | 公開されたまま実行される。テストの 3 つの `as any` キャストは、キットが型付きであるため取り除かれている。トークンメーターを通じて `$.session.usage` からバンドに描画する |
| Blast Radius | 記事の `tool.call` フックを変更なしで。`classify`、`measure`、ツリーを記事の説明に合わせて完成させたもの | 実際の `sleep` ポーリングでコマンドを保持し、バンドにレポートを描画し（`isPlaced: false`）、Proceed または Cancel が決定する。Token Weather より前にロードすること |
| Replay Theater | 記事の 5 つのフックを変更なしで。`stepsFor`、diff、`openReplay`、ペイン、ヒントを完成させたもの | Edit と Write の呼び出しを記録し、ターンの後にバンドでヒントを出し、ペインが置かれないためバンド内で diff をステップ実行する |
| `diff`（[anthropics/claude-code](https://github.com/anthropics/claude-code/tree/main/mods/diff)、`52c7644` 時点で読んだもの） | TypeScript、約 570 ファイル、フックは `command.run`、`prompt.submit`、`session.start`、`tool.call`、`ui.close`、`ui.focus`、`ui.render`、`ui.scroll` | 実行不可: ペイン上の `$.settings.read`、`$.telemetry.*`、`$.session.messages`、`ui.focus` と `ui.scroll` イベント、置かれた `Pane` が必要である。読解による評価であり、リポジトリの条項はフィクスチャの複製を許していない |
| `agents-md`（同じリポジトリ） | フックは `agent.spawn`、`prompt.context`、`session.start`、`tool.call` | 実行不可: `prompt.context` と `agent.spawn` は発火せず、`$.fs.ancestors`、`$.telemetry.*` は提供されない |
| `sec-default`（同じリポジトリ） | フックは `tool.check`、`prompt.compose`、`settings.read`、`classic.*`、`plugin.register`、… | 実行不可: この Host が発火しないイベント上のマネージドティアポリシーである |
| `telemetry`（同じリポジトリ） | フックは `engine.create`、`telemetry.*`、`session.start`、`session.end`。`$.session.repo`、`$.settings.read` を呼ぶ | 実行不可: `telemetry.*` と `engine.create` は発火せず、2 つの `$` メンバーは提供されない |

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される（doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。`pnpm run gen-cordis-catalog` で再生成）。言語版はロケール固有の対訳ドキュメントパスだけが異なる。シグネチャーブロックは `ts cordis-catalog` フェンスを使い、元のソース JSDoc を保持する。ディスパッチモードは[入門](../cordis-primer.md#dispatch-modes)で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxclaudecodemods--claudecodemods"></a>

### `ctx.claudeCodeMods` — `ClaudeCodeMods`

ブリッジサービス: ロードされた mods、そのフック、およびそれらのイベントを発火するハーネスリスナー。mods は ClaudeCodeMods.add を通じて参加し、mod プラグインがマウントされると defineMod がそれを呼ぶ。Remote メソッドは、Client が各セッションのプロンプト上のバンドを描画し、そのボタンを押せるようにする。

```ts cordis-catalog
/**
 * Watch the band above the prompt of one session: the current drawing, then
 * every redraw, until the Client stops watching.
 * @param agent - the session's agent, resolved by the Gateway.
 * @param signal - carrier cancellation.
 * @returns the band's snapshots.
 */
@Remote({ mode: 'stream' }) watchBand(agent: Agent, signal: AbortSignal): AsyncIterable<SurfaceSnapshot>

/**
 * Press a button of the band's current drawing: runs the mod's `onPress` and redraws.
 * @param agent - the session's agent, resolved by the Gateway.
 * @param generation - the drawing the Client saw.
 * @param actionId - the button's action id in that drawing.
 * @returns the snapshot after the press.
 */
@Remote pressBand(agent: Agent, generation: number, actionId: string): Promise<SurfaceSnapshot>

/**
 * Load one mod beneath every mod loaded before it: run its `register`,
 * keep its hooks, and report which of its events this host never raises.
 * @param definition - the mod as its plugin defined it.
 * @returns the disposer that removes the mod's hooks, closes its timers, and releases its registrations.
 * @throws Error when the name is invalid or taken, or when `register` throws (Claude Code's `hooks module did not load` wording).
 */
async add(definition: ModDefinition): Promise<() => Promise<void>>
```

Types: [Agent](core.md)

Source: [`packages/experimental/claude-code-mods/src/index.ts`](../../packages/experimental/claude-code-mods/src/index.ts)
<!-- END GENERATED cordis-surface -->
