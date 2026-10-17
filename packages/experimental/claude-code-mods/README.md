---
description: "Claude Code mod を DSH プラグインとして実行する実験的ブリッジ: それらの register(on, options) フックがツール呼び出しをガードし、プロンプトを書き換え、コマンドとツールを追加し、プロンプトの上に描画する。mod をマウントするユーザーと、マッピングを拡張するメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-claude-code-mods

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

[Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview) をエージェント実行の中で動かす: mod の `register(on, options)` を `defineMod` でラップし、このブリッジの後ろでプラグインとしてマウントすると、そのフックがツール呼び出しをガードし、プロンプトを書き換え、コマンドとツールを追加し、セッションの事実を読み、同じ `$`、`e`、`next` チェーンを通じてプロンプトの上にバンドを描く。ブリッジは `dsh-working-directory` を必要とし、各 `$` 呼び出しは構成された harness サービスに乗る。これは alpha のインターフェース互換性デモンストレーションである。提供されないイベントはロード時に報告され、提供されない `$` メンバーはギャップを名指しして失敗し、[互換性ページ](../../../docs/subsystems/claude-code-mods.md)がすべての差分を列挙する。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と延期された作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

mod はプラグインである。`defineMod` は、`plugin.json` が持つであろう identity を伴う mod の `register` 関数を取り、`register` が受け取る `options` オブジェクトを config とし、指定した `userConfig` のデフォルトに重ねた Cordis プラグインを返す。まずブリッジをマウントし、次にチェーン順で mod をマウントする。

```ts
// mods/token-weather/index.ts — `register` is the mod's own hooks module (`./hooks/token-weather.mjs`).
import { defineMod, type ModOn } from '@deepseek-ai/dsh-experimental-claude-code-mods'

declare const register: (on: ModOn, options: Readonly<Record<string, unknown>>) => void

export default defineMod({ name: 'token-weather', version: '0.1.0', root: import.meta.dirname, register })
```

```yaml
- name: '@deepseek-ai/dsh-experimental-claude-code-mods'
- name: './mods/blast-radius/index.ts'
- name: './mods/token-weather/index.ts'
  config:
    history: 12
```

| ブリッジフィールド | デフォルト | 意味 |
|---|---|---|
| `hookTimeoutMs` | `10000` | イベントごとのフック自身の実行時間（Claude Code の制限）。`next` の中や `$` 呼び出しの中の時間はカウントされない |
| `catchTimeoutMs` | `1000` | `.catch` ハンドラーの実行時間 |
| `processTimeoutMs` | `30000` | `$.process.run` と `$.http.fetch` のデフォルトタイムアウト |
| `toolAliases` | — | 組み込みテーブルに追加される Claude Code ツール名 → harness ツール名のエントリー |
| `bandColumns` | `120` | プロンプト上のバンドが `ui.render` に `bodyColumns` と `viewport.columns` として報告する列数 |
| `bandRows` | `10` | バンドが `maxRows` として報告する行数 |

