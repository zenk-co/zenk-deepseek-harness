# 音声入力

日本語 | [English](voice-input.en.md) | [中文](voice-input.zh.md)

実験的な音声認識には 3 つの役割がある。[Service Definition](../../packages/experimental/speech-to-text/README.md) は名前付きプロバイダーをルーティングし、[SenseVoice プロバイダー](../../packages/experimental/speech-to-text-sensevoice/README.md) はローカル推論を所有し、[Remote コンシューマー](../../packages/experimental/api-speech-to-text/README.md) はブラウザに提供する。[オプションのバンドル](../../packages/experimental/voice-input-bundle/README.md)がそれらをマイク UI とともに構成する。

## プロバイダーの選択

`SpeechProviderId` は登録 ID をブランド化する。`SpeechProviderInfo` は表示名、受け付けられる `languages` ヒント、`host-local` または `cloud` の処理場所を運ぶ。`SpeechRequest` は WAV バイトとオプションのプロバイダー/言語選択を含み、`resolve()` は 1 つのキャプチャされたプロバイダーインスタンスを持つ `SpeechSpec` を生成する。プロバイダーがない場合や未サポートの言語は失敗する。置き換えや撤回は解決済みの作業を無効化する。音声が別のプロバイダーにフォールバックすることは決してない。

`SpeechProvider.transcribe()` は 1 つの完全な `SpeechInput` と `AbortSignal` を受け付ける。`Transcript` はプレーンな `text`、`audioSeconds`、`inferenceSeconds` を返す。プロバイダーはキャンセルを尊重し、登録解除が完了する前に作業を確定する。ローカルプロバイダーは呼び出しを直列化し、キューを制限し、ワーカーのライフタイムをセッションから独立して管理する。

## ブラウザと Host の所有権

ブラウザはマイクトラックと未送信のドラフトを所有する。`TranscriptionRequest` は正規の base64 PCM16 WAV を認証済み Remote を通じて送信する。`SpeechCatalog` は利用可能なプロバイダー、デフォルトの選択、録音のバイト数/時間制限を通知する。API は認識前にこのプロセス入力を検証する。

入力ファサードは、録音前にリビジョンを持つ選択をキャプチャする。`InputActions.insertText()` は、選択リビジョンが最新であり、送信が編集を許可している場合にのみ、1 つの undo 可能なプレーンテキスト編集を挿入する。拒否された挿入は、明示的な挿入のためにトランスクリプトを利用可能なまま残す。セッションの切り替えやプラグインの破棄は、遅れて届いた結果を無効化する。認識自体はセッションイベントを書き込まない。最終的なモデル可視テキストは通常のユーザー送信が所有する。

## 準備と設定

`SpeechProviderInfo.downloadSources` は準備用のオリジンを通知する。`SpeechPreparationOptions.downloadSource` はタスク用に 1 つを選択する。省略時はプロバイダーポリシーが保持される。SenseVoice は通知された選択を検証し、手動ソースをフォールバックなしで固定し、準備中のソース変更を拒否する。UI は現在のカードでの再試行用に選択を保持するが、それは永続化された認識設定ではない。

Host プロバイダーは、ページとセッションの変更をまたいで 1 つの準備タスクを所有する。Client はコンポーザー、セットアッププロンプト、バンドル詳細の間で 1 つの `follow()` サブスクリプションを共有する。オプションの `SpeechSetupEstimate` メタデータは、計測された進捗とは別に、プロバイダー固有の計画ヒントを提供する。`SpeechPreparationStepKind` は順序付きリソース操作を識別し、`SpeechPreparationStep` は各ステータスと開始時刻を記録する。完全な `SpeechPreparationState` は、キャンセルや失敗の後もこれらのステップを保持する。折りたたまれた UI は現在の操作を表示し、展開するとすべてのステップを一覧し、バイト進捗または経過時間は実行中のステップにのみ表示される。オブザーバーを閉じても準備がキャンセルされることは決してない。検証済みファイルは再試行とアイドルワーカーの回収を生き延びる。

失敗した準備には、対象アセット、ソースオリジン、分類された理由、オプションの診断コードまたは HTTP ステータスを含む `SpeechDownloadFailure` が含まれることがある。Client は回復のアドバイスをローカライズする。ダウンロードの生の原因は Host に残る。

マイクはモデルセレクターと Send の間の `conversation.input.activity` を占有する。クリックするとキャプチャが開始され、ツールバーが展開される。Stop は文字起こししてドラフトに挿入する。このアクティビティはエディターと送信アクションを保持し、ローカルのフィードバックを所有し、アンマウント時に展開を解放する。Cancel、Escape、またはページの非表示はキャプチャを破棄する。波形履歴は計測されたマイク振幅を表示する。バンドル詳細には認識設定、準備状態、進捗が含まれる。明示的な有効化は `plugins.bundle.activation` を使用して、モデルが不足しているユーザーをセットアップへ導く。リストにはバンドルの説明とスイッチのみが表示される。

## 設計の根拠

