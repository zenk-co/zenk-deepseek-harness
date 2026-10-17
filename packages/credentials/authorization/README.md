---
description: "設定では供給できない資格情報を取得するユーザーとメンテナーのための認可フローレジストリ。取得には人間との対話が必要になるため。"
kind: "package-reference"
---

# @deepseek-ai/dsh-authorization

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-authorization` を使うと、設定 UI やその他の呼び出し元が、人間が案内するサインイン、コード入力、または質問を通じて資格情報を取得できる。各試行は、通知とプロンプトをそれを開始したサーフェスにのみ送る。新しい資格情報が保存された後にのみ `authorized` を報告し、拒否または撤回は `cancelled` を報告し、その他の失敗はエラーのままである。設定では供給できない資格情報に選ぶ。これには資格情報ストアと、利用可能な認可メソッドを定義するインテグレーションが必要である。本パッケージ自体はプロバイダー固有のメソッドを提供しない。

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

本パッケージは、人間が手渡さなければならない資格情報を製品が取得する部分である。プラグインが自分の資格情報の取得方法を知るフローを登録し、任意のサーフェスが試行を実行して人間に何をすべきかを示せる。一般的な手順は明示的である。プラグインが保持する資格情報ごとにフローを登録し、人間が見ているサーフェスから試行を開始する。

### いつ使うか

資格情報が人間との対話でしか取得できず——OAuth 形式のサインイン、ワンタイムコード、アカウントの選択——設定に保存できない場合はいつでも使う。デプロイが供給できる固定キーの資格情報であれば、代わりに credential seam に保存する。ヘッドレスまたは ACP のコンポジションでも本パッケージは安全にマウントできる。独自のフローを提供しないため、プラグインがフローを登録しない限り人間にサインインを求めるものはない。

### フローの登録

プラグインは保持する資格情報ごとに 1 つのフローを宣言し、フローが書き込む `<scope>/<id>` 資格情報レコードでキー付けする。scope はプラグインを名指し、id はプラグインが所有する 1 つの資格情報を名指す:

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { AuthorizationSession } from '@deepseek-ai/dsh-authorization'
import { credentialKey } from '@deepseek-ai/dsh-credentials'

declare const ctx: Context
declare const exchangeCode: (code: string, signal: AbortSignal) => Promise<{ token: string }>

const key = credentialKey('llm-pi-ai', 'openai-codex') // <scope>/<id> — your plugin / this credential

const dispose = ctx.authorization.registerFlow({
  key,
  label: 'ChatGPT (Codex)',
  methods: [{ id: 'oauth', label: 'Sign in with ChatGPT' }, { id: 'api-key', label: 'Paste a key' }],
  async run(session: AuthorizationSession) {
    session.notify({ message: 'Continue in your browser', url: 'https://auth.example/start' })
    const code = await session.prompt({ kind: 'text', message: 'Paste the code' })
    const { token } = await exchangeCode(code, session.signal)
    await ctx.credentials.modifyRecord(key, () => Promise.resolve({ kind: 'grant', payload: { token } }))
  },
})

ctx.authorization.list()          // every registered flow, with inFlight
ctx.authorization.describe(key)   // the entry above, or undefined
dispose()                         // unregister; withdraws any running attempt
```

フローは、書き込む資格情報レコード、ユーザー向けラベル、および提供するサインインメソッドを優先順に宣言する。`run()` はセッションを通じて人間と対話し——フロー自身では答えられない一方向の通知と質問——解決する前に `ctx.credentials` を通じてレコードをコミットしなければならない。seam はコミットせずに解決したフローを拒否する。`list()` と `describe()` は、何を認可できるか、試行が実行中かどうかをサーフェスに表示させる。`dispose()` はフローを登録解除し、まだ実行中の試行を撤回する。

### 試行の実行

