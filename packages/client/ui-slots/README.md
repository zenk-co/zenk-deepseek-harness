---
description: "dsh Web クライアント向けスロットレジストリ純粋コア。通常拡張スロット、再利用可能コンポーネントファクトリー、導出 props 型、ストア席、レンダラー導入契約。"
kind: "package-library"
---

# @deepseek-ai/dsh-client-ui-slots

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-client-ui-slots` を使うと、Web クライアントプラグインは型付き UI 領域を定義・合成できる。通常スロットは親所有の拡張位置を提供し、コンポーネントファクトリーは呼び出し元選択のローカルコンポーネントを持つ再利用可能アセンブリを提供する。両 API は宣言マージ型からスコープ付き状態・注入・ロケール・子描画 props を導出し、プラグイン読み込み中に競合定義を報告する。クライアントに描画が必要な場合は、この React フリーのパッケージを `ui-renderer` と対にする。

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

クライアントプラグインを書くときは常にこのパッケージ経由で UI を合成する。親が宣言したスロットにコンポーネントを登録するか、自身のコンポーネントが描画する子スロットを宣言する。4 種類が合成形状をカバーする。`single`（占有者 1 件）、`list`（順序付きエントリ）、`keyed`（キーによる振分）、`chain`（エントリが自薦）である。

### 再利用可能コンポーネントファクトリー

デザイナーは、再利用可能と考えるコンポーネントやアセンブリに、現在の呼び出し元が 1 件でもコンポーネントファクトリーを選べる。無関係な親、別パッケージ、追加の注入やローカルスロットは前提条件ではない。単発コンポーネントはファクトリーを使う必要はない。完全な型を `SlotFactoryMap` で宣言し、定義を `ctx.slots.registerFactory()` で導入し、出現を注入済み `renderFactorySlot()` 経由で描画し、宣言済み各ローカルコンポーネントを呼び出しの `slots` オプション経由で選択する。定義はその選択を `useFactorySlot(name, fallback)` 経由で読む。
ファクトリー `children` は通常のグローバルスロットのまま `SlotMap` に一致しなければならず、ローカル `slots` は出現ごとにコンポーネントを 1 件選択する。出現は描画位置スコープを継承し、`renderFactorySlot()` はセッション identity を受け付けない。共有ストアハンドルは通常スコープ解決を使う。ストアファクトリーは出現が最初に実体化するまで遅延のままであり、その描画位置向けにハンドルを 1 件作り、出現をまたいで衝突する永続ストア仕様を拒む。

### 5 つのフレームワーク props 共有

登録済みすべてのコンポーネントは 5 つのフレームワーク共有から合成された props を受け取る。ランタイム共有（親の描画呼び出し位置由来 `owner` とセッション標準キット・グローバル席）、子描画共有（宣言子へ静的に絞られた `renderSlot`）、ファクトリー描画共有（`renderFactorySlot`）、ストア共有（宣言ハンドルのセレクターフックと draft 除去済みアクション）、業務共有（`inject` から推論）である。コンポーネントは導出 props 別名を参照し、共有をローカルに再型付けしない。
オープンキー標準フックは `useName(key, selector?, equal?)` として呼ばれ、`useName(key, member)` も受け付ける。文字列第 2 引数は `KeyedStandardSource` リゾルバーの `(key, member)` ソースをセレクターなしに読む。リゾルバーはそのソース生存中に同じ引数へ同じソースオブジェクトを返す。

### ストア席

登録呼び出しは `store: defineStore(...)` でストア席を宣言できる。`init` は状態スキーマを推論し、`actions` は完全な draft 変換書き込み集合である。コンポーネントはセレクターフック経由で読み、焼き込み済みコールバック経由で書く。`defineStore` のエンジン実装はランタイムパッケージにあり、ここで公開する `DefineStore` 契約を満たす。

### 宣言規律

スロット宣言は主張である。登録エントリはそのキーを描画できる唯一のエントリとなり、未宣言スロットへの登録、既宣言子の再宣言、2 スコープ下での 1 共有ハンドルのマウント、`select` なし chain 登録は読み込み時に throw する。エントリの破棄子は宣言子スロットを再帰的に畳む。台帳行、寄与、ストアマウントは 1 つのライフサイクル軸で死ぬ。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

通常スロット設計は 1 テーブルである。宣言＝描画認可＝ランタイム仕様である。`SlotMap` はここでは空に宣言され、消費者が `declare module` 拡張経由でマージする。`SlotFactoryMap` や標準キットインターフェース（`SessionStandardProps`、`GlobalStandardProps`）とまったく同じである。ファクトリー定義は別個の単一定義台帳を使う。出現に親宣言がないためである。

### 登録とルーティング

`SlotCore` は構築時にアプリオリ `'root'` スロットを植え、読み込み時検証を強制する。`ChainSelect` セレクターは昇順 `priority` 順に実行し（同点は登録順）、最初の非 null 戻りがそのエントリを選出してコンポーネントの `matched` prop となり、全 null は所有者の `renderSlotChain` フォールバック（`ChainRenderOpts`）に落ちる。各キーは宣言と畳みにのみ進む宣言エポックを運び、`ui-renderer` は通常エントリバージョンから独立にそれを `ctx.slots.inject` に使う。ライブ検査は厳密な `type: 'slot' | 'factory'` ノードを使い、ファクトリー所有の子スロットをその定義下にネストする。

### レンダラー契約

`renderer.ts` は導入契約（`SlotRenderer`、`SlotRendererHost`）と `StaleAuthorizationError`/`SlotOwnershipError` を運ぶ。ui-renderer が実装とそのプラグインライフサイクル導入の両方を所有する。エンジン成果物とレンダラー host 契約は素のスナップショットソース（`getSnapshot`/`subscribe`）を運び、React フックは決して運ばない。フック結合は描画機構に属する。ファクトリークラッシュは通常監督チャネルを使い、冪等エフェクトはコミット後にのみ位置ごとのストアハンドルを保持する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

これらのページはエンジン、レンダラー、合成モデルを扱う。

- [ui-renderer](../ui-renderer/README.md) — このパッケージの導入契約を実装する React スロットレンダラー。
- [スロットシステム標準](../../../.agents/notes/implemented/architecture/2026-07-22-slot-type-chain-implementation.md) — 決定的合成モデル。
- [コンポーネントファクトリー](../../../.agents/notes/implemented/architecture/2026-09-10-component-factories-and-local-slots.md) — 再利用可能定義、ローカルコンポーネント選択、出現寿命。
- [Web クライアントアーキテクチャ](../../../docs/subsystems/web-client.md) — このレジストリが差さる読み込み連鎖とオブジェクト層。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはモデル向けに何も登録しないブラウザー側 UI プラグイン層であるためである。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組立も送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


レジストリのスケーリング動作と受容済み型ノイズを定める。これらは現在のパッケージ制約である。

- **`isLive` は全レコードを線形走査する** — UI プラグイン登録数（数十件）では問題ない。台帳がホットになることがあればエントリ→レコード逆参照で見直す。
- **`__renders` ファントムアンカーは `PropsRenderSlots` に可視である** — 型連鎖設計の `__accepts` と同じ受容済みノイズである。汎用メソッドシグネチャはキー和集合をまたいで緩く比較するため、反変マーカーが「コンポーネントキー集合 ⊆ 子宣言」を強制するものである。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
