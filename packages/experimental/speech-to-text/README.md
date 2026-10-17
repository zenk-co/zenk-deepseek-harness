---
description: "名付き試験書記提供子と取消所有。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-speech-to-text

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

この Service Definition は `ctx.speechToText` 経由で名付き音声認識子を選択する。利用者は実行前に要求を解決し、提供子は独立に登録する。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに探る](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と後回しの作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

[音声入力 bundle](../voice-input-bundle/README.md)経由で読み込むか、服務と提供者と利用者を組み立てる。`defaultProvider` は必須であり登録済み id 厳密 1 つを選択する。bundle は `sensevoice-local` を供給する。`language` は省略言語暗示を供給する。欠落または重複提供子は明示に失敗する。

提供者は `downloadSources` 経由で準備起点を広告する。`prepare(id, options)` は 1 作業用に任意 `downloadSource` を転送し、提供者は選択を検証して有効準備中の出所変更を拒む。省略は提供子方針を保つ。出所選択は持続認識優好ではない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>メンテナー詳細 — クリックで展開</summary>

`resolve()` は提供者実体、記録、言語を捕捉する。`transcribe()` は引下げまたは置換された登録を拒む。登録破棄子は受付を閉じ、受付済み要求を中止し、提供子沈着に合流する。提供者は取消を名誉しなければならない。異なる認識子を選ぶ後退も音声上載もない。

`defaultProvider` と `language` は揮発 Config 項目である。`configure()` は `settings` 服務経由でこの插件の profile 項目に供給項目を書き込み、走行実体は載せ直さずに更新値を読む。組合既定は上書き保存まで当たる。Settings は Loader の Include 経路なしに設定済み id (`entry.options.id`) で項目に宛名付ける。`configure()` は `settings` または profile 項目なしに失敗し、保存前に選択提供子が支えない言語を拒む。提供者は `languages` 経由で受付言語暗示を広告し、`resolve()` は書記前に選択暗示を検証する。提供者所有の準備は完全 `SpeechSnapshot` 値で観測される。観測者を閉じても準備は取り消されない。

`./wave` 補助は Remote 利用者と生認識過程用に正準 16 kHz 単 PCM16 WAV を検証する。両者は標本復号前に不一致頭と長さを拒む。

</details>

-----

<a id="further-exploration"></a>
## さらに探る

[音声入力 subsystem](../../../docs/subsystems/voice-input.md)

-----

<a id="model-experience"></a>
## モデル体験

なし。録音と準備は模型要求の外に残り、通常利用者提出が後の文を所有するため。

#### KV キャッシュへの影響

直接の影響なし。通常提出が文内容を所有する。

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>

- 完全録音書記のみ対応する。流認識と音声合成に服務法はない。

-----

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー詳細 — クリックで展開</summary>

なし。

</details>
