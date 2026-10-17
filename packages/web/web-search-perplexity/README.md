---
description: "ctx.web 用の Perplexity ベースの検索プロバイダー: 生成回答と引用を伴う OpenAI 互換の Perplexity 検索をデプロイがどのようにマウントするか。"
kind: "package-reference"
---

# @deepseek-ai/dsh-web-search-perplexity

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-web-search-perplexity` を使用すると、harness は Perplexity を通じて Web を検索し、1 回の呼び出しでモデル生成の回答と引用可能なソースを取得する。デプロイが Perplexity API キーを持ち、生成された回答を求める場合に選択する。Perplexity には結果件数の制御がないため、返されたソースは事後に要求された上限まで切り詰められる。Perplexity が構造化された結果メタデータを省略した場合、ソースは URL のみの引用にフォールバックする。モデルに面する `web_search` ツールは `dsh-tool-web` にある。

## 目次

- [このパッケージの使い方](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの使い方

すでに Web サービスをロードしている構成にこのプロバイダーをマウントする。`perplexity` 検索プロバイダーとして登録されるため、唯一の使用可能な検索バックエンドである場合は `ctx.web.search()` が自動的に解決する。または `searchProvider: perplexity` で固定する。

### いつ選択するか

デプロイが Perplexity API キーを保持し、1 回の検索でモデル生成の回答と引用可能なソースを求める場合にこのバックエンドを選択する。キーが空であるか、エンドポイントベースがパースできない場合、プロバイダーは利用不可となり、すべての検索呼び出しが構造化エラーで失敗する。

### 最小構成

Web サービスとプロバイダーをロードする。API キーは起動環境の `$PERPLEXITY_API_KEY` にフォールバックし、他のすべての設定には安全なデフォルトがある。

```yaml
- name: '@deepseek-ai/dsh-web'
- name: '@deepseek-ai/dsh-web-search-perplexity'
  config:
    apiKey: !!js process.env.PERPLEXITY_API_KEY
```

| フィールド | デフォルト | 意味 |
|---|---|---|
| `apiKey` | `$PERPLEXITY_API_KEY` | Perplexity API キー。空または不在の場合はプロバイダーが利用不可になる |
| `baseURL` | `https://api.perplexity.ai` | エンドポイントベース。`/chat/completions` が付加される。パースできない値はプロバイダーを利用不可にする |
| `model` | `sonar` | 検索モデル名 |
| `maxTokens` | `1024` | 生成される回答トークンの上限(`max_tokens`)。正の整数でなければならない |
| `searchRecency` | (未設定) | `search_recency_filter` として送信される新しさのウィンドウ: `day`、`week`、`month`、`year`。未設定の場合はフィルターを送信しない |

生成された[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-web-search-perplexity)が、受け付けられるすべてのフィールドとその JSDoc の完全な情報源である。

### 検索が返すもの

`content` は Perplexity の生成した回答を運ぶ。`sources[]` は構造化された `search_results[]`(`url`、`title`、`snippet`、`date` からの `publishedAt`)を優先し、`search_results` がない場合にのみ URL のみの `citations[]` 配列にフォールバックする。これが `title`/`snippet`/`publishedAt` がサービス上でオプションである理由である。Perplexity は結果件数の制御を公開しないため、サービスは切り詰めとフラグ付けによって `maxResults` を強制する。

### 失敗と回復

