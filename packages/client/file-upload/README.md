---
description: "1 つのセッションに宛てたブラウザーファイルアップロード。ストリーミング取り込み、進捗、キャンセル、後のプロンプトのためのステージ済み受領証を備える。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-file-upload

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージを使うと、ブラウザー機能が 1 つのセッションのために `Blob`、正確なバイト列、または `ReadableStream<Uint8Array>` を格納し、後のプロンプトのための不透明な受領証を受け取れる。提供されたページは Blob とストリーム本体をページスレッドでバイト列に集約せずに送信する。ホストが別の実行コンテキストで動作するページは Cordis 起動前に Fetch 形状のキャリアを供給する。呼び出し元は消費バイト数を観察し、進行中の操作をキャンセルできる。ストリーム本体は 1 回だけ消費され、Worker 境界を越えるときに所有権を移転する。正確なバイト列は生成されたリモートを使う。

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

`fileUpload` を注入するコンシューマーの前にこのパッケージをマウントし、`ctx.fileUpload.upload(sessionId, body, name, signal, onProgress)` を呼び出す。セッション identity が生ルートと生成されたリモートフォールバックの両方に宛てるため、呼び出し元はどちらのリクエストも組み立てない。

```yaml
- id: file-upload
  name: '@deepseek-ai/dsh-client-file-upload'
```

このパッケージに Cordis 設定フィールドはない。`Blob` は専用 Worker 内で XMLHttpRequest を使い、ブラウザーのアップロード進捗を報告する。ブラウザーが提供する場合は合計値も含む。`ReadableStream` はその Worker に転送されて Fetch に逐次供給する。進捗は合計値なしで消費バイト数を報告する。`AbortSignal` は専用 Worker を終了させるか、ページ所有のキャリアに到達する。正確なバイト列は生成されたリモートを使う。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

クライアントプラグインは `ctx.fileUpload` を提供する。その `upload()` メソッドは所有セッション identity を受け取り、生ルートリクエストを組み立て、正確なバイト列のために生成されたリモートを呼び出す。プロバイダーは任意の Cordis 起動前 `__DSH_FILE_UPLOAD__` フックを 1 回だけ読む。フックがなければ、各 Blob またはストリーム要求は短命な Worker を所有し、完了、失敗、キャンセル後に解放する。フックがあれば、サービスはページ所有の Fetch キャリアを通じて本体を送信する。Web Worker ランタイムはストリーム本体をリクエストフレームを通じて転送し、ホスト HTTP ブリッジにバックプレッシャー付きチャンクとして公開する。

ホストプラグインは `ctx.fileUploads` を提供する。認証済みストリーミングルート、符号化されたリモートフォールバック、コマンド受領証リゾルバー、ステージ済み受領証ライフサイクルを所有する。符号化された受付、添付ファイルエラー認識、バイト格納は `ctx.attachments` の背後に残る。ホスト呼び出し元はランタイム所有 Context 付きのエージェントを供給する。受領証テーブルはそのエージェントの正確なセッションオブジェクトをキーとする。セッションコントローラーはコールドな通常エージェントを再開できるリゾルバーを登録し、プロンプト受付時に受領証を消費する。プロンプト配信は各受領証束縛を破棄可能なトランザクションに保持する。正常な配信のコミットまで以前の束縛は復元され、キューまたは履歴観察がコミット済みの受領証を廃止する。

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | ホストストリーミングルート、添付ファイルサービス受付、セッション所有の受領証ライフサイクル |
| [`src/types.ts`](src/types.ts) | 符号化要求、受領証、永続的な結果型 |
| [`src/client/contract.ts`](src/client/contract.ts) | クライアントアップロード、進捗、ページフック型 |
| [`src/client/runtime.ts`](src/client/runtime.ts) | 専用 Worker とページ所有キャリアの実装 |
| [`src/client/index.ts`](src/client/index.ts) | クライアントプラグイン登録と `ctx.fileUpload` 宣言 |

</details>

各アップロード受領証は正確に 1 つのセッションに属し、各要求は選択された 1 つのキャリアを使う。未対応のストリームキャリアは本体送信前に失敗する。

-----

<a id="further-exploration"></a>
## さらに調べる

- [Connection](../connection/README.md) — 認証済み RPC、正確なホストルート、接続世代。
- [Session Controller](../../api/session-controller/README.md) — ステージ済み受領証を消費するプロンプト受付。
- [Web Worker ランタイム](../../experimental/webworker-runtime/README.md) — ページからホストへの Worker 要求トンネル。
- [クライアントグループマップ](../README.md) — ブラウザーサービスと UI 機能パッケージ。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはブラウザー要求本体を転送するだけで、モデル入力に寄与しない。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダー要求を組み立てず送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

これらの制限は転送操作自体に適用される。

- **アップロードは再開できない** — 失敗やキャンセル後の再試行は先頭バイトから開始する。
- **ストリーム本体は使い切りである** — `ReadableStream` の転送は呼び出し元のオブジェクトをロックするため、再試行には新しく作成したストリームが必要である。
- **ストリーム進捗に合計値はない** — ストリーム API がバイト長を運ばないため、呼び出し元は消費バイト数のカウントを受け取る。
- **ブラウザー Worker は自己完結である** — そのソースは関数文字列から生成される。ランタイムインポートを追加するには、スタンドアロンの Worker エントリーに移動して tsdown でバンドルする必要がある。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
