---
description: "Machine-translate expanded reasoning while retaining the original text and saved results."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-client-ui-cot-translation

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

展開済みモデルリーズニングを別言語で読み、原文テキストに戻せます。Plugins パネルから翻訳サービスと対象言語を選びます。翻訳は表示リーズニングを選択外部サービスに送信し、非公開コードや会話詳細を含むことがあります。原文リーズニングはセッションとモデルコンテキストに残ります。

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

Plugins で[リーズニング翻訳バンドル](../cot-translation-bundle/README.md)を有効化し、リーズニング開示を開きます。バンドル有効化まで機能は現れません。そのバンドル詳細は段階式 Translation service と Target language 制御を提供します。Save は両設定を適用します。Bing が既定プロバイダーであり、`auto` は有効 UI 言語を対象にします。`zh`、`en`、`ja` のような明示言語コードはその選択を上書きします。

View original と View translation は翻訳本文上のプラグインツールバーに 1 つの常時可視アクションを共有します。プラグインはこのアクションと状態を所有します。Think タイトルは開示のみ制御します。両ビューは同じコンパクト Markdown レンダラーとタイポグラフィーを再利用し、リーズニングプレビューを変更せず別要求もしません。完了段落と長いストリーミング段落の要求サイズ接頭辞は非同期翻訳されます。未完末尾は原文のままです。失敗は原文本文を保持して Retry を提供します。再試行開始まで View translation は無効のままです。開示を閉じるかバンドル無効化はその要求をキャンセルします。

カスタム構成には、このプラグインを [translator サービス](../translator/README.md)および通常 Web GUI と並べてマウントします。プラグインの設定フィールドは `provider` と `targetLanguage` です。生成済みの[設定カタログ](../../../docs/config-catalog.md)が完全スキーマを所有します。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Maintainer details — click to expand</summary>

ブラウザーは Chat の `conversation.chat.reasoning.body` 単一スロットにラッパーを登録し、公式 `conversation.chat.reasoning.content` Factory 経由で原文または翻訳テキストをレンダリングします。ラッパーはツールバーとビュー状態を所有し、ローカライズ済み Markdown ラベルを Factory に渡します。Factory はタイポグラフィーを所有します。ホストはキャンセル対応の翻訳 Remote メソッドを公開します。ホストはブラウザーが翻訳を有効化する前に受諾済みプロバイダーと言語設定を提供します。設定更新と再接続はこれら設定と translator の要求上限を更新します。制限変更は展開テキストをキャンセルして再分割します。1 開示ライフサイクルコントローラーは完了断片を直列化し、マウント中は翻訳をキャッシュし、長い段落分割時に空白と Unicode ペアを保持し、キャンセル後の結果を除外します。

ブラウザーは各要求をその開示のセッションに束縛します。ホストは受諾済みプロバイダーと明示設定の対象言語を要求します。`auto` はブラウザーロケールを使います。認証済みクライアントはソーステキストとセッション同一性を提供し、ホストはソーステキストがそのセッション所属かを検証しません。translator はプロバイダー独立の要求/結果記録を durable 保存し、折畳み、再読み込み、セッション再開後に完了結果を再利用します。ブラウザーキャッシュは現行表示のみ最適化します。

保存済み結果は有効化不要です。未キャッシュの不活性セッションでは、ホストは通常セッションコントローラー有効化に参加し、既存ライター経由で翻訳を一度再試行します。これは通常プリセット起動フック、再開マーカー、中断ターン修復を使います。キャンセルはこの呼び出し側の待機を終了し、以降の翻訳発送を防ぎます。共有有効化は他読者向けに完了することがあります。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Translator service](../translator/README.md) — providers and network limits.
- [Chat rendering](../../client/ui-chat/README.md) — reasoning disclosure and display extensions.
- [Web Client Slots](../../../docs/subsystems/slots.md) — contribution lifetimes.

-----

<a id="model-experience"></a>
## モデル体験

間接的に、任意の独立有料 Flash 要求とキャッシュ欠落時の通常セッション有効化経由です。translator は翻訳プロンプトを所有し、セッションのプリセットは起動コンテキストを所有します。

#### KV キャッシュ効果

翻訳記録はモデル入力を置換しません。通常有効化はコンテキスト追記や中断ターン修復を行うことがあり、会話を開く場合と同じキャッシュ効果です。独立有料照会のトークンおよびキャッシュ効果は [translator](../translator/README.md#model-experience) に属します。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- Google と Bing の匿名エンドポイントは要求を拒否したり利用不可になることがあります。要求は別プロバイダーにフォールバックしません。
- 翻訳は Markdown 整形やコード例を変えることがあります。原文は利用可能です。
- 保存済み翻訳のない不活性サブエージェントセッションは原文を保持し、翻訳失敗を報告します。通常セッション有効化はサブエージェント所有権を復元できません。
- 折畳みプレビューは原文のままです。保存済み結果はセッションに属します。将来の形式移行は experimental 記録をベストエフォートで保持します。
- 中国本土からのプロバイダー到達性はネットワーク固有検証が必要です。

-----

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>Maintainer details — click to expand</summary>

None.

</details>
