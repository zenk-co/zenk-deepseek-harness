---
description: "プロバイダー中立のモデル呼び出しサービス。リクエストのストリーミング、プロバイダーアダプターの登録、モデルメタデータの解決を行うユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-llm

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`@deepseek-ai/dsh-llm` は、設定済みのプロバイダーアダプターを通じたモデル呼び出しのストリーミング、モデルのディスカバリー、モデルケイパビリティと呼び出しデフォルトの解決に使う。呼び出し元は、モデル可視のすべての入力をセッションログから再構築可能に保たなければならない。ループが構築したリクエストは深く凍結された状態で到着するため、拡張とアダプターがそれらを書き換えることはできない。各ストリームは 1 回のプロバイダー試行である。プロバイダー固有の変換はそのアダプターに留まり、失敗したリクエストの再実行はオプションの `@deepseek-ai/dsh-llm-retry` パッケージが担う。ストリームは常に終端結果で終わるため、呼び出し元は成功、失敗、キャンセルを一貫して扱える。

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

`listModels` はカタログ駆動のインターフェースが提供するモデルを記述する。コアの解決とストリーミングは、カタログにない id も依然として受け入れることができる。GUI では選択と送信にカタログメンバーシップが必要であり、GUI での使用を意図したアダプターは `listModels` を実装して利用可能なモデルを広告しなければならない。基本実装は空のリストを返すため、GUI 向けのモデルを提供しない。

モデルプロバイダーを呼び出すあらゆるコンポジション — エージェントループ、セッションタイトル生成器、コンパクション要約器 — は、このサービスを通じてリクエストをストリームする。少なくとも 1 つのプロバイダーアダプターと一緒にマウントする。サービス自体には設定もプロバイダーの wire コードもない。

### 選ぶべきとき

プラグインやコンポジションがモデルを呼び出す必要があるときは常にこのパッケージを選ぶ。プロバイダーアダプターへの唯一のサポートされた経路であり、ループ、セッションログ、すべてのコンシューマーにわたって単一の語彙を保つ。プロバイダー固有の wire の振る舞い (`dsh-llm-deepseek` や `dsh-llm-pi-ai` などのアダプターに属する) や再試行の実行 (`dsh-llm-retry` に属する) が必要なときは、これに頼らない。

### 最小コンポジション

サービスと少なくとも 1 つのアダプターをマウントし、すべてのリクエストでプロバイダーを名前で選択する:

```yaml
- name: '@deepseek-ai/dsh-llm'
- name: '@deepseek-ai/dsh-llm-deepseek-api-key'
  config:
    apiKeyEnv: DEEPSEEK_API_KEY
```

ストリームはトークンレベルのチャンクを返し、常に 1 つの終端 `finish` チャンクで終わる。`BlockAssembler` はチャンクをコンテンツブロックとメッセージに変換し、`AssistantStreamAccumulator` はそれらの正確なタイムスタンプとトークン境界を、ループが 1 つの永続的な試行決着に埋め込むコンパクトな表現で保持する:

```text
for await (const chunk of ctx.llm.stream({
  provider: 'deepseek-official',
  model: 'deepseek-v4-flash',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
})) {
  // chunks: block-start, text-delta, ..., usage, finish
}
```

マウントが成功すると、`ctx.llm.listProviders()` は登録済みのルートを登録順に報告する。

`GenerateOptions.messages` は永続 `Message` 値とリクエスト専用の `RequestUserInput` 値を受け入れる。リクエスト専用入力は `id` も `source` も持たない user ロールのコンテンツを運ぶ。セッション書き込みとエージェントデリバリーには依然として永続メッセージが必要である。呼び出し元はストリームが決着するまで補助入力を変更しない。セッションタイトル生成のように自身の正確なリクエストを記録する呼び出し元は、永続メッセージを使わなければならない。

`prepareCall(config, signal, configure?)` は具象 `LlmCallConfig` 値を受け入れる。オプションの同期的で純粋な `ConfigureCall` 関数は、捕捉されたアダプター世代からの切り離された深く凍結された `LlmCallControls` とモデルメタデータを受け取る。呼び出し元は通常の関数を合成して具象コントロールを選べる。後からの書き込みが先のものを置き換える。準備は捕捉されたルートを保持し、省略されたコントロールにデフォルトを適用し、結果を検証し、記録とディスパッチのための凍結された設定を返す。コールバックの失敗またはキャンセルはディスパッチ前に拒否する。準備には登録済みアダプターが必要である。

