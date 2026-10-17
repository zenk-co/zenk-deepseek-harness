# クライアントコンポーネントのルール

日本語 | [English](client-components.en.md) | [中文](client-components.zh.md)

クライアントコンポーネント、その状態、エフェクトに関するルール。[packages/client/AGENTS.md](../../packages/client/AGENTS.md) が詳細な規律を定め、[slots.md](../subsystems/slots.md) が Slot の設計を、[web-styling.md](../web-styling.md) がスタイルのルールを所有する。以下の各セクションでは、要件、レビュアーによる判定方法、境界と例外の位置づけ、正しい例と誤った例を示す。

## 状態はインジェクション経由で届く

Slot のコンポーネントは、レンダリングするすべてのものを自身のレジストレーションの inject フェース経由で受け取る — プレーンなデータ、アクションコールバック、そしてレンダラーが `use<Name>` フックに束縛する予約済みの `hooks` コンパートメント — 一方、親のレンダーサイトはオーナーデータを派生した `renderSlot` 経由で渡す。ツリーの頂点で 1 つの大きなグローバル状態を読み取って値を下に渡すことは決してない。すべてのライブ値をそのフェースに載せることで、変化していないプロップが同一性を保ち、コンポーネントが必要なサブ状態だけを購読できるようになる。これがなければ無関係なフィールドの変更がサブツリー全体を再レンダーし、ストリーミングイベント下の長いセッションでユーザーのスクロールや入力中にフレームを失う原因になる。

