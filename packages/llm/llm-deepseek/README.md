---
description: "DeepSeek Messages、reasoning、画像入力を設定する。"
kind: "package-reference"
---

# @deepseek-ai/dsh-llm-deepseek

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

共有の DeepSeek Messages トランスポート、リクエスト設定、モデルケイパビリティを提供する。認証、モデルディスカバリー、プロバイダー登録には [API キー](../llm-deepseek-api-key/README.md)または[アカウント](../llm-deepseek-account/README.md)プラグインを組み合わせる。有効な設定変更は後続の呼び出しに反映され、実行中の呼び出しは自身の設定を保持する。このパッケージは [pi-ai アダプター](../llm-pi-ai/README.md)と並んで動作できる。

`resolveAuth(connection)` は、プロバイダーが所有する認証ヘッダーと、そのリクエストの資格情報に束縛された任意の失敗コールバックを返す。Messages と Files は、資格情報モードを選択することなくこれらのヘッダーを送信する。アップロードの再利用はエンドポイントと認証ヘッダーのハッシュによって分離され、生の資格情報は永続化されない。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と延期された作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

このパッケージはトランスポートライブラリをエクスポートする。プロバイダープラグインが harness の LLM サービスにルートを登録する。接続オプションは操作ごとに 1 回、Config 参照からキャプチャーされる。

