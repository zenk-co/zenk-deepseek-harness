---
description: "DeepSeek Harness ランタイムの subprocess を起動し、stdio JSON-RPC でエージェントのターンを駆動する呼び出し元向けの TypeScript SDK クライアント: DeepSeekHarness の run API と低レベルの HarnessClient。"
kind: "package-library"
---

# @deepseek-ai/dsh-sdk-client

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-sdk-client` を使うと、TypeScript プログラムが stdio JSON-RPC 経由で完全な DeepSeek Harness ランタイムを起動して駆動できる。`DeepSeekHarness` でセッションを開き、テキストまたは画像のプロンプトを送り、イベントと通知のストリームを収集し、ランタイムがアイドルになったときに最後にコミットされたアシスタント応答を取得する。直接のプロトコルリクエストと購読には `HarnessClient` を使う。呼び出し元は `dshBin` を指定できる。指定しない場合、クライアントは同一バージョンの `@deepseek-ai/dsh` 実行ファイルを解決する。クライアントは実行をまたいで subprocess を所有し、型付きのトランスポートとプロトコルの失敗を公開し、`close()` または `await using` でそれを回収する。呼び出し元がランタイムプロファイルと起動設定を選べる場合に適している。

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

`await harness.resumeSession(savedId)` は、構成された `dshHome` から永続化セッションを復元し、`run()` の準備ができた `HarnessSession` を返す。元の session id を保存し、そのホームとワークスペースを再利用する。復元は会話履歴とそのディレクトリを保ち、中断された最終ターンを修復し、新しい入力を送らない。欠落、読み取り不能、非互換、または使用中のセッションは、置き換えを作成せずに拒否する。`session(id)` はプロセス内セッションの遅延ハンドルのままであり、永続化された復元を要求しない。シェル、ブラウザー、その他の外部プロセスはこの API では復元されない。

`HarnessSession.getWorkingDirectory()` は有効なディレクトリを読み取り、`setWorkingDirectory(path)` はそれを変更して検証済みの絶対パスを返す。どちらのメソッドも、モデルのターンを開始せずに未知の Session を作成する。相対パスは Session の現在のディレクトリを使う。オリジンのメタデータ、権限、既存のプロセスは変更されない。`HarnessClient` は先頭に `sessionId` 引数を付けた同じメソッドを公開する。

TypeScript のコードが別のプロセスから完全な Harness ランタイムを駆動する必要があり、ランタイム実行ファイルを明示的に名指せる場合はこのクライアントを使う。一般的な手順は最小限である。起動仕様で `DeepSeekHarness` を構築し、プロンプトを実行し、子プロセスが常に回収されるようクローズする。

### DeepSeekHarness でエージェントのターンを実行する

```ts
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'

