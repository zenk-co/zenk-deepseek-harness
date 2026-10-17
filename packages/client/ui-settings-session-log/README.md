---
description: "全般設定から DeepSeek API リクエスト時のセッションログアップロードを制御する。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-session-log

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

**設定 → 全般** のバージョン番号の上にある **Upload Session Log when using the official model API** を使って、DeepSeek API リクエスト時のセッションログアップロードを制御する。スイッチは受け入れ済みの Host 設定を表示し、変更はすぐに保存される。Host がアップロード設定を公開している間のみ表示され、読み取り専用クライアントでは変更できない。

## 目次

- [このパッケージの使い方](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [関連情報](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と将来の課題](#known-limitations-and-deferred-work)
- [開発ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの使い方

Web バンドルはこのコンパニオンをマウントする。そのスイッチは共有設定フォーム経由で Host プラグインの `enabled` フィールドを編集する。保存の失敗は受け入れ済み値を保持し、設定を閉じても残るトーストを表示する。リクエストのタイミング、再開時のアップロード、個別の OpenTelemetry 設定については [セッションログアップロード](../../session/session-log-deepseek/README.md#configuration) を参照すること。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の詳細 — クリックして展開</summary>

このコンパニオンは、`session-log-deepseek` がサーブされている間に `settings.general.item` 行と、変更結果通知用の `shell.overlay` トーストを提供する。永続化と再接続の同期は共有フォームが所有し、コンパニオンは保留中の書き込み状態とローカライズ済み通知のみを所有する。

</details>

-----

<a id="further-exploration"></a>
## 関連情報

- [設定フォーム](../ui-settings/README.md) — 受け入れ済み Host 値と順序付き書き込み。
- [セッションログアップロード](../../session/session-log-deepseek/README.md) — リクエストへの寄与と受け入れ追跡。
- [Web クライアント](../../../docs/subsystems/web-client.md) — プラグイン構成と設定の配置。

<a id="model-experience"></a>
## モデル体験

なし。このブラウザー設定はモデル可視コンテンツを提供しないためである。

#### KV キャッシュへの影響

なし。この設定はモデル入力の外側の要求メタデータを制御する。

## 既知の制限と将来の課題

<a id="known-limitations-and-deferred-work"></a>

- Host が `session-log-deepseek` 名前空間を公開していない場合、この行は利用できない。

<a id="dev-note"></a>
### 開発ノート

なし。
