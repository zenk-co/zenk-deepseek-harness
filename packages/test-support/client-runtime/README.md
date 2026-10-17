---
description: "ブラウザー機能スペック向けの jsdom スロットテストランタイム。スロット、ストア、レンダリングをプロダクション機構に対して試すテスト作成者向け。"
kind: "package-library"
---

# @deepseek-ai/dsh-client-test-runtime

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`SlotTestRuntime.create()` により、Vitest スイートは jsdom 内でプロダクションのスロット、ストア、型付きセッションおよびワークスペースフィクスチャ、ローカル DOM アサーションを駆動できる。プラグインのアクティベーション、リロード、再接続、クリーンアップのテストには、`createClientTest` がビジネス Host なしで、エンドポイント名付き Remote モックとともに Web プロファイルのバンドルロースターを起動する。欠如したサービスとスタブ化されていない呼び出しは明示的に失敗する。クライアント全体フィクスチャが起動と破棄を所有し、ローカルランタイムは冪等な破棄を提供する。このパッケージはクライアントテスト用に `devDependencies` を通じて使用する。製品プラグインではない。

リンクされたバンドルは依存関係を実際のパッケージディレクトリから解決する。任意のバンドルの隣にある依存関係は、祖先ディレクトリから継承されたパッケージより優先される。

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

このパッケージは、ブラウザー機能スペックにマウント対象の実ランタイムを与える。ベンチを作成し、機能が占めるスロットを宣言し、機能プラグインをマウントし、スロットを描画し、ローカルビューをアサートし、破棄する。プロダクションロジックの第 2 の実装は存在しない。

### 機能スペックのセットアップ

`SlotTestRuntime.create()` がランタイムを組み立て、`declare(children)` がキーごとの `<div data-slot>` ラッパーがスナップショットルートになる自動フレームを登録し、`mount(plugin)` が機能を実ファイバー上で実行し、`renderSlot(key, owner, opts?)` がスコープ付きクエリとインプレース更新を備えたスロットローカルビューを返す:

```text
const runtime = await SlotTestRuntime.create()
await runtime.declare({ 'feature-slot': {} })
const handle = await runtime.mount(FeaturePlugin)
const view = runtime.renderSlot('feature-slot', { owner: props })
expect(view.container).toMatchSnapshot()
await runtime.dispose()
```

`mount` は要求されるサービスを事前確認し、欠如していれば大きく失敗する。`provide(name, value)` が先に追加のサービスを提供する。ランタイムは `fileUpload` スタブを提供し、スイートが `runtime.fileUpload.upload` を置き換えるまで、すべての呼び出しを拒否する。`storeOf(key, scopeKey)` は、レンダラーがスロットのコンポーネントに渡すライブストアインスタンスを返し、identity とアクション駆動書き込みのアサーションに使用できる。

ランタイムは ui-session の前に `allowAllAccessPlugin` をインストールする。その `remoteAccess` サービスはすべてのリソースに対して true を返すため、すべてのアクセス Hook がすべてのアクションを許可する。手組みのコンポーネントプロップは `...allowAllAccess` を展開して同じ Hook を受け取る。拒否パスのスペックは 1 つの Hook を上書きする。

オプションのレンダーオプションは `entryKey` でキー付きエントリーを、`only` でリスト項目を選択する。`view.update(owner)` はその選択を保持する。`runtime.panelInfo` は、グローバルパネルが選択されていない既定の `usePanelInfo` ソースを提供する。プロダクションの Layout オーナーをマウントする前に `releasePanelInfoSource()` でそれを解放する。`dispose()` は既定のワークスペースとパネル情報の両方のルートソースを解放する。早期解放は冪等であり、置き換えられたオーナーを削除しない。

セッションフィクスチャは、セッション世代を保持することなく、明示的に供給されたアドレスまたは読み込まれた親プロジェクションからサブエージェントアドレスを解決する。外部カタログエントリーはローカル閲覧アドレスを持たない。

### ローカル DOM スナップショット

