# Webhook ランタイム

日本語 | [English](webhook.en.md) | [中文](webhook.zh.md)

Webhook サブシステムは、認証済みの外部配信を通常の任意のルートセッションに変える。プロバイダーアダプターは認証と汎用 JSON 取り込みを所有し、信頼されたプログラム的ルールは条件と外部呼び出しを所有し、`ctx.webhookRuntime` はコールバック寿命とワークスペース起点のセッション作成を所有する。[歴史的な実装済み決定](../../.agents/notes/archived/feature/2026-08-22-fire-and-forget-webhook-sessions.md)は、ランタイムが配信や完了の状態を保持しない理由を記録している。

## 共有値

`WebhookRuleId`、`WebhookSourceId`、`WebhookDeliveryId` は不透明な文字列である。配信 id はプロバイダーの識別子のみを記録する。ランタイムはそれを格納も重複排除もしない。

`WebhookEventMap` はプロバイダー種別ごとにマージ拡張可能である。`WebhookEventOf<K>` は既知のプロバイダーイベントを選択し、そうでない場合は汎用のロスレス JSON を受け入れるため、ツリー外アダプターでもランタイムパッケージを変更せずに済む。

`VerifiedWebhookDelivery<K>` は `kind`、構成済み `source`、プロバイダー `deliveryId`、正規化 `event`、非負安全整数 `receivedAt` を含む。ランタイムは値全体を検証、デタッチ、凍結してから複数のルールに配送する。

`WebhookRule<K>` は一意な id、プロバイダー種別、`run(delivery, signal)` を含む。コールバックは任意の信頼されたコードを実行できる。`null` または 1 つの `WebhookSessionRequest` を返し、登録のアンロード時に停止すべき非同期作業についてはシグナルを遵守しなければならない。

`WebhookSessionRequest` は絶対 `workspacePath`、タイトル、テキストプロンプト、エージェントプリセット、権限プリセットを必須とする。任意の `model` は明示的なプロバイダー・モデル経路に任意の出力トークン上限を加えたものを指定し、そのアダプターの reasoning 既定値を使う。省略時は現在のデプロイ選択全体のスナップショットとなり、reasoning effort を含め、最初の要求が永続ヘッダーを記録するまで継続する。

## ファイアアンドフォーゲット配送

`dispatch()` は一致するルールをスナップショットし、各々を独立にスケジュールし、コールバックの決着前に復帰する。スローと拒否はルールごとに封じ込められる。登録の破棄はそのアクティブ呼び出しを中止して排出する前にルールを除去するため、後の配信がアンロード中のコードに入ることはない。

ランタイムにキュー、再試行、重複排除、実行状態、クラッシュ時リプレイ、エージェント状態リスナー、完了結果はない。繰り返し配信は繰り返しセッションを作り得る。唯一のアクティブ操作テーブルは私的なテアダウン記帳であり、プロセスと共に消える。

## セッション作成

非 null 結果は非同期プリフライトの前にスナップショットされる。ランタイムは権限とエージェントのプリセットを検証し、正規ワークスペースを解決または作成し、セッション cwd がワークスペースパスに等しいエージェントを作成し、公開前に選択されたエージェントプリセットをマウントし、権限、タイトル、最初のフォローアップを適用する前にセッションを永続的にアタッチする。

フォローアップは `source.kind: "webhook"` を持つ通常の永続的な user ロールメッセージであり、プロバイダー、ソース、配信、ルールの識別子を含む。その受け入れ済みインボックス挿入が webhook 操作をコミットする。ランタイムはターンを特別にフラッシュも待機もしない。以後は通常のセッション永続化とエージェントライフサイクルが適用される。

失敗したアタッチはプロンプト存在前に新しいエージェントを破棄する。アタッチとプロンプト受付の間の失敗は、元のエラーを置き換えずにワークスペースのデタッチとエージェント破棄を試みる。プリフライト中に自動作成されたワークスペースは残る。別の並行呼び出し元がすでに使っている場合があるためである。

## GitHub アダプター

`@deepseek-ai/dsh-webhook-github` は注入された WebServer 上に正確なルートを登録し、要求ごとに認証情報参照を解決し、手つかずの `application/json` 本体をパース前に検証し、インメモリー配送直後に `202` を返す。その正規化イベントは署名済みロスレス JSON オブジェクトを保証する。ルールは消費するイベント固有フィールドを検証する。

[GitHub レビューガイド](../user/guide/github-review.md)は、webhook 取り込みの公開がブラウザー API を公開しないよう、このルートを分離された 2 つ目の WebServer 上にマウントする。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される(doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。再生成は `pnpm run gen-cordis-catalog`)。言語版の違いは、ロケール固有のペアドキュメントパスのみである。シグネチャブロックは `ts cordis-catalog` フェンスを使用し、元のソース JSDoc を保持する。ディスパッチモードは [primer](../cordis-primer.md#dispatch-modes) で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxwebhookruntime--webhookruntime"></a>

### `ctx.webhookRuntime` — `WebhookRuntime`

ファイアアンドフォーゲットのルールランタイム。セッション作成は唯一の組み込みアクションである。

```ts cordis-catalog
/**
 * Register one trusted programmatic rule.
 * @param rule - unique id, provider kind, and arbitrary callback.
 * @returns awaitable effect disposer that aborts and drains this rule's active callbacks.
 */
register<K extends string>(rule: WebhookRule<K>): () => Promise<void>

/**
 * Start every currently matching rule and return before any callback settles.
 * @param delivery - authenticated provider data; snapshotted before dispatch.
 * @throws synchronously when the runtime is closing or the delivery is malformed.
 */
dispatch<K extends string>(delivery: VerifiedWebhookDelivery<K>): void
```

ソース: [`packages/experimental/webhook/src/index.ts`](../../packages/experimental/webhook/src/index.ts)
<!-- END GENERATED cordis-surface -->
