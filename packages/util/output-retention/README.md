---
description: "返すコンテキスト量を制限しなければならないツール向けの、上限付きのモデル向け出力: アイテムとテキストのリテーナー、および標準化された省略フッター。"
kind: "package-library"
---

# @deepseek-ai/dsh-output-retention

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-output-retention` を使って、ツールがモデルに返すアイテムまたはテキストを上限付きにしつつ、何が省略されたかを報告する。`ItemRetainer` は順序付きの先頭ウィンドウを保ち、正確な省略アイテム数を報告できる。`TextRetainer` は先頭、末尾、または先頭と末尾のバイトウィンドウを、無効な UTF-8 の切断を返さずに保つ。`formatRetentionNotice` は一貫した省略句を追加し、各ツールが独自の回復ガイダンスを供給する。`truncateWithoutSplittingSurrogatePair` は、切断部に孤立した高位サロゲートを残さずに文字予算のプレビューを上限付きにする。グループ化、行番号、spill ファイル、プロバイダーエラーはツールの責任のままである。コンシューマーは `cordis.yml` を通じてロードするのではなく、このライブラリを直接インポートする。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらなる探索](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と延期された作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

ツールがその結果のどれだけをモデルに届けるかを上限付きにし、何が落とされたかを正直に報告する必要があるところでリテーナーを使う。順序付きの論理単位には `ItemRetainer` を、バイト指向のストリームには `TextRetainer` を選ぶ。

### アイテムのリストを上限付きにする

```ts
import { ItemRetainer } from '@deepseek-ai/dsh-output-retention'

declare const globMaxResults: number
declare const candidates: AsyncIterable<{ path: string }>
const retainer = new ItemRetainer<{ path: string }>({ kind: 'head', maxItems: globMaxResults })
for await (const entry of candidates) {
  retainer.push(entry)          // keep draining past the cap for an exact count
}
const { items, truncated, omitted } = retainer.finish()
```

`push()` はアイテムごとにそれが保たれたかを報告し、`finish()` は保持されたアイテムと `omitted` を返す — 呼び出し元が観察したすべての単位を供給し続けた場合の正確な数。検索ツールは、モデルには最初のページのみを保持しつつ、spill ファイル用に完全な結果セットを収集できる。

### テキストストリームを上限付きにする

```text
import { TextRetainer } from '@deepseek-ai/dsh-output-retention'

const out = new TextRetainer({ kind: 'headTail', headBytes: headCap, tailBytes: tailCap })
child.stdout.on('data', (chunk: Buffer) => { out.push(chunk) })
const { text, omittedBytes } = out.finish()
```

`head`、`tail`、`headTail` は文字や行ではなくバイトを数える: 子のパイプも HTTP ボディもバイトストリームである。`finish()` は各切断部の部分コードポイントを削るため、返されるテキストは切断によって導入された置換文字を運ぶことはなく、コードポイントが省略された中間を越えて再構築されることもない。

### 省略フッターを構築する

```ts
import { formatRetentionNotice } from '@deepseek-ai/dsh-output-retention'

declare const grepMaxMatches: number
declare const items: { length: number }
import type { Omitted } from '@deepseek-ai/dsh-output-retention'

declare const omitted: Omitted

