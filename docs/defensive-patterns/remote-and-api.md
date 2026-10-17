# Remote と API のルール

日本語 | [English](remote-and-api.en.md) | [中文](remote-and-api.zh.md)

`packages/api` レイヤーとそれが公開する remote メソッドに関するルール。[api-gateway.md](../api-gateway.md) は呼び出しモデル自体を説明する。以下の各節では、要件、レビュー担当者がそれをどう判定するか、何を対象外とするか、どの例外が適用され誰が承認するか、そして正しい例と誤った例を示す。

## 新しい remote ケイパビリティには専用のサービスを持たせる

新しい remote ビジネスケイパビリティは新しいサービス — 独自のパッケージまたは独自のオブジェクト — であり、`@Remote` はそのサービスの具象メソッドをマークする。既存の大きなサービスにメソッドを 1 つずつ追加していくと、1 つのオブジェクトが認証、Session、ワークスペース、イベント伝送を同時に担うことになり、ドメインごとのアクティベーションポリシーと履歴ページネーションが混在し、以後 1 つのケイパビリティへの変更がそのすべてに触れることになる。分割は呼び出し元の数ではなくビジネス境界で行う。今日呼び出し元が 1 つしかないケイパビリティにも専用のサービスを持たせ、オーナーが変わるエンドポイントは、離れるオブジェクトに加わるのではなく新しいオーナーへ移動する。

