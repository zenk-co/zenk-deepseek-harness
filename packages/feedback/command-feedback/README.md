---
description: "セッションフィードバック: `/feedback` コマンド、Web フィードバックダイアログの背後の `sessionFeedback` Host Remote、固定のカテゴリ分類。フィードバックキャプチャを選択、構成、またはデバッグするユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-command-feedback

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-command-feedback` は、ユーザーがセッションについての意見をハーネスに伝えられるようにする。`/feedback` と所感を入力するとそれが記録され、セッションと匿名ユーザーの id が確認される。Web フィードバックダイアログは `sessionFeedback` Host Remote を通じてカテゴリとオプションの説明を記録する。記録は即時で、モデル作業を決して開始しない: モデルは所感を見ることも、それによって中断されることもない。このパッケージはさらに、すべてのフィードバックサーフェスが分類される固定のカテゴリ分類を所有する。標準の `dsh` ベースに同梱され、構成は不要である。ヘッドレス、ACP、JSON-RPC の各エントリーポイントはスラッシュコマンドを提供しない。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらなる探索](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

ユーザーは Web クライアントからすぐにフィードバックを記録できる: `/feedback` コマンドは標準の `dsh` ベースに同梱され、構成は不要で、どの conversation でも機能する。カスタムアプリは Session ストア、コマンドレジストリ、このプラグインを一緒にマウントすることで同じコマンドを得る。

### /feedback コマンド

`/feedback` に続けて所感を入力して送信する。成功したエントリーは受領したセッション id と匿名ユーザー id とともに確認される:

| 入力 | 結果 |
|---|---|
| `/feedback the diff view is unreadable` | 所感を記録し、2 行で確認する: `Feedback recorded for session {sessionId}` と `Anonymous user: {userId}.` |
| `/feedback` | 使用エラー: `Feedback text is required. Usage: /feedback <text>`。空白のみの入力は空とみなされる |

前後の空白はトリムされるが、それ以外は所感は入力されたとおりに保たれる: 切り詰め、大文字小文字の畳み込み、コマンド解析はない — `/feedback /plan felt slow` はそのリテラルテキストを記録する。各コマンドは自身のエントリーを記録し、何もマージまたは置換されない。

<a id="the-web-feedback-dialog"></a>
### Web フィードバックダイアログ

Web クライアントでは、テキストなしの `/feedback`（コンポーザーメニューから選ぶか、入力して送信する）が使用エラーの代わりにフィードバックダイアログを開く。ダイアログは以下の 7 つのカテゴリと自由記述ボックスを提供する。すべてのフィールドはオプションで、空の送信も受け付けられ、conversation ログはすべてのフィードバックイベントと同様に記録されたイベントとともに行く。ダイアログは `sessionFeedback.record` を通じて記録し、これがコマンドの帳簿付けなしで、確認行なしで同じ `feedback/record` イベントを追記する。代わりにダイアログはトーストを表示する。

| カテゴリ id | 意味 |
|---|---|
| `task-result` | タスクの結果 |
| `instruction-following` | 指示の理解と遵守 |
| `product-interaction` | プロダクト機能とインタラクション |
| `service-stability` | 安定性と速度 |
| `resource-cost` | リソース使用量とコスト |
| `security-privacy-permission` | セキュリティ、プライバシー、権限 |
| `other` | その他すべて |

これらの id はメッセージ単位フィードバックと共有される耐久性のあるログ語彙であり、ローカライズされたラベルは各サーフェスが所有する。

### 独自の UI からのフィードバック記録

フィードバックはスラッシュコマンドやダイアログから来る必要はない: 任意の UI、フック、ホスト統合が `recordFeedback` または `sessionFeedback` Remote を通じて直接所感を記録でき、同じ保証を得てモデルターンを消費しない。スラッシュコマンドを求めるカスタムアプリは Session ストア、コマンドレジストリ、このプラグインをマウントする。`sessionFeedback` Remote がライブ Session を解決するのは Session ストアからである:

```yaml
- id: session
  name: '@deepseek-ai/dsh-session'
- id: commands
  name: '@deepseek-ai/dsh-commands'
- id: command-feedback
  name: '@deepseek-ai/dsh-command-feedback'
