---
description: "秘密の値を設定に置かずに、クレデンシャル — 参照値と永続レコード — を解決、記述、保存するユーザーとメンテナー向けのクレデンシャルシーム。"
kind: "package-reference"
---

# @deepseek-ai/dsh-credentials

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-credentials` は、設定と `cordis.yml` が `DEEPSEEK_API_KEY` のようなキー名を参照できるようにすることで、秘密の値を設定から排除する。また、承認グラントやプロバイダー環境値を含む、プラグインごとの永続クレデンシャルレコードを保存する。ローテーションされた保存済みキーは、再起動や設定編集なしで次のリクエストから適用される。構成 UI は、値を公開することなく、キーやレコードが設定されているか、そのソース、書き込み可能かどうかを報告できる。空のキー値は存在しないものとして扱われる一方、空のレコードは意図的に保存されたクレデンシャルのままである。

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

このパッケージは、秘密の値を保存・検索する製品部分である: キーを一度保存し、どこからでも名前で参照し、いつでも読み取り、確認、削除できる。また永続クレデンシャルレコードを保持するので、プラグインは自身の ID に対して保持するクレデンシャルを保存、更新、削除できる。製品の既定構成にはすでにクレデンシャルストアが含まれている。カスタム構成では、ローカルストアパッケージをファイルパスとともにロードする。

### いつ使うか

設定を秘密の値から自由に保つ必要がある場合は常にクレデンシャルストアを使用する: 同期、共有、または構成 UI で表示される設定ファイル、あるいは設定を編集せずにキーをローテーションするチームなどである。単一の環境変数を持てないクレデンシャル — サインインフローからの承認グラントやプロバイダー環境値 — をプラグインが保持する必要がある場合、および構成 UI がユーザーが認可されているものを一覧表示すべき場合にレコードを使用する。構成 UI は、キーやレコードが設定されているか、どこから来るか、変更できるかを表示でき、値自体を表示することは決してない。固定された環境変数が 1 つだけ必要な場合は、その変数を直接読み取り、ストアを省略する。

### 構成に追加する

ローカルストアパッケージをドキュメントパスとともにロードする:

```yaml
- name: '@deepseek-ai/dsh-credentials-local'
  config:
    path: /absolute/path/to/.credentials.yaml
```

完全な構成サーフェスはローカルストアの README が所有する。生成される[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-credentials-local)が網羅的なフィールドリストである。

### キーの保存、確認、削除

```ts
import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'

declare const ctx: Context

const ref = credentialRef('DEEPSEEK_API_KEY')          // POSIX shell identifier, branded
const hit = await ctx.credentials.resolve(ref)         // { value, source } | undefined
const info = await ctx.credentials.describe(ref)       // { configured, source?, writable } — never the value
await ctx.credentials.set(ref, 'sk-…')                 // the stored value outranks environment fallbacks
await ctx.credentials.unset(ref)                       // no-op when absent; an environment fallback then applies again
```

キーは `set` で保存し、`unset` で削除し、`describe` で状態を確認し、操作が必要とする場合は `resolve` で現在の値を読む。`describe` はキーが設定されているか、どこから来るか、書き込み可能かを報告し、値を返すことは決してない。

### レコードの保存、更新、削除

プラグインは各レコードを `<scope>/<id>` — 自身の登録名と、自身が選ぶ ID (プロバイダールートキーなど) — でアドレス指定し、保持するものを読み取り、変更、削除する:

```ts
import type { Context } from '@deepseek-ai/cordis'
import { credentialKey } from '@deepseek-ai/dsh-credentials'

declare const ctx: Context

