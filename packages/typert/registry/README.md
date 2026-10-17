---
description: "ランタイム Typert レジストリ: 生成されたパッケージリフレクション、遅延 Zod スキーマファクトリー、Remote 呼び出しディスクリプターを保存し、コンシューマー向けにそれらを解決する。"
kind: "package-reference"
---

# @deepseek-ai/dsh-typert-registry

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-typert-registry` は、生成された Typert アーティファクトを実行時にクエリ可能にする。各パッケージのリフレクション、遅延 Zod スキーマファクトリー、Remote 呼び出しディスクリプターは安定したキーの下に置かれる。スキーマは、コンシューマーが最初に要求したときに実体化されてキャッシュされる。登録はアトミックでファイバースコープである。コントリビューションは丸ごと着地するか全く着地せず、登録したコンポーネントのアンロード時に自動的に撤回される。同じサービスが、Remote 呼び出しの解決に使うルックアップレジストリとスコープ付き Context プロバイダーレジストリをホストする。TypeScript 解析は行わず、スキーマも生成しない。それらはジェネレーターとローダーが担う。

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

生成された Typert アーティファクトを保存または消費する任意の Host または Client コンポジションにレジストリをマウントする。`ctx.typert` を提供する。設定はない。Node はプログラムによる Cordis コンポジションのために `/client` をスタンドアロン ESM の `lib/client.node.js` バンドルに解決し、ブラウザは論理 URL `/plugins/.../client.js` を通じて `lib/client.browser.js` ローダーファクトリーを使用する。両方のバンドルは同じレジストリ実装を使用し、Host パッケージルートとは分離されている。

### 最小セットアップ

レジストリプラグインをロードする。Client フェイスも Client ランタイム自身のメタデータによって同じ方法でインストールされ、両方のフェイスが同じ実装を実行する:

```yaml
- name: '@deepseek-ai/dsh-typert-registry'
```

### スキーマとリフレクションのクエリ

コンシューマーはスキーマを `get(key)`、`resolve(key)`、または `list(filter?)` で、パッケージリフレクションを `getPackage(name, face?)` または `listPackages(filter?)` で読む。最初のスキーマ読み取りがプロセスレルムごとに 1 つのインスタンスを実体化し、以降の読み取りはそれを再利用する。`resolve()` は、不正な形式のキー、存在しないパッケージ、その名前でスキーマを提供しない登録済みパッケージを区別し、それぞれ独自のエラーを持つ。`toJSONSchema(key)` は実体化された Zod スキーマを JSON Schema に投影し、投影はキャッシュしない。

呼び出し情報は既存の `ctx.typert.local.get/list` および `ctx.typert.remotes.get/list` クエリを通じて利用できる。それらは登録されたディスクリプターオブジェクトを返す。`input(options?)`、`result`、`invoke` を持つ生成済みの直接メソッドを含む。別個のメタデータストアや RPC API は存在しない。コンシューマーは登録や Host ディスパッチを変更せずに、一致する strict パースと JSON Schema のために `method.input({ strict: true })` を選択する。ベースディスクリプターを絞り込むには `@deepseek-ai/dsh-typert-protocol/remote-info` の `isTypertRemoteMethod(descriptor)` を使用する。このガードは入力を `object` として、出力を `unknown` として公開し、エンドポイント依存のジェネリクスではない。[通常の生成された `TYPERT_REMOTE.methods` インデックス](<../generator/README.md#ordinary-remote-metadata>)は、メソッドごとの正確な静的型を提供し、そのアーティファクトインスタンス内でそれらの同じディスクリプターをエイリアスする。

### コントリビューションの登録

生成されたアーティファクトは、Loader コンポジションでは[ローダー](../loader/README.md)を通じて登録する。その他のオーナーは `ctx.typert.register(contribution)` を直接呼び出し、それを撤回する正確なディスポーザーを受け取る。パッケージフェイス ID、スキーマキー、呼び出し ID、エンドポイントの重複は、何かがコミットされる前にバッチ全体を拒否する。

Harness のオフライン統合は、プロファイル Context 内で `ctx.typert.remotes.register(contribution)` により通常の `TYPERT_REMOTE` コントリビューションを登録する。`$mount(contribution)` がすでにその登録を行うため、同じレジストリで同じコントリビューションを登録してマウントすると重複となり失敗する。オフラインメタデータの所有権は、ライブの接続とマウントの Context から分離しておく。独立したオフラインコンシューマーは、代わりに Registry なしで `TYPERT_REMOTE.methods` を読んでもよい。レジストリの状態はその Context とプロセスに属し、プロセス間で共有されず、登録もクエリも接続を開かない。

### ルックアップと Context プロバイダー

Remote 呼び出しは `ctx.typert.lookups` と `ctx.typert.contexts` を通じて Host オブジェクトとスコープ付き Context を解決する。`registerHost()` は Host ワイヤ宣言とそのワイヤから Context へのリゾルバーをインストールし、`configureHost()` はそのリゾルバーのみを置き換える。`registerClient()` は同じマージ宣言された種別の双方向 Client アダプターをインストールする。Host から Client へのイベントソースは、Context からそれを投影し戻すのではなく、自身のドメイン ID を明示的に運ぶ。

`ctx.typert.resources` は `TypertResourceMap` で宣言された各リソース種別のデフォルトワイヤフィールドを保持する。ある種別を所有するドメインは、呼び出し元ファイバーの Cordis effect として `register(kind, { field })` でそれを登録する。1 つの種別の 2 回目の登録はスローし、組み込みの ID を持たないリソース種別である `global` も同様である。`get(kind)` は 1 つの宣言を読み取り、`entries()` は登録されたすべての `{ kind, field }` を登録順に一覧する。ルックアッププロバイダーと Host Context アダプターは `resource` を通じて自身のワイヤ ID のリソース種別を指定でき、設定されたリゾルバーはそれを保持する。Gateway は非オーナー呼び出しのリソースを解決するときに 3 つすべてを読む。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションでは、レジストリがコントリビューションをどのように保存し所有するかを説明する。コンシューマー API は[このパッケージの使い方](#use-this-package)で扱う。

### 設計の考え方

レジストリは 1 つの原則の上に構築されている。コントリビューションは 1 つのアトミックでファイバー所有のコミットである。`register()` は最初にパッケージフェイス ID、スキーマ、呼び出しディスクリプターを検証し、次にすべてを単一の Cordis effect の下でコミットする。そのディスポーザーはまさにそのコントリビューションを撤回する。重複する ID は、状態が変わる前に所有操作の境界で失敗する。

### サブレジストリ

- `ctx.typert.local` — 現在の環境の呼び出し定義。ソースモードフォールバック用の `hasSeen()` 履歴を含む。
- `ctx.typert.remotes` — 呼び出し元ファイバーにマウントされた、コンシューマーが選択したコントリビューション。
- `ctx.typert.lookups` — ルックアッププロバイダーと、キーごとにコンポジションが所有するリゾルバーオーバーライド。
- `ctx.typert.contexts` — スコープ付きキーごとの Host Context プロバイダーと Client Context バインダー。
- `ctx.typert.resources` — リソース種別ごとのデフォルトワイヤフィールド。

各サブレジストリは `TypertRegistryChange` イベントを購読リスナーに発行する。スローするリスナーはログに記録され、後続のリスナーを止めない。

### アイデンティティと検証

キーは安定している。リフレクションは `<package>#<face>`、スキーマは `<package>#<name>`、エンドポイントは `<namespace>/<method>` である。検証は、`#` を含む名前、RPC セグメント文法に合わないワイヤ名、重複キー、レジストリのライフタイム中にワイヤ宣言が変わるルックアップ定義を拒否する。スキーマエントリと strict コーデックはファクトリーを運ばなければならない。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/service.ts`](src/service.ts) | `TypertRegistry` サービス、ストア、検証、effect の配線 |
| [`src/types.ts`](src/types.ts) | コントリビューション、レコード、フィルターの型 |
| [`src/client/index.ts`](src/client/index.ts) | 同じレジストリをインストールする Client フェイス |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルのコントラクトでは足りない場合にこれらのページを読む。レジストリから、それを供給するものとそれを消費するものへと進む。

