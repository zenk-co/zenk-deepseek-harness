---
kind: upgrade-guide
description: "管理サブエージェント活性化が前面・ジョブ裏打ち委譲、その設定キー、公開プロセス内駆動に置き換わる。"
---

# 管理サブエージェント活性化へ委譲を移行する

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

`@deepseek-ai/dsh-tool-subagent` は `backgroundMode`・`enableRunInBackground`・モデル引数 `run_in_background` を除去する。すべての委譲は子を受け付けた後に `{ kind: 'activation', subagentId }` を返すようになり、ランタイムは最終回答を親完了通知で届ける。前面結果と `{ kind: 'background', jobId }` 結果は除去され、サブエージェントは `job_output` や `job_kill` 越しに収集・停止されなくなる。

公開 `@deepseek-ai/dsh-subagent-in-process-driver` パッケージは除去される。ローカルプロバイダーは `prepareContinuable()` 越しに作成入力を寄与し、実行はサブエージェントサービスが所有する。Spawn と Fork の子は後続メッセージを受け取れ、永続化とセッションクエリが利用可能であれば確定後も含む。外部プロバイダーは一度だけ実行し、後続メッセージを受け付けない。

## 移行

1. `cordis.yml`・プロファイルパッチ・オーバーレイ内の `tool-subagent` 行から `backgroundMode` と `enableRunInBackground` を除去する。プロバイダーと残りの設定は保つ。例:

   ```yaml
   - name: '@deepseek-ai/dsh-tool-subagent'
     config:
       provider: spawn
       toolName: subagent
   ```

   ローカルツール委譲にはセッション永続化が必要である。[サブエージェントサービスとプロバイダー](../../../../packages/subagent/subagent/README.md#use-this-package)と組み合わせること。

2. ツール呼び出しから `run_in_background` を除去し、結果利用者を `subagentId` 読みに更新する。前面出力やジョブ結果の代わりに完了通知を収集する。現実行の停止には `interrupt_agent` を使い、制御ツールが合成されている場合に限りローカルの子向けにのみ `send_message` を使う。

3. 結果を待たなければならないホストコードでは、`ctx.subagents.start()` または `startContinuable()` を `startActivation()` と呼び出し側配送に置換する。合成済みサービスと稼働親があれば:

   ```ts
   import type { Agent } from '@deepseek-ai/dsh-agent'
   import type SubagentRuntime from '@deepseek-ai/dsh-subagent'

   async function collect(subagents: SubagentRuntime, parent: Agent, signal: AbortSignal) {
     const activation = await subagents.startActivation({
       provider: 'spawn',
       label: 'Review changes',
       request: { parent, prompt: [{ type: 'text', text: 'Review these changes.' }] },
       signal,
       delivery: 'caller',
     })
     const result = await activation.result
     await activation.dispose()
     return result
   }
   ```

   呼び出し側配送は親完了通知を出さない。`result` は後片付け後に確定し、`output`・`stopReason`・任意の `structured`・`diagnostic` 値を含む。成功として扱う前に `stopReason` を検査すること。起動信号は公開後の所有取り消しを止める。受領を保持し、その正確な活性化を取り消すには `dispose()` を呼ぶ。後片付け失敗は取得結果とは別に `dispose()` が報告する。

4. ドライバー依存とインポート（`startInProcessRun` を含む）を除去する。既存の Spawn または Fork プロバイダーをマウントし、上記のとおりサービスを呼ぶ。独自ローカルプロバイダーは[プロバイダー API](../../../../docs/subsystems/subagent.md)を使って `prepareContinuable()` を実装する。代替の単体ドライバーは存在しない。

   外部プロバイダーは `start()` を保つが、返される各 `SubagentRun.id` は親・プロバイダー・ローカルセッションをまたいで一意でなければならない。親内カウンターではなく、実行ごとに新しい id を生成すること。

   `dsh-subagent-dsh-sdk` では、別設定の `dshBin` 実行時が `session/wait` に対応するよう更新する。ディレクトリ設定は[作業ディレクトリ移行](../working-directory/guide.md)に従うこと。

5. 委譲が活性化結果種別を返すこと、その完了通知が最終回答を含むこと、呼び出し側配送がその通知を加えずに結果を返すことを確認する。ローカルの子は完了後も一覧に残り、外部の子は継続できないことを確認する。