- 判定基準: 新しい remote メソッドをどのオブジェクトが保持するか。すでに別のラインを担うサービスに新しいビジネスラインのメソッドを追加するのが欠陥であり、修正は新しいケイパビリティにちなんで命名したサービスを作り、その具象メソッドに `@Remote` を付けること。移行も同じ基準で判定する。移動したメソッドは、`packages/subagent/subagent` の `SubagentRuntime` のように新しいオーナーに現れ、離れたオブジェクトには現れない。
- 対象外: すべてのメソッドが 1 つのビジネス境界に奉仕するサービスはそのまま維持され、そのケイパビリティの新しいプライベートヘルパーはそこに属する。独自のプロトコルを必要とするデータも、新しいサービスの Remote メソッドにはならない。session イベントストリーム、ページネーション、インクリメンタル reduce、プロジェクション、エンティティサブストリームはそれぞれ別の登録モデルを維持する（[gateway boundaries](../api-gateway.md#boundaries)）。
- 例外: 記録なし。呼び出し元が 1 つであることは統合の理由にならない。ビジネス境界自体が争われている場合は、変更が着地する前にドメインオーナーがアーキテクチャの問いとして決着させる。
- 修正: ケイパビリティ専用のサービスオブジェクトまたはパッケージを作成し、その具象メソッドに `@Remote` を付け、呼び出し元が `ctx.remote.<namespace>` を通じて到達できるようにする。

subagent ケイパビリティは専用のサービスを所有し、すべての remote メソッドはそのサービスの具象メソッドである:

```ts ignore-check
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

interface SubagentList { ids: string[] }
interface PromptRequest { text: string }
interface PromptResult { accepted: boolean }

class SubagentRuntime extends TypertRemoteService {
  @Remote list(): SubagentList { return { ids: [] } }
  @Remote prompt(request: PromptRequest): PromptResult {
    return { accepted: request.text !== '' }
  }
  @Remote interruptByParent(id: string): void { }
}
```

誤ったバージョンは、すでに他のドメインを担うオブジェクトに同じケイパビリティを追加する:

```text
class ApiProxy {
  @Remote goalList(): GoalList            // goal domain
  @Remote subagentPrompt(request): ...    // subagent domain
}
```

すると 1 つのオブジェクトが両方のドメインを担うことになり、どちらのケイパビリティのアクティベーションポリシー、ページネーション、イベント処理への変更も同じ場所に着地し、どちらのケイパビリティも他方なしには移動できない。

## `@Remote` はケイパビリティのメソッドをマークする

`@Remote` には、レビュー担当者が個別に確認する 5 つの規律がある。すなわち、ケイパビリティを実行する具象メソッドをマークすること。クライアント向けの型は手書きのコピーではなく既存の定義からジェネレーターを通じて得ること。ペイロードは JSON であり、remote メソッドは出力側のデコードを行わないこと。既存のメソッド名とフィールド名に対して追加的であること。そしてメソッドは触れるすべてのリソースを名指しし、呼び出し元は呼び出しからのみ読むこと。各規律はそれぞれ異なる失敗を取り除く。ラッパーはどの操作が公開されているかを隠し、2 つ目の手書き型セットは生成されたものからずれ、出力側のデコードは Gateway がすでに実行するコーデックの隣に 2 つ目の結果経路を追加し、リネームは同じ変更内のすべての呼び出し元を壊し、名前のないリソース、フィルタリングされない集約、引数で渡された呼び出し元は、どのバインディングも与えないものに非オーナーが到達できるようにする。

- **ケイパビリティメソッド。** アノテーションは操作を実行する具象メソッド（`list`、`prompt`、`interruptByParent`）に付き、実際の実装へ転送するラッパーには決して付かない。判定はデコレートされたメソッドの本体で行う。本体が委譲するだけなら、アノテーションは間違ったメソッドに付いている。
- **推論からの型。** クライアント向けの型は、2 度目に書くのではなく、ジェネレーターが生成するものからエイリアスする — `type SessionRemote = TypertClientRemote['session']`。判定は、生成された Client 型のフィールドを繰り返す手書きの宣言で行う。[typert.md](../subsystems/typert.md) が生成されたマップとその宣言マージを所有する。
- **ワイヤー上は JSON、出力側のデコードなし。** Remote メソッドの **ワイヤーペイロード** は JSON であり、バイナリ内容はフィールドレベルで表現する。Host シグネチャは Gateway がすでにサポートするものを維持する — Host オブジェクトに解決されたルックアップ引数、末尾の `AbortSignal`、`@Remote({ mode: 'stream' })` で宣言されたストリーム — そして `@Remote` は出口でデコードを行わない。生成されたコーデックと Gateway が結果を検証する。判定は、デコレーターを持つメソッドのペイロード中のデコード、ストリーム再構築、非 JSON 値全体で行う。[programming model](../api-gateway.md#programming-model) が Remote メソッドを通過できるものを所有する。
- **既存の名前は追加的。** 移行で Client がすでに呼び出している remote メソッドやフィールドをリネームしない。新しい意味には新しいエントリを与え、リネームは独自のレビューを伴う独立した変更とする。判定は、`ctx.remote.<namespace>` を通じてすでに公開されている名前をリネームまたは削除する差分で行う。
- **呼び出し元の識別とアクセス。** すべての Remote メソッドはアクセス制御下にある。`@Remote({ resources })` / `@RemoteScope(key, { resources })` のリーダーと自動解決は、メソッドが触れるすべてのリソースを名指ししなければならない。アクセス制御は省略されたリソースを決してチェックしないためである。また、複数のリソースを返すメソッドは各項目を `this.ctx.remoteAccess.allows(resource)` でフィルタリングする。呼び出し元は `this.ctx.invocation.peer.principal` からのみ読み、決して引数からは読まない。ユーザーメッセージソースを構築する Remote メソッドは、`principalOf(this.ctx.invocation)` を通じてそれを記録し、principal を関数引数として渡すのではなく構築したソースを渡し下ろす。すべての呼び出し経路は Peer を明示的に名指しする。判定は、解決されたリソースが触れるものの 1 つを省略しているメソッド、フィルタリングされない集約、ワイヤーデータから読まれた、またはヘルパーパラメータを通された principal、`principalOf` なしで Remote メソッド内に構築されたユーザーメッセージソースで行う。[Peer principals Agent Note](../../.agents/notes/implemented/architecture/2026-10-12-peer-principal-and-remote-access.md) が設計を所有する。
- **対象外。** デコレーターのないメソッドは、インプロセス呼び出し元を持つ通常のサービメソッドのままである。5 つの規律は何が Remote メソッドになるかを規定し、サービスが何を実装してよいかは規定しない。
- **例外。** リネームや新しいデコード経路は、その利点と既存の呼び出し元への影響を先に述べ、ドメインオーナーの確認を必要とする。著者が自己承認することはない。

生成されたマップがクライアント向け型の唯一のソースであり、デコレーターは具象メソッドに付き、ペイロードは JSON のままである:

```ts ignore-check
import { Remote, TypertRemoteService, type TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'

// Client-facing types come from the generated map, never from a second hand-written set.
type SessionRemote = TypertClientRemote['session']

class SessionController extends TypertRemoteService {
  @Remote('search')
  search(query: string): SessionSearchValue {
    return this.runSearch(query)
  }
}
```

手書きの第 2 の型セット、出荷済みの名前のリネーム、出力側のデコードはそれぞれ異なる規律を破る:

```text
type SessionRemote = { list(): ...; rename(id: string): ... }   // hand-written copy
@Remote('renameSession') rename(...)                            // shipped name changed
@Remote decode(payload: Uint8Array): Result                     // output-side decode
```

手書きのコピーはビルドを失敗させずに生成された型からずれ、リネームは既存のすべての Client 呼び出しを一度に壊し、デコードは生成されたコーデックを 2 つ目の未チェックの結果経路に置き換える。

## `packages/api` が担うのは汎用オーケストレーションのみ

`packages/api` 配下のパッケージ — コントローラー、`gateway`、`remotes` — は、トランスポート、呼び出し形式、Session ライフサイクル、その他の汎用オーケストレーションを担う。ビジネス分岐がそこに集まることはない。具体的なビジネス状態に依存する判断、1 つのフィーチャーに結び付いた処理、フィーチャーごとのフィルターは、独自のパッケージまたはモジュールに属し、プロジェクテッドデータとして、または登録サーフェスを通じてこのレイヤーに届く。基準はロジックがどこに属するかであり、ファイルがどこにあるかではない。したがって、1 つのフィーチャーにしか意味を持たない分岐は、それを保持するファイルが汎用的であっても欠陥である。

- 判定基準: 分岐がその条件をどこから読むか。`packages/api` 内でのフィーチャー状態に対する `if` や `switch`、フィーチャーごとのフィルター、1 つのフィーチャーにちなんで命名されたヘルパーは欠陥である。所有パッケージで下され、ここではプロジェクテッドデータまたは登録済みエントリとして消費される同じ判断は欠陥ではない。パッケージの内訳が影響を示す。`packages/api` は 9 つのパッケージ — `account-controller`、`gateway`、`job-controller`、`remotes`、`session-controller`、`settings-controller`、`terminal-controller`、`workspace-controller`、`workspace-files` — を保持し、`session-controller` が 34 個の `src` ファイルで最大である（terminal-controller 12、gateway 11、workspace-controller 10、workspace-files 8、job-controller 8、remotes 4、settings-controller 3、account-controller 2）。
- 対象外: 汎用の Session ライフサイクル、トランスポート、ストレージ抽象化は残る — `gateway` のディスパッチ、`remotes` の選択、共有の session リストとカタログ読み取りはインフラストラクチャであり、ビジネスロジックではない。[Business ownership](../api-gateway.md#business-ownership) は Gateway 側から同じ分割を述べている。
- 例外: 既定ではなし。ここにビジネス分岐を追加するには独立パッケージレビューが必要で、そのレビューはなぜロジックがフィーチャーを所有するパッケージに置けないかに答える。
- 修正: 判断を所有パッケージへ移し、その結果をプロジェクテッドデータとして公開するか、このレイヤーがすでに注入しているレジストリに登録し、それを読むオーケストレーションだけを残す。

所有パッケージがそのユニットを決定して登録し、コントローラーはプロジェクテッド値だけを読む:

```ts ignore-check
// packages/workspace/<feature>/src/index.ts: the rule lives with the feature it serves.
ctx.sessionProjections.register({
  key: 'durablePage',
  stateSchema: durablePageState,
  init: () => ({ durable: false }),
  apply: applyDurablePage,
  stateVersion: 1,
})

// packages/api/session-controller: generic orchestration reads the projected value.
const { durable } = ctx.sessionProjections.stateOf(session, 'durablePage')
```

誤ったバージョンは共有レイヤーの中でルールを決定する:

```text
// packages/api/session-controller: a feature branch inside the shared layer
if (session.page.transport === 'durable') { /* durable-transport handling */ }
```

するとルールに 2 つ目の拠り所ができ、以後の変更は両方を見つけなければならず、共有レイヤーは 1 つのフィーチャーの意味論を担い続ける。
