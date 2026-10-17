---
description: "dsh Web Client のテーマ、フォントサイズ、フォントファミリー設定: --dsw-* トークンのスタイルシート、ThemeRuntime の状態、全般設定の行、プラグイン読み込み前のブートストラップ。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-theme

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-client-ui-theme` は、Web GUI のユーザーが `light`、`dark`、`system` を選択し、設定でテキスト・コード・ターミナルのフォントとフォントサイズをそれぞれ個別に設定できるようにする。認証済みの各ブラウザーはこれらの値を `ui-theme` 設定名前空間に保存し、ローカルプロバイダーは既定で `$DSH_HOME/cordis.patch.yml` に永続化する。プラグインは `system` を `prefers-color-scheme` で解決し、不変の `ThemeSnapshot` を発行する。ui-layout が各スナップショットをドキュメントに適用する。このパッケージは `--dsw-*` トークンのスタイルシートも同梱し、選択されたパレット、フォントサイズ、フォントがシェルの読み込み前に適用されるよう同期ブートストラップを注入する。サードパーティのテーマは `ctx.theme` を通じてエイリアストークンのオーバーライドを登録できる。

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

ユーザーは設定（全般セクション）の行から配色、フォントサイズ、フォントを切り替える。選択は認証済みの各ブラウザーで再起動をまたいで永続化される。機能プラグインは `ctx.theme` を通じて現在のスナップショットを利用し、CSS で `--dsw-*` トークンを読む。テーマ状態を自ら管理することはない。

### 外観とフォントサイズ

プラグインは全般セクションに外観設定のキューブとテキストフォントサイズのステッパーを登録する。ステッパーの後の「その他のフォント設定」ボタンは、その下の領域を展開する。領域は設定を開くたびに折りたたまれ、テキスト・コード・ターミナルそれぞれのフォント行と、コードおよびターミナルのフォントサイズステッパーを含む。テキストのステッパーは 10〜22 px の整数値を受け付け、既定は 14 px。会話の見出しと基本テキストを同じ増分で変更する（ユーザーバブルとコンポーザーの下書きを含む）。フロー行のタイトル、要約、表は本文サイズより 1 段下に従い、小さいテキストは固定サイズを保つ。コードのステッパー（10〜16 px、既定 11）はコードブロックのサイズを設定する。インラインコードは 1 px 大きいまま、ツール出力の小型版も同じサイズを使う。ターミナルのステッパー（10〜20 px、既定 13）はサイドバーターミナルのセルのフォントサイズを設定する。変更してもシェルと出力は保たれ、グリッドは再フィットされる。受け入れられた各変更は Host 設定 API を通じて書き込まれる。急速な変更は名前空間リビジョン付きでジェスチャーの順序どおりに直列化され、最新の書き込みが拒否されると耐久値が再読み込みされる。

Desktop の固定ショートカット `Cmd`/`Ctrl` + `+`（または `=`）と `Cmd`/`Ctrl` + `-` は、テキスト・コード・ターミナルのフォントサイズをまとめて 1 px 変更する。それぞれ自身の範囲内で行う。物理キーを 1 回押すごとに変更されたフィールドが 1 回の設定変更で保存され、キーを押し続けても調整は繰り返されない。この操作はショートカット一覧に表示され、メインドキュメント内（ダイアログやテキスト入力欄を含む）で機能する。ただしローカルコントロールが入力を消費する場合を除く。ターミナル入力は独自のキー処理を保持する。Web はブラウザーのズームショートカットを保持する。

### フォント

3 つの行が、テキストフォント（インターフェースと会話のテキスト）、コードフォント（コードブロック、インラインコード、その他の `--ds-font-family-code` テキスト）、サイドバーターミナルのフォントをそれぞれ独立に設定する。各フィールドはカンマ区切りのフォントファミリー名を受け付け、フォーカスを外すか Enter で確定する。空のフィールドは組み込みスタックを復元する。サービスは各リストを正規化して、引用符、バックスラッシュ、山括弧、制御文字を取り除き、CSS の総称フォントファミリー以外のすべての名前を二重引用符で囲み、`textFontFamily`、`codeFontFamily`、`terminalFontFamily` のいずれかに保存する。ユーザーリストはそのロールの組み込みスタックの前に置かれるため、マシンにないフォントは既定にフォールバックする。フィールドはインストール済みの任意のフォント名を受け付けるが、ローカルフォントを列挙することはない。

### テーマの登録

コンポジションは `ctx.theme` を通じて、エイリアストークンのオーバーライド付きのサードパーティテーマ id を登録できる。オーバーライド層は登録順にアクティブスナップショットのトークンへ畳み込まれる。1 つを削除しても、最後の耐久組み込みプリファレンスが上書きされることは決してない。サードパーティテーマ id はプロセス内拡張のままであり、組み込み設定スキーマを跨ぐことはない。

### プラグイン前パレット

Host コンポジションが HTTP サーバーを含む場合、Host 側の半分は登録された `ui-theme` 設定、またはスキーマの既定値を各 index レスポンスに埋め込む。Head CSS はどのスクリプトよりも前にドキュメントキャンバスの配色を選択し、`system` プリファレンス用の `prefers-color-scheme` クエリも含む。その後 body スクリプトが、読み込みページとアプリケーションスクリプトより前に `body[data-ds-dark-theme]`、`--dsh-content-font-size`、`--dsh-code-font-size`、`--dsh-terminal-font-size`、および空でない各 `--dsh-font-family-<role>` リストを設定する。これにより最初の描画が選択されたパレットとテキスト・コードのサイズを使い、`ThemeRuntime` は既定を先に描画するのではなく保存されたサイズとフォントから開始する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

共有メニューは `--dsw-menu-surface-fill` を使い、`MenuSurface` を通じてぼかす。プラットフォームコードはこれらのトークン値を保持しなければならない。スティッキーなメニューグループ見出しは `--dsw-alias-menu-group-header-fill`（94% 不透明のライトまたはダークの塗り）を使える。これはメニューの素材とは独立である。他のオーバーレイは `--dsw-specific-menu` を使う。これはメニューの下地なしでほぼ不透明の macOS 塗りを保つ。強制されるソースルールは[スタイリングリファレンス](../../../docs/web-styling.md#component-rules)で定義されている。モーダルマスクは背景ぼかしなしの暗い半透明の塗りを保つ。

<details>
<summary>実装内部 — クリックして展開</summary>

サービスがテーマ、フォントサイズ、フォントファミリーの状態を所有し、スナップショットを発行する。ui-layout のプレゼンターがそれらのスナップショットを適用し、トークンシートが色と会話テキストのスケールを所有する。

### スタイルシート

`base.css` は共有の角丸スケール、フォントトークン、設定カードの素材エイリアスを所有する。`--dsh-font-family-text-default` と `--dsh-font-family-code-default` は `:root` に組み込みスタックを保持し、`body` では `--dsw-font-family` と `--ds-font-family-code` が `--dsh-font-family-text` と `--dsh-font-family-code` をそれらのスタックの前に置く。未設定のリストは組み込みスタックに解決される（1 回繰り返されるが、フォントマッチングはこれを無視する）。素材エイリアスはアクティブパレットと同じく `body` で解決される。コンポーネントの角丸半径を選ぶ際は [Web スタイリング](../../../docs/web-styling.md#corner-radii-and-settings-cards)に従うこと。

`src/styles/` は ui-theme の動的 Client エントリーによって順にインポートされる 8 つのシートを保持する: `base.css`、`corner-shape.css`、`design-platform.css`、`focus.css`、`onboarding.css`、`scrollbar.css`、`gradient-shadow-text.css`、`shiki.css`。Client バンドルはそれらをプラグイン所有のグローバルスタイルとしてコンパイル・注入するため、アンロードと HMR は ui-theme と一緒にそれらを除去する。`scrollbar.css` は `--dsw-alias-scrollbar-*` トークンを使い、それらを宣言する `design-platform.css` の後に続かなければならない。ステータスマークは独自の意味論的状態トークンを使う。`--dsw-alias-bg-document-selection` は、元のドキュメント色の上の選択範囲用に、両テーマで blue-500 を 40% 不透明度で使う。`design-platform.css` はコード差分の塗りエイリアスとその静的アルファパレット項目、さらにファイル比較用の `--dsw-alias-file-diff-*` コード、ガター、マーカーパレットも所有する。`shiki.css` は構文色を所有する。

[`focus.css`](src/styles/focus.css) は `:focus-visible` フォールバックを提供する。リング色は `var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))` で、標準幅は `--dsw-focus-ring-width` で指定し、outline style は決して使わない。したがってアウトラインを無効にしたコントロールは塗りを持たないままになり、リングを宣言しないコントロールは Chromium の `auto 1px` ではなく標準ジオメトリを保つ。テーマはこの青をライトモードで `#4176E6`、ダークモードで `#7AAAFF` に解決する。コンポーネントのアウトラインとフォーカスリングのシャドウも同じ色式を使い、子孫や疑似要素のリングも含む。`--dsw-focus-ring-width`（2px）が標準幅である。密な表とツールバーは 1px を保ってよく、オフセットはコンポーネント所有のままである。

