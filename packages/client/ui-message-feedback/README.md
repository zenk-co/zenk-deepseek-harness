---
description: "Web フィードバック面。確定済みアシスタントメッセージ操作行の Like/Dislike 対、その背後のフィードバックダイアログ（`/feedback` 対応）と承認・失敗トースト。フィードバック体験のユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-message-feedback

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは Web GUI のフィードバック面である。確定済みアシスタントメッセージの操作帯にある Like/Dislike 対、コンポーザーオーバーレイ内の承認・失敗トースト付きフィードバックダイアログ、素の `/feedback` からダイアログを開く装飾である。Like と Dislike はどちらもダイアログを開き、選択した評価を記録する前にカテゴリと任意の説明を集める。セッションごとに 1 面がすべてのエントリを支えるため、1 回の一覧読み取りが転写全体に種付けし、1 件のダイアログがセッションとそのメッセージに使える。評価・カテゴリ・記録はモデル文脈に決して入らないログ専用セッションイベントである。

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

`ui-conversation` と `ui-commands` のそばにこのプラグインをマウントする。Like/Dislike 対は各ターンの締めアシスタントメッセージの操作行にコピーと分岐の間に現れ、コンポーザーメニューのフィードバックは同一ダイアログを開く。`session-log-export` のマウントはセッションヘッダーの追加操作メニューにもフィードバックを追加する。記録済み評価は塗りつぶしグリフを表示し、ホバーなしで見えるままである。Like と Dislike はどちらもダイアログを開く。7 件のカテゴリチップと詳細欄は任意であり、送信は記入内容とともに選択判断を記録してからトーストで謝意を示す。会話ログはすべてのフィードバックイベントとともに運ばれる。記録済み評価のクリックはダイアログを開かずに撤回する。メニューから選ぶか本文なしで入力送信した素の `/feedback` はセッション用に同一ダイアログを開き、`/feedback <text>` はホストコマンドパスとその承認行を保つ。

### 失敗

評価や一覧読み込みの失敗は行内に表示され、送信失敗は警告トーストに表示されながらダイアログは開いたままなので下書きを修正できる。メッセージ入口に届くのは確定済みメッセージのみである。中断凍結の部分は `messageId` を持たないためフィードバック制御を持たない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このパッケージは ui-conversation が宣言し確定済みアシスタントメッセージの IconActions 行内に描画される `conversation.chat.assistant-actions` の `feedback` エントリ（順序 10）と、body ポータル経由でモーダルとトースト primitives を描画しマウントしたコンポーザーカード上にトーストを中央配置する `conversation.input.overlay` の `feedback-dialog` エントリ（順序 2）を提供する。`feedbackUi.openSession(sessionId)` クライアントサービスはフィードバックを記録せずに同一セッションスコープのダイアログを開く。ヘッダーメニューとコマンド装飾はどちらもそれを使う。`/feedback` 装飾は `ctx.commandUi.decorate` 経由で登録された `action` であり、メニュー選択や素の Enter はトリガートークンを消費してダイアログを開き、引数付き行は依然ホストコマンドに届く。

セッションごとに 1 件の `MessageFeedbackController` がすべてのメッセージ制御を支え、1 件の `FeedbackDialogController` がダイアログ下書き・送信・トースト順序を所有する。メッセージコントローラーは `messageFeedback.list` を 1 回読み、マウント時発火ではなく最初のホバーやフォーカスに遅延し、変更を直列化して各々が最終観測バージョンを運ぶ。`version-conflict` 応答は権威アイテムを運び、再取得なしでビューを調停する。いずれの評価操作の前にも行はコミット済みアイテムを確認する。一致する評価は `retract` を呼び、直列キュー内で評価を再確認し、並行変更後は無操作になる。他の状態は要求評価でダイアログを開く。ダイアログコントローラーは対象別に送信する。メッセージ対象はその評価をダイアログの記録とカテゴリとともにメッセージコントローラー経由で置き、セッション対象は `ctx.remote.sessionFeedback` 経由で記録する。成功は下書きを閉じて承認トーストを上げる。置換済み下書きからの遅い成功は新規下書きを閉じずにそのトーストを上げ、失敗は下書きを開いたまま長寿命の警告トーストを上げる。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

フィードバック面だけでは足りない場合にこれらのページを読む。ブラウザー帯からセッションログバックエンドと会話シェルへ進む。

- [dsh-message-feedback](../../feedback/message-feedback/README.md) — アイテムごとの compare-and-set と永続化を所有するセッションログバックエンド。
- [dsh-command-feedback](../../feedback/command-feedback/README.md) — `/feedback` コマンド、`sessionFeedback` リモート、カテゴリ分類。
- [ui-commands](../ui-commands/README.md) — `/feedback` 行が経るコマンド装飾契約。
- [ui-conversation](../ui-conversation/README.md) — アシスタント操作帯とコンポーザーオーバーレイを宣言する。
- [クライアントパッケージマップ](../README.md) — 隣接ブラウザー UI パッケージ。

-----

<a id="model-experience"></a>
## モデル体験

なし。評価・カテゴリ・記録はモデル入力ではなくログ専用イベントであるためである。任意のセッションログ配送はモデル文脈ではなくリクエストメタデータを使う。

#### KV キャッシュ効果

なし。フィードバック変更はモデル可視履歴を変更しない。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>


現行フィードバック面をこれらの制限が定義する。これらは一般評価比較でもタスクバックログでもなく現行パッケージ制約である。

- **記録サイズはホストポリシー** — 配置は `maxNoteBytes` を設定し（Web バンドルでは 8192）、ホストは過大記録を `note-too-large` で拒否する。ダイアログは制限を事前検査しないため、メッセージ用に過大な説明は入力中ではなく送信時に失敗する。セッション所感に上限はない。
- **タブ間プッシュなし** — 第 2 タブの評価は即時ではなく再接続時や次の競合応答時に見えるようになる。コントローラーはフィードバックログイベントを消費しない。
- **チャットビューのみ** — 軌跡とウォーターフォールビューは同一 `messageId` を持つアシスタントノードでもフィードバック制御を描画しない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
