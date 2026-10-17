---
description: "システムブラウザーを通じてサインインし、アカウント資格情報を既存のローカル資格情報ストアに保つ。ローカルのキャンセルは、遅れて届くコールバックと exchange レスポンスがユーザーをサインインさせることを防ぐ。"
kind: "package-reference"
---

# @deepseek-ai/dsh-deepseek-account-platform

日本語 | [English](README.en.md) | [中文](README.zh.md)

Platform に到達するすべての操作は、呼び出し元の `AccountClientMetadata` を受け取る: クライアントバージョン、アクティブな UI 言語、UTC オフセット (秒)。プロバイダーはそのメタデータと構成のプラットフォームから 5 つの Platform クライアントヘッダーを導出するので、各リクエストは Host が見た最後の呼び出し元ではなく、それを行った UI を報告する。新しいサインイン試行はその初期化、exchange、キャンセルのためのメタデータをキャプチャし、途中から参加する呼び出し元がそれを置き換えることはない。サインアウトは、リクエストより長生きする失効リトライのためにメタデータをキャプチャする。

getPlatformSession は、保存されたグラントをその発行者が platformOrigin と一致する場合にのみエクスポートする。この Host 専用の操作は、resolveToken に設定されたモデル/ファイルオリジンを広げることなく、ネイティブの Platform 埋め込みを支える。その userId は最も最近成功した getProfile の安定したアカウント ID を繰り返し、成功するまでは、またはそのプロファイルが ID を運ばないときは null である。スナップショットは自身でプロファイルリクエストを発行しないので、遅いまたは失敗したプロファイルリクエストがそれを遅延させることはなく、未知の ID は userId を null のままにし、コンシューマーはそれを一時ストレージモードとして扱う。グラントの読み取り中の資格情報変更はスナップショットを破棄する。

`desktopPlatform` のデフォルトは `null` で、これは `x-client-platform: web` を送る。Desktop プロファイルは `darwin` または `win32` を供給し、`desktop-mac` または `desktop-win` になる。プロバイダーが 5 つのヘッダーすべてを所有するので、デプロイメント構成がそれらを上書きすることはできない。`x-client-bundle-id` は意図的に空であり、`x-client-locale` は呼び出し元の言語を `zh_CN` または `en_US` に縮小する。PlatformSession はデプロイメントヘッダーのみを運び、埋め込みクライアントは、それが開く Platform ドキュメントと API リクエストのために同じ 5 つのヘッダーを、設定されたオリジンでのみ合成する。

プロファイルと残高の HTTP 401 レスポンス、またはトップレベルのレスポンスコード `40003` (無効な認可) は、拒否されたローカルグラントをクリアし、ライブの `deepseek-account/session-expired` 通知を発行する。同時並行のレスポンスは 1 つの除去を共有する。無効化された資格情報世代からのレスポンスがその代替をクリアすることはできない。他の HTTP 失敗はグラントを保持する。Host の推論コンシューマーは、拒否されたリクエストトークンを `rejectToken` で報告できる。除去には、それが保存されたログインとまだ一致していることが必要である。

## 概要

システムブラウザーを通じてサインインし、アカウント資格情報を既存のローカル資格情報ストアに保つ。ローカルのキャンセルは、遅れて届くコールバックと exchange レスポンスがユーザーをサインインさせることを防ぐ。

Platform リクエストは、fetch が Response を返す前に拒否したとき — リクエストタイムアウトを含む — `no-response` を報告する。HTTP エラーとレスポンスボディの失敗はこのコードを使わない。認可試行の期限切れは `expired` を保つ。

デバイスアイデンティティの読み取りは、既存のログインデバイスレコードを検証し、その ID、現在のアカウント ID、共有ログイン OS バージョン文字列のみを公開する。

## 目次

