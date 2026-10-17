# API Gateway

日本語 | [English](api-gateway.en.md) | [中文](api-gateway.zh.md)

これは Typert API Gateway の現在の状態のリファレンスである。ビジネスサービスが単項およびストリームの Remote メソッドをどう宣言し、ビルドが Host と Client の契約をどう生成し、呼び出しが Connection RPC と `/api` ルートをどう再利用するかを説明する。Session イベント、増分データ、その他のストリーミングプロトコルはこのドキュメントの範囲外である。それらは同じ Connection を使ってよいが、Remote メソッド記述子は使わない。

## プログラミングモデル

ビジネスサービスは `@Remote` または `@RemoteScope` を使って、Client に公開するメソッドを選ぶ。マークされていないメソッドは生成される Client 型やランタイムコントリビューションに入らず、`ctx.remote` から呼べない。

`@Remote` は、ルート Host Context に登録された Cordis サービスへの呼び出しを表す。複雑な Host オブジェクトは wire を直接越えられない。ビジネスパッケージは `TypertLookupMap` を通じてそれらの wire 同一性との関連を宣言し、実行時に `ctx.typert.lookups` で既定の解決プロバイダーを登録しなければならない。例えば、Host シグネチャで `agent` という名前の `Agent` パラメーターは `agentId` wire フィールドを生成し、Gateway はビジネスメソッドを呼び出す前にその id を Host オブジェクトへ解決する。Host コンポジションは `ctx.typert.lookups.configure()` を使って、ビジネスパッケージが所有するパラメーター名、wire フィールド、正規型シンボルを変えることなく、ルックアップキーの解決ポリシーを上書きできる。

`@RemoteScope(key)` はまず `ctx.typert.contexts` を通じて同一性をスコープ付き Context に解決し、次にその Context からサービスを取得してメソッドを呼び出す。これは、メソッド自体がスコープ付きコンポジションに依存し、`Agent` のようなオブジェクトを明示的に受け取る必要がない場合に適用される。

`@Remote` はエクスポート名または `{ name?, mode?, resources? }` を受け取り、`@RemoteScope(key, option?)` はエクスポート名 — 下記の `@RemoteScope('agent', 'current')` のように — または `{ name?, resources? }` を第 2 引数として受け取る。`resources` は、アクセス制御のために 1 回の呼び出しが触れるリソースの同一性を返す、kind ごとのリーダーを保持する。各リーダーは、デコレートされたメソッドから推論された型を持つ、そのメソッドの wire 引数を自身のパラメーターとして受け取る。ほとんどのメソッドはリーダーを宣言しない。Gateway は `resource` を宣言するルックアップパラメーターとスコープ付き Context、および `typert.resources` の既定フィールドからも同一性を読むからである。その順序は [Typert サブシステム](subsystems/typert.md)が所有する。

サービスは通常 `TypertRemoteService` を継承し、コンストラクターが Cordis サービスキーと既定の Remote 名前空間を明示的にバインドする。すでに別の基底クラスを持つサービスは、代わりに `readonly typertRemote = bindTypertRemote(this, serviceKey)` を宣言できる。どちらの形式も検査可能な公開バインディングを残し、コンパイラーがシンボルをコンストラクターに注入することに依存しない。

```ts
import type { Agent } from '@deepseek-ai/dsh-agent'
import { TypertRemoteService, Remote, RemoteScope } from '@deepseek-ai/dsh-typert-protocol'
import type { Context } from '@deepseek-ai/cordis'

export interface CreateGoalRequest {
  objective: string
}

export interface CreateGoalResult {
  accepted: boolean
}

export class GoalService extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'goals')
  }

  @Remote('create')
  createForClient(
    agent: Agent,
    request: CreateGoalRequest,
    signal: AbortSignal,
  ): CreateGoalResult {
    signal.throwIfAborted()
    return this.create(agent, request)
  }

  @RemoteScope('agent', 'current')
  currentForClient(): CreateGoalResult {
    return { accepted: true }
  }

  private create(_agent: Agent, request: CreateGoalRequest): CreateGoalResult {
    return { accepted: request.objective.length > 0 }
  }
}
```

