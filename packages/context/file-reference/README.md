---
description: "File-reference discovery and @file mention grammar for host-backed UIs, for users and maintainers choosing the seam or pairing it with a provider."
kind: "package-reference"
---

# @deepseek-ai/dsh-file-reference

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

ホスト支援ユーザーインターフェースは `@file` 補完のために `dsh-file-reference` を使います。UI は対象エージェント向けパス候補を問い合わせ、モデルは `@path` または `@"path with spaces"` と入力し、候補選択は対応メンションを通常プロンプトテキストとして挿入します。シーム自体はファイルシステムアクセスを持ちません。`@deepseek-ai/dsh-file-reference-local` のような具象プロバイダーが候補、ランキング、キャッシュ、無効化を提供します。候補選択はファイル内容を読まず添付もしません。ファイルを調べるにはモデルがファイルシステムツールを呼ばなければなりません。Session Controller は同じ検出をブラウザーコンシューマーに `fileReferences/list` Remote 経由で公開します。

## 目次

- [このパッケージの利用](#use-this-package)
- [実装の理解](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの利用

ホスト支援 UI (Web またはターミナル) に `@file` 補完を持たせる場合にこのパッケージを選び、エージェントの有効 `read` ツールに名前空間が合うプロバイダーと組み合わせます。プロバイダーなしにシームをマウントすると UI の補完面は空になります。

### メンション文法

入力先頭または空白後の `@path` トークンが補完を起動します。メールアドレスのような別トークン内の `@` は起動しません。`@"path with spaces"` は引用メンションを開き、ディレクトリー候補は末尾スラッシュ後に引用を開いたままにするため、補完はもう 1 階層降りられます。完了済みディレクトリーチップは末尾スラッシュ後に引用を閉じます。相対メンションはワークスペースルートから解決します。絶対メンションはホストパスを保持します。フォーマッターは文法で安全に表せない制御文字や埋込引用を含むパスを拒否します。

### 候補の取得

`ctx.fileReferences.list(agent, query, signal)` は 1 エージェントの作業ディレクトリー向けパス限定のファイルおよびディレクトリー候補を返し、プロバイダーが決定論的にランク付けします。ディレクトリーメンションは末尾 `/` 付きで描画されるため、補完はもう 1 階層降りられます。ブラウザーコンシューマーは Session Controller アダプターを `ctx.remote.fileReferences.list` として呼びます。末尾シグナルは遅い自動補完をキャンセルします。

### プロバイダーとの組合せ

ローカルファイルシステムには `@deepseek-ai/dsh-file-reference-local` をマウントします。他名前空間 (リモートまたは仮想ファイルシステム) には検出が有効ツールに合うプロバイダーが必要です。対象エージェントが `read` を呼べる場合、プロバイダーは参照ファイルを検査済みと主張する前に読むようモデルに伝える安定 `FILE_REFERENCE_PROMPT` ガイダンスを導入できます。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

この節ではシームの設計を説明します。観測可能な動作は [Use this package](#use-this-package) で扱っています。

### 設計概念

パッケージは抽象検出サービスを共有のブラウザー安全メンション文法から分離し、プロバイダーが名前空間アクセス、ランキング、キャッシュ、無効化を所有します。サービスはワイヤー中立のままです。`dsh-api-session-controller` は `fileReferences/list` Remote アダプターを所有し、エージェント解決後に有効プロバイダーに委譲します。

### ソースマップ

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Abstract `FileReferenceService` and `FILE_REFERENCE_PROMPT` |
| [`src/grammar.ts`](src/grammar.ts) | `activeAtToken` recognition and `formatFileMention` rendering |
| [`src/types.ts`](src/types.ts) | `FileReferenceCandidate` path-only result type |

### 主フロー

UI は `activeAtToken` 経由で有効 `@` トークンを認識し、照会テキストで `list` を呼び、ランク付き候補を描画します。選択時、`formatFileMention` は対応プロンプト綴り (`@path`、`@"path with spaces"`、引用ディレクトリー向け開いた `@"dir/` ) を送出します。いかなる時点もファイル内容は読みません。プロバイダーは対象エージェントが `read` ツールを持つ場合、安定 `FILE_REFERENCE_PROMPT` 節を追加導入できます。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

パッケージレベルの契約では足りない場合にこれらのページを読みます。出荷プロバイダーから共有参照面、そして候補が指すツールへ進みます。

- [Local file-reference provider](../file-reference-local/README.md) — このシームの出荷ローカルワークスペース実装。
- [Session-reference subsystem](../../../docs/subsystems/session-reference.md) — ホスト UI 背後の共有 file-reference および session-reference 契約。
- [Context group map](../README.md) — 兄弟要求コンテキストパッケージ。
- [Filesystem tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-tool-fs) — 参照パスが対象とする `read` ツール。

-----

<a id="model-experience"></a>
## モデル体験

間接的に、構成済みプロバイダー経由です。このパッケージの検出シームと文法が委譲する file-reference ガイダンスをプロバイダーが所有します。

#### KV キャッシュ効果

インターフェースと文法は要求トークンを加えません。プロバイダー所有プロンプト節が再利用可能プレフィックスが変わるかを決定します。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、シームが不向きになる条件を定めます。これらは現行パッケージの制約です。

- **Path candidates are advisory** — シームは以降のモデル向けファイルシステムツールが同じ名前空間にアクセスできることを証明しません。配置はプロバイダーを有効 `read` 実装に合わせなければなりません。
- **No file-content reference object** — 選択ファイルは通常プロンプトテキストのまま残り、その内容がモデル可視になる前に明示モデルツール呼び出しが必要です。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
