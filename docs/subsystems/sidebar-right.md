# 右 Sidebar

日本語 | [English](sidebar-right.en.md) | [中文](sidebar-right.zh.md)

右 Sidebar は、Web Client の Session ごとのドッキングサーフェスである。会話の横にあるペインとタブの列であり、アドレス指定されたコンテンツ（ワークスペースファイル、ディレクトリツリー、製品自身のページ）がそこで開き、分割され、フロートし、閉じる。[`dsh-client-ui-sidebar-right`](../../packages/client/ui-sidebar-right/README.md) がサーフェス、タブタイプレジストリ、ナビゲーションサービスを所有する。[`dsh-client-ui-dockkit`](../../packages/client/ui-dockkit/README.md) はその内部レイアウトエンジンであり、[`dsh-client-resources`](../../packages/client/resources/README.md) は任意のコンポーネントのためにアドレスをライブ値に変換し、[`dsh-api-workspace-files`](../../packages/api/workspace-files/README.md) は Host ワークスペースサービスと Client `file` リソースプロバイダーの両方を提供する。

このページはサブシステムの契約のリファレンスである。アドレス、タブタイプ登録、ナビゲーションサービス、拡張スロットとそのオーナー props、リソースモデル、Workspace Files サービス、出荷済みタイプ、意図的に作られていないもの。レイアウトエンジン、フレーム、サーフェスがどう組み合わさるかは [Agent Note](../../.agents/notes/implemented/feature/2026-09-04-right-sidebar-docking-infrastructure.md) にあり、スロットの仕組みは [Slots リファレンス](slots.md) にある。

## 位置と所有権

