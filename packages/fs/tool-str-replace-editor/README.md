---
description: "ctx.fs 上のスタンドアロン str_replace_editor ツール。エージェント向け Claude-Code 式ファイル編集を構成するユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-str-replace-editor

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-tool-str-replace-editor` は `ctx.fs` 上のスタンドアロンなモデル向け `str_replace_editor` ツールを提供する。`view` は番号付きファイル内容または浅いディレクトリ一覧を示し、`create` は新規ファイルを作り、`str_replace` は一意なリテラル置換を適用し、`insert` は選んだ境界に行を追加する。永続 Bash、単発 Bash、サンドボックス Bash、他のターミナル面のいずれとも合成可能である。変更は fs ファミリーの他と同じ編集前読み取りポリシーとサンドボックス柵に従い、マウントされたバックエンドとポリシープラグインにより強制される。絶対パスによる Claude-Code 式単一エディターツールをデプロイが求める場合に選ぶ。`dsh-tool-fs` パッケージは代替の `read`/`write`/`edit` 一式を提供する。

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

この非 experimental スタンドアロンプラグインはカスタム構成向けである。Plugins ページの任意バンドルとしては提供されない。
モデルが絶対パス上でおなじみの `view`/`create`/`str_replace`/`insert` コマンド語彙を通じてファイルを編集すべき場合、`ctx.fs` バックエンド（およびガード付き変更向けにはポリシープラグイン）と並べてツールをマウントする。

### 最小構成

バックエンド、任意でポリシープラグイン、次にツール。エディターは任意のターミナル面と合成する。

```yaml
- name: '@deepseek-ai/dsh-fs-local'
- name: '@deepseek-ai/dsh-fs-observation-policy'
- name: '@deepseek-ai/dsh-tool-str-replace-editor'
```

### 構成

| キー | 既定値 | 意味 |
|---|---|---|
| `maxOutputChars` | `16000` | ファイル・ディレクトリビュー向けに保持される先頭文字数 |
| `description` | `Custom editing tool for viewing, creating and editing files`（複数行） | モデル向けツール説明 |

### コマンド

`view` は 1 始まり番号付きファイル内容（タブ保持のため表示テキストは有効なリテラル置換入力のまま）または隠し・依存・Python キャッシュエントリを省く 2 階層ディレクトリ一覧を返す。`create` は新規ファイルを作り、既存上書きを拒む。選択コマンドが使わないコマンド固有フィールドには `null` プレースホルダーを含められ、必須フィールドは必須のまま、`view_range: null` は全体ビューを選択し、`str_replace.new_str: null` は拒まれるため削除には省略を要する。`str_replace` は一意なリテラル一致を 1 件要求し、エラーは公開 `old_str` 語彙で報告される。`insert` は選択されたゼロ始まり挿入境界に従い、暗黙の末尾改行を加えない。変更は要求された編集の外側のタブを保持する。

### 失敗と回復

`view`・`str_replace`・`insert` からのメタデータ miss は `FS_NOT_FOUND` を返す前に確認済み不在を記録するため、後の `create` はマウント済みポリシーのガード付き生成フロー経由で外部削除パスを回復できる。不在が `str_replace` や `insert` を認可することはない。ガード付き変更はポリシープラグインのコードと対処を継承する。すなわち `FS_NOT_OBSERVED`（ファイルを読んで再試行）、`FS_STALE_VERSION`（再読して再試行）であり、サンドボックス拒否は `[sandbox: file access denied under <mode> mode]` 印として現れる。パスは絶対でなければならず、相対パスはヒント付きで拒まれる。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションではエディターツールの背後にある設計判断を説明し、それを実現するコードを示す。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱う。

### 設計概念

ツールは `ctx.fs` 上の 4 コマンドを持つ 1 スキーマである。変更は自身の仮定でプロバイダーに直接触ることは決してない。各々はポリシープラグインのガードを得るために `fs/write-intent` または `fs/edit-intent` ウォーターフォール squash を実行し、マウント済み `ctx.fs` が閉じ込める場合に呼び出しごとのサンドボックスポリシーを解決し、強制をプロバイダーに委譲する。`str_replace` と `insert` はさらにファイルを再読し、ポリシープラグインがガードを供給しない場合は観察バージョンを compare-and-swap 基準として使う。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | ツール全体: スキーマ、コマンド振分、ビュー描画、変更ポリシー |

### 各コマンドの実行

すべてのコマンドはまず絶対パスを解決する。変更は 1 つの共有フローに従う。すなわちポリシーガード、プロバイダー強制、成功時の `fs/observed` 記録であり、`view` は stat と描画のみである。ツール全体（スキーマ、コマンド振分、ビュー描画）は `src/index.ts` にある。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときに、これらのページを読む。ツールからそれが合成する契約・ポリシー・バックエンドへと進む。

- [ファイルシステムサブシステム](../../../docs/subsystems/filesystem.md) — 網羅的プロバイダー契約、ポリシーイベント、エラー分類。
- [dsh-fs](../fs/README.md) — このツールが消費する `ctx.fs` 契約。
- [tool-fs](../tool-fs/README.md) — 代替の `read`/`write`/`edit` ツール一式。
- [fs-observation-policy](../fs-observation-policy/README.md) — `fs/*` イベント経由で変更をガードするポリシープラグイン。
- [fs-sandbox](../fs-sandbox/README.md) — 変更を柵付けするサンドボックス強制バックエンド。
- [生成ツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-str-replace-editor) — このパッケージが登録する網羅的スキーマ。

-----

<a id="model-experience"></a>
## モデル体験

### ツールスキーマ

#### モデルが見るもの

構成済み `description` を含む生成 [`str_replace_editor` スキーマ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-str-replace-editor)。プラグインはスタンドアロンのシステムプロンプト節を寄与しない。

#### トークンへの影響

`str_replace_editor` 可視中の固定スキーマコストである。

#### KV キャッシュへの影響

構成済み説明とスキーマが不変の間はプレフィックス安定である。

### ツール結果

#### モデルが見るもの

ビューは番号付きテキストまたは浅いディレクトリ一覧を返す。呼び出しはファイル位置を公開し、生成・置換呼び出しは提示面向けに差分カードを公開する。変更は簡潔な確認を返す。長いビューは先頭を保持し、切詰め通知を追記する。

#### トークンへの影響

データ依存であり、`maxOutputChars` と固定切詰め通知で境界付けられる。

#### KV キャッシュへの影響

追記専用ツール結果は再利用可能なリクエストプレフィックスに従う。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


エディターツールが不向きな場合や特別な運用注意が必要な場合を定める。これらは現在のパッケージ制約であり、一般エディター比較やタスク backlog ではない。

- **操作対象は UTF-8 テキスト** — バイナリファイルは未対応である。
- **`str_replace` は意図的にゼロ・複数一致を拒む** — `replace_all` 引数はない。
- **すべての変更はマウント済みポリシーとサンドボックスを通る** — `fs/write-intent` または `fs/edit-intent` は現セッションサンドボックスポリシーを解決し、強制をマウント済みファイルシステムとポリシープラグインに委譲するため、それらなしのデプロイでは無条件変更になる。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
