---
description: "Record speech and insert reviewable transcripts into the conversation draft."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-client-ui-voice-input

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

この任意ブラウザープラグインはモデルセレクターと Send の間に輪郭マイクアイコンを追加します。認識準備完了時、クリックは測定音声レベル付きの録音ツールバーを開き、Cancel と Stop を持ちます。波形は録音ボタンより短いままです。停止は下書きに文字起こしします。認識設定とモデル準備はプラグイン設定に存在します。言語選択は選択プロバイダー由来です。

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

Plugins から[音声入力バンドル](../voice-input-bundle/README.md)を有効化します。キャッシュ検査後、不足モデルは Go to setup と Later アクション付きのセットアップ案内を起動します。Go to setup はバンドル詳細を開きます。Download and prepare はそこで導入を開始します。無事なキャッシュ済みモデルは案内も繰返し導入も不要です。認識準備前、案内はクリック時のみ現れ、マイクツールチップはありません。マイクのクリックは同じ案内ダイアログを開きます。そのアクションは録音や取得なしに音声バンドル詳細を開きます。キャッシュ検査、準備進行中、失敗、切断サービスは代わりに状態、進行、エラー詳細への案内を提供します。ダイアログはフォーカスを案内アクションに移動し、Tab 移動を内部に保ちます。Later または Escape は下書き変更や送信なしに prior フォーカスを復元します。準備前、ローカルプロバイダーは推定ディスク、メモリー、セットアップ時間要件を表示できます。準備概要は折畳み開始です。展開して完了、現行、保留手順を検査します。準備完了後、マイクをクリックし、アクセスを許可して Stop をクリックすると文字起こしします。Cancel または Escape は収録を破棄します。認識フィードバックはツールバー内に留まります。プロバイダーと言語設定はバンドル詳細から Settings サービス経由で保存されます。ブラウザーマイクアクセスは HTTPS またはループバックと OS 権限が必要です。

バンドル詳細のネイティブ **Input device** セレクターでシステム既定に従うか、ブラウザーマイクを選択します。システム既定は利用可能時現行デバイス名を表示します。バンドル詳細有効中、選択入力のライブレベルはフィールド右に可視のままです。別入力選択はそのデバイス向けプレビューを再開します。ページの非表示や離脱、プラグイン無効化は遅延権限付与も含めプレビューを解放します。ブラウザーはホスト認識設定と独立に以降録音向けデバイスを記憶します。デバイス挿抜は利用可能な選択入力を中断せず選択肢を更新します。切断選択は名前と位置を保持し、Unavailable ラベル付き無効選択肢として残ります。ページ有効中の再接続はプレビューを復元します。別入力選択は不可用選択肢を除去します。中断録音は明示再開が必要です。権限拒否は他選択を利用可能に保ちます。明示選択デバイスは黙って別入力にフォールバックしません。

ダウンロードや再試行前、**Model download source** は Automatic とホスト宣伝オリジンを提供します。SenseVoice は通常 Hugging Face と HF-Mirror を提供します。固定非公開配置は設定済みオリジンのみ公開します。手動選択はそのソースのみ使い、Automatic はプロバイダーの比較とフォールバック方針を保持します。選択は現行カードの再試行に保持され、配置設定や認識設定は変えません。ソース制御は準備中利用不可であり、リソース準備完了時は非表示です。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Maintainer details — click to expand</summary>

ネイティブ MediaRecorder は音声を収録し、Web Audio は最終レコーダーチャンクのフラッシュ後にホスト PCM 形式に変換します。入力レベルプレビューは MediaRecorder 作成なしに Web Audio を使います。マイク権限要求中のウィンドウブラーは収録をキャンセルしません。録音中のブラーはキャンセルします。収録失敗は直ちに録音 UI を終了し、ツールバー内に再試行を提供します。キャンセル、失敗、プラグイン破棄は 1 つのリソース解放 promise を共有します。プラグインは AudioContext 閉鎖確定まで所有権を保持します。元エディター選択は下書きリビジョンを運びます。変更下書きは明示挿入または破棄向けにマイク脇に transcript を保持します。セッション変更、収録中のページ非表示、プラグイン破棄は遅延結果を無効化しトラックを解放します。1 つのプラグイン所有準備購読が作曲者、導入案内、詳細に役立ちます。これらビューは既存スロットライフサイクルを使い、準備タスクを所有しません。

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

- 自動送信、常時マイク、ウェイクワード、ストリーミング字幕、音声合成はありません。「ローカル」はホストマシンを意味し、ブラウザーマシンと異なることがあります。

-----

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Maintainer details — click to expand</summary>

None.

</details>