```

Web クライアントはこのコマンドを同梱する。ヘッドレスモード、ACP 自動化、JSON-RPC はスラッシュコマンドを提供しないため、`/feedback` はそこでは利用できない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

### 設計概念

所感はセッションログ内の 1 つの追記専用の事実であり、それを生んだトリガーではなくイベントが所有する: フィードバックはコマンド、ダイアログ、任意の統合から届きうるので、その事実はスラッシュコマンドに依存してはならない。コマンドは自身の帳簿付けペイロードを空に保つので、所感のテキストはログ内のちょうど 1 か所に存在し、イベントはモデルに決して現れない。

### 所感が記録される仕組み

プロデューサーはテキストをトリムし、空のテキストを不在として記録し、エントリーがテキストもカテゴリも持たない場合でもセッションログに 1 つのイベントを書き込む。`/feedback` ハンドラーは空入力を自ら拒否し、それ以外は同じプロデューサー上の薄いラッパーである。`sessionFeedback.record` Remote も id でライブ Session を解決して同じプロデューサーを呼び、その id を持つライブオーナーがいない場合は `session-not-found` と応答する。どちらの経路もモデル作業を開始しない。書き込みは即時だがフラッシュされない: 確認はエントリーがログに到達したことを意味し、ディスクに到達したことを意味しない。ハーネスホームにつき最初に受理されたコマンド所感が、確認が報告する匿名ユーザー id も生成する。正確なプロデューサー契約は [`src/index.ts`](src/index.ts) にある。イベントペイロード、分類、Remote 語彙は [`src/types.ts`](src/types.ts) にある。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: `recordFeedback` プロデューサー、`sessionFeedback` Remote サービス、`/feedback` コマンド登録 |
| [`src/types.ts`](src/types.ts) | `feedback/record` イベント宣言、カテゴリ分類、Remote のリクエストおよび結果の型 |

</details>

-----

<a id="further-exploration"></a>
## さらなる探索

パッケージレベルの契約では足りないときにこれらのページを読むこと。このキャプチャ経路が依存するコマンドレジストリ、永続化、アイデンティティの事実を扱う。

- [dsh-commands](../../interaction/commands/README.md) — グローバルコマンドを発見するレジストリとその `recordInput` セマンティクス。
- [Session 永続化サブシステム](../../../docs/subsystems/persistence.md) — 追記されたイベントがどう耐久化されるか、フラッシュバリアが何を意味するか。
- [匿名ユーザーアイデンティティ](../../identity/anonymous-user-id/README.md) — 確認が報告する id。
- [ui-message-feedback](../../client/ui-message-feedback/README.md) — `sessionFeedback` Remote を通じて記録する Web フィードバックダイアログ。
- [フィードバックパッケージマップ](../README.md) — ログのみのキャプチャがメッセージ単位フィードバックの隣に位置するところ。

-----

<a id="model-experience"></a>
## モデル体験

### 人間による /feedback キャプチャ

#### モデルが見るもの

何もない。スラッシュ入力、ダイアログ、`feedback/record`、確認はモデルリクエストに現れない。フィードバックイベントとレジストリのライフサイクルレコードはログのみであり、`surfaceOp` を持たないので、順序付きサーフェス、`deriveMessages()`、システムプロンプトに決して到達しない。ターン中にフィードバックを記録しても、そのターンの残りのリクエストは変わらない。

#### トークン効果

直接のトークン効果はゼロ。受理されたエントリーも使用エラーも、記録したターンでもそれ以降のターンでもモデルトークンを追加しない。

#### KV キャッシュ効果

モデルリクエスト経路とは無関係である。記録はセッションログへの追記のみを行い、すでに再利用可能なリクエストプレフィックスをそのまま残す。このパッケージが寄与するものはキャッシュ再利用を無効化しえない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、セッションフィードバックが不向きな場合や、ユーザーが期待するのと異なる挙動をする場合を定義する。これらは現在のパッケージ制約であり、タスクバックログではない。

- **フィードバックの取得・管理サーフェスなし** — `feedback/record` の取得、集約、モデル向けツールは存在しない。
- **カテゴリとテキストのみ** — エントリーが持てるのは最大で 1 つのカテゴリと 1 つの自由記述文字列で、重要度や参照イベントのリンクはない。
- **Remote 経由ではライブ Session のみ** — `sessionFeedback.record` はライブオーナーが持たない Session に対して `session-not-found` と応答する。Web ダイアログは、開いている間にその Session が退役するとこの失敗を報告する。
- **修正・撤回なし** — セッションログは追記専用であり、このパッケージはトゥームストーンを追加しない。誤ったエントリーは記録されたまま残り、後続のエントリーで置き換えることしかできない。
- **明示的な耐久性バリアなし** — 確認はフラッシュではなく追記に続くので、クラッシュ直前に記録されたエントリーは他の未フラッシュのテールとともに失われうる。バリアを必要とするコンシューマーは `ctx.sessions.flush(session)` を待つ。
- **新しいセッションでは確認が見えない** — Web のトランスクリプトはセッションがアクティブになって初めてコマンド行をレンダリングするため、まだ空のセッションで入力された `/feedback <text>` はイベントを記録するが確認行を表示しない。ダイアログのトーストはトランスクリプトに依存しない。
- **同梱エントリーポイントのうち Web のみ** — ヘッドレスモード、ACP 自動化、JSON-RPC はコマンドアダプターを提供しないため、`/feedback` はそこでは利用できない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発メモはメンテナー向けの作業コンテキストであり、明示的に非権威である。出荷済みの挙動、制限、根拠は上記のセクションとパッケージコードにある。

- 確認の文とカテゴリの順序は [`tests/command-feedback.spec.ts`](tests/command-feedback.spec.ts) に固定されている。それらを変更するとユーザーに見える文言が変わる。
- 取得サーフェスは最初の制限の背後にある未解決の方向性である。現在の契約にはそのためのフォーマットを予約しているものはない。

</details>
