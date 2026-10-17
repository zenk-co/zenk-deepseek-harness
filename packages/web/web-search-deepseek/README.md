---
description: "ctx.web 向けの DeepSeek バックエンド検索プロバイダー: デプロイが Anthropic 互換 Messages API を通じてネイティブ DeepSeek Web 検索をどうマウントするか、検索ごとの認証情報解決とともに。"
kind: "package-reference"
---

# @deepseek-ai/dsh-web-search-deepseek

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-web-search-deepseek` により、harness は DeepSeek アカウントのサインインまたは既存の `DEEPSEEK_API_KEY` を使用して DeepSeek のネイティブ検索で Web を検索します。デプロイが DeepSeek ネイティブ検索を望み、DeepSeek が専用の検索エンドポイントを公開していないため 1 回の検索が完全なモデルターン分のレイテンシとトークンを要することを受け入れる場合に選びます。結果は DeepSeek が返す構造化検索ブロックから来て、返信からテキストをスクレイプすることはありません。認証情報がない場合は構造化エラーで呼び出しが失敗し、検索結果ブロックのない応答は劣化せず大きな音で失敗します。モデル向けの `web_search` ツールは `dsh-tool-web` にあります。

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

すでに web サービスをロードしている構成でこのプロバイダーをマウントします。`deepseek-official` 検索プロバイダーとして登録されるため、使用可能な唯一の検索バックエンドである場合、`ctx.web.search()` はそれを自動的に解決します — または `searchProvider: deepseek-official` で固定します。

### いつ選択するか

デプロイが DeepSeek のネイティブなサーバーサイド Web 検索を望み、そのユーザーが DeepSeek アカウントにサインインしているか `DEEPSEEK_API_KEY` を持っている場合はこのバックエンドを選びます — プロバイダーは [認証](#authentication) で説明するようにそれらの認証情報を再利用します。1 回の検索は専用の取得エンドポイントより重くなります。DeepSeek は完全なモデルターン内で検索を実行するため、検索あたり 1 回の Messages 呼び出しのレイテンシと生成トークンを見込み、リクエストあたり最大 `maxUses` 回のサーバーサイド検索が可能です。検索ごとのコストやレイテンシが支配的な場合は避けてください。

### 最小構成

web サービスとプロバイダーをロードします。キーはそのサービスがマウントされている場合は `ctx.credentials` から、そうでなければプロセス環境から解決されます。補助検索呼び出しは独自のエンドポイント設定を持ち、Anthropic 互換のベース `https://api.deepseek.com/anthropic/v1` に `/messages` を付けて使用します。`$DEEPSEEK_SEARCH_BASE_URL` を読み取り、会話アダプターの `$DEEPSEEK_BASE_URL` とは独立しています。

```yaml
- name: '@deepseek-ai/dsh-web'
- name: '@deepseek-ai/dsh-web-search-deepseek'
  config:
    apiKeyEnv: DEEPSEEK_API_KEY
    baseURL: https://gateway.internal/anthropic/v1
```

| フィールド | デフォルト | 意味 |
|---|---|---|
| `apiKey` | 省略 | リテラルの DeepSeek API キー。設定にシークレットが入らないよう `apiKeyEnv` を推奨。空でないリテラルは `apiKeyEnv` より優先され、アカウントトークンはその両方より優先されます |
| `apiKeyEnv` | `DEEPSEEK_API_KEY` | 各検索で `ctx.credentials` を通じて解決される認証情報参照。そのサービスがない場合はプロセス環境から。API キーを必要とする検索で見つからない場合は `WEB_PROVIDER_CREDENTIAL_MISSING` で失敗します |
| `baseURL` | `https://api.deepseek.com/anthropic/v1` | Anthropic 互換エンドポイントベース。`/messages` が付加されます。`$DEEPSEEK_SEARCH_BASE_URL` にフォールバックし、解析不能な値はプロバイダーを使用不能にします |
| `model` | `deepseek-v4-flash` | Anthropic 形式のモデル名 |
| `apiVersion` | `2023-06-01` | `anthropic-version` ヘッダー値 |
| `maxTokens` | `4096` | Messages リクエストの生成トークン数の正の整数上限 |
| `maxUses` | `5` | リクエストあたりの `web_search` サーバーツール使用回数の正の整数上限 |

生成される [設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-web-search-deepseek) は、受け付けられるすべてのフィールドを列挙します。各検索はライブの Config 参照からオプションを捕捉します。

<a id="authentication"></a>
### 認証