ポインター入力モダリティでは、`html[data-input-modality='pointer'] body :focus-visible:not(:read-write)` がリング色を透明にする。子孫と疑似要素はその値を継承する。このルールは `box-shadow` をクリアしないため、エレベーションと選択状態のボーダーはリングの可視性とは独立のままである。`:read-write` に一致する編集可能テキストコントロールはクリック時に自身のフォーカスフィードバックを保つ。[入力モダリティ](../ui-primitives/README.md#input-modality)がキーボードフォーカススタイリングを再開する時期を決める。DOM フォーカスは移動しない。

メニューアイコンは `--dsw-alias-menu-icon` を使う。ライトモードでは neutral-bluish 800、ダークモードでは `label-primary-dimmed` である。

`base.css` は [プリミティブフォーカスヘルパー](../ui-primitives/README.md)が `data-dsh-automatic-focus` とマークしたフォーカス要素のアウトラインだけを抑制する。通常のキーボードフォーカススタイリング、ボーダー、シャドウ、エラー状態は無傷のままである。

システムトーストは `--dsw-alias-toast-bg` と `--dsw-alias-toast-label` を使い、呼び出し元間で共有の背景色とテキスト色にする。ドキュメントプレビューは `--dsw-alias-bg-document-preview` と `--dsw-alias-label-document-preview` を組み合わせ、背景とステータステキストが同じテーマに従うようにする。ツールチップのキーキャップは `--dsw-alias-tooltip-key-bg` を使う。各パレットのツールチップ背景から派生した、より明るい塗りである。スイッチのつまみは `--dsw-alias-switch-thumb` を読む: ライトモードでは白、ダークモードでは neutral-bluish 400。これによりオフのスイッチは、純白のまぶしさなしにトラックより明るいままになる。

`--dsw-alias-label-shimmer` は共有テキストシマー用のオーバーレイを提供する: ライトパレットでは 30% アルファの黒、ダークパレットでは 45% アルファの白。`--dsw-alias-label-deep-diving` と `--dsw-alias-label-deep-diving-shimmer` は青いアクティビティラベルとスイープを提供する。ダークパレットはより明るく彩度の低いラベルと、より明るい青のスイープを使う。

`--dsw-alias-turn-trigger-*` トークンは、各パレットで Turn トリガー通知用の休止背景とホバー背景を別々に提供する。ダークの通知はより明るいインタラクティブ層を使い、休止カードがトランスクリプト背景から区別されたままになるようにする。

`brand-font.css` はローカルの Montserrat Light、Regular、Medium フェイス（normal スタイル、ウェイト 300、400、500）をエクスポートし、`lib/styles/` に `montserrat-light.woff2`、`montserrat-regular.woff2`、`montserrat-medium.woff2` とその SIL Open Font License を置く。Desktop はオフラインのウェルカムブランドテキスト用に同じスタイルシート、フォント、ライセンスをバンドルする。通常の UI はシステムフォントスタックを保つ。

`corner-shape.css` はすべての角丸を滑らかにする: `@supports (corner-shape: superellipse(1.5))` の中で `--dsw-corner-shape` を定義し、ユニバーサルセレクターを通じてすべての要素とその `::before`/`::after` に適用するため、`corner-shape` を持たないエンジンは円形の角を保つ。完全な円形形状 — `border-radius: 50%` の円とピル半径 — は所有コンポーネントシートで `corner-shape: round` をその半径と組み合わせる。superellipse がそれらを変形させるためである。corner-shape スタイルシートの仕様は、すべてのパッケージスタイルシートにわたってその組み合わせを強制する。

`gradient-shadow-text.css` は `--dsh-content-font-size` から `--dsh-content-font-delta` を導出し、Markdown 見出しと基本テキストのはしごをその増分だけずらす。また第 2 階層 `--dsh-content-font-size-secondary`（設定値 14 以下なら −1、それより上なら −2。既定では 13px）を独自の `--dsh-content-font-delta-secondary` とともに導出し、表のバリアントと本文より 1 段下のフロー行に使う。密な small バリアントは固定のままである。コードバリアント（`--dsw-font-markdown-code`、`-code-block`、`-code-block-small`）はサイズと行高を `--dsh-code-font-delta`（`--dsh-code-font-size` と 11 px の差）だけずらす。はしごの外では、ユーザーバブルとコンポーザー下書きが本文ペアを直接読み、フロー行のタイトルと要約が secondary ペアを読む。このシートはシャドウスケール（`--dsw-shadow-lv*`）、半透明メニューの `--dsw-menu-backdrop-filter`、およびエレベーショントークンも所有する: `--dsw-elevation-stroke` は再バインド可能な `--dsw-elevation-stroke-color` を通じて 0.5px のヘアラインを描き、`--dsw-elevation-panel`/`--dsw-elevation-prominent`/`--dsw-elevation-soft`（コンポーザーの、より大きいぼかし・より低いアルファの階層）はそのストロークの上に 2 つの淡いソフトシャドウを重ねる。したがってエレベートされたサーフェスは `border: 0` を設定し、レイアウトを消費するアウトラインを持たない。派生トークンは要素ごとに再宣言されるため、サーフェスの stroke-color 再バインドが効く。`--dsw-specific-menu` を描くエレベートサーフェスは `backdrop-filter: var(--dsw-menu-backdrop-filter)` も適用する（[スタイリングリファレンス](../../../docs/web-styling.md#component-rules)）。ダークメニューは 45% 不透明のグレーの塗りと `border-l3` ストロークを使い、ライトメニューは `border-l1` ストロークを保つ。

`brand-font.css` はバンドルされた `montserrat-regular.woff2` / `montserrat-light.woff2` / `montserrat-medium.woff2` を参照する。Montserrat Regular、Light、Medium はスタイルシートに同梱の SIL Open Font License と `lib/styles/` 配下の WOFF2 による。`--dsw-font-family-brand` はブランドテキスト用にこのフェイスを選択し、通常の UI はシステムフォントスタックを保つ。ソースは Google Fonts の Montserrat ディストリビューションである。Web エントリーはパッケージの `./brand-font.css` エクスポートをインポートするため、Vite がフォントアセットを出力して解決する。Web ビルドはそのライセンスも含む。Web アプリケーションは Desktop オンボーディングを含め、フォントをオフラインで読み込む。ネイティブ資格情報のウェルカムはシステムフォントを保つ。

`onboarding.css` はオンボーディングのアクセント、violet/blue/cyan の名前付きグラデーション、およびライト/ダークのカード、チェックボックス、副次アクションの色を所有する。カードのシャドウオフセットとぼかしサイズは機能側が所有する。

### スクロールバーの再バインド

`scrollbar.css` は `body` 上の `--dsh-scrollbar-thumb` と `--dsh-scrollbar-thumb-hover` を l1 ベースサーフェストークンにバインドする。エレベートサーフェス（メニュー、ポップオーバー、ダイアログ）は自身のコンテナ上でそれらを l2 トークンに再バインドし、このペアのもう 1 つの正当なターゲットは `transparent` である（ui-sidebar はポインターが他所にある間、その列をそう再バインドする）。WebKit ベースのブラウザーは 5px の既定 `--dsh-scrollbar-width` を使い、`--dsh-scrollbar-thumb-border` と `--dsh-scrollbar-track-margin` も読む。スクロールサーフェスはそれらを再バインドして、より細い可視サムの周りに広いドラッグ可能レールを保つか、丸い端からトラックを内側に寄せることができる。2 つのレンダリング経路は構造上相互排他的である: Firefox は `@supports not selector(::-webkit-scrollbar)` 内の標準シンスクロールバーを取り、WebKit ベースのエンジンは疑似要素を取る。したがってジオメトリとホバーのカスタマイズは疑似要素経路にのみ適用される。

### プリファレンスの永続化

サービスはまずスキーマの既定値で自身を即座に提供し、その後 `ui-theme` 名前空間を読み込み、受け入れられた各テーマ、フォントサイズ、フォントファミリーの変更を Host 設定 API を通じて書き込む。プッシュされた設定変更と再接続は名前空間を再取得する。自身の書き込みが保留中の間、サービスは再取得されたセクションを無視するため、以前の書き込みのエコーが後の変更を取り消すことはできない。書き込みが落ち着くと耐久セクションを採用する。永続化の境界は [Host ベースのプリファレンスリファレンス](../ui-settings/README.md)が所有する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

これらのページはレイアウトプレゼンター、トークンの利用側、スタイリングルールを扱う。

- [ui-layout](../ui-layout/README.md) — 解決済みテーマスナップショットを適用するプレゼンター。
- [ui-sidebar](../ui-sidebar/README.md) — スクロールバー再バインド契約の利用側。
- [ui-conversation](../ui-conversation/README.md) — コンポーザーシートのために `--dsh-scrollbar-width` を利用する側。
- [Web スタイリング](../../../docs/web-styling.md) — Web Client コンポーネントの権威あるスタイリングルール。
- [認証済みブラウザーの Host プリファレンス](../../../.agents/notes/implemented/bug-fix/2026-09-15-authenticated-browser-host-preferences.md) — 永続化ポリシーの決定。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはブラウザー側の UI プラグイン層であり、モデルに面するものを何も登録しない。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立ても送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限がテーマ拡張サーフェスと色の権威を定義する。これらは現在のパッケージ制約である。

- **サードパーティテーマは拡張点であり、製品ではない** — 登録とは同名のエイリアス変数をオーバーライドすることであり、オーバーライドセットが完全であることを検証する仕組みは存在しない。
- **トークンシートが唯一の色の権威である** — デザインシステムにない値は意図的に追加されない。最も近い意味論的トークンが優先され、デザインオーナー承認済みの追加は同じ変更で静的ステップと意味論的エイリアスとして入る。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
