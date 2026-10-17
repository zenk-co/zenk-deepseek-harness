---
description: "Web の「Open In...」コントロール: ワークスペースディレクトリに対して記憶されたアプリケーションを起動するセッションヘッダーの分割ボタン、および 1 つのファイルに対するドキュメントプレビューの既定アプリケーションのオープンと reveal コントロール。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-open-in-app

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは、open-in-app 機能のブラウザサーフェスを提供する。セッションヘッダーの分割ボタンは、現在のセッションのワークスペースディレクトリ(サマリーの `cwd`)を記憶されたアプリケーションで開き、そのシェブロンはホストがインストール済みとして検出したすべてのカタログアプリケーションを一覧する。可用性、アイコン、起動は [`dsh-host-open-in-app`](../../host/open-in-app/README.md) のホストルートから提供されるため、2 つのパッケージを一緒にマウントすること。右サイドバーのドキュメントプレビューでは、「Open」分割ボタンと空状態ボタンが、Session Remote を通じて、プレビュー中のファイルを既定のアプリケーションで開くか、その場所を表示する。ケイパビリティを持たないホストでは、これらのコントロールは一切レンダリングされない。

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

このプラグインを Web 構成内で [`dsh-host-open-in-app`](../../host/open-in-app/README.md) の隣にマウントする。このペアが 2 つの cordis.yml 行で機能全体を構成し、この行は設定を取らない。ホストが少なくとも 1 つのインストール済みカタログアプリケーションを検出し、セッションに既知のワークスペースディレクトリがある場合、セッションヘッダーに「Open In...」分割ボタンが現れる。[`ui-sidebar-documentpreview`](../ui-sidebar-documentpreview/README.md) のドキュメントプレビューは、Host が Session Remote の `session.canOpenWorkspacePath` を通じてデスクトップを報告する場合にファイルコントロールを追加する。この行を削除すると、すべてのコントロールが一度に削除される。

### 期待される動作

セッションヘッダー、ファイルツリーヘッダー、ドキュメントヘッダーは、同じ 24px 高・角丸 9px の分割ボタンを使用する。これらのヘッダーはアイコンのみを表示し、ツールチップが既定のアプリケーションまたは reveal アクションの名前を示す。既定アクションのアイコンを表示し、メニュー内でそのアプリケーションに「(default)」の印を付け、自身のジェスチャーの実行中は無効化し、失敗は一時的なトーストで報告する。ファイルツリーのオープナーは `absolutePath` として渡される表示中のディレクトリを対象とし、アプリケーションの選択と起動状態をセッションヘッダーと共有する。ディレクトリアダプターは既存のクロスプラットフォームアプリケーションカタログを使用し、最後に成功した選択を `dsh.open-in-app.choice` に記憶する。選択がない場合は最初に利用可能なアプリケーションにフォールバックする。

**Open locally** ショートカットは、メインセッションのディレクトリと、ヘッダーボタンと同じ記憶されたアプリケーションを取得する。有効なバインディングはボタンのツールチップと `aria-keyshortcuts` に表示され、Web は[ショートカットサービスのプラットフォームデフォルト](../shortcuts/README.md)に従う。コマンドは、会話が選択されており、ヘッダーボタンに開くべきディレクトリとインストール済みアプリケーションがある場合にのみ実行される。実行中の起動もコマンドをブロックする。ポインターとキーボードのジェスチャーはコントローラーの起動状態を共有するため、繰り返しのジェスチャーで 2 回起動したり、起動中に記憶された選択が変わったりすることはない。

ファイルメニューは、検出された関連付けられたアプリケーションを一覧し、別個の「Open in default app」行は持たない。「Show file location」は、スクロールするアプリケーションから分離された固定フッターに表示される。利用可能なアクションが 1 つだけの成功したクエリでは、ドロップダウンなしの単一ボタンがレンダリングされる。ファイルの関連付けの初回ロード中は、グレーのスケルトンアイコンが使用される。Host が既定のアプリケーションを特定した場合、メニューはそれに「(default)」の印を付け、メインボタンがそれを開く。それ以外の場合は最初の関連付けられたアプリケーションがその位置を占めるため、メインボタンがファイルを reveal するのはアプリケーションが 1 つも登録されていない場合のみである。ディレクトリのメニューには reveal 行がない。ファイルのアプリケーションを選択してもシステムの既定は変わらない。プレビューできないファイルも同じメニューを、アイコンとアクションテキスト付きの 40px 高の分割ボタンで使用する。そのラベルは既定アクションに応じて「Open」または「Show file location」となる。

同じ関連付けリーダーと同じファイルを持つマウント済みコントロールは、1 つのクエリとその結果を共有する。どちらかのメニューを開くと、それらすべてが更新される。最後のコントロールが解放されると、クエリはキャンセルされ、その状態は破棄される。キャンセルされたクエリが別のファイルの結果を置き換えることはできない。クエリに失敗するとメニューにメッセージが表示され、reveal が既定アクションとして利用可能なまま残る。ファイルの関連付けの検出は [native-command](../../util/native-command/README.md) に従う。空の結果(検出アダプターを持たないプラットフォームを含む)は、コントロール内にプラットフォーム分岐を置かず、同じ reveal フォールバックを使用する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

