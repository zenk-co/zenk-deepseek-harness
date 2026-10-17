---
description: "認証済み JSON イベントを webhook ランタイムへ導くデプロイ向けの署名付き GitHub webhook アダプター。"
kind: "package-reference"
---

# @deepseek-ai/dsh-webhook-github

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-webhook-github` は注入 `ctx.webServer` 上に 1 つの正確な HTTP 経路を登録する。GitHub の raw JSON 本体を区切って検証し、プロバイダー中立の配送に投影し、`ctx.webhookRuntime.dispatch()` を呼び、規則やセッションを待たずに `202` を返す。汎用 webhook ランタイム向けの認証済み GitHub 入口が要るデプロイで使うこと。

## 目次

- [設定](#configuration)
- [HTTP 契約](#http-contract)
- [専用リスナーコンポジション](#dedicated-listener-composition)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="configuration"></a>
## 設定

| キー | 意味 |
|---|---|
| `source` | 規則へ運ばれる空でないアダプター実体（例 `primary-github`）。 |
| `path` | 末尾斜線・クエリ・断片のない正確な非ルートパス名。 |
| `secretEnv` | GitHub webhook シークレットを含む資格情報参照。 |
| `maxBodyBytes` | 手付かず要求本体の正の安全整数上限。 |

すべての欄が必須である。秘密参照は要求ごとに解決されるため、交代はプラグイン再読み込みなしに次配送に影響する。

<a id="http-contract"></a>
## HTTP 契約

`POST application/json` のみ受け付ける。アダプターは上限付き UTF-8 本体を読み、`X-Hub-Signature-256`・`X-GitHub-Delivery`・`X-GitHub-Event` を要求し、秘密を解決し、JSON 構文解析の前に HMAC を検証し、最上位の無損失 JSON オブジェクトを要求する。秘密・署名・ペイロードを記録しない。

| 状態 | 意味 |
|---|---|
| `202` | 検証済み JSON をメモリ内で配送した。 |
| `400` | 必須ヘッダー・UTF-8・JSON・最上位オブジェクトのいずれかが不正だった。 |
| `401` | 署名が不正だった。 |
| `405` | メソッドが `POST` でなかった。 |
| `413` | 宣言または流し込み本体が `maxBodyBytes` を超えた。 |
| `415` | 媒体型が `application/json` でなかった。 |
| `503` | 資格情報または webhook ランタイムが利用不可だった。 |

`202` は規則が一致したこともセッションが作成されたことも述べない。GitHub イベント固有の欄検証は各規則に属し、アダプターは認証済み汎用 JSON のみを保証する。

<a id="dedicated-listener-composition"></a>
## 専用リスナーコンポジション

通常 Web プロファイルは既に `ctx.webServer` を所有する。`webServer` のみを分離するグループ内に別の `dsh-host-webserver` とこのアダプターをマウントする。アダプターは依然として資格情報と `webhookRuntime` を継承する。[GitHub レビューガイド](../../../docs/user/guide/github-review.md)は UI がポート 3080 のまま、TLS リバースプロキシ背後の `127.0.0.1:3081/github` を使う。

パッケージは `examples/github-review/` 配下にサンプルオーバーレイと規則モジュールを配布する。設置済みオーバーレイを読み込む前にこのパッケージと `dsh-webhook` ピアをプロファイルにインストールすること。[ガイド](../../../docs/user/guide/github-review.md)が完全なコマンドを示す。

<a id="model-experience"></a>
## モデル体験

間接的に `dsh-webhook` 越しに関わる。このアダプターはプロンプトもツールスキーマも寄与せず、一致する規則がセッション要求とモデル可視テキストを所有する。

#### KV キャッシュ効果

独立である。認証と HTTP 配送はモデル要求に触れず、新規セッション接頭辞は利用規則とランタイムに属する。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **TLS なし** — 注入開発 WebServer は通常 TLS リバースプロキシまたはトンネル背後のループバック限定である。
- **汎用ペイロード検証のみ** — 利用する GitHub イベント欄の検証は規則が所有する。
- **下流作業のプロバイダー承認なし** — `202` は任意の規則呼び出しとセッション作成に先行する。
- **フォーム符号化なし** — GitHub は `application/json` で送らなければならず、`application/x-www-form-urlencoded` は拒否される。


<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
