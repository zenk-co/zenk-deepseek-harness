---
description: "directory-picker シームのアプリ内ブラウズバックエンド: Web GUI ホスト向けの 1 階層ディレクトリ一覧と子ディレクトリ作成。リモートクライアントにも提供する。"
kind: "package-reference"
---

# @deepseek-ai/dsh-host-directory-picker-browse

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

OS チューザーに届かないユーザーは `dsh-host-directory-picker-browse` でワークスペースディレクトリを選ぶ。Node 標準ライブラリー上の 1 階層ディレクトリ一覧と子ディレクトリ作成を提供し、ホストディスプレイには何も描画しない — そのためネイティブバックエンドが届かないリモートクライアントに提供する。一覧はディレクトリのみを名前整列で返し、ディレクトリへのシンボリックリンクをたどり、ホスト所有の `hidden` フラグを付ける。作成は非再帰であり、単一パス部分を検証する。1 構成行はワークスペースフローのディレクトリ穴をアプリ内 **Select Workspace Directory** ダイアログでも埋める。

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

OS チューザーなしにワークスペースディレクトリを選ばなければならないときにこのバックエンドを構成する — リモートブラウザー、SSH 転送セッション、無人ホストである。ワークスペースフローは `directoryPicker/list` と `directoryPicker/createDirectory` を駆動する。両プリミティブはホストファイルシステムから答える。

### ディレクトリの一覧

`list(path?)` は 1 ディレクトリ階層を返す。名前整列の子ディレクトリとその絶対パス、`hidden` フラグ (POSIX ではドット始まり)、`home` アンカー、`crumbs` — すべての crumb がジャンプ対象であり、ルートは完全パスでラベル付けされるルートから対象への祖先鎖である。パス省略時はホストアカウントのホームディレクトリを一覧する。1 呼び出しは最大 `maxEntries` 行を返す (設定、既定 1,000 — GitHub Web UI がディレクトリ一覧に適用する上限)。切られた階層は `truncated: true` を報告するため、クライアントは階層が不完全と言える。ディレクトリへのシンボリックリンクはたどる。壊れたリンクと循環リンクはスキップされる。

### ディレクトリの作成

`createDirectory(path, name)` は既存親配下に子ディレクトリを 1 件作る。非再帰である — 欠落した親は発明すべき階層ではなく真の失敗である — 単一の非空白パス部分以外を拒否する (`name` は区切りを含んではならず、`.` や `..` であってはならない)。

### 観測可能な失敗

両プリミティブは完全修飾でないパスを拒否する — 相対形、Windows では `isAbsolute` が受け入れるルート付きドライブレス形 (`\foo`、`/foo`) と不完全 UNC 接頭辞 — をホストプロセス作業ディレクトリ配下に解決せず `directory-unreadable` または `directory-create-failed` で拒否する。既存子の作成は `directory-exists` で答える。呼び出し元の `AbortSignal` は進行中走査を止めるため、切断やタイムアウトが呼び出し元を過ぎて走査を残さない。

### 構成

| フィールド | デフォルト | 意味 |
|---|---|---|
| `maxEntries` | `1,000` | 1 一覧階層の完全結果上限。隠し行も数える |

生成済み[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-host-directory-picker-browse)が受け付ける全フィールドとその JSDoc の網羅的な情報源である。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

### 設計コンセプト

バックエンドは 1 ディレクトリ階層を制限付き名前整列ウィンドウで流すため、メモリーはディレクトリが何子を持とうと O(maxEntries) のままである。切られた階層は名前整列 head を保ち、隠し行は上限に数え、ウィンドウ入り候補のみ調査し、階層は `truncated: true` を報告する。ウィンドウ挿入は O(1) 完全ウィンドウ末尾拒否付き二分であり、大きすぎる階層は head 過ぎの候補ごとにウィンドウ走査ではなく O(1) で済む。

### 完全修飾フェンス

`fullyQualified` はプロセス状態にかかわらず 1 件の固定ファイルシステム位置を名指さないパスをすべて拒否する。POSIX では POSIX 絶対。Windows ではドライブ修飾 (`C:\…`) または完全 UNC (`\\server\share…`) 形のみである。ルート付きドライブレス形と不完全 UNC 接頭辞は `isAbsolute` を通過するが依然プロセスの現在ドライブに対して解決されるため、バックエンドはワイヤー値をリベースせずに拒否する。

### 中断と調査

すべてのファイルシステム await は呼び出し元シグナルと競合する (`raceAbort`) ため、停止したネットワークファイルシステムは去った呼び出し元の要求を生かし続けられない。捨てられた読み取りの遅延確定は飲み込む。シンボリックリンクの進入可否は `stat` 調査で決まる — 失敗は進入不可を意味する — ウィンドウ入りした壊れシンボリックリンクはウィンドウ外から補充されない。追い出しが既に階層を切り詰め済みと印付けたためである。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | `BrowseDirectoryPicker` サービス: 一覧、作成、制限ウィンドウ、エラー対応付け |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

バックエンド契約では足りないときにこれらを読むこと。まずシーム定義、次に決定記録とネイティブ代替へ進む。

- [Directory-picker シーム](../directory-picker/README.md) — `browse` ケイパビリティ契約と型付きエラー語彙。
- [Directory-picker ケイパビリティシーム決定](../../../.agents/notes/archived/architecture/2026-07-28-directory-picker-capability-seam.md) — 一覧と作成背後のポリシー決定。
- [ネイティブバックエンド](../directory-picker-native/README.md) — ローカルオペレーター向け OS チューザー代替。
- [適応チューザー](../directory-picker-auto/README.md) — 両バックエンド間の起動時解決。
- [生成済み設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-host-directory-picker-browse) — 受け付ける全設定フィールドとそのソース宣言。

-----

<a id="model-experience"></a>
## モデル体験

なし。GUI ホスト選択バックエンドはモデル向けに何も登録しないためである。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立てず送らない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は browse 操作が不完全または意図的に対象外の箇所を定める。現在のパッケージ制約であり、タスクバックログではない。

- **Windows 隠し属性は読まない** — Node dirent は `FILE_ATTRIBUTE_HIDDEN` を公開しないため、ネイティブ調査に見合うコストになるまで全プラットフォームで `hidden` はドット始まりを意味する。
- **ドライブルート列挙なし** — Windows では祖先はドライブルートで止まる。ドライブ横断はここでの列挙プリミティブではなくブラウザー UI のパス入力 affordance を待つ。
- **全ファイルシステム範囲** — デプロイメントごとの browse ルート制限はない。`workspace.create` は任意パスを受け入れるため、ここのルートはセキュリティ境界ではなく UX 範囲付けになる。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
