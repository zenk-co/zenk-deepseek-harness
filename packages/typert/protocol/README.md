---
description: "共有の Typert Remote プロトコル。ビジネスパッケージ、生成アーティファクト、Host Gateway、Client API が使用するデコレーター、wire 記述子、コーデック、プロバイダー契約。"
kind: "package-library"
---

# @deepseek-ai/dsh-typert-protocol

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-typert-protocol` を使うと、ビジネスパッケージは Host メソッドを Remote クライアントへ公開できる。メソッドを `@Remote`（スコープ付きレシーバーには `@RemoteScope`）でマークし、サービスを wire 名前空間へバインドし、merge 拡張可能なプロトコルマップを通じて Host オブジェクトとスコープ付き Context を wire 識別子に関連付ける。生成アーティファクト、Host Gateway、Client API は、同一の呼び出し記述子、コーデック、プロバイダー契約を消費する。呼び出しが所有する値は、参照カウントを増やすことなくクリーンアップを Gateway へ移譲する。このパッケージは Cordis サービスを登録せず、TypeScript 解析も実行しない。

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

このパッケージは、Host のケイパビリティを Remote クライアントへ公開するビジネスパッケージおよびアセンブリのメンテナー向けである。これは宣言ライブラリであり、メソッドをマークし、サービスをバインドすれば、あとは生成パイプラインと Gateway が処理する。

### Host メソッドを公開する

ビジネスパッケージは公開インスタンスメソッドを `@Remote`（レシーバーがスコープ付き Context 由来の場合は `@RemoteScope(key)`）でマークし、所有サービスは `TypertRemoteService` を継承するか、`bindTypertRemote()` で `typertRemote` バインディングを宣言する:

```text
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

