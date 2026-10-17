---
description: "既存の Codex hooks.json フック設定をエージェント実行中に実行します — プロンプトやツールをブロックし、コンテキストを添付し、継続を強制します — ブリッジのユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-hooks-codex

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-hooks-codex` は、既存の Codex `hooks.json` のコマンドフックをエージェント実行中に実行するため、プロンプトとツールのゲートが書き直しなしで機能します。5 つの Codex フックポイントをサポートします。セッション開始、プロンプト送信、ツール実行の前後、停止です。フックはモデル可視の理由でプロンプトやツール呼び出しをブロックし、会話コンテキストを追加し、別のエージェントステップを強制できます。harness で Codex コマンドフックを再利用する場合はこのパッケージを選び、このサポート対象サブセット外の動作にはネイティブプラグインを使用してください。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送りされた作業](#known-limitations-and-deferred-work)
- [開発ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

フックプロセスとそのペイロードの `cwd` は、各フックポイントの開始時にセッションの現在の作業ディレクトリを使用します。

このパッケージをマウントし、`configPath` を既存の `hooks.json` に向けると、すでにあるフックがエージェント実行の対応するタイミングで発火し始めます。最初のフックが機能する前に他に設定するものはありません。

### いつ選択するか

Codex の `hooks.json` を所有していて、そのコマンドフックでプロンプト、ツール、ターンをゲートしたい場合に使用します。Codex に相当するものがない動作には使わないでください。ネイティブプラグインは完全な harness API を持ち、このブリッジは参照ツールのコマンドフックサブセットのみを実行します。

### 最小の動作構成

```yaml
- name: '@deepseek-ai/dsh-hooks-codex'
  config:
    configPath: ./.codex/hooks.json
    model: deepseek-v4
