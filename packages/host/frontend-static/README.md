---
description: "Web シェル用 SPA dist サーバー。Web サーバーフォールバック席を獲得し、トラバーサル拒否と SPA インデックスフォールバックでビルド済みフロントエンドを提供する。"
kind: "package-reference"
---

# @deepseek-ai/dsh-host-frontend-static

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

設定済み配布ディレクトリからブラウザーにビルド済み Web シェルを提供する。ルートと設定済みインデックスパスは bootstrap 済みインデックスを描画し、既存資産は直接提供され、欠落や非ファイルパスは 404、トラバーサルは 403、未対応メソッドは 405 を返す。インデックスアクセスは有効なプロセストークンまたはブラウザー Cookie を要求するが、静的資産は公開のままである。無一致経路を扱える実体は同時に 1 件のみであり、第 2 有効化は失敗し、活性実体の unload は無一致要求を 404 にする。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

ビルド済み Web シェルを提供するブラウザー向けホストにこのプラグインを構成する。Web サーバーのフォールバック席を獲得し、名前付き経路に一致しないすべての要求に答える。設定値は 1 件だけである。ビルド済みフロントエンドの `index.html` の場所である。

### 最小設定

```yaml
- name: '@deepseek-ai/dsh-host-frontend-static'
  config:
    distIndex: /absolute/path/to/dist/index.html
```

`distIndex` は構成アプリケーションの assembly 事実である。[`dsh-web-app`](../../bundle/web-app/README.md) がフロントエンドパッケージのエクスポート経由で解決してこのプラグインをマウントし、配置が直接書くことはない。

### サーバーが強制すること

要求は dist ルート（`distIndex` を含むディレクトリ）から提供される。dist ルートと設定済みインデックスパスは `index.html` を HTTP 200 で描画し、他の既存ファイルは MIME 型付きで直接提供され、未知拡張子は `application/octet-stream` で出荷される。ルート外に解決するパスは 403 で拒否されるため、細工パスは dist 上のファイルを読めない。dist ルート内の不在または非ファイル対象（欠落ファイル・ディレクトリ・欠落設定済みインデックス）は空 404 を返す。一致する名前付き経路のない非 GET/HEAD 要求は 405 で答える。成功したすべてのインデックス応答は Web サーバーの `renderIndex` 経由で描画されるため、起動マニフェストは `/` と設定済みインデックスパスの両方でページに届く。

提供 HTML は 1 件の文書 base `<base href="./">` をすべての注入リソース行より前に運ぶため、ページ読み込み元の入口ディレクトリを凍結する。シェル自身のアプリディレクトリ相対参照とホストのプラグインリソース行はどちらもページを提供したマウント下で解決する。同一インデックスは origin ルートと prefix 除去プロキシ所有の任意マウントに使える。このプラグインは dist ルートと設定済みインデックスパスにのみそれを描画する。

ルートと設定済みインデックス応答は HTML 読み取りの前に `ctx.connection.authorizeIndex` を呼ぶ。有効プロセストークンは 303 リダイレクトと永続ブラウザー Cookie を受け、既存有効 Cookie はインデックスを提供し、他のすべてのインデックス要求は Connection 所有の 401 応答を受ける。非インデックスファイルは公開静的資産のままである。トークン・Cookie・有効期限・署名記録の意味は Connection が所有する。

### 観測可能な失敗

トラバーサルは誤差ページではなく 403 を返す。dist ルート内の不在または非ファイル対象は空 404 を返すため、古いリンクや誤入力パス名は黙示 SPA フォールバックではなく明示失敗である。席の二重獲得は throw し、席が無獲得の間 Web サーバーは 404 で答える。このプラグインのファイバーが破棄された場合にブラウザーが見るのはそれである。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

### 設計概念

このパッケージは `serveStatic` を囲む 1 件の関数プラグインである。`apply` は `distIndex` から dist ルートを解決し、raw `index.html` 上で `ctx.webServer.renderIndex` を実行して開き head タグ直後に文書 base を挿入する（raw タップの後に行うため、それらの markup より前にもなる）`renderIndex` クロージャーを構築し、エフェクトスコープ下でフォールバックハンドラーを登録する。席は Web サーバー契約により単一所有であり、第 2 登録は throw し、エフェクトスコープであるためファイバー破棄は席を解放する。

### トラバーサル柵

`serveStatic` は要求パス名を正規化して dist ルートに結合し、対象がルート自身であるか配下に留まることを要求する。検査は `/` ではなく `sep` を使う。`resolve()` が Windows 上でバックスラッシュパスを出すためであり、`/ `接尾辞では正当な部分パスがすべてトラバーサルとして拒否される。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | `serveStatic` と `apply`。フォールバック獲得、トラバーサル拒否、インデックス描画、MIME 表 |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

提供契約だけでは足りない場合にこれらを読む。席所有者の契約、次に dist を解決する構成、サブシステムリファレンスである。

- [Webserver](../webserver/README.md) — このプラグインが獲得するフォールバック席とそれが実行するインデックスタップ。
- [dsh-web-app バンドル](../../bundle/web-app/README.md) — `distIndex` を解決してこのプラグインをマウントするアプリケーション。
- [HTTP サーバーサブシステム](../../../docs/subsystems/web-server.md) — フォールバック席が経路表にどう収まるか。
- [生成設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-host-frontend-static) — 受付可能なすべての設定フィールドとそのソース宣言。

-----

<a id="model-experience"></a>
## モデル体験

なし。SPA dist サーバーはブラウザー資産要求に答えるだけで、モデル向けには何も登録しないためである。

#### KV キャッシュ効果

なし。このパッケージはプロバイダーリクエストを組み立てず送信もしない。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>


提供資産種別がまだ対象外となる場合をこれらの制限が定義する。これらはタスクバックログではなく現行パッケージ制約である。

- **開始 MIME 表は最小** — Vite 出力資産集合と出荷 PWA マニフェストを対象とし、他の拡張子は資産種別が出荷されるまで `application/octet-stream` にフォールバックする。
- **パス名 routing は明示的** — 現行クライアントはルートまたは設定済みインデックスパスから入り、History API パス名経路はない。1 件追加するにはすべての miss に対する広いフォールバックではなく明示サーバー規則と実構成対象範囲が必要である。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
