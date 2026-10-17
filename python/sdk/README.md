# DeepSeek Harness Python SDK

日本語 | [English](README.en.md) | [中文](README.zh.md)

stdio 上の改行区切り JSON-RPC で DeepSeek Harness を操作するための Python サブプロセス SDK。`deepseek-harness-sdk` をインストールします。これは現在のプラットフォーム向けの同一バージョンの `deepseek-harness-runtime-bin` wheel もインストールします。

```sh
python -m pip install deepseek-harness-sdk
```

## 任意の Office 操作

Office ランタイムを明示的にダウンロードすると、エージェント、セッション、モデルリクエスト、API キー、Harness ホームなしでローカル API を呼び出せます:

```py
from deepseek_harness_runtime import download_office
from deepseek_harness.office import convert, recalculate, render_images

download_office()
pdf = convert("report.docx", "report.pdf")
workbook = recalculate("forecast.xlsx", "calculated.xlsx")
preview = render_images("report.docx", "report-preview", pages=[1])
```

出力ファイルまたは画像ディレクトリは存在してはなりません。成功した出力は呼び出し元のもので、Kit は失敗した出力を削除します。`OfficeOptions` は操作の制限とフォント設定を指定します。結果は型付きパス、欠落フォント、画像メタデータを公開します。`OfficeError` は CLI の失敗コードを保持し、不正な結果は `SdkProtocolError` を発生させます。再計算はビジネスロジックや Excel の忠実性を検証しません。Ctrl+C は CLI のクリーンアップを待ちます。2 回目の割り込みは強制終了し、部分的な出力を残すことがあります。Windows では Ctrl+C 配信のために絶対パスの `SystemRoot` と共有コンソールが必要です。

オーサリング環境は `deepseek_harness_runtime.download_primary_runtime()` を通じて独立に任意です。キャッシュ選択、リソースのアクティベーション、ダウンロード動作については[ランタイムリファレンス](../sdk-runtime/README.md)を参照してください。SDK の起動と Office 操作が欠落したリソースを自動的に取得することは決してありません。

## ランタイムを起動する

Python SDK に別個のアプリケーションエントリーポイントはありません。バンドルされた `dsh` CLI を `--profile sdk` で起動します。選択されたプロファイルが JSON-RPC サーバー、エージェント構成、資格情報、永続化、ツール、シャットダウン動作を所有します。

すべての起動には明示的な Harness ホームが必要です。`dsh_home` を渡すか、子プロセス環境で空でない `DSH_HOME` を提供してください。SDK は意図的に `~/.dsh` を探索しません。

```py
from deepseek_harness import DeepSeekHarness

with DeepSeekHarness(
    dsh_home="/absolute/path/to/isolated-dsh-home",
    cwd="/absolute/path/to/workspace",
    provider="deepseek-official",
    model="deepseek-v4-flash",
    reasoning_effort="max",
    max_tokens=49_152,
) as harness:
    result = harness.run("Say hi.", session_id="example-001")

print(result.final_response)
```

`DeepSeekHarness` は遅延起動し、`close()` またはコンテキストマネージャーの終了までそのランタイムを再利用します。初期プロファイルハンドシェイクには `initialize_timeout_seconds` による独立したデフォルト 30 秒の上限があります。通常のターンは `request_timeout_seconds` が設定されない限り無制限のままです。タイムアウトは選択されたプロファイルを名指し、保持されたランタイム診断を含みます。`cwd` はエージェントのワークスペースで、`runtime_cwd` はサブプロセスの作業ディレクトリを独立に選択します。どちらも起動前に絶対パスになります。`provider`、`model`、任意の `reasoning_effort`、任意の正の `max_tokens` は JSON-RPC 初期化時に送信されます。`base_url` と `api_key` は子プロセス環境の `DEEPSEEK_BASE_URL` と `DEEPSEEK_API_KEY` を明示的に上書きします。

`harness.resume_session(saved_session_id)` は永続化された履歴を復元し、`run()` の準備ができた `Session` を返します。元のセッション ID を保存し、その `dsh_home` とワークスペースを再利用してください。復元は保存されたディレクトリを保ち、中断された最終ターンを修復し、新しい入力を送信しません。存在しない、読み取り不能、非互換、または使用中のセッションは、代替を作成せずに例外を発生させます。`start_session(id)` は遅延ハンドルを開くだけで、永続化された復元を要求しません。この API はシェル、ブラウザー、その他の外部プロセスを復元しません。

```py
with DeepSeekHarness(dsh_home="/absolute/path/to/saved-home") as harness:
    session = harness.resume_session(saved_session_id)
    result = session.run("Continue the task.")
```

## プラグインをカスタマイズする

永続的なカスタマイズは `dsh` プロファイルに属します。出荷済みの SDK プロファイルを初期化し、ランタイム wheel の `dsh` コマンドで外部バンドルをインストールします:

```sh
export DSH_HOME=/absolute/path/to/isolated-dsh-home
dsh --profile sdk --dump-default-config >/dev/null
dsh plugin --profile sdk add file:/absolute/path/to/my-plugin-bundle
```

`file:` 形式はローカルバンドルをプロファイルのパッケージツリーにインストールし、そこではそのピアインポートがバンドル済みインストールのフォールバックに到達します。プロファイルマニフェストはインストール済み依存関係と順序付きバンドルレイヤーを記録し、その `$DSH_HOME/profiles/sdk/cordis.patch.yml` が永続的なユーザーパッチです。`dsh plugin` が `pnpm` を必要とするのは外部パッケージを管理するときだけです。SDK の実行にシステムの Node.js は必要ありません。