Remote メソッドは値を同期的に返すか、Promise を返してよい。協調的キャンセルのためには、Host シグネチャの最後のパラメーターがグローバル型を使う `signal: AbortSignal` でなければならない。これは `args` に入らずに記述子に記録され、生成される Client メソッドはオプションの最後の `AbortSignal` を受け入れる。

`@Remote({ mode: 'stream' })` は、`Iterable`、`AsyncIterable`、または `RemoteStream<Out, In>` を返すメソッドをマークする: Gateway は yield された各項目 — Host メソッドが生成した値 — を、多重化された `/api/remote.mux` WebSocket またはインプロセスキャリアを通じて配信し、生成される Client メソッドは項目を反復し、同じ論理ストリームの Client から Host へのアップリンク用の `send`、`end`、`dispose` を公開する `RemoteStreamHandle<Out, In>` を返す。`RemoteStream<Out, In>` の第 2 型引数はアップリンク項目型を宣言する。Client が送る各項目はブラウザーから届くため、Host メソッドが `this.ctx.invocation.uplink<In>()` を通じて読む前に、Gateway が生成された `In` コーデックで検証する。アップリンクは `args` にもパラメーターリストにも入らない。フレーム、ハーフクローズ、キャンセル、inbox バウンドの契約は [Gateway README](../packages/api/gateway/README.md)が所有する。

Client は JavaScript Proxy ではなく、通常のオブジェクトの具象関数を使う。直接呼び出しとスコープ付き呼び出しは `ctx.remote.<namespace>` と `agentCtx.remote.<namespace>` の下に現れる。各名前空間は `remote.<namespace>` として登録されるトレースされた Cordis 子サービスである。Client アセンブリは `ctx.remote.$mount()` を通じてコントリビューションをマウントし、名前空間は最後のメソッドが撤回された後にアンロードされる。依存関係の宣言は実際の呼び出し元に属する: `ctx.remote.<namespace>` または `agentCtx.remote.<namespace>` を読むビジネスパッケージだけが、自身の `inject` に `remote` と `remote.<namespace>` の両方を宣言する。コントリビューションをマウントするだけのアセンブリや、その名前空間を呼ばない上位のランタイムは、ビジネスパッケージに代わって名前空間依存を宣言しない。`@Remote` メソッドがちょうど 1 つのルックアップパラメーターを持ち、同名の `TypertContextMap` が同じ wire 同一性を使う場合、生成されるスコープ付きシグネチャはその同一性パラメーターを省略する。`@RemoteScope` はスコープ付き呼び出しインターフェースのみを生成する。

```ts ignore-check
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AgentContext } from '@deepseek-ai/dsh-api-session-controller/client'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'

export const inject = ['remote', 'remote.goals']

declare const ctx: Context
declare const agentCtx: AgentContext
declare const agentId: SessionId

await ctx.remote.goals.create(agentId, { objective: 'ship it' })
await agentCtx.remote.goals.create({ objective: 'ship it' })
```

Client アプリケーションは `@deepseek-ai/dsh-api-remotes` のみをアセンブルする。このパッケージは選択されたビジネスパッケージの `/remote` サブパスをランタイム値としてインポートし、`ctx.remote.$mount()` を通じてそれらのコントリビューションをマウントし、同じファイルの宣言マージを再エクスポートする。Host Remote パッケージの追加は Client コンポジションのオーナーによる明示的な選択である。ビジネスコンポーネントは Typert Gateway やビジネスパッケージの Remote JS を個別にロードする必要はない。

`api-remotes` アセンブリと `ctx.remote` 契約は React 非依存である。任意の Client アセンブリに見える Host メソッドは、生成時に選択された Remote メソッドに限られる。

## コンポーネントの責務

