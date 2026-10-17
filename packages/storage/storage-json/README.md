---
description: "ホストとメンテナ向け JSON 記憶域バックエンド。設定ルート配下の全体単位・レコード単位ファイルの選択・設定・デバッグ用。"
kind: "package-reference"
---

# @deepseek-ai/dsh-storage-json

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-storage-json` はドメインデータを設定ルート配下の可読 JSON として格納し、バックエンド `json` として登録する。既定 `single` 配置は単位ごとに完全 `<unit>.json` ファイル 1 件を保持し、`per-record` 配置はレコードごとにバージョン刻印文書 1 件を保持する。両配置とも各変更ファイルをアトミックに公開し、ドメイン層が呼び出しを順序付ける。運用者が検査可能ファイルを必要とし、選択配置が書き込み量に合う場合に選ぶ。より大きい、または高同時実行データには SQLite を選ぶ。バックエンドはホスト側のみであり、プロンプト・ツール・スキーマに寄与しない。

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

合成が可読・編集可能 JSON 記憶域を必要とする場合にこのパッケージを使う。関連ドメインをバックエンド `json` に振り、各ドメイン仕様が `single` または `per-record` 配置を選ぶ。

### いつ選ぶか

1 つの完全整形済みファイルがうれしい小規模単位には既定 `single` 配置を選ぶ。点書き込みで 1 レコード文書だけ置換すべき場合は `per-record` を選ぶ。データが大きい、書き込みが頻繁、複数レコードのトランザクション更新が必要な場合は SQLite バックエンドを選ぶ。

### 構成

唯一のプラグインフィールドは単位ファイルとディレクトリを保持する `root` である。バックエンドは `process.cwd()` にフォールバックしないため必須である。バックエンドはルートをモード `0o700` で必要時に作成する。ドメイン仕様が配置を選ぶ。このプラグインに配置上書きはない。

```yaml
- name: '@deepseek-ai/dsh-storage'
- name: '@deepseek-ai/dsh-storage-json'
  config:
    root: /var/lib/dsh/data
- name: '@deepseek-ai/dsh-storage-domain'
  config:
    backend: json