const footer = formatRetentionNotice(
  { scope: 'grep', strategy: 'head', unit: 'items', limit: grepMaxMatches, kept: items.length, omitted },
  ({ kept }) => `Results capped at ${kept}. Narrow the pattern, path, or include to see more.`,
)
```

ライブラリは省略句（`Omitted 3 items.`）を標準化し、それをツール自身の回復ガイダンスと結合する。回復アクションを知っているのはツールだけであるため、その言葉はツールが供給する。

### 文字予算のプレビューを上限付きにする

`truncateWithoutSplittingSurrogatePair` は UTF-16 コード単位で測られるプレビューを上限付きにする。サロゲートペアの内側に落ちる切断は、孤立した高位サロゲートを返す代わりにペアでない半分を捨てるため、保持されたテキストはプレフィックスのままである。永続的な `bash` と `pwsh` シェルおよび `str_replace_editor` は、その文字予算プレビューにこれを使う。それぞれが依然として自身の切り詰め通知と `incomplete` プレフィックスを所有する。

### `truncated` の意味

`truncated` は予算の事実である: リテーナーが上限のために他の方法では利用可能なコンテンツを省略した。上流が不完全だったことを意味することは決してない — 権限の失敗、スキップされたバイナリファイル、プロバイダーの部分失敗、読めない候補はツールドメインのフィールドに留まり、`truncated` に畳み込まれることは決してない。

### 現在のツールがどう使うか

| ツール | リテーナー | ツールが依然として所有するもの |
|---|---|---|
| `glob` | `ItemRetainer`、`head` | spill ファイル収集、パスマッピング、スキップされた候補、`incomplete` |
| `grep` | `ItemRetainer`、`head` | spill ファイル収集、マッチごとのプレビュー切り詰め、グループ化、ソート |
| `bash` | `TextRetainer`、`tail` または `headTail` | spill ファイル、終了ステータス、シグナル、タイムアウト、バックグラウンドジョブ |
| `web_fetch` | `TextRetainer`、`head` または `headTail` | プロバイダーとリソースの上限、エラー状態 |
| `web_search` | `ItemRetainer`、`head` | 「ソースが上限付き」通知の文言とプロバイダーの事実 |

`read` はこのライブラリの外に留まる: その行ウィンドウページネーション（`offset`/`limit`、行番号、`totalLines`）は、単一の省略数では表現できないファイル固有のレンダラーである。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このライブラリは 1 つの分離の上に築かれている: 何が保たれ、何が省略されたかという機械的な問いを所有し、すべてのビジネス的意味はツールパッケージが所有する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | `ItemRetainer`、`TextRetainer`、`describeOmitted`、`formatRetentionNotice`、`truncateWithoutSplittingSurrogatePair` |

### 2 つのリテーナー、2 つの資源モデル

`ItemRetainer` は順序付きの論理単位を上限付きにし、最初の `maxItems` のみを保つ。呼び出し元は省略数が正確になるように観察したすべての単位をプッシュし続ける。`TextRetainer` は 1 つの共有プレフィックス/サフィックスアキュムレーターでバイトを上限付きにする: `head` はプレフィックスのみ、`tail` はサフィックスのみ、`headTail` は両方で、アキュムレーターはメモリ内に最大 `headBytes + tailBytes + 1 チャンク` しか保持しないため、大きなストリームが無制限に蓄積されることはない。

### 予算の事実が正直であり続ける方法

`push()` は `kept`（この単位またはチャンクが完全に保持された）と `truncated`（これまでに落とされたものがある）を返す。`finish()` は実際に返されたバイトに対して省略を報告するため、部分コードポイントのバイトを落とす UTF-8 境界のトリムも数えられる — 予算だけから構築された通知は保持されたテキストを過大に述べることになる。`describeOmitted` は `exact` の場合にのみ数を表示し、`unknown` は呼び出し元が何も提供しなかったため数を表示しない。

### read レンダラーの除外

`read` の `offset`/`limit` ページネーションは、選択されたウィンドウに対して独自のバイト上限を持つ行ウィンドウレンダラーである。単一の `Omitted` 値はそのウィンドウの両側を表現できないため、このライブラリの外に留まる。

</details>

-----

<a id="further-exploration"></a>
## さらなる探索

コンシューマーまたはライブラリ背後の境界決定が必要なときにこれらのページを読む。

- [Spill ポリシー](../../spill/spill-policy/README.md) — spill ファイル通知の周りの上限付きプレビューのために `TextRetainer` を構成する。
- [Spill サブシステム](../../../docs/subsystems/spill.md) — このライブラリのプレビュー機構が奉仕する spill 語彙。
- [ファイル検索ツール](../../fs/tool-fs-search/README.md) — spill 用に完全な結果を収集する `ItemRetainer` コンシューマー。

-----

<a id="model-experience"></a>
## モデル体験

間接的に、保持されたコンテンツと省略メタデータをレンダリングするリテンションコンシューマーを通じて。

#### KV キャッシュへの影響

直接の無効化はない。リテンションコンシューマーがリクエストプレフィックスの変更を所有する。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限はリテーナーが意図的にカバーしないものを定義する。これらは現在のパッケージ制約であり、タスクバックログではない。

- **アイテム保持は `head` のみをサポートする** — tail、head/tail、ページネーション、グループ化、プロバイダー完全性のセマンティクスはツール所有のままである。
- **テキスト保持はバイト指向である** — `TextRetainer` はバイトを数える。文字予算の先頭上限は `truncateWithoutSplittingSurrogatePair` を通り、`read` ページネーションのような行ウィンドウは依然として別のレンダラーを必要とする。切断は返されるテキストを有効に保つために部分的な UTF-8 境界バイトを捨てることがある。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