プロバイダーの失敗(HTTP エラー、ネットワーク障害、パースできない、または形の合わないボディ)は `WebError` の `WEB_PROVIDER_ERROR` として表面化する。中断されたリクエストは `WEB_ABORTED` として表面化する。HTTP リダイレクトは `Location` ターゲットに接触する前に拒否され、`WEB_PROVIDER_ERROR` として表面化する。呼び出し元はコードでルーティングする。モデルに面する `web_search` ツールは、独自のエラーラッパーの下で失敗をモデルに提示する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションでは、プロバイダーの背後の設計判断を説明する。観察可能な動作は[このパッケージの使い方](#use-this-package)で完全に扱う。

### 設計哲学

このプロバイダーは、Perplexity の chat-completions エンドポイント上の薄いアダプターであり、2 つの意図的なルールを持つ:

- **生成された回答は `content` として信頼される。** 他の検索バックエンドと異なり、Perplexity はモデル生成の回答を返し、このプロバイダーはそれを正規化された `content` フィールドとしてそのまま通す。
- **構造化ソースが優先し、URL のみの引用はフォールバックである。** `search_results[]` は移植可能なフィールドを運び、`citations[]` は URL のみを運ぶ。サービスの語彙がこれらのフィールドをオプションにしているのは、まさにこのケースのためである。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリ: 設定スキーマ、環境フォールバック、プロバイダー登録 |
| [`src/provider.ts`](src/provider.ts) | `PerplexitySearchProvider`: リクエストのディスパッチ、abort の分類、回答とソースのマッピング |
| [`src/types.ts`](src/types.ts) | chat-completions レスポンスの Perplexity ワイヤ型 |

### リクエストとマッピングの流れ

`search()` はクエリをモデル、トークン上限、オプションの新しさフィルターとともに `redirect: 'error'` で `{baseURL}/chat/completions` に POST する。レスポンスの `content` が `content` になり、存在する場合は `search_results[]` が `sources[]` になり、そうでなければ各 `citations[]` エントリが URL のみのソースになる。サービスは戻り道で最終的な `maxResults` の上限を適用する。abort(`AbortError` という名前の `DOMException`)は `WEB_ABORTED` になり、それ以外は `WEB_PROVIDER_ERROR` になる。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルのコントラクトでは足りない場合にこれらのページを読む。共有の語彙から、サービス、モデルに面するツール、設計の根拠へと進む。

- [Web サブシステム](../../../docs/subsystems/web.md) — 完全な検索リクエスト/結果の語彙とエラーコード。
- [Web パッケージマップ](../README.md) — 6 パッケージのファミリーと各役割。
- [dsh-web](../web/README.md) — このプロバイダーが登録する Web サービス。
- [dsh-tool-web](../tool-web/README.md) — このプロバイダーのソースをレンダリングする、モデルに面する `web_search` ツール。
- [生成された設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-web-search-perplexity) — 受け付けられるすべての設定フィールドとそのソース宣言。
- [Web ケイパビリティシームの決定](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) — 検索とフェッチが 1 つのプロバイダー選択サービスを共有する理由。

-----

<a id="model-experience"></a>
## モデル体験

### 補助的な Perplexity リクエスト

#### モデルに見えるもの

別個の Perplexity モデルが、chat-completions エンドポイントを通じて `<query>` をそのまま唯一のユーザーメッセージとして受け取る。このリクエストは会話モデルのコンテキストの一部ではない。

#### トークンへの影響

検索ごとに別個のプロバイダートークンが発生する。`maxTokens` が生成される回答を制限する。

#### KV キャッシュへの影響

会話リクエストのキャッシュとは独立している。同じモデルルートの下での同一のクエリはプロバイダーキャッシュを再利用する可能性がある。クエリやルートが変わると、異なるプレフィックスが確立される。

### 会話ツールの結果(間接的)

#### モデルに見えるもの

`dsh-tool-web` を通じて、会話モデルは生成された回答と、構造化された結果メタデータまたは URL のみの引用を見る。このプロバイダーの正確な失敗は `Perplexity search aborted`、`Perplexity search request failed: <error>`、`Perplexity returned an unprocessable response body: <error>` である。HTTP の失敗はプロバイダーのメッセージを保持する。エラーラッパーはコンシューマーが所有する。

#### トークンへの影響

登録による直接の会話トークンはゼロ。回答とソースのトークンはデータ依存であり、ソース数はサービスによって制限され、保持された結果またはエラーはコンパクションまで再送信される。

#### KV キャッシュへの影響

追記のみ。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに従い、既存の KV キャッシュエントリを無効化しない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、プロバイダーが適さない状況を定義する。現在のパッケージの制約である。

- **引用フォールバックのソースは URL のみ** — Perplexity が構造化された `search_results[]` を省略した場合、ソースは `title`/`snippet`/`publishedAt` を持たないため、ツールはホスト名のみのラベルをレンダリングする。
- **過剰に返されたソースは依然としてトークンとレイテンシを消費する** — ワイヤ上に結果件数の制御がないため、`maxResults` はサービスの切り詰めによる事後的な強制のみである。
- **公開されるのは `model`/`maxTokens`/`searchRecency` のみ** — Perplexity の他の検索制御(ドメインフィルター、`web_search_options` のコンテキストサイズ、画像)は、プロバイダー中立のサービスフィールドを待っている([シーム Agent Note](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md))。
- **abort の分類はエラーの形に基づく** — `AbortError` という名前の `DOMException` のみが `WEB_ABORTED` にマッピングされる。カスタム理由(`dsh-timeout` の `TimeoutReason` など)を運ぶ abort は `WEB_PROVIDER_ERROR` として表面化する。

<a id="dev-note"></a>
### Dev Note

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この Dev Note はメンテナー向けの作業コンテキストであり、未解決の質問と未決定の方向性を示す。明示的に権威を持たない。出荷された動作、制限、根拠は、上記のセクションとリンクされた Agent Note にある。

#### 将来: より広い Perplexity 制御サーフェス

Perplexity のドメインフィルター、`web_search_options` のコンテキストサイズ、画像サポートは非公開のままである。それらを公開するにはまずプロバイダー中立のサービスフィールドが必要であり、ファミリーはベンダー固有の引数ではなく、調整された 1 つの制御を追加する。

</details>
