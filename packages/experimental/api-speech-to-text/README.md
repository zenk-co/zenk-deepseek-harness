---
description: "Expose bounded transient transcription through the authenticated Web Remote."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-api-speech-to-text

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`speech` Remote はブラウザー録音を `ctx.speechToText` につなぐ。プロバイダー検出と、完全な録音 1 件の文字起こし呼び出しを公開する。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と後回しにした作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

音声 Service Definition と Typert と共に構成する。`maxAudioBytes` と `maxDurationSeconds` が受け付ける録音を制限する。有効時、ブラウザー UI はこのパッケージの生成 `/remote` 提供物をマウントする。

`prepare(providerId, { downloadSource })` は告知済みソース 1 件をプロバイダーに転送する。省略時は設定済みポリシーを保持する。カタログはピッカー用に `downloadSources` を運ぶ。プロバイダーは利用不可の選択と、アクティブタスクのソースへの変更を拒否する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>メンテナー向け詳細 — クリックで展開</summary>

`catalog()` はプロバイダー ID、デフォルト選択、録音上限を公開する。`transcribe()` は選択されたプロバイダーを解決する前に正規 base64 と 16 kHz モノラル PCM16 WAV を検証する。既存ゲートウェイが認証と取り消しトランスポートを所有する。音声は一時的であり、セッションイベントにも添付にもならない。認識テキストを記録するのはユーザーの後の通常送信のみである。

`follow()` は準備状態と現在の設定を含む完全なカタログをストリームする。`prepare()` は Host タスクを開始または参加する。`cancelPreparation()` はそれを明示的に取り消す。`configure()` は提供された設定フィールドを永続化する。切断された観測者は準備を取り消さない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

[音声入力サブシステム](../../../docs/subsystems/voice-input.md)

-----

<a id="model-experience"></a>
## モデル体験

なし。録音と準備はモデルリクエストの外に留まり、後の通常ユーザー送信がテキストを所有する。

#### KV キャッシュへの影響

直接の影響はない。通常の送信がメッセージ内容を所有する。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

- ファイルアップロード、永続トランスクリプト履歴、ストリーミングプロトコルは公開されない。Base64 は転送オーバーヘッドを追加し、録音は告知上限に縛られる。

-----

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け詳細 — クリックで展開</summary>

なし。

</details>
