# 防御的パターン

日本語 | [English](general.en.md) | [中文](general.zh.md)

苦労して得たバグクラスのルール: 以下の各パターンは、ここで実際に出荷された、または出荷されかけた欠陥のクラスであり、その再発を防ぐルールとして述べられている。ライフサイクル、並行性、サブプロセス、またはティアダウンのコードを書く前にこれを読むこと。テスト層の対応物(実際のエントリパス、世界の検証、リソースの所有権)は [testing.md](../testing.md) にあり、これらのルールが参照する型レベルの定義は [subsystems/](../subsystems/README.md) にある。

## 直交する結果は独立して報告する

1 つの結果は同時に複数のものでありうる — プロセスはシグナルを捕捉したためにタイムアウトしつつ exit 0 することがある。各独立した事実(`timedOut`、`signal`、`exitCode`)をそれぞれ単独で表面化する。あるフラグの報告を別の分岐の内側に入れ子にしてはならない。そうしないと、呼び出し元は途中で切られた実行をクリーンな成功として読む。

レビュアーは kill の仕組みではなく報告の形を確認する: 各事実は独立して真になりうるか、それぞれが別の条件の分岐に入らずに読めるか？ 境界は報告である — プロセスにどうシグナルを送るか、どれだけの時間を与えるかは別の決定である。

## 公開契約は両側で守る

実装が 1 つの結果の複数の表現を受け取る場合、公開 API を通じて返す前にそれらを正規化する。`LlmAdapter.stream()` の実装は throw するか `finish {kind:'error'|'aborted'}` を発行する可能性があるが、`LlmRuntime.stream()` はモデル要求の失敗を終端の finish チャンクとしてのみ公開し、ミドルウェアとコンシューマーの欠陥は throw されたままである。これにより、コンシューマーは捕捉した例外がプロバイダー、ラッパー、チャンクログ、自らの組み立てのどれに由来するかを推測せずに済む。正規化された契約はその型が定義されている場所に文書化し、すべてのソース形式を実際のコンシューマーを通じて検証する。

判定条件: コンシューマーが公開 API だけから失敗の出所を名指しできるか。内部ヘルパーは自由に throw してよい。この要件はコンシューマーが越える境界を拘束するのであり、その背後のすべての関数を拘束するのではない。

## 非同期状態は同期状態ではない

`agent.followup()` にはメッセージ単位の完了や結果がない。バックグラウンドジョブの完了はターン境界と競合する。`reader.close()` は EOF と破棄の両方で発火する。`agent/status` や `whenIdle()` を 1 つのフォローアップの結果として扱ってはならない。キューに入った複数のフォローアップ、steering、注入された作業が 1 つの `running` 区間を共有することがあり、キャンセルや破棄は未開始の項目を捨てることがあるからだ。実行を真に所有する自動化の呼び出し元は、その区間を明示的に定義しなければならない — 例えば、そのメッセージの永続インボックス受領から次のエージェント全体の `idle` まで — 、選択した出力はそのメッセージに因果的に帰属させるのではなく区間全体のものとして記述する。このガードは両刃である: 待機する遷移が決して起こり得ない場合、待機はハングするため、「待つものが何もない」分岐を明示的に処理する。

判定条件: エージェントが API の定義しないユニット単位の完了を観測できるか。区間が真に呼び出し元に属する場合、区間と出力範囲を述べるのは呼び出し元である。共有の `running` フラグがその記述になることは決してない。

## タイミングは正しさを担わない

正しさは明示的な呼び出し点と明示的な状態から来るのであって、コールバックがイベントループのどこに着地するかからは決して来ない。作業が正しいかどうかを決める `microtask`、`setTimeout`、`queueMicrotask` はプログラムの残りと競合する: 軽い負荷では成り立ち、高負荷時やバッチングが変わったときに黙って失敗する。React のコードも同じルールに従う — effect は、設計が明示すべきだった「レンダー直後」の順序付けを決して供給しない。

判定条件: 正しさが、名前付きの呼び出し点や状態機械ではなく「そのコールバックがすでに実行された」に依存しているか。2 つの境界: テストのタイムアウト予算は失敗を待つものでありタイミング依存の正しさではない、またユーザー可視の作業のテンポを取るだけの意図的な遅延はこのルールの対象ではない。開発者側の例外はない。タイミング技法への真の必要性はドメインオーナーに持ち込む。

```ts
// The order is written into the code: dispose the old store, then build its successor.
declare let store: { dispose(): void }
declare function createStore(scopeKey: string): { dispose(): void }
declare const scopeKey: string

store.dispose()
store = createStore(scopeKey)
```

```ts ignore-check
queueMicrotask(() => { if (!ready) refresh() })   // assumes the microtask runs before the next frame
setTimeout(() => setMounted(true), 0)             // waits for a render that was never sequenced
```

