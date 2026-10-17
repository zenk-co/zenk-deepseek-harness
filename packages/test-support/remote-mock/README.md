---
description: "Typert Remote トラフィックのエンドポイント名付きモック: 単項回答とストリームスクリプトの表、ライブストリーム制御、ログ、および Connection キャリアフェイス。Host なしで実ブラウザークライアントを起動するテスト作成者向け。"
kind: "package-library"
---

# @deepseek-ai/dsh-remote-mock

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-remote-mock` は、ネイティブ Vitest モックメソッドを使ってテストが `mock.remote.<namespace>.<method>` を通じて Host 応答を構成できるようにする。同じ関数群が直接呼び出しと実際の Connection トラフィックに応答する。再利用可能な表がデフォルト応答を供給し、明示的に宣言されたストリームがテスト駆動のフレームとキャンセルをサポートする。欠落した応答は呼び出しを失敗させ、teardown で `assertNoUnmatched()` によって再び報告される。このパッケージは Node またはブラウザーページでビジネス Host なしで実行され、DOM、React、Node モジュールをインポートせず、`devDependencies` からのみ消費される。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

### いつ使うか

spec が `ctx.remote` と対話する実際のクライアントプラグインを起動し、Host 側をエンドポイント名でスクリプト化したいときにこれを使う: クライアント全体の spec は `mock.rpc` を自身の Connection インスタンスに束縛し、ユニット spec は `mock.remote`、`dispatch`、`open` を直接呼んでよい。エンドポイントは Gateway のワイヤ名 (`session/page`、`settings/describe`) である。`args` は呼び出し側の位置引数リストで、末尾の `AbortSignal` が除去されたものである。値はテストが登録したものは何でもよく、そのまま応答される。唯一の宣言はエンドポイントが単項 (`unary`) かストリーム (`stream`) かである。

<a id="remote-proxy"></a>
### リモートプロキシを使う

`mock.remote` はメソッドリストやドメイン固有ヘルパーなしで、すべての名前空間とメソッドを公開する。アクセスされた各エンドポイントはキャッシュされたネイティブ Vitest モックを使用する。`@vitest/spy.fn` は `vi.fn` の背後にある実装であり、Vitest ランナーなしのブラウザーページでも動作する。同じモックが直接呼び出しと Connection トラフィックに応答するので、戻り値の上書きと呼び出しアサーションは、クライアントが実際に呼び出す関数を観察する:

```text
const mock = RemoteMock.create().load(remoteDefaultResponses)
mock.remote.settings.describe.mockResolvedValue(ok({
  writable: true, hasDocument: false, namespaces: [],
}))
mock.remote.settings.mutate.mockResolvedValueOnce(ok(updatedNamespace))
// After the client writes:
expect(mock.remote.settings.mutate).toHaveBeenCalledWith('locale', operations, revision)
```

永続的な応答には `mockResolvedValue`、キューされた応答には `mockResolvedValueOnce` または `mockReturnValueOnce`、引数依存の動作には `mockImplementation` を使う。ネイティブのキューされた応答は登録順に実行され、その後モックの現在の実装が応答する。その初期実装は登録されたデフォルトを読む。`mockClear()` は応答とキューを保持する。`mockReset()` は上書きをクリアし、最新のデフォルトを読むその初期実装を復元する。デフォルトが欠落している場合、キューされた応答を使い果たした後も依然として失敗する。直接呼び出しも含み、同期的に throw することがある。

明示的な `stream()` または表のストリーム宣言のみがストリームメソッドを選択する。それ以外はすべて単項モックを使用する。メソッドへのアクセスが成功するビジネス結果を捏造することはない。メソッド参照を保持する前にストリームモードを宣言する: 各エンドポイント/モードは自身のモックを所有する。名前空間とメソッドの `then` プローブおよびシンボル読み取りは不活性である。

`MockedRemote` は生成された `TypertRemoteNamespaceMap` 全体に対して Vitest の deep mock 変換を使用する。空でないマップはその名前空間とメソッド名、パラメーター、結果、ネイティブ spy 型を保持する。空のマップはこのテストプロキシのみを `any` にし、任意の名前空間とメソッドを許可する。本番の Remote 宣言を拡張または弱体化することはない。コピーしたメソッドシグネチャ、オプションの生成モジュール抑制、コンパイラー全体のフラグは不要である。Remote/mock の変更を引き渡す前に、`pnpm run typecheck` を実行して実際の Client 型を生成・チェックする。欠落、stale、部分的な宣言はまず再ビルドが必要である。未ビルドのテスト成功や `any` 推論は strict な型証拠ではない。

### デフォルト応答を登録する

`load(table)` は再利用可能な `unary` 値またはハンドラー、`stream` スクリプト、スクリプトなしの `streams` 宣言をインストールする。`unary(endpoint, value)` と `unary(endpoint, fn)` は個別のデフォルトを登録する。ハンドラーは呼び出し側の位置引数を受け取り、既存のリクエスト型を使用する。各エンドポイントは最新のデフォルトのみを保持し、明示的な `undefined` も含む。デフォルトの更新はネイティブの上書きを破棄しない。`ok(value)` は `{ ok: true, value }` を構築する。失敗は `{ ok: false, error: { code, message, details } }` を使う。状態を持つハンドラー、promise、ネイティブキューはテストごとにローカルに保つ:

```text
const initial = { writable: true, hasDocument: false, namespaces: [] }
const mock = RemoteMock.create().load({
  unary: { 'settings/describe': ok(initial) },
})
mock.remote.settings.describe.mockResolvedValueOnce(ok({ ...initial, hasDocument: true }))
```

### ストリームを駆動する

ストリームスクリプトは開かれた `args` と `StreamHandle` (`push`、`end`、`fail(error)`、`signal`) の関数である。ストリームはスクリプトが戻った後も、ハンドルがそれを終了または失敗させるまで開いたままである。`frames(items)` は項目を yield して終了するスクリプトを構築し、`openStream(initial)` はそれらを yield して開いたままにする。`mock.streams` はクライアントが現在開いているストリームを、それが開かれた args でフィルターして制御する。`opened(endpoint, count)` はエンドポイントがその回数開かれると解決し、`drained(endpoint)` は一致するすべてのストリームのコンシューマーがこれまで push されたすべてを取り出したときに解決する。開いたストリームのコンシューマーはさらなる項目を待っており、確定したストリームのキューは空である (キューから取り出した時点。それが処理済みと等しいのは、読み取りループ内で項目を処理するコンシューマーについてのみである):

```text
mock.stream('session/follow', openStream([snapshotFrame]))
await mock.streams.opened('session/follow', 1)
mock.streams.push('session/follow', eventFrame, ([request]) => (request as { sessionId: string }).sessionId === SID)
mock.streams.fail('session/follow', new Error('gone'))
await mock.streams.drained('session/follow')
```

失敗したストリームはコンシューマーの次の読み取りを指定された `Error` で拒否する。コンシューマーのキャンセル (開始シグナルまたは早期のイテレーター `return()`) は `StreamHandle.signal` を abort し、throw せずにイテレーションを終了し、ストリームを `cancelled` としてログする。`StreamHandle.uplink` はスクリプトが Client の uplink として読むものである: `rpc.open` を通じた場合はキャリアのイテラブルであり、直接の `mock.remote.<namespace>.<method>(...)` 呼び出しでは戻り値のハンドル — 生成されたメソッドが返す `RemoteStreamHandle` — がそれを供給する (ダウンリンクにはそれをイテレートし、`send()` と `end()` が uplink を供給し、`dispose()` がストリームをキャンセルする)。`send()` は実ハンドルと同様に非 lossless な JSON 項目を拒否し、それが所有する uplink はストリームが確定するか、キャンセルされるか、コンシューマーが離れると閉じるので、その後の `send()` は throw する。モック関数はメソッド自身の引数のみで呼ばれるので、uplink が呼び出しアサーションやログの引数に現れることは決してない。

生成されたストリームメソッドの代役を務めるフェイクは、生成されたメソッドが返すものと同じ `RemoteStreamHandle` を返す。`streamHandle(source)` は `AsyncIterable` を不活性な `send`、`end`、`dispose` を持つそのハンドルとして型付けする。`streamMethod<M>(generator)` はメソッドの引数用に書かれた async ジェネレーター関数をメソッド自身のシグネチャに持ち上げ、`vi.fn<M>()` と `mockImplementation` 用にする。

### クライアントを接続する

`mock.rpc` は `ClientConnectionRpc` フェイスである。Connection インストーラーに `{ transport: { rpc: mock.rpc } }` として渡すか、`TestClient` にそのインスタンスへ束縛させる。そうすればすべての Remote 呼び出しが `dispatch` に到達し、すべてのストリームが間にエンベロープなしで `open` に到達する。ペイロードはクライアント全体のプロキシが送るとおりに (配列として) `{ args }` を運ぶか、Gateway 自身のエンドポイントが送るとおりに (1 つのオブジェクト、1 つの位置引数として届けられる) 運ぶ。シグナルが abort する呼び出しは abort 理由で拒否する。`RemoteMock.create()` は 1 つのストリーム `$events` を登録し、それが Gateway クライアントのオープンに `{ type: 'ready', clientId, host: { home } }` で応答し (`host` は `RemoteMockOptions.host` から、デフォルトは `/home/mock`)、開いたままになる。これがアセンブルされたクライアントを `connected` に到達させる。spec は他のストリームと同様にそれを上書きまたは失敗させることができる。

### 観察とアサート

`mock.log.calls(endpoint?)` は `dispatch` または `rpc.call` を通じた単項呼び出しをリストする (`args`、`seq`、`pending` / `answered` / `failed` のライブ `state`、および `result` としての回答または throw されたエラー)。`streams(endpoint?)` はスクリプト化されたオープンをそのライブ `state` と `pushed` カウントとともにリストする。`requests(endpoint?)` は呼び出しとオープンの最初の位置引数を順にリストする (エンドポイントなしでは、Gateway 自身の `$` 前置きエンドポイントを除く)。`unmatched()` はルールが見つからなかったリクエストをリストする。ネイティブの `.mock.calls` はさらに直接プロキシ呼び出しを含み、キャリアストリームモックは最終的なキャンセルシグナルを受け取る。`assertNoUnmatched()` は teardown でミスを報告する。`modeOf(endpoint)` は明示的な登録を報告する。`endpoints()` はアクセスされたプロキシメソッドも含むので、アセンブリがその名前空間を提供できる。

### 起こりうる問題

- **リクエストにルールがない** — `dispatch` は拒否し、`open` は `remote-mock: no rule for <endpoint>; registered: …` を throw し、ログがミスを記録する。エンドポイントを登録する。
- **ペイロードが `{ args: unknown[] | object }` でない** — `rpc.call` は拒否し、`rpc.open` は `TypeError` を throw する。クライアント全体のプロキシは配列形式を、Gateway 自身のエンドポイントはオブジェクト形式を送るので、手書きの呼び出しに責任がある。
- **1 つのストリームへの 2 つ目の並行読み取り** — 読み取りは拒否される。Gateway はストリームを順次読むので、これはテスト側の誤用を名指しする。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

### 設計

`dispatch` と `open` はエンドポイントと位置引数を取る。`rpc` は Connection のデコード済みキャリアインターフェースを通して同じコアを公開する。各モックは自身のネイティブ関数とキューされた上書きを所有する。共有表はハンドラーや回答オブジェクトをコピーせずにデフォルトを供給する。各スクリプト化ストリームは自身のキュー、単一の保留中読み取り、およびそのログエントリーを所有し、`end`、`fail`、またはコンシューマーキャンセルの最初のものがそれを確定する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | 公開フェイスの再エクスポート |
| [`src/remote-mock.ts`](src/remote-mock.ts) | `RemoteMock`: デフォルト応答、ネイティブモック、Connection ディスパッチ、制御されたストリームと欠落応答チェック。`ok` |
| [`src/remote-proxy.ts`](src/remote-proxy.ts) | 名前空間/メソッドルックアップと生成マップのモック型 |
| [`src/streams.ts`](src/streams.ts) | `frames` / `openStream` スクリプト、`streamHandle` / `streamMethod` フェイク型付け、および `MockStream` (ハンドル + `AsyncIterable`) |
| [`src/log.ts`](src/log.ts) | 共有 `seq` カウンター付きのログストア |

</details>

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはブラウザー側のテストインフラストラクチャであり、ここにあるものはモデルリクエストに到達しない。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立ても送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **インプロセスキャリアのみ** — `rpc` は同じレルムの Connection インスタンスにサービスする。ブラウザーレーンの spec 用の HTTP または WebSocket キャリアは提供されない。
- **値は参照で渡る** — 回答とダウンリンク項目はシリアライズされずにクライアントに到達するので、実際のワイヤなら拒否する非 JSON のダウンリンク値がそのまま通過する。実 uplink チェックを適用するのはハンドルの `send()` のみである。
- **値はチェックされない** — 単項回答は呼び出し側が読む結果 (`{ ok, value }` または `{ ok: false, error }`) でなければならない。モックはそれをそのまま通過させ、それらのフィールドをチェックしない。
- **ペイロードマッチングなし** — ルールはエンドポイントのみでマッチする。ハンドラー内でビジネス引数によって判別する。
- **ネイティブストリーム上書きは自身のイテラブルを所有する** — 自身のイテラブルを返す上書きはスクリプト化ストリームのログ、`requests`、`opened`、`drained`、および `push` / `end` / `fail` をバイパスする。キャンセルも呼び出し側が所有する。ネイティブ呼び出しアサーションは依然として機能する。シナリオがそれらの制御を必要とする場合は登録済みストリームスクリプトを使う。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
