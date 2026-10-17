---
description: "First-message LLM session-title provider for users and maintainers choosing a title strategy or debugging automatic title generation."
kind: "package-reference"
---

# @deepseek-ai/dsh-session-title-first-prompt-llm

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-session-title-first-prompt-llm` は、任意の `ctx.sessionTitle` プロバイダーとして `ctx.llm` 経由で最初の対象人間メッセージを要約します。`first-prompt` ケイデンスを登録し、新規の非フォークセッションがフォールバックを初めて作成するときのみ自動実行し、結果をそのメッセージの正確な seq に帰属させます。自動失敗ではフォールバックを保持し、`ctx.sessionTitle.refresh()` からのみ再試行します。このプラグインはシステム命令、JSON フレーミング、出力解析を所有し、`dsh-session-title-llm` から all-prompts プロバイダーと共有するのは[実行モジュール](../session-title-llm/README.md)のみです。自動動作と設定を先に説明し、実装はそのエグゼキューター上の小さなプロバイダー戦略です。

## 目次

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの利用

セッションに最初の対象人間メッセージからタイトルを付ける場合、タイトルサービスと並べてこのプラグインをマウントします。共有の[実行制御](../session-title-llm/README.md#configuration)に加え、独自の `targetWords` と `targetCjkCharacters` が必要で、いずれにも既定値はありません。

### タイトルが生成されるタイミング

自動生成は、親がなく prior タイトルもない新規セッションでのみ実行されます。最初の対象人間メッセージの後、フォールバックが作成され、そのメッセージを要約する 1 回の補助リクエストが実行されます。以降のプロンプト、明示的なユーザーによる改名、継承したフォーク履歴では別の自動呼び出しは起動しません。自動失敗ではフォールバックを保持し、明示的な再試行は `ctx.sessionTitle.refresh()` です。フォークは継承タイトルを保持し、シードされた最初のメッセージが親由来であってもこのプロバイダーを自動実行しません。

### 設定

このプラグインは `targetWords` と `targetCjkCharacters` に加え、共有の[実行制御](../session-title-llm/README.md#configuration)が必要です。`maxInputBytes`、`maxOutputTokens`、`timeoutMs`、および任意のペア `provider`/`model` ルートです。両方を省略すると記録済みメインリクエストの正確なルートを継承し、両方を設定するとタイトル生成を独立にルーティングします。生成済みの[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-session-title-first-prompt-llm)が受け付ける全フィールドの網羅的な情報源です。

### 失敗と回復

生成が失敗した場合 — メインリクエスト前のルート欠落、`maxInputBytes` 超過の入力、タイムアウト、キャンセル、無効なモデル出力 — は警告して現在のタイトルを保持し、明示的な `refresh()` のみが再試行します。自動処理はメインエージェントリクエストにトークンも遅延も加えません。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

この節ではプラグインの形状を説明します。観測可能な動作はすべて [Use this package](#use-this-package) で扱っています。

### 設計概念

小さなプロバイダー戦略です。最初のメッセージ用システム命令と JSON 入力を構築し、組み立て済み応答をタイトルに解析し、ルート、バウンド、キャンセル、ログ記録、組み立てのみを[共有実行モジュール](../session-title-llm/README.md)に委譲します。

### ソースマップ

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: config schema, first-message prompt and framing, output parsing, and direct provider registration |

### スケジューリング

タイトルサービスは自動処理をスケジュールします。`first-prompt` ケイデンスでは、セッションに親がなく、対象メッセージをちょうど 1 件保持し、まだタイトルがない場合のみリビジョンを開始します。プロバイダー呼び出しは正確なメインリクエストルートが記録された後に始まり、新しいリビジョンが古い処理に取って代わります。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

プロバイダー契約だけでは足りない場合にこれらのページを読んでください。共有実行モジュールから代替ケイデンス、そしてそれが差し込まれるサービスへ進みます。

- [Shared LLM execution module](../session-title-llm/README.md) — このプロバイダーが使う実行モジュール。
- [All-messages title provider](../../experimental/session-title-all-prompts-llm/README.md) — 新しいプロンプトごと改題するケイデンス。
- [Session title service](../session-title/README.md) — フォールバック動作、改名、更新、プロバイダー登録。
- [Session package map](../README.md) — 隣接する永続化、プロジェクション、タイトル、テレメトリーパッケージ。

-----

<a id="model-experience"></a>
## モデル体験

### 最初のメッセージのタイトルリクエスト

#### モデルが見るもの

タイトルモデルは、このプロバイダーのタイトル命令と、最初の対象人間メッセージのみを含む JSON 配列を受け取ります。`currentTitle` は受け取りません。以降のプロンプトや継承したフォーク履歴では別の自動呼び出しは起動しません。

#### トークン効果

新規セッションにつき自動補助リクエストは最大 1 回で、`maxInputBytes` と `maxOutputTokens` で制限されます。明示的な更新では追加呼び出しが発生することがあります。ルートのサポートが最も弱い reasoning effort を選択し、ルートが何も公開しない場合は effort を未指定のままにします。メインエージェントリクエストのトークンはゼロ増です。

#### KV キャッシュ効果

メインリクエストの無効化はありません。補助リクエストは設定または記録済みルートを使い、プロバイダー固有のキャッシュ動作になります。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このプロバイダーがセッションを表さなくなる条件を定めます。これらは現行パッケージの制約です。

- **First message may go stale** — 最初のメッセージだけでは長期実行セッションを表さなくなることがあります。以降のプロンプトで改題すべき場合は all-messages プロバイダーを使ってください。
- **Forks never retitle automatically** — フォークは継承タイトルを保持し、シードされた最初のメッセージが親由来であってもこのプロバイダーを自動実行しません。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
