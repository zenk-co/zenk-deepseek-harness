# テキスト翻訳

日本語 | [English](translation.en.md) | [中文](translation.zh.md)

experimental の[翻訳器](../../packages/experimental/translator/README.md)は、匿名のブラウザエンドポイントまたは明示的に選択された有料のネイティブ Flash ルートを通じてテキストを翻訳する。表示、スケジューリング、Session アクティベーションはコンシューマーが所有する。Session に束縛されたリクエストは、アクティブな Session ライターを通じて再利用可能な結果を保持する。

## リクエストと結果

`TranslationProvider` は `bing`、`google`、`deepseek-account` または `deepseek-official` を選択する。`TranslationRequest` は `text`、`targetLanguage`、およびオプションの `sourceLanguage`、`provider`、ブランド付き `sessionId` を供給する。`resolve()` は明示的なルーティングを `TranslationSpec` に捕捉する: 設定されたプロバイダーはデフォルトで Bing になり、省略されたソース言語は自動検出を使う。一般的な中国語ロケールタグは選択されたプロバイダーの言語コードにマップされる。`translate()` は解決されたプロバイダーからプレーンテキストを返す。

このサービスは設定された `maxTextChars` を公開し、これは UTF-16 コード単位で測られる。コンシューマーは翻訳を要求する前に長い入力を分割する。各呼び出しはレスポンスのバイト数を制限し、レスポンスボディの読み取りをその期限に含める。呼び出し元のキャンセルとサービスの破棄は受理されたリクエストを abort し、破棄はそれらが決着するのを待つ。

## 失敗とデータ処理

`TranslationError` は `TranslationErrorCode` を持ち、テキスト制限、HTTP 失敗、無効なレスポンス、レスポンス制限、所有された期限、リクエスト失敗を区別する。`TRANSLATION_SESSION_REQUIRED` は永続化バックエンドまたは Session の欠落を拒否する。`TRANSLATION_SESSION_INACTIVE` はプロバイダーディスパッチ前に未キャッシュの非アクティブ Session を拒否する。`TRANSLATION_STORAGE_ERROR` は無効な保存レコードまたは耐久性失敗を拒否する。プロバイダー診断は送信テキストとレスポンスボディを省略する。失敗した呼び出しは別のプロバイダーを選択しない。レスポンスは外部 JSON として検証され、リダイレクトは拒否される。

`TRANSLATION_UNAVAILABLE` は、アクティブなビルトインオーナーまたは登録済みルートの欠落、未設定の資格情報、正確な `deepseek-flash` カタログメンバーシップの欠如、ディスパッチ前のオーナー・モデル構成（Official の `models` または Account の `modelOverrides`）・Official 資格情報参照の変更、プロバイダーの撤回、または reasoning effort が `off` でない準備済み呼び出しを拒否する。reason が `error` のネイティブ `finish` は `TRANSLATION_REQUEST_FAILED` にマップされ、欠落またはその他の非 `stop` の finish は `TRANSLATION_INVALID_RESPONSE` にマップされる。

Google はソーステキストを form POST ボディで受け取り、Bing は JSON POST ボディで受け取る。どちらもリモートサービスである。それらの匿名エンドポイントは、サポートされた開発者向けの可用性やクォータの保証を提供しない。地域ごとの接続性はユーザーのネットワークで確認する必要がある。

## 永続的な翻訳

Session に束縛された呼び出しはすべてのプロバイダーについて `plugin:translator/request` と `plugin:translator/result` を使う。リクエストは正確なソース、言語タグ、選択されたプロバイダー、レシピアイデンティティを保持し、成功した結果はそのリクエストシーケンスを参照する。オプションのリクエストメタデータはこれらのレコード型を変えずにプロバイダー固有の詳細を保持する。翻訳器は外部ディスパッチ前にリクエストをチェックポイントし、完了した結果は返す前にチェックポイントする。読み取り専用のキャッシュ参照はプロバイダー作業に先行し、ライブ Session を必要としない。失敗と不完全な試行は再利用可能なテキストを供給しない。新しいレコードはアクティブな Session の既存ライターを使う。翻訳器は書き込みハンドルを開かず、Session をアクティベートしない。翻訳レコードは元のイベントとモデル入力を保持する。Session のない匿名呼び出しはステートレスのままであり、有料ルートは Session を必要とする。将来のフォーマットマイグレーションをまたぐ experimental のレコード保持はベストエフォートである。

有料のキャッシュミスは、アクティブなビルトインの Account または Official オーナー、設定済みの資格情報、正確な `deepseek-flash` カタログメンバーシップを必要とする。名前とバージョンラベルは無関係であり、pi-ai は除外される。各ミスは thinking off の別個のテキスト専用クエリを準備する。その正確な config、system、一意のユーザーフラグメントは同じリクエストレコード内のオプションの `metadata.modelRequest` を占める。保存済みの結果はこの受理の前に読まれるので、資格情報の欠落は既存の翻訳を無効化しない。ネイティブのリクエスト拡張はメイン Session のアイデンティティを受け取らず、その完全なログをアップロードできない。