- [Typert ローダー](../loader/README.md) — 生成された host アーティファクトの自動登録。
- [Typert ジェネレーター](../generator/README.md) — レジストリが保存するコントリビューションを生成するもの。
- [Typert プロトコル](../protocol/README.md) — レジストリが提供するディスクリプター、コーデック、プロバイダーコントラクト。
- [Typert サブシステムリファレンス](../../../docs/subsystems/typert.md) — 文字どおりの `ctx.typert` コントラクト。
- [API Gateway リファレンス](../../../docs/api-gateway.md) — 呼び出しディスクリプターとプロバイダーの主要なコンシューマー。

-----

<a id="model-experience"></a>
## モデル体験

なし。このランタイム型レジストリのコンシューマー(cordis_inspect、ワイヤフェイス、ゲート)が、レジストリ内容のモデル可視の投影を所有する。

#### KV キャッシュへの影響

直接の影響はない。リフレクションやスキーマをリクエストに置くコンシューマーが、結果として生じるプレフィックス変更を所有する。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、レジストリが何を保存し何を拒否するかを定義する。現在のパッケージの制約であり、タスクのバックログではない。

- **グラフのマージなし** — レジストリはフェイスごとに生成されたリフレクションを保存するが、host と client のグラフをマージしたり、TypeScript 参照を解決したりしない。それらはアナライザーとエミッターの関心事である。
- **スキーマキーはフェイスを含まない** — host と client は別々のコンテキストで実行されるため、両方のフェイスから同じ名前のスキーマを 1 つのコンテキストに登録すると重複として拒否される。
- **JSON Schema の投影はキャッシュされない** — `toJSONSchema()` は呼び出しごとに新しいドキュメントを返す。繰り返し投影するコンシューマーがキャッシュを所有する。

<a id="dev-note"></a>
### Dev Note

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