アダプターは、永続的な履歴と並んで LLM サービスの[リクエスト専用ユーザー入力](../llm/README.md#use-this-package)を受け入れる。リクエスト専用のアイデンティティとアトリビューションを省略しても、プロバイダーコンテンツは変わらない。

### どちらを選ぶべきか

DeepSeek の公式 API、または `baseURL` 経由の Messages 互換ゲートウェイにはこのアダプターを選ぶ。同じ構成で他のプロバイダーや手動宣言のゲートウェイも pi-ai のカタログ経由でルーティングする場合は `dsh-llm-pi-ai` を選ぶ。ルート名が衝突しないため、2 つのアダプターは同時にマウントできる。`deepseek-official` に他のアダプターを登録すると `DUPLICATE_ADAPTER` で失敗する。

<a id="minimal-configuration"></a>
### 最小構成

```yaml
- name: '@deepseek-ai/dsh-llm-deepseek-api-key'
  config:
    apiKeyEnv: DEEPSEEK_API_KEY  # credential reference, resolved per request
    reasoningEffort: high        # optional; off | low | high | max
    maxTokens: 256000            # optional per-request output cap
    maxRequestFilesBytes: 134217728
    maxInlineRequestImageBytes: 20971520
    maxImagesPerRequest: 600
    filesApiTimeoutMs: 60000
```

リクエストは `provider: deepseek-official` でルートを選択する。モデル id はそのまま wire に渡されるため、新しい DeepSeek モデルの再登録は不要である。`models` を省略すると、テキストと画像に対応する `deepseek-flash` と、テキスト専用の `deepseek-v4-pro` が、それぞれ 1,000,000 トークンのコンテキストウィンドウとともに告知される。明示的なリストはこれらのデフォルトを置き換えるが、コアの呼び出しは引き続き、リストにないモデル id をテキスト専用ルートとしてそのまま通す。GUI での選択にはカタログエントリーが必要であるが、保存済みの選択はカタログエントリーが消えた後もリクエストを送信できる。モデルディスカバリーツールを含むクライアントは、`ctx.llm.listModels('deepseek-official')` を通じてこれらの参考エントリーを読める。画像対応エントリーは `imagePixelBudget` を正の整数または `low` に設定でき、`imageMaxBytes` も設定できる。エントリーは、そのエンドポイントが `messages` の任意の位置にある最新の `system` メッセージを完全な実効システムプロンプトとして読む場合に `systemPromptUpdate: in-history` を宣言できる。アダプターは解決済みモデルと準備済み呼び出しでそのモードを報告し、agent ループは先頭の system メッセージを書き換える代わりに、キャッシュ済み履歴の後に変更されたプロンプトを追記する（[決定ルール](../../core/agent-loop/README.md#understand-the-implementation)）。デフォルトの `deepseek-flash` エントリーはこのモードを宣言する。他のモデルは明示的な `models` 宣言が必要で、`in-history` 以外の値はロード時に `llm-deepseek: catalog model "<id>" systemPromptUpdate must be "in-history" when present` で失敗する。

| フィールド | デフォルト | 意味 |
|---|---|---|
| `baseURL` | `https://api.deepseek.com/anthropic` | 明示値、次に `$DEEPSEEK_BASE_URL`、最後に公式ルート |
| `thinking` | `enabled` | デプロイメントポリシー。`disabled` はすべてのリクエストを `off` に固定する |
| `reasoningEffort` | `high` | デフォルトの強度: `off`、`low`、`high`、`max` のいずれか |
| `maxTokens` | `256,000` | リクエストごとの出力上限。モデル自身の上限と明示的なリクエスト値が優先される |
| `defaultContextWindow` | `1,000,000` | 正確な値を持たないモデルの容量フォールバック |
| `models` | V4.1 Flash + V4 Pro | ディスカバリーの消費者に表示される参考カタログ |
| `streamIdleTimeoutMs` | `300,000` | 未完了のストリーム読み取りごとのプロバイダー最大アイドル時間 |
| `maxRequestFilesBytes` | `128 MiB` | file モードのリクエスト画像バイト予算。保持画像がこれを超えるリクエストは `IMAGE_OFFLOAD_REQUIRED` で失敗する |
| `maxInlineRequestImageBytes` | `20 MiB` | 独立した base64 フォールバックの高水位 |
| `maxImagesPerRequest` | `600` | 保持するリクエスト画像数の高水位 |
| `imageOffloadByteQuantum` | `64 MiB` | Files モードの最古プレフィックス除去量子 |
| `inlineImageOffloadByteQuantum` | `10 MiB` | インラインモードの最古プレフィックス除去量子 |
| `imageOffloadCountQuantum` | `20` | 件数オーバーフローの除去量子 |
| `filesApiTimeoutMs` | `60,000` | 画像ごとの Files 解決デッドライン |
| `fileExpiresAfterSeconds` | `604,800` | 要求するアップロード画像の生存期間とローカル再利用の期限 |
| `fileRefreshMarginSeconds` | `3,600` | 再利用可能な残り期間がこれを下回ると id を差し替える |
| `fileQuotaCleanupBatch` | `100` | クォータ再試行の 1 回前に削除する harness 所有の最古ファイル数 |
| `retryPolicy` | normal、5 回の再試行 | `dsh-llm-retry` が実行するプロバイダー所有の再試行ポリシー |

生成された[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-llm-deepseek-api-key)が、受け入れられるすべてのフィールドとその JSDoc の網羅的な情報源である。

[プロアクティブ圧縮](../../compaction/compaction-basic/README.md#use-this-package)が有効な場合、`models[].contextWindow`（存在しない場合は `defaultContextWindow`）は、実効リクエストの `maxTokens` と圧縮ポリシーの `headroomTokens` の合計を超えなければならない。明示的な出力上限のないリクエストは、モデルの `maxTokens` またはアダプターのデフォルトを使う。小ウィンドウのデプロイでは、その容量内でヘッドルームを構成する。`thresholdRatio` を下げるとより早く圧縮される。

<a id="endpoint-and-wire-format"></a>
### エンドポイントと wire フォーマット

公式ルートは `https://api.deepseek.com/anthropic` である。明示的な `baseURL` または `$DEEPSEEK_BASE_URL` は Messages 互換のルートを提供する。モデルリクエストと Files リクエストは `/v1/messages` と `/v1/files` を追加するが、末尾セグメントが正確に `/v1` の場合はそれが再利用される。末尾スラッシュはこれらの結果を変えない。ベース URL は、資格情報、クエリ、フラグメントを含まない HTTP(S) でなければならない。

Messages は、テキスト、thinking、ツール呼び出し、ツール結果をコンテンツブロックとして送信し、reasoning effort を `output_config.effort` として、画像を Files 参照またはインライン base64 として送信する。`systemPromptUpdate: in-history` を宣言するモデルは最初のトップレベル system を保持し、対応する user/tool-result ターンの後に新しい system スナップショットを送信する。宣言していないモデルは最新のスナップショットをトップレベル system として使う。リプレイメタデータはモデルと thinking の署名を保持する。無効なリプレイメタデータは警告を発し、署名を省略しつつテキストとツール履歴を保持する。モデルエントリーは `toolUpdate: addition-only` または `in-history` を宣言できる。デフォルトの `deepseek-flash` エントリーは `addition-only` を宣言する。投影された開発者ツール更新は、宣言された名前を参照する system ロールの `tool_addition` ブロックと `tool_removal` ブロックになり、遅延宣言は `defer_loading` を伴う。これらのブロックを含むリクエストは `mid-conversation-tool-changes-2026-07-01` ベータヘッダーを送信する。Messages は空のアシスタントテキストブロックを省略し、コンテンツを持たないままになったアシスタントメッセージ（他プロトコルから保存された履歴を含む）をスキップする。保存された Session の内容は無傷のまま残る。

### アカウント資格情報

`deepseek-official` は自身に設定された API キー参照のみを解決する。`deepseek-account` は[アカウントプロバイダー](../../credentials/deepseek-account-platform/README.md)から保存済みのグラントのみを解決し、その許可された `inferenceOrigin` はデフォルトで `https://api.deepseek.com` である。どちらのルートも他方にフォールバックしない。サインアウトはアカウントグラントを削除し、API キーは保持する。

Messages と Files のリクエストは、アカウントトークンを Bearer プレフィックスなしの `x-dsh-auth-token` として送信する。API キーは `x-api-key` を使う。どちらの資格情報モードもリダイレクトに従わない。HTTP 401 の分類と資格情報の無効化はアカウントプロバイダーが所有し、トランスポートは失敗を自身のコールバックに渡す。

### thinking と画像を伴うストリーミング

画像対応ルートは、各永続参照のリクエストターゲットを選び、それを決定論的なリクエストバージョンに解決する。`imagePixelBudget` を省略すると、14px パッチ、3:1 ダウンサンプリング、画像あたり最大 1024 トークンという公表済みの vision トークングリッドでターゲットをサイズ設定する。そのため正方形の画像は最大 1302×1302 ピクセルを保ち、16:9 の画像はプロバイダーの 1708×966 グリッド向けに 1708×961 として送信される。正の整数はグリッドを総ピクセル予算で置き換え、`low` は総ピクセル数 512×512 を使う。すべてのリクエスト画像は 1 辺 4096 ピクセルに制限される。これは 15 枚以上の画像を含むリクエストに対するプロバイダーの上限であり、`imageMaxBytes` はデフォルトで 2 MiB である。アルファ付き画像は WebP の effort 0 を使い、不透明画像は 85/75/60 の品質ラダーの JPEG を使う。すべての候補がターゲットを超える場合は最小の出力が保持される。保持される各画像の前には、その完全な添付 id と実際のリクエスト寸法を示すテキストが置かれる。現在のファイルシステムが添付プロバイダーのホストオブジェクトをマップしている場合、そのテキストは読み取り専用の実行ワールドパスと、書き込み可能なコピー用の拡張子も運ぶ。テキスト専用およびリストにないルートは安定した添付プレースホルダーを受け取り、永続履歴は画像参照を保持し続ける。

アダプターは通常、それらの正確なリクエストバイトを `/v1/files` 経由でアップロードし、file-id 参照を送信する。Files リクエストと、file id を含むモデルリクエストは `anthropic-beta: files-api-2025-04-14` を含める。すべてのリクエストはリダイレクトを拒否し、資格情報が構成されたオリジン上に留まるようにする。ファイル解決の失敗またはタイムアウトは、インライン予算の下でインライン base64 によりモデルリクエスト全体を再構築する。1 つのリクエストが file id とインライン画像を混在させることはない。呼び出し元のキャンセルはリクエストを停止する。

キャッシュされた id はエンドポイントと資格情報によってスコープされ、期限切れ前にリフレッシュされ、プロバイダーの stale-file エラーから無効化され、waiter ローカルのキャンセルを伴う singleflight を通じて解決される。アップロードは `expires_after[anchor]=created_at` と `expires_after[seconds]` で期限を要求する。Messages のファイルメタデータはリモートの期限を省略するため、そのローカル再利用期限は元のアップロード時刻に `fileExpiresAfterSeconds` を加えたものを使う。これはリモートでの削除を保証しない。クォータ障害は、1 回のアップロード再試行の前に、設定された 1 バッチ分の最も古い harness 所有ファイルを削除する。

Files モードは、保持するリクエストバージョンを `maxRequestFilesBytes` と `maxImagesPerRequest` で制限する。インラインフォールバックには独自の base64 予算がある。どちらも、設定されたバイト量子または件数量子で最古のプレフィックスを除去する。省略された各画像は、自身の表示名または添付 id と、利用可能な場合は正規化後の寸法、メディアタイプ、現在の読み取り専用パスを備えた、モデルに見える独自のプレースホルダーを得る。段階的な高水位ポリシーにより、新しい画像のたびに古いリクエストプレフィックスが書き換えられるのを避ける。

`reasoningEffort` は告知されるデフォルトを選ぶ。正確なモデルメタデータは、デプロイメントポリシーが thinking を許可する場合の選択指針とともに、`off`、`low`、`high`、`max` を強度の昇順で列挙する。`low`、`high`、`max` は thinking を有効化し、`output_config.effort` としてシリアライズされる。一方、アダプター所有の `off` は代わりに `thinking.type: disabled` を送信する。サポートされない値はネットワーク I/O の前に `UNSUPPORTED_REASONING_EFFORT` で失敗し、`thinking: disabled` はプラグインロード時に `off` 以外のあらゆる effort を拒否する。アダプターは明示的な `temperature` を転送する。DeepSeek は thinking 有効時にもこれを受け入れるが、そのモードでは値は無視される。

### 動的設定

接続オプションは、操作ごとに 1 回、揮発性の Config 参照からキャプチャーされる。Config の検証は、フォームへの永続化の前に無効な候補を拒否する。資格情報は、エンドポイント、画像と Files のポリシー、アイドル予算と同じスナップショットから解決される。添付サービスはリクエスト時に解決される。

### プロバイダー固有のリクエストフィールド

`ctx.deepseekLlmApiExtensions` が存在する場合、アダプターは `fetch` の前に、正確にシリアライズされたベースリクエストから、登録済みのトップレベルフィールドを準備する。レジストリは準備に失敗したフィールドを省略し、フィールドの衝突は HTTP の前に失敗する。2xx レスポンスの後、アダプターは SSE を消費する前に、キャプチャーされたすべてのコントリビューションを受け入れる。トランスポート障害と非 2xx の失敗はそれらを受け入れない。拡張フィールドを含むベースリクエストのシリアライズに失敗した場合、アダプターはベースリクエストのみを送信し、受け入れをスキップしてコントリビューターが後で状態を再送できるようにし、省略されたフィールドを名指す警告をログに記録する。シリアライズ、受け入れ、リプレイ劣化の警告はルートごとに 1 回ログに記録される。同梱の構成はこれを、デフォルトで有効な増分 `dsh_session_log` フィールドと、デフォルトで有効なアクティブ `dsh_plugin_packages` インベントリーに使う。どちらもモデル入力の外にとどまる。

### 障害と復旧

設定は Messages のみを受け入れ、`protocol` フィールドを持たない。解決が `protocol is not configurable` を報告する場合は、`$DSH_HOME/profiles/<profile>/cordis.patch.yml` の `llm-deepseek` エントリーの `config` から、およびそれを上書きするホームパッチやコマンドラインオーバーレイから `protocol` を削除する。意図した `baseURL`、`apiKeyEnv`、`models` フィールドは残す。アダプターの検証に拒否された保存済み設定は、修正されるまで後続のリクエストを失敗させる。Models カードで他のフィールドを保存しても、未知のプロパティは削除されない。設定ファイルを編集し、プロファイルに HMR 経由で再ロードさせるか、HMR が無効な場合はプロファイルを再起動する。

成功した Files レスポンスは有効な JSON を含まなければならない。upload、list、retrieve、delete の JSON デコード失敗は `INVALID_RESPONSE` をスローし、メッセージに操作と HTTP ステータス、`LlmError.failure` にステータス、`cause` に元のパーサーエラーを含める。ボディ読み取りのトランスポートエラーとキャンセルエラーは、その同一性を保持する。

非 2xx レスポンスは安定したコードで失敗する: `AUTH` (401/403)、`QUOTA`、`RATE_LIMIT`、`CONTEXT_WINDOW_EXCEEDED`、`INVALID_REQUEST`、`SERVER`、それ以外は `HTTP_<status>`。レスポンス前のトランスポート障害は `TRANSPORT` をスローし、呼び出し元のアボートは `ABORTED` をスローし、ストリームのアイドル期限切れは `TIMEOUT` をスローする。リクエスト拡張フィールドの衝突、または直接指定された `prepareExtensions` からの拒否された準備は `REQUEST_EXTENSION` で失敗し、メッセージに原因チェーンを追記する。2xx 後の受け入れ失敗はログに記録され、レスポンスは引き続きストリーミングされる。正規化画像の拒否は、プロバイダーが file id を特定しない場合、妥当なすべての添付とその永続位置を名指しする。stale-file の拒否は、1 回のアップロードインデックス更新で、名指しされたすべてのマッピング（またはその試行が使ったすべてのマッピング）を削除し、1 回の置換モデルリクエストを許可する。プロトコル違反は `STREAM_CLOSED` または `MALFORMED_RESPONSE` をスローし、コンテンツブロックのない終端の `stop` は `EMPTY_RESPONSE` になり、デフォルトの再試行ポリシーがそれを再試行する。公式ルート上の API キーなしのリクエストは `MISSING_CREDENTIAL` で失敗し、不正な形式の資格情報は、修正すべき参照を名指す `INVALID_CREDENTIAL` で失敗する — キーのいかなる部分も決して名指さない。

プロバイダープラグインがカタログの可用性を所有する。API キールートは、API キーが解決される間、設定された `models` を提供し、アカウントルートは、サインイン中にアカウントの一覧を提供する（[アカウントプロバイダー](../llm-deepseek-account/README.md)を参照）。トランスポートは、同梱のカタログ、カタログエントリーのフィールドスキーマ、およびケイパビリティ解決を提供する。プロバイダーはさらに `connect(signal)` を提供できる。これは、カタログのロードのようなプロバイダー所有の処理の後に、正確なモデル検索と準備済み呼び出しのために接続を解決する。また `admit(connection, model)` も提供でき、これはネットワーク I/O の前にモデルを拒否する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションではアダプター背後の設計を説明する。観測可能な動作は[このパッケージを使う](#use-this-package)で完全に扱っている。

### 設計方針

このプラグインは、1 つの明示的な解決ステップと 1 つの登録ファクトに基づいて構築されている。`resolveAdapterOptions()` は、生の設定から検証済みの接続ファクトへの唯一の経路であり、アダプターは操作ごとに 1 回、サンクを通じてそれらのファクトを読み直す — ベース URL、カタログ、リクエストのデフォルト、画像と Files のポリシー、アイドル予算はすべて次のリクエストで有効になり、実行中のストリームは開始時のファクトを保持する。登録時にキャプチャーされる唯一のファクトは再試行ポリシーである。その解決値が変わると、プラグインは 1 つの同期セクション内でルートをその場で再登録するので、どのリクエストもギャップを観測しない。

### ソースマップ

[`src/index.ts`](src/index.ts) はプロトコルライブラリをエクスポートし、[`src/host.ts`](src/host.ts) はプロバイダープラグイン用の共有 Host サービスをバインドする。[`src/adapter.ts`](src/adapter.ts) がリクエストライフサイクルを所有し、[`src/serialize.ts`](src/serialize.ts) と [`src/translate.ts`](src/translate.ts) がモデル入力とストリーミング出力をマップする。[`src/file-store.ts`](src/file-store.ts) が [`src/files-api.ts`](src/files-api.ts) を通じてアップロードの再利用と復旧を所有する。

### wire の流れ

1 回の `stream()` 呼び出しは通常 1 回のモデルリクエストを行う。決定論的なリクエスト画像を解決し、Files id を優先し、登録済みのトップレベルリクエスト拡張を準備し、解決済みの `baseURL` から fetch し、HTTP 2xx の後に拡張トランザクションを受け入れ、SSE ストリームを harness プロトコルに変換する。ファイル解決の失敗は最初のリクエストをインラインにし、プロバイダーの stale-file レスポンスは 1 回の置換試行を許可する（置換の解決に失敗した場合もインラインになる）。すべてのモデル呼び出しと Files 呼び出しは共有のアトリビューションを運ぶ。モデルリクエストはさらに、モデル入力の外で安定した匿名ユーザー id を、存在する場合はセッション id も運ぶ。reasoning 履歴は必要なときにシリアライズして戻され、キャッシュ会計が DeepSeek のキャッシュヒット指標を harness の使用量にマップする。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときにこれらのページを読む。サービス契約から、双子のアダプター、再試行エグゼキューター、共有型へと進む。

- [dsh-llm サービス](../llm/README.md) — このアダプターが登録するプロバイダー中立のサービス。
- [llm-pi-ai アダプター](../llm-pi-ai/README.md) — 他のプロバイダーとゲートウェイにサービスを提供する、ライブラリベースの双子。
- [LLM ストリーミングサブシステム](../../../docs/subsystems/llm-streaming.md) — `StreamChunk` プロトコルとアダプター契約。
- [llm-retry](../llm-retry/README.md) — このアダプターの `retryPolicy` を適用する再試行エグゼキューター。
- [DeepSeek リクエスト拡張](../deepseek-llm-api-extensions/README.md) — プロバイダー固有のトップレベルフィールドのライフサイクルと受け入れセマンティクス。
- [セッションログのアップロード](../../session/session-log-deepseek/README.md) — デフォルトで有効な増分 `dsh_session_log` コントリビューション。
- [プラグインパッケージインベントリー](../plugin-package-inventory-deepseek/README.md) — デフォルトで有効な `dsh_plugin_packages` コントリビューション。
- [双子の LLM アダプター](../../../.agents/notes/implemented/architecture/2026-06-13-twin-llm-adapters.md) — DeepSeek が構造の異なる 2 つのアダプターを同梱する理由。
- [必須のアプリ attribution ヘッダー](../../../docs/subsystems/llm-streaming.md) — すべてのプロバイダーリクエストが運ぶアイデンティティ。

-----

<a id="model-experience"></a>
## モデル体験

### DeepSeek リクエスト

#### モデルが見るもの

選択された DeepSeek モデルは、harness のシステムプロンプト、メッセージ履歴、ツールスキーマ、停止シーケンス、および呼び出し設定（`maxTokens`、`reasoningEffort`、`temperature`）を、アダプターが書いたプロンプト文なしで受け取る。プロバイダー固有のリクエスト拡張フィールドはモデル入力の外にとどまる。vision モデルは通常、保持されたユーザー画像とツール結果画像を、添付ハンドルとリクエストプレビュー寸法の隣に Files API 参照として受け取る。現在の実行ファイルシステムが添付プロバイダーのホストオブジェクトをマップしている場合は、正規化オブジェクトのパスも受け取る。記述子はこのコピーを読み取り専用とマークし、正規化によってアップロードのサイズ変更や再エンコードが行われた可能性があることを警告する。Files 解決の失敗は、代わりにすべての保持画像をインライン base64 として送信し、予算超過の古い画像はそのリクエスト用に解決されたアクセスをプレースホルダー内に保持する。以前のアシスタントターンの reasoning コンテンツは、そのターンがツールを呼んだかどうかに関係なく、そのまま渡し戻される。Messages は、不正な JSON であるかオブジェクトでない履歴ツール引数に対して `{}` を送信する。この引数フォールバックは呼び出し id、ツール名、ツール結果を保持し、元の引数は Session ログにとどまる。新しく生成される Messages のツール引数は依然として有効な JSON オブジェクトを必要とする。Messages は、ユーザーメッセージとツール結果の中の `reasoning` ブロックと `tool-call` ブロックを省略する。これにより、アシスタント出力を含む保存済み subagent 通知のリプレイも可能になる。元の Session 内容は無傷のまま残る。空のユーザーメッセージは変換後にスキップされ、空のツール結果は呼び出し id とエラーフラグを保持する。その他のサポートされない入力ブロックは依然として `UNSUPPORTED_CONTENT` で失敗する。

#### トークンへの影響

正確なテキストと画像トークンの入力は、プロバイダーのトークン化が左右する。アダプターはルートごとの `imageRequestPricing` を宣言する。ログに記録された image-offload 決定によって選択された各出現はそのプレースホルダーテキストとして、保持された各画像は公表済みの vision 会計（14px パッチグリッド、3:1 ダウンサンプリング、544×544 のスケールアップ下限、1024 トークン上限）を用いた投影寸法で価格付けされる。これによりトークンメーターはリクエストの前に画像の圧力を価格評価できる。報告される使用量は引き続き権威である。reasoning のパスバックは、reasoning を行ったすべてのターンの思考の連鎖を後続のリクエストに持ち込み、オフロードされた画像は視覚トークンのコストを生じなくなる。保持された出現が、正確なリクエストバージョンのバイト数で file モードまたはインラインフォールバックの予算（`maxRequestFilesBytes`、`maxImagesPerRequest`、両量子）を超えるリクエストは、オフロードすべき追加の最古出現を名指す `IMAGE_OFFLOAD_REQUIRED` で失敗し、`dsh-compaction-image-offload` が選択された出現を `image/offload` イベントに記録して再試行する。キャッシュ読み取りの使用量は利用可能な場合に報告される。Messages の合計には、非キャッシュ入力、出力、キャッシュ読み取り、キャッシュ書き込みのトークンが含まれる。`imageRequestTarget(provider, model, image)` は同じリクエスト画像の寸法とバイトターゲットをスクリーンショットの消費者に公開する。画像リサイズを持たないアダプターは正規化されたソースを保持する。

#### KV Cache の影響

変更されていない組み立て済みプレフィックスは DeepSeek のキャッシュ再利用の対象であり、このアダプターはそれを使用量に報告する。決定論的なリクエスト画像バイトは、プレフィックス全体を不変にするわけではない。実行ワールドパスの変更は履歴の記述子テキストを書き換え、アップロードのリフレッシュは `file_id` を差し替え得て、Files から base64 へのフォールバックは画像表現を変える。これらのいずれか、またはモデルルート、プロンプト、スキーマ、履歴、画像予算の変更は、影響を受ける最初のトークン以降の再利用を妨げ得る。reasoning のパスバックは reasoning を行ったすべてのターンで追記される。`systemPromptUpdate: in-history` を宣言するカタログエントリーでは、継続するリクエスト列の途中でのシステムプロンプト変更はキャッシュ済み履歴の後に追記されるため、その履歴までのプレフィックスは再利用可能なまま残る。ツールスキーマの変更は依然として、変更された最初のトークン以降の再利用を妨げる。

### DeepSeek レスポンス

#### モデルが見るもの

reasoning、テキスト、および生文字列のツール引数は、ループがログに記録して組み立てるための harness チャンクに変換される。

#### トークンへの影響

生成されるトークンは、リクエストでログに記録された reasoning effort と `maxTokens` に従う。後の入力に影響するのは、ループが保持したブロックだけである。

#### KV Cache の影響

ループが保持したレスポンスブロックは次のリクエストに追記され、それ以前の再利用可能なプレフィックスを保持する。破棄されたブロックは後のキャッシュに影響しない。プロバイダーまたはモデルを変更すると、別のキャッシュドメインが選択される。

## 既知の制限と延期された作業


<a id="known-limitations-and-deferred-work"></a>


これらの制限は、アダプターがどこで止まり、将来の作業がどこから始まるかを定義する。これらは現在のパッケージ制約であり、一般的な DeepSeek の比較やタスクバックログではない。

- **`models` を置き換えるとカタログリスト全体が置き換わる** — 1 つのモデルエントリーを変更するときはパス編集を使う。
- **`tool_choice` はマップされない** — コア語彙の一部ではない（pi-ai の双子と共通）。
- **リクエストは `@cordisjs/plugin-http` ではなく生の `fetch` を使う** — 共有のプロキシ設定やインターセプト設定はない。
- **Messages の in-history システム更新には、保持された user または tool-result ターンが必要** — 更新後のすべてのユーザー入力が省略され、直前の wire ターンがアシスタントの場合、シリアライズは次のアシスタントの前またはリクエストの終わりに `UNSUPPORTED_CONTENT` で失敗する。テキストまたは空のツール結果でそのターンを保持できる。更新をより早いターンへ移動することはサポートされない。[入力履歴リファレンス](README.md)がこの順序制約を記録している。
- **画像は入力専用の永続添付である** — 直接の外部 URL とアシスタントの画像出力はサポートされない。DeepSeek 入力は通常 Files API を使い、インライン base64 はリクエストごとの復旧にのみ使う。
- デフォルトカタログは、ゲートウェイの可用性をプローブすることなく、`deepseek-flash` とそのテキスト/画像および in-history ケイパビリティを告知する。ゲートウェイが id を有効にするまで、リクエストは `INVALID_REQUEST` で失敗し得る。
- [adapter.e2e.ts](tests/adapter.e2e.ts) と [runtime.e2e.ts](tests/runtime.e2e.ts) の実 API チェックには `DEEPSEEK_API_KEY` が必要である。システム更新チェックを実行するには、サポートされる空でないモデル id を `DEEPSEEK_IN_HISTORY_MODEL` に設定する。アダプタースイートは `high` effort を使い、ランタイムスイートは thinking を無効にしてキャッシュ再利用を比較し、指示追従の不安定さに敏感になり得る。ランタイムの画像ケースにはさらに `DEEPSEEK_FLASH_E2E=1` または `DEEPSEEK_VISION_E2E=1` が必要である。

<a id="dev-note"></a>
### 開発メモ

なし。

`deepseek-official` は自身に設定された API キー参照のみを使い、`deepseek-account` は、アカウントプロバイダーの許可された推論オリジンに対する保存済みの DSH グラントのみを使う。どちらのルートも、独立に構成されたモデル設定とファイル設定を備えた Messages トランスポートを共有する。アカウント資格情報が欠落しているか不適格な場合、リクエストはサインインプロンプトとともに拒否される。どちらのルートも他方にフォールバックしない。Chat と Files のリクエストはリダイレクトを拒否する。サインアウトのキャンセルは、ツール実行を含む、実行中 Agent のログに記録されたリクエストコンテキストを使ってアカウントプロバイダーが所有する。トランスポートは既存のリクエストアボート signal を受け取る。
