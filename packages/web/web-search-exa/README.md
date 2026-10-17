---
description: "ctx.web 向け Exa 支援検索プロバイダー。移植可能スニペットと公開日付きベンダーネイティブ Web 検索をどうマウントするか。"
kind: "package-reference"
---

# @deepseek-ai/dsh-web-search-exa

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-web-search-exa` では、ハーネスは Exa 経由で Web を検索し、移植可能スニペットと公開日付きベンダーネイティブ結果を得る。デプロイが Exa API キーを持ち、Exa のキーワードまたはニューラル検索を求める場合に選ぶ。Exa は生成回答を返さないため、結果は `content` を運ばず引用可能ソースのみである。非空白ハイライトを持たない結果は落とされるため、呼び出しは要求より少ないソースを返すことがある。モデルに面した `web_search` ツールは `dsh-tool-web` にある。

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

Web サービスを既にロードする合成にプロバイダーをマウントする。`exa` 検索プロバイダーとして登録されるため、唯一使用可能な検索バックエンドなら `ctx.web.search()` が自動解決する — または `searchProvider: exa` で固定する。

### いつ選ぶか

デプロイが Exa API キーを持ち、結果単位ハイライトスニペットと公開日付きの Exa キーワードまたはニューラル検索を求める場合にこのバックエンドを選ぶ。キーが空、またはエンドポイント基底がパースできない場合、プロバイダーは不可であり、すべての検索呼び出しは構造化エラーで失敗する。

### 最小構成

Web サービスとプロバイダーをロードする。API キーは起動環境の `$EXA_API_KEY` にフォールバックし、他の設定はすべて安全な既定値を持つ。

```yaml
- name: '@deepseek-ai/dsh-web'
- name: '@deepseek-ai/dsh-web-search-exa'
  config:
    apiKey: !!js process.env.EXA_API_KEY
```

| フィールド | 既定値 | 意味 |
|---|---|---|
| `apiKey` | `$EXA_API_KEY` | Exa API キー。空または不在はプロバイダー不可にする |
| `baseURL` | `https://api.exa.ai` | エンドポイント基底。`/search` が付加される。パース不可値はプロバイダー不可にする |
| `searchType` | `auto` | Exa の `type` として送られる取得モード。`auto`、`keyword`、`neural` |
| `numResults` | (未設定) | リクエストが `maxResults` を運ばない場合の既定結果数。正整数でなければならない |
| `highlightsPerResult` | `1` | 結果単位に要求するハイライト文数 (Exa の `highlightsPerUrl`)。正整数でなければならない |

生成される[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-web-search-exa)が、受け入れられるすべてのフィールドとその JSDoc の網羅的な情報源である。

### 検索が返すもの

各 Exa 結果は `WebSearchSource` に対応付けられる。`url`、`title`、最初の非空白ハイライトを `snippet` とし、`publishedDate` を `publishedAt` とする。ハイライトを持たない結果は移植可能スニペットを持たず落とされる。リクエストの `maxResults` は設定 `numResults` 既定に勝ち、コストと遅延最適化として Exa に送られる — 最終上限はサービスが強制し、切り詰めと印付けを行う。Exa は生成回答を返さないため、結果は `content` を運ばない。

### 失敗と回復

