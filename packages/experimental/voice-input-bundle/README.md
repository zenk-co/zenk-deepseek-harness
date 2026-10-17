---
description: "Enable experimental speech input from the plugin manager."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-voice-input-bundle

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

音声 Service Definition、ローカル SenseVoice プロバイダー、認証済み Remote、ブラウザーマイク制御を組み合わせた任意バンドル。出荷プロファイルでは無効のままである。

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

Web サイドバーの Plugins を開き、青い波形アイコンの Voice Input を有効にする。モデルに準備が必要な場合、Go to setup または Later を選ぶダイアログが表示される。Go to setup はバンドル詳細を開く。キャッシュが完全な場合はセットアップ確認は不要である。詳細画面で Download and prepare を選択する。折りたたまれた現在のステップ概要を展開すると完全なステップリストが表示される。ダウンロードは実際のバイト数を報告し、検証と読み込みは経過時間を表示する。準備ができたら、モデルセレクターと Send の間のマイクをクリックし、Stop でトランスクリプトを挿入する。バンドル詳細は Settings サービスを通じて認識器と言語を保存する。バンドルを無効にすると実行中の作業は取り消される。キャッシュ済みアセットはディスクに残る。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>メンテナー向け詳細 — クリックで展開</summary>

静的な `cordis.patch.yml` が 4 つの音声行を追加し、デフォルト認識器として `sensevoice-local` を選択し、`dshHomePath` でプロバイダーキャッシュディレクトリを提供する。任意バンドルのインストールにより、デフォルトプロファイルで選択されなくてもパッケージが管理対象として利用可能になる。ブラウザー提供物は生成された Remote マウントを所有し、安定 API の Remote は実験的コードをインポートしない。

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

- 初期バンドルは 1 つのローカル認識器のみを提供する。追加のプロバイダーは同じサービスに異なる id で登録する。クラウド認識には明示的な新規プロバイダーとクレデンシャル設定が必要である。バンドルはモデルツール追加もエージェントループ変更も行わない。
- dsh のインストールにより、バンドルが無効でも `sherpa-onnx-node` とそのプラットフォーム固有ネイティブランタイム（ONNX Runtime を含む）がインストールされる。ランタイムのインストールは Download and prepare でダウンロードされるモデルとは別にディスクとダウンロードのコストを追加する。ネイティブパッケージのサイズはプラットフォームとバージョンによって異なる。

-----

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け詳細 — クリックで展開</summary>

なし。

</details>
