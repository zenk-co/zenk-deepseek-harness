---
description: "送信済みユーザー文中の認識済み資格情報の Web 表示マスク。対話メッセージ内の値ごとの表示制御付き。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-secret-mask

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

共有画面やスクリーンショットで他人に見られ得るメッセージに Web ユーザーが API キー・トークン・パスワードを貼り付ける場合に `dsh-client-ui-secret-mask` を使う。送信済みユーザー文は認識済み資格値をマスクして描く。キーやトークンは先頭 8 文字を保持し、残りの各文字を `*` で描く。マスクは描画のみを変える。メッセージ文、コピー操作、モデル入力は元の文字を保つ。

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

`dsh-client-ui-conversation` のそばにパッケージをマウントする。Web アプリバンドルは既定でそれをマウントし、その行の除去は資格情報を書かれたとおりに描く。[UserText ファクトリー](../ui-conversation/README.md#sent-user-text)のすべての呼び出し側がマスクする。メッセージバブル、操舵メッセージ、保留エコー、キュー済みメッセージ、`/goal` 入力バブルである。

各マスク値は等幅フォントで描かれるため、表示しても周囲の文は動かない。送信済みメッセージや許容操舵メッセージである対話文は各走査の末尾に目制御を加える。その制御はその 1 値を表示または隠し、すべてのマウントはマスクで開始する。他の呼び出し側は制御なしでマスク値を描く。

<a id="what-is-masked"></a>
### マスク対象

| 値 | 例 | 表示 |
| --- | --- | --- |
| モデルサービスと Google API キー | 少なくとも 1 桁を含む `sk-…`、`AIza…` | 先頭 8 文字を保持 |
| コード hosting とパッケージレジストリトークン | `ghp_…`、`github_pat_…`、`glpat-…`、`npm_…`、`hf_…` | 先頭 8 文字を保持 |
| クラウドアクセスキー ID | `AKIA…`、`ASIA…`、`LTAI…`、`AKID…` | 先頭 8 文字を保持 |
| 協業と決済トークン | `xoxb-…`、`sk_live_…`、`rk_test_…`、`whsec_…` | 先頭 8 文字を保持 |
| JSON Web トークン | `eyJ….eyJ….…` | 先頭 8 文字を保持 |
| 秘密鍵ブロック | `-----BEGIN … PRIVATE KEY-----` からその `END` 行まで | `BEGIN` 行と `END` 行および改行を保持 |
| アドレスパスワード | `postgres://user:password@host/db` | トークンを含めパスワードを完全マスク |

`password=…` や `API_KEY=…` のような名前付き代入、文中に書かれたパスワード、検証コード、個人データは公開形式がなく、書かれたとおりのままである。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このプラグインは UserText 照合器 `secret` 1 件とそのキー付き `conversation.user.text.node` 描画器を登録する。`/client` エクスポートはプラグイン本体（`apply`/`inject`）のみである。照合器は Facts を読まないため、Facts 更新がそれを再照会することはない。各照会は要求 offset 以降の最近傍資格値を返し、それより前には何も割り当てない。リテラルのみ alternation が形式開始位置を見つけ、リテラル接尾辞が他リテラルを開始できる場所では走査はその接尾辞から再開する。形式検査は有界文字比較と sticky `[class]*` パターンであり、種別外の最初の文字で停止し、遡及する余地を残さない。`apply` が作成する照合器実体は走査末尾・次桁・次秘密鍵 `END` 行を文ごとに照会間で memo 化するため、1 文の全照会は合わせて線形時間であり、実体は他文への照会まで最終照会文を保持する。等しい開始では秘密鍵・アドレスパスワード・接頭辞形式がその順に勝ち、重なるすべての候補はそのマスク下の最初に加わる。アドレスの `://` が要求 offset より前にある場合、照合器は offset 後に `:`・パスワード・`@` が続く場合に限りユーザー名上を戻るため、アドレス内の任意位置からの照会は同一パスワードを見つける。[ユーザー文 benchmark](../../../benchmarks/user-text/user-text.bench.client.ts) は資格値ありなし文、線形 scaling、照合器割り当ての評価時間を抑える（[根拠](../../../.agents/notes/implemented/testing/2026-10-11-user-text-credential-matching.md)）。

ノード payload はマスク表示文のみを運ぶ。描画器は `*` の各走査を中央印として描きながら、複写と支援技術のために文字を保持する。フォント自体のアスタリスクが cap 高さ付近にあるためである。元のノード文とその文を切り替え、旗ではなく表示済み元の値を覚えるため、同一位置の異なる資格値はマスクで開始する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [ui-conversation 送信済みユーザー文](../ui-conversation/README.md#sent-user-text) — 照合器レジストリ、scheduler、ノード描画器スロット。
- [ユーザー文候補 scheduling](../../../.agents/notes/implemented/architecture/2026-10-10-user-text-json-nodes.md) — この照合器が従う前方照会とキャッシュ規則。
- [資格値照合性能](../../../.agents/notes/implemented/testing/2026-10-11-user-text-credential-matching.md) — 線形照合器、その部分ごとの計算量と tradeoff、時間と割り当て gate。

-----

<a id="model-experience"></a>
## モデル体験

なし。マスクはブラウザー描画のみを変え、メッセージ文とモデル入力は元の文字を保つためである。

#### KV キャッシュ効果

なし。このパッケージはプロバイダーリクエストを組み立てず送信もしない。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

資格値が書かれたとおりに描かれる場合をこれらの制限が定義する。これらは現行パッケージ制約である。

- **認識には公開形式が必要** — [認識形式](#what-is-masked)のいずれも持たない資格値は書かれたとおりに描かれる。名前付き代入は通常値にも同じ名前が付くため平文のままである。たとえばトークン使用量などである。
- **UserText 呼び出し側のみがマスクする** — セッション題名、ターン preview、検索抜粋、ゴールバー、ツールカード、アシスタント応答、未送信コンポーザーは資格値を書かれたとおりに描く。
- **以前の参照は自文を描く** — `@config/<key>.txt` のようなファイル言及など、その前に始まる参照内の資格値はその参照が描く。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