## 推論の表示

[オプションのバンドル](../../packages/experimental/cot-translation-bundle/README.md)は翻訳器を [GUI コンシューマー](../../packages/experimental/client-ui-cot-translation/README.md)と組み合わせる。その `cotTranslation` Remote は認証済みのブラウザ呼び出しを処理する。Session が非アクティブで保存済み結果がない場合、Host は通常の Session controller のアクティベーションに参加し、1 回リトライする。アクティベーションは通常のプリセットフック、再開マーカー、中断ターンの修復を保持する。キャンセルは呼び出し元の待機を止め、共有アクティベーションをキャンセルせずに後の翻訳呼び出しを防ぐ。バンドル設定は翻訳サービスとターゲット言語を選択し、`auto` はアクティブなインターフェース言語に従う。

`CotTranslationPreferences` は受理されたプロバイダーとターゲット言語を保持する。`CotTranslationSnapshot` はこれらの設定を翻訳器の現在の `maxTextChars` と適格なプロバイダー ID と対にする。ブラウザは翻訳コントロールを登録する前にこの Host スナップショットを読む。ローカル設定ストレージが利用できない場合も同様である。受理された設定更新と再接続は両方の値をリフレッシュし、変更されたリクエスト制限は展開されたテキストを再びキャンセルして分割する。

GUI は session スコープの単一スロット `conversation.chat.reasoning.body` に登録し、Chat のデフォルトエントリーを置き換える。両方のエントリーは公式の `conversation.chat.reasoning.content` Factory を再利用する。翻訳ラッパーは表示テキストを選択し、自身のツールバーとビュー状態を所有し、Markdown レンダリングを重複させずにローカライズ済みラベルを供給する。有効な間、GUI は完了した段落と長いストリーミング段落のリクエストサイズのプレフィックスを展開後にのみ翻訳し、完了した結果を現在の Session から復元する。そのローカルキャッシュはその開示を最適化するだけである。未完成のテールは元のまま残る。オリジナルはアクセス可能なままである。開示を閉じること、プロバイダーや言語を切り替えること、アンロードは未決着の呼び出しをキャンセルし、遅れて届く結果を除外する。プロバイダー失敗はオリジナルを保持し、明示的なリトライを要求する。翻訳テキストは元の Session イベントやモデル入力を決して置き換えない。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxcottranslation--cottranslationcontroller"></a>

### `ctx.cotTranslation` — `CotTranslationController`

Optional reasoning translation delegates Session-bound storage to the translator.

```ts cordis-catalog
/**
 * Read accepted translation preferences and the current request limit without sending text.
 * @param signal - browser query cancellation or Remote contribution withdrawal.
 * @returns authoritative preferences, eligible routes, and maximum UTF-16 text length per request.
 */
@Remote async limits(signal: AbortSignal): Promise<CotTranslationSnapshot>

/**
 * Translate one displayed fragment through the reader's selected provider.
 * @param request - original text and Session identity supplied by the Client; provider and explicit
 * target language match accepted preferences, while auto uses the browser locale.
 * @param signal - browser cancellation or Remote contribution withdrawal.
 * @returns translated text; an uncached inactive Session joins ordinary GUI activation before retry.
 * Failures omit the source and provider response. Cancellation stops this caller's wait, not shared activation.
 */
@Remote async translate(request: TranslationRequest, signal: AbortSignal): Promise<string>
```

Source: [`packages/experimental/client-ui-cot-translation/src/index.ts`](../../packages/experimental/client-ui-cot-translation/src/index.ts)

<a id="ctxtranslator--translator"></a>

### `ctx.translator` — `Translator`

One Host service with explicit routing, cancellation and quiescent unload.

```ts cordis-catalog
/**
 * Inspect eligible native routes without inference; saved results remain readable for unavailable routes.
 * @param signal - optional caller cancellation, combined with service disposal.
 * @returns anonymous choices followed by eligible explicitly selected paid routes.
 */
async availableProviders(signal?: AbortSignal): Promise<readonly TranslationProvider[]>

/**
 * Resolve provider and source-language defaults without sending text.
 * @param request - consumer text, destination and optional routing choices.
 * @returns a complete specification; exceeding `maxTextChars` throws `TRANSLATION_TEXT_LIMIT`.
 */
resolve(request: TranslationRequest): TranslationSpec

/**
 * Translate one resolved specification; the selected provider receives its text.
 * @param spec - complete routing and language choices from `resolve()`.
 * @param signal - optional caller cancellation, combined with service disposal.
 * @returns translated plain text, durably retained before return when a Session is supplied.
 * An uncached supplied Session must be active; otherwise rejects with `TRANSLATION_SESSION_INACTIVE` before dispatch.
 * Rejects provider/storage/limit failures and preserves cancellation reasons.
 */
async translate(spec: TranslationSpec, signal?: AbortSignal): Promise<string>
```

Source: [`packages/experimental/translator/src/index.ts`](../../packages/experimental/translator/src/index.ts)
<!-- END GENERATED cordis-surface -->