```

| フィールド | 既定値 | 意味 |
|---|---|---|
| `root` | 必須 | `<unit>.json` ファイルと `<unit>/` ツリーを保持するディレクトリ。必要時に `0o700` で作成 |

生成される[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-storage-json)が、受け入れられるすべてのフィールドとその JSDoc の網羅的な情報源である。

### 観測可能な動作

欠落 `single` ファイルや `per-record` ディレクトリは空単位として開き、初回書き込みで実体化する。`single` では、不正内容は `malformed-medium` で拒否され、異なる格納バージョンは `version-mismatch` で拒否される。`per-record` では、各不正・読み取り不可文書、各文書バージョンが記述子の現行・互換バージョン外の文書は不在レコードとして読まれるため、1 件の不良文書が単位を拒否しない。レコードキーは `[a-zA-Z0-9_-]+` に一致しなければならず、安全でないキーはファイル操作前に拒否される。すべての解決済み書き込みは耐久性があり、close 後操作は `closed` で拒否される。

空 `per-record` ツリーは、有効 `<root>/<unit>.json` 全体単位文書から宣言テーブルを初期化できる。ソース単位名一致かつバージョンが現行または宣言互換の場合のみである。バックエンドはそのソースファイルを不変のままにし、移行レコードに現行バージョンを刻印する。受け入れ集合外のソースバージョンは新規ツリーを空のままにする。宣言テーブル内の任意文書パス、または宣言 `global.json` は、その文書が読み取り不可や古くても単位全体のこの初期化を抑止する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

2 配置はアトミック公開を共有するが、状態所有権の割り当てが異なる。`single` はインメモリ単位投影を所有し、`per-record` はディレクトリツリーを権威とする。

### 設計構想

- **`single` はメモリを権威にする。**各書き込みはインメモリ単位を変更し、その完全状態を直列化し、`<unit>.json` をアトミックに置換する。公開失敗は直前のインメモリ値を復元する。
- **`per-record` はディレクトリを権威にする。**各 put や delete は 1 つの `<unit>/<table>/<key>.json` 文書を変更し、`loadAll()` はツリーを読み直す。各文書は単位バージョンを刻印し、1 レコード値を運ぶ。
- **公開は呼び出しごとに耐久性がある。**書き込みは一時ファイル、fsync、アトミック `rename()` 置換、POSIX 上の親ディレクトリ fsync を使う。ドメイン層の書き込み連鎖が呼び出し横断の順序を提供する。

### ファイル形式

`single` 文書は単位識別子、全体シングルトン、全テーブルを運ぶ:

```json
{
  "unit": { "name": "workspace", "version": 1 },
  "global": null,
  "tables": { "workspaces": { "<key>": { "path": "/work/demo" } } }
}
```

`<root>/<unit>/<table>/<key>.json` の `per-record` テーブル文書は `{ "version": 1, "record": <value> }` 形式であり、任意全体値は `<root>/<unit>/global.json` を使う。形式バージョンはドメイン仕様由来である。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグイン入口。バックエンド登録、`root` 設定、単位開閉テーブル |
| [`src/single-unit.ts`](src/single-unit.ts) | 1 つの `single` 単位。権威メモリ、書き込みプリミティブ、公開ロールバック |
| [`src/per-record-unit.ts`](src/per-record-unit.ts) | 1 つの `per-record` 単位。ツリー読み取り、パス安全レコード、1 文書書き込み |
| [`src/format.ts`](src/format.ts) | バージョン検証付き全体単位・レコード直列化 |
| [`src/atomic.ts`](src/atomic.ts) | アトミックファイル置換。一時書き込み、fsync、rename、ディレクトリ fsync |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

このバックエンドの見方では足りない場合にこれらのページを読むとよい。サブシステムリファレンスが権威契約であり、兄弟バックエンドが代替媒体を示す。

- [Storage サブシステム](../../../docs/subsystems/storage.md) — バックエンド契約、ドメイン意味、生成 API。
- [Storage パッケージマップ](../README.md) — ファミリーのパッケージとリポジトリ位置。
- [SQLite 記憶域バックエンド](../storage-sqlite/README.md) — 高頻度データ向け点更新媒体。
- [domain KV 記憶域 Agent Note](../../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.md) — バックエンドファミリーの背後にある設計と先送り作業。

-----

<a id="model-experience"></a>
## モデル体験

### 格納ドメインレコード

#### モデルが見るもの

なし。このバックエンドはプロンプト・ツール・スキーマに寄与しない。`ctx.storage` 背後でホスト側コンシューマー向けに非セッションドメインデータを永続化する。

#### トークンへの影響

ライブリクエストトークンはゼロである。

#### KV キャッシュへの影響

なし — バックエンドはライブリクエスト接頭辞に決して触れない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このバックエンドが不向きな場合や特別な運用上の注意を要する場合を定義する。これらは現在のパッケージ制約であり、タスクバックログではない。

- **`single` は単位全体を書き直す** — 各書き込みは完全単位ファイルを再公開する。このコストが高すぎる場合は `per-record` を使うか、ドメインを SQLite に振る。
- **プロセス横断書き込みロックなし** — 同じ単位への 2 プロセス書き込みは置換が交互に挟まりうる。同じファイルへの書き込みは最終完了勝ちである。
- **明示ライトスルーなしの Windows rename** — 耐久性は libuv の `rename()` (置換付き `MoveFileExW`) に依存する。セッションログバックエンド由来の厳格 Win32 ライトスルー公開ヘルパーは、`log` ファセット着地時にここへ降ろす予定である。

<a id="dev-note"></a>
### Dev Note

<details>
<summary>メンテナ向けの作業コンテキスト — クリックして展開</summary>

Agent Note は全体単位書き直し規模前提をリスクとして挙げる。2 件目のコンシューマーが千レコード規模で SQLite に振られる前にこのバックエンドに着地すると、想定より早く書き直しコストが現れる。緩和は設定であり、このパッケージ変更ではない — `routes` を SQLite バックエンドに向ける。

</details>