- 判定方法: レジストレーションとそのレンダーサイトにおいて、作成者はレンダリングされるコンポーネントがどのサブ状態を購読するか、どの受信プロップがレンダー間で安定した同一性を保つかを言えなければならない。すべてのプロップの可変性に注意する: レンダーごとに再構築される値 — 新しいオブジェクト、配列、インラインコールバック — は中身が変わっていなくても再レンダーを伝播させる。
- 対象外: コンポーネント自身のローカル状態（折りたたみ、ホバー、下書きのための `useState`）はインジェクション内容ではなく、React の外側を何も購読しないコンポーネントには新しいシートは不要である。
- 例外: 新しいフックシートは Slot 契約を変更するため、その変更はレビューで影響 — どのコンポーネントが何を購読するか — を明示する。既存フェースの利用にはコンポーネントごとの承認は不要である。
- 修正方法: インジェクションをビューがレンダリングするものに絞り、読み取りごとに 1 フィールドをフックシート経由で公開し、ストアやサービスハンドルではなく狭いアクション集合を渡す。[Component inputs](../subsystems/slots.md#component-inputs) が inject ファクトリー、標準フックシート、各シートがプロップになる方法を所有する。

レジストレーションはプレーンなデータ、狭いアクション集合、1 つのフックシートを持ち、レンダーサイトはオーナーデータを渡し、コンポーネントはレンダリングするフィールドだけを読む:

```tsx
// The inject factory returns plain data and callbacks; hooks is the reserved compartment.
ctx.slots.register(
  {
    name: 'sidebar.right',
    inject: () => ({
      rename,
      hooks: { info: infoSource },   // bound by the renderer as useInfo()
    }),
  },
  SidebarRight,
)

// The parent's render site passes owner data through the derived renderSlot.
{renderSlot('sidebar.right', { id })}

function SidebarRight({ id, useInfo, rename }: Props) {
  const { title } = useInfo()   // subscribes to title only
  return <button onClick={() => rename(id)}>{title}</button>
}
```

トップレベルのコンポーネントはビュー全体のストアを読み取り、1 つのプロップとして下に渡すため、レンダーサイトは上記のどちらの問いにも答えられなくなる:

```tsx
function Sidebar() {
  const view = useViewStore()           // one top-level global read
  return <SidebarRight view={view} />   // the whole store travels down
}

function SidebarRight({ view }: { view: ViewStore }) {
  return <span>{view.activePanel.title}</span>
}
```

そのストアのあらゆるフィールド変更がサイドバー全体のサブツリーを再レンダーし、コンポーネントの購読集合はそれを束縛したサイトから見えなくなる。

## プロップはデータとコールバックを持ち、React ノードは持たない

プロップはデータまたはコールバックであり、React ノードは宣言済みスロット経由で移動する。要素をプロップ値やインジェクトされたメンバーとして渡すと、Slot 契約が記述しない第 2 のコンポジション経路を隠し、レンダー制御をレジストレーション面から呼び出しサイトへ移し、あるパッケージが別パッケージのマークアップを組み立てられるようになる。ノード値を持つ新しいプロップやインジェクトされたメンバーは決して追加しない。ホスト供給のマークアップが必要な位置は、代わりに子スロットとして宣言する。

- 判定方法: コンポーネントのプロップ型、inject ファクトリーの戻り値、レンダーサイトのオーナープロップオブジェクトにおける `ReactNode`、`ReactElement`、または `() => JSX.Element`。
- 対象外: すでに出荷済みのノード値フィールドは動作し続ける。このルールは変更がその 1 つに触れたときに発動し、その変更は拡張ではなく変換する。
- 例外: 変換を同じ変更で実施できない場合、所有するドメインエキスパートが延期を確認し、その変更が確認を記録する。作成者自身による承認は決して行わない。
- 修正方法: 親レジストレーションの `children` に位置を宣言し、`renderSlot` でレンダリングし、子のプロップ経由でデータを渡す。どのパッケージがどのスロットを宣言・レンダリングできるかは [Extension rules](../subsystems/slots.md#extension-rules) が所有する。

ヘッダー位置は宣言済みの子スロットであるため、ホストはデータを渡し、登録済みコンポーネントがマークアップを所有する:

```tsx
// The card declares the header location; the host passes data only.
ctx.slots.register(
  {
    name: 'tool.call.toolview',
    children: { header: { kind: 'single', scope: 'session' } },
  },
  ToolCard,
)

function ToolCard({ title, renderSlot }: Props) {
  return <article>{renderSlot('header', { title })}</article>
}
```

React ノードがプロップ値として境界を越えるため、その移動経路となるコンポジション経路はどこにも宣言されない:

```tsx
type ToolCardProps = {
  header?: React.ReactNode
  footer?: React.ReactNode
}

// The call site assembles another package's markup.
<ToolCard header={<ArchiveBadge />} />
```

カードの Slot 契約はレンダリング内容の記述をやめ、呼び出しサイトがレンダー制御を保持し、バッジのパッケージはそれを渡す側からのランタイム参照になる。

## スロットレジストレーションは安定した関数コンポーネントである

スロットに登録される値は、モジュールスコープで宣言された安定した関数コンポーネントである。レンダー中に作成されたコンポーネント関数は毎回新しいコンポーネント型となり、React は型の変化を別コンポーネントとして扱う: サブツリーをアンマウントして新しいものをマウントするため、展開済みの行、入力フォーカス、スクロール位置がリセットされる。レジストレーション時のパラメーターは、レンダー時変数をクロージャーで取り込むのではなく、プロップ経由でコンポーネントに届ける。

- 判定方法: 登録値が作成される場所。レジストレーションやレンダー呼び出し内のインラインアロー、レンダー本体内部で定義されたコンポーネント、インラインコンポーネントを包む `useCallback` はいずれも不合格であり、モジュールスコープの `function` 宣言が合格である。
- 対象外: このルールは登録値の同一性を制約するもので、複雑さを制約するものではない。安定したコンポーネントはインジェクトされたプロップ、フック、コールバックを読み取り続けてもよい。
- 例外: レンダー中にコンポーネントを作成することが正しいのは、呼び出し側が再マウントを望む場合のみであり、通常の変更に個別の承認は不要である。Slot 契約の形式への変更は、状態はインジェクション経由で届くで説明したインジェクションフェースのレビューに従う。
- 修正方法: コンポーネントをモジュールスコープに移動し、レジストレーションの共有からプロップの型を付け、変化する値をクロージャーではなく inject フェース経由で渡す。

レジストレーションはモジュールスコープのコンポーネントへの安定した参照を 1 つ保持し、変化する値はインジェクトされて届く。レンダーサイトはローカルコンポーネントを提供する:

```tsx
function PanelTitle({ title, count }: Props) {
  return <span>{title} ({count})</span>
}

// Registration: the local slot's scope is declared, never a component.
ctx.slots.registerFactory(
  {
    name: 'panel',
    scope: 'root',
    slots: { title: { scope: 'root' } },
    inject: () => ({ title: 'Sessions', count: 3 }),
  },
  Panel,
)

// The render site passes the local component, keeping its identity stable.
renderFactorySlot('panel', { /* owner data */ }, { slots: { title: PanelTitle } })
```

レンダーサイトのインラインアローは、そのレンダーが実行されるたびに新しいコンポーネント型を作成する:

```tsx
// A new component type each time this render runs.
renderFactorySlot('panel', { /* owner data */ }, { slots: { title: (p) => <span>{p.title}</span> } })
```

React は前回のレジストレーションとは異なる型と見なし、シートを再マウントし、無関係な更新であってもローカル状態 — 展開、フォーカス、スクロール位置 — をリセットする。

## コンポーネントは Cordis コンテキストを決して受け取らない

`ctx` は apply の世界に属する: プラグイン本体とそれに閉じた `inject` ファクトリーである。コンポーネントは Cordis コンテキストを決して受け取らず、サービス クラスをインポートしてそれを操作することも、React コンテキストを読むこともない。ビジネス コンポーネントが見るコンテキストはゼロであり — レンダラーの束縛コンテキストはその内部専用である。素のオブザーバブルがコンポーネントに届くのは、Injection がフックで包んだ後のみである。直接購読するコンポーネントは、インジェクションフェース上の何ものも解放しないライフサイクルを所有することになる。

- 判定方法: コンポーネントのパラメーターやプロップ型における `ctx` または `Context`。コンポーネント本体が `observable.value` を読む、`subscribe` を呼ぶ、`useSyncExternalStore` を配線する。サービス クラスがフィーチャーの `.tsx` モジュールにインポートされている。
- 対象外: React の外側を何も購読しないコンポーネント内部の振る舞いフック（タイマー、メディアクエリ）はインジェクション内容ではなく、コンポーネント内に残る。
- 例外: なし。`TabSlot` に残る直接購読は、そのエントリの所有者が持つ修復作業であり、新規コードの前例ではない。
- 修正方法: その事実をレジストレーションの `inject` — プレーンなデータとコールバック、素のオブザーバブルは予約済み `hooks` コンパートメント — または宣言済みストアに移動し、派生シート経由で読む。

インジェクションがオブザーバブルを束縛し、コンポーネントはレンダラーが購読を所有する派生フックを 1 つ読む:

```tsx
// The inject factory is the only place that closes over ctx.
const inject = () => ({
  hooks: { tab: tabStore.observable },
  action: { openTab },
})

function TabView({ useTab, action }: Props) {
  const { loaded } = useTab()   // the renderer owns the subscription
  return <button hidden={loaded} onClick={() => action.openTab('files')} />
}
```

コンポーネントは `ctx` を保持してソース自体を読むため、購読とその有効期間はコンポーネントに属する:

```tsx
function TabView({ ctx }: { ctx: Context }) {
  const store = ctx.get('tabStore')                     // component holds the container
  return <span>{store.observable.value.title}</span>    // raw observable read in render
}
```

その購読を解放する者はおらず、再レンダーは React のスケジューリング外で発火し、コンポーネントは 1 つのストア実装に束縛される。

## コンテキストは現在のスコープから得る

`session`、`panel`、`tab` などは現在のスコープから得る — プロバイダー、インジェクトされたメンバー、フレームワークフックである。到達のためのチャネルとして新しいグローバルな `current`、`active`、`selection`、`viewId` は存在しないため、1 つのセッションの複数のコンポーザーと会話がそれぞれ独立に動作する。

判定条件は、コンポーネントがコンテキストをスコープ経由で取得するか、グローバルフィールド経由で取得するかである。マルチインスタンス動作がテストになる: 1 つのセッション下の 2 つのコンポーザーは交差してはならない。真にグローバルに一意なオブジェクトは、サービスまたはインスタンスが保持し、呼び出し側が明示的に `inject` する。

```ts
// The injected factory closes over the scope's own session and panel.
interface Scope { readonly session: string; readonly panel: string }
const inject = (ctx: Scope) => ({ session: ctx.session, panel: ctx.panel })
```

```ts ignore-check
const activeTabId = globalThis.__activeTabId   // every tab reads the same value
```

誤った形式はインスタンス間の混線を起こし、状態の所有関係を監査不能にする。

## リソース利用者は `useResource` 経由で読む

リソースを表示する要素は、インジェクトされた `useResource` フック経由でそれを読み、リソースのプロトコルとアドレスで指定する。ドメインワラッパー — Tab、パネル — は `useResource` 上に自身のフックを組み立て、その戻り値の構造は自由であるが、下にあるフェッチ、キャッシュ、購読を作り直すことはない。プロトコルごとに第 2 の読み取り経路があるとキャッシュと無効化ポリシーが分裂するため、1 つのアドレスが一方ではライブ、他方ではステイルになりうる。

- 判定方法: 読み取り経路。`useResource<Protocol>(address)`、または本体内でそれを呼ぶビジネスフックは合格である。手作りの購読＋キャッシュ、プロバイダーのストリーム処理のコピー、`useTabStream` のようなフラットな汎用フックは不合格である。
- 対象外: リソースでないローカル UI 状態 — 折りたたみ、ホバー、下書き — は `useState` のままでリソースアドレスを持たない。ステータス値とリソースを開いたままにするものの所有は [Client resources](../subsystems/client-resources.md) が持つ。
- 例外: スナップショットの整形は自由であるが、条件分岐の背後でプロトコル差異を隠すワラッパーはレビューで所有関係を明示し、新しいプロトコルのフックはそのプロトコルの所有者から提供される。
- 修正方法: ドメインフック内で `useResource` を呼び、その結果をコンポーネントがレンダリングするものに写像し、独自キャッシュを削除する。

ドメインワラッパーはインジェクトされたフックを引数として受け取り、その結果を整形するだけであるため、最下層は単一のままである:

```tsx
// The bottom layer is the standard hook, reached through the component's inject face.
function useChatMessages(useResource: UseResource, id: string) {
  const resource = useResource<'chat'>(`dsh-resource://chat/${id}`)
  return resource.status === 'live' && resource.value !== undefined
    ? { messages: resource.value.messages, loading: false }
    : { messages: [], loading: true }
}

function ChatBody({ id, useResource }: Props) {
  const { messages } = useChatMessages(useResource, id)
  return <ol>{messages.map((message) => <li key={message.id}>{message.text}</li>)}</ol>
}
```

ワラッパーが独自名の下で購読、キャッシュ、無効化を作り直すため、プロバイダーのライフサイクルと共有キャッシュは適用されなくなる:

```tsx
export function useTabStream(id: string) {
  const [value, setValue] = useState<TabData>()            // bespoke cache
  useEffect(() => {
    const subscription = tabProtocol.open(id).subscribe(setValue)   // bespoke subscription
    return () => subscription.close()                              // bespoke teardown
  }, [id])
  return value
}
```

すべてのプロトコルが独自のフェッチと無効化ロジックを育て、キャッシュエントリと更新ポリシーを統一できず、1 つのアドレスの利用者間で現在値の見解が割れる。

## ストア利用は狭く明示的に行う

フロントエンドストアは共有の表示状態や操作状態を保持する。その仕様は初期状態、それを変異させるアクション、そして値がリロードを超えて存続すべき場合にフレームワークが機械的に実行する永続化キーを宣言し、セッションスコープのインスタンスはそのキーに接尾辞を付けてセッションごとのインスタンスが独立に永続化される。ストアの属性とそれを変異させるアクションはカプセル化され、狭いインターフェースとしてインジェクトされるため、コンポーネントはそれらと必要なセレクターを受け取り、ビュー全体のストアを受け取ることは決してない。ビジネスデータはストアではなくオブジェクト層に存在し、設定変更はストア状態ではなく設定インターフェース経由で行う。

- 判定方法: インジェクトされるフェースが狭いインターフェースかストアオブジェクト自体か、そしてハンドルが `apply` 内部で構築されるかモジュールレベルで構築されるか。
- 永続化: 仕様の `persist` キーが仕組みの全体であり、フレームワークが実行する。エンジンインスタンスは `getSnapshot`、`subscribe`、ベイク済みアクション、`clearPersisted` を公開し、手動でハイドレーションするものは何もない。
- 対象外: 設定を変更しないレンダー状態のストア保持は問題なく、コンポーネントローカル状態はストア内容ではない。宣言済みストアがプロップになる方法は [Store contracts](../subsystems/slots.md#component-inputs) が、ビジネスデータの所在は [Web Client architecture](../subsystems/web-client.md) が所有する。
- 例外: モジュールレベルでエクスポートされたストアハンドルは禁止である — モジュールキャッシュの同一性はプラグインリロードをまたぐ偽装シングルトンである。インジェクションフェースを狭い形に組み替えることに個別の承認は不要である。
- 修正方法: inject の戻り値にあるストアハンドルを、コンポーネントがレンダリングするフィールドとアクションコールバックに置き換え、ハンドルは `apply` 内部に保持する。

1 つのハンドルが `apply` 内部で構築されてレジストレーションに渡され、inject フェースはビューがレンダリングするフィールドとアクションのみを運ぶ:

```tsx
// The handle is built in apply; persistence is the spec's own key.
const sidebarStore = createSidebarStore()   // defineStore({ init, actions, persist: 'sidebar' })

ctx.slots.register(
  { name: 'sidebar.header', store: sidebarStore, inject: () => ({ onSelect: selectPanel }) },
  SidebarHeader,
)

// The component reads through the framework-bound seat and writes through the actions.
function SidebarHeader({ useStore, actions, onSelect }: Props) {
  const { title } = useStore()
  return <button onClick={onSelect}>{title}</button>
}
```

ビュー全体のストアがコンポーネントがフィールドを選ぶためにインジェクトされ、モジュールレベルのハンドルがインスタンスのライフサイクルをフレームワークから奪う:

```tsx
// The component receives the store itself and picks its own fields.
const inject = () => ({ viewStore })

function SidebarHeader({ viewStore }: Props) {
  return <button onClick={viewStore.select}>{viewStore.activePanel.title}</button>
}

// Module-level handle: one identity shared by every plugin load.
export const paneStore = createPaneStore()
```

コンポーネントの依存フェースは監査不能になり、共有モジュール同一性はあらゆるスコープ破棄を超えて存続する: 2 つのペインが 1 つずつではなく 1 つのインスタンスに載る。

## 同一性と初期状態は意図的に定める

状態の切り替えはコントロールを再マウントしたり DOM ノードを置換したりしない: 状態変更をまたいでインスタンスと DOM 同一性は同じままであるため、フォーカス、選択、入力中の下書きが存続する。初期状態は最初のフロー実行時に準備済みである — 同じ経路がデータを準備して状態を確立する — エフェクトで後から埋めるのではない。コンポーネントはサービス全体ではなく、フック、セレクター、アクションコールバックを受け取る。

- 判定方法: 状態変更後にコントロールインスタンスと DOM ノードが同一性を保つか。アンマウントに続くマウントが違反である。初期化経路も同じ方法で判定する: 最初のフロー内部で確立された状態が合格、エフェクトから書き込まれた状態が不合格である。
- 依存フェース: フックが読み取り、セレクターがサブ状態を選び、アクションコールバックが書き戻す。プロップやインジェクトされたメンバーとしてサービス全体を渡すことは不合格である。
- 適用範囲: 内部インスタンスとローカル状態を持つ入力・コマンドコントロール、およびファクトリーで生成されるビジネスビュー。
- 例外: 真に必要な再マウント — インスタンス状態を移行できないデータ集合への切り替え — は、状態移行計画とともにレビューで説明する。コントロールのインスタンス有効期間に影響する変更は、そのレビュアーが承認する。
- 修正方法: 最初のフローが状態を構築する場所で初期値を導出し、レイアウトノードをマウントしたままプロップだけを変え、サービスプロップを 3 つの狭い共有に置き換える。

下書きはセッションとともに存在し、コンポーザーノードはプロップだけが変わりマウントされたままである:

```tsx
// The draft is built by the first flow; nothing fills it in later.
const draft = useDraftState(sessionId)
const { canSend } = useComposerSelectors(draft)

// The node stays mounted; state changes reach it as props.
return (
  <div className={s.composer} data-ready={canSend || undefined}>
    {draft.text}
  </div>
)
```

初期状態は 1 コミット遅れで届き、キー付きコントロールはセッションが変わるたびに作り直される:

```tsx
// The draft is filled in after the first commit.
useEffect(() => { setDraftState(initialDraft) }, [])

// The keyed composer unmounts on every session switch.
<Composer service={composerService} key={sessionId} />
```

最初のフレームは空の下書きをレンダリングし、セッション切り替えのたびにフォーカス、選択、入力途中の文字が失われる。

## `useLayoutEffect` は既定ではない

`useLayoutEffect` は既定で使わず、`useEffect` への置換は修正ではない。両者はコードの内容ではなくタイミングが異なるためである。レイアウト測定はまず、なぜここで発生するのか、なぜ CSS で表現できないのか、なぜピクセル測定でなければならないのかに答える。その後初めて、所有するドメインエキスパートの承認を得てインジェクトされた測定フックに移動する。どちらの種類のエフェクトも状態の記録やロジックの束縛を行わない。それは Injection の役割であるためである。

- 判定方法はフック名ではなく目的: エフェクトがどの測定のため、どの束縛のために存在するか。状態記録やロジック束縛のエフェクトは Provider やインジェクトされたフックとして Injection に戻す。3 つの問いに耐えた測定のみが残り、その結果は宣言的なレイアウトパラメーターとして消費される。
- 対象外: 2 つのエフェクトのタイミング差 — `useLayoutEffect` について `@types/react` が DOM 変更後・ペイント前の同期的実行と文書化していること — は背景事実であり、一方を他方に書き換える許可ではない。
- 例外: 保持される `useLayoutEffect` は所有するドメインエキスパートの確認を要し、その変更が確認を記録する。
- 修正方法: レイアウトを CSS で表現する — grid、`aspect-ratio`、コンテナークエリ — または測定をインジェクトされたフック内に集約して 1 つの値を公開する。

レイアウトは CSS で宣言し、問いを生き残った 1 つの測定はインジェクトされたフックに存在する:

```tsx
// Fix 1 — express the layout in CSS and delete the measurement.
// .card { display: grid; grid-template-columns: minmax(0, 1fr) auto; aspect-ratio: 16 / 9; }

// Fix 2 — the approved measurement is injected and returns one value.
function CardBase({ useLayoutMeasurements }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { gutterWidth } = useLayoutMeasurements(ref)
  return <div ref={ref} className={s.card} style={{ '--gutter': `${gutterWidth}px` }} />
}
```

下の最初の 2 つのエフェクトは誤った問い — どちらのエフェクトを使うか — に答えており、3 つ目は束縛をエフェクトに置いている:

```tsx
// A synchronous pixel measurement the design did not need.
useLayoutEffect(() => { setHeight(ref.current.getBoundingClientRect().height) }, [])

// The same measurement with the hook name swapped.
useEffect(() => { setHeight(ref.current.getBoundingClientRect().height) }, [])

// Logic binding parked in an effect instead of Injection.
useEffect(() => { bindShortcut(handler) }, [])
```

改名はレイアウト問題を残したままにし、測定された高さは選択したエフェクトに依存するようになり、ショートカットは Injection 経由ではなく 1 レンダー遅れで束縛される。

## エフェクトはレンダーから導出できるデータを親に押し戻さない

エフェクト本体は、コンポーネントがすでに持つプロップや状態からレンダー中に決定できるデータを、プロップやスロットプロップ経由で届いたセッターを呼んで親に押し戻すことは決してない。そのような押し戻しは 2 回目のレンダーを要し、親は最初のフレームで値を欠き、以後の状態変更はすべてレンダーカスケードになる。値はレンダー中に決定する、ホストはレンダー時チャネル経由で受け取る、またはユーザー操作がハンドラー内で自身の状態を更新する。

- 判定方法: プロップやスロットプロップ由来のセッターがエフェクト内部で呼ばれ、その引数が現在のプロップや状態から導出され、外部イベントや購読コールバックによる駆動がないもの。クリーンアップの `return () => setX(undefined)` も同じ違反の一部である。
- レビューで指摘すべき結果: 余分なレンダーパス。親の最初のフレームでの値欠落。メンバー省略時に古くなる依存配列。エフェクト → 親状態 → レンダーのカスケード。子ライフサイクルと親状態の絡み合い。
- 対象外: 真の外部イベント — 購読コールバック、ソケットフレーム、ユーザー操作 — に反応するエフェクトはこのパターンではなく、イベントハンドラーは状態を直接更新してよい。
- 例外: 既定ではなし。例外には所有するドメインエキスパートの確認が必要である。
- 修正方法 (順序付き): 状態がすでにある場所で UI をレンダリングする。ホストがレンダリングしなければならない場合は、レンダー中に値を渡す。状態がエントリ間で共有される場合は、inject フェースまたは宣言済みストアに移動する。

コントロールは状態がすでにある場所でレンダリングされ、共有バリアントはレンダー中に読み取られ、書き込みは操作ハンドラーに残る:

```tsx
// 1. Render it where the state already lives; no channel is needed.
return <Button onClick={() => setShowOriginal((v) => !v)}>{label}</Button>

// 2. The host renders it: the flag is declared state, read during render
//    and written only from the gesture handler.
const { showOriginal } = useStore()
const { toggleOriginal } = actions
return <Button onClick={toggleOriginal}>{showOriginal ? rendered : source}</Button>
```

`label` と `disabled` はレンダーから導出できるため、エフェクトから親のセッターを呼ぶと親は 2 回レンダーし、最初のフレームでもヘッダーを欠く:

```tsx
useEffect(() => {
  setHeaderAction({ label, disabled, onClick })   // render-derivable data pushed up
  return () => { setHeaderAction(undefined) }
}, [label, disabled, setHeaderAction])
```

親は最初のパスで得られたはずのデータのために 2 回レンダリングし、ヘッダーは 1 フレーム遅れて現れるか点滅し、手書きの依存リストが公開タイミングを決める。

## ビルドとスタイルは所有者に従う

クライアントパッケージのビルド調整はすべてそのパッケージの tsdown プラグイン経由で行い、パッケージは独自のビルド分岐を育てない。スタイルは CSS Modules 経由で行い、インライン化するのは画像、GIF、SVG のみである — JSX ではなく CSS にインライン化する。大きなテキストは TSX にインラインで現れることは決してなく、`style` オブジェクトはランタイム計算値のみを保持する。静的値とスタイルバリアントは CSS Module クラス名に属するためである。

- 判定方法: tsdown プラグインではなくパッケージ内部の新しいビルド分岐。フィーチャースタイルにおけるリテラル色、コンポーネントライブラリ、Tailwind。TSX 内の base64 データや大きなテキスト。静的値やバリアント切り替えを運ぶ `style` オブジェクト。
- 対象外: 測定されたガターや進捗割合のようなランタイム計算値は `style` に入ってよく、コンポーネントローカルのカスタムプロパティはレイアウト値を運んでよい。トークン、CSS Module、クラス名ルールは [Component rules](../web-styling.md#component-rules) が所有する。
- 例外: 新しいビルド分岐や新しいインライン形式は、着地前にレビューで説明し、所有するパッケージのルールが残留可否を決める。
- 修正方法: バリアントを `className` で切り替える CSS Module クラスに移動し、base64 はビルドチェーンが生成する CSS に保持し、TSX モジュールから大きなテキスト定数を削除する。

コンポーネントはクラス名とデータ属性を切り替え、CSS Module が表示を所有する:

```tsx
import s from './card.module.css'

// Style variants are class names, not style-object branches.
export function Card({ active, tone, children }: Props) {
  return (
    <div className={clsx(s.card, active && s.active)} data-tone={tone}>
      {children}
    </div>
  )
}
```

大きなテキストとインライン化されたバイナリデータがモジュールに入り、`style` オブジェクトはテーマが上書きできないバリアントをエンコードする:

```tsx
const HUGE = '...several KB of text...'   // large text inline in the module

// A variant switch and an inlined asset both sit in the style object.
<div style={{ color: toneColor, backgroundImage: `url(${AVATAR_DATA_URL})` }} />
```

バンドルは CSS とアセットに属するテキストとバイナリデータを運び、差分は読めない塊を運び、テーマ上書きはその色に届かなくなる。

## キーは何を識別するかを明示する

`key` は要素が表すエンティティやインスタンス — たとえば 1 つのセッション内で一意な `turnId` — を名指す場合にのみ渡し、その同一性を明示する。ほとんどのリストはすでに安定したビジネス ID を持ち、追加のキーは不要である。警告を黙らせるための発明キーやレンダー順をエンコードするキーは、データが持たない同一性を主張する。配列インデックスはその同一性には決してならない。挿入や削除で後続の全項目が別要素にずれるためである。

- 判定方法: 項目の同一性を位置で表せるか安定 ID で表せるか。キーを渡す場合、その変更は何が一意性を生むかを明示し、可変リスト上の `key={index}` は不合格である。
- 対象外: リスト項目がキーを持つという React 自身の要件は依然適用される。そのキーは項目の安定したビジネス ID であり、その横の第 2 のキーではない。
- 例外: なし。通常の変更に承認は不要であるが、共有コンポーネントのキー意味はレビューで明示する。
- 修正方法: エンティティの安定 ID を使い、2 行が真に 1 つの ID を共有する場合はインデックスをキーに混ぜるのではなく ID 発行元を修正する。

キーはターンの固有 ID であり、セッション内での一意性が要素の表す同一性である:

```tsx
// turnId is unique inside a session; the id is the identity.
export function TurnList({ turns }: Props) {
  return (
    <ol>
      {turns.map((turn) => <TurnRow key={turn.turnId} turn={turn} />)}
    </ol>
  )
}
```

インデックスは同一性の代理であるため、リスト変更時に後続の全行が同一性を変える:

```tsx
// The index stands in for identity.
{items.map((item, index) => (
  <Row key={index} data={item} />
))}
```

挿入や削除の後、後続の各行は新しいデータ上で以前の状態を保持するため、展開済み行や編集中の内容が誤った項目に現れる。

## 共有層はそれぞれの分離度を保つ

フィーチャーは要件を自身のパッケージ内で吸収し、共有コードから保つべき分離の程度は、そのコードが属する共有層によって決まる。探すべき違反は、共有層に置かれたフィーチャー固有の概念である。他のすべての利用者が自分とは無関係な概念を理解しなければならず、その分岐は撤回困難になるためである。

| Shared code | Isolation a feature keeps |
|---|---|
| `ui-primitives`、カタログ化されたコントロール | カタログ化されたコントロールを利用する。新しいコントロールはフィーチャーパッケージで開始し、第 2 の利用者が必要になったときにのみ共有カタログに昇格する。 |
| `ui-layout` とシェルレイアウト | 利用する。フィーチャーパッケージでラッパー、上書きスタイル、層追加により適合させる。 |
| `ui-renderer` とその他のレンダー機構 | ビジネスコードからの値依存はなし。文書化された登録シーム — スロット、provide/inject 束縛フック、宣言済みストア — 経由でのみ拡張する。 |
| 他のフィーチャープラグイン | 値のランタイムインポートも再エクスポートもなし。UI はスロット経由、振る舞いはインジェクトされたサービス経由で越境する。共有ランタイムコードは `client/store`、`ui-primitives`、ブラウザーセーフなユーティリティーパッケージのような狭い静的所有者に存在する。 |
| データオブジェクト層（`client/connection`、`session-controller/client`、`client/store`） | 文書化された面経由で読む。フィーチャー固有の概念はこれらのオブジェクトやストアに入らない。 |
| フィーチャー自身のパッケージ | 無制限 — 要件は自身の行、順序、表示を含めここで吸収する。 |

- 判定方法: 差分がフィーチャー自身のパッケージ以外の層にフィーチャー固有の分岐、フィールド、概念を置くかどうか。
- 対象外: フィーチャーが所有するコード、および 1 フィーチャーの需要ではなく真に一般的な共有層への変更。
- 例外: 共有層の変更は所有するドメインエキスパートの確認を伴い、すべての利用者をリグレッションする。GUI 変更は [packages/client/AGENTS.md](../../packages/client/AGENTS.md) の最小チェックを実行する。
- 修正方法: 要件をフィーチャーパッケージ内で吸収する。または需要が真に一般的な場合は、所有者の承認を得て独自変更として共有層に昇格する。

フィーチャーは行レンダリングと順序規則を所有し、ベースコンポーネントは変更せず利用する:

```tsx
// The feature owns its rows; the base is consumed, not edited.
// packages/client/ui-workspace/src/client/rows/WorkspaceBrowser.tsx
export function WorkspaceBrowser({ rows, onArchive }: Props) {
  const ordered = [...rows].sort((a, b) => Number(b.archived) - Number(a.archived))
  return (
    <ul>
      {ordered.map((row) => <WorkspaceRow key={row.id} row={row} onArchive={onArchive} />)}
    </ul>
  )
}
```

ベースコンポーネントは 1 フィーチャーの順序規則を学ぶため、すべての利用者が自分とは無関係な概念を継承する:

```tsx
// ui-layout: the base learns one feature's ordering rule.
export function BrowserList({ rows, ...rest }: Props) {
  const ordered = [...rows].sort((a, b) => Number(b.archived) - Number(a.archived))
  return <ul {...rest}>{ordered.map((row) => <Row key={row.id} row={row} />)}</ul>
}
```

`ui-layout` の他のすべての利用者は、1 フィーチャーだけが持つアーカイブ概念を理解しなければならず、その分岐の撤回はそれらすべての監査を意味する。