生成される[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-experimental-claude-code-mods)が、受け付けられるすべてのフィールドの網羅的なソースである。[examples](examples/) ディレクトリには、Anthropic の [Getting started with Claude Code mods](https://claude.dev/blog/getting-started-with-claude-code-mods/) の記事にある 3 つの mod が、`claude --plugin-dir` でも動くプラグインディレクトリとして入っている。Token Weather は公開されたモジュール、型、テストをそのままに、Blast Radius と Replay Theater は公開された断片から完成させた。[オプトイン overlay](cordis.source.patch.yml)は、ソース起動のためにブリッジ、3 つの mod、[Web バンド](../client-ui-claude-code-mods/README.md)を構成する。

Blast Radius の DSH ラッパーは、実行中の実行可能ファイルを使う Node タイマーサブプロセスを提供するため、その Proceed/Cancel の保留は Windows でも POSIX の `sleep` を必要としない。待機は依然として `$.process.run` を使い、これはフックの実行時間バジェットを一時停止し、イベントとともに子をキャンセルする。スタンドアロンの Claude Code hooks モジュールはデフォルトで `sleep 0.25` を使い、そのドライランコマンドも対応するホストユーティリティを必要とする。

### mod が受け取るイベント

| イベント | 発生元 | フックにできること |
|---|---|---|
| `session.start` | ルートエージェントの `agent/created`。最初のターンより前に await される。`cwd` は検証済みディレクトリを使い、永続化 resume も含む。作成のキャンセルは検証と待機中のフックを放棄する | 観測; コマンドとツールの登録 |
| `prompt.submit` | クレーム済みメッセージを持つ `agent/pre-step`。`e.text` は人間自身の（`user` 由来の）メッセージのテキストブロックを結合し、書き換えはそれらだけに触れる | `text` の書き換え、プロンプトの後ろへの型どおりの `context` ブロックの追加、またはプロンプトの `{ drop }` |
| `turn.start` | ターンの最初の `agent/pre-step` | 観測 |
| `tool.call` | harness の許可判断の後の `tools/execute` waterfall。mod が `$.tool.call` で発生させた呼び出しは、それより前にロードされた mod にのみ到達し、呼び出し元に帰属される | 前後の観測、`{ deny }`、`{ result }` での応答、または `next` の後の結果やその `isError` の書き換え |
| `turn.complete` | `turn/end` セッションイベント | 観測; ホストログの 1 行としての `{ text }` の返却 |
| `command.run` | mod が `$.command.register` で登録したコマンドが入力される | `{ text }` または `{}` での応答 |
| `ui.render` | プロンプト上のバンドが再描画される: `bodyColumns`、`hasSurvey`、`isWorking`、`maxRows` props を持つ `{ component: 'AbovePrompt' }` | `$.ui.resolve(e)` からの `Box`/`Text`/`Button` ツリーの返却、またはバンドを譲る `next(e)` |
| `session.end` | ルートエージェントの `agent/disposed`。`$.state` はフックが決着するまで読めるままである | 観測 |
| `<namespace>.<method>` | 後からロードされた mod の `$` 呼び出し（`tool.call` は代わりにツールパイプラインを通じて届く） | 観測、書き換え、または `{ deny }` |

`e.tool` と `tool` のマッチャーは、harness ツールに対応する名前が Claude Code にある場合はそれを使う（`Bash` ↔ `bash`、`Read` ↔ `read`、`Edit` ↔ `edit`、`Write` ↔ `write`、`Glob` ↔ `glob`、`Grep` ↔ `grep`、`WebFetch` ↔ `web_fetch`、`WebSearch` ↔ `web_search`、`Task` ↔ `subagent`、`TodoWrite` ↔ `todo_write`、`AskUserQuestion` ↔ `ask_user_question`、`ExitPlanMode` ↔ `exit_plan_mode`、`Skill` ↔ `skill`）。それ以外のツールは harness 名を保つ。サブエージェントのイベントは `e.agentId` を運ぶ。それ以外の Claude Code イベント名はエラーなく登録され、決して発火せず、mod のロード時に警告で名指しされる。

<a id="the-band-above-the-prompt"></a>
### プロンプト上のバンド

バンドはセッションごとに 1 インスタンスで、ロード順で最初にツリーを返す `ui.render` フックを持つ mod が描く。`next(e)` を呼ぶフックは次の mod に譲るため、何かを持っている間だけ描く mod（Blast Radius、Replay Theater）を、読み取りがあるたびに描く mod（Token Weather）より前に置く。バンドは `session.start` の後、直前の描画が読んだ `$.state` の値が書き込まれたとき、`$.ui.open`、`$.ui.close`、`$.ui.invalidate` の後、各 `tool.call` チェーンと `turn.complete` の決着後、そしてボタン押下後に再描画される。`Button` の `onPress` はホストに留まる。Web バンドは見た世代とともにクリックを送り返し、以前の描画へのクリックは報告されて無視される。`$.ui.open` は `{ isPlaced: false }` を返す。ペインは配置されず、バンドに縮退した mod はそこで描く。[テストキット](#test-a-mod)の `$.ui.mount` は Client なしで同じフックをレンダリングする。

### mod が呼べる `$` メンバー

| 名前空間 | 提供されるもの | 基盤 |
|---|---|---|
| `$.plugin` | `name`, `root` | `defineMod` の spec |
| `$.ui` | `resolve`, `invalidate`, `open`, `close`, `panes`, `log`, `toast`, `status`, `ask` | `resolve` は要素コンストラクターを配る。`invalidate`、`open`、`close` はバンドを再描画する。`ask` は `ctx.userQuestions` 上。`log`、`toast`、`status` はホストログに届く |
| `$.command` | `register`, `run`, `list` | `ctx.commands`、イベントが実行されているエージェントにスコープされる |
| `$.tool` | `register`, `call`, `list` | `ctx.tools`。登録されたツールは `mcp__<plugin>__<tool>` と名付けられる。ツールが次のリクエストに先送りするコンテキストはセッションに注入される |
| `$.prompt` | `submit` | `user` 由来のメッセージとしての `agent.followup()`。`asUser` でない限り mod からのメッセージとして組み立てられる。それが発生させる `prompt.submit` は `origin: { kind: 'plugin', name }` を運ぶ |
| `$.session` | `id`, `cwd`, `root`, `model`, `turns`, `messages`, `usage`, `version` | エージェントの Session と `turnBoundary`、`contextPressure` 射影。`cwd` は `ctx.workingDirectory` を通じてコミット済みの現在ディレクトリを報告する。`root` は元のプロジェクトを保つ |
| `$.state` | `get`, `set` | セッションのために保持されるメモリで、mod が名付ける `{ plugin, key }` でアドレス指定される。`ui.render` 中の読み取りはバンドをサブスクライブする |
| `$.store` | `get`, `set`, `delete`, `keys` | `claude_code_mods` ストレージドメイン。プラグインごとに 1 つの JSON オブジェクト、4 MiB |
| `$.clock` | `now`, `sleep`, `after`, `every` | イベントをスケジュールしたセッションが所有するタイマー。イベントがキャンセルされると `sleep` はリジェクトする |
| `$.fs` | `read`, `write`, `list`, `exists`, `stat` | `ctx.fs`。検証済みの現在の Session ディレクトリに対する相対パス、ファイルごとに 4 MiB |
| `$.process` | `run` | `ctx.subprocess`、シェルなしの argv。`init.cwd` が指定されない限り、新しいプロセスは検証済みの現在の Session ディレクトリをデフォルトにする |
| `$.http` | `fetch` | プロセスの `fetch`、ボディは最大 4 MiB |
| `$.env` | `get`, `set` | このプロセスの環境。すべてのセッションとプラグインで共有される |

サービスが構成されていない呼び出しは、欠けているサービスのパッケージ名でリジェクトする。この表にない名前空間やメソッドは `no implementation for <namespace>.<method>` でリジェクトする。mod はこのプロセス内で完全な権限で動作する。`$.env` は harness 環境を読み書きし、`$.http.fetch` は任意の URL に到達し、`$.fs` と `$.tool.call` はセッションと同じように振る舞う。

<a id="test-a-mod"></a>
### mod をテストする

`@deepseek-ai/dsh-experimental-claude-code-mods/testing` の `createModTestKit` は、`defineMod` プラグインまたは生の定義をロードし、その下にスタブを置いてイベントを発生させる。形は `claude-code/testing` に合わせている。`kit.on('tool.call', () => ({ result: 'ok' }))` はエンジンの代わりに応答し、`kit.$.tool.call({ tool: 'Bash', command: 'ls' })` はイベントを発生させ、`kit.$.ui.mount({ component: 'AbovePrompt' })` はバンドをレンダリングしてその要素を見つけるか押し、`mock.store(kit.on)` はメモリから `$.store` に応答する。このリポジトリ内では、`claude-code/testing` はキットと Vitest の `describe`、`test`、`expect` に解決されるため、[example mod のテスト](examples/token-weather/tests/token-weather.test.ts)は `claude plugin test` 用に書かれたまま実行できる。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

### ロード

[`define-mod.ts`](src/define-mod.ts) は spec を Cordis プラグインに変換し、マウント時に `ctx.claudeCodeMods.add(definition)` を呼び、アンマウント時に mod を削除する。[`module.ts`](src/module.ts) は `register` を実行し、各 `on(...)` を `HookRegistry` に収集する。`on` は未知のイベント名と、1 つのイベントの 2 回目のマッチャーなし登録を Claude Code の文言で拒否し、スローする `register` は mod プラグインのマウントを失敗させる。mod の順序はマウント順であるため、cordis.yml の順序がチェーンの順序になる。

### チェーン

[`chain.ts`](src/chain.ts) は 1 つのイベントを選択されたフックに、最も外側から順に、エンジンの動作を最下層にして実行する。各フックの `next` は下へ 1 回だけ委譲する。2 回目の呼び出しは最初の実行を返し、フックが開始した実行はフック自身の応答が決着する前に await される。スローする、タイムアウトする、または結果なしで決着するフックはスキップされ、失敗の種類ごとに 1 回報告される。すでに `next` を呼んでいた場合は下からの結果がそのまま立ち、`.catch` ハンドラーがその代わりに応答してよい。バジェットクロックはフック自身の実行時間だけを数える。`next` の中と、`$.clock.sleep` を除くすべての `$` 呼び出しの中で一時停止する。[`engine.ts`](src/engine.ts) はレジストリ、セッションごとの `$.state`、セッションと mod でキー付けされたタイマー、および 2 つのディスパッチ方向を所有する。エンジンイベントは選択されたすべてのフックに到達し、1 つの mod が発生させた `$` 呼び出しはそれより前にロードされた mod にのみ到達する。

### harness へのマッピング

[`index.ts`](src/index.ts) がリスナーを登録する。`tool.call` は `tools/execute` の周りで実行されるため、harness の許可判断がチェーンに先行する。`{ deny }` は理由付きのエラー結果になり、`{ result }` はツールが mod 登録済みか値がツールの出力スキーマを満たす場合は成功結果に、それ以外はエラー形状の結果になる。`next` の後にフックが書き換えた結果は、`tools/post-execute` を通じて置換コンテンツとしてインストールされる。書き換えた引数を `next` に渡すフックは、呼び出しの引数がすでにログ済みであるため、報告付きでスキップされる。[`host-ops.ts`](src/host-ops.ts) は `ctx.get(...)` サービス上の各 `$` 呼び出しのエンジン動作を保持する。ディレクトリのオーナーは必須で、他のサービスは要求に応じて読まれる。[`surfaces.ts`](src/surfaces.ts) はセッションごとに 1 つのバンドを保つ。`ui.render` を発生させ、[`elements.ts`](src/elements.ts) でツリーを検証・シリアライズし、各 `Button` の `onPress` を描画ごとのアクション id の背後に保持し、描画が読んだ `$.state` スロットにバンドをサブスクライブし、`claudeCodeMods` Remote（`watchBand`、`pressBand`）を通じて世代を Client にストリームする。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | ブリッジサービス: config、mod レジストリ、拡張ポイントリスナー、Remote |
| [`src/define-mod.ts`](src/define-mod.ts) | `defineMod`: プラグインとしての mod |
| [`src/host-ops.ts`](src/host-ops.ts) | harness サービス上の `$` 動作 |
| [`src/surfaces.ts`](src/surfaces.ts), [`src/elements.ts`](src/elements.ts) | プロンプト上のバンド。要素コンストラクター、検証、シリアライズ |
| [`src/engine.ts`](src/engine.ts) | レジストリ、`$.state`、タイマー、ディスパッチ方向 |
| [`src/chain.ts`](src/chain.ts) | ミドルウェアチェーン、バジェットクロック、失敗ルール |
| [`src/api.ts`](src/api.ts) | フックが受け取る `$` オブジェクト |
| [`src/module.ts`](src/module.ts), [`src/matcher.ts`](src/matcher.ts), [`src/tool-names.ts`](src/tool-names.ts) | `register` と `on`。イベント名、マッチャー、ツール名エイリアス |
| [`src/testing.ts`](src/testing.ts) | テストキット (`./testing`) |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [Claude Code mod との互換性](../../../docs/subsystems/claude-code-mods.md) — このブリッジが Claude Code mod と異なるすべての点と、その修正または理由。
- [Claude Code mod リファレンス](https://code.claude.com/docs/en/plugins/mods/reference) — このブリッジが写し取るイベント、メソッド、制限。
- [Web バンド](../client-ui-claude-code-mods/README.md) — 入力ドックに `ui.render` ツリーを描く Client パッケージ。
- [実験的パッケージ](../README.md) — 公開ポリシーと依存関係の分離。
- [Claude Code hook ブリッジ](../hooks-claude-code/README.md) — settings フックのブリッジ。プラグインの `hooks.json` settings フックには `dsh-hooks-claude-code` が必要。
- [ツール実行パイプライン](../../../docs/tool-execution-pipeline.md) — `tool.call` が周りを実行する waterfall。
- [ヒューマンコマンド](../../interaction/commands/README.md) — `$.command.register` が着地するレジストリ。

-----

<a id="model-experience"></a>
## モデル体験

### プロンプトコンテキストと送信されるプロンプト

#### モデルが見るもの

`prompt.submit` フックが `e.context` に追加する文字列は、人間自身のメッセージの中で、プロンプトの後ろに型どおりのテキストブロックになる。書き換えられた `text` はプロンプトのテキストブロックを置き換える。`$.prompt.submit({ text })` は `user` 由来のメッセージをキューに入れる。`asUser: true` ならテキストのみ、それ以外は以下に示すようにプラグイン名とともに組み立てられ、テキストが埋め込まれる。

##### mod が送信するプロンプトの組み立て方

```markdown
Message from the "<plugin>" mod:
<text>
```

#### トークンへの影響

mod がコンテキストを追加するかプロンプトを送信するまでコストはない。そのテキストはデータ依存であり、ログに記録され、コンパクションまで以降のリクエストで再送される。

#### KV キャッシュへの影響

追記のみ。追加されたコンテキストと送信されたプロンプトは再利用可能なリクエストプレフィックスに続き、既存のエントリーを無効化しない。

### mod が決めるツールの結果

#### モデルが見るもの

`{ deny: reason }` の応答はツール結果として `Error: <reason>` を描画する。`{ result }` の応答は、ツールが mod 登録済みか値がツールの出力スキーマを満たす場合はツール自身のプレゼンターを通じて描画され、それ以外はテキストを運ぶエラー形状の結果として描画される。`next` の後に書き換えられた結果はツールのコンテンツテキストを置き換える。ドロップされたプロンプトは、モデルに見えるメッセージなしでターンを `blocked` として終了する。`tool.call` を保留する mod（Blast Radius）はボタンが決定するまで結果を遅延させ、モデルは結果だけを見る。

#### トークンへの影響

拒否と応答済みの呼び出しはツール自身の出力を mod のテキストで置き換える。ドロップされたプロンプトはリクエストを送信しない。

#### KV キャッシュへの影響

ツール結果は再利用可能なプレフィックスの後に追記される。ドロップされたプロンプトは何も無効化しない。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>

これらの制限は、Claude Code mod がこのブリッジを通じて異なる振る舞いをする箇所を記述する。[互換性ページ](../../../docs/subsystems/claude-code-mods.md)が完全なリストである。これらは現在のパッケージ制約であり、タスクバックログではない。

- **描画サーフェスは 1 つ** — `AbovePrompt` は提供される。`Pane`、その他のレンダーサイト、`Input`、ホットキー、`ui.press`、`ui.input`、`ui.select`、`ui.focus`、`ui.scroll` は提供されない。`$.ui.open` は `{ isPlaced: false }` を返し、`$.ui.log`、`$.ui.toast`、`$.ui.status` は GUI ではなくホストログに届く。フックは `bandColumns` 幅のバンドに描き、Web バンドは折り返す。ボタンの `onPress` は時間制限なしで実行され、ハングしたものは決着するまでバンドのボタンを無効のままにする。
- **`next` は 1 回だけ実行される** — `next` を 2 回呼ぶフックは最初の実行を得る。Claude Code は下のチェーンを再実行する。`next` がまだ実行中に応答するフックはその実行を待つ。
- **提供されないイベント** — `tool.check`、`tool.describe`、`turn.step`、その他の `prompt.*` イベント、`command.describe`、`config.*`、`session.compact`、`session.receive`、`session.send`、`session.append`、`session.attach`、`session.detach`、`session.measure`、`agent.*`、`plugin.register`、`engine.create`、`telemetry.*` は登録され、決して発火せず、ロード時の警告で名指しされる。`classic.*` 名は他の未知のイベントと同様に `register` で拒否される。
- **提供されない `$` 名前空間** — `$.model`、`$.agent`、`$.config`、`$.settings`、`$.mcp`、`$.audio`、`$.telemetry`、`$.turn`、`$.ui.notice`、`$.ui.blit`、`$.ui.copy`、`$.fs.ancestors`、`$.process.spawn`、および `$.session.repo`、`send`、`append`、`authorize`、`compact`、`surfaces` は `no implementation` でリジェクトする。`$.model.complete` はログ記録されたサイドリクエストイベントを待つため、mod のモデル呼び出しは Session ログから再構築可能なままでいられる。
- **`tool.call` は許可判断の後に実行される** — Claude Code は mod の `tool.call` フックを許可チェックの前に実行するが、ここでは harness の `tools/pre-execute` waterfall（承認を含む）が先に決着する。`next` に渡す引数を書き換えたり、別のツールを名指ししたりするフックは報告付きでスキップされる（引数のケースは[プリツール入力書き換え提案](../../../.agents/notes/proposed/feature/2026-06-30-pre-tool-input-rewrite.md)を名指しする）。ログ済みの呼び出しはログどおりに実行されるためである。
- **1 プロセス、多数のセッション** — mod のモジュールレベル変数と `$.env.set` の書き込みは、プロセス内のすべてのセッションとプラグインで共有される。Claude Code ではプロセスごとに 1 セッションである。セッションごとの値は `$.state` に保つ。`session.start` と `session.end` はルートエージェントにのみ発火する。
- **サンドボックスなし、静的解析なし、ホットリロードなし** — フックモジュールは Node のグローバルとプロセスの完全な権限（環境、ネットワーク、ファイルシステム、ツール）でインプロセス実行される。`$` のみのアクセスルール、`claude plugin validate`、型生成、`--plugin-dir` の監視、セッション内 mod オーサリングフローは実装されていない。プラグインとして実行する mod だけをマウントすること。mod を再度マウントすると、同じ評価済みモジュール上で `register` が再実行されるため、モジュールレベル変数は値を保つ。
- **`turn.complete` のテキスト** — フックが返す `{ text }` は、回答の下の行ではなくホストログに届く。`durationMs` はターンの `turn/start` から数える。
- **`$.session.usage`** — ルートのコンテキストウィンドウとプロバイダーの使用量レポートがトークンメーターを通じて判明するまで、`window` は `0` で `percent` は存在しない。`rateLimits` は常に空である。`$.fs.stat` は `mtimeMs: 0` を報告する。
- **`plugin.json` と `hooks.json`** — 読まれない。`defineMod` が identity を運び、プラグインの settings フックには `@deepseek-ai/dsh-hooks-claude-code` が必要である。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

次のステップを、mod 作者にとっての価値の順に示す。Web GUI のドッキングされた `Pane`（`TextInput`、ホットキー、toast、status、log サーフェス付き）、ログ記録されたリクエストイベントを伴う `ctx.llm` 上の `$.model.complete`、そして `anthropics/claude-code/mods` の公式 mod を、ライセンスがフィクスチャを許可し次第、読み取りによって実行すること。

</details>