プロバイダー失敗 — HTTP エラー、ネットワーク失敗、パース不可や形状違い本体 — は `WebError` `WEB_PROVIDER_ERROR` として現れ、中止されたリクエストは `WEB_ABORTED` として現れる。HTTP リダイレクトは `Location` 先への接続前に拒否され `WEB_PROVIDER_ERROR` として現れる。呼び出し元はコードで分岐する。モデルに面した `web_search` ツールは独自エラー wrapper の下で失敗をモデルに現す。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションではプロバイダーの背後にある設計上の決定を説明する。観測可能な動作はすべて[このパッケージの使い方](#use-this-package)で扱っている。

### 設計思想

プロバイダーは Exa API 上の薄いアダプターであり、意図的な規則を 2 つ持つ:

- **移植可能スニペットのみ。**ソースは実ハイライトからのみ `snippet` を得る。他フィールドからの創作はシームを嘘つきにするため、スニペットなし結果は全体を落とす。
- **創作回答なし。**Exa は生成回答を返さないため、モデルが信頼しうるプロバイダー散文を捏造せず `content` を省く。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグイン入口。設定スキーマ、環境フォールバック、プロバイダー登録 |
| [`src/provider.ts`](src/provider.ts) | `ExaSearchProvider`。リクエスト配送、abort 分類、結果対応付け |
| [`src/types.ts`](src/types.ts) | Exa wire 型。`ExaSearchResponse`、`ExaResult`、`ExaError` |

### リクエストと対応付けフロー

`search()` はクエリ・取得モード・ハイライト要求・任意結果数を `{baseURL}/search` に `redirect: 'error'` で POST するため、リダイレクトは対象に接続せずリクエストを失敗させる。パースされた `results[]` は 1 件ずつ対応付けられ、スニペットなし項目は落とされ、サービスが帰路で最終 `maxResults` 上限を適用する。abort — `AbortError` 名の `DOMException` — は `WEB_ABORTED` になり、それ以外は `WEB_PROVIDER_ERROR` になる。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りない場合にこれらのページを読むとよい。共有語彙からサービス、モデルに面したツール、設計根拠へと進む。

- [Web サブシステム](../../../docs/subsystems/web.md) — 網羅的な検索リクエスト/結果語彙とエラーコード。
- [Web パッケージマップ](../README.md) — 6 パッケージファミリーと各役割。
- [dsh-web](../web/README.md) — このプロバイダーが登録する Web サービス。
- [dsh-tool-web](../tool-web/README.md) — このプロバイダーのソースを描画する、モデルに面した `web_search` ツール。
- [生成される設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-web-search-exa) — 受け入れられるすべての設定フィールドとそのソース宣言。
- [Web ケイパビリティシーム決定](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) — 検索と取得が 1 つのプロバイダー選択サービスを共有する理由。

-----

<a id="model-experience"></a>
## モデル体験

`dsh-tool-web` 経由で間接的に。このプロバイダーの `maxResults` 上限付き URL・タイトル・先頭ハイライト・公開日、または正確な `Exa search aborted`、`Exa search request failed: <error>`、`Exa returned an unprocessable response body: <error>` 失敗を、コンシューマーのエラー wrapper の下で保持する。

#### KV キャッシュへの影響

直接の無効化なし。名前付きコンシューマーがリクエスト接頭辞変更を所有する。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限はプロバイダーが不向きな場合を定義する。これらは現在のパッケージ制約である。

- **非空白ハイライトを持たない結果は全体を落とす** — 対応付ける移植可能スニペットがないため、要求より少ないソースが返りうる。
- **公開するのは `searchType`/`numResults`/`highlightsPerResult` のみ** — Exa の他制御 (livecrawl、カテゴリ、ドメイン/日付フィルタ、全文 contents) はプロバイダー中立サービスフィールド待ちである ([シーム Agent Note](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md))。
- **Abort 分類はエラー形状基準** — `AbortError` 名の `DOMException` のみ `WEB_ABORTED` に対応付けられ、カスタム理由を運ぶ abort (`dsh-timeout` の `TimeoutReason` など) は `WEB_PROVIDER_ERROR` として現れる。

<a id="dev-note"></a>
### Dev Note

<details>
<summary>メンテナ向けの作業コンテキスト — クリックして展開</summary>

この Dev Note はメンテナ向け作業コンテキストである。開かれた問いと未決定の方向性であり、明示的に非権威である — 出荷動作・制限・根拠は上記セクションとリンク Agent Note にある。

#### 将来: より広い Exa 制御面

Exa の livecrawl、カテゴリ、ドメインと日付フィルタ、全文 contents は未公開のままである。公開にはまずプロバイダー中立サービスフィールドが必要であり、ファミリーはベンダー固有引数ではなく 1 つの協調制御を追加する。

</details>
