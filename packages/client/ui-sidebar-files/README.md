---
description: "dsh Web クライアント用右サイドバーのファイルツリータブ種別。セッションワークスペースルートを有線上で 1 階層ずつ一覧し、ファイルをリソースアドレスでサイドバーに開く。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-sidebar-files

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

セッションのワークスペースツリーを閲覧し、ファイルをサイドバー preview で開く。ルートと展開済みディレクトリは直接入口監視から自動更新され、手動再読み込みも利用可能である。タブは案内から到達し、リソースアドレスを主張しない。

## 目次

- [登録内容](#what-it-registers)
- [ツリー](#the-tree)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="what-it-registers"></a>
## 登録内容

`workspace.files` コマンドは集中 pane のファイルページを開くか集中する。会話からは現行セッションの活性 dock pane を使う。案内はファイルページに譲り、繰り返しオープンは pane ごとにファイルページ 1 件を保持する。Desktop は既定で Mod+P である。案内入口は実効 shortcut を表示する。Windows と macOS Web は[shortcut サービスの平台既定値](../shortcuts/README.md)を使い、Linux Web は既定でこのコマンドを無束縛のままにする。

- **種別** — 種類 `files`、id `@deepseek-ai/dsh-client-ui-sidebar-files`、band `builtin`、pattern なし、案内入口 1 件（順序 10、その題名と説明は `sidebarFiles` 名前空間から、その glyph は黄 folder）で `ctx.sidebarRightTabs.register(...)` し、その種別を開く。
- **本体** — その id 配下のキー付き `sidebar.right.pane.tab` 席。帯下のヘッダー行、次にツリーである。共有 [`PathLabel`](../ui-primitives/README.md#component-catalog) は抑制ディレクトリと primary 最終区分でルートパスを表示する。切り詰めパスは左端 fade 付きで末尾文字を保持し、ホバーは全パスを現す。再読み込み制御とセッションスコープの `sidebar.right.tab.files.actions` 一覧はその右に残り、表示ルートを `absolutePath` として渡す。[`ui-open-in-app`](../ui-open-in-app/README.md) はワークスペースディレクトリオープナーを寄与する。
- **chip 題名** — その id 配下のキー付き `sidebar.right.pane.tab.title` 席。種別ラベルの前に 16px 共有 `FileTypeIcon` folder glyph である。ツリー自体の行はこの sheet を描かない。

`src/client/` 配下のソースファイル。`definition.tsx`（種別）、`store.ts`（保持内容）、`face.ts`（リモート読み取りと監視）、`directory-node.ts`（開いたディレクトリとその寿命）、`FilesBody.tsx`（描画内容とその順序・失敗行ヘルパー）、`FilesTitle.tsx`（chip 題名）、`locales.ts`（文言）、`index.ts`（配線）である。

<a id="the-tree"></a>
## ツリー

ルートはセッション作業ディレクトリであり、`useSessions().byId[sessionId].cwd` から読む。`/` や Windows drive ルートのようなファイルシステムルートは有効なツリールートである。すべての階層は絶対パスでキー付けされ、子のパスは入口名を `/` で結合した親のものである。階層は最初に展開されたときに `@deepseek-ai/dsh-api-workspace-files` 名前空間上の `remote.workspaceFiles.list(sessionId, absolutePath)` 経由で一覧される。適合器は一覧の入口と切詰旗を保持し、そのワークスペース相対パスを落とす。行はディレクトリ優先、次に自然・大文字小文字不区別の名前順であり、dotfile は他の入口と同様に表示される。

| 入口種別 | 行 |
|---|---|
| `directory` | 切替。再オープンは再一覧し、残存する展開済み子孫を復元する。表示済み入口は折り畳み中も cache されたままである。 |
| `file` | `dsh-resource://file/session/<sessionId>/<ルート相対の符号化パス>` を開く。入口絶対パスとツリールートから `@deepseek-ai/dsh-util-workspace-path` 由来の `fileAddressFor` が構築し、`useTabInfo().tab.actions.openResource` 経由でタブ自体の pane に着地する。 |
| `other` | 灰色表示でクリック不可であり、ディレクトリを全体として報告する。 |

端点の入口上限で切れた階層は marker で終わり、空階層はその旨を述べ、失敗した階層は code ごとに 1 行（`workspace-file/not-found`、`outside-workspace`、`not-directory`）を示し、それ以外は転送自体のメッセージである。再読み込みはルートと展開済み階層をその場で更新し、読み取り中は表示済み入口を保持してツリー全体を reset しない。折り畳み済み階層は次に開くときに再取得される。作業ディレクトリのないセッションはツリーの代わりに 1 行を示す。

状態は種別自体の store にあり、タブ id ごとに bucket 化される。`root`、`levels`（絶対パスごとの読み込み中/準備完了/失敗）、`expanded`、`autoRefresh`、`scrollTop` であり、body は scroll 中に局所追跡し、unmount 時に 1 回 commit する。store は body より長生きするため、他サイドバータブへの切替と復帰は階層を保ったままツリーを再マウントし、scroll offset を復元する。所有者の `signal` は bucket を終える。中断時にタブは忘れられ、その後に解決する一覧も unmount の offset commit も何も書かない。

開いた各 `DirectoryNode` はタブ寿命の間その対象監視を所有する。折り畳みはそのノードと隠れた子孫を閉じる。祖先復元中の展開変更は store と保留ノードを更新するため、復元子孫は最新の展開設定に従う。自動更新は既定で有効であり、その別トグルは状態・ラベル・様式・トグル logic が残ったまま隠される。ディレクトリ読み取り中やその完了時に受けた変更は別更新用に保留のまま残る。

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはブラウザーにワークスペースファイルツリーを描くだけで、モデル向けには何も登録しないためである。

#### KV キャッシュ効果

なし。ディレクトリ一覧はリモート上を運ばれ、モデル要求を組み立てない。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>
- **一覧のみ。** 検索、成果物絞り込み、ドラッグ＆ドロップ、改名、context メニュー、現行ファイル強調はない。
- **単一ルート。** ツリーはセッション作業ディレクトリに根差し、その上を閲覧する方法はなく、ホストはワークスペースルート外パスをいずれにせよ拒否する。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

ページ更新 shortcut は通常のディレクトリ読み手経由で集中ファイルツリーを更新する。再読み込み制御はホバーとキーボードフォーカスで実効束縛を表示する。

</details>