登録されたスナップショットシリアライザーは CSS モジュールのクラスハッシュ（`_frame_a1b2c3` → `frame`）を折りたたんで `.snap` ファイルを構造的に保ち、`<svg>` の内部を `data-content` フィンガープリントに縮約する。カスタムページフレームを必要とするスイートは自動フレームの代わりに `root.declare(children, Frame)` を使用する。`dispose()` はビュー、機能ファイバー、生成されたスコープ、永続化されたストア状態を 1 つの軸で破棄し、冪等である。

### Remote の応答と失敗のスクリプト化

`TestRemote` は `ctx.remote` 面のダブルである。それ自身と、スクリプト化された名前空間ごとに 1 つのサービスを登録するため、`remote.<name>` を注入するプラグインがアンパークされる。明示的なテストイベントドライバーから `$on` 購読を駆動し、`$host` を、スペックがホーム付きまたは非ループバック Host をスクリプト化するために代入できるプレーンで可変のフィールドとして公開する。このパッケージは、UI スペックが `RemoteError` コンストラクターを値として取る場所でもある。`dsh-api-remotes` ファサードはそれを運べない。スペックからの値インポートがそのアセンブリの未ビルドの `/remote` 成果物チェーンを引き込むためである。

Host が返すであろうコードで失敗をスクリプト化し、プロダクションコードが判別するのと同じ方法（`code` で、クラスでは決してない）でアサートする:

```text
import { RemoteError } from '@deepseek-ai/dsh-client-test-runtime'

remote.goals.create.mockResolvedValue({
  ok: false,
  error: new RemoteError('goal/not-found', 'goal "g1" does not exist', { goalId: 'g1' }),
})
expect(view.getByRole('alert')).toHaveTextContent('goal/not-found')
```

### クライアント全体ティア

上記のスロットティアは、1 つの機能をダブルに対してマウントする。クライアント全体ティアは実アセンブリを起動する。`TestClient.start(plan, mock, options)` はロースターの各行の `/client` モジュールをインプロセスでインポートし（またはプランの `provide` 置換を取る）、`{ rpc: mock.rpc }` をそのクライアントの Connection モジュールにバインドし、`graphFromRoster` で起動グラフを合成し、読み込まれたモジュールをプロダクションのモジュールシステムに渡し、プロダクションの `bootClient` を通じて起動し、オプションで `uiRenderer` をマウントし、`ctx.connection.state === 'connected'` を待つ。スロットティアのスペックが決してそれを読み込まないように、深いインポートの背後にある:

```text
// @vitest-environment jsdom
import { createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import { ok } from '@deepseek-ai/dsh-remote-mock'

const test = createClientTest({ roster: webApp }, { mount: true })
test('registers into the sidebar', async ({ remote, start }) => {
  remote.settings.describe.mockResolvedValue(ok({ writable: true, hasDocument: false, namespaces: [] }))
  const client = await start()
  expect(client.ctx.slots.entries('sidebar.settings')).toHaveLength(1)
})
```

`createClientTest` はネイティブの Vitest フィクスチャを使用する。各テストは `remoteDefaultResponses` を読み込んだ新しい `mock`、`mock.remote` と等しい `remote` プロキシ、およびテストが応答を構成した後にのみ起動する `start()` を受け取る。繰り返しの起動は 1 つの promise を共有する。それを await して起動エラーを観察する。フィクスチャの破棄は起動を待ち、失敗したアサーションの後でもクライアントを破棄し、欠如した応答をチェックし、テスト後の保存された `start` を拒否する。独立に所有されるクライアントには `TestClient.start` を直接使用する。これらのフィクスチャは自身の状態を分離し、`location` のようなページグローバルは分離しない。