両方のディレクトリスロットは、明示的な `absolutePath` を伴う `OpenInAppAction` を使用する。`conversation.session.header.utilities` 登録はセッションの cwd を読み取り、`sidebar.right.tab.files.actions` はオーナーから表示中のディレクトリを受け取る。プラグインは `open-in-app` 辞書を 1 つの effect として登録する。ページライフタイムのコントローラー([`src/client/controller.ts`](src/client/controller.ts))が、ページごとに 1 回の可用性読み取り、永続化された選択のスナップショットストア、起動の POST を所有する。コンポーネントは inject の `hooks` コンパートメントを通じて共有ソースを受け取るため、すべてのセッションヘッダーが 1 つの真実を共有する。ドキュメント相対のルート形式とワイヤペイロード型は、ホストパッケージのブラウザセーフな `@deepseek-ai/dsh-host-open-in-app/shared` サブパスから取得する。コントローラーは実行中の起動をガードし、取得したディレクトリとステータスを公開する。ヘッダーコントロールはそのソースから、遅延したビジー表示と一時的なエラーの視覚表現を導出する。

ディレクトリアダプターとファイルアダプターは、アプリケーションのメタデータと操作を [`OpenTargetButton`](src/client/OpenTargetButton.tsx) に提供する。このコンポーネントがメニューの並び順、既定のマーカー、アイコン、サイズ、ジェスチャーのフィードバックを所有する。ファイルヘッダーと空状態は `FileOpenTarget` を共有し、`OpenPathInjected.applications` は [`open-path.ts`](src/client/open-path.ts) を通じて `session.workspacePathApplications` をクエリする。オープンには `session.openWorkspacePath` を使用し、Host は起動前に明示的に選択されたハンドラーを再検証する。ディレクトリアダプターは既存のカタログルートを維持する。`FileRouteAction` は `deliverables.file.actions` と `deliverables.review.file.actions` を通じて、同じコントロールをデリバリーカードと変更レビューに提供する。それらの認証済みルートはセッションファイルの認可を保持する。したがって、失敗した、または利用できないファイルクエリに、プラットフォーム固有の UI 実装は必要ない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [dsh-host-open-in-app](../../host/open-in-app/README.md) — 可用性、アイコン、起動を提供するホストルートとその背後のカタログ。
- [dsh-session-log-export](../../session-query/session-log-export/README.md) — 姉妹のセッションヘッダーアクション。
- [ui-sidebar-documentpreview](../ui-sidebar-documentpreview/README.md) — ファイルコントロールが占有するヘッダーと空状態の子スロットを宣言するドキュメントプレビュー。
- [ui-deliverables](../ui-deliverables/README.md) — 宣言されたファイルを今も独自のルートで開くデリバリーカード。
- [Web クライアントアーキテクチャ](../../../docs/subsystems/web-client.md) — ブラウザプラグイン行がどのようにロードされスロットを登録するか。

-----

<a id="model-experience"></a>
## モデル体験

なし。分割ボタンはブラウザの UI であり、ここにあるものはモデルリクエストに到達しない。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立てることも送信することもない。

## 既知の制限と先送り作業

Host は、パスを開くまたは reveal する前に、構成済みファイルシステムを通じてパスを検証する。一致する Host マッピングを持たないパスは、ネイティブアプリケーションを起動せずに失敗する。既定のオープンはファイルタイプの関連付けに従い、HTML と SVG も含まれる。

<a id="known-limitations-and-deferred-work"></a>

- **辞書がメニューを制限する。** 両方の辞書に対応する `app.<id>` エントリがないホストカタログ拡張は、生の id を表示する代わりに非表示のままになる。カタログを拡張するときは、[`dsh-host-open-in-app`](../../host/open-in-app/README.md) とこのパッケージのロケールを一緒に拡張する必要がある。
- **可用性はページごとに 1 回読み取られる。** ページを開いている間にインストールされたアプリケーションは、リロード後(ホスト側ではホスト再起動後)に表示される。ファイルコントロールの背後のデスクトップの応答もページごとに 1 回読み取られる。
- **すべてのプラットフォームで 1 つの reveal ラベル。** Session Remote はデスクトップが存在するかどうかを報告するだけで、どのファイルマネージャーが動作しているかは報告しない。そのため、デリバリーカードのように Finder や File Explorer を名指しするのではなく、メニューには「Show file location」と表示される。
- **デリバリーカードは独自のオープナーを維持する。** [`ui-deliverables`](../ui-deliverables/README.md) は今も独自のセッション・イベントルートを通じて宣言されたファイルを開く。それらのカードをここでのファイルコントロールに統合することは先送りのままである。

<a id="dev-note"></a>
### Dev Note

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

ホストパッケージとこのサーフェスへの分割を含む機能レベルの決定は、[historical promotion Agent Note](../../../.agents/notes/archived/feature/2026-08-25-promote-open-anywhere-plugin.md) に記録されている。ドキュメントプレビューのファイルコントロールは、[historical default-application Agent Note](../../../.agents/notes/archived/feature/2026-09-16-open-in-default-app-for-sidebar-files.md) に記録されている。

</details>