```

| フィールド | デフォルト | 意味 |
|---|---|---|
| `configPath` | 必須 | Codex `hooks.json` へのパス |
| `model` | `''` | すべてのペイロードに刻印されるモデル名（Codex は各イベントに `model` を含めます） |
| `defaultTimeoutMs` | `600,000` | フックがタイムアウトを設定しない場合のフックごとのタイムアウト（Codex のデフォルト） |
| `stderrSummaryMaxChars` | `500` | 永続化される `hook/result` stderr サマリーの文字数上限 |

生成される [設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-hooks-codex) が、受け付けられるすべてのフィールドの網羅的な情報源です。

### フックにできること

| フック | 実行されるタイミング | できること |
|---|---|---|
| `SessionStart` | セッションが開始するとき | そのセッションでモデルが見るコンテキストを添付します |
| `UserPromptSubmit` | エージェントがプロンプトを受け取るとき | プロンプトをブロックするか、追加コンテキストを添付します |
| `PreToolUse` | ツールが実行される前 | ツールをブロックします |
| `PostToolUse` | ツールが実行された後 | フィードバック付きで結果をブロックするか、追加コンテキストを添付します |
| `Stop` | 実行が停止しようとしているとき | 理由とともに別のステップを強制します |

### フックの実行と失敗

- フックはエージェントの現在のセッションディレクトリで実行され、`pwd`、ペイロードの `cwd`、相対パスは一致します。
- 1 つの設定がプロセス全体に適用されます。起動時に 1 回読み取られ、相対 `configPath` はプロセスを起動したディレクトリから解決されます。
- 実行されるのは同期コマンドフックのみです。`async: true` やコマンド以外のフックは警告付きでスキップされます。
- 同じイベントのフックは設定順に次々と実行されます。
- 設定を読み取れないか解析できない場合、ブリッジは警告をログし、フックを実行しません — それでもエージェントは起動します。
- 実行に失敗したフック（不正なコマンドやクラッシュ）はログされ、エージェントは続行します。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションではブリッジの背後にある設計判断を説明し、それを実現するコードを示します。観測可能な動作は [このパッケージを使う](#use-this-package) で完全に説明されています。

### フックポイントのマッピング

サポートされる各イベントは 1 つの harness 拡張ポイントに対してプログラムされます。`SessionStart` は最初のターンの前に待機される `agent/created` 初期化を通じてコンテキストを追加し、`UserPromptSubmit` と `PreToolUse` は受信アクションを拒否できる waterfall（`agent/pre-step`、`tools/pre-execute`）です。`PostToolUse` はフィードバックでブロックしたり、下流の決定（`tools/post-execute`）にコンテキストを追加できる waterfall で、`Stop` はブロック結果が `steer()`（`agent/turn-stopping`）を通じて別のステップを強制するシリアルリスナーです。コンテキスト専用のフックは、ソース付きメッセージを下流の決定に畳み込む前に常に `next()` 経由で委譲するため、後のリスナーも依然として拒否や書き換えができます。ブロックする決定は `deny` にマップされます（`PreToolUse` には `allow` や `ask` がありません）。イベントごとの配線は [`src/index.ts`](src/index.ts) にあります。

### ペイロードと環境

ペイロードは Codex の形です。ターンスコープのイベントでは `turn_id` を持つ snake_case、すべてのイベントで `model` と `permission_mode: "default"`、stdin は末尾の改行なしで書き込まれます。ツール呼び出しのペイロードは実際の `tool_name` と `tool_input: { command }` の形（存在する場合は `command` 引数、なければ `''`）を運ぶため、シェル以外のツール引数は忠実に公開されません。基本ペイロードは `session_id` と `transcript_path` を運びます。後者は Codex の `string | null` の形を保ちますが常に `null` です — 永続化シームは成果物パスを公開せず、デフォルトの zstd セッションログはフックスクリプトから読み取れません。Codex はコマンド置換を行わず、プラグイン環境も注入しません。

### マッチャーの対象と直列実行

マッチャーの対象はツール名（`PreToolUse` / `PostToolUse`）またはセッションソース（`SessionStart`）です。`UserPromptSubmit` と `Stop` はマッチャーを無視します。Codex のマッチャーは常に非アンカー正規表現です。一致したフックは設定順に直列で実行され、各フックの `hook/invoked` / `hook/result` ペアがログ内で隣接したままになり、最も制限的な畳み込みは順序に依存しません（`deny > ask > allow`）。

### デタッチ実行と破棄

`SessionStart` は唯一の発行ポイントで、デタッチされて実行されます — それを待つ拡張ポイントはありません。各実行チェーンは追跡され、ブリッジの破棄はまだ実行中のフックプロセスを中止し、その後 dispose が解決する前に継続をドレインします（`dsh-hook-protocol` の `createDetachedRuns`）。

### 設計哲学

- **パワーツールではなく互換アダプター。** このブリッジは既存の Codex 設定の明示的にサポートされるサブセットを実行するために存在します。特注の動作は同じ拡張ポイント上のネイティブプラグインに属します。
- **コンテキストの追加は拒否権ではない。** コンテキスト専用のフックは、そのメッセージを下流の enter 決定に畳み込む前に `next()` 経由で委譲するため、後の `agent/pre-step` や `tools/post-execute` リスナーも依然として拒否や書き換えができます。
- **あらゆる失敗で封じ込め。** 設定の読み取り/解析失敗と無効なマッチャーは何も登録しません。スローするデタッチ inject はキャッチされてログされ、セッションブートやループを壊しません。
- **破棄は静止状態に達する。** デタッチされた実行は追跡され、破棄時にドレインされるため、フックプロセスや遅延コールバックがファイバーより長生きしません。
- **方言の形に従い、最大主義ではない。** ペイロードは `turn_id` / `model` を持つ snake_case のまま、stdin は末尾の改行を運ばず、ブリッジはツール前承認や書き換えパスを実装しません — harness がより多くできる場面でもプロトコルの形が保たれます。

[hook-bridges Agent Note](../../../.agents/notes/archived/feature/2026-06-30-hook-bridges.md) がブリッジ設計と先送りされたギャップを記録し、[hook-protocol-lib Agent Note](../../../.agents/notes/archived/feature/2026-06-30-hook-protocol-lib.md) が共有対方言ごとの分割を記録しています。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: 設定検証、リスナー登録、イベントごとのペイロード、決定マッピング |
| [`src/config.ts`](src/config.ts) | Codex 設定解析: サポートされる 5 イベント、マッチャー検証、スキップ理由 |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときにこれらのページを読んでください。共有プロトコルからブリッジ設計とそれがプログラムする拡張ポイントへと進みます。

- [Hooks グループマップ](../README.md) — 姉妹グループページとそのパッケージ表。
- [Hook プロトコルライブラリ](../hook-protocol/README.md) — このブリッジが適用する共有フックルール。
- [Hook bridges Agent Note](../../../.agents/notes/archived/feature/2026-06-30-hook-bridges.md) — ブリッジ設計、決定マッピング、先送りされたギャップ。
- [Interception 拡張ポイントリファレンス](../../../docs/tool-execution-pipeline.md) — ブリッジがマップする typed-Decision サーフェス。
- [生成設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-hooks-codex) — 受け付けられるすべての設定フィールドとそのソース宣言。

-----

<a id="model-experience"></a>
## モデル体験

### フックが提供するコンテキスト

#### モデルが見るもの

`SessionStart`、受け入れられたプロンプト、post-tool フックはソース属性付きのコンテキストメッセージを追加できます。ブロックする `Stop` フックはその理由を次ステップのステアリングとして追加します。

#### トークンへの影響

フックがコンテキストを返さない場合はコストなし。フックテキストはデータ依存で、ログに記録され、コンパクションまで以降の会話リクエストで再送されます。

#### KV キャッシュへの影響

追記専用です。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しません。

### ブロックされたプロンプトまたはツールの結果

#### モデルが見るもの

プロバイダーが供給した理由はそのまま通ります。存在しない場合、拒否されたツールは `Error: blocked by PreToolUse hook` になり、ブロックされた post-tool フィードバックは正確に `blocked by PostToolUse hook`、ブロックする停止は正確に `continue: blocked by Stop hook` のステアリングを追加します。ブロックされたプロンプトはモデル可視のメッセージなしで破棄され、ターンは `blocked` として終了します。Codex の `systemMessage` は表面化されません。

#### トークンへの影響

プロンプトをブロックするとそのプロンプトのリクエストトークンが削除されます。拒否やフィードバックは保持されるフォールバックまたはプロバイダーテキストを追加します。強制継続は別の完全なリクエストのコストを支払います。

#### KV キャッシュへの影響

ブロックされたプロンプトはリクエストを送信せず、何も無効化しません。拒否、フィードバック、強制継続コンテキストは、再利用可能なプレフィックスを書き換えずにその後に追記されます。

## 既知の制限と先送りされた作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、あなたの Codex フックがこのブリッジを通じてまだできないこと、および参照ツールと動作が異なる箇所を説明します。これらは現在のパッケージ制約であり、タスクバックログではありません。

- **未サポートのフックイベント（Codex の現在の 10 個のうち 5 個）** — `PermissionRequest`、`PreCompact`、`PostCompact`、`SubagentStart`、`SubagentStop`。これらのイベントの設定は解析中に黙って破棄されます。比較の基準は Codex の [公式フックリファレンス](https://learn.chatgpt.com/docs/hooks) です。
- **`SessionStart` は部分的** — プレーンな stdout と JSON の `additionalContext` は機能しますが、フックがデタッチで実行されるため、コンテキストが最初のリクエストに間に合わない場合があります。
- **`UserPromptSubmit` は部分的** — ブロックとプレーン stdout または JSON コンテキストは機能しますが、一般的な `systemMessage` と `{"continue": false}` コントロールは適用されません。
- **`PreToolUse` は部分的** — ブロックは機能しますが、`additionalContext`、`permissionDecision: "allow"`、`updatedInput` は無視されます。すべてのツールは `tool_input: { command }` として表現されるため、シェル以外のツール引数はフックに忠実に公開されません。
- **`PostToolUse` は部分的** — ブロックフィードバックと JSON の `additionalContext` は機能しますが、`{"continue": false}` は適用されず、シェル以外のツール引数は `{ command }` に縮小され、構造化ツール出力は `tool_response` 内のテキストに平坦化されます。
- **`Stop` は部分的** — ブロックは別のモデルターンを強制しますが、`stop_hook_active` は常に `false`、`last_assistant_message` は常に `null`、`{"continue": false}` は適用されません。したがって、無条件にブロックするフックは自己制限しない限りすべてのステップを強制継続します。
- **一般的なペイロードと出力フィールドは部分的** — マップされたすべてのイベントは、現在の Codex ランタイム値ではなく静的に設定された `model` と `permission_mode: "default"` を報告し、`transcript_path` は決して設定されません。常に `null` です。永続化シームが成果物パスを公開せず、デフォルトの zstd セッションログがフックスクリプトから読めないためです。`systemMessage` はログと警告が記録されますが表面化されず、`{"continue": false}` は記録されますが Codex のイベント固有の停止動作は適用されません。
- **設定のロードと実行は部分的** — ロード時に解析されるのはプロセスレベルの `configPath` 1 つです。Codex のアクティブな user、project、session、system/managed、plugin レイヤー、信頼コントロール、インラインの `config.toml` フック形式は実装されていません。実行されるのは同期 `command` ハンドラーのみで、`statusMessage` や `commandWindows` などの現在のメタデータは無視され、一致するハンドラーは Codex の並行起動セマンティクスではなく直列で実行されます。

<a id="dev-note"></a>
### 開発ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発ノートはメンテナー向けの作業コンテキストです。未解決の問いと未決定の方向性を扱います。明示的に非権威です — 出荷される動作、制限、受け入れられた根拠は、上のセクション、パッケージコード、リンクされた Agent Note にあります。

上の先送りされたギャップが作業キューです。セッションごとのフック設定検出、session-start 配信ゲート、停止ループガード、`continue: false` のための実行レベル停止。どれも設計はまだありません。公式の Codex リファレンスが、それらを解消するための基準です。

</details>
