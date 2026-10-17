---
description: "Account consumers read stored login state, start or cancel a browser login, and sign out without editing API keys. Host model consumers resolve account credentials only for the provider-configured inference origin."
kind: "package-reference"
---

# @deepseek-ai/dsh-deepseek-account

日本語 | [English](README.en.md) | [中文](README.zh.md)

getPlatformSession はネイティブ Platform 埋め込み向けホスト専用 origin/token スナップショットを返し、サインアウト時は null を返します。その userId は直近成功 getProfile 由来の安定アカウント ID を繰り返し、1 回成功するまで、またはそのプロファイルが ID を持たない場合は null です。スナップショットはプロファイル要求を発行せずその ID を再利用するため、不明 ID では呼び出し側を遅延させず userId を null のままにします。安定 ID が初めて利用可能になるか変化したプロファイル読取は、`watch(signal, true)` を使うホスト購読者にのみ通知し、同一性コンシューマーがスナップショットを再読できるようにします。コンシューマーは永続ブラウザー設定保存を origin と userId でキー付けし、userId が null の間は一時保存を使います。アカウントコントローラー RPC とクライアント状態には現れません。コンシューマーはアカウント変更時にスナップショットを保持するドキュメントを破棄します。スナップショットは配置要求ヘッダーのみ運びます。埋め込みクライアントは独自 UI の Platform クライアント同一性を合成します。

`platformClientHeaders` はその `AccountClientMetadata` と構成のデスクトッププラットフォームから 1 呼び出し分の 5 つの Platform クライアントヘッダーを構築します。`x-client-bundle-id` は意図的に空、`x-client-platform` は Desktop プロファイルが `darwin` または `win32` を提供しない限り `web`、`x-client-version` は呼出しビルドのバージョン、`x-client-locale` は有効 UI 言語を公開 `platformWireLocale` 経由で `zh_CN` または `en_US` に縮約、`x-client-timezone-offset` は UTC 東への秒数 (整数) です。要求本体が同じワイヤーロケールを運ぶコンシューマーは `platformWireLocale` を再利用し、ヘッダーと本体が不一致にならないようにします。

getUnnotifiedBonuses は Platform が表示済みとしてまだ記録していない付与ボーナスを、それが属するアカウントと共に返します。ackBonusNotified はユーザーが実際に見た 1 ボーナスを記録します。確認はそのアカウントを名指しするため、あるアカウントでの通知読取が別アカウントに確認されることはありません。

`rejectToken` はホスト推論要求の拒否トークンを受け付け、一致する現行ログインのみ除去します。遅延拒否は置換認証情報をクリアできません。

`deepseek-account/session-expired` は拒否認証情報除去後に現行購読者へ一度だけ通知します。アカウントスナップショットは有効期限通知を運ばないため、再接続でトーストは繰り返されません。

## 概要

アカウントコンシューマーは保存済みログイン状態を読み、ブラウザーログインを開始またはキャンセルし、API キー編集なしにサインアウトします。ホストモデルコンシューマーはプロバイダー設定推論オリジン向けのみアカウント認証情報を解決します。

`SignInErrorCode` は `no-response` (fetch が Response を返さなかった) を HTTP および応答検証失敗と区別し、クライアントがネットワーク対処を提供できるようにします。

`getDeviceIdentity()` は認証情報やデバイス作成なしに既存デバイスおよびアカウント ID とログイン OS バージョン文字列を返します。

## 目次

- [このパッケージの利用](#use-this-package)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## このパッケージの利用

`AccountProfile.avatarUrl` は任意のプロファイル画像 URL です。null または欠落はアバターなしを意味します。

成功ローカルサインアウトは `deepseek-account/signed-out` を送出します。プラットフォームプロバイダーはアカウント所有キャンセルリスナーを導入し、実行中エージェントを `session.requestContext().provider` と照合してアカウントタスクをキャンセルし、受信箱は保持します。アカウントコントローラーは確認ダイアログに同じ述語を使います。追加エージェント状態は保持しません。新ターンが最初の要求を束縛する前、この述語はなお prior ターンのプロバイダーを見ます。

サービスはアカウント操作と再接続可能状態スナップショットを定めます。プラットフォームプロバイダーはプロトコルと保存済み許可を所有します。認証情報はホスト専用です。API コントローラーは resolveToken なしに状態とコマンドを公開します。

`ACCOUNT_SIGN_IN_REQUIRED` のアカウントモデル失敗は `deepseek-account/model-sign-in-required` を送出します。クライアントはサインイン案内のためこのライブイベントを受け取ります。他の要求エラーは送出しません。

<a id="understand-the-implementation"></a>
## 実装の理解

サービスは 2 つ目の認証情報索引を保持せずアカウント操作を定めます。プロバイダーは永続化とログインライフサイクル確認を所有します。

<a id="further-exploration"></a>
## Further Exploration

[credentials サブシステム](../../../docs/subsystems/credentials.md)は保存 API を所有します。[architecture](../../../docs/architecture.md) はアプリケーション構成を説明します。

準備済み AccountDetails.balance はチャージウォレットを value に、ボーナスウォレットを bonusWallets に保ちます。両配列は 10 進文字列と通貨を保持します。照会失敗は金額を提供しません。

<a id="model-experience"></a>
## モデル体験

None, as account credentials affect HTTP authentication and never enter model prompts, Session logs, or tool results.

#### KV キャッシュ効果

モデル要求プレフィックス変更なし。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- アカウントトークンに有効期限や更新フローはありません。サインアウトはバックグラウンドプロバイダー取消前にローカル許可を除去します。リモートログアウト失敗はローカルログインを復元しません。プロファイルおよび残高照会失敗は保存済み許可を保持します。getProfile / getBalance はプロファイルと残高の照会結果を独立に報告します。

<a id="dev-note"></a>
### 開発者ノート

[desktop ログイン決定](../../../.agents/notes/implemented/architecture/2026-09-14-deepseek-account-login.md)はキャンセルと保存所有権を記録します。

PlatformSession はホストから Electron main へホスト専用 requestHeaders を運ぶことがあります。配置ヘッダーのみです。埋め込みドキュメントのクライアント同一性はロケール、タイムゾーン、バージョンが既知の場所で合成されるためです。コンシューマーはそれらのヘッダーをレンダラーブートストラップから除外し、設定オリジンに制限しなければなりません。userId は同じ条件でホスト専用であり、レンダラーブートストラップに入りません。mergePlatformCookies は一致名を置換しつつ無関係 Cookie ペアを保持します。