await using harness = new DeepSeekHarness({
  profile: 'sdk',
  patches: ['./automation.cordis.yml'],
  provider: 'deepseek-official',
  model: 'deepseek-v4-flash',
  reasoningEffort: ReasoningEffortId('max'),
  maxTokens: 49_152,
})
const result = await harness.run('say hi')
console.log(result.finalResponse)
```

subprocess は最初の使用時に遅延して起動し、`run()` 呼び出しをまたいでインスタンスが所有し続ける。`close()` を呼ぶ（または `await using` を使う）ことで子が常に回収される。`start()` は有界の `initialize` ハンドシェイクをメモ化し、それはワークスペースの cwd、プロバイダー/モデルのルート、任意のアダプター所有の `reasoningEffort`、および任意の正の `maxTokens` 出力上限を運ぶ。サーバーはプロンプトを受け入れる前にその正確なルートを検証する。省略されたエフォートはモデルの既定値を保つ。`initializeTimeoutMs` の既定値は 10 秒で、その診断は選択されたプロファイルを保持された stderr の末尾とともに名指す。`run(input, { sessionId?, onNotification? })` はテキストまたは `SdkPromptContentBlock[]` を受け取る。インラインのラスターブロックは正規の base64 と `mimeType` を運び、ランタイム内で耐久性のある添付になる。この呼び出しは 1 つのアクティビティ区間を所有する。プロンプトをキューし、そのメッセージ id が耐久性のある受信箱レシートに現れるまで待ち、次にエージェント全体が `idle` を報告するまで収集する。`RunResult { sessionId, finalResponse, events, notifications }` を返す。ここで `finalResponse` はその区間で最後にコミットされたルートセッションのアシスタントテキストであり、プロンプトに因果的に割り当てられた応答ではない。ステアリング、注入されたコンテキスト、その他のキュー済み作業がアイドル前に寄与することがあるためである。`session(id?)` は名前付きまたは新しいセッションハンドルを開く。失敗したハンドシェイクのクリーンアップが成功した場合、インスタンスは新しいクライアントを設置し、終端の `close()` まで後の呼び出しが新しいプロセスで再試行する。初期化とクリーンアップの両方が失敗した場合、`start()` は順序付きの `AggregateError` を返し、終了が証明されていないプロセスの隣で spawn する代わりに失敗したクライアントを保持する。`maxTokens` は各ルートエージェントリクエストの出力を上限し、プロセス内の子孫に継承される。コンパクションプラグインは独自の要約上限を所有する。

### HarnessClient による低レベル制御

`HarnessClient` は run API の下にあるプロトコルクライアントである。明示的な `start()`、`initialize()`、`prompt()`、`request()`、`close()`、および通知の購読を備える。`prompt()` はランタイムが受け入れた時点でキュー済みのメッセージ id を返し、エージェントのアクティビティを決して待たない。`subscribe(filter?)` は `NotificationSubscription`（await 可能な `next()`、ノンブロッキングの `tryNext()`、非同期イテレーション）を返す。`subscribeSessionTree(id)` は 1 つのセッションと、`subagent.started` の系統エッジから発見された子孫にスコープする。ランタイムはそのコンテキスト内のすべてのセッションについて通知し、スコープは Python SDK とまったく同じくクライアント側である。

タスクを所有するコンシューマーは `prompt()` の前に購読し、次に `request('session/wait', { sessionId })` を呼び、キュー済みの通知を `tryNext()` で排出できる。これは管理対象の子孫とそのルート要約ターンを待つ。`HarnessSession.run()` は自身の next-idle 区間を保つ。`validatedSessionEvent()` はイベントエンベロープと、SDK のリーダーが消費するアシスタント/ターンのフィールドを、出力フォールドに入る前に検証する。

クライアントはすべての失敗モードに型付きエラーをエクスポートする。`JsonRpcResponseError`（ワイヤのエラー応答。コードとデータを保持）、`RequestTimeoutError`（構成された上限を経過）、`SdkProtocolError`（文書化されたプロトコルの外の応答）、`TransportClosedError`（ランタイムが消滅。メッセージは終了コードと有界の stderr 末尾を運ぶ）である。`close()` はプロトコルの `shutdown` を要求し（`shutdownTimeoutMs` で制限、既定 1000 ms）、次にプロセスが終了するまで stdin-EOF → SIGTERM → SIGKILL のラダーを進む。冪等であり、クローズ済みクライアントは再利用を拒否する。`HarnessClientOptions.env` は指定された場合に子環境を完全に置き換える（`undefined` は親のものを継承する）。資格情報ポリシーは呼び出し元が所有する。`dsh-subprocess` の `scrubbedParentEnv` は、分離を重視する起動のための共有スクラブベースである。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションはクライアントの背後の設計を説明する。観測可能な挙動は[このパッケージを使う](#use-this-package)で完全にカバーされている。

### 設計概念

クライアントは 1 つのワイヤの上の 2 つの層である。`HarnessClient`（プロトコルクライアント）の上の `DeepSeekHarness`（所有された実行）であり、Python SDK の層構成を反映する。harness コンテキストの外側で動作するため、`dsh-subprocess` サービスを通さずにランタイムを直接 spawn する——SDK 管理のトランスポートに対する seam の文書化された例外——そしてそのテアダウンラダーは本パッケージにある。ランタイムはそのコンテキスト内のすべてのセッションについて通知し、セッションツリーのスコープは `subagent.started` の系統エッジに対するクライアント側のフィルターである。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/api.ts`](src/api.ts) | `DeepSeekHarness` + `HarnessSession`: 所有された実行、レシートからアイドルまでの収集、`finalResponse` |
| [`src/client.ts`](src/client.ts) | `HarnessClient`: spawn、ハンドシェイク、リクエスト、購読のファンアウト、型付きエラー |
| [`src/dispose.ts`](src/dispose.ts) | 私有のテアダウンラダー: stdin EOF → SIGTERM → SIGKILL から実際の終了まで |
| [`src/types.ts`](src/types.ts) | 起動とタイムアウトのオプション、通知の形、`RunResult` |
| [`src/index.ts`](src/index.ts) | コンシューマーインターフェース: 2 つのクライアント層と呼び出し元向けの型 |