呼び出し固有の変更には、1 つ以上のパッチファイルを渡します。それらは絶対パスになり、プロファイルとホームのパッチレイヤーの後に順序どおり転送されます:

```py
with DeepSeekHarness(
    dsh_home="/absolute/path/to/isolated-dsh-home",
    profile="sdk",
    patches=("/absolute/path/to/first.patch.yml", "/absolute/path/to/last.patch.yml"),
) as harness:
    result = harness.run("Make the requested code change.")
```

`profile` は別の既存プロファイルを選択できますが、そのコンポジションは `@deepseek-ai/dsh-sdk-app` または別の `@deepseek-ai/dsh-sdk-jsonrpc-server` 行を保持しなければなりません。設定ミスは CLI のブート時または SDK の初期化時に失敗します。完全な設定へのフォールバックはありません。`dsh_bin` は同じプロファイル文法を保ったまま別の `dsh` 実行ファイルを選択できます。任意の argv 置換は内部の fake-runtime テストアダプターのままであり、公開 API ではありません。

`provider` は選択された Cordis コンポジションが登録したプロバイダールートを選択します。`model` はそのアダプターが解決するモデル ID です。`reasoning_effort` はその正確なルートに対する、アダプター所有の任意の空でない識別子です。省略時はモデル自身のデフォルトが保たれます。`max_tokens` はルートエージェントとそのインプロセス子孫に対する、任意の正のリクエストごとの出力トークン上限です。省略時はプロバイダーのデフォルトが支配します。初期化は、プロンプトが実行される前に、欠落したアダプター、利用不能なモデル、または未対応のエフォートを拒否します。コンパクションのサマリーは、それぞれのコンパクションプラグインが設定する別の制限を保ちます。バンドルされたデフォルトコンポジションは `deepseek-official` を登録します。カスタムコンポジションは `llm-pi-ai` をマウントし、そこでプロバイダー固有の資格情報/エンドポイントを設定し、pi-ai のインストール済みカタログに存在する任意のプロバイダー/モデルを選択できます。

出荷済みの `sdk-minimal` プロファイルは、`dsh-base` 上のオーバーレイではなく、独立した明示的なツリーです。`profile="sdk-minimal"` で選択します。通常の `model` 引数が唯一のランタイムモデル選択であり、アダプターの参考カタログ外のモデル ID も含みます。プラットフォームが選択する永続シェル、`read_image`、`working_directory`、ローカル実行、JSONL セッション、自動コンパクションを提供します。テキストファイルツール、設定、管理された資格情報、テレメトリー、Web ツール、完全なデフォルトツール名簿は、別個の完全な `sdk` プロファイルと `web` プロファイルを通じて引き続き利用できます。SDK のプロンプトテキストは `/compact` を実行しません。

## 結果と通知

`Session.run()` は、プロンプトの永続インボックス受領から次のエージェント全体のアイドルまでのアクティビティ区間を所有し、`RunResult(session_id, final_response, finish_reason, events, notifications)` を返します。`final_response` はその区間で最後にコミットされたルートセッションのアシスタントテキストです。`finish_reason` は最後のルートセッション `turn/end` の `kind` (たとえば `completed`、`max-tokens`、`error`) で、ターンが終了しなかった場合は `None` です。文字列の `data.reason.kind` を持たない `turn/end` はプロトコル違反であり、`SdkProtocolError` を発生させます。

`HarnessClient` は発見されたサブエージェントの系譜をランタイムプロセスの寿命の間保持します。`Session.run()` の間、`RunResult.notifications` と `on_notification` はルートセッションと既知の子孫をワイヤ順で受け取ります。`RunResult.events` はルートセッションのイベントのみを含むため、子孫の出力がルートの応答を置き換えることはできません。低レベルの `session_prompt()` はキューイングされたメッセージ ID を直ちに返します。`Session.run()` を迂回する呼び出し元は、その後のアクティビティ境界を自ら所有します。

選択されたホームはプロファイル、プラグイン、プロファイル所有のすべての永続リソースを保存します。完全な `sdk` プロファイルはその資格情報、設定、セッションストアを使い、`sdk-minimal` は JSONL セッションストレージを使い、画像は `$DSH_HOME/attachments/v1` に、リクエスト画像キャッシュは `$DSH_HOME/cache/attachments` に保存します。それらのリソースを分離する必要がある場合は新しいホームを、独立した作業には新しいセッション ID を使ってください。ハーネスとセッション ID の両方を再利用すると、永続的な会話とセッション所有のリソースが継続します。

[Python チュートリアル](../../docs/user/guide/python-sdk.md)、[実行可能な例](examples/README.md)、[ランタイム wheel リファレンス](../sdk-runtime/README.md)を参照してください。

`Session.get_working_directory()` は有効な作業ディレクトリを読み取り、`set_working_directory(path)` はそれを変更して検証済みの絶対パスを返します。どちらもモデルターンを実行せずに未知のセッションを作成します。相対パスはそのセッションの現在のディレクトリを使用します。オリジンメタデータ、権限、既存のプロセスは変わらないままです。低レベルクライアントは、先頭に `session_id` 引数を取る同じメソッドを提供します。
