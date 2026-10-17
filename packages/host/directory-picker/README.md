---
description: "Workspace-directory picking seam for the web GUI host: the service contract, capability vocabulary, and error codes the native and browse backends implement."
kind: "package-reference"
---

# @deepseek-ai/dsh-host-directory-picker

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Web GUI では OS チューザーまたはアプリ内ブラウザーでワークスペースディレクトリーを選べます。操作者がホスト画面に到達できる場合はネイティブ方式を使い、リモートクライアントの場合やディレクトリー一覧と作成をアプリ内に留めるべき場合はブラウザー方式を使います。コンシューマーは対話種別を受け取り、対応ワークフローを提示できます。ディレクトリー選択は GUI ホストに限定され、エージェントループには影響しません。ブラウザーワークフローは一度に 1 つのディレクトリーツリーを公開します。複数ルートは未対応です。

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

directory-picker バックエンドをちょうど 1 つマウントし、ワークスペースフローに駆動させます。シーム自体はサービス契約のみであり、バックエンドのない構成ではディレクトリーを選択する方法がありません。

### バックエンドの選択

操作者がホスト画面の前にいる場合、[ネイティブバックエンド](../directory-picker-native/README.md)が適切です。`directoryPicker/pick` が OS チューザーを 1 つ開き、選択絶対パスを返し、キャンセル時は `null` を返します。[ブラウズバックエンド](../directory-picker-browse/README.md)はどこでも動作します。ブラウザーから 1 階層の一覧と子ディレクトリー作成を行うため、OS ダイアログに到達できないリモートクライアントでもワークスペースを選べます。起動ごとにホスト状況が変わる場合は[適応チューザー](../directory-picker-auto/README.md)を構成し、起動時に状況を一度解決して対応バックエンドをマウントします。

### ケイパビリティ契約

`capability()` は操作者のディレクトリー選択方法を記述する判別共用体を返します。OS チューザー用の `{ kind: 'native', pick(signal) }`、またはアプリ内ブラウザー用の `{ kind: 'browse', list(path?), createDirectory(path, name) }` です。コンシューマーは `kind` で分岐します。どの構成も実装しないケイパビリティ種別では、失敗ではなく UI が選択アフォーダンスを隠します。ブラウズ失敗は型付き `DirectoryPickerError` をスローし、閉じたコード集合 — `directory-unreadable`、`directory-exists`、`directory-create-failed` — のいずれかで対象パスを運び、選択 Remote コントローラーがワイヤー失敗コードに 1:1 でマッピングします。

### 行が運ぶもの

`DirectoryEntry` 行は絶対 `path` とホスト所有の `hidden` フラグ (POSIX ではドット接頭辞) を公開し、表示ポリシーをクライアント側に留めます。クライアントがパス片を自前で結合することはありません。`DirectoryListing.crumbs` はファイルシステムルートから一覧ディレクトリーまでの祖先チェーンです。すべての crumb はジャンプ先であり、ルート crumb は完全パスでラベル付けされます。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Implementation internals — click to expand</summary>

### 設計概念

シームは 1 つの分離の上に構築されます。バックエンドが提供する対話形状は実装詳細ではなく契約です。`DirectoryPicker` は単一 `capability()` メソッドを持つ抽象 Cordis サービスです。バックエンドサブクラスは `ctx.directoryPicker` として登録し、2 つ目の実装の読み込みは標準の重複サービスエラーをスローします。コンシューマーが呼び出しをまたいでキャプチャーすることがあるため、ケイパビリティオブジェクトはサービス存続期間 stable でなければなりません。

### マージ拡張可能な語彙

`DirectoryPickerCapabilities` はケイパビリティ種別をキーとするマージ拡張可能なマップであり、`DirectoryPickerCapability` はそこから共用体を導出します。新バックエンドはこのパッケージを編集せず、ここに形状を宣言マージします (エントリーの `kind` リテラルはキーと等しくなければなりません)。各バックエンドパッケージは ui-workspace の directory-flow スロットに対応対話を登録するブラウザーエントリーポイントも出荷するため、1 つの構成行でホストケイパビリティとクライアントフローの両方を選択します。

### ソースマップ

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Service Definition: abstract `DirectoryPicker`, capability vocabulary, typed error, Context merge |

### 失敗語彙

`DirectoryPickerError` は閉じた `DirectoryPickerErrorCode` と絶対対象パスを運ぶため、コンシューマーは文字列照合なしに業務コードをマッピングします。シーム Agent Note は設計根拠、`ctx.fs` からの分離、ポリシー決定を記録します。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

シーム契約だけでは足りない場合に読みます。決定記録を先に、次にそれを構成する 2 つのバックエンドと適応チューザーです。

- [Directory-picker capability seam decision](../../../.agents/notes/archived/architecture/2026-07-28-directory-picker-capability-seam.md) — design rationale, the `ctx.fs` separation, and the policy decisions.
- [Native backend](../directory-picker-native/README.md) — OS チューザー対話とプラットフォーム工具。
- [Browse backend](../directory-picker-browse/README.md) — リモートクライアント向けアプリ内一覧・作成対話。
- [Adaptive chooser](../directory-picker-auto/README.md) — 2 バックエンド間の起動時解決。
- [Workspace subsystem](../../../docs/subsystems/workspace.md) — 選択ディレクトリーを記録するワークスペース。

-----

<a id="model-experience"></a>
## モデル体験

None, as the GUI-host picking seam registers nothing model-facing.

#### KV キャッシュ効果

なし。このパッケージはプロバイダーリクエストを組み立てず送信もしません。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、シーム契約が将来のコンシューマーに決定を委ねる条件を定めます。これらは現行パッケージの制約であり、タスクバックログではありません。

- **No multi-root support** — ブラウズ契約は一覧ごとに 1 つの祖先チェーンを公開します。配置ごとのルートスコープ (およびドライブより上の Windows ドライブルート列挙) は、それを必要とするコンシューマーを待ちます。DirectoryPicker Agent Note によります。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