[音声入力の決定](../../.agents/notes/implemented/architecture/2026-09-16-experimental-voice-input.md)が、一時的な音声、明示的なプロバイダー選択、遅延ローカル準備を説明する。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される(doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。再生成は `pnpm run gen-cordis-catalog`)。言語版の違いは、ロケール固有のペアドキュメントパスのみである。シグネチャブロックは `ts cordis-catalog` フェンスを使用し、元のソース JSDoc を保持する。ディスパッチモードは [primer](../cordis-primer.md#dispatch-modes) で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxspeechcontroller--speechcontroller"></a>

### `ctx.speechController` — `SpeechController`

音声呼び出しが Agent をアクティブ化したり、Agent に送信したりすることは決してない。

```ts cordis-catalog
/**
 * Read provider choices without preparing a recognizer.
 * @returns available providers, resolved default, and recording limits.
 */
@Remote catalog(): SpeechCatalog

/**
 * Follow provider readiness independently of Session and preparation lifetimes.
 * @param signal - Client observation lifetime.
 * @returns initial and subsequent complete readiness snapshots.
 */
@Remote({ mode: 'stream' }) async *follow(signal: AbortSignal): AsyncIterable<SpeechCatalog>

/**
 * Persist the user's recognition preferences.
 * @param patch - changed preference fields.
 * @returns after preferences are saved.
 */
@Remote configure(patch: SpeechSelectionPatch): Promise<void>

/**
 * Start or join one Host-owned preparation task.
 * @param providerId - selected recognizer.
 * @param options - task-local source selection validated by the provider.
 */
@Remote prepare(providerId: SpeechProviderId, options?: SpeechPreparationOptions): void

/**
 * Explicitly cancel resource preparation.
 * @param providerId - selected recognizer.
 * @returns after the preparation task settles.
 */
@Remote cancelPreparation(providerId: SpeechProviderId): Promise<void>

/**
 * Validate and transcribe one recording through the explicit provider selection.
 * @param request - canonical WAV encoded as base64, provider id and language hint.
 * @param signal - Client cancellation or Remote contribution disposal.
 * @returns final transcript without adding a Session event.
 */
@Remote async transcribe(request: TranscriptionRequest, signal: AbortSignal): Promise<Transcript>
```

ソース: [`packages/experimental/api-speech-to-text/src/index.ts`](../../packages/experimental/api-speech-to-text/src/index.ts)

<a id="ctxspeechtotext--speechtotext"></a>

### `ctx.speechToText` — `SpeechToText`

1 つの Host 構成内のすべての文字起こしコンシューマーが共有するレジストリ。

```ts cordis-catalog
/**
 * Register one recognizer; duplicate ids fail without replacing the original.
 * @param provider - recognizer owned by the contributing fiber.
 * @returns idempotent disposer which rejects admission, cancels, and joins accepted work.
 */
register(provider: SpeechProvider): () => Promise<void>

/**
 * Read the current recognizer roster.
 * @returns available provider facts in registration order.
 */
listProviders(): readonly SpeechProviderInfo[]

/**
 * Observe complete readiness snapshots; a slow reader coalesces intermediate progress.
 * @param caller - observer lifetime, independent of any preparation task.
 * @returns an initial snapshot followed by the latest provider states.
 */
async *follow(caller: AbortSignal): AsyncIterable<SpeechSnapshot>

/**
 * Read provider readiness and current user preferences together.
 * @returns one detached complete observation.
 */
snapshot(): SpeechSnapshot

/**
 * Persist changed selection fields into this plugin's profile entry; the resulting language must be accepted by the selected provider.
 * @param patch - explicit provider or language changes.
 * @returns after the profile write and the live update it applies.
 */
async configure(patch: SpeechSelectionPatch): Promise<void>

/**
 * Start or join provider-owned preparation.
 * @param id - exact registered provider identity.
 * @param options - task-local source selection validated by the provider.
 */
prepare(id: SpeechProviderId, options?: SpeechPreparationOptions): void

/**
 * Explicitly cancel provider preparation without tying it to a browser connection.
 * @param id - exact registered provider identity.
 * @returns after the preparation task settles.
 */
async cancelPreparation(id: SpeechProviderId): Promise<void>

/**
 * Apply composition defaults and capture the selected provider. Missing providers and unsupported languages fail explicitly.
 * @param request - complete recording and optional selection.
 * @returns provider-pinned input for transcribe().
 */
resolve(request: SpeechRequest): SpeechSpec

/**
 * Execute exactly the resolved provider; no fallback sends audio elsewhere.
 * @param spec - resolved input; a withdrawn or replaced registration is rejected.
 * @param signal - caller cancellation.
 * @returns final transcript after provider settlement.
 */
async transcribe(spec: SpeechSpec, signal: AbortSignal): Promise<Transcript>
```

ソース: [`packages/experimental/speech-to-text/src/index.ts`](../../packages/experimental/speech-to-text/src/index.ts)
<!-- END GENERATED cordis-surface -->