設定関数はアダプターのデフォルトがマテリアライズされる前にコントロールを選択する。例えば、最小エフォート選択と明示的な出力上限を組み合わせ、`configure(maxTokens)` を第 3 引数として渡す:

```ts
import type { ConfigureCall } from '@deepseek-ai/dsh-llm'

const leastReasoning: ConfigureCall = (controls, model) => {
  const first = model.reasoning?.efforts[0]
  return first === undefined ? controls : { ...controls, reasoningEffort: first.id }
}

const outputLimit = (maxTokens: number): ConfigureCall =>
  controls => ({ ...controls, maxTokens })

const configure = (maxTokens: number): ConfigureCall =>
  (controls, model) => outputLimit(maxTokens)(leastReasoning(controls, model), model)
```

### できること

- **1 つのモデル呼び出しをストリームする** — `ctx.llm.stream(options)` は、登録済みの任意のプロバイダーとモデルに対して生のチャンク (トークンレベルのデルタ) を yield する。コンシューマーは `BlockAssembler` でそれらを組み立てる。
- **プロバイダーアダプターを登録する** — アダプターは 1 つ以上のプロバイダールートを所有し、その登録がそのルートの再試行ポリシーを捕捉する。同じルートを 2 回登録すると `DUPLICATE_ADAPTER` で失敗する。
- **設定を通じてプロバイダーを公開・有効化する** — アダプターは設定可能プロバイダーのルートと設定名前空間を宣言するので、設定サーフェスは再起動なしに休眠中のプロバイダーを有効化し、接続情報を編集できる。`LlmConfigurableProvider.error` は修復のための設定診断を報告する。影響を受けていないモデルは引き続き利用可能であり続けられる。エントリーは `defaultBaseURL` — プロファイルが何も設定しない場合にアダプターが使うエンドポイント — と、`nativeAuth` — プロファイルが資格情報参照を名指さない場合にアダプターの認証が読む環境変数と OAuth サインイン — を運ぶこともできる。`baseURLEnv` はエンドポイントの設定に使う環境変数を列挙する。設定 UI はアダプターを呼び出すことなく、ディレクトリからこれらのフィールドを読む。
- **モデルをディスカバリーして解決する** — アダプターが広告するモデルを一覧し、エンドポイントが提供するモデルを問い合わせ (候補はオプションの `inputModalities` を運び、欠如は不明を意味する)、1 つの正確なモデルのコンテキストウィンドウ、出力デフォルト、推論エフォート、入力モダリティ、システムプロンプト更新モードを解決する。`LlmResolvedModelInfo.systemPromptUpdate` は、モデルが任意の位置にある最新の `system` メッセージを有効なシステムプロンプトとして読む場合に `'in-history'` であり、先頭のシステムメッセージのみを読む場合は存在しない。`normalizeModelInfo` はそれ以外の値を `INVALID_MODEL_INFO` で拒否する。
- **呼び出し設定を検証する** — 明示的または設定済みの推論エフォートは、プロバイダーの I/O の前に正確なモデルに対してチェックされ、アダプター設定の出力上限は、リクエストが省略したときにマテリアライズされる。
- **埋め込み Assistant ストリームを展開せずに読む** — `assistantStreamFirstTokenTime` (最初のトークン)、`assistantStreamHasVisibleContent` (可視コンテンツの有無)、`assistantStreamHasVisibleText` (可視テキストの有無) は、コンパクトなレコードから早期終了でそれぞれの問いに答える。`lastAssistantStreamChunk` は 1 つの型の最後の生チャンクまで逆方向にスキャンし、`assistantStreamChunks` と `joinAssistantStreamText` はストリーム全体をスキャンし、`assembleAssistantStream` はメンバーごとの展開と同じブロック、usage、リプレイ状態で、1 ランにつき 1 つの結合済みデルタを `BlockAssembler` に供給する。`runFirstTokenTime` と `runFirstVisibleTime` は 1 つのパック済みランに対して早期終了スキャンを行い、`isTokenDelta`、`isVisibleChunk`、`chunkHasVisibleText` は単一チャンクのトークンと可視性のルールを定義する。`expandAssistantStream` は、永続境界で読み取られたレコードの検証経路であり続ける。メモ化されないのは、保持された展開がイベントの生存期間中、コンパクトストリームのおよそ 10 倍のコストを要するためである。

### 失敗と復旧

