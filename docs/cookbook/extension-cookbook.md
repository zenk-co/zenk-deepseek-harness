# クックブック: 拡張プラグインの形

日本語 | [English](extension-cookbook.en.md) | [中文](extension-cookbook.zh.md)

harness 拡張のリファレンスパターン。スニペットは import とヘルパー実装を省略しており、コピー＆ペーストで完結しない。具体的な作成手順については、[パッケージチェックリスト](adding-a-package.md)、[初めてのツールのチュートリアル](../user/develop/basic/tool.md)、[ツールリファレンス](adding-a-tool.md)、[LLM アダプターガイド](adding-an-llm-adapter.md)、[Session フォーマットバージョンのチュートリアル](adding-a-session-format-version.md) を参照。[アーキテクチャ](../architecture.md) がシステムと拡張ポイントのマップを所有する。

## ツールプラグイン

ツールは `ctx.tools` に登録する。アノテーション付きの `defineTool` の例（型付き `execute` 引数、結果の構築、`run_in_background` パターン）は [adding-a-tool.md](adding-a-tool.md) にある。そのガイドがツール定義の信頼できるソースである。生の JSON-Schema の `ToolDefinition` も `ctx.tools.register()` に直接受け入れられる（MCP 由来のツールはこうして届く）。`defineTool` はファーストパーティツール向けの型付きヘルパーである。

## フックプラグイン（パーミッションゲートの例）

このパーミッションゲートはフックプラグインの一例である。これは `tools/pre-execute` ゲートから型付きの決定を返して呼び出しを許可または拒否する。sandbox、permission、plan-mode の各プラグインがこの拡張ポイントを使える。フックプラグインは他の拡張ポイントもインターセプトでき、本質的にパーミッションゲートであるわけではない。「native hook」はインターセプションポイント上の通常の Cordis プラグインであり、外部プロトコルを必要としない。

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'

declare function isAllowed(exec: ToolExecution): Promise<boolean>

export const name = 'permission-gate'

export function apply(ctx: Context) {
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (!(await isAllowed(exec))) {
      return { kind: 'deny', reason: 'Denied by policy.' }
    }
    return next()
  })
}
```

このウォーターフォールは並べ替え可能なポリシーレイヤーである。不変条件に単調な最終拒否が必要な場合は `ctx.tools.guard()` を、プラグインがディスパッチのライフタイムを包む必要がある場合（タイムアウト／リトライ／メトリクス。置換可能なのは `exec.signal` だけ）は `tools/execute` を、明示的な結果変換には `tools/post-execute` を、不変の最終結果の封じ込められた観察には `tools/result` を使う。[adding-a-tool ガイド](adding-a-tool.md#execution-policy-and-observation) が選択ルールを示す。

## UI プラグイン

UI プラグインは、durable な `session/event` レコード（Assistant の確定、ターン／ステップ境界、ツール活動）と、ライブのトークン表示のための一時的な `agent/assistant-stream` フレームを組み合わせ、`agent.followup()` / `agent.steer()` を通じて入力を戻す。ビルトイン Web Client にビジネス行を貢献するブラウザープラグインは、代わりに `ConversationNodeDefinition` とキー付き Chat レンダラーを登録する。[Conversation サブシステムリファレンス](../subsystems/conversation.md) に従う。

```ts
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'

declare function render(text: string): void
declare function onUserInput(handler: (text: string) => void): void

export const name = 'my-ui'
export const inject = ['agents']

export function apply(ctx: Context) {
  ctx.on('agent/assistant-stream', ({ frame }) => {
    if (frame.type === 'chunk' && frame.chunk.type === 'text-delta') {
      render(frame.chunk.text)
    }
  })
  onUserInput(text => ctx.agents.get(brandString<SessionId>('client-session'))?.followup(createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  })))
}
```

## 外部プロトコルドライバー

*プロトコルドライバー* はワイヤーのピアを `ctx.agents` に適合させる。UI に奉仕することも、オートメーションクライアントに奉仕することもある。stdio ドライバーは stdout を所有し、ファクトリーを通じてエージェントを作成または再開し、プロトコルリクエストを `followup()` または `cancel()` にマップする。低レベルのプロンプトリクエストは durable なエンキュー受領証を返す。`MessageId` と `turn/end` を相関させて結果を取得することはない。エージェント全体のステータスは別に公開する。オートメーションメソッドは、その受領証から次のアイドルまで待ち、その明示的に所有する区間を要約できる。一方 UI は通常、終わりのないイベントストリームを観察し続ける。`AgentHandle.dispose()` でエージェントを解体し、破棄が静止状態に達するようにする。

[`packages/acp/acp`](../../packages/acp/acp) はオートメーション専用の実例である。Agent Client Protocol の JSON-RPC stdio 上で fresh なテキストセッションを公開し、コミットされたアシスタントテキストを発行し、自身が所有するエージェント用にワンショットのマシンパーミッション回答者を登録する。その [README](../../packages/acp/acp/README.md) が正確なメソッド、イベント順序、ライフサイクルコントラクトを定義する。

```ts
import type { Context } from '@deepseek-ai/cordis'
import { expandAssistantStream } from '@deepseek-ai/dsh-llm'

