---
description: "既存の Claude Code hooks.json または settings のフック設定をエージェント実行中に実行する — プロンプトとツールをブロックし、コンテキストを付加し、継続を強制する — ブリッジのユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-hooks-claude-code

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-hooks-claude-code` は既存の Claude Code `hooks.json` または設定ファイルのコマンドフックを、書き換えなしでエージェント実行中に実行する。対応フックは、セッション、プロンプト、ツール、停止、サブエージェントが該当する瞬間に達したときに実行できる。モデル可視の理由でプロンプトまたはツール呼び出しをブロックし、会話コンテキストを追加し、または別のモデルターンを強制できる。Claude Code のコマンドフックをハーネスで再利用したい場合にこのパッケージを選ぶ。Claude Code に対応物がない振る舞いにはネイティブプラグインを使う。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

フックプロセスとそのペイロードの `cwd` は、各フックポイントの開始時に Session の現在の作業ディレクトリを使う。`CLAUDE_PROJECT_DIR` は `projectDir` が構成されていない限りそれに従う。`SubagentStop` は破棄後に子の最終コミットディレクトリを読む。ディレクトリの欠落を復元したりその Session を変更したりはできず、失敗した stop フックは警告される。

このパッケージをマウントし、`configPath` をフック設定に向けると、既にあるフックがエージェント実行の対応する瞬間に発火し始める。最初のフックが動く前に他に設定することは何もない。

### いつ選ぶか

Claude Code の `hooks.json`（または `hooks` キーに設定を持つ設定ファイル）を所有し、そのコマンドフックがプロンプト、ツール、ターンをゲートすべきときに使う。Claude Code に対応物がない振る舞いには使わない: ネイティブプラグインは完全なハーネス API を持つが、このブリッジは参照ツールのコマンドフックサブセットのみを実行する。

### 最小の動作するセットアップ

```yaml
- name: '@deepseek-ai/dsh-hooks-claude-code'
  config:
    configPath: ./.claude/hooks.json
    pluginRoot: ./.claude/plugins/my-plugin
    projectDir: .