| 場所 | パッケージまたはエントリー | 責務 |
|---|---|---|
| 共有 | `@deepseek-ai/dsh-typert-protocol` | デコレーター、Gateway バインディング、merge 拡張可能なプロトコルマップ、呼び出し記述子、プロバイダー型を宣言する。TypeScript 解析を開始せず、Cordis サービスも登録しない |
| ビルド | `@deepseek-ai/dsh-typert-generator` | Host `ts.Program` から Remote シグネチャ、型グラフ、ルックアップ、Context、ソース位置を厳密に解析し、Host アーティファクトと Host-for-Client アーティファクトを生成する |
| ホスト | `@deepseek-ai/dsh-typert-registry` と Loader | 生成された Host 記述子、スキーマ、ビジネスパッケージ登録を `ctx.typert` に配置し、ルックアッププロバイダーと Context プロバイダーを保持する |
| ホスト | `@deepseek-ai/dsh-api-session-controller` | アプリケーションの Agent/Session 同一性ポリシーを所有し、対応する Typert ルックアップを構成する |
| ホスト | `@deepseek-ai/dsh-api-gateway` | `ctx.typertGateway` を提供し、Remote エンドポイントをクレームし、リクエスト値を検証し、オブジェクトまたは Context を解決し、ライブ Cordis サービスを呼び出す |
| ホスト | `@deepseek-ai/dsh-api-remote-access` | 非 owner の Peer が呼べる Remote メソッドを、ビジネスが登録したロールベースポリシーを通じて決定し、リスト結果をフィルターし、各 Peer のアクセススナップショットをストリームする。Gateway はこれを必須とする |
| クライアント | `@deepseek-ai/dsh-api-gateway/client` | `ctx.remote` と `remote.<namespace>` 子サービスを提供し、生成された記述子を具象メソッドとしてマウントし、Connection を通じて呼び出しを開始・キャンセルする |
| クライアント | `@deepseek-ai/dsh-api-remotes/client` | アプリケーションが許可する `/remote` コントリビューションを明示的に選択してマウントし、対応する宣言マージをビジネスコードへもたらす |
| 両方 | `@deepseek-ai/dsh-client-connection` | RPC キャリア、リクエスト相関、信頼境界、キャンセル、レスポンスエンベロープ、および `/api` HTTP ブリッジを提供する |

API Gateway パッケージは、Host ディスパッチャーと Client Remote エンドポイントをピアエントリーとして所有するが、2 つのビルドが同じ `ts.Program` に入ることは決してない。Host エントリーは Client の Cordis `Context` マージをインポートせず、Client エントリーは Host Gateway サービスをインポートしない。

## 厳密な生成パイプライン