- [このパッケージを使う](#use-this-package)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## このパッケージを使う

プロファイルの投影は `id_profile.picture` を `avatarUrl` にマップし、画像が設定されていないときは null を使う。

トークン解決は、ローカルのサインアウトが進行中の間はリクエストを拒否する。ローカルでの除去が成功すると、サインアウト済みスナップショットを返す前に `deepseek-account/signed-out` を発行する。リモートの失効は独立のままである。

getProfile / getBalance は、保存されたグラントを x-dsh-auth-token ヘッダーに載せて、platformOrigin 上の GET /auth-api/v0/users/current と GET /api/v0/users/get_user_summary に送る。グラントの発行者はそのオリジンと一致しなければならない。Host はアカウント UID、プロファイル名、アバター URL、Platform によってマスクされたままの電話番号またはメール、および normal_wallets / bonus_wallets の通貨/残高文字列のみを投影する。レスポンスのトークンとその他のフィールドは破棄される。残高またはボーナス額の文字列は、Platform の Web クライアントがすでに big.js に渡している数値文法 — 整数部または小数部の省略と 10 進指数を許す — に一致するときに受理されるので、0E-16 や 5.0000000000000000 のような値も有効であり続ける。元の文字列が保持され、NaN、Infinity、不正なテキストは拒否される。ボーナスウォレットはリチャージ残高とは別個のままである。資格情報の変更と破棄は進行中のクエリを無効化する。

getUnnotifiedBonuses は同じオリジン上の GET /api/v0/users/get_unnotified_bonuses を読み、ackBonusNotified は注文を名指す JSON ボディで POST /api/v0/users/ack_bonus_notified をポストし、それぞれが呼び出し元のメタデータから構築された 5 つのクライアントヘッダーを送る。どちらもまずキャプチャされたグラントのアカウントアイデンティティを解決するので、サインアウト済みまたは切り替え済みのアカウントは別のアカウントのボーナスを承認する代わりに null または false を生み、読み取りは 1 つの資格情報ライフタイムの下でクエリ全体が決着した後にのみ発行する。Host は Platform の順序でボーナスリストを転送し、文字列フィールド order_id、expires_at、msg を保持して orderId、expiresAt、message にマップする。オプションの文字列 title はそのまま転送され、null または不在の title はクライアントのデフォルトを使う。空、null、または不在の expires_at は空の expiresAt になり、通知が決して期限切れにならないことを意味する。注文 ID は UUID である必要はない。campaign、amount、currency、granted_at はオプションの未検証メタデータで、campaign、amount、currency、grantedAt として転送される。不正なペイロード、その他の HTTP 失敗、その他のビジネス失敗は throw し、資格情報の拒否 (HTTP 401 またはレスポンスコード `40003`) は現在のグラントを無効化し、null または false を生む。

残高リクエストは balanceTimeoutMs (デフォルト 30,000ms) を使う。タイムアウトは、アカウントをクリアしたりゼロ残高を捏造したりせずに、失敗した結果を返す。platformOrigin、allowLoopbackHttp、requestTimeoutMs、balanceTimeoutMs、attemptTimeoutMs はプラグイン行で設定する。HTTP は明示的に有効化されたループバック開発でのみ受理される。プロバイダーは auth_init より前に既存の Host webServer に /oauth/callback を登録し、state を検証し、S256 PKCE コードを 1 回交換し、auth_exchange.biz_data.authorized_url へリダイレクトする前にグラントをコミットする。ブラウザーの宛先はデフォルトで設定された Platform オリジンになり、常に固定の /dsh/authorize または /dsh/authorized パスを必要とする。完了 URL は `login_source` を開始したクライアント (`web` または `desktop`) に設定し、Platform が供給した他のクエリパラメーターを保持する。デバイスアイデンティティは、同じ資格情報ストアを使うプロセス間で共有される別個のランダム UUID レコードであり、device_model は OS とアーキテクチャを報告する。

Platform URL には 1 つの設定オーナーがある: `platformOrigin`。認可リクエスト、ブラウザー検証、完了リダイレクト、usage、トップアップの宛先はすべてそのオリジンを使う。プライベートな `$DSH_HOME/cordis.patch.yml` で設定する。デプロイメントアドレスはソース管理に属さない。HTTPS が必須であり、`allowLoopbackHttp: true` によるループバック HTTP のみ例外である。モデルとファイルのトークン宛先は別個の `inferenceOrigin` 設定を使う。

`requestHeaders` は `platformOrigin` 上の認可、プロファイル、残高、ログアウトリクエストに Host 専用のヘッダーを追加する。ヘッダー値はシークレット設定であり、アカウント UI 状態から除外される。Authorization、X-DSH-Auth-Token、Host、Content-Type、および接続/フレーミングヘッダーは予約されている。クライアントアイデンティティヘッダーは同名のデプロイメントヘッダーを上書きする。リダイレクトはヘッダーを転送せずに失敗する。デプロイメント Cookie はプライベート設定または環境変数に格納する。ブラウザー Cookie は自動的に収集されない。

プライベートパッチは Cordis 式を通じて環境変数を読める:

```yaml
- id: deepseek-account
  config:
    platformOrigin: !!js process.env.DSH_PLATFORM_ORIGIN
    allowLoopbackHttp: !!js process.env.DSH_PLATFORM_ALLOW_LOOPBACK_HTTP === '1'
    requestHeaders: !!js |
      process.env.DSH_PLATFORM_COOKIE ? { Cookie: process.env.DSH_PLATFORM_COOKIE } : {}
```

認証されたクライアントは、ローカル SSH 転送ポートを含むブラウザーから到達可能なコールバックオリジンと、その UI 種別を供給する。プロバイダーはコールバックパスを固定し、結果として得られる redirect_uri を初期化と交換の両方に束縛する。コールバックリクエストは RPC 認証ではなく state と PKCE の検証を使う。完了、キャンセル、破棄は試行ルートのみを除去する。交換の失敗はリトライせずに失敗状態を発行する: Web は認可タブを閉じ、失敗ダイアログを元のタブに保つ。コールバックページは自身を閉じようとし、手動クローズのメッセージを提示する。Desktop は HTTP 204 を受け取り、アカウントストリームを通じて既存のログイン UI にフォーカスする。

Host の診断は、標準エラーと Host インスペクターの Console に `[deepseek-account]` プレフィックス付きの `console.error` を使い、リクエスト、レスポンス検証、またはサインインの失敗に限る。成功したリクエスト、呼び出し元のキャンセル、通常のアカウント状態変更は無音である。リクエストタイムアウトは失敗のままである。失敗診断にはエンドポイントパス、HTTP ステータス、数値レスポンスコード、失敗ステージ、無効なフィールドパス、受信した型と検証コード、ブラウザー URL の拒否ルールが含まれ、ヘッダー、リクエストボディとレスポンスボディ、認可 URL、生の例外は除外される。

`rewriteBrowserOrigin` のデフォルトは `false` で、同一オリジンのブラウザー URL を要求する。プライベートな開発パッチはこれを `true` に設定して、認可 URL と完了 URL を `platformOrigin` にマップし、それらの固定パスとクエリ文字列を保つことができる。ソース URL は HTTPS を使うか、すでに設定されたオリジンに一致していなければならない。ユーザー情報、フラグメント、予期しないパスは引き続き拒否される。出荷されるプロファイルは厳格な同一オリジン検証を保つ。

inferenceOrigin のデフォルトは `https://api.deepseek.com`。プライベートなデプロイメントパッチはそれを、ポートを含む 1 つの正確な HTTP(S) オリジンに置き換え、x-dsh-auth-token を通じた推論とファイル認証に使える。パス、URL 資格情報、クエリ、フラグメントは無効な設定である。代替オリジンには、設定された platformOrigin が発行したグラントが必要であり、モックトークンは引き続き除外される。ループバックのグラントは公式プロダクション API を認証できない。デプロイメントアドレスはプライベートパッチに属し、出荷される設定には属さない。

プロバイダーの初期化時、発行者が platformOrigin と異なる有効な保存済みグラントは、コンシューマーがアカウント状態を読む前にローカルで削除される。起動はリモートログアウトリクエストなしでサインアウト状態のまま続行し、API キーとデバイスアイデンティティは保存されたままである。ストレージの失敗は明示的なままであり、アカウントの HTTP またはレスポンス検証の失敗が一致するグラントを削除することはない。

<a id="understand-the-implementation"></a>
## 実装を理解する

アカウントの存在は資格情報ストアを読み、試行状態はプライベート状態を直接投影する。動作テストは非同期キャンセルとコミット順序を検証する。

<a id="further-exploration"></a>
## さらなる探索

[資格情報サブシステム](../../../docs/subsystems/credentials.md)がストレージ API を所有し、[アーキテクチャ](../../../docs/architecture.md)がアプリケーション構成を説明する。

attemptTimeoutMs の制限は初期化、ブラウザー待機、交換を含む。初期化はその絶対期限を延長しない。サーバーの TTL は残り時間を短縮することしかできない。期限前に受理された資格情報の永続化は、キャンセルなしで完了する。

<a id="model-experience"></a>
## モデル体験

なし。アカウント資格情報は HTTP 認証に影響し、モデルプロンプト、Session ログ、ツール結果に決して入らない。

#### KV キャッシュ効果

モデルリクエストプレフィックスは変化しない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- ブラウザーサインインには Host webServer が必要である。サポートされるのはローカルアクセスと、HTTP localhost、127.0.0.1、または明示的なポート付きの [::1] を通じた SSH ローカル転送のみであり、非ループバックのリバースプロキシはサポートされない。アカウントトークンに有効期限やリフレッシュフローはない。明示的な DSH サインアウトは、バックグラウンドで POST /auth-api/v0/users/logout を呼ぶ前にローカルグラントを除去する。リモートの失敗がローカルログインを復元することは決してない。キャプチャされた古いトークンは、デフォルトで 1、2、4、8、16 秒の指数遅延を伴う最大 5 回の追加試行を受ける。logoutMaxRetries (0–5) と logoutRetryDelayMs がそのポリシーを設定する。各リクエストは requestTimeoutMs を使う。プロバイダーのシャットダウンはリクエストを中断して待機し、保留中の失効は永続化されない。ローカルの資格情報削除の失敗は呼び出し元に見えるままである。認可試行の期限はトークンが発行される前には依然として適用される。初期化後のキャンセルまたはタイムアウトは、アカウント認可なしで、auth_init.biz_data の authorize_id と元の code_verifier を伴う 1 回のバックグラウンド POST /auth-api/v0/dsh/auth_cancel を送る。ローカルのキャンセルはこのリクエストを待つことも失敗で覆すことも決してなく、requestTimeoutMs がそれを制限し、プロバイダーのシャットダウンがそれを中断する。TODO(product-error-ui): プロダクトは、供給される biz_code 値に対するローカライズされたコピーと UI の動作を定義する必要がある。それまでは、ビジネス失敗は既存の汎用リトライメッセージを使い、他のコードと HTTP エラーも同じフォールバックを使う。開発用グラントはプロダクションリクエストを決して認証しない。

<a id="dev-note"></a>
### 開発メモ

[デスクトップログインの決定](../../../.agents/notes/implemented/architecture/2026-09-14-deepseek-account-login.md)がキャンセルとストレージの所有権を記録している。

サインイン後の最初のプロファイル読み取りは、auth_exchange が返すサニタイズ済みユーザーを使う。null または不正なユーザーは current にフォールバックし、その後のリフレッシュと Host の再起動も current を問い合わせる。失敗した current リクエストは、同じ資格情報の最後に成功したプロファイルを Host メモリに保持する。資格情報の変更と破棄がそれをクリアする。準備完了の current レスポンスで安定したアカウント ID が初めて利用可能になった、または変化した場合、`watch(signal, true)` を使う Host サブスクライバーにのみ通知するので、アイデンティティコンシューマーは getPlatformSession を読み直す。同じ ID を繰り返すリフレッシュは無音のままである。交換は送信されたデバイス情報を登録する。

accountRequestHeaders は current、残高、および埋め込み Platform ページ/API リクエストのために requestHeaders を上書き合成する。Cookie ペアは名前でマージされるので、ルーティングの上書きは他のデプロイメント Cookie を保つ。認可の初期化、交換、キャンセル、ログアウトは requestHeaders を保つ。両方のマップは Host と Electron メインにプライベートのままであり、セッションの userId も Host 専用のままで、レンダラーのブートストラップは origin と token のみを受け取る。

アカウントプロバイダーの `embeddedPageDist` 設定は、埋め込みの Usage とトップアップの URL に `dist` クエリパラメーターを追加する。デフォルトは空であり、プライベートなフロントエンドブランチセレクターはローカルプロファイルパッチに属する。API URL や資格情報の配信は変更しない。

Platform のウォレット残高は、オプションの科学的記数法付きの 10 進文字列を受け入れる (`0E-16` を含む)。プロバイダーはコンシューマーのために元の文字列を保持する。