export class GoalService extends TypertRemoteService {
  @Remote
  async create(agentId: string, objective: string): Promise<GoalResult> {
    ...
  }
}
```

生成がそのメソッドをサービスの名前空間配下の wire エンドポイントに変換し、Client は `ctx.remote` を通じて型付きメソッドとして呼び出す（[API Gateway リファレンス](../../../docs/api-gateway.md)参照）。メソッドは、最後のパラメーターとして `signal: AbortSignal` を宣言することで協調的キャンセルにオプトインする。signal は注入されるのであって、JSON パラメーターやルックアップフィールドになることはない。

単項メソッドは `Uint8Array` を直接、またはネストしたオブジェクト、配列、タプル、オプションのフィールド、union、再帰型の中に含めて返せる。生成はオプションの結果コーデック `encode()` / `decode()` を提供する。エンコードはバイトを含みうる型の部分木だけを訪問し、デコードは再構築した値を検証する。Client 側の宣言はすべてのバイト位置で `Uint8Array<ArrayBuffer>` を使い、その他のフィールド型はそのまま保つ。純粋な JSON 結果は、Host 側のバイト検出や Client 側のパースなしで通過する。パラメーター、イベント、ストリーム項目は JSON のみであり、実行時のオブジェクト循環参照はサポートされない。

ストリームメソッド（`@Remote({ mode: 'stream' })`）は `Iterable`、`AsyncIterable`、`RemoteStream<Out, In>` を返す。`In` は Client が同じ論理ストリーム上で送り返してよい項目を宣言し、メソッドは `this.ctx.invocation.uplink<In>()` でそれらを読む。記述子はそれらのコーデックを保持する。`RemoteInvocation` はさらに、受信側の `service`、呼び出し元の `peer`（そのキャリアが名指す `PeerScope`）、キャリアの `signal` を名指す。`ctx.invocation` は、Remote 呼び出しに由来しない Context では `undefined` である。ツリー内で最初の `bindTypertRemote()` バインディング（すべての `TypertRemoteService` コンストラクターが行う）が、そのアクセサーをルートに登録する。Cordis のコピーをまたぐ `Context.is()` は、ビルド済み Service に渡されたソース Context を認識するので、ソースとビルド済みが混在する構成でもこのアクセサーと呼び出しローカルのプリンシパルが維持される。生成された Client のストリームメソッドは `RemoteStreamHandle<Out, In>` を返す。すなわち、ダウンリンクの反復の隣に `send`、`end`、`dispose` を備えたハンドルである。アップリンク項目はブラウザーから到着するため Host で 1 つずつ検証され、ダウンリンク項目は Host メソッドが生成した値なのでそのまま通過する。

`@Remote` のオプションには `name`、`mode`、および後述の `resources` リーダーしか含まれない。入力ポリシーはメソッド注釈ではなく消費者に属する。`method.input(options?: TypertRemoteInputOptions)` はキャッシュされた `TypertRemoteValue<Input>` を返し、その唯一のオプションは `strict?: boolean` である。`method.input()` と `{ strict: false }` は通常の Remote 処理を維持する。宣言されたオブジェクトは未知のフィールドを受け入れて除去する。`{ strict: true }` は宣言されていないフィールドを再帰的に拒否するが、明示的な JSON 値と辞書のキーはオープンのままで、辞書の値は宣言された検証を保持する。どちらの名前付き引数エンベロープも余分な引数を拒否する。一致する `input.create().parse(raw)` と `input.jsonSchema` のために 1 つのビューを選択する（`const input = method.input({ strict: true })`）。これは Host のディスパッチを変更しない。[generator](<../generator/README.md#ordinary-remote-metadata>) が公開と対になるコーデックを所有する。

普通の `./remote` アーティファクトは `TYPERT_REMOTE` を `TypertRemoteInfo` としてエクスポートし、マウント可能な `TypertRemoteContribution` を拡張する。その型付き `methods[endpoint]` エントリは `descriptors` にあるものと同じ直接記述子オブジェクトで、派生した `input(options?)` と `invoke(remote, input, signal?)` を持つ。パラメーターのドキュメントは `parameters[].description` にあり、`result` は単一の結果コーデック、パーサー、およびオプションの投影である。単項記述子は `mode` を省略し、ストリームは `'stream'` を使う。Context のみのレシーバーは `descriptors` とスコープ付き宣言に残り、`methods` には入らない。

公開された純粋な `@deepseek-ai/dsh-typert-protocol/remote-info` エントリーの `createTypertRemoteInfo(spec, z)` は、コンストラクターではなくクラスインスタンスを返す。構築は静的 spec と呼び出し元が提供する Zod ランタイムだけを保持し、最初の `descriptors` または `methods` の読み取りで共有インデックスを構築してキャッシュする。各入力ポリシービュー、そのパーサー、およびオプションの JSON Schema 投影は独立に遅延生成されキャッシュされる。`method.input().create()` は通常のパーサーを要求する。生の spec は Zod ファクトリーを必要とするが、消費者向けの `TypertSchema<T>` は `parse(value: unknown): T` だけを約束する。JSON Schema はランタイムの `z.toJSONSchema()` ではなく generator の投影から得られる。リーフにはランタイムインポートがなく、生成アーティファクトが Zod を提供する。メタデータとスキーマへのアクセスは決してネットワークを呼び出さない。ルートはファクトリーも再エクスポートするが、Cordis をインポートする。

invoker は呼び出し元が所有する、マウント済みの、スコープなし Client Remote を受け取り、呼び出し時にその名前空間メソッドを解決する。名前空間レシーバー、オプションの位置の穴、signal を保持し、同じ `Promise<RemoteResult<DecodedOutput>>` または完全な `RemoteStreamHandle<Output, Uplink>` を非同期ラッパーなしで転送する。`DecodedOutput` は既定で作成時の出力になり、生成はバイトを含む単項メソッドにのみ `RemoteDecoded<Output>` を提供し、通常の JSON 結果の再帰的再マッピングを避ける。`result.create().parse()` は作成時の出力型を保持し、共有バイトバッファーを正規化しない。入力バリアントまたは結果が JSON Schema サポートを欠いても、ドキュメントとパースは引き続き利用できる。各バリアントの `jsonSchemaError` がその投影が存在しない理由を説明する。レジストリの読み取り側は、同じ純粋エントリーの `isTypertRemoteMethod(descriptor)` を使って、ベース記述子をこれらの直接ケイパビリティに絞り込む。

### 呼び出し元の識別と非オーナー呼び出し元の受け入れ

`PeerScope.principal` は、プロセス内の Host コードが Peer を作成するときに確定する呼び出し元 ID である。wire フィールドで設定することはできず、`PeerScope.signal` は Peer スコープの終了時にアボートする。`PrincipalMap` は merge 拡張可能であり、各ドライバーは一意のリテラル `kind` を持ち資格情報を含まない JSON エントリーを 1 つ宣言する。プリンシパルはセッションログに永続化されうるためである。組み込みエントリーは `owner: { kind: 'owner' }` である。呼び出し元を永続出力に記録する Remote メソッドは `principalOf(this.ctx.invocation)` を呼ぶ。これは非オーナー呼び出し元のプリンシパルを返し、オーナーおよび Remote 呼び出しの外では `undefined` を返す。フィールドはそれが定義されている場合にのみ書き込まれる。

すべての Remote メソッドはアクセス制御の下にある。[`dsh-api-remote-access`](../../api/remote-access/README.md) が、呼び出しが触れるリソース上で非オーナー呼び出し元がそのメソッドに到達してよいかを決定する。`TypertResourceMap` は `TypertLookupMap` の隣で merge 拡張可能であり、識別子型を所有するパッケージがそのリソース種別を `TypertResource<Id>` として宣言する（`dsh-session` は `session: TypertResource<SessionId>`、`dsh-workspace` は `workspace: TypertResource<WorkspaceId>` を宣言する）。`RemoteAccessResource` は、組み込みの識別子なし `{ kind: 'global' }` か、宣言された種別とその識別子のいずれかである。リソースは互いに独立なので、`global` へのアクセスはどのセッションについても何も含意しない。実行時、種別を所有するドメインは `typert.resources.register(kind, { field })` を通じて既定の wire フィールドを登録する（これは `global` を拒否する）。ルックアッププロバイダーと Host Context アダプターは、`resource` を通じて自身の wire 識別子が運ぶ種別を名指すので、Agent ルックアップパラメーターや Agent スコープのレシーバーを持つメソッドはオプションなしで `session` リソースを運ぶ。`@Remote` と `@RemoteScope` の `resources` オプションは、種別を、メソッドの wire 引数を自身のパラメーターとして受け取るリーダーへマップする。それらの型はデコレートされたメソッドから推論され、ルックアップパラメーターはその wire 型にマップされるので、`@Remote({ name: 'page', resources: { session: request => request.address.sessionId } })` は既定では読めないフィールドを読む。リーダーと既定がどのリソースも名指さない呼び出しは `global` に触れる。リーダーはメソッドがアクセスするすべてのリソースを名指さなければならない。アクセス制御は省略されたリソースを決して検査しないからである。`TypertForwardableEventEntry` の転送される `emit` エントリーは、自身のイベントのパラメーターで型付けられた `resources` リーダーを宣言し、それを持たないエントリーは `global` に触れる。リソース解決は [API Gateway](../../api/gateway/README.md) に属し、決定と拒否理由は [`dsh-api-remote-access`](../../api/remote-access/README.md) に属する。

### Host オブジェクトと Context を wire 識別子に関連付ける

複雑な Host オブジェクトは wire を直接越えられない。ビジネスパッケージは merge 拡張可能な `TypertLookupMap` と `TypertContextMap` を通じて関連付けを宣言する。Host Context アダプターは安定した wire 宣言を所有し、wire 識別子を生きた Context に解決する。Client Context アダプターは双方向にマップする。スコープ付き呼び出しは Client Context から発し、転送された Host イベントはそこで明示的な wire 識別子を解決するからである。Host 側の構成はその同期または非同期リゾルバーを上書きしてよい。ポリシー上の理由で拒否するリゾルバーは自身のコードを持つ `RemoteError` をスローし、それはそのまま呼び出し元へ届く。

Client の Context 解決は同期的である。`typertOwnedValue(value, release)` は、スローしない冪等なクリーンアップを呼び出し所有者へ移譲する。Gateway はハンドラーと応答の決着後にそれを呼び出す。借用された Context はクリーンアップラッパーを必要としない。共有の `TYPERT_OWNED_VALUE` シンボルと `isTypertOwnedValue` 認識子は、独立にバンドルされたプロバイダーと Gateway をまたいで機能する。ラッパー自体はリソースを保持しない。

### Remote の失敗を報告し読む

単一のクラスがすべての Remote 失敗を運ぶ。`RemoteError` は安定した `<domain>/<reason>` コードと、そのコード用に型付けられた詳細を保持する。このパッケージは普遍的なキャリアコード（`gateway/bad-request`、`gateway/cancelled`、`gateway/internal`）を宣言し、`RemoteErrorDetailsMap` を所有する。これは他のすべてのパッケージが自身のスローするコードの隣で拡張する merge 拡張可能なテーブルである:

```text
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'goal/not-found': { readonly goalId: string }
  }
}
throw new RemoteError('goal/not-found', `goal "${id}" does not exist`, { goalId: id })
```

オーナーは失敗点でスローする。エラークラスファミリーや終了コードマッピング関数を書くパッケージはない。呼び出し元は `code` で判別し（`instanceof` では決して判別しない）、`code` の分岐はキャストなしで `details` を絞り込む。`RemoteFailure` が `RemoteError` インスタンスのコード判別 union だからである。クラスがモジュールやレルムのコピーをまたいで運ばれた失敗を認識しなければならないインフラストラクチャーは、`remoteErrorOf(value)` を呼ぶ。これはプロトタイプチェーンではなく構造的マーカーを読む。

### Client で転送された Host イベントを受信する

Host アセンブリは `TypertRemoteEventSelection` を、消費者へ転送する Cordis イベントで拡張し、それが `ctx.remote.$on` のキー集合を絞り込む。`TypertForwardableEvent` はスコープなしの `void` 通知と、最終の `next()` コールバックがイベントの結果型を返すスコープ付き非同期 waterfall を受け入れる。`TypertClientEventListener` は同じ `Events` メンバーから Client リスナーを導出し、signal、オプションおよび readonly フィールド、配列、コールバック、結果型を保持する。`TypertClientRemote` は `$mount()` と `$on()` のみを公開し、イベント転送は Gateway にプライベートのまま残る。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

この節は、宣言がどのようにコンパイラー非依存に保たれるかと、各契約がどこで強制されるかを説明する。プログラミングモデルは[このパッケージを使う](#use-this-package)で扱う。

### 設計概念

このパッケージは厳密なリフレクションをコンパイラー内に保つ。デコレーターの初期化子は、Service プロトタイプ上のバージョン付き記述子に最小限のマーカーを保持する。記述子は安定した文字列プロパティ名を使うので、インストールされたプロトコルパッケージの別コピーが同じマーカーを読める。完全なパラメーター、結果、ルックアップ、スキーマのリフレクションは Typert ビルドパイプラインの仕事であり、`InvocationDescriptor` を通じて提供される。

### Remote マーカー

`@Remote` と `@RemoteScope` は初期化子をスケジュールし、メソッド名、オプションのエクスポート名、呼び出しモード、フリーズされた `resources` リーダーをプロトタイプ記述子に追加する。`remoteMethods(service)` はそのバージョンを検証し、Gateway のソースモードフォールバックが読む切り離された宣言順スナップショットを返す。マーカーは文字列名を持つ公開の非 static インスタンスメソッドを必要とし、1 つのメソッド上の競合するマーカーは拒否される。

リーダーはデコレーター作成時に検証され、デコレーター適用ごとに 1 つのレコードへフリーズされる。Gateway は実装メンバー名で `remoteMethods(service)` からそれらを読むので、インストールされたプロトコルパッケージの別コピーも同じレコードを読む。

### プロトコルマップと記述子

merge 拡張可能なプロトコルマップは静的な関連付けを型システムに保ち、実行時のプロバイダーは `ctx.typert` で解決を登録する。マップの名前と形は [`src/types.ts`](src/types.ts) にある。`InvocationDescriptor` はレジストリ、Gateway、Client Remote が消費する共有ランタイム形式であり、直接レシーバーと Context レシーバー、JSON パラメーターとルックアップパラメーター、スコープ投影、アップリンクコーデック、キャンセル、結果コーデック、ドキュメントを網羅する。生成された `TypertRemoteMethod` オブジェクトはこの記述子を直接拡張する。

`RemoteInvocation.uplinkWindow` は、キャリアの完全フレーム受信箱の容量と、コンパクト JSON 項目に加算される UTF-8 エンベロープコストをオプションで記述する。その欠如は、キャリアにエンコード済みフレーム受信箱の制限がないことを意味する。消費者は依然として自身のローカルバッファリングと確認応答ポリシーを所有する。

### wire 識別子の文法

すべての名前空間、メソッド、ルックアップ、Context セグメントは `isTypertRemoteSegment()` を満たさなければならず、生成された名前は共有 RPC キャリアをそのまま越える。厳密なコーデックは生成されたスキーマファクトリーを運び、`src-json` コーデックはより弱いソース起動パスを識別する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | デコレーター、Gateway バインディング、`remoteMethods`、セグメント検証 |
| [`src/principal.ts`](src/principal.ts) | `principalOf`、Remote 呼び出しプロデューサーが記録する呼び出し元プリンシパル |
| [`src/remote-access.ts`](src/remote-access.ts) | `TypertResourceMap` 上の `RemoteAccessResource`、`RemoteAccessResourceKind`、`RemoteAccessResourceOf` |
| [`src/json-value.ts`](src/json-value.ts) | すべてのキャリアが共有する可逆 JSON チェックである `isRemoteJsonValue` と `isRemoteUplinkItem` |
| [`src/remote-error.ts`](src/remote-error.ts) | `RemoteError` と構造的な `remoteErrorOf` 認識子 |
| [`src/remote-info.ts`](src/remote-info.ts) | 純粋な遅延 info ファクトリーと直接メソッド型ガード |
| [`src/types.ts`](src/types.ts) | プロトコルマップ、`RemoteErrorDetailsMap`、`RemoteResult`、`RemoteStream`、`RemoteStreamHandle`、`PrincipalMap`、`Principal`、`PeerScope`、`RemoteInvocation`、`InvocationDescriptor`、コーデック、プロバイダー契約、レジストリインターフェース、`TypertClientRemote` |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときにこれらのページを読む。宣言からランタイムと呼び出しパスへ進む。

- [API Gateway リファレンス](../../../docs/api-gateway.md) — 宣言がどのように動作する Host から Client への呼び出しになるか。
- [Typert サブシステムリファレンス](../../../docs/subsystems/typert.md) — protocol と Gateway の型から記録された文字どおりの公開契約。
- [Typert レジストリ](../registry/README.md) — 実行時に記述子とプロバイダーが格納される場所。
- [Typert generator](../generator/README.md) — 消費者側の宣言と記述子を生成するもの。
- [Remote 呼び出しの Agent Note](../../../.agents/notes/implemented/architecture/2026-08-02-typert-remote-method-calls.md) — Remote 呼び出しの背後にあるアーキテクチャと転送の決定。

-----

<a id="model-experience"></a>
## モデル体験

なし。コンパイラー非依存の Remote プロトコル宣言はモデル向けの何も登録しない。

#### KV キャッシュへの影響

直接の影響はない。宣言された契約は、アセンブリがそれらを 1 つのリクエストに配置したときにのみリクエストへ届く。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は宣言が表現できるものを定義する。それらは現在のパッケージ制約であり、タスクバックログではない。

- **デコレーターマーカーは最小限** — マーカーはメソッド名、オプションのエクスポートエイリアス、ストリームモード、リソースリーダー、直接または Context レシーバーの選択を含む。パラメーター、結果、ルックアップ、スキーマ、ドキュメントのメタデータには Typert ビルドパイプラインが必要である。
- **Remote シグネチャーは制限される** — デコレーターは文字列名を持つ公開の非 static インスタンスメソッドのみを受け入れ、ソースモード実行はオーバーロード、分割代入、デフォルト引数、残余パラメーターのシグネチャーを表現できない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