開始セッションの最新の `request/context` イベントが `deepseek-account` プロバイダールートを指定し、`ctx.deepseekAccount` が検索エンドポイント用のトークンを解決する場合、検索は DeepSeek アカウントで認証します。アカウントサービスがトークンを解決するのは、サインイン中の、かつデプロイ設定された推論オリジン（デフォルトでは `https://api.deepseek.com`）向けのみです。その検索は、API キーが設定されていても `x-dsh-auth-token` のみを送信します。開始セッションのない呼び出しや、エンドポイントが別のオリジンである検索を含む他のすべての検索は、API キーを `x-api-key` と `Authorization: Bearer` の両方として送信します。アカウント認証された検索への HTTP 401 応答は、エンドポイントのガイダンスではなくサインインのガイダンスとともに `WEB_PROVIDER_ERROR` として失敗し、アカウントはサインイン状態のままです。

### 検索が返すもの

`content` は常に省略されます。DeepSeek のプロバイダー散文は回答として信頼されません。`sources[]` は `web_search_tool_result` ブロック内の `web_search_result` 項目から来ます — `url` と `title` は直接、`publishedAt` は `page_age` から — 抜粋が存在する場合は URL をキーとする `cited_text` エントリーからスニペットが結合されます。結果は URL で重複排除され、DeepSeek が結果数ノブを公開していないため、サービスは切り詰めとフラグ付けによって `maxResults` を適用します。

### リクエストログ

開始エージェントの下で実行される検索は、ディスパッチの直前にログ専用の `web/deepseek-search-llm-request` セッションイベントを追記します。解決されたエンドポイント、API バージョン、DeepSeek に送信されるシークレットを含まない正確な JSON ボディを運びます。ヘッダーと認証情報は除外されます。ディスパッチ前の認証情報失敗とキャンセルはイベントを作成せず、以降の HTTP や応答の失敗は試行されたリクエストを永続化します。

### 失敗と回復