### 所有されたアクティビティの流れ

実行はセッションツリーを購読し、プロンプトをキューし、プロンプトのメッセージ id が耐久性のある `agent/inbox/spliced` レシートに現れるまで待ち、次にエージェント全体が `idle` を報告するまで通知を収集する。`finalResponse` は収集されたイベントの最後の `assistant/message` から導出される。トランスポートの喪失、タイムアウト、プロトコル違反は実行を拒否する。モデルの結果は、1 つの入力に帰属されないままイベントストリームで観測可能であり続ける。

### エラーとテアダウン

すべての失敗モードは 1 つのエクスポートされたエラークラスに対応する——ワイヤのエラー応答、経過したリクエスト上限、文書化されたプロトコルの外の応答、または死んだランタイム——ため、呼び出し元は失敗の型で分岐する。4 つのクラスは [src/index.ts](src/index.ts) からエクスポートされる。テアダウンは [src/dispose.ts](src/dispose.ts) の私有で冪等なエスカレーション（stdin EOF → SIGTERM → SIGKILL）であり、実際のプロセス終了でのみ終わる。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

クライアント契約で足りない場合はこれらのページを読む。ワイヤプロトコルから、サービスを提供するプラグインとこのクライアントを使うアプリケーションへと進む。

- [SDK ワイヤプロトコル](../protocol/README.md) — このクライアントが話す JSON-RPC メソッドとペイロードの形。
- [JSON-RPC サービス提供プラグイン](../server/README.md) — このクライアントにサービスするランタイムプラグイン。
- [Python SDK](../../../python/README.md) — 同じランタイムピアとプロトコルを共有する設計上の双子。
- [SDK サブエージェントバックエンド](../../subagent/subagent-dsh-sdk/README.md) — このクライアントの harness 内部のコンシューマー。
- [SDK アプリケーションバンドル](../../bundle/sdk-app/README.md) — このクライアントが起動する `dsh --profile sdk` ランタイムアプリケーション。

-----

<a id="model-experience"></a>
## モデル体験

なし。これはクライアントプロセスのライブラリであり、モデル向けの挙動は spawn されたランタイムのコンポーズされたプラグインにある。

#### KV キャッシュへの影響

クライアントプロセスにはない。プロファイル、パッチ、プロバイダー、モデル、履歴の選択が子でのキャッシュ再利用を決める。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

これらの制限は、このクライアントが不向きになる、または特別な注意を要する状況を定義する。他の SDK クライアントとの比較やタスクバックログではなく、現在のパッケージの制約である。

- **バンドル済みランタイムの解決はない** — クライアントは同一バージョンの `@deepseek-ai/dsh` パッケージ（または呼び出し元が指定した `dshBin`）を解決する。パッケージ化された実行ファイルの発見は、TypeScript のディストリビューションのコンシューマーが現れるまで Python 側に留まる。
- **ターン途中のキャンセルはない** — ワイヤにプロンプトキャンセルメソッドはない。ターンを放棄するにはランタイムをクローズする（[プロトコルの制限](../protocol/README.md#known-limitations-and-deferred-work)を参照）。
- **プロンプトごとの結果はない** — 低レベルの `prompt()` はエンキューされたレシートのみを返す。高レベルの `run()` がレシートからアイドルまでの収集を所有し、それを放棄するにはランタイムをクローズする。
- **Client→server の通知と server→client のリクエストは未実装** — どちらのワイヤ端でも。トランスポートは将来の承認フローのためにそれらを運ぶ。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発者ノートはメンテナー向けの作業コンテキストであり、明示的に非権威である。出荷済みの挙動と制限は、上記のセクションとコードにある。起動仕様は意図的に完全に明示的である。TypeScript 向けのバンドル済みランタイムの解決は、ディストリビューションのコンシューマーが現れるまで計画されていない。dispose ラダーとエラー語彙は、同じランタイムを駆動する Python クライアントと同期させておくこと。その他の未解決の設計上の問いは記録されていない。

</details>