すべてのストリームは正確に 1 つの終端 `finish` チャンクで終わる。失敗時は `{ kind: 'error', failure }`、キャンセル時は `{ kind: 'aborted', failure }` である。失敗は `NO_ADAPTER`、`MISSING_CREDENTIAL`、`AUTH`、`RATE_LIMIT`、`CONTEXT_WINDOW_EXCEEDED` などの安定したコードを運ぶ。コンシューマーはメッセージ本文ではなくコードでルーティングする。`QUOTA` はプロバイダー中立の枯渇であり、`ACCOUNT_QUOTA` は現在の製品が補充できるファーストパーティのアカウント残高のために予約されている。未登録のプロバイダーを名指すリクエストは `NO_ADAPTER` で失敗し、不正な形式の資格情報は不透明な fetch エラーとして表面化せず `INVALID_CREDENTIAL` で失敗する。このサービスはリクエストを決して再実行しない。再試行はエージェントの失敗ステップ拡張ポイントにおける `dsh-llm-retry` の仕事である。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

この節はサービス背後の設計を説明する。観測可能な振る舞いは[このパッケージを使う](#use-this-package)で完全に扱う。

### 設計方針

このサービスは 1 つの分離の上に成り立つ: **論理契約はプロバイダー中立で、wire はアダプターが所有する。** 正規のメッセージ、コンテンツブロック、ストリームチャンクの語彙を一度だけ定義し、各プロバイダーアダプターは自身の wire フォーマットのみをその語彙へ変換する。レジストリがトポロジーの所有者である — アダプタールート、設定可能プロバイダーエントリー、ディスカバリーオファーはすべてここに登録され、そのファイバーとともに破棄される — 一方で、エージェントループのリクエストはセッションログの純粋関数に留まる。ループが構築したリクエストは深く凍結された状態で到着するので、リスナーとアダプターはそれらを読み、決して書き換えない。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | `LlmRuntime` サービス: アダプターレジストリ、設定可能プロバイダーディレクトリ、モデルディスカバリー、呼び出し準備、ストリーミング境界 |
| [`src/types.ts`](src/types.ts) | `StreamChunk` プロトコル、コンテンツブロックマップ、終了理由、共有語彙 |
| [`src/message.ts`](src/message.ts) | デリバリー、履歴、リクエストで共有される不変メッセージコンストラクター |
| [`src/assembler.ts`](src/assembler.ts) | `BlockAssembler`: チャンクからブロックへの増分組み立て |
| [`src/assistant-stream.ts`](src/assistant-stream.ts) | コンパクトなタイミング付き Assistant ストリームの蓄積、厳密な検証、正確な展開、レコードレベルのリーダー |
| [`src/call-config.ts`](src/call-config.ts) | 呼び出し設定の検証、アダプターデフォルトのマテリアライズ、リクエストの凍結 |
| [`src/retry-policy.ts`](src/retry-policy.ts) | プロバイダー所有の再試行ポリシー解決 (normal モードと always モード) |
| [`src/error.ts`](src/error.ts) | `HarnessError`/`LlmError` 分類とプロバイダー中立の失敗コード |
| [`src/content.ts`](src/content.ts) | 共有のファイル・画像ヘルパー: コンテンツ走査、ファイルプロジェクション、画像オフロードの計算、オフロード済み画像のプロジェクション |
| [`src/api-key.ts`](src/api-key.ts) | すべてのアダプターで共有される資格情報フォーマットチェック |
| [`src/adapter-failure.ts`](src/adapter-failure.ts) | 終端 finish チャンクへの失敗の正規化 |

### メインフロー

リクエストは、その正確なモデルのケイパビリティ — コンテキストウィンドウ、出力デフォルト、推論エフォート、入力モダリティ、`systemPromptUpdate` モード — に対して検証され、アダプター設定のデフォルトがマテリアライズされる。ランタイムは既に凍結された入力の凍結状態を保つ。手で構築する呼び出し元は入力の不変性を自ら所有する。`prepareCall()` はそれらの事実、切り離されたコンテキスト、再試行ポリシーを、終端ディスパッチを行う正確なアダプター世代に束縛するので、HMR や動的設定が、ある世代の画像ケイパビリティと別の世代のエンドポイントを組み合わせることはできない。画像対応アダプターは永続参照をルート固有のリクエストバージョンに投影する。`resolveImageAttachmentAccess()` は、リクエスト画像やその `variantId` を変更することなく、添付プロバイダーのオプションのホストオブジェクトを現在のツール実行ワールドへ別途マップする。テキスト専用ルートは、ツールロールの結果画像を含め、決定論的な画像ごとのプレースホルダーを受け取り、追記専用のセッション履歴を書き換えない。永続 `FileBlock` 参照がアダプターに到達することは決してない。リクエストの組み立てが、ツールロールの結果出現を含む各参照を、ファイルとその保存された読み取り専用パスを名指す決定論的なハンドルテキストに置き換え、それはマウントされた添付プロバイダーとファイルシステムプロバイダーを通じて解決される。`ctx.llm.fileRequestText(ref)` はその正確な同期プロジェクションをリクエスト計測に公開する。`offloaded: true` で導出された画像出現は、`projectOffloadedImages()` を通じてプレースホルダーテキストとしてすべてのルートに届く。保持された出現が正確なバイト数で `LlmImageRequestBudget` を超える画像対応ルートは、追加で最も古い出現を名指す `IMAGE_OFFLOAD_REQUIRED` で失敗し (`requiredImageOffload()`)、ログに記録されないプロジェクションで失敗することはない。`dsh-compaction-image-offload` は選択された出現を 1 つの `image/offload` イベントに記録して再試行する。視覚トークンを課金するアダプターはルートごとの `imageRequestPricing` を宣言し、`ctx.llm.imageRequestPricing(provider, model)` がトークンメーターのためにそれを同期的に解決する。ディスパッチは `llm/stream` waterfall を通り、その後チャンクはトークンレベルのデルタとして戻り、すべてのアダプター結果は 1 つの終端 `finish` チャンクとしてコンシューマーに届く。`imageRequestTarget(provider, model, image)` は同じリクエスト画像の寸法とバイトターゲットをスクリーンショットのコンシューマーに公開する。画像リサイズを行わないアダプターは正規化されたソースをそのまま保つ。

ファイル検出は、メッセージの同一性や凍結状態をキャッシュすることなく、すべてのリクエストで現在のコンテンツ (ツールロールの結果コンテンツを含む) を読む。[アーカイブされたファイルスキャンの決定](../../../.agents/notes/archived/simplification/2026-09-07-file-content-scan.md)が計測された走査コストを記録している。

### 不変条件

- **モデル可視 ⟺ ログ記録済み** — 呼び出し元は、すべてのプロバイダーリクエストのモデル可視入力をセッションログから再構築可能に保たなければならない。ループが構築したリクエストは深く凍結されて到着し、書き換えることができない。
- **リプレイ状態は 1 つのアダプター内でのみ移動する** — assistant リプレイ状態は、同じアダプターインスタンスが過去ルートとターゲットルートを所有する場合にのみ同伴する。そうでなければディスパッチ前に破棄される。
- **準備済み呼び出しはワンショットである** — 準備済み呼び出しは正確に 1 回ディスパッチでき、その呼び出し設定フィールドは準備済み設定と一致しなければならない。
- **画像プロジェクションは捕捉されたルートに従う** — 永続 `ImageBlock` 参照は画像対応モデルのみでルート固有のリクエストバージョンになる。テキスト専用モデルは安定したプレースホルダーを受け取る。
- **ファイルプロジェクションは無条件である** — どのプロバイダーもファイルバイトを受け取らない。すべてのルートが `FileBlock` ごとに 1 つの決定論的なハンドル行を受け取り、モデルは必要に応じて自身のファイルツールで保存されたコピーを読む。
- **プロトコルの順序** — `usage` は `finish` より前にあり、ツール引数は生の JSON 文字列のままであり、終端 `finish` の後に何も続かない。
- **レジストリの変更はアトミックである** — ルートとディレクトリの登録は、何かが動く前に候補集合全体を検証するので、拒否された変更は以前の状態を提供し続けたままにする。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときにこれらのページを読む。共有型から、具象アダプター、再試行エグゼキューター、計測サービスへ進む。

- [LLM ストリーミングサブシステム](../../../docs/subsystems/llm-streaming.md) — メッセージとブロックの型、コンパクトな Assistant ストリームレコード、`StreamChunk` プロトコル、アダプター契約。
- [llm-deepseek アダプター](../llm-deepseek/README.md) — 直接の DeepSeek Messages 実装。
- [llm-pi-ai アダプター](../llm-pi-ai/README.md) — pi-ai をバックエンドとするマルチプロバイダー実装。
- [llm-retry](../llm-retry/README.md) — 失敗したモデルリクエストを再実行する再試行エグゼキューター。
- [トークンメーター](../token-meter/README.md) — リプレイを考慮したリクエストとコンテキストの圧力計測。
- [ツイン LLM アダプター](../../../.agents/notes/implemented/architecture/2026-06-13-twin-llm-adapters.md) — DeepSeek ルートが構造的に異なる 2 つのアダプターを出荷する理由。
- [終端 LLM ストリーム失敗](../../../.agents/notes/implemented/architecture/2026-07-29-terminal-llm-stream-failures.md) — モデルリクエストの結果とプラグイン失敗の間のサービス境界。

-----

<a id="model-experience"></a>
## モデル体験

なし。LLM サービスはコンテンツを追加しない。アダプターが、このパッケージがエクスポートする共有画像記述子と画像ごとのプレースホルダーをいつ追加するかを選ぶ。

#### KV キャッシュへの影響

推論エフォートのマテリアライズは、組み立て済みのリクエストプレフィックスを保つ。画像の同一性とリクエストプレビューテキストは決定論的であり、オプションの実行ワールドパスはリクエストごとに解決される。パスが変わった場合やオフロードの決定は、その画像からの再利用を妨げることがある。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このサービスがどこで止まり、他のパッケージや将来の作業がどこから始まるかを定義する。それらは現在のパッケージ制約であり、タスクバックログではない。

- **このサービスには再試行の実行、キャッシュ、レート制限は出荷されない** — プロバイダー登録は再試行ポリシーを保存するが、ストリームは 1 回のプロバイダー試行のままである。`@deepseek-ai/dsh-llm-retry` が永続エージェントステップ境界でポリシーを実行する。
- **`GenerateOptions` のサンプリングは `temperature`/`maxTokens`/`stop` のみ** — `tool_choice`、`top_p`、ペナルティのフィールドはない。語彙はプロデューサーが着地したときに拡大する ([削除された不活性ノブ](../../../.agents/notes/archived/simplification/2026-07-04-drop-inert-request-knobs.md))。
- **バリアントは通常プロデューサーを必要とする** — `prefill`、ツールごとの `strict`、ブロック `cache` ヒント、`agent` メッセージソースバリアントにはプロデューサーがない ([Agent Note](../../../.agents/notes/archived/simplification/2026-07-04-prune-producerless-vocabulary-variants.md))。
- **`BlockAssembler` はコアのブロック種別のみを扱う** — ストリームが `block-end` で閉じられないプラグイン追加のブロック型は `blocks()` を throw させる。
- **`GenerateOptions.sessionId` はローカルに宣言されたブランドである** — dsh-session の `SessionId` をインポートすると依存サイクルが生じる。
- **ツール更新にはセッション履歴が必要である** — `GenerateOptions.tools` はアクティブな定義を含む。`toolHistory` は `Session.toolHistory()` からの初期宣言と歴史的に解決された追加を供給する。アダプターディスパッチ時に、`projectToolUpdates` は遅延宣言を構築し、`in-history` のために削除された定義を保持する。`addition-only` は削除された定義と削除メッセージを省略する。サポートされないルートは、developer メッセージや `deferLoading` なしでアクティブツールを受け取る。履歴が欠落している場合や、リクエストプレフィックスが記録済みの更新を省略している場合は、developer メッセージなしの現在の宣言にフォールバックする。明示的に遅延されたベースラインツールは、最初の保持された追加ブロックまで遅延されたままである。遅延ツールを宣言しても有効化されない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発者ノートは権威を持たない作業コンテキストである。未解決の問いと未決定の方向性を記す。出荷済みの振る舞いと受け入れられた根拠は、上の各節、パッケージコード、リンクされた Agent Note にある。

#### 未解決項目

- `GenerateOptions.sessionId` はローカルに宣言されたブランドである。dsh-session の `SessionId` をインポートすると依存サイクルが生じるためであり、将来 id を所有するパッケージがこの回避策を解消できる。
- 推論エフォートの識別子はアダプター所有の不透明な文字列で、各アダプターが広告する集合に対してのみ解決される。アダプター間で共有するエフォート語彙は決定されていない。
- `llm/adapters-updated` イベントは設計上ペイロードを持たない。コンシューマーはイベントで新しいトポロジーを受け取る代わりに、レジストリを読み直す。

</details>