export const name = 'my-protocol-bridge'
export const inject = ['agents', 'sessions', 'sessionPersistence']

export function apply(ctx: Context) {
  // Publish every committed Assistant text delta to the client.
  ctx.on('session/event', (_session, event) => {
    if (event.type === 'assistant/message' || event.type === 'assistant/attempt') {
      for (const { chunk } of expandAssistantStream(event.data.stream)) {
        if (chunk.type === 'text-delta') {
          // sendToClient({ kind: 'message_chunk', text: chunk.text })
        }
      }
    }
  })
  // Inbound "prompt": create/resume an agent, feed it, and return its enqueue receipt.
  // Whole-agent status is a separate notification; no turn end belongs to this prompt.
  // Teardown reaches quiescence via AgentHandle.dispose() (stop + await exit).
}
```

## 実行可能な配線

出荷済みアプリケーションは `packages/bundle/*/cordis.patch.yml` を通じてプロファイルレイヤーを貢献し、プロダクトの `dsh` ランチャーが名前付きプロファイルを通じて Web、ACP、SDK、ワンショット headless 実行を所有する。省略可能なユーザー向けオーバーレイは `apps/cli/config/examples/` にあり、プロファイル統合テストは `apps/cli/tests/profiles/` にある。パッケージ固有の Loader 構成はそのパッケージのテストにとどまる。

## フィーチャー → メカニズムのマップ

すべてのプロダクトフィーチャーは、文書化された拡張ポイント上のリスナーにマップされる。これはマイクロカーネルの主張を検証可能にしたものである（[マイクロカーネルリファレンス](../architecture.md)）。どの行もループを変更しない。

`system-prompt/assemble` はエキスパート向けの協調的な全体アセンブリ変換である。返されたアセンブリが権威となるので、リスナー作者はアクティブな PTC モードと構造化出力プロトコルの貢献を保持する責任を負う。プレゼンテーション、ルックアップ、実行にまたがって整列し続ける必要のあるツールフィルタリングには `ctx.tools.restrict()` を優先する。

| プロダクトフィーチャー | プラグインメカニズム |
|---|---|
| フックシステム（ユーザー + プロジェクトレベル） | `agent/created`、`agent/pre-step`、`agent/request`、`tools/pre-execute`、`tools/post-execute`、`agent/turn-stopping` 上のリスナー。ウォーターフォールは型付きの決定を返し、`agent/turn-stopping` は別のステップを steer できる。`dsh-hooks-claude-code` / `dsh-hooks-codex` ブリッジがフック設定ファイルをこれらの拡張ポイントにマップする |
| `/goal` | `ctx.goals` が durable 状態を所有し、`dsh-goal-round-driver` が公開 `Agent` を通じて同一セッションのラウンドをスケジュールし、別個のコマンド／ツールプロデューサーが人間／モデルの制御を公開する |
| `/loop` | `turn/end` セッションイベントで次のイテレーションを `followup()` する。または強制継続 |
| 動的ワークフロー | `ctx.workflowEngine` + PTC ワークフローエンジン + `workflow` ツール。構造化されたインプロセスの子は、スコープ付きプロンプト／ツール登録、単調なツールガード、最終 `tools/result` コミット（外側の `run_code` を含む）、構造化出力実行の単調な `concludeTurn()` マーカーで出力を強制する |
| キュー済み + steering メッセージ | コアの `Agent.followup()` / `Agent.steer()` |
| コンテキスト圧縮（自動 + 手動） | `ctx.compaction` シーム + `dsh-compaction-basic`。自動の圧迫は直列 `agent/pre-step` で実行され、正規のオーバーフロー回復は `agent/request-error` で実行され、手動の呼び出し元は同じ compaction サービスを使う（[compaction リファレンス](../../packages/compaction/compaction/README.md)） |
| システムプロンプトの構成可能性 | 順序とスコープローカルのシャドーイングを備えた `ctx.systemPrompt.section()` |
| AGENTS.md（ルート） | ファイルを読むセクションプロバイダー |
| AGENTS.md（サブディレクトリ、オンダッチ）+ ファイル変更通知 | ウォッチャー／ツール結果リスナーからの `agent.inject()` |
| ビルトインツール | `ctx.tools.register()`。スキーマは自動的にアセンブリに流れ込む。`dsh-tool-*` ファミリー（bash、fs、web、subagent、todo）が出荷済みの例である |
| ToolSearch / プログレッシブディスクロージャー | 可視セットの変化に応じてスコープ付き `ctx.tools.restrict()` 登録を置き換える。レジストリがプレゼンテーション、ルックアップ、実行を整列させ続ける |
| ツールの期限／リトライ／メトリクス | `tools/execute` でコアディスパッチを包む。ラッパーは 1 つの字句的ライフタイム内で `exec.signal` を置き換え、委譲し、正規化された結果を検査できる |
| 最終ツール結果のメトリクス／監査／キャプチャ | `tools/result` で不変の権威ある結果を観察する。プラグインが結果を変換したりコンテキストを付加したりする必要がある場合にのみ、代わりに `tools/post-execute` を使う |
| 単調な終端ターンポリシー | 成功した終端ツールから `ToolExecution.concludeTurn()` を呼ぶ。同じレスポンス内の以降のツール呼び出しはガード可能なままで、ループはそのステップの後に停止する |
| サブプロセスサンドボックス（landlock / sandbox-exec） | `dsh-bash-sandbox` を通じて `ctx.sandbox` バックエンドを使う。ケイパビリティレベルの拒否には `tools/pre-execute` を使う |
| パーミッションシステム / AskUserQuestion | `tools/pre-execute` から `ask` を返し、`ctx.approval` を通じて回答する。通常のユーザーの質問には別個のモデル向け ask ツールを登録する |
| プランモード | [`@deepseek-ai/dsh-plan-mode`](../../packages/plan/plan-mode/README.md) — ログに記録される `plan/mode` 状態、`plan:policy` ガイダンスセクション、`/plan [message]` エントリ、`/plan off` の直接終了、ユーザーレビュー付きの `exit_plan_mode` 終了。強制は独立した sandbox／approval の軸にとどまる |
| サブエージェント委譲 | `ctx.subagents` プロバイダーレジストリ（`dsh-subagent-spawn-in-process`/`dsh-subagent-fork-in-process`/`dsh-subagent-acp`/`dsh-subagent-codex`/`dsh-subagent-claude-code`/`dsh-subagent-dsh-sdk`）+ 1 つの構成済みプロバイダーをモデルに公開する `dsh-tool-subagent` |
| MCP | サーバーごとに 1 つのプラグイン: ツールを発見 → `ctx.tools.register()` |
| スキル | セクション + ツール登録。呼び出し時にスキル内容を `inject()` する |
| メモリ | セクションプロバイダー + ツール |
| スケジュールタスク（cron） | プラグインがモデルから呼び出し可能なスケジューリングツールを登録する。期限の来たタイマーが `followup(…, {source: {kind: 'schedule'}})` を通じて配信する |
| UI（GUI。CLI は JSONL を出力） | ライブチャンクには `agent/assistant-stream` を、durable な確定、境界、ツール活動には `session/event` をリッスンする。入力 → `followup()` |
| Web Client Chat ビジネスノード | `ConversationNodeDefinition` と `conversation.chat.node` キー付きレンダラーを登録する |
| SessionTelemetryBackend / リプレイ可能トレース | `session/event` → JSONL。リプレイ = `sessions.create(id, { seed })` |
| モデルアダプター | `registerAdapter` 経由の `LlmAdapter` サブクラス（`dsh-llm-deepseek`、`dsh-llm-pi-ai`） |
| プラグインホットリロード | すべての登録が `ctx.effect` → ベンダリング済み HMR がそのまま動作する |
