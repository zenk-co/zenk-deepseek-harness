---
description: "Web GUI 向け入力トリガーパイプライン。キャレット下の / と @ 検出、グループ化候補メニュー、登録ソースへの選択ルーティング。スラッシュコマンドと参照のユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-input-trigger

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Web GUI でユーザーがキャレット位置に `/` や `@` を打つと、このパッケージはスラッシュコマンド・ファイル参照・セッション参照向けのグループ化メニューを開く。ドリルダウン選択や現選択上に単一候補グループを開くランチャーを含め、キーボードとポインター選択に対応する。選択はコマンドフローを呼ぶか、消費入力面が扱う参照を挿入する。このパッケージはブラウザー提示にのみ影響し、モデルリクエストを組立も送信もしない。

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

`ui-conversation` と並べてこのプラグインをマウントすると、ユーザーがキャレット下にトリガーを打ったときに入力オーバーレイ内にメニューが現れる。グループ化候補はタイトル行の下、またはソースが自身の行に付す節見出しの下に描画される。選択はソースへルーティングされ、消費面が結果を適用する。すなわちスラッシュコマンドはポップアップを開くか実行し、参照はインライントークンを挿入する。メニューアイコンと移動シェブロンは `--dsw-alias-menu-icon` 色を使う。行はアイコン、タイトル（候補 `label`、なければ `name`）、ラベルが別字遣いの名前と異なる場合の末尾別名としての `name`、右寄せ説明を示し、クエリーは名前またはラベルのいずれかに一致する。

### キーボードとマウス

コンポーザー面はメニュー表示中も焦点を保持する。行は mousedown で選択され、強調は `aria-activedescendant` に乗り、メニューとコンポーザーカードの両外側のポインター押下はそれを閉じる。ランチャーボタンから開くとメニューが開く前にキーボードがエディターへ戻るため、矢印はそこで駆動する。Space と Enter 裁定は任意 `matchSpace`/`matchEnter` フックを登録順に照会する。最初の非 undefined 回答が勝ち、ソースは全体消費できない投入を拒める。永続コマンドチップの復元は任意 `matchClaim` フックを `resolveClaim` 経由で照会する。ソース自身の warmup を await し、請求にのみ答え、ポップアップを開くこともアクション実行もコマンド実行もしない。Tab は強調補完に作用する。`drill: true` を宣言する候補は `action: 'drill'` 付き `onPick` 経由でルーティングされ、通常候補は `action: 'pick'` 経由で確定する。強調なしの Tab はそのまま通過し、ネイティブ焦点移動が生き残る。Escape と Shift+Tab は代わりにメニューを離れ、確定しない。終了 gesture は下書きを消費も書換えもできない。閉じたメニューは閉じたままである。同じクエリーで再追跡された同じトークンはメニューを閉じたままにするため、ポインター閉鎖後のキャレット復元や確定コマンドが開いた面を閉じたことがメニューを復活させることはない。新しいクエリーを打つか別のトークンへ移動すると再 armed される。ドリル可能行の末尾シェブロンは同じ第 2 動詞をポインターユーザーに公開する。任意 `header` フックを実装するソースはさらにそのグループ上に crumb を公開する。パイプラインはライブクエリーと、入力ではなくドリルが生んだかを添えて毎ヒット再照会し、crumb 選択は `action: 'drill'` 付き `onPick` 経由で戻る。

ソースは下書き参照を投入せず開くために `openReference(session, reference)` を実装できる。受諾は非同期カタログ読み込みに先行しうる。チップはソース名でルーティングされ、編集可能トークンは現ソース語彙経由でルーティングされる。`false` 戻り、ソース欠如、破棄済みコントローラーはエディター gesture を不変のままにする。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

メニューは macOS 背景 blur 用裏付けを含む共有 `MenuSurface` 素材を使う。カスタム内容は[メニュールール](../../../docs/web-styling.md#component-rules)に従う。

<details>
<summary>実装の内部 — クリックして展開</summary>

`src/core/` は純粋コアであり、トリガー検出・メニュー縮約・完全一致で、React/DOM/cordis ゼロである。一方 `src/client/service.ts` はコアをメニュースナップショットストア、ヒットごとの候補取得（世代 gate、`AbortSignal` 置換、失敗ソースは console 記録付きで黙って落とす）、選択パスへ配線する。1 つの `InputTriggerController` がセッションスコープごと（`sessionOf`）に解決し、会話配線層がコントローラー上で `track`/`arbitrate`/`onSpace`/`adjudicate` を駆動する。ソースは到達できるすべてのセッションコントローラーへ warm される。warm 後に `lexicon` が変わるソースは `subscribeLexicon` を実装し、コントローラーは各通知で再照会する。`MenuView` は `conversation.input.overlay` へ自登録し（list 種、セッションスコープ）、閉じている間は null を描画する。`listbox` role は境界シェルではなくスクロール視口上にあり、パンくずヘッダーが選択肢ではなく listbox がそれを運べないためである。crumb はメニューストアの隣に自身のスナップショットストアに乗り、凍結 reducer はそれらを知らない。オーバーレイ SlotMap マージは依存方向（ui-conversation → ui-input-trigger）が逆方向型 import を許さないためここにある。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

トリガーパイプラインでは足りないときに、これらのページを読む。パイプラインからそこへ登録するソースと入力を所有するシェルへと進む。

- [ui-commands](../ui-commands/README.md) — このパイプラインに `/` コマンドソースを登録し、コマンドポップアップシェルを所有する。
- [ui-reference](../ui-reference/README.md) — `@` ファイル・セッション参照ソースを登録する。
- [ui-conversation](../ui-conversation/README.md) — 入力オーバーレイスロットを宣言し、コンポーザーと入力機構を所有する。
- [Web クライアントアーキテクチャ](../../../docs/subsystems/web-client.md) — ブラウザープラグイン行の読み込みとスロット登録の仕組み。

-----

<a id="model-experience"></a>
## モデル体験

なし。トリガーパイプラインはブラウザー提示専用であるため。選択はコマンド請求と参照挿入を生み、そのモデル可視の帰結は消費 host と入力機構パッケージが所有する。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組立も送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


現在のトリガーパイプラインを定める。これらは現在のパッケージ制約であり、一般メニュー比較やタスク backlog ではない。

- **グローバルソース層のみ** — セッションスコープソース登録（セッションごとの影付け）は設計済みだが有効ではない。台帳はトリガー条件を追跡する。真のセッションごとソースが必要である。
- **オーバーレイ SlotMap マージの home はスロット所有から分離している** — 唯一の `conversation.input.overlay` マージはここにあり、ui-conversation がその錨、子宣言、ライフサイクルを所有する。依存方向が ui-conversation → ui-input-trigger であるためである。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