ドッキングサーフェスは Session ごとに 1 つ存在し、セッションスコープのスロットストアに保持され、`rightbar.session` によって描画される。ルートスコープの `rightbar` コントローラーは、選択された Session 用と、`keepMounted` ボディが初期化されたバックグラウンド Session 用の別々のシートを保持する。可視なのはフォアグラウンドの Conversation のみである。リロードは保存されたレイアウトを復元する（[状態](../../packages/client/ui-sidebar-right/README.md#state)）。サーフェスのすべての変更は、キットの純粋なプランナーが計算する 1 つの記録された履歴エントリである。ドッキングされたペインが空のままになることはなく、空のルートペインは登録された guide エントリから選択されたデフォルトページを受け取る。

タブタイプは definition の `id` を共有する 2 つの登録である。`ctx.sidebarRightTabs` 内の静的定義はその `kind` がどのアドレスを開くかを述べ、キー付きスロット登録がそのボディを提供する。フレームワークはライブの Sidebar、ペイン、タブ情報のために `useTabInfo()` を注入し、各タイプは自身の状態をスロットストアに保持する。パッケージは互いの宣言を型としてのみインポートする。

| パッケージ | 役割 |
|---|---|
| [`client/ui-sidebar-right`](../../packages/client/ui-sidebar-right/README.md) | パネルとレールのシート、レイアウトストア、`ctx.sidebarRightTabs`、`ctx.sidebarRight`、Tab ドメイン、guide タイプ |
| [`client/ui-dockkit`](../../packages/client/ui-dockkit/README.md) | 純粋なレイアウトエンジンと React サーフェス。`ui-sidebar-right` の内部依存であり、安定したインターフェースではない |
| [`client/resources`](../../packages/client/resources/README.md) | `ctx.resources`、`useResource`、プロトコル → 値ロスター `ResourceProtocolMap` |
| [`api/workspace-files`](../../packages/api/workspace-files/README.md) | Host `ctx.workspaceFiles`、`workspaceFiles` Remote 名前空間、Client `file` リソースプロバイダー |
| [`util/workspace-path`](../../packages/util/workspace-path/README.md) | ファイルアドレス文法: `fileAddressFor`、`parseFileAddress` |
| [`client/ui-sidebar-documentpreview`](../../packages/client/ui-sidebar-documentpreview/README.md)、[`client/ui-sidebar-files`](../../packages/client/ui-sidebar-files/README.md)、[`client/ui-sidebar-browser`](../../packages/client/ui-sidebar-browser/README.md) | 出荷済みの `text`、`files`、`browser` タイプ |

## アドレス

すべてのタブはアドレス文字列によって開かれ、アドレスはタブのコンテンツ同一性である。2 つのファミリーが存在する。

**リソースアドレス**は `dsh-resource://<type>/…` URL である。ホストがリソースプロトコル（`ResourceProtocolMap` のキー）を名指し、その後ろのすべてはプロトコル自身のパスである。1 つのスキームがすべてのプロトコルにサービスするため、プロトコルの追加はホストを追加し、スキームは決して追加しない。`file` プロトコルのパスはそのスコープで始まる。`session/<sessionId>` に続いてその session のワークスペースルートからの相対パス（`dsh-resource://file/session/abc/src/notes.txt`）、または `absolute` に続いて先頭の `/` を落とした絶対パス（`dsh-resource://file/absolute/home/ys/notes.txt`、Windows では `dsh-resource://file/absolute/C:/x/y.txt`）である。すべての id とパスセグメントはコンポーネントエンコードされ、ドライブ文字の `:` はリテラルのまま保たれる。`fileAddressFor(sessionId, cwd, path)` が 1 つを構築する。相対パスまたはワークスペース内の絶対パスは `session` 相対になり、その他の絶対パスは `absolute` になる。`parseFileAddress(address)` はそれを読み戻すか、`undefined` を返す（[文法](../../packages/util/workspace-path/README.md)）。

**ページアドレス**は、リソースではなく kind で開かれたタブに対して Sidebar が記録するものである。`sidebar://<kind>` であり、`openTab(kind)` の実行時に Sidebar 自身が書く。呼び出し元がこれを構築することはない（guide とファイルツリーは `openTab('guide')` と `openTab('files')` として開かれる）。他のナビゲーションアドレスは存在しない（[未実装](#not-built)）。

タブの同一性は `(kind, address)` の組である。レジストリの claim はアドレスをそのままレコードの `contentId` として使うため、同じタイプで同じアドレスを開くと既存のタブが見つかり、2 つのタイプで同じアドレスを開くと 2 つのタブになる。

## タブタイプ登録

`ctx.sidebarRightTabs.register(definition)` は、呼び出し元のライフタイム中、あるタイプの 1 実装を登録して disposer を返す。呼び出し元はそれを自身の `ctx.effect` 内に保持するため、実装はそれを提供したプラグインとちょうど同じだけ生き、同じ `id` の 2 回目の登録は throw する（[拡張シート](../../packages/client/ui-sidebar-right/README.md#extension-seats)）。definition は静的である。実行時フックはなく、タブごと・セッションごとのものもない。

| フィールド | 意味 |
|---|---|
| `id` | 実装の同一性であり、すべての登録を通じて一意。パッケージ名が自然な値（`@deepseek-ai/dsh-client-ui-sidebar-files`）。ボディとタイトルが登録されるキーである。 |
| `kind` | タイプの判別子。そのタブが何であるか、`openTab` が何を名指すか。一意ではない。拡張が builtin の kind を引き継ぐことがある。出荷済みの kind は `guide`、`text`、`files`。 |
| `patterns` | タイプが認識するオプションのリソースアドレス glob。kind で開かれるページタイプはこれを省略する。`:` を含むパターンはアドレス全体に一致し（`dsh-resource://file/**`）、含まないパターンは URL のパスに任意の深さで一致する（`*.md`）。URL でないアドレスはそのようなパターンに一致しない。マッチングは大文字小文字を区別せず、ドットファイルを隠さない。構文は picomatch の POSIX 方言である。 |
| `priority` | 3 つのリテラルバンドのいずれか。`extension`（デフォルトかつ最上位。製品外部のタイプは出荷済みのすべてのビューアーより上位）、`builtin`（製品に同梱されるタイプ）、`fallback`（より具体的なものが打ち負かすべきプレーンコンテンツビューアー）。 |
| `canOpen(address)` | glob 一致に対するオプションの同期 veto。すべてのルーティング決定で実行される。 |
| `title(address)` | チップのテキスト。タブを開くときにレイアウトレコードに捕捉され、決して書き換えられない。 |
| `keepMounted` | 非表示、Session 切り替え、ドッキングを越えて訪問済みボディを遅延保持するオプション。所有 View が Session 参照を保持する。 |
| `guide` | guide ページのオプションのエントリーボックス: `{ order, title(), description?(), icon? }`。ボックスを選ぶと提供元のタイプがページとして開く。ページに載せない場合は省略する。 |

アドレス全体のパターンは生のアドレスに一致する。picomatch の globstar (`**`) は、`dot: true`（ドットファイルを含めるがこの除外は変えない）であっても、単独の `.` と `..` セグメントを除外する。リソース固有のコードがアドレスをパースし、Host がファイル読み取り権限を強制する。

ルーティングはランク付けされた claim である。`candidates(address)` は、パターンが一致し `canOpen` が veto しないタイプを、バンド、次に最長一致パターンの長さ、次に登録順でランク付けする。`claim(address, kind?)` は最初の候補、または名指しされた `kind` そのものを選び（glob はスキップされるが `canOpen` は依然として適用される）、`{ kind, contentId: address, title }` を返す。どのタイプも claim しないアドレスは throw する。これは配線ミスであり、ユーザーエラーではない。

1 つの `kind` は同時に 1 つの `builtin` と 1 つの `extension` 登録を持てる。claim、`get(kind)`、`openTab(kind)`、guide ページに対して有効なのは extension であり、シートはタブのボディとタイトルを有効な definition の `id` の下で見つけるため、スロット優先度は関与しない。extension が登録解除されると builtin が再開する。kind 上のその他の衝突、および `id` の重複はすべて throw する。

```ts ignore-check
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

export const inject = ['sidebarRightTabs', 'slots']

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: '@acme/dsh-client-ui-image',
    kind: 'image',
    patterns: ['*.png', '*.jpg', '*.gif', '*.svg'],
    canOpen: address => address.startsWith('dsh-resource://file/'),
    title: address => address.slice(address.lastIndexOf('/') + 1),
  }), 'image type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: '@acme/dsh-client-ui-image' },
    ImageBody,
  )), 'image body')
}
```

## ナビゲーション: `ctx.sidebarRight`

2 つの open がナビゲーションコントローラーであり、列へのあらゆる経路がそのどちらかを呼ぶ。`dsh-resource://` アドレスには `openResource(address, options?)`（会話のファイルリンク、ツール行の行参照、ファイルツリーの行）、ページには `openTab(kind, options?)`（ストリップの追加コントロール、guide エントリーボックス、Assistant Markdown 内の HTTP(S) リンク）である。どちらも 4 つのステップを 1 つの履歴エントリとして実行する。claim（レジストリがリソースのタイプをランク付けするか、名指しされた `kind` の有効な実装が応答する）、同じ `(kind, address)` をすでに表示しているタブへのフォーカス、そうでなければ新しいタブの着席、列の展開。その後ナビゲーションを Tab ドメインに記録する（[サービス](../../packages/client/ui-sidebar-right/README.md#ctxsidebarright)）。ユーザーが見られないコンテンツは開かれないため、折りたたまれた列は同じステップで展開する。`openResource` は `dsh-resource://` 外のアドレスまたはどのタイプも claim しないアドレスで throw し、`openTab` は何も登録していない kind で throw する。どちらも配線ミスであり、ユーザーエラーではない。

| オプション | 意味 |
|---|---|
| `paneId` | 新しいタブをこのペインに着地させる。デフォルトはアクティブなドッキングペイン（フローティングペインがアクティブな間は最初のドッキングペイン）。 |
| `replaceTab` | このタブのペインとストリップスロットを引き継ぎ、同じステップでそれを閉じる。フローティングタブは場所を貸さないため、新しいタブは未配置であるかのように着地する。 |
| `revealIfOpened` | デフォルト `true`: 同じ `(kind, address)` をすでに表示しているタブにフォーカスし、`params` を渡す。`false` は常に別のタブを開く。 |
| `preferNewPane` | 通常のペイン予算と余地ルールの下で新しいドッキングペインを優先し、分割できない場合はターゲットペインにフォールバックする。`replaceTab` と併用時は無視される。 |
| `kind`（`openResource` のみ） | claim のランク付けの代わりに開くタイプを名指しする。その有効な実装がアドレスを開き、その `canOpen` は依然として適用される。 |
| `params` | ボディへのナビゲーションパラメータであり、`navigation.params` として配信される。`openResource` はマージ拡張可能な `SidebarRightResourceParamsMap` を通じてリソースタイプごとに型付けし（テキストプレビューは `{ line?: number }` を宣言する）、`openTab<K>` は `SidebarRightTabParamsMap` を通じて kind ごとに型付けする（何も宣言しない kind では `undefined`）。ボディは両者の合併である `SidebarRightNavigationParams` を読む。値は慣例により JSON 形であり、実行時には検証されない。 |

配置は呼び出し元のオプションであり、タイプのプロパティでは決してない。会話は `openResource(fileAddressFor(sessionId, cwd, path))` を呼び、`read` ツール行からは呼び出しの 1 始まり `offset` から `{ params: { line } }` を追加する。guide エントリーボックスは `tab.actions.openTab(entry.kind, { replaceTab: true })` を呼び、ファイルツリーの行は `tab.actions.openResource(address)` を呼び、ストリップの追加コントロールは `openTab('guide', { paneId, revealIfOpened: false })` を呼ぶ。

`close(tabId)` はタブを閉じる。`active()` はアクティブペインのアクティブタブを返す。`isExpanded()` と `toggleExpanded()` は列を読み、反転する。反転はシーケンスに記録される。読み取りは Session なしの場合に `undefined` または `false` で応答し、書き込みはマウントされた Session サーフェスを必要とし、誰も描画しないサーフェスに書き込むのではなく、ない場合は throw する。

`focus(tabId)` はタブをそのペインのアクティブタブにする。`split(paneId?)` はアクティブなドッキングペインまたは名指しされたペインを分割し、新しいペインの id を返す。ペイン予算または列の幅が分割を禁じる場合は `undefined` を返し、何も記録しない。`float(tabId, rect?)` はタブをフローティングペインに持ち上げ、`dock(paneId)` はフローティングペインをドッキング領域に戻す。4 つともストアの既存アクションを実行し、それぞれ 1 つの履歴エントリを記録する。存在しないターゲットまたはすでに要求された状態にあるターゲットはノーオペレーションであり、`open` と同様にマウントされた Session サーフェスなしでは throw する。`TabId`、`PaneId`、`TabRecord`、`FloatRect` はパッケージの `/client` エントリから再エクスポートされるため、呼び出し元は dockkit のインポートを必要としない。

`focusedTarget(element?)` は、埋め込み iframe を含め、ライブ DOM フォーカス下の可視ページを捕捉する。サイドバー外のマークアップや古いマークアップはターゲットを生まない。`commandTarget(element?)` は、サイドバー外から開始された open に対して、マウントされた Session のアクティブドックペインも許可する。`SidebarRightTarget` は Session、ペイン、host、タブオカレンス、ナビゲーションリビジョンを捕捉する。`isTargetCurrent(target)` は実行前にその同一性を確認するため、レコードを開き直したりナビゲートしたりすると捕捉されたアクションは無効になる。別のページに再ターゲットすることは決してない。close と配置の結果については [コントローラーメソッド](../../packages/client/ui-sidebar-right/src/client/service.ts) を参照。

## スロットとオーナー props

Sidebar は 4 つの拡張スロットを宣言し、その document タブは以下に示す追加のキー付き document ボディを宣言する（[階層](slots.md)）。

| スロット | カーディナリティ | 目的 |
|---|---|---|
| `sidebar.right.pane.tab` | definition の `id` でキー付け、Session スコープ | 1 つのタブのボディ。シートはタブをその kind の有効な実装の `id` にディスパッチするため、登録者はその kind のすべてのタブをドッキング・フローティング問わず受け取る。実装がボディを登録していない kind は、オーナーの "nothing can view this" 通知をレンダリングする。 |
| `sidebar.right.pane.tab.title` | definition の `id` でキー付け、Session スコープ | チップのタイトル。ボディと同じオーナーシェアを持つ。オプション: エントリがなければ、チップは open 時に捕捉された `title(address)` テキストを表示する。ライブタイトルを持つタイプはここで自身のストアを読む。 |
| `sidebar.right.tab.guide` | チェーン、Session スコープ | タブを置き換えずに guide タブの内容を置き換える。最初の辞退しないエントリがボディを取り、そうでなければ出荷済みの guide がレンダリングされる。 |
| `sidebar.right.tab.menu.item` | リスト、Session スコープ | キット自身のレイアウトアクションの後に追加されるコンテンツレベルのアクション。動作する項目はオーナーの `dismiss()` を呼ばなければならない。 |
| `sidebar.right.tab.document` | document 実装の `id` でキー付け、Session スコープ | document タブ内の選択されたファイルレンダラー。親が共有の読み込みとツールバーコントロールを所有する。 |

ボディ、タイトル、guide の置き換えは、フレームワーク注入の `useTabInfo()` を受け取る。これは `{ sidebar, panel, tab }` を返す。`sidebar` は `expanded` と `fullscreen` を持ち、`panel.id` は収容するペインを名指しし、`tab` はそのレコードフィールドに加えて `visible`、`navigation`、`signal`、`actions` を含む。すべてのタブはフォアグラウンド Session を必要とする。ドッキングされたボディは展開と選択も必要とし、ドッキングされたタイトルは展開を必要とし、フォアグラウンドのフロートは折りたたみを越えて存続する。`signal` はレコードが消えるかプラグインがアンロードされると abort し、非表示や Session 切り替えでは abort しない。`tab.actions` は `openResource`、`openTab`、`close` を提供し、タブ自身の Session にバインドされる。Open の配置はデフォルトで現在のペインになり、`revealIfOpened` はデフォルト `true`、`replaceTab: true` は同じ履歴エントリ内でこのレコードを置き換える。メニューエントリはプレーンな `tab` と `dismiss` のオーナーパラメータを保持する。

`navigation.revision` は、`params` が変わったかどうかに関係なく、タブへのすべてのナビゲーションでインクリメントされる。そのためボディは「再びナビゲートされた」ということだけに基づいて動作できる。アドレスで開かれたタブでは `1`、誰もアドレスで開いていないレコード（シードされた guide、undo で復元されたタブ）では `0` である。Tab ドメインは開いているレコードごとに 1 つのオカレンスを持つ。現れたレコードはリソースモデルにピン留めされるため、タブを切り替えてもコンテンツを落とさずにボディがアンマウントされる。消えたレコードは abort され破棄される。undo で復元されたレコードは新しいオカレンスである（[Tab ドメイン](../../packages/client/ui-sidebar-right/README.md#the-tab-domain)）。

`tab.actions.bindCommands(commands)` は、マウントされたボディのために `SidebarRightTabCommands`（現在はオプションの `refresh` コールバック）を提供する。省略された操作は利用不可である。返された disposer は、より新しいボディのコマンドを削除せずにその登録を解放する。タブのライフタイムもそれらを解放する。`tab.refreshShortcut` はページコントロール用の有効な refresh カタログエントリを提供する。エントリが利用できない場合はオプションである。これらのフィールドは [スロットオーナー型](../../packages/client/ui-sidebar-right/src/client/contract/slots.ts) で宣言される。

## ドキュメントレンダラー

`text` タブは共有 Document Preview のオーナーである。その [ルート登録](../../packages/client/ui-sidebar-documentpreview/src/client/index.ts) が `sidebar.right.tab.document` を宣言し、`ctx.documentPreviews` を提供する。レンダラーは自身の effect で `DocumentPreviewDefinition` メタデータを登録し、次に `ctx.slots.inject('sidebar.right.tab.document', ...)` を通じて待ち、`key: definition.id` とそのロケール名前空間でコンポーネントを登録する。レンダラーは自身のボディを登録し、子スロットを通じて共有表示を再利用できる。レンダラーを変更してもタブやリソースアドレスは変わらない。[拡張の決定](../../.agents/notes/implemented/architecture/2026-09-08-document-preview-operations.md) はプレビューポリシーとリソース所有を分離する。

[レジストリ](../../packages/client/ui-sidebar-documentpreview/src/client/document/registry.ts) は一意な `id`、`extensions`、ローカライズされた `title()`、`loading`、オプションの `priority`、オプションの `wrap` を記録する。大文字小文字を区別しないサフィックスマッチングは、`extension`（デフォルト）を `builtin` より先に、次に長いサフィックスを短いものより先に、次に登録順でランク付けする。タブ kind の置き換えとは異なり、レジストリはすべての実装を利用可能なまま保つ。ツールバーは一致する代替を列挙し、タブごとに選択を記憶する。未知の拡張子はプレーンテキストを使う。`binaryExtensions` で宣言されたサフィックスは、[パッケージ README](../../packages/client/ui-sidebar-documentpreview/README.md#what-it-registers) で説明されているように、プレーンテキストの選択肢を抑制する。`loading` は `text-pages`、`bytes-complete`、`renderer` のいずれかであり、`wrap` は共有ソース折り返しコントロールのサポートを告知する。

[`DocumentPreviewProps`](../../packages/client/ui-sidebar-documentpreview/src/client/document/contract.ts) は `PropsRuntime<'sidebar.right.tab.document'>` から派生する。オーナーは元の `resourceAddress`、`content`、現在の `wrap`、および `addResource` / `setResources` 依存コールバックを提供する。テキストコンテンツは `{ kind: 'text', text, pages: [{ offset, text, lines }], eof }` で、`text` は累積である。完全なバイトは `{ kind: 'bytes', data }` で、データは `Uint8Array<ArrayBuffer>` である。これらの一時バッファーは読み取り専用で借用され、永続レイアウトや Session JSON に入ってはならない。PDF は Worker 転送前にバイトをコピーし、オーナーのバッファーを保つ。子は同じフレームワークバインドの `useTabInfo` と、グローバルでメタデータのみの `useResource` を受け取る。親はテキストを `remote.workspaceFiles.read` で、バイトを `remote.workspaceFiles.readBytes` で読み、ページ追加、タブごとの refresh、読み込みステータスを所有する。HTML は同じバイトリーダーに `baseFile` を渡し、Host コードがパスを解決する。Markdown とコードは追加を越えて 1 つのインクリメンタルレンダラーを保持し、EOF で確定する。HTML と PDF は完全なバイトを受け取る。

Preview は自身の読み込み済みバージョンと、読み取り開始時に観測されたバージョンを記録する。自動更新はデフォルトで有効である。最初のメンバーメタデータがベースラインを確立し、後の変更がタブを再読み込みする。Refresh はそのタブのみを読み直し、共有メタデータや別のタブのコンテンツを変更しない。読み取りは非トランザクショナルである。バージョンは不透明な等価性トークンであり、順序付きタイムスタンプではない（[リソース観測と Preview RPC](../../.agents/notes/implemented/architecture/2026-09-08-document-preview-operations.md)）。

読み込みを所有するレンダラーは、ファイルバイトの代わりに `{ kind: 'renderer', revision, loaded, failed, reload }` を受け取る。ボディは注入されたフェイスを呼び、リビジョンの変更とアンマウントでキャンセルし、表示されたソースバージョンを `loaded(version)` で報告する。読み込み失敗は `failed()` を呼ぶため、後のファイル変更が再試行できる。親は古い報告を無視し、共有の reload とソース変更コントロールを保持する。Office はこのモードを使って [Host レンダリング PDF](office-to-pdf.md) を要求する。そのフェイスは変換されたバイト、フォントメタデータ、失敗を自身のストアに書き込み、そのボディはネストされた PDF ビューをレンダリングする。`OfficeFontAction` は `sidebar.right.tab.document.action` を通じて、reload の前に欠落フォント警告をレンダリングする。[パッケージ README](../../packages/client/ui-sidebar-documentpreview/README.md#what-it-registers) が読み込みライフサイクルを定義する。

## リソースモデル

モデルは [Client Resources](client-resources.md) で文書化されている。このセクションは Sidebar が何に依存するかを述べる。リソースは 1 つのアドレスであり、リソースアドレスは `dsh-resource://<type>/…` URL で、その小文字化された host がプロトコルキーである。プロトコルを所有するクライアントパッケージは、自身のライフタイム中、`ctx.resources.register(provider)` で 1 つのプロバイダーを登録する。同じプロトコルの 2 つ目のプロバイダーは throw する（[プロトコルの提供](../../packages/client/resources/README.md#provide-a-protocol)）。プロバイダーは `{ protocol, open(address, { signal }) }` である。`open` は `RemoteResult` フレーム（最初に現在の状態、以降の変更ごとに 1 フレーム）を yield し、`signal` が abort すると停止する。失敗は `{ ok: false, error }` フレームであり、throw では決してない。ストリーム内の throw は、モデルが捕捉しないプログラミングエラーである。

`useResource<P>(address)` は、スコープに関わらずすべてのスロットコンポーネント上のグローバル標準 prop である。これは `{ status, value, failure }` を返す。アドレスのプロトコルにプロバイダーがない場合、またはアドレスがリソースアドレスでない場合（`sidebar://guide` はリソースを名指ししない）は `none`、最初のフレームまでは `loading`、最新の `ok` 値付きで `live`、最新フレームの失敗が最後の値の隣にある状態で `failed` である（[リソースの読み取り](../../packages/client/resources/README.md#read-a-resource)）。

リソースはホルダー（購読中の `useResource` または `ctx.resources.pin(address, signal)`）を持つ間オープンのままである。最初のホルダーがプロバイダーのストリームを開き、後のホルダーはそれを共有して最新値をすぐに読み、最後の解放がストリームを abort して値を破棄する。ストリームが運ぶのはコンテンツではなくメタデータである。`file` の値は `{ absolutePath, version, bytes? }` であり、消費者は Workspace Files サービスを通じてファイルテキスト自体をページ単位で読む（[ライフサイクル](../../packages/client/resources/README.md#lifecycle)）。

## Workspace Files

Host の `ctx.workspaceFiles` サービスと生成された `workspaceFiles` Remote 名前空間は、Session ファイルシステムバックエンドが許可するファイルを読む。`stat(path)` は `{ absolutePath, version, bytes? }` を返す。`read(path, { offset?, limit? })` は 1 ページの行（`offset` は 1 始まり、`limit` は設定されたページサイズで上限）を `{ …stat, offset, text, eof }` として返す。`readBytes(path, { range?, baseFile? })` は `maxFileBytes` 未満の完全なファイル、または `maxBytes` 未満のバイトウィンドウを、ネイティブの `Uint8Array` データ付きの `{ …stat, offset, data, eof }` として返す。オプションの `range` は 0 始まりの `offset` とバイト `length` を使い、`baseFile` は別のファイルのディレクトリから相対ターゲットを解決する。`list(path)` はワークスペースルート内に留まり、ディレクトリの直接の子（`name`、`type: 'file' | 'directory' | 'other'`、`size?`）を設定された上限まで切り詰め、`truncated` を設定して返す。`changes(path)` は 1 つのターゲットを監視し、Host がそのタイプを判定してディレクトリをワークスペース内に限定する。購読時に `{ kind: 'ready' }` を一度 yield し、その後 `{ kind: 'change', change }` フレームを yield する。そのペイロードは `{ absolutePath, version }` または `{ absolutePath, absent: true }` である（[README](../../packages/api/workspace-files/README.md#use-this-package)）。ファイル読み取りは最終シンボリックリンクを拒否し、転送上限を強制する。`read` はさらに UTF-8 テキストを要求する。失敗は `workspace-file/*` コードを使う（[失敗](../../packages/api/workspace-files/README.md)）。

[`dsh-api-workspace-files`](../../packages/api/workspace-files/README.md) は `file` プロバイダーを登録し、`ResourceProtocolMap.file` は `WorkspaceFileStat` を直接名指しする。Session アドレスは認可する Session と相対または絶対パスを運び、解決のために変更されずに Host へ渡される。プロバイダーは stat の前に Host の `ready` を待ち、変更を `stat.absolutePath` でフィルターする。裸の `absolute` アドレスには認可する Session がなく、現在の Session もタブの Session も借用せずに `workspace-file/unknown-workspace` で失敗する。Global コンポーネントを含む任意の UI が、同じ完全なアドレスの観測を共有する。Preview の Remote コールバックはそのアドレス内の Session を使い、`remote.workspaceFiles.readBytes` は Connection のバイナリ RPC 転送を通じてネイティブバイトを返す。

## 出荷済みタイプ

- **`guide`** — `builtin` で、`openTab('guide')` として開かれる。ミュートされたコンパスが、提供された `guide` エントリごとのカプセルの上に `order` 順で並ぶ。短いリストは登録された説明を表示し、欠落したアイコンはすべて出荷済みのプレースホルダーを使う。カプセルを選ぶと、guide タブの場所に提供元のタイプがページとして開く。ペインは最大 1 つの guide タブを持ち、ストリップの追加コントロールはそのペインに guide がない間のみ表示される。新しいペインは登録されたデフォルトページを受け取る。唯一の guide エントリならそれを直接、エントリ数が 1 でなければ guide を受け取る（[guide](../../packages/client/ui-sidebar-right/README.md#the-guide)）。
- **`text`** — `fallback`、`dsh-resource://file/**`、Session アドレスのみを claim する。Document Preview は `useResource<'file'>` でメタデータを観測し、Remote コールバックでコンテンツを読み込み、レンダラー選択、ツールバー、タブごとの refresh、スクロール、ソースナビゲーションを所有する。未知の拡張子はプレーンテキストとしてレンダリングされる（[README](../../packages/client/ui-sidebar-documentpreview/README.md)）。
- **`files`** — `builtin` で、`openTab('files')` として開かれる。ワークスペースディレクトリツリーは `list` を通じて遅延リストされ、展開されたディレクトリごとに監視される。ファイルは `tab.actions.openResource(fileAddressFor(sessionId, root, path))` で自身のペインに開かれる（[README](../../packages/client/ui-sidebar-files/README.md)）。
- **`browser`** — マルチインスタンスの `builtin` で、`openTab('browser', { params: { url? } })` として開かれる。Chat の [リンク設定](../../packages/client/ui-chat/README.md) が、Assistant Markdown の HTTP(S) リンクをここで開くかどうかを制御する。デフォルトサンドボックス下でパブリックおよびループバックの HTTP(S) ターゲットを受け付け、ローカルファイルは Document Preview に譲って拒否し、アプリケーション既知の iframe 履歴を使う（[README](../../packages/client/ui-sidebar-browser/README.md)）。
- **`subagentchat`** — `builtin`、`dsh-resource://subagentchat/session/<child>?parent=<parent>&mode=<mode>`。明示的にアドレス指定されたサブエージェント Conversation はリソースプロバイダーが保持し、共有 Conversation Factory を通じてレンダリングされる（[README](../../packages/client/ui-subagent/README.md)）。

<a id="not-built"></a>
## 未実装

- 永続化: レイアウト状態はメモリのみである。リロードするとすべてのセッションが折りたたまれた状態で始まり、あるセッションのタブは別のセッションから見えない。
- `ctx.sidebarRight` 上の読み取り専用レイアウトスナップショットまたは購読: サービスは操作のみを公開し、dockkit の `LayoutState`/`LayoutOp` は内部である。
- サービス上のケイパビリティ探索配列 (`features`)。
- タブタイプ用の `option` 優先度バンド: 何も claim させずにタブタイプをリストすることはない。
- レコードのタイトル変更: `title(address)` は一度だけ捕捉される。ライブチップはレコードではなくタイトルスロットから来る。
- open 時にタブ実装を名指しすること: `openResource` はせいぜい kind を名指しする。document レンダラーの選択はファイルタブのツールバーに属する。
- サービス上のアドレス検索 (`find`): 呼び出し元は `revealIfOpened` 付きで開き、サーフェスに重複排除させる。
- Sidebar 自身の `sidebar://<kind>` 記帳を超えるナビゲーションアドレス。その文法はナビゲーションコントローラー全体を待つ。
- ユーザー向け undo と一般的なクロスタイプのコンテンツナビゲーションスタック（[先送り](../../.agents/notes/implemented/feature/2026-09-04-right-sidebar-docking-infrastructure.md#deferred)）。Browser は自身のページ履歴のみを所有する。