誤った形は断続的に失敗する: 落とされた refresh、または決して同期しない状態として、負荷時にのみ再現する。

## オプション入力は両方の動作を述べる

オプションのパラメーターは、それが存在するときと存在しないときに呼び出し先が何をするかを述べるため、呼び出し元は防御的演算子から一方を推測するのではなく、契約から両方の動作を読む。`?.` の蓄積はそのシグナルである: 各 `?.` は、そのフィールドがそもそも存在すべきかについての決定の代用になっている。

判定条件: `?.` が、既知の値上の真にオプションのホップを扱うのではなく、フィールドが存在するという決定を置き換えているか。この要件はインターフェース契約を拘束する: 両方の分岐が戻り値と副作用を述べ、呼び出し元は契約からそれらを読む。例外チャネルはない — 両方の動作を述べられない呼び出し箇所はレビューのブロッカーであり、スタイルの好みではない。

```ts
// Both behaviors are in the contract: no options object means "unknown", not "skip".
interface ResolveInput { options?: readonly string[] }
type Resolution = { kind: 'unknown' } | { kind: 'value'; value: string }

function resolve(input: ResolveInput): Resolution {
  if (input.options === undefined) return { kind: 'unknown' }
  return { kind: 'value', value: input.options.join(',') }
}
```

```ts ignore-check
const value = a?.b?.c?.d ?? fallback   // four layers of fallback hide whether d should exist
```

誤った形は契約を曖昧なままにし、エラーを飲み込むため、次の呼び出し元がさらにフォールバックを重ねる。

## 1 つの値は 1 つの事実を述べる

不明な値、空のコレクションまたは文字列、真に存在しないフィールドは 3 つの異なる事実であり、3 つの表現を取る。1 つの `undefined` や `null` がそれらのいくつかを代表することは決してなく、それぞれに異なる動作をしなければならないコンシューマーは、境界でそれらを潰すのではなく明示的に区別する。