失敗は `WebError` をスローし、機械ルーティング可能なコードを持ちます。認証情報の欠落は `WEB_PROVIDER_CREDENTIAL_MISSING`、呼び出し元のキャンセルは `WEB_ABORTED`、プロバイダーまたはトランスポートの失敗（`web_search_tool_result` ブロックのない応答を含む）は `WEB_PROVIDER_ERROR` です。HTTP リダイレクトは `Location` ターゲットに接触する前に拒否されます。ディスパッチ後のすべての失敗は、解決された検索エンドポイントを挙げ、検索エンドポイントの設定がチャットとは別であることを説明します。エンドポイントが意図しないものである場合、メッセージは会話モデルに、ユーザーを Settings > Plugins > Plugin configuration > Web search の Endpoint フィールドへ導き、変更を保存するよう伝えます。そのページが利用できない場合は、デプロイ設定の代替として `DEEPSEEK_SEARCH_BASE_URL` と `web-search-deepseek.baseURL` を挙げます。モデルはエンドポイントを選択または変更してはなりません。モデル向けの `web_search` ツールはこのテキストを自身のエラーラッパーの下に表示します。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションではプロバイダーの背後にある設計判断を説明します。観測可能な動作は [このパッケージを使う](#use-this-package) で完全に説明されています。

### 設計哲学

このプロバイダーは 2 つのコミットメントの上に成り立っています。

- **構造化ブロックのみ。** DeepSeek はサーバーサイドで検索を実行し、構造化された `web_search_tool_result` ブロックを返します。プロバイダーはそれらのブロックを解析し、モデルの散文から URL をスクレイプすることはありません。厳密モードでは、そのようなブロックのない応答は劣化せず `WEB_PROVIDER_ERROR` をスローします。
- **会話の認証情報を検索ごとに解決。** プロバイダーはシークレットを追加しません。アカウントルート上のセッションからの検索はそのアカウントのトークンを使用し、他のすべての検索は `DEEPSEEK_API_KEY` 参照を再利用します。補助リクエストエンドポイントは `$DEEPSEEK_SEARCH_BASE_URL` を通じて独立したままです。マウントされた credentials サービスが権威であり、なければプロバイダーは起動プロセス環境にフォールバックします。呼び出しごとに解決することで、Web Models ページで保存またはローテーションされたキー、あるいはアカウントのサインインが、再起動なしで次の検索に反映されます。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | 設定スキーマと検索ごとのオプション捕捉 |
| [`src/provider.ts`](src/provider.ts) | `DeepSeekSearchProvider`: Messages リクエストのディスパッチ、ブロック解析、引用結合、認証情報解決 |
| [`src/types.ts`](src/types.ts) | 検索応答の Anthropic wire 型 |

### リクエストフロー

各検索は現在の Config 値をプロバイダーオプション — エンドポイント、モデル、キー参照、制限 — に捕捉し、開始セッションがアカウントルートを使用する場合は `ctx.deepseekAccount` にトークンを求め、そうでなければ `ctx.credentials`（または環境）を通じて認証情報参照を解決し、ログ専用セッションイベントを追記し、ネイティブ `web_search` サーバーツールとともに Messages リクエストをディスパッチします。応答の `web_search_tool_result` ブロックは `sources[]` になり、テキストブロックの `cited_text` エントリーは URL にスニペットとして結合され、結果は URL で重複排除され、サービスは戻り道で要求されたソース上限を適用します。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときにこれらのページを読んでください。共有語彙からサービス、モデル向けツール、設計根拠へと進みます。

- [Web サブシステム](../../../docs/subsystems/web.md) — 網羅的な検索リクエスト/結果の語彙とエラーコード。
- [Web パッケージマップ](../README.md) — 6 パッケージファミリーと各ロール。
- [dsh-web](../web/README.md) — このプロバイダーが登録する web サービス。
- [dsh-tool-web](../tool-web/README.md) — このプロバイダーのソースをレンダリングするモデル向け `web_search` ツール。
- [生成設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-web-search-deepseek) — 受け付けられるすべての設定フィールドとそのソース宣言。
- [Web capability seam decision](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) — 検索とフェッチが 1 つのプロバイダー選択サービスを共有する理由。

-----

<a id="model-experience"></a>
## モデル体験

### 補助 DeepSeek 検索リクエスト

#### モデルが見るもの

別個の DeepSeek モデルは、ユーザーテキストとして正確に `Perform a web search for the query: <query>` と、1 つのネイティブ `web_search` サーバーツール定義を受け取ります。このリクエストは会話モデルのコンテキストの一部ではありません。

#### トークンへの影響

検索ごとに別個のプロバイダー入力トークンと出力トークンが発生します。`maxTokens` は生成出力を、`maxUses` はネイティブ検索の使用回数を制限します。

#### KV キャッシュへの影響

会話リクエストキャッシュから独立しています。補助命令とネイティブツール定義は安定したプレフィックスを形成できますが、クエリやモデルルートが変わるたびに最初の差分からの再利用が妨げられます。

### 間接的な会話ツール結果

#### モデルが見るもの

`dsh-tool-web` を通じて、会話モデルは構造化検索ブロックからの重複排除された URL、タイトル、日付、引用スニペットを見ます。プロバイダーの散文は回答として信頼されません。このプロバイダーの正確な失敗には、実行可能な認証情報欠落メッセージ（DeepSeek Account のサインインも挙げます）、`DeepSeek search credential resolution failed: <error>`、`DeepSeek search aborted` が含まれます。アカウント認証された検索への HTTP 401 は、ユーザーを DeepSeek に再度サインインさせる指示を追記します。その他のリクエスト、HTTP、ネイティブ検索、応答ボディの失敗は、解決されたエンドポイントと上記の条件付き設定指示を追記します。エラーラッパーはコンシューマーが所有します。

#### トークンへの影響

登録による直接の会話トークンはゼロです。結果トークンは返されたソースとスニペットに比例し、その後サービスが要求されたソース上限を適用します。

#### KV キャッシュへの影響

追記専用です。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しません。

## 既知の制限と先送りされた作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、プロバイダーが高コストまたは不完全になる場合を定義します。これらは現在のパッケージ制約です。

- **1 回の検索は完全な Messages モデルターンのコスト** — レイテンシと生成トークン、加えて最大 `maxUses` 回のサーバーサイド検索。DeepSeek は専用の取得エンドポイントを公開していません。
- **動的な認証情報の可用性は操作の内部で解決される** — 同期の可用性チェックはリゾルバーの存在を確認できますが、非同期の認証情報ストアを照会できません。そのため、選択されたキーのないプロバイダーは `WEB_PROVIDER_CREDENTIAL_MISSING` で検索に失敗します。安定した `web_search` スキーマは登録されたままです。
- **過剰に返されたソースもトークンを消費する** — wire に結果数ノブがないため、`maxResults` はサービスによる事後的な切り詰めでのみ適用されます。
- **引用されていない結果は `snippet` を持たない** — ソースがスニペットを得るのは、テキストブロックの引用（`cited_text`）がその URL に一致する場合のみです。

<a id="dev-note"></a>
### 開発ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発ノートはメンテナー向けの作業コンテキストです。未解決の問いと未決定の方向性を扱います。明示的に非権威です — 出荷される動作、制限、根拠は、上のセクションとリンクされた Agent Note にあります。

#### 将来: 専用の取得エンドポイント

完全なモデルターンを避けるネイティブの DeepSeek 検索エンドポイントは支配的なコストを取り除きます。DeepSeek がそれを公開するまで、このプロバイダーは Messages 呼び出しアダプターにとどまります。

</details>