```

| フィールド | 既定値 | 意味 |
|---|---|---|
| `configPath` | 必須 | `hooks.json` または `hooks` キーに設定を持つ設定ファイルへのパス |
| `pluginRoot` | — | コマンド文字列中の `${CLAUDE_PLUGIN_ROOT}` を置換する |
| `projectDir` | セッションワークスペース | `${CLAUDE_PROJECT_DIR}` を置換し、`CLAUDE_PROJECT_DIR` 環境変数を設定する |
| `defaultTimeoutMs` | `600,000` | フックが指定しない場合のフックごとのタイムアウト（Claude Code の既定値） |
| `stderrSummaryMaxChars` | `500` | 永続化される `hook/result` stderr サマリーの文字数上限 |

生成された[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-hooks-claude-code)が、受け入れられるすべてのフィールドの網羅的な情報源である。

### フックでできること

| 対象フック | 実行されるタイミング | できること |
|---|---|---|
| `SessionStart` | セッション開始時 | そのセッションでモデルが見るコンテキストを付加する |
| `UserPromptSubmit` | エージェントがプロンプトを受け取ったとき | プロンプトをブロックする、または追加コンテキストを付加する |
| `PreToolUse` | ツール実行前 | ツールをブロックする、または実行前の承認を求める |
| `PostToolUse` | ツール実行後 | フィードバックと共に結果をブロックする、または追加コンテキストを付加する |
| `Stop` | 実行が停止しようとするとき | 理由と共に別のステップを強制する |
| `SubagentStart` | サブエージェント開始時 | まだ実行中のサブエージェントにコンテキストを付加する（インプロセスのみ） |
| `SubagentStop` | サブエージェント終了時 | 観察のみ — ブロックもコンテキスト追加もできない |

### フックの実行と失敗

- フックはエージェントの現在の Session ディレクトリで実行される。`pwd`、ペイロードの `cwd`、相対パスが一致する。
- コマンド文字列中の `${CLAUDE_PLUGIN_ROOT}` と `${CLAUDE_PROJECT_DIR}` は config から置換され、`CLAUDE_PROJECT_DIR` はすべてのフックプロセスに設定される。
- 1 つの config がプロセス全体に適用される: 起動時に一度読まれ、相対 `configPath` はプロセスを起動したディレクトリから解決される。
- 同じイベントのフックは config 順に 1 つずつ実行される。
- config が読めないまたは解析できない場合、ブリッジは警告をログし、フックを実行しない — エージェントはそれでも起動する。
- 実行に失敗したフック（不正なコマンドやクラッシュ）はログされ、エージェントは続行する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションではブリッジ背後の設計判断とそれを実現するコードを説明する。観察可能な振る舞いは[このパッケージを使う](#use-this-package)で完全にカバーされている。

### フックポイントのマッピング

各対応イベントは 1 つのハーネス拡張ポイントにプログラムされる: `SessionStart` は最初のターン前に待機される `agent/created` 初期化を通してコンテキストを追加し、`UserPromptSubmit` と `PreToolUse` は入ってくるアクションを拒否できる waterfall (`agent/pre-step`、`tools/pre-execute`) であり、`PostToolUse` はフィードバックでブロックしまたは下流の決定にコンテキストを追加できる waterfall (`tools/post-execute`) であり、`Stop` はブロック結果が `steer()` を通じて別のステップを強制するシリアルリスナー (`agent/turn-stopping`) である。2 つのサブエージェントイベントは子ライフサイクル (`subagent/start`、`subagent/end`) に emit する: start はライブのインプロセス子にコンテキストを注入し、stop は観察のみを行う。コンテキストのみのフックは常に `next()` 経由で委譲してからソース付きメッセージを下流の決定に畳み込むため、後続のリスナーは依然として拒否または書き換えできる。ブロック決定は `deny` にマップされる（`PreToolUse` では `ask`）。イベントごとの結線は [`src/index.ts`](src/index.ts) にある。

### ペイロードと環境

ブリッジは各イベントの stdin ペイロードを `session_id`、文字列の `transcript_path`、`cwd`、`hook_event_name` のベースとイベントごとのフィールドから構築する。`transcript_path` は互換性のためにペイロードに残るが常に `''` である: 永続化シームはアーティファクトパスを公開せず、既定の Zstandard 圧縮 Session ログはフックスクリプトから読めない。`CLAUDE_PROJECT_DIR` は `projectDir` が省略された場合、実行ごとに既定でセッションワークスペースになり、フックが実行されるディレクトリと一致する。`${CLAUDE_PLUGIN_ROOT}` と `${CLAUDE_PROJECT_DIR}` の置換は config 解析時に行われる。

### マッチャー対象とシリアル実行

マッチャー対象はツール名 (`PreToolUse` / `PostToolUse`)、セッションソース (`SessionStart`)、または定数 `agent_type` の `general-purpose` (`SubagentStart` / `SubagentStop` — サブエージェントシームは種類ごとのラベルを持たない) である。`UserPromptSubmit` と `Stop` はマッチャーを無視する。マッチしたフックは config 順にシリアル実行され、各フックの `hook/invoked` / `hook/result` ペアがログ内で隣接し続け、最も制限的な畳み込みは順序非依存である (`deny > ask > allow`)。

### デタッチ実行と破棄

3 つの emit ポイント (`SessionStart`、`SubagentStart`、`SubagentStop`) はデタッチで実行される — どの拡張ポイントもそれらを待たない。各実行チェーンは追跡され、ブリッジの破棄はまだ実行中のフックプロセスを中断し、dispose が解決する前に継続をドレインする（`dsh-hook-protocol` の `createDetachedRuns`）。

### 設計哲学

- **互換アダプターであり、パワーツールではない。** ブリッジは既存の Claude Code config の明示的にサポートされるコマンドフックサブセットを実行するために存在する。特注の振る舞いは同じ拡張ポイント上のネイティブプラグインに属する。
- **コンテキスト追加は拒否権ではない。** コンテキストのみのフックは `next()` 経由で委譲してからそのメッセージを下流の enter 決定に畳み込むため、後続の `agent/pre-step` または `tools/post-execute` リスナーは依然として拒否または書き換えできる。
- **あらゆる失敗での封じ込め。** config の読み取り/解析失敗と無効なマッチャーは何も登録しない。throw するデタッチ注入は捕捉されログされ、セッション起動やループを壊さない。
- **dispose は静止に到達する。** デタッチ実行は追跡され破棄時にドレインされるため、どのフックプロセスや遅延コールバックもファイバーより長生きしない。
- **並行ではなくシリアル。** マッチしたフックは config 順にシリアル実行される: 各 `hook/invoked` / `hook/result` ペアはログ内で隣接し続け、決定の畳み込みは順序非依存であるため、結果はレイテンシの直列化と引き換えに参照エンジンの並行起動と一致する。

[hook-bridges Agent Note](../../../.agents/notes/archived/feature/2026-06-30-hook-bridges.md) がブリッジ設計と先送りされたギャップを記録し、[hook-protocol-lib Agent Note](../../../.agents/notes/archived/feature/2026-06-30-hook-protocol-lib.md) が共有対ダイアレクト別の分割を記録する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: config 検証、リスナー登録、イベントごとのペイロード、決定マッピング |
| [`src/config.ts`](src/config.ts) | Claude Code config 解析: 対応イベント、マッチャー検証、コマンド置換 |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの規約で足りないときにこれらのページを読む。共有プロトコルからブリッジ設計、そしてそれがプログラムする拡張ポイントへと進む。

- [Hooks グループマップ](../README.md) — 兄弟グループページとそのパッケージテーブル。
- [フックプロトコルライブラリ](../hook-protocol/README.md) — このブリッジが適用する共有フックルール。
- [フックブリッジ Agent Note](../../../.agents/notes/archived/feature/2026-06-30-hook-bridges.md) — ブリッジ設計、決定マッピング、先送りされたギャップ。
- [傍受拡張ポイント参照](../../../docs/tool-execution-pipeline.md) — ブリッジがマップする typed-Decision サーフェス。
- [生成された設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-hooks-claude-code) — 受け入れられるすべての config フィールドとそのソース宣言。

-----

<a id="model-experience"></a>
## モデル体験

### フック提供のコンテキスト

#### モデルが見るもの

`SessionStart`、受け入れられたプロンプト、ツール後、およびライブのインプロセス subagent-start フックはソース属性付きコンテキストメッセージを追加できる。ブロックする `Stop` フックはその理由を次ステップのステアリングとして追加する。リモート子への注入にはローカルターゲットがない。

#### トークン効果

フックがコンテキストを返さない場合はコストなし。フックテキストはデータ依存であり、ログされ、コンパクションまで後の会話リクエストで再送される。

#### KV キャッシュ効果

追加のみ。新たに見える内容は再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しない。

### ブロックされたプロンプトまたはツールの結果

#### モデルが見るもの

プロバイダーが供給する理由はそのまま通る。ない場合、拒否されたツールは `Error: blocked by PreToolUse hook` になり、ブロックされたツール後フィードバックは正確に `blocked by PostToolUse hook`、ブロックする stop は正確に `continue: blocked by Stop hook` のステアリングを追加する。ブロックされたプロンプトはモデル可視メッセージなしで破棄され、ターンが `blocked` として終了する。`systemMessage` と `updatedInput` はログまたは警告されるが、この実装ではモデル可視ではない。

#### トークン効果

プロンプトのブロックはそのプロンプトのリクエストトークンを除去する。拒否またはフィードバックは保持されたフォールバックまたはプロバイダーテキストを追加する。強制継続はもう 1 回の完全なリクエストを支払う。

#### KV キャッシュ効果

ブロックされたプロンプトはリクエストを送らず何も無効化しない。拒否、フィードバック、強制継続コンテキストは再利用可能なプレフィックスの後に追加され、それを書き換えない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、あなたの Claude Code フックがこのブリッジを通してまだできないこと、および参照ツールとの振る舞いの違いを説明する。これらは現在のパッケージ制約であり、タスクバックログではない。

- **未対応のフックイベント（Claude Code の現在の 30 のうち 23）** — `Setup`、`InstructionsLoaded`、`UserPromptExpansion`、`MessageDisplay`、`PermissionRequest`、`PostToolUseFailure`、`PostToolBatch`、`PermissionDenied`、`Notification`、`TaskCreated`、`TaskCompleted`、`StopFailure`、`TeammateIdle`、`ConfigChange`、`CwdChanged`、`FileChanged`、`WorktreeCreate`、`WorktreeRemove`、`PreCompact`、`PostCompact`、`SessionEnd`、`Elicitation`、`ElicitationResult`。これらのイベントの config はグループ解析の前に無視されるため、未対応イベントがフックを無効化したり登録したりすることはない。比較基準は Claude Code の[公式フックイベントリファレンス](https://code.claude.com/docs/en/hooks#hook-events)。
- **`SessionStart` は部分的** — JSON の `additionalContext` は消費されるが、素の stdout コンテキスト、`initialUserMessage`、`sessionTitle`、`watchPaths`、`reloadSkills`、`CLAUDE_ENV_FILE` は未対応。フックはデタッチで実行されるため、コンテキストが最初のリクエストを逃すことがあり、ペイロードは `model`、`agent_type`、`session_title` のようなオプションフィールドを省略する。
- **`UserPromptSubmit` は部分的** — ブロッキングと JSON `additionalContext` は動作するが、素の stdout コンテキスト、`sessionTitle`、`suppressOriginalPrompt` は未対応。上書きしない限り、ブリッジは Claude Code のイベント固有 30 秒コマンドタイムアウトの代わりに 600 秒の既定値も使う。
- **`PreToolUse` は部分的** — `deny` と `ask` 決定は動作する。`allow` は事前承認しない、`defer` は未対応、`additionalContext` は無視され、`updatedInput` はログ＋警告されるが尊重されない（[pre-tool-input-rewrite Agent Note](../../../.agents/notes/proposed/feature/2026-06-30-pre-tool-input-rewrite.md)）。
- **`PostToolUse` は部分的** — ブロッキングフィードバックと JSON `additionalContext` は動作するが、`updatedToolOutput` と `updatedMCPToolOutput` は未対応で、`tool_response` はテキストに平坦化される。
- **`SubagentStart` と `SubagentStop` は部分的** — どちらも定数 `agent_type` の `general-purpose` を報告し、Claude Code が親セッションを報告する場所で子セッション id を使う。start コンテキストはベストエフォートでライブのインプロセス子にのみ到達できる。stop は観察のみでサブエージェントをブロックしたりコンテキストを供給したりできない。stop は `agent_transcript_path`、`last_assistant_message`、`background_tasks`、`session_crons` を省略し、常に `stop_hook_active: false` を報告する。
- **`Stop` は部分的** — ブロッキングは別のモデルターンを強制するが、`stop_hook_active` は常に `false` で、`last_assistant_message`、`background_tasks`、`session_crons` は省略され、連続ブロック上限は実装されていない。したがって無条件にブロックするフックは、自己制限しない限りすべてのステップを強制継続する。
- **共通ペイロードと出力フィールドは部分的** — マップされたイベントペイロードは Claude Code が提供する `prompt_id`、`permission_mode`、`effort` を省略し、`transcript_path` は決して埋められない: 常に空文字列である。永続化シームがアーティファクトパスを公開せず、既定の Zstandard 圧縮セッションログがフックスクリプトから読めないためである。`systemMessage` はログ＋警告されるが表面化されない。`{"continue": false}` は記録されるが実行を停止しない。`suppressOutput`、`stopReason`、`terminalSequence` は適用されない。
- **ハンドラーと config サポートは部分的** — shell 形式のコマンドハンドラーのみ実行される。`http`、`mcp_tool`、`prompt`、`agent` ハンドラーはスキップされる。`args`、`async`、`asyncRewake`、`shell`、`if`、`once`、`statusMessage` のようなコマンドハンドラーオプションは尊重されない。マッチしたハンドラーはシリアル実行され重複排除されないが、Claude Code は並行実行し同一ハンドラーを重複排除する。1 つのプロセスレベルの `configPath` がロード時に一度解析される。Claude Code の階層的な project、user、plugin、policy 探索とライブリロードは実装されていない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発者ノートはメンテナー向けの作業コンテキストである: 未決定の問いと方向性。明示的に非権威である — 出荷された振る舞い、制限、受け入れられた根拠は上のセクション、パッケージコード、リンクされた Agent Note にある。

上の先送りされたギャップが作業キューである: セッションごとのフック config 探索、session-start 配信ゲート、stop ループガード、`continue: false` の実行レベル停止。いずれもまだ設計がない。公式 Claude Code リファレンスがそれらを閉じるための基準である。

</details>