判定条件: 単一の「値なし」が複数のセマンティクスを持ち運んでいるか: まだ問い合わせていない、問い合わせて空だった、決定できない。判別可能なユニオンまたは明示的な enum 値が通常の実装であり、その型が定義されている場所([core.md](../subsystems/core.md#repo-wide-type-patterns))に文書化される。

```ts
type ValueState<T> = { kind: 'unknown' } | { kind: 'empty' } | { kind: 'value'; value: T }
```

```ts ignore-check
return null   // means "not queried", "queried, nothing there", and "cannot tell", all at once
```

誤った形は、呼び出し元がケースを区別できなくするため、UI 状態、キャッシュポリシー、リトライの決定がすべて誤る。

## 新しい active/current シングルトンは拒否される

新しいグローバルな `active` または `current` シングルトンは導入せず、既存のものは移行して排除する。グローバルに一意な選択は、このコードベースがしない設計上の表明である: 1 つのデータの複数のビューが、それぞれ独自の参照またはキーを持つ。

判定条件: その変更がグローバルに一意な選択状態フィールドを導入しているか。置き換えの形は、1 つのデータの上に複数のビューがあり、各ビューが独自の参照を持つものである。デフォルトの例外はない。概念がサービスごとに 1 回真に存在する場合、`inject` を通じて表現されるサービスまたはインスタンスのフィールドがそれを持ち運び、モジュールレベルのフィールドは決して持たない。

```ts ignore-check
// Each view holds the key it renders; nothing global decides what is "current".
function ConversationView({ sessionKey }: { sessionKey: SessionKey }) { /* … */ }
```

```ts ignore-check
let activeTabId: TabId | undefined   // module-level; every component reads the same one
```

誤った形は、独立したインスタンス同士を干渉させ、どのビューがフォーカスを所有するかをレビュアーが監査できなくする。

## 共有状態には 1 つのオーナーがいる

共有状態はサービスまたはインスタンスに掛かり、そのオーナーはライフサイクルを持つ名前付きのオブジェクトである。モジュールレベルのキャッシュ、シングルトン、グローバル `WeakMap`、または `Symbol.for` / `globalThis` / `window.__X__` のバイパスは、そのオーナーを隠し、あらゆるティアダウンより長生きする。

判定条件: その値を所有するサービスまたはインスタンスを名指しせよ。オーナーを名指しできない場合、実装の前にオーナーを決める。境界は、サービスまたはインスタンス上のフィールドを任意の数の注入されたコンシューマーが読んでよいことであり、その値をドメイン間で渡す場合はグローバル名前空間ではなく既存のインターフェースを通る。デフォルトの例外はない。グローバルなルックアップキーへの真の必要性は、その回収ポリシーとともにドメインオーナーに持ち込む。

```ts
// The shared value hangs on the session service instance; consumers inject it.
interface Sessions { readonly current: string }
declare const ctx: { get(name: 'sessions'): Sessions }

const sessions = ctx.get('sessions')   // one owner, lifetime tied to the service
```

```ts ignore-check
globalThis.__dshCache = new Map()   // shared across instances, reclaimed never
```

誤った形は、インスタンス同士が上書きし合うことを許し、回収のタイミングを知り得なくし、テスト間で状態を漏らす。

## ビジネスケイパビリティは自らを所有する

ビジネスケイパビリティは独自のパッケージに住み、登録サーフェス — レジストリ、`slots.inject`、ウォーターフォール、またはイベント購読 — を通じてアタッチする。ランタイム、コントローラー、マネージャー、またはゲートウェイは汎用的なオーケストレーションを持ち運ぶ: レジストリ構造と破棄ライフサイクルを保持してよいが、エントリはそれらを所有するパッケージが書き、ビジネス行の中央テーブルをハードコードすることは決してない。

判定条件: ケイパビリティが自らを宣言・登録し、中央層はビジネス上の決定を行うのではなく転送とライフタイム管理のみを行うか。境界は、中央層がレジストリ構造と破棄ライフサイクルを保持し、エントリは所有パッケージから来ることである。1 つの例外: 純粋なインフラストラクチャ — ログ、トランスポート、ストレージ — はビジネス登録サーフェスを通じてアタッチしない。中央層の新しい分岐は、なぜ所有パッケージに住めないのかを説明しなければならない。

```ts
// The business package registers its own slot and handlers in its apply.
interface Slots {
  inject(name: string, register: () => void): void
  register(name: string): void
}
interface Context { readonly slots: Slots }

export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.footer', () => ctx.slots.register('conversation.footer'))
}
```

```ts ignore-check
if (pluginName === 'ui-attachment') { /* business branch inside the manager */ }
```

誤った形は、新しいケイパビリティごとに中央層を編集させることになり、中央層が変更のボトルネックとコンフリクトのホットスポットになる。

## 変更にはパフォーマンスの証拠を添える

ホットパスのコストを動かしうる変更は、触れたコードを変更前後で測定し、数値をその条件とともに報告する。3 つの指標はランタイム、ピークメモリ、定常状態メモリであり、1 つの環境で 1 つの入力に対して測定する。粒度は変更されたパスであり、マシン全体のスコアではない。「全体として遅くなっていない」という報告は証拠ではなく、他の場所で改善したパスはここのリグレッションを免罪しない — 最適化された初回描画も `append` について説明しなければならない。

判定条件: 1 つの環境と 1 つの入力の下で、3 つの指標のいずれかが変更されたパスで有意に悪化していること。

ベースラインは、測定対象の変更なしの同じパスである — 通常は測定フックを持たないネイティブ実装であり、以前の実装ではない。両側に同じフックを付けて新旧を比較すると、差が薄まって消える: 両側が同じオーバーヘッドを払うため、測定は「変化なし」を報告する一方で両方とも遅い。

測定は [benchmarks/](../../benchmarks/AGENTS.md) が所有し、測定されるユーザーパスごとに 1 ディレクトリで、そのシナリオがエントリポイントである:

```sh
# Run the owning scenario before and after the change; the numbers go into the PR.
pnpm run test:bench
```

パッケージローカルの診断は `.perf.ts` サフィックスを付けてそのオーナーの隣に留まり、`test:bench` には加わらない。CI ゲートは `pnpm run check:ci:bench`(ジョブ `node 24 / benchmarks`)で、スケーリングされたレポートを発行する — そのゲートはアラートであり、合格ではない: そこのリグレッションは、所有シナリオを再実行し、ローカルでセグメントをプロファイリングして、どの部分が遅くなりどの変更がそれを導入したかを見つけることで特定する。保持メモリの主張には `pnpm run test:bench:memory 4g|8g` を使用する。これはスワップなしの cgroup 内で変更されない予算の下、リストされたファイルを再実行する。

境界: ランタイムパスに触れない編集 — コメント、ドキュメント、テスト専用コード — は測定を必要とせず、プロダクションのパフォーマンスコードは、機会があれば削除すべきベンチマーク計装ではない(`performance.now()` と `scheduler.yield()` はプロダクションの decode と encode のチャンクスケジューリングの一部である)。真にパフォーマンスを犠牲にするアーキテクチャ変更は、測定されたコストとその理由を述べ、ドメインオーナーが承認する。「レイヤリングがそれを必要とした」はセルフサービス的な理由ではない。ベースラインを再構築できるよう、コマンド、数値、環境、入力サイズを記録する。

```text
CI benchmark reported green, so the change is accepted as performance-neutral.
```

その形は、ベンチマークがモデル化していないパスに実際のリグレッションを出荷する。

## マイグレーションは動作を保つ

マイグレーションまたはパッケージ分割は、外部から観察可能な動作を等しく保つ: エラーコード、診断、データフローの順序、UI のタイミングを項目ごとに比較する。コードの移動は、削除して書き直すより優先される。書き直しは、どのみちセマンティクスが変わるコードに適しており、その場合変更はその差分を列挙する。パッケージまたはエクスポートパスの変更は動作変更ではなくキャリアの変更であり、動作変更はそれ自体で 1 つの変更である。

判定条件: 変更前後の観察可能な動作の項目ごとの比較。完全な等価が不可能な場合、変更は異なる項目とそれぞれの検証方法を述べ、ドメインオーナーが承認する。マイグレーション中に見つかった欠陥は、移動に折り込むのではなく、それ自体の変更として修正する。

```sh
# The move keeps paths and error codes; the reference updates are the whole diff.
git mv packages/old/src/endpoint.ts packages/new/src/endpoint.ts
```

```ts ignore-check
// The migration silently upgrades the error handling it was only supposed to move.
throw new EndpointError('not found')   // was: return { ok: false, code: 'not_found' }
```

誤った形は動作変更を移動の中に埋めるため、レビューが移転とセマンティクスを分離できず、リグレッションを特定できない。

## Dispose は要求するだけでなく静止に到達しなければならない

kill または abort の後に子の終了を待つ。オプションの通知は早く停止してよいが、完了または最終永続化に必要なリソースとリスナーは、コンシューマーが決着するまで生存しなければならない。[Cordis 所有権チェック](../../.agents/skills/cordis-styling-nitpicking/SKILL.md#p0-cleanup-dependency-released-before-consumer-completion)を参照。

判定条件: ティアダウンが実際の静止を待つのか、要求するだけなのか。境界は、待つべきオーナーのない作業 — デタッチされ観測されないタスク — であり、ティアダウンはそれを追跡する義務を負わない。コンポーネントが開始し、依然として観測できるものは、完了を報告する前に待たなければならない。

## ディスパッチャーでコールバック例外を封じ込める

各リスナーの例外を捕捉して報告し、dispatch の Promise を reject したり後続のリスナーを枯渇させたりしない。リスナーのオーナーは、[エラーハンドリングルール](../../.agents/skills/dsh-error-handling/SKILL.md#catch-recover-or-stop)の下で自身が変更する状態を処理しなければならない。捕捉だけでは状態は復元されない。

判定条件: throw するリスナーが dispatch の Promise を reject できるか、または後続のリスナーの実行を妨げられるか。境界は呼び出し元自身の await である: ディスパッチャーがそれを要求した操作へ意図的に伝播するエラーは、封じ込めの失敗ではない。

```ts
async function dispatch(listeners: ((event: string) => Promise<void>)[], event: string): Promise<void> {
  for (const listener of listeners) {
    try { await listener(event) } catch (error) { console.warn('listener failed', error) }
  }
}
```

## 信頼できない出力に周囲の環境や予測可能なパスを渡さない

スポーンされるコマンドはスクラブされた環境変数を受け取る(`*KEY*`/`*SECRET*`/`*TOKEN*`/`*PASSWORD*` を除外する)ため、harness の資格情報が出力、`env`、またはスピルファイルに漏れることはない。一時/スピルファイルはプライベート(0700)ディレクトリ、ランダム名、オーナー専用の排他オープン(`'wx'`、`0o600`)を使用する — 世界から読める予測可能なパスはシンボリックリンク競合と開示を招く。

判定条件: スポーンされたプロセスが周囲の環境を継承するか、別のプロセスが予測して置き換えられる場所に書き込むか。境界は、外部入力のない信頼されたプロセス内コードであり、このルールはそれを統治しない。

## リンク形状のパスは unlink する

シンボリックリンクまたは Windows ジャンクションである可能性のあるパスは、`lstatSync().isSymbolicLink()` の後 `unlinkSync` で削除する: unlink はリンクのみを削除し、実ディレクトリを拒否するため、リンクをたどってそのターゲットに入ることは決してない。Windows の `rmSync(link)` はジャンクションで `ERR_FS_EISDIR` を throw する。再帰的削除はジャンクションを通じてそのターゲットへ降りていく可能性がある。再帰的な `rmSync` は既知の実ディレクトリ用に取っておく。

判定条件: 削除プリミティブがリンクをたどってそのターゲットに入りうるか。境界は、コード自身が所有するディレクトリ内で自ら作成したパスであり、そこでは素の再帰削除がすでに安全と分かっている。
