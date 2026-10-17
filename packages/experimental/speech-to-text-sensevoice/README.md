---
description: "Prepare and operate a local CPU SenseVoice worker on demand."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-speech-to-text-sensevoice

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このプロバイダーはホスト CPU 上で SenseVoiceSmall ONNX と Silero VAD により音声認識します。プラットフォーム固有 sherpa-onnx Node パッケージは ONNX Runtime を含みます。ユーザーは Python、コンパイラー、モデル変換を必要としません。有効化はモデル読込やアセット取得なしにキャッシュ済みリソースを確認します。

## 目次

- [このパッケージの利用](#use-this-package)
- [実装の理解](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの利用

[バンドル](../voice-input-bundle/README.md)は DSH ホーム配下の絶対 `dataRoot` を提供します。準備はリビジョンピン留めモデルファイルをダウンロードし、サイズと SHA-256 ハッシュを検証してから読込みます。`precision` は既定 `int8` です。`fp32` は大型リファレンス重みを選択します。`modelDirectory` は選択 ONNX ファイルと `tokens.txt` を含む既存絶対ディレクトリーを提供します。`vadModelPath` は既存 Silero ONNX ファイルを選択します。検証済み完了ファイルはキャンセルや失敗後も再利用可能です。

不足アセットの各ダウンロード前に、ホストは Hugging Face 互換 `modelOrigins` を比較します。既定は `https://huggingface.co` と [HF-Mirror](https://hf-mirror.com) です。同時 HEAD 要求はピン留めファイルパスとリダイレクトをホスト fetch プロキシー経由でたどります。最初の 2xx 応答が先に試されます。`modelProbeTimeoutMs` は既定 3000 ms です。すべてのプローブ失敗時は設定順でダウンロードします。ネットワーク、HTTP、証明書、完全性失敗は残りソースを試します。キャンセル、保存失敗、未分類失敗は準備を停止します。ピン留めリビジョン、サイズ、SHA-256 ハッシュはすべてのソースに適用されます。応答遅延はダウンロードスループットを測定しません。準備期限は完全ダウンロード全体をなお制限します。

明示 `modelOrigin` はプローブや公開フォールバックなしにそのオリジンのみ使います。単一エントリー `modelOrigins` もプローブを省略します。検証済みキャッシュと明示オフラインパスはソース要求不要です。音声 UI は準備や再試行前に宣伝ソースを提供します。手動選択はそのタスクのみ選択を上書きし、フォールバックなしに 1 ソースを使い、有効タスクのソースを置換できません。ホストは設定オリジン外の選択を拒否します。完全オフライン配置はダウンロードソースを宣伝しません。

ダウンロード失敗はアセットとソースオリジンを識別し、利用可能な場合は分類済み原因と HTTP 状態または診断コードを付けます。公開状態は URL 認証情報、クエリー文字列、生原因メッセージを省きます。再試行は検証済みファイルを再利用します。部分ダウンロードは再開します。

すべての有効化は選択モデル、トークン、VAD をディスク上で確認します。完全検証済みキャッシュは検査直後に準備完了を復元します。最初の録音がワーカーを起動します。不足ファイルや管理チェックサム不一致は明示準備を要求し、読取不可パスはエラーを報告します。明示配置パスは到達可能性を確認します。その内容は配置者の責任のままです。プラグイン無効化やホスト再起動は無事なキャッシュの再取得を要求しません。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Maintainer details — click to expand</summary>

1 つの管理 Node サブプロセスが推論を直列化します。起動中の提出録音は有界キューに参加します。実行時、ワーカーは ready または standby リソースを要求します。文字起こしは準備ダウンロードを開始しません。`threads`、`segmentSeconds`、`vadThreshold`、`minSpeechSeconds`、`minSilenceSeconds`、`vadOnsetPaddingSeconds` は CPU 推論と分割を調整し、最後はコールド検出器が遅れて報告する開始を復元します。`maxPending` は受付処理を制限します。準備と推論は別期限です。無効言語や WAV 入力はネイティブ推論前に拒否され、読込済みワーカーを保持します。推論失敗、不正応答、転送失敗はワーカーを回収します。キャンセルは有効ワーカーを終了し、そのプロセス範囲を結合します。キャンセル済みキュー録音は実行されません。`idleTimeoutMs` は無活動後にワーカーを解放し、ゼロは破棄まで保持します。モデルはキャッシュ残留します。認証済みループバック要求は音声をメモリー内に保ちます。Electron ワーカーは Node モードで実行し、V8 メモリーケージを満たすため VAD バッファーをコピーします。

ホストはページやセッションまたぎに準備を所有します。リソース確認、認識重みとトークンの取得、VAD 取得、ファイル検証、ワーカー読込です。明示モデルパスは対応ダウンロード手順を省きます。ダウンロードはバイトを報告し、他手順は経過時間を報告します。待機ワーカーは準備済みパスを保持し、起動時はモデル読込のみ必要です。準備結果公開後のキャンセルは、その結果を置換せずクリーンアップを待ちます。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

[Voice input subsystem](../../../docs/subsystems/voice-input.md)

-----

<a id="model-experience"></a>
## モデル体験

None, as recordings and preparation remain outside model requests; ordinary user submission owns any later text.

#### KV キャッシュ効果

直接効果なし。通常提出がメッセージ内容を所有します。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- CPU のみです。ネイティブパッケージ対象は macOS arm64/x64、Linux glibc arm64/x64、Windows x64 です。Windows ARM64 と Linux musl は検証済み配置対象ではありません。INT8 重みは約 239 MB、FP32 は約 938 MBにランタイムと VAD を加えます。モデルメモリーはファイルサイズを超え、録音長と共に増加します。インストール目安は見積りです。言語ヒントは auto、中国語、英語、広東語、日本語、韓国語です。プラグイン無効化はモデルキャッシュを保持します。パッケージ済み Desktop リリースはなおプラットフォーム署名とマイク権限承諾を要求します。Linux Desktop 配布はこのプロバイダー外です。

-----

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Maintainer details — click to expand</summary>

None.

</details>
