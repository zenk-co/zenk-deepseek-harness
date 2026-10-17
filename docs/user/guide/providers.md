# モデルを構成する

日本語 | [English](providers.en.md) | [中文](providers.zh.md)

このガイドは、[ルート README](../../../README.md#run)を通じて Web UI を起動したことを前提とする。モデルの変更はサーバーを再起動することなく次のリクエストで有効になる。

## DeepSeek を構成する

**Settings → Models** を開く。DeepSeek カードは API キーフィールドを 1 つ公開する。キーを入力して保存する。

![Models ページ: DeepSeek カードと、その下の Add model provider](providers-models-page.png)

キーは書き込み専用である。ページは保存後にリダクトされた記述子を受け取り、生のシークレットを受け取ることはない。キーは `$DSH_HOME/.credentials.yaml` に保存され、設定はその資格情報参照のみを保持する。

## サードパーティプロバイダーを追加する

**Add model provider** を選ぶ。カードは **Third-party model provider** で開く。dsh が同梱するプロバイダーを選び（リストには `anthropic`、`openai`、Kimi 用の `moonshotai`、GLM 用の `zai` などのプロバイダー id が表示される）、その API キーを入力して保存する。インストール済みカタログがエンドポイント、プロトコル、モデルリストを提供する。

認証の **?** は、保存済み資格情報の優先順位と環境フォールバックを説明する。キーを空欄にすると、保存済み資格情報を使うか、列挙された環境変数を試す。緑のヒントは検出された環境変数を示す。黄色のヒントは資格情報変数が検出されなかったことを意味し、API キーを入力するか列挙された変数を設定する。未確認のヒントはステータス読み取りが失敗したことを意味する。検出は資格情報を検証せず、接続もテストしない。プロバイダー管理の資格情報ファイル（AWS プロファイルや Google アプリケーションデフォルト資格情報を含む）はこのチェックの対象外である。`openai-codex` のようなネイティブキー認証を持たないプロバイダーは、プロファイルが資格情報参照を明示的に名指さない限りキーフィールドを表示しない。

保存済み資格情報は **Leave blank to use saved credentials** というプレースホルダーを使い、入力の下にステータステキストはない。環境フォールバックは **Leave blank to use env as auth** を使い、入力が空の間は検出ヒントを 1 つ表示する。空でない入力は認証ステータステキストを表示しない。アドレス構成変数は **Base URL** の下に現れ、資格情報として数えられない。

空でないキー入力には目のボタンがある。**Show secret** を選ぶと入力内容を確認でき、**Hide secret** で再びマスクされる。入力を変更すると再びマスクされる。保存済み資格情報は書き込み専用のままである。

## カスタムモデル API を追加する

リレー、社内ゲートウェイ、セルフホストサーバー、またはインストール済みカタログにないプロバイダーには、カードを **Custom model API** に切り替える。小文字の Provider ID、ベース URL、API プロトコル、資格情報、および少なくとも 1 つのモデルを指定する。**API protocol** はゲートウェイが話すものにしなければならず、ピッカーは 3 つを提供する。OpenAI Chat Completions、OpenAI Responses、Anthropic Messages であり、アクティブなプロファイルの `cordis.patch.yml` に `openai-completions`、`openai-responses`、`anthropic-messages` として保存される。プロバイダーは 1 つのプロトコルを話すので、2 つを提供するゲートウェイには 2 つのプロバイダーが必要である。

![カスタムモデル API フォーム: Provider ID、表示名、ベース URL、API プロトコル、API キー](providers-custom-form.png)

Provider ID は永続である。リクエスト、保存済みセッション、モデル既定、資格情報参照がそれを使うためである。プロバイダーを改名するには、新しいプロバイダーを追加して古いものを削除する。表示名、ベース URL、プロトコル、資格情報、モデルは編集可能なままである。

### モデルを検出する

**Model catalog** の下で **Fetch available models** を選ぶと、エンドポイントに提供しているモデルを問い合わせる。リクエストは現在フォームにあるベース URL、プロトコル、キー、または保存済みプロバイダーの保存キーを使い、応答が検索可能なピッカーを開く。検索し、欲しいモデルにチェックを入れ、**Add selected** を選ぶ。プロバイダーを保存または作成するまで何も保存されない。

検出は一般的なゲートウェイが公開するリスト形式を読み取るが、すべてのエンドポイントがそのいずれかで応答するわけではないので、保証ではなく便利機能として扱う。失敗したり何も列挙しなかったりした場合は、モデル id を手動で追加すれば同様に機能する。組み込みプロバイダーは、ベース URL がゲートウェイを指していても、常にインストール済みカタログから応答される。ゲートウェイが実際に提供するものを確認するには、カスタムプロバイダーを通じてフェッチする。

## モデルを選択する

構成済みのプロバイダーはモデルピッカーに現れる。モデルを選択すると、新しいセッションの既定にもなる。すでにリクエストを送信したセッションは、自身のログに記録されたモデルを保持する。

保存済みの既定が削除されたプロバイダーを名指す場合、コンポーザーは **Select model** を表示し、別のモデルが選択されるまで入力をブロックする。

## 高度な構成

生成された[プラグイン設定カタログ](../../config-catalog.md)は、すべてのプラグインのサポートされるすべてのフィールドと既定値を列挙する。[`dsh-llm-pi-ai`](../../config-catalog.md#deepseek-aidsh-llm-pi-ai) がこのページで構成するプロバイダーセクションである。[`dsh-llm-pi-ai`](../../../packages/llm/llm-pi-ai/README.md) と [`dsh-llm-deepseek`](../../../packages/llm/llm-deepseek/README.md) のリファレンスが、直接の `cordis.patch.yml` 構成、カタログ解決、reasoning 制御、資格情報、アダプターエラーを所有する。

::: tip 追加設定
Models ページは、API キー、表示名、ベース URL、API プロトコル、および各モデルの id、表示名、コンテキストウィンドウ、最大出力トークン、入力タイプ、さらにカスタムモデル API プロバイダーのモデルの reasoning レベルを公開する。組み込みプロバイダーのモデルの reasoning レベル、リクエスト互換スイッチ、ヘッダー、タイムアウト、再試行ポリシーは `$DSH_HOME/profiles/<profile>/cordis.patch.yml` で構成する。これはページが書き込むのと同じドキュメントである。直接編集するか、ブラウザーがサーバーと同じマシンで動いている場合は、Settings ヘッダーの **Open configuration file** で開く。アダプターは次のリクエストでそれを再読込するので、再起動は不要である。以下のサブセクションは、ほとんどのゲートウェイが必要とするフィールドを扱う。

`dsh web` による標準の Web UI 起動では `<profile>` は `web` なので、パスは `$DSH_HOME/profiles/web/cordis.patch.yml` である。カスタムプロファイルを起動する場合は、起動時に選択した名前を使う。
:::

### 画像入力

**Settings → Models** でプロバイダーを編集し、**Customized settings** を開き、モデルの **Model options** を展開する。**Input types** は容量フィールドの下の独自の行を占める。画像を受け入れるモデルには **Image** を選択して保存する。継承された画像ケイパビリティのない新しいカスタムモデルでは **Text** が選択された状態で始まる。少なくとも 1 つのタイプが選択されたままである必要があり、画像専用モデルでは Text を外す前に Image を選択する。

チェックボックスは pi-ai モデルには `input` を、直接の DeepSeek アダプターには `inputModalities` を保存する。`$DSH_HOME/profiles/<profile>/cordis.patch.yml` でモデルを編集することもできる。たとえば、このカスタム pi-ai プロバイダーはテキスト専用モデルとビジョンモデルを 1 つずつ宣言する:

これらの例は、プロファイルパッチ内の設定フィールドを示す。Cordis の設定オーバーライドはエントリーの設定全体を置き換えるので、既存のオーバーライドを編集するときは他のプロバイダーとフィールドを保持すること。

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        models:
          - id: legacy-chat
          - id: vision-preview
            input: [text, image]
```

Pi-ai の `input` は `text` と `image` を受け入れ、そのモデルだけに適用される。明示的な空でない選択が優先される。省略または空の `input` は、インストール済みカタログの入力タイプ、次にルートの `defaultInput`（既定は `[text]`）を継承する。行を開いただけでは、チェックボックスはこれらの継承値を表示し、オーバーライドを保存しない。

DeepSeek は省略された `inputModalities` をテキスト専用として扱い、空のリストを拒否する。Image を外すとそのモデルの `imagePixelBudget` と `imageMaxBytes` も削除される。DeepSeek はテキスト専用モデルの画像制限を拒否するためである。後で画像を有効にしてカスタム制限が必要になった場合は、それらの制限を再設定する。

チェックボックスを編集した後に継承を復元するには、`cordis.patch.yml` からそのモデルの `input` または `inputModalities` フィールドを削除する。**Restore defaults** は他のモデル編集を含むモデルカタログオーバーライド全体を削除するので、カタログ全体を復元したいときにのみ使う。

手動で入力したすべてのモデルが画像を受け入れる場合は、各モデルではなくルートでフォールバックを 1 回設定する:

```yaml
- id: llm-pi-ai
  config:
    providers:
      vision-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://vision.example/v1
        defaultInput: [text, image]
        models:
          - id: first-model
          - id: second-model
```

`defaultInput` はオーバーライドではなくフォールバックであり、既定は `[text]` である。組み込みプロバイダーでは、カタログが記述しないモデルにのみ応答するので、画像を持つカタログモデルから画像を削除することはない。それらの 1 つを絞り込むには、そのモデル自身の `input` を使う。組み込みプロバイダーに明示的な `models` リストがない場合は、モデル id をキーとして `modelOverrides` の下に書く:

```yaml
- id: llm-pi-ai
  config:
    providers:
      anthropic:
        modelOverrides:
          claude-sonnet-4-5:
            input: [text]
```

pi-ai 構成では、モデル自身の `input` を除くすべてのリストが少なくとも 1 つのモダリティを名指さなければならない。モデル自身の `input` では、空のリストは省略と同じ意味である。未知のモダリティはどこに書かれても拒否される。

どちらのフィールドも、エンドポイントについての主張を述べるものであり、それを検査するものではない。エンドポイントが提供しない画像を宣言したモデルはここでは捕捉されず、代わりにプロバイダーがリクエストを拒否する。

### DeepSeek アカウントのモデル

サインイン済みの DeepSeek アカウントはアカウントサービスからモデルを列挙するので、Models ページはそれ用のモデルエディターを提供しない。単一のモデルを調整するには `$DSH_HOME/profiles/<profile>/cordis.patch.yml` の `modelOverrides` を使う。フィールドは DeepSeek の `models` エントリーと一致し、未設定のフィールドは列挙された値を保つ:

```yaml
- id: llm-deepseek-account
  config:
    modelOverrides:
      deepseek-flash:
        contextWindow: 524288
        maxTokens: 131072
```

より新しい DeepSeek Harness を必要とするモデルは `CLIENT_UPGRADE_REQUIRED` で失敗し、インストールすべきバージョンを名指す。[アカウントプロバイダーリファレンス](../../../packages/llm/llm-deepseek-account/README.md)が列挙、フォールバック、ゲーティングの規則を所有する。

### 推論エフォート

モデルピッカーは、reasoning レベルを宣言するモデルに **Effort** メニューを提供する。組み込みプロバイダーのモデルはインストール済みカタログからレベルを継承し、DeepSeek のモデルはアダプターのレベルを保つ。手動で入力したモデルは追加するまでレベルを宣言しないので、それまでは Effort エントリーがメニューに現れず、モデルが思考するかどうかはエンドポイント自身の既定が決める。

カスタムモデル API プロバイダーでは、**Settings → Models** でレベルを宣言する。プロバイダーを編集し、**Customized settings** を開き、モデルの **Model options** を展開し、**Reasoning levels** をオンにする。行は off、low、medium、high で始まる。各行はレベルと、そのために送られる **API value** を対にする。API value の既定はレベル名であり、モデルプロバイダーの API ドキュメントがレベルを異なる綴りで示す場合にのみ変更する。エンドポイントがサポートするものに合わせて行を追加または削除し、off のほかに少なくとも 1 つのレベルを保ち、保存する。スイッチをオフにすると宣言が削除される。

ページは `$DSH_HOME/profiles/<profile>/cordis.patch.yml` に `reasoningEfforts` を書き込む。そこではレベルを直接宣言することもできる:

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        reasoning: high
        models:
          - id: my-reasoner
            reasoningEfforts:
              off:
              high: high
              max: max
```

各キーはメニューが提供するレベルであり、その値は `reasoning_effort` として wire で送られる綴りである。したがって `max: xhigh` は独自の語彙を持つゲートウェイ向けにレベルを改名する。空のままでよいのは `off` のみである。ほとんどのエンドポイントでは、思考しないことはパラメーターの不在だからである。ルートの `reasoning` は、セッションがまだ何も選んでいない間に使われるレベルである。ピッカーでエフォートを選ぶと、モデルとともに新しいセッションの既定として保存される。

空のままの `off` は何も送らず、これは要求に応じて思考するモデルを止めるだけである。値を持つ `off` は代わりにその値を `reasoning_effort` として送る。止められない限り思考するモデル（たとえば OpenAI 互換ゲートウェイの背後の DeepSeek V4）には `compat.thinkingFormat: deepseek` が必要であり、これにより `off` は `thinking: {type: disabled}` を送り、他のすべてのレベルはエフォートと並んで `thinking: {type: enabled}` を送る:

```yaml
        models:
          - id: deepseek-v4-pro
            compat:
              thinkingFormat: deepseek
            reasoningEfforts:
              off:
              high: high
              max: max
```

ゲートウェイが reasoning しない組み込みプロバイダーのモデルは、`modelOverrides` の下の `reasoningEfforts: false` でレベルを失う。そのモデルにエフォートを選択すると `UNSUPPORTED_REASONING_EFFORT` として拒否される。DeepSeek 自身のルートにはこれらは不要である。そのモデルはすでに `off`、`low`、`high`、`max` を提供し、`llm-deepseek.reasoningEffort` がピッカーが開始する既定を設定する:

```yaml
- id: llm-deepseek
  config:
    reasoningEffort: max
```

### リクエスト互換性

ゲートウェイは、到達可能なアドレスで有効なキーを持ちながら、すべてのリクエストを拒否することがある。pi-ai はリクエストの形（どのロールがシステムプロンプトを運ぶか、どのフィールドが出力を制限するか、思考レベルがどう運ばれるか）をエンドポイントの URL から決め、認識しないアドレスは OpenAI 自身であるかのように扱う。ほとんどの OpenAI 互換ゲートウェイは、OpenAI が受け入れるもののうち少なくとも 1 つを拒否する。

そのほとんどは 2 つで説明できる。reasoning を宣言するモデルはシステムプロンプトが `role: "developer"` として送られ、多くのゲートウェイがこれを即座に拒否する。また出力上限が `max_completion_tokens` として送られ、`max_tokens` しか知らないサーバーがこれを拒否する。フォームにはどちらのフィールドもないので、`$DSH_HOME/profiles/<profile>/cordis.patch.yml` のルートで修正する:

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        compat:
          supportsDeveloperRole: false
          maxTokensField: max_tokens
        models:
          - id: my-model
```

ルートの `compat` はそのモデルの既定であり、モデル自身のものがフィールド単位で優先するので、ルートを繰り返すことなく 1 つのモデルを修正できる:

```yaml
        models:
          - id: my-model
          - id: my-reasoner
            compat:
              thinkingFormat: deepseek
```

どちらも設定しないものはそのモデルのインストール済みカタログの値を保ち、カタログが記述しないものは pi-ai の検出に委ねられる。名指すすべてのスイッチに値を与えること。空のままのキー（`supportsDeveloperRole:`）は無視されるのではなく拒否される。空の値は、カタログが知っていることを消し去りながら、その代わりに何も言わないからである。どのプロトコルも受け入れない名前も拒否され、メッセージが利用可能なものを列挙する。

各スイッチはそれを宣言するプロトコルに属するので、ある `api` で有効なスイッチが別のもので拒否されることがある。メッセージはそのプロトコルが提供するものを名指す。上記の `input` と同様、スイッチはエンドポイントについての主張を述べるものであり、検査するものではない。ゲートウェイが実際には必要としないスイッチを設定しても、単に異なるリクエストが送られるだけである。

すべてのスイッチ、その受け入れ値、それを取るプロトコルは、[生成された `dsh-llm-pi-ai` 設定リファレンス](../../config-catalog.md#deepseek-aidsh-llm-pi-ai)の `PiAiCompatProfile` の下に列挙される。これはソースから導出されるので、アダプターが受け入れるものから遅れることはない。

## トラブルシューティング

- **`MISSING_CREDENTIAL`** — Models ページを通じてプロバイダーキーを保存するか、参照された環境変数を提供する。
- **`UNKNOWN_MODEL`** — 構成済みのモデルを選択するか、カスタムプロバイダーに欠けているモデルを追加する。
- **利用可能なモデルのフェッチが 401 を返す** — キーを確認する。モデル検出は OpenAI 互換の `GET /models` エンドポイントを呼ぶ。それを提供しないエンドポイントにはモデルを手動で入力する。
- **利用可能なモデルのフェッチが `data` 配列も `models` オブジェクトも報告しない** — エンドポイントのリストは検出が読まない形式である。モデルを手動で入力する。
- **キーと URL は正しいのにゲートウェイがすべてのリクエストを拒否する** — そのリクエストの形が OpenAI のものと異なる。ルートで `compat.supportsDeveloperRole: false` と `compat.maxTokensField: max_tokens` から始める。
- **reasoning モデルだけが失敗する** — pi-ai がそれらのシステムプロンプトを `developer` ロールとして送り、ゲートウェイが拒否する。`compat.supportsDeveloperRole: false` を設定する。
- **手動で入力したモデルに Effort メニューが現れない** — そのモデルはレベルを宣言していない。カスタムモデル API プロバイダーでは、モデルの **Model options** で **Reasoning levels** をオンにする。それ以外では、`cordis.patch.yml` のモデルに `reasoningEfforts` を追加する。
- **`off` が DeepSeek モデルの思考を止めない** — 空の `off` は reasoning フィールドをまったく送らず、既定で思考するエンドポイントは思考し続ける。モデルまたはルートに `compat.thinkingFormat: deepseek` を設定する。
- **compat スイッチが値なしとして拒否される** — コロンの後に何も書かれていないキーである。値を与えるか、キーを削除してインストール済みカタログの値を保つ。
- **画像が送信前に拒否される** — そのモデルは画像モダリティを宣言していない。カスタムプロバイダーのモデルには `input: [text, image]` を与える。DeepSeek 自身のルートでは、構成済みカタログから画像対応のエントリー（既定では `deepseek-flash`）を選択し、ゲートウェイがそのモデルを画像入力付きで提供することを確認する。
- **プロバイダーが画像を含むリクエストを拒否する** — そのモデルはエンドポイントが実際には提供しない画像を宣言している。それを許可したリスト（モデルの `input`、またはルートの `defaultInput`）から `image` を削除し、新しいセッションを開始する。添付された画像はセッションログに残るため、セッションがそこから離れるまで同じリクエストが繰り返される。