ルートビルドは Host フェイスをコンパイルしてバンドルし、次に Client フェイス、次に Web シェルをビルドする ([ステップ順序](development.md#typescript-project-layout))。Host フェーズはまず Host パッケージ参照をコンパイルし、次に `tsdown --env.DSH_BUILD_FACE host` を実行する。通常の Host Project Reference グラフが Typert generator をコンパイルし、これはこの tsdown パス中に、Host 集約を唯一の `ts.Program` シードとして実行される。Client フェーズは次に Client パッケージ参照をコンパイルし、`tsdown --env.DSH_BUILD_FACE client` を実行して、新しく生成された Remote Client 宣言とランタイムコントリビューションを、Typert を再び起動することなく消費する。

両方の tsdown パスは `vendor/*`、`packages/*/*`、`apps/cli` に一致し、Host パスはさらに `apps/desktop-host` にも一致し ([ビルド順序](development.md#typescript-project-layout))、どちらも対応する tsc フェーズが `lib/types` に出力した JavaScript のみをバンドルする。ルート設定は Client アーティファクトをスキャンせず、パッケージ名を分類せず、維持されたフィルターを tsdown に渡さない。パッケージローカルの設定は `DSH_BUILD_FACE` に基づいて現在のフェーズのエントリーを返す。通常の Client プラグインは Client フェーズ中に Node ローダーエントリーとブラウザーバンドルの両方を生成する。

`api/remotes`、`api/gateway`、`api/session-controller`、`api/workspace-controller` (および `client/connection`) は TypeScript フェイスを分割する。`api/remotes` の Client プロジェクトは、Host tsdown 中にビジネスパッケージ向けに生成された `/remote` 宣言に依存する。ルートの集約と直接のコンシューマーは、それぞれ分割パッケージの `tsconfig.host.json` または `tsconfig.client.json` を参照しなければならない。`api-remotes` の `clientBundle(..., { hostPhase: true })` は Host tsdown 中に Host エントリーを生成し、Client tsdown にはブラウザーエントリーだけを残す。Agent/Session ルックアップポリシーは `api-remotes` ではなく `@deepseek-ai/dsh-api-session-controller` に住む。

コントリビューションする各ビジネスパッケージは、生成ファイルをソースディレクトリではなく自身の `lib/` ディレクトリに書き込む:

| ファイル | コンシューマー | 内容 |
|---|---|---|
| `typert.host.js` | Host Loader | Host フェイスのランタイムリフレクション、厳密な呼び出し記述子、スキーマ登録値 |
| `typert.host.d.ts` | Host 型システム | Host フェイスの生成宣言 |
| `typert.remote-client.js` | `api-remotes` | 厳密な記述子とランタイムコーデックを含む、マウント可能な `TypertRemoteContribution` |
| `typert.remote-client.d.ts` | Client 型システム | `TypertRemoteNamespaceMap` と `TypertRemoteScopeMap` の宣言マージ、および Client セーフな型参照 |
| `typert.remote-client.d.ts.map` | エディター | 生成されたメソッドプロパティを Host パッケージ内の Remote メソッド宣言へマップし直す |

ビジネスパッケージは Host Loader エントリーを `./typert` を通じて、Host-for-Client エントリーを `./remote` を通じて公開する。generator はこれらのパッケージエクスポートと公開ファイルリストも検証する。対応するエントリーを提供する明示的なコントリビューションパッケージに対してのみアーティファクトを生成する。

Remote Client 宣言のパラメーター名は wire フィールドから来るが、パラメーター型と戻り値型は元のビジネスパッケージがエクスポートする Client セーフな型を参照する。宣言マップは `ctx.remote.goals.create` の背後の生成プロパティを、`@Remote` でマークされた Host ソースメソッドへ解決し直すので、宣言マップをサポートするエディターは、生成された `.d.ts` で止まらずに Client の呼び出しから実装へナビゲートできる。

厳密な解析では、Remote は具象実装を持つ公開の非 static インスタンスメソッドでなければならない。メソッドはジェネリックにできず、パラメーターは必須の、名前付き単純識別子でなければならず、分割代入、デフォルト値、残余パラメーター、オプションパラメーターは使えない。Typert は通常の JSON 表現可能な型に対して厳密なスキーマを生成する。workspace クラスのような複雑なオブジェクトは一意な `TypertLookupMap` 宣言を持たなければならない。ルックアップパッケージと Context パッケージは、静的宣言マージとランタイムプロバイダー登録の両方に責任を持つ。どちらかが欠けている場合、ビルドが失敗するか、そのプロバイダーを必要とする最初の呼び出しが失敗する。

## ランタイム呼び出し

Remote 呼び出しは Connection の `/api` ルートを使う。Client Remote は `connection.rpc.call('/api', '<namespace>/<method>', { args }, signal)` を呼び、HTTP キャリアはこれを `POST /api/<namespace>/<method>` にマップする。ペイロードには名前付き `args` オブジェクトだけが入る。

Connection は HTTP ブリッジの前に `/api` の統合信頼チェックを実行し、共有 FetchHandler の内側でディスパッチする。Typert Gateway は、厳密な記述子またはアクティブな SRC マーカーを持つ 2 セグメントのエンドポイントのみをクレームする。バイナリ Remote フィールドを JSON 互換メタデータと結果相対のバイト添付へ射影し、Connection がそれらをマルチパートレスポンスとしてフレーム化する。フィーチャー所有の正確な Fetch ルートは RPC エンベロープの外のレスポンスを扱い、その他のリクエストは 404 を返す。トランスポート、RPC id、レスポンスエンベロープ、リクエストキャンセルは Connection が所有し、Remote データプロトコルとビジネスディスパッチは Gateway が所有する。Connection キャリアの置き換えは、Remote 記述子や Client プログラミングインターフェースの変更を必要としない。

Gateway はすべての呼び出しで、ビジネスオブジェクトをキャッシュせずに、現在のレジストリから記述子とライブサービスを解決する。すべての呼び出しはそれが代弁する Peer を名指し、破棄済みの Peer は `gateway/peer-disposed` で拒否される。Gateway は `args` のフィールドが記述子に正確に一致することを要求する。Peer のプリンシパルが owner でない呼び出しでは、その後に呼び出しが触れるリソースを解決して `ctx.remoteAccess.decide()` に問い合わせるので、拒否された呼び出しはルックアップを解決せず、Agent もアクティベートしない。wire 値をコーデックで検証し、登録されたルックアップまたは Context プロバイダーを通じてオブジェクトまたはレシーバーを解決し、バインディングが指すサービスメソッドを呼び出す。Client Gateway はデコードされたバイナリ結果を生成された結果コーデックで検証する。通常の JSON 結果は既存の扱いを保つ。プロバイダーの欠落、未知の同一性、バインディングの不一致、引数の欠落または過剰、スキーマ失敗、メソッドの欠落は、ビジネスコードに入る前または出た後に失敗する。

ルックアッププロバイダーの `register()` は安定した宣言と既定のリゾルバーの両方を提供し、`configure()` は Host コンポジションが所有する、非同期に実行されてよくエフェクトライフタイムにスコープされるリゾルバーを提供する。設定はプロバイダーのマウントより先行してよい。プロバイダーがない場合でも呼び出しは `gateway/lookup-unavailable` で失敗し、設定をアンロードするとプロバイダーの既定ポリシーが復元される。Session コントローラーは `agent` と `session` の標準リゾルバーセマンティクスを所有する: ライブの Agent を再利用し、通常のコールドセッションを自動的に再開し、同時再開を重複排除し、サブエージェントルーティングが所有する同一性を拒否する。`session` ルックアップはその Agent の Session を返す。再開失敗と所有権フェンスは、自身のコード `session/not-found` または `session/agent-busy` を持つ `RemoteError` を投げ、Gateway はそれをそのまま wire にエンコードする。分類されない throw だけが `gateway/internal` に畳まれる。

Client コントリビューションのアンロードは、その記述子と具象メソッドをまとめて除去し、進行中の呼び出しを abort し、外部コードが保持する古いメソッドハンドルの以降の呼び出しを reject させる。Host で撤回された厳密なエンドポイントも SRC 推論に縮退しないので、ホットアンロードが黙って検証を弱めるのを防ぐ。

## SRC 開発フォールバック

Host が `node --import tsx/esm` を通じてソースから起動する場合、Typert コンパイラープラグインは実行されない。標準のデコレーター初期化子は引き続き、Service プロトタイプ上のバージョン付き記述子にメソッド名と呼び出しモードを記録し、`TypertRemoteService` または `bindTypertRemote()` が明示的なサービスバインディングを提供する。したがって Gateway は `ts.Program` を起動せずに、より弱い一時記述子を構築できる。記述子の安定した文字列プロパティ名により、`remoteMethods()` は、別にインストールされたプロトコルパッケージのコピーが書いたマーカーを読める。

SRC フォールバックはライブ関数から単純なパラメーター名をパースする。パラメーター名が登録済みルックアップの `parameter` (`agent` や `session` など) に一致する場合、そのルックアップの `agentId` または `sessionId` wire フィールドを使い、Host でそのオブジェクトを解決する。その他のパラメーターは、特殊なプロトタイプを持たない、循環のない JSON 安全なデータであることだけをチェックされる。`@RemoteScope` は登録済み Host Context プロバイダーの wire フィールドを直接使う。SRC は TypeScript 型を読まず、Zod スキーマを生成せず、オプションパラメーターを推論せず、分割代入、デフォルト値、残余パラメーター、重複パラメーター名もサポートしない。

SRC が解決するのは、ソースから実行される Host プロセスのディスパッチだけである。Client は実行中の Host からデコレーターを発見せず、Client Remote は厳密なコーデックを持たない SRC 記述子のマウントを拒否する。その型、コーデック、Remote 登録値は常に、最も新しく生成された `lib/typert.remote-client.*` アーティファクトから来る。

## 開発モード

Web 開発は 1 つのコマンドで実行され、現在の Host、Client、Web アーティファクトをビルドし、ソース Host を起動し、Client バンドルの再ビルドを続ける:

```sh
pnpm run dev:web
```

`dsh` は tsx を通じて Host ソースを起動するので、Host は SRC フォールバックを使える。`dev:web` のウォッチャーは、client フェイスの型出力、Client プラグインとライブラリのバンドル、Web シェルをソース編集時に再ビルドする。それらは Host デコレーターを解析せず、Remote Client DTS も生成しない。`dev:web` が最初に実行する完全ビルド (または `pnpm run build`) だけがそれを行う。

Remote メソッドの契約を変えずに実装本体だけを変更する場合、Typert ファイルの再生成は不要である。デコレーターの追加・削除や、エクスポート名、名前空間、パラメーター、戻り値、ルックアップ、Context、キャンセルシグネチャの変更の後は、Client が新しいコントリビューションをコンパイルしてバンドルする前に Host が厳密な契約を生成するよう、順序付けられた lib ビルドを再実行する:

```sh
pnpm run build:lib
```

実行中の Client ウォッチャーは、再バンドル時にこれらの生成ファイルを消費する。`pnpm run build:lib:host` がすでに Host 契約を更新している場合、`pnpm run build:lib:client` が Client 側を完了できる。クリーンなワークツリーは Host フェーズをスキップできない。フロントエンドソースだけの再コンパイルは Host デコレーターから新しい型を推論できない。`pnpm run typecheck` は Client tsc の前にバンドルなしの Typert パスで Host 契約を生成し、CI ビルドレーンとリリースビルドは Client tsc の前に Host バンドルフェーズでそれを生成する。

## 境界

Remote が扱うのは、1 リクエストと 1 結果で完結する単項メソッド呼び出しと、項目が Host → Client へ流れ、Client の項目が `this.ctx.invocation.uplink()` を通じて実行中の Host メソッドへ届くストリームメソッドである。Session イベントストリーム、ページネーション、増分 reduce、プロジェクション、エンティティサブストリームには、依然として別のデータプロトコルと登録モデルが必要である。Connection を再利用する場合でも、Remote メソッドを装ったり、呼び出し記述子に入ったりしてはならない。

API レイヤーは `remotes → gateway → connection → webserver` として構成される。BFF と Typert RPC レイヤーは `packages/api` の下に住み、Connection と WebServer は `packages/client/connection` と `packages/host/webserver` に住む。ネストされたフィールドや配列エントリーを含む `Uint8Array` を含む単項結果は[バイナリ Remote 転送](../.agents/notes/implemented/architecture/2026-09-17-workspace-file-binary-transfer.md)を使う。RPC エンベロープの外のレスポンスを必要とするフィーチャーは、正確な Connection Fetch ルートを登録する。

ルックアップポリシーはキーごとに構成されるので、すべての `agent` または `session` パラメーターがコールドレジューム動作を共有する。ライブオブジェクトのみを受け入れるには、存在しないパラメーターごとまたはエンドポイントごとの明示的ポリシーが必要になる。ビジネスメソッドは、オブジェクトが復元由来かどうかを推測してはならない。

### ビジネス所有権

`packages/api` はトランスポート、呼び出し形式、Session ライフサイクルを所有する。ビジネスルールは独立したビジネスパッケージに属し、登録サーフェスまたは射影されたデータを通じてこのレイヤーに届く。ここの変更が満たすべき要件 — 4 つの `@Remote` 規律、名前の加算性ルール、このレイヤーが守る境界 — は [Remote と API のルール](defensive-patterns/remote-and-api.md)が所有し、レビューはそこで確認する。