const key = credentialKey('llm-pi-ai', 'openai-codex')   // <owner>/<id>, branded
const hit = await ctx.credentials.readRecord(key)        // CredentialRecord | undefined
await ctx.credentials.describeRecord(key)                // { configured, kind?, writable } — never the value
await ctx.credentials.listRecords()                      // [{ key, kind }] — never values
await ctx.credentials.modifyRecord(key, async () => ({ kind: 'grant', payload: { token: '…' } }))
await ctx.credentials.deleteRecord(key)                  // no-op when absent
```

`modifyRecord` が唯一の書き込み経路である: 書き込みが排他的な時点で成立しているレコードをミューテーションに渡し、`undefined` を返すとエントリーは変更されないまま残る。レコードには空値ルールがない — キーも環境値も持たないレコードは、そのオーナーがアンビエント認証を確認したことを表明する — また構成 UI はすべてのレコードを列挙して、あなたが認可されているものを表示し、削除されたプラグインが残したレコードを見つけられる。

### 設定でキーを使用する

設定セクションや `cordis.yml` エントリーは、キーを含めるのではなく名前で参照する — たとえば LLM アダプターは `apiKeyEnv` を取る:

```yaml
apiKeyEnv: DEEPSEEK_API_KEY
```

キーを必要とするリクエストは現在の保存値を使用するので、キーのローテーションは次のリクエストで直ちに有効になる — 再起動も設定編集も不要である。

### 何がうまくいかないことがあるか

- **保存済みキーは起動環境より優先される** — 値が保存されている間は、`DEEPSEEK_API_KEY=… dsh` (または CI シークレットやコンテナの `-e`) は適用されない。エクスポートされたものを使うには保存済みキーを `unset` する。
- **空の値は保存できない** — 空文字列の保存は拒否される。代わりにキーを削除する。
- **キーの値が構成 UI や診断に現れることはない** — UI はキーが設定されているか、どこから来るか、変更できるかを表示する。値自体はストアに留まる。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションでは、パッケージ背後の設計決定を説明し、それを実現するコードを示す。観察可能な挙動は[このパッケージを使う](#use-this-package)で完全に説明されている。

### 設計哲学

1 つのドクトリンと 4 つの帰結:

- **設定は参照を運び、秘密を運ばない。** 設定セクションや `cordis.yml` エントリーはクレデンシャルを名前で参照する。参照の背後の値はプロバイダーとともに存在する。設定ドキュメントは同期や表示を安全に行え、`describe()` は値を保持せずに回答し、秘密のローテーションが設定ファイルに触れることはない。
- **コンシューマーは操作ごとに解決する。** 解決は操作をまたぐキャッシュのない呼び出しごとの読み取りであり、その読み取り自体がホットアップデート機構である。
- **空の保存値は存在しないものとして扱う。** `resolve` はそれをスキップし、`describe` は未構成として報告する — 空白が構成済みの秘密を装うことは決してできない。
- **レコードは永続的であり、存在自体が事実である。** レコードは `<scope>/<id>` ごとに保存され、再起動を超えて存続する。空値ルールは適用されないので、キーも環境値も持たない `api-key` レコードは、空白ではなく意図的な表明である。
- **リスナーの失敗は封じ込められる。** `notifyUpdated` は `credentials/reference-updated` をファンアウトしてすべてのリスナーを実行させる。同期 throw や非同期 rejection は、コミットされた操作の結果を変えずにログに記録される。

### credentials/reference-updated イベント

`credentials/reference-updated (ref)` は、プロバイダー管理ソースへのコミットされた変更 — `set`、`unset`、またはストレージで観測された外部編集 — の後に発火する。アンビエントなプロセス環境の変更は観測できず、決して emit されない。コンシューマーはこのイベントを必要としない (操作ごとに再解決するため)。これは「構成済み」バッジを更新する構成 UI のために存在する。

`credentials/record-updated (key)` は、保存されたレコードへのコミットされた変更 — 書き込みを行った `modifyRecord`、削除を行った `deleteRecord`、またはストレージで観測された外部編集 — の後に発火する。2 つのキー文法が互いに素であるため、別個のイベントのままである: 1 つのイベントで両方の空間を受け取るリスナーは、対象がどちらに属するか判別できない。

### レコードの書き込みと読み取りの経路

`modifyRecord` が唯一のレコード書き込み経路である。正しい書き込みは現在の値に依存するからである: トークンリフレッシュは読み取り-判断-置換であり、ミューテーションは書き込みが排他的な時点で成立しているレコードを見る — `undefined` を返すとエントリーは変更されないまま残る。排他はバッキングストアが対応する範囲でプロセスをまたいで成立し、これが 1 つのリフレッシュトークンをローテーションする 2 つのプロセスのうち先に書いた方が失われるのを防ぐ。読み取りは参照側を反映するが、レイヤー化は決してしない: レコードをシャドウできるものはなく、`grant` ペイロードはオーナーが書いたまま正確に返される。解釈できるのは所有プラグインのみであるためである。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | サービス定義: `credentialRef`/`credentialKey` ブランド、`ResolvedCredential`/`CredentialRecordInfo`、両方のキー空間にわたる抽象プロバイダー、封じ込められたファンアウト |
| [`src/types.ts`](src/types.ts) | Client 安全な型サーフェス: `CredentialRef` と `CredentialKey` ブランド、保存レコードユニオン、`CredentialInfo` 参照ビュー、`credentials/reference-updated` と `credentials/record-updated` の宣言 |

### Client 安全な型

`./types` サブパスエクスポートは、イベント宣言とともに `CredentialRef` および `CredentialKey` ブランド、それらが指名する保存レコードユニオン、構成サーフェスが読む `CredentialInfo` 参照ビューを保持し、パッケージルートがそれらを再エクスポートする。したがって Host コンパイルフェース外のコンシューマーは、シグネチャを再記述するのではなく、Host が emit するものと同じものを読む。

### ライフサイクル

サービスはプロバイダーによって登録された Cordis `Service` である: マウントしているファイバーをディスポーズすると `ctx.credentials` が除去される。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときにこれらのページを読む。共有サブシステム語彙から同梱のストアとケイパビリティアーキテクチャへと進む。

- [Credentials subsystem reference](../../../docs/subsystems/credentials.md) — `CredentialRef`/`CredentialKey`、操作ごとの解決、UI 安全な情報、プロバイダーレイヤー、生成される Cordis サーフェス。
- [Local credentials store](../credentials-local/README.md) — 既定のオンマシンストア: キーとレコードの在処と環境レイヤーの順位。
- [Capability seams](../../../docs/capability-seams.md) — このパッケージが従う Service Definition / Service Provider / Consumer の分割。

-----

<a id="model-experience"></a>
## モデル体験

間接的。消費するアダプターを通じてであり、アダプターが各クレデンシャル参照を解決し、値が認可するすべてのモデル向けの使用を所有する。

#### KV キャッシュへの影響

直接的な無効化はない。解決された値がリクエストプレフィックスに入ることは決してない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このパッケージが不適切な選択となる、または特別な注意を要する条件を定義する。これらは現在のパッケージ制約であり、タスクのバックログではない。

- **参照に列挙はない** — シームは与えられた参照についての問いに答える。構成サーフェスは設定スキーマからそれらを知るので、その半分に対する `list()` には現在のコンシューマーがない。レコードは列挙できる。発見元となるスキーマを持たないためである。
- **参照は環境変数の形をしている** — 1 つのフラットな POSIX 識別子名前空間である。参照は解決に使う環境名を兼ねるためである。レコードはより豊かな `<owner>/<id>` アドレス指定を運ぶ。
- **プロセス環境の変更は不可視** — 起動シェルで変更された変数に対して通知を発火させることはできない。UI は自身のナビゲーション時にのみ `describe()` を再読する。
- **レコードのオーナーはそのスコープであり、スコープがマウントされていることを検証するものはない** — シームは与えられたものを保存し、保存したものを報告する。孤児の認識は `listRecords()` とそのスコープを所有するレジストリとの間の呼び出し元の結合であり、シーム自身には照合すべきレジストリがない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発者ノートはメンテナー向けの作業コンテキストである: 未解決の問いと未決定の方向性。明示的に非権威である — 出荷済みの挙動と制限は上記のセクションとパッケージコードにある。

シームの形体は keyring、ヘルパーコマンド、KMS ベースのプロバイダーの余地を残している。リモート設定プロバイダーが秘密を運ぶ必要は決してない。いずれも同梱されておらず、現在それを必要とするコンシューマーも存在しない。

</details>