[汎用 Remote プロキシ](../remote-mock/README.md#remote-proxy)は両ティアのすべての名前空間をサポートする。アセンブル済みテストは `remote` フィクスチャを使用し、ローカルの `TestRemote` は `{ settings: mock.remote.settings }` を受け取れる。返されるデータを構成し、ネイティブの `.mock.calls` を直接読み取る。変更応答が以降の describe 応答を自動的に更新することはない。シナリオが新しいデータを公開するときは `remote.settings.describe.mockResolvedValue(...)` を明示的に変更する。未ビルドの型付けと、必要なビルド裏付けのローカル型チェックはプロキシのドキュメントが所有する。

### ロースターと起動時の振る舞い

`webApp` は `web` プロファイルのブラウザーロースターであり、ランチャーがそれらを構成するときに、アセンブリエントリーが初めてそのバンドル（`dsh-base`、次に `dsh-web-app`）からインポートされたときに読み取られる。ただし、何にも一致しないパッチは、ランチャーが警告するところでここではスローする。各バンドルの `dsh.bundle.patch` リストはインクルードプラグインの YAML 方言で解析され、その `applyEntryPatches` によって構成される。有効で、そのパッケージが `dsh.client.platform === 'web'` を宣言するすべての行は、その宣言の `inject` と `immediately` を運ぶ行になる。`bundleRoster(bundles, anchor, disabledContext)` は条件付き `disabled` フラグのために明示的な Loader 評価スコープを受け入れる。それがなければ、ブラウザー式は拒否される。`webApp` は Web プロファイル名を提供し、ビジネス Host サービスは提供しない。バンドルから何もコピーされないため、バンドルの変更は次のテスト実行で見える。`webApp.closure(names)` は指定された行と、それらが推移的に注入するすべて（バンドルがそれらプラグインを構成するときにスペックがそれらを起動するのに必要な行）を保ち、`webApp.pick(names)` と `webApp.without(names)` は手作業でそれを削り、3 つすべてが未知の名前でスローし、`ClientRoster.of(rows)` はインラインで 1 つを組み立てる。`remoteDefaultResponses` は、セッションなし、ワークスペースなし、既定設定で起動する間にロースターが呼ぶ Remote エンドポイントちょうどの既定応答を保持する。スペックは `mock.load(table)` で自身の `RemoteTable` を上に重ね、ルールのない呼び出しは `dispose()` で `mock.assertNoUnmatched()` を通じてテストを失敗させる。`mount` は `uiRenderer` を提供するロースターを要求し、`start` はそうでなければ空のコンテナを返す代わりに大きく失敗する。`client.connection` はロースターの Connection サービスであり（`Context` 拡張がそれを宣言しない）、`connectTimeoutMs` は準備完了待ちを制限し、その失敗メッセージはモックログを列挙する。`reload(name)` は共有 Client Modules ヘルパーを通じて 1 つの Loader エントリーを再構築する（レジストリ優先の破棄、次に `entry.refresh()`）。各クライアントは自身のモジュールシステムとインスタンスバインドの Connection 置換を保つため、起動とリロードはページグローバルを変えることなく重なってよい。`unload(name)` はエントリーを削除し、プラグインのクリーンアップを待つ。`flush()` は `act` 内で React を決着させる。jsdom は `EventSource`（client-hmr が apply で 1 つ開く）も `ResizeObserver` も `document.fonts` イベントターゲット（レイアウトコンポーネントがマウント時にサイズとフォント読み込みを観測する）も実装していないため、`start` は欠如しているグローバルの不活性スタブを参照カウントし、`dispose` はそれらだけを削除する。これは jsdom のギャップであり、クライアント identity チャネルではない。`@deepseek-ai/dsh-api-remotes` 行はすべてのロースターから除外される。その生成された Remote クライアントはビルド済み `lib/` にのみ存在し、`remote.<ns>` こそがこのティアがとにかく置き換えるものだからである。自身の生成されたコントリビューションをマウントする `@deepseek-ai/dsh-api-remote-access` 行も除外され、`start` はその場所に `allowAllAccessPlugin` をインストールする。どちらの行へのプラン `provide` エントリーも拒否される。代わりに `start` は、ロースターが注入する `remote.<ns>` サービスごとに 1 つのコントラクトを持たないプロキシを提供する（加えて、その時点でモックがルールを持つ名前空間。後から最初に登録された名前空間はプロキシを持たない）。`ctx.remote.<ns>.<method>(...args)` は、位置引数を運ぶエンドポイント `<ns>/<method>` への呼び出しになる。モックが `stream()` スクリプトを登録した場合はストリーム、そうでなければ単項呼び出しであり、生成されたクライアントの結果折り畳み（キャリアスローで `gateway/internal`、アボートで `gateway/cancelled`）を伴う。ルールのないエンドポイントも依然としてディスパッチされるため、モックがそれをログし、`dispose()` がテストを失敗させる。

### いつ使うか

スロット、ストア、レンダリング、破棄を実ランタイムの下で試す機能スイートにはこのベンチを使用する。プロダクションの `SlotRegistry`、レンダラー、provide バンドルの実体化がマウントされ、再実装されることはない。これはクライアント側のテストインフラストラクチャである。モデルリクエストに到達することはなく、機能パッケージは `devDependencies` でのみこれに依存する。

### 起こり得る問題

- **宣言されたサービスが提供されていない** — `mount` が欠如している名前とともに大きく失敗する。先に `provide()` で提供する。
- **`declare` の前にレンダーを試みた** — `renderSlot` が大きく失敗する。先にキーを宣言する。
- **スペックがセッション振る舞いスタブ上のスタブ化されていないメソッドを呼び出した** — フィクスチャスタブは設計上大きく失敗するため、欠如したスタブは黙って通るのではなく呼び出し箇所で表面化する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションはベンチの設計を説明する。観察可能な振る舞いは[このパッケージを使う](#use-this-package)で完全に扱う。

### 設計

ベンチはプロダクションロジックをコピーしない。プロダクションの `SlotRegistry`、プロダクションレンダラー、`UiSession` アダプターをマウントする。`TestSessions` と `TestWorkspaces` は、機能が Cordis を通じて消費するオーナーインターフェースを実装し、各フィクスチャセッションは `SessionFace` を実装し、`stubConfigForm` は `ConfigForm` を実装する。`UiSession` はそれらの Controller バインディングから標準レンダラーソースを導出する。スタブ化されていない `ISession` の振る舞いは、欠如しているメソッド名とともに失敗する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | `SlotTestRuntime` の組み立て、`TestRoot`、自動フレーム、`mount`/`dispose` |
| [`src/sessions.ts`](src/sessions.ts) + [`src/workspaces.ts`](src/workspaces.ts) | `ISessions`/`IWorkspaces` テストダブルと `FixtureSession` 振る舞いスタブ |
| [`src/fixtures.ts`](src/fixtures.ts) | プレーンなフィクスチャビルダー: 会話スナップショット、ワークスペースリスト状態 |
| [`src/snapshot.ts`](src/snapshot.ts) | DOM スナップショットシリアライザー（クラスハッシュの折りたたみ、`<svg>` フィンガープリント） |
| [`src/access.ts`](src/access.ts) | `allowAllAccess` プロップと `allowAllAccessPlugin`。remote-access Client 行の全許可スタンドイン |
| [`src/remote.ts`](src/remote.ts) | host RPC 用の `TestRemote` ダブル、`RemoteError` の値再エクスポート |
| [`src/translate.ts`](src/translate.ts) + [`src/locale-env.ts`](src/locale-env.ts) | 翻訳と固定ブラウザー言語のテストヘルパー |
| [`src/config-form.ts`](src/config-form.ts) | テスト駆動の公開と書き込みスパイを備えた `stubConfigForm` |
| [`src/assembly/roster.ts`](src/assembly/roster.ts) | `ClientRosterRow`、`ClientRoster`（`of`/`closure`/`pick`/`without`）、それが注釈する `AssemblyPlan`、および `graphFromRoster` |
| [`src/assembly/modules.ts`](src/assembly/modules.ts) | ソース `/client` のインポートと置換。プロダクションモジュールファサードの保留中ファクトリーキューを通じて登録される |
| [`src/assembly/test-client.ts`](src/assembly/test-client.ts) | `TestClient`: インスタンスバインドの Connection、共有 jsdom シム、`bootClient`、マウント、準備完了待ち、`reload`/`unload`/`dispose` |
| [`src/assembly/vitest.ts`](src/assembly/vitest.ts) | テストスコープの `mock` と遅延 `start` フィクスチャ |
| [`src/assembly/remote-default-responses.ts`](src/assembly/remote-default-responses.ts) | `remoteDefaultResponses`: 起動時にロースターが呼ぶ Remote エンドポイントの既定応答 |
| [`src/assembly/remote-proxies.ts`](src/assembly/remote-proxies.ts) | Connection 上のコントラクトを持たない `remote.<ns>` プロキシ: `remoteNamespacesOf`、`remoteProxiesPlugin` |
| [`src/assembly/bundle-roster.ts`](src/assembly/bundle-roster.ts) | `bundleRoster` と `webApp`: インクルードプラグイン自身のスキーマとパッチ適用でバンドルパッチファイルから読み取られたブラウザーロースター |

### ライフサイクル

`create()` は新しいコンテキストを構築し、スロットと会話レジストリをマウントし、レンダラーをインストールし、セッション/ワークスペースダブルと大きく失敗するファイルアップロードスタブを提供する。`mount` はファイバーを開始する前に、宣言されたすべての注入をコンテキストに対してチェックするため、欠如したプロバイダーは永遠に保留されるのではなく大きく失敗する。`dispose()` はまず React ツリーをアンマウントし、次に機能ファイバーを破棄し、ルート登録を解放し、生成されたセッションスコープを破棄し、永続化されたストア状態をクリアする。すべての公開ミューテーターは act でラップされるため、テストが SlotCore のマイクロタスクバッチや React の `act` を自分で扱うことはない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルのコントラクトで足りない場合は、これらのページを読む。ベンチから、それがマウントするプロダクション機構とそれを使用するテストへと進む。

- [ui-session](../../client/ui-session/README.md) — Controller ダブルから標準スロットソースを導出するプロダクションアダプター。
- [UI slots パッケージ](../../client/ui-slots/README.md) — ベンチがマウントする `SlotRegistry` コントラクト。
- [UI renderer パッケージ](../../client/ui-renderer/README.md) — ベンチがインストールするレンダラー。
- [テストポリシー](../../../docs/testing.md) — カバレッジティアとブラウザースナップショットレーン。
- [test-support グループマップ](../README.md) — 兄弟ハーネスとサポートパッケージ。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはブラウザー側のテストインフラストラクチャであり、ここにあるものがモデルリクエストに到達することはない。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立ても送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、ベンチがどのように消費されるかを定義する。それらは現在のパッケージ制約であり、タスクバックログではない。

- **クライアント全体ティアは生成された Remote クライアントを実行しない** — `remote.<ns>` プロキシは、生成された zod 検証、ワイヤー名マッピング、スコープ付き identity 注入なしで位置引数を転送する。モックハンドラーはそれらの引数を直接受け取り、生成されたクライアントはビルド済み成果物の e2e レーンでカバーされ続ける。
- **プロキシされた呼び出しは Gateway クライアントの `invoke` と `invokeStream` をバイパスする** — `$mount` ライフサイクルチェックは実行されず、ストリームの失敗は `normalizeConnectionStream` を通じて再マークされず、単項の拒否は Gateway クライアントがエクスポートする `carrierFailure` と `cancelledFailure` を使ってプロキシ自身が折り畳む。`ctx.remote.$stream`、`$on`、`$host` は本物の Gateway クライアントのものである。
- **未宣言のエンドポイントは単項呼び出しとしてディスパッチされる** — プロキシは各エンドポイントのモードをモックの登録から知る。スペックがスクリプト化も宣言もしていないストリームエンドポイント（`RemoteTable.streams`、`mock.stream(endpoint)`）は `unary` ミスとしてログされ、プロダクトコードは失敗するストリームではなく折り畳まれた結果を受け取る。`remoteDefaultResponses` はロースターの後から開かれるストリームを宣言し、`dispose()` はいずれにせよテストを失敗させる。
- **このパッケージのクライアントコンパイルプログラムは `node` のアンビエント型を追加する** ため、ロースターリーダーが `node:fs` を使用できる。スロットティアのソースも同様にそれらに対してコンパイルされる。
- **セッション、会話、チャットのフィクスチャは分離されたままである** — `sessionSnapshot` は Session Controller の状態のみを含み、`conversationSnapshot` はターゲット中立の会話状態を含み、`chatSnapshot` はチャットターゲット状態を含む。アセンブリテストは、`SessionSnapshot` に会話やチャットのフィールドを追加する代わりに、セッションイベントエントリーを提供する。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