サーフェスは資格情報ごとに同時に 1 つの試行を実行する。インタラクションはレジストリに住むのではなくリクエストとともに移動するため、プロンプトはそれを要求したページに正確に届く。ヘッドレス呼び出し元は辞退するインタラクションを供給する。`begin()` は、試行中にレコードがコミットされ観測された場合に `{ status: 'authorized' }` を報告し、人間が辞退したか呼び出し元が撤回した場合に `{ status: 'cancelled' }` を報告する。`cancel(key)` は 2 回目の呼び出しから実行中の試行を撤回する。これは、1 回目の呼び出しのシグナルを保持せずにキャンセルボタンに応答するリクエスト/レスポンストランスポートのためである。

### 何がうまくいかないことがあるか

- **フローのない資格情報は不活性である** — どのフローも主張しないキーへの `begin()` は `NO_FLOW` を投げる。アンインストールされたプラグインが残したレコードは削除できるが、再認可はできない。
- **資格情報ごとに同時に 1 試行** — 実行中に 2 回目の `begin()` を呼ぶと `ALREADY_IN_FLIGHT` を投げる。エントリの `inFlight` により UI はボタンを事前に無効化できる。
- **コミットせずに解決したフローは拒否される** — `NOT_COMMITTED`。したがって `authorized` は常にレコードが実際に保存されたことを意味する。
- **フローが提供しないメソッドを名指すと `UNKNOWN_METHOD` を投げる** — 何も名指さない場合はフローの最初のメソッドが実行される。
- **「いいえ」は結果であり、故障ではない** — 辞退されたプロンプトは、撤回されたシグナルと同じく試行を `cancelled` として決着させる。その他の失敗は投げられたエラーとして呼び出し元に届く。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションは seam の背後にある設計判断を説明し、それを実現するコードを指し示す。観測可能な挙動は[このパッケージを使う](#use-this-package)で完全にカバーされている。

### 設計方針

- **seam が所有するのは会話であり、プロトコルには決してならない。** 自分の資格情報の取得方法を知るプラグインが、書き込むレコードでキー付けされたフローを登録する。2 つ目の認可プロトコルは別の seam ではなく別のフローとして届き、1 つのフローをレンダリングするサーフェスはすべてのフローをレンダリングする。
- **書き込みを所有するのはフローである。** `run()` の解決は、レコードが `ctx.credentials` を通じてすでにコミットされたことを意味する。seam は試行中に観測したコミットを確認し——存在だけでは再認可が古いレコードを新鮮なものとして通してしまう——コミットなしに解決したフローを拒否する。フロー内でコミットすることにより、独自のストアアダプターで永続化するライブラリが、書き戻されて二重に書かれるのではなく、単一のライターのままでいられる。
- **インタラクションはレジストリではなくリクエストとともに移動する。** 認可を開始した者こそが人間とそれについて対話できる者であるため、プロンプトはそれを要求したサーフェスに正確に届き、ヘッドレス呼び出し元は辞退するインタラクションを供給する。存在しないことにできるアンビエントプロバイダーはなく、開いている 2 つのページのどちらにプロンプトが属するかという問いもない。
- **人間の「いいえ」は結果であり、故障ではない。** 辞退するインタラクションはそのプロンプトを `AuthorizationDeclinedError` で拒否し、試行は撤回されたシグナルとまったく同じく `cancelled` として決着する。その他のプロンプト拒否は呼び出し元に届くフロー失敗のままである。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | Service Definition: フローレジストリ、キーごとに 1 試行のライフサイクル、インタラクションのルーティング、コミットの確認 |
| [`src/types.ts`](src/types.ts) | ワイヤセーフな語彙: メソッド、通知、プロンプト、結果、エントリ |

### ライフサイクル

キーごとに同時に 1 つの試行。`begin()` はキーとメソッドを検証し、ビジーなキーへの 2 回目の試行を拒否し、選択されたメソッド、キャンセルシグナル、リクエストのインタラクションへルーティングされた `notify`/`prompt` コールバックを運ぶ `AuthorizationSession` でフローを実行する。撤回された試行は、フローがそのシグナルに決して反応しなくても即座に決着する。孤立した実行は自力で完了するに任され、それでもコミットに成功したレコードは人間が確かに認可したレコードである。キーは `authorization/settled` が発火する前に解放されるため、次の試行を開始することで反応するリスナーは拒否されない。リスナーの失敗は credential seam の条件の下で封じ込められる。

### インタラクションの語彙

通知は一方向であり、秘密を決して運ばない。メッセージと、任意で人間が開くべきページ、そこで入力すべきコードである。プロンプトはフロー自身では答えられない質問であり——`text`、`secret`、または `select`——`secret` は提示の仕方だけが `text` と異なる。プロンプトは自身のシグナルを運ぶため、入力されたコードとブラウザーのコールバックを競わせるフローは、試行を続けたまま負けた側の質問を撤回できる。リクエストのシグナルは代わりに試行全体を撤回する。この語彙はどの単一プロバイダーのものよりも意図的に小さい。サーフェスがレンダリングしなければならないものを記述するので、1 つのフローをレンダリングするサーフェスはすべてのフローをレンダリングする。

### コミットの確認

試行中、seam はフローのキーの `credentials/record-updated` を監視し、`run()` が解決した後に `describeRecord` を再読する——コミットが今起きたことを確認するためである。再認可ではレコードがすでに存在し、存在だけでは古い資格情報が新たに認可されたものとして通ってしまう。コミットせずに解決したフロー、またはコミットの代わりにレコードを削除したフローは `NOT_COMMITTED` を投げる。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約で足りない場合はこれらのページを読む。共有の資格情報語彙から、フローが書き込むレコードストアと seam の背後の決定証拠へと進む。

- [Credentials サブシステムリファレンス](../../../docs/subsystems/credentials.md) — 2 つのキー空間と、両方の seam の生成された cordis サーフェス。
- [Credentials パッケージマップ](../README.md) — credential-reference、local-store、authorization の各パッケージ。
- [Credential-reference seam](../credentials/README.md) — すべてのフローがコミットするレコードストア。
- [ケイパビリティシーム](../../../docs/capability-seams.md) — この seam が従う Service Definition / Service Provider / Consumer の分担。
- [資格情報レコードと認可フロー](../../../.agents/notes/implemented/architecture/2026-08-13-credential-records-and-authorization-flows.md) — レコードの半分とこの seam の背後の根拠と決定。

-----

<a id="model-experience"></a>
## モデル体験

なし。認可は構成時の人間との会話であり、フロー、通知、プロンプトのいずれもモデルリクエストに届かない。

#### KV キャッシュへの影響

無効化なし。認可の状態がリクエストプレフィックスに入ることはない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

これらの制限は、このパッケージが不向きになる、または特別な注意を要する状況を定義する。タスクバックログではなく、現在のパッケージの制約である。

- **どのフローも再開できない** — 試行はそれを開始したプロセスに住むため、ログイン中のブラウザーリロードは試行を放棄させ、人間は最初からやり直す。耐久的な試行にはこの seam が持たないストアが必要である。
- **何も失効させない** — サインアウトは `ctx.credentials.deleteRecord(key)` であり、発行者に伝えることなくローカルレコードを忘れる。サーバー側の失効が必要なプロバイダーにはそれを宣言する場所がない。
- **フローのないキーは不活性である** — seam は登録されているものを報告するので、アンインストールされたプラグインが残したレコードは削除できるが再認可はできない。その孤児を認識するのは呼び出し元の仕事であり、`listRecords()` と同じである。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発者ノートはメンテナー向けの作業コンテキストであり、未解決の問いと未決定の方向性を示す。明示的に非権威である。出荷済みの挙動、制限、受け入れ済みの根拠は、上記のセクション、パッケージのコード、およびリンクされた Agent Note にある。

上記の制限は未解決の方向性——再開可能な試行、サーバー側の失効、孤児レコードの発見——を名指ししており、いずれも着地の前に独自の設計とストアを必要とする。

</details>

フローはキャンセル後の書き込みを拒否するために session.commit(record) を使える。commit が受理されると、cancel() は永続化とフローの決着が完了するまでそれを実行したままにする。独自の資格情報アダプターを通じて書き込むフローは、自らのキャンセル順序に引き続き責任を負う。
