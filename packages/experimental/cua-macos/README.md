---
description: "スコープ付き app および window オブジェクトを通じてネイティブ macOS アプリケーションを検査・操作する。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-cua-macos

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

macOS の権限を検査し、実行中のアプリケーションとウィンドウを選択し、アクセシビリティツリーを読み取り、スクリーンショットを取得して入力を送信する。オブジェクト API は外部の永続的実行環境に保持できる。Swift ヘルパーは macOS フレームワークを直接利用し、選択した MIT ライセンスの Cua Driver の動作を取り込んでいる。このパッケージは PTC ランタイムも変数永続化も所有しない。

## 目次

- [このパッケージの利用](#use-this-package)
- [実装の理解](#understand-the-implementation)
- [関連情報](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と将来の課題](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの利用

この実験的プロバイダーは、macOS 14 以降で明示的なソース構成により有効化する。Windows 対応は開発中である。出荷プロファイルにはマウントされない。ネイティブヘルパーを準備し、レジストリ/プロバイダーのオーバーレイを読み込む:

```sh
swift build --package-path packages/experimental/cua-macos/native --configuration release
cua_native_root="$PWD/packages/experimental/cua-macos/native"
export DSH_CUA_HELPER="$cua_native_root/.build/release/dsh-cua-native"
pnpm dsh headless --patch packages/experimental/cua-macos/examples/macos.cordis.yml --dump-config
```

dump コマンドはモデルリクエストなしでプロファイル構成を検査する。実際のタスクでは `--dump-config` をプロンプトに置き換え、プロファイルのモデル認証情報を設定する。オーバーレイは computer-use レジストリとこのプロバイダーをマウントする。使用前に既存の競合プロバイダーを取り除く。担当ホスト/ヘルパーには AX/入力用のアクセシビリティ権限とキャプチャ用の画面収録権限が必要である。`getCapabilities` はシステムダイアログを開かずに権限とセッションロック状態を報告する。ロック中または利用不可のデスクトップセッションは、ディスパッチ前に UI 観測と入力を拒否する。再開前にユーザーは macOS のロックを解除しなければならない。`listApps` と `cua.getState` は実行中のアプリケーションを一覧表示する。`findApps(query)` は名前、バンドル ID、絶対パスで標準 macOS アプリケーションディレクトリを検索する。`getApp` は一意の名前、バンドル ID、パス、実行中 PID を選択し、アプリケーションの同意を取得し、必要に応じて停止中のアプリをバックグラウンドで起動する。停止中の実行ファイルは承認前に特定され、起動前後に再確認される。署名のないコードはタスクアクセスのみを受ける。返されるオブジェクトはアプリをアクティブ化せずに初期 AX を読み取る。起動キャンセル後にアプリケーションが実行中のままになる場合がある。モデルガイダンスは、初期化中や各アクション前にアクティブ化せず、バックグラウンド観測と入力から始める。非表示または最小化されたウィンドウでは `app.show()` または `window.show()` を試し、新しい状態を読み取る。これはアクティブ化なしで非表示解除と最小化解除を要求し、Space を前面化または切り替える。アプリレベルの復元はフォーカス中、メイン、または唯一の AX ウィンドウを選択する。結果は選択された `windowId`、ウィンドウが選択されなかった場合は null を示し、リクエスト前後の前面アプリと最上位ウィンドウを比較して `foregroundChanged` を報告する。Null はフォアグラウンドの証拠が利用不可だったことを意味し、後のフォーカス変更は依然として起こり得る。復元に失敗したかウィンドウが使用不能のままの場合は、必要なフォアグラウンド手順を説明し、`app.activate()` または観測済みウィンドウの `raise` アクションを呼び出してから再度観測する。必要なフォアグラウンドアクセスはフォーカス維持より優先される。アプリケーションは入力後にフォーカスを変更する場合があり、バックグラウンド配信はユーザーのセッションが妨害されないことを保証しない。

| フィールド | 既定値 | 意味 |
| --- | --- | --- |
| `allowedApps` | `[]` | 実行ファイルパスと検証済み署名要件をキーとする、ライブのプロファイルローカルなアプリケーション同意。 |
| `helperPath` | package-owned executable | 任意の絶対ネイティブ実行ファイルによる上書き。 |
| `buildTimeoutMs` | `300000` | 最大ネイティブ準備時間。 |
| `timeoutMs` | `30000` | 操作ごとの期限。キャンセルにより部分的な入力が残る場合がある。 |
| `connectTimeoutMs` | `5000` | 共有ヘルパーへの接続または起動の期限。 |
| `screenshotTimeoutMs` | `5000` | キュー時間を含むスクリーンショットの期限。`timeoutMs` が上限となる。 |
| `axTimeoutMs` | `3000` | Accessibility システムコールごとの期限。操作全体とは独立に設定される。 |
| `maxRequestBytes` / `maxResponseBytes` | `1048576` / `33554432` | UTF-8 リクエストとレスポンスの上限。 |
| `maxClipboardBytes` | `33554432` | 貼り付け中に保持される元のクリップボードバイト数の上限。超過内容は置換前に拒否される。 |
| `pasteReadTimeoutMs` | `1000` | Paste コマンド復帰後のクリップボード読み取り期限。期限切れは `PASTE_NOT_CONSUMED` を報告する。 |
| `maxAppMatches` | `20` | インストール済みアプリ検索の最大一致数。広すぎるクエリは拒否され、より狭い名前が要求される。 |
| `maxElements` / `maxDepth` | `2000` / `25` | Accessibility 走査の上限。 |
| `dragDurationMs` / `dragSteps` | `400` / `20` | ドラッグの所要時間と移動分割数。 |
| `textEventIntervalMs` | `0.25` | 各 Unicode down/up イベント後の遅延。0～1000 ms。コードタイミングは独立している。 |

[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-experimental-cua-macos)はすべてのフィールドを列挙している。ネイティブツール呼び出しは `{method, params}` を使う。メソッド固有の完全なスキーマがモデルに公開される。たとえば `getApp` は `listWindows`、`getState`、入力操作に必要な `appHandle` を返す。

テンキー名（`KP_0` から `KP_9`、`KP_Enter`、テンキー演算子）は物理キーコードを保持する。キーコードは修飾キーとキーの間に `+` を使う。プラスキーには `+`、Command-plus には `cmd++`、またはキー名 `plus` を使う。`cmd+` のような未完成のコードは拒否される。

エージェント破棄とプラグインアンロードは、画像承認や添付ファイル保存を含む進行中のツール呼び出し全体をキャンセルして待機する。進行中の画像書き込みは破棄復帰前に確定しなければならず、キャンセルされた呼び出しが成功スクリーンショットを返すことはない。

アプリケーション同意は、CUA ツール経由の AX 読み取り、ウィンドウタイトル読み取り、スクリーンショット、アクティブ化、入力の前に強制される。User Questions はタスクアクセスまたは拒否を提供し、アプリケーションに検証可能な署名があり構成が設定永続化を提供する場合は保存済みアクセスも提供する。タスクアクセスは選択されたプロセスハンドルに束縛され、保存済みアクセスは正規の実行ファイルパスと指定コード署名要件に束縛される。拒否はそのタスク内での繰り返しプロンプトを防ぐ。保存済み `allowedApps` エントリの削除は影響を受ける操作をキャンセルし、そのヘルパーハンドルを無効化する。再認可には新しい選択が必要である。同一エージェント接続上の他のハンドルも期限切れになるが、保存済み許可は再利用可能のままである。エージェント/プロバイダーの破棄は対応するネイティブ接続のクリーンアップに参加する。[アプリケーション同意の決定](../../../.agents/notes/implemented/architecture/2026-09-26-cua-application-consent.md)を参照。これらの検査は CUA 呼び出しを統制する。永続 PTC と個別に認可された shell ツールはそれぞれの実行権限を保持する。

生の `getState` は検証済み状態フィールドと要求された開示オプションの完全なテキストを公開する。ネイティブヘルパーはネイティブ検査用の構造化要素診断も返すが、ツール投影はその重複配列をモデルテキストと構造化ツール値から除外する。

AX 観測は既定でメニューバー項目を表示する。`app.getAXState({ includeMenus: true })` でメニュー内容を展開し、`app.getAXState({ details: true })` で識別子、グローバル座標境界、完全なアクション名を取得する。これらのオプションは生の `getState` と結合 AX/スクリーンショット観測にも適用される。各観測はそのスコープのインデックスを置き換える。展開出力から新しいインデックスを取得する。詳細表示は設定されたノード数と深さの上限を回避しない。打ち切りでは到達した上限が特定される。

値とプレースホルダーは別物である。名前付き、状態付き、操作可能なグループとスクロール領域はそれぞれの行を保持する。1 ノード上の繰り返される名前、説明、ヘルプテキストは一度だけ表示される。値、プレースホルダー、URL はテキストが一致しても意味が区別され、異なるノードで共有される本文はそのまま保持される。書き込み可能性は `AXIncrementor` を含む関連コントロールで明示され、`unknown` はシステムが報告しなかったことを意味する。任意の状態フィールドの欠落は false を意味しない。観測値の範囲外の UTF-16 範囲は利用不可と表示される。カスタムアクションの別名は AppKit の target/selector 診断を省く。あいまいな別名には `details:true` の完全名が必要である。

観測は既定で送出され、値も返す。永続 PTC では `void await app.getAXState()` で送出コピーを 1 つにし、または `emit:false` と明示的な print を 1 回使う。送出済みツリーの後にスクリーンショットを取得すると独立に失敗する場合がある。成功した AX 出力を保持する。

スクリーンショット診断はツールリクエスト ID をキーとする `[cua-screenshot]` レコードを使う。ネイティブフェーズのレコードは元のエージェント接続経由で返され、ウィンドウ/AX 形状検査、システムキャプチャ、PNG/Base64 エンコード、レスポンス書き込みを対象とする。ホストのデバッグログはディスパッチ、応答、クリーンアップのタイミングを追加する。各リクエストは完全な診断レコードを最大 8192 バイト保持し、明示的に打ち切る。スクリーンショット失敗時はこれらのレコードをエラーに付加してセッション出力する。レコードは段階、タイミング、エラーコードを含み、ウィンドウタイトル、AX テキスト、画像バイトは含まない。

ネイティブ準備は共有ファイルロックでコンパイラ検査と公開を直列化する。パッケージペイロードを更新し、native/.build/prepared 配下で内容アドレス指定コピーを実行し、以前のソースランタイムプロセスが使う実行ファイルを保持する。同一ビルドは同一ファイルを再利用し、破損した保持コピーは検証に失敗する。キャンセルと準備失敗はロック解放前に管理プロセスのクリーンアップを完了する。

### 外部実行環境の接続

永続 PTC 経由で実行するには、macOS オーバーレイの後に `--patch packages/experimental/cua-macos/examples/persistent-ptc.cordis.yml` を追加する。このプロバイダーはライブエージェント用の変数を保持し、選択されたファイルサンドボックスポリシーを適用する。呼び出し側はブリッジをインポートし、現在の認可済み `tools.cua` バインディングを提供する。永続 PTC は CUA 手順内でインストール所有のブリッジファイル URL を受け取るため、プロジェクトはこのパッケージをインストールする必要がない。以下の例は、独自インストールからパッケージを解決し `tools` を提供する外部ホスト向けであり、このパッケージはグローバルオブジェクトをインストールしたり変数を存続させたりしない:

```javascript
import { connectCua } from '@deepseek-ai/dsh-cua/bridge'
const cua = connectCua(() => tools.cua, text => console.log(text))
const app = await cua.getApp("com.apple.TextEdit")
void await app.getScreenshot()
```

単一ウィンドウのタスクでは app メソッドを直接使う。`getApp` は初期 AX 状態を読み取るため、スクリーンショットにウィンドウ列挙や追加の AX 読み取りは不要である。特定のウィンドウが必要な場合や既定選択があいまいな場合に `app.getWindows()` と `app.getWindow(windowId)` を使う。観測されたタイトルと境界で選択する。

`getWindow` は初期 AX ツリーを送出する。AX サーフェスのない所有ウィンドウは空のスナップショットを返し、スクリーンショットと座標入力に利用可能なままである。ウィンドウオブジェクトは個別のスナップショットを保持するため、あるウィンドウの読み取りが他を無効化しない。同一スコープの再読み取りは古いインデックスを無効化する。観測中に削除された AX ノードは読み取りを `STALE_SNAPSHOT` で拒否し、部分ツリーを公開しない。直前の入力を繰り返さずに再度読み取る。アプリスコープのスクリーンショットと座標は最新の AX 観測を再利用する。すなわちフォーカス中で画面上にありサイズが非ゼロのウィンドウ、なければ唯一のそのようなウィンドウである。現在のフォーカスを再照会しない。フォーカス変化を追うには `app.getAXState()` を読む。明示的なウィンドウオブジェクトは選択ターゲットを保持する。キーボードメソッドは `app` 上にあり、入力はアプリの現在のフォーカスに従う。

`hover(target)` はまずシステムカーソルを動かさずに宣伝された AX 代替 UI を表示する。表示された子孫に入ると親 UI が保持され、離れると既定 UI に戻る。利用不可の場合、hover はボタンを押さずに可視システムカーソルを AX 要素中心またはウィンドウローカル点へ移動する。無効コントロール上も含む。選択アプリがフォアグラウンドにあり、対象点が遮られていないことが必要であり、そうでなければ `FOREGROUND_REQUIRED` が明示的なアクティブ化または前面化と新しい観測を要求する。完了、AX 読み取り、スクリーンショットは以前の点を復元しない。アプリケーションの hover 遅延を待ち、表示内容を観測してから、その中に hover してクリックする。連続呼び出しで中間点をたどれる。他の入力やアプリケーション変化が相互作用を中断し得る。[継続相互作用の根拠](../../../.agents/notes/implemented/architecture/2026-10-13-cua-continuous-hover.md)。

`paste(text, { format: "text" | "html" })` は要求されたクリップボード形式を一時公開し、アプリケーションの有効な標準 Paste メニューコマンドを呼び出す。ペーストボードリーダーがデータを要求するまで一時形式を保持し、その後、クリップボードの所有権が残っている間に取得した元の形式をすべて復元し、後のコピーを保護する。Paste 操作はプロセス横断ロックを共有し、キャンセルはヘルパーのクリーンアップに参加する。強制プロセス終了は復元を妨げ得る。未対応の Paste コマンドは入力フォールバックなしで失敗する。`typeText` は別のキーイベント入力のままである。

`selectText` は一意のリテラル出現を選択するか、書き込み可能な `AXSelectedTextRange` を通じてその前後にカーソルを置く。隣接する prefix/suffix が繰り返しを区別する。選択は残りのテキストと書式を保持し、結果の UTF-16 範囲を検証する。未対応、欠落、あいまい、変更済みのテキストはキーボードフォールバックなしで失敗する。AX テキストは利用可能な場合 `selectionWritable`、選択範囲、選択テキストを含む。

スクリーンショット取得には添付ファイルストアと画像入力を宣言する解決済みモデル経路が必要である。共有添付ファイル承認は正規 Base64、ラスタ、設定容量を検証してから画像を 1 回保存する。ネイティブデータはプログラム呼び出し側に利用可能なままである。モデル内容は座標メタデータと durable な画像参照を持つ。レスポンスバイト上限は解析前に適用される。

hover、クリック、スクロール、ドラッグの絶対座標は、最後に返されたスクリーンショット内のピクセルを使う。ウィンドウ幅・高さの 1000 分の 1 整数には `relative: true` を渡す。省略または `false` はピクセルを使う。相対入力は成功した AX 読み取りまたはスクリーンショットを利用でき、絶対入力はスクリーンショットを要する。ホストは添付ファイルとモデルリクエストのリサイズを含め、提供画像をネイティブポイントに写像する。値 1000 はウィンドウ端の内側に収まる。座標オプションは AX 要素インデックスに適用されない。最新観測以降の幅・高さの変化は、スナップショット ID のない生呼び出しを含め、入力前に `WINDOW_CHANGED` を返す。新しい AX を読むか新しいスクリーンショットを撮ってから進む。ウィンドウ移動のみはウィンドウローカル座標を保持する。キャプチャとポインタ入力は、選択ウィンドウのアクセシビリティフレームと表示境界の既知の不一致を、ポインタイベント送出前に `WINDOW_CHANGED` で拒否する。これには AX が完全なウィンドウフレームを保持する Stage Manager 変換を含む。新鮮な状態を読む。アクティブ化やウィンドウ前面化は明示のままである。宣伝された AX アクションは利用可能のままである。AX 形状の欠落は AX なし経路を保持し、変換されたウィンドウを操作できると確定しない。

保持オブジェクトは呼び出しごとに現在のツールバインディングを解決する。外部ランタイムは永続化、インポート、キャンセル、完了値の直列化を所有する。スクリーンショットはエンコード済みバイトを MIME 型、ピクセル寸法、ウィンドウ ID とともに返す。標準ツールパイプラインは画像添付ファイルをちょうど 1 回承認する。`emit: false` はファサード出力のみを抑止する。別のディスパッチャを使うホストは `./api` から `createCuaApi` でオブジェクトを構築できる。

AppKit シートはウィンドウ ID で選択でき、文書ウィンドウのツリーに表示されたままである。キーボード入力は、アプリケーションのフォーカス中シートが 1 つの Apple パネルサービスウィンドウを特定し、そのサービスが同じパネルにフォーカスし続けている場合に限りシステム開閉パネルに従う。無関係またはあいまいなリモート宛先はディスパッチ前に失敗する。

インデックス付きクリックは単一の右/中クリックまたは単一/二重の左クリックに対応する。クリックとドラッグのオプションはボタンと修飾キーを受ける。修飾付きクリックはポインタ入力を使う。ドラッグはそのボタンを保持し、すべての移動と解放に修飾子を伴う。AX テキストは無効コントロール、`valueWritable=true`、利用可能な `selected` 状態を示す。ヘルパーは利用可能な場合、修飾なしクリックに宣伝されたアクセシビリティアクションを使う。ポインタ配送は要素の現在境界を解決し、所有ウィンドウを検証する。アクションはアプリケーション成功ではなくディスパッチを報告する。可視ポインタやクリックマーカーは入力と独立に描画できる。AX アクションはシステムカーソル移動を要しない。ウィンドウ宛てマウス入力でもアプリケーションのフォーカス、選択、ダイアログが変わり得る。入力後に状態を読む。`STALE_APP` はアプリケーションの再取得を要し、`STALE_SNAPSHOT` は新しい AX 読み取りを要する。リクエストのタイムアウト/キャンセルはネイティブ承認を待ち、使用可能なハンドルを保持する。クリーンアップ承認の欠落はそのエージェントの接続を閉じる。システムコールバック待ちのスクリーンショット RPC は単一キャプチャスロットを占有し、さらなるスクリーンショットは `CAPTURE_BUSY` を返す一方、AX と入力は利用可能のままである。遅延キャプチャ結果は破棄され、その実際の完了がスロットを解放する。応答しない操作や失敗したクリーンアップのみが共有プロセスとすべてのハンドルを無効化し得る。不確かな入力を自動再試行しない。エージェントを閉じるとその接続と AX 参照が解放され、アプリケーションへの変更は元に戻らない。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>ディスパッチとリソース所有</summary>

オブジェクトファサードは app/window メソッドを JSON 操作に変換する。ブリッジは通常のツールパイプライン経由で送り、認可、入れ子ログ、画像承認を保持する。1 ユーザーに属するエージェントとホストは同一ネイティブビルドのヘルパーを共有する。各接続は独立したハンドル、スナップショット、設定、キャンセル状態を保持し、デスクトップ操作はグローバルキューを使う。管理ランチャーはサービス寿命をこれらの接続に移し、ヘルパーは最後の接続のクリーンアップ完了後に終了する。プロセスロックはビルド同一性と実際の実行ファイルパスの両方を対象とし、重複起動と実行ファイル置換後のパス衝突を防ぐ。ネイティブハンドルはプロセス同一性をカーネル開始時刻に束縛し、スナップショットはそのヘルパー内でのみネイティブ AX 参照を保持する。同一操作プロトコルは、オブジェクト API にプラットフォームロジックを追加せずに将来のプラットフォームプロバイダーに対応できる。

[Zod 操作定義](../cua/src/protocol.ts)はモデルパラメータを所有し、ホストリソースフィールドとプライベート継続を別に宣言する。公開データ型はそれらの定義から導出される。`pnpm exec tsx packages/experimental/cua-macos/native/generate-protocol.ts` はネイティブ JSON Schema と Swift フィールド/enum 承認表を生成する。パッケージのテストレーンは新鮮さを検査し、モデル承認時にホスト専用フィールドを拒否する。ネイティブターゲット検証、リソース上限、操作動作は実行時に強制されたままである。

[AX テキスト整形](native/Sources/CuaNative/AXTextFormatter.swift)は既読ノードデータを消費する。AX ウォーカーのみがインデックスを割り当ててネイティブ参照を保持するため、整形は第 2 のスナップショットやターゲット登録を持たない。

ネイティブリクエスト ID は記録ツール呼び出し ID と一致する。成功したアクティブ化とウィンドウ前面化の結果は、生ツール結果にフォアグラウンド要求の詳細と直前直後のフォーカス観測を保持する。既に最前面のアプリは冗長なアクティブ化を省く。ウィンドウ前面化は、対象ウィンドウがフォーカス中、メイン、非最小化、かつ可視通常ウィンドウの先頭でもある場合に限り省略される。不明な観測は要求操作を保持する。これらの観測は無関係なフォーカス変化の原因を確定せず、完了も検証しない。

ノード役割とメタデータは観測ごとに 1 つの AX バッチを共有する。グループとスクロール領域ノードは子のみを提供し、未使用メタデータのエラーで拒否されない。未対応のバッチ処理は個別属性読み取りを保持する。AX 走査は、等価比較されるプロキシ参照を含めネイティブ同一性を 1 回だけ訪問するため、循環アクセシビリティ子が部分木全体を繰り返さない。[ソースマニフェスト](native/upstream.json)は適応した上流動作とローカル Swift モジュールを記録する。AppKit はメインイベントループで動作し、別の直列エグゼキュータが AX 参照と同期入力を所有する。リクエストはキャプチャからレスポンス配送まで排他的実行を保持する。不変の companion は公開されない。すなわち照合すべき独立投影レジストリや durable な評価器状態はない。プロトコル検証、ターゲット同一性、リソースクリーンアップは所有する実装が検査する。

</details>

-----

<a id="further-exploration"></a>
## 関連情報

- [Computer-use 登録](../../computer-use/computer-use/README.md)
- [ネイティブプロトコル](native/protocol.schema.json)
- [オブジェクトインターフェース](../cua/src/types.ts)

-----

<a id="model-experience"></a>
## モデル体験

### ネイティブアプリケーション操作

#### モデルに見えるもの

このプラグインはメソッド固有パラメータを持つ 1 つの `cua` 操作ツールを提供する。標準 PTC 表示は `run_code` を通じて `tools.cua` として公開する。以下のパッケージ所有ガイダンスは逐語的に送出される:

##### 操作ガイダンス（原文）

```markdown
Use cua with method getCapabilities and params {} to inspect permissions and sessionLocked. If sessionLocked is true or an operation reports SESSION_LOCKED, stop UI attempts and ask the user to unlock macOS. A null sessionLocked means no usable console session was verified. After unlocking, read fresh state; screenshots from a locked desktop are not current observations. Use listApps or cua.getState to discover running applications, and findApps(query) to search installed applications by name, bundle ID or absolute path. getApp requests user consent before launching a stopped application in the background, or before observations and input on a running one. If access is denied or revoked, stop using that application until the user explicitly grants access again. Never switch tools to bypass a refusal. Keep the returned appHandle; every app operation requires it. listWindows returns window IDs and point bounds. Raw getState returns AX text and snapshotId. Menu-bar entries are shown by default; includeMenus=true expands their contents. details=true adds identifiers, global-point bounds and complete action names. Both options also apply to getAXState. Each read replaces the indices for that app/window scope. Use its element indices only with that snapshotId. Raw screenshot and coordinate operations require a windowId. Coordinates are pixels in the latest returned screenshot, measured from its top-left. Set relative:true for integer thousandths from 0 to 1000 instead. The Host converts both modes to native window points; AX detail bounds remain global macOS points. A verified window can expose no AX elements. Its empty snapshot permits screenshots and coordinate input; element-index actions require an element from a fresh AX observation.

Initialize the object API once in persistent PTC. Reuse its variables in later calls; put temporary declarations inside { ... } blocks to avoid redeclaration errors. All object methods are async. getAXState returns text, not a structured state object. Its text separates values and placeholders, and reports subroles, help, URLs, disabled/focused/selected/expanded state and UTF-16 selection ranges when available. Writability is true, false or unknown on relevant controls; omitted state fields do not assert false. selection=unavailable means the reported range exceeds the observed text. Compact output omits ordinary Press/Pick (click), ShowMenu (right click) and ScrollToVisible actions; details=true lists every available action. Use the displayed action name with performSecondaryAction; ambiguous aliases require the complete name from details=true. Truncation reports the reached provider limit. Narrow the window or increase that provider limit before reading again.

Use app methods directly for single-window tasks; getApp already reads initial AX state. Call app.getWindows() and await app.getWindow(windowId) only to target a particular window or resolve ambiguous window selection. App screenshots and coordinate actions use the latest AX observation: its focused on-screen, nonzero-size window, otherwise the sole such window. They do not refresh focus automatically. Read app.getAXState() to follow changed focus.

CuaScreenshot contains { bytes: Uint8Array, mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif", pixelWidth: number, pixelHeight: number, windowId: number }. Use mimeType to choose a file extension or declare an image; do not assume PNG.

Object API signatures (options default to { emit: true }):

- cua.getCapabilities(options?) -> { platform, permissions, sessionLocked, methods, coordinateSpace, browser }
- cua.listApps(options?) -> Array<{ id, displayName, isRunning: true, pid }>
- cua.findApps(query: string, options?) -> Array<{ id, displayName, path, isRunning, pid? }>
- cua.getState(options?) -> { apps, browsers: [] }
- cua.getApp(selector: string) -> App
- app.activate() -> { dispatched: true, verified: false }
- app.getWindows(options?) -> Array<{ windowId, pid, appName, title, bounds, isOnScreen, onCurrentSpace }>
- app.getWindow(windowId: number) -> Window
- app.typeText(text: string), app.pressKey(chord: string) -> action result
- app.paste(text: string, options?: { format?: "text" | "html" }) -> action result

App and Window methods:

- show() -> { dispatched: true, verified: false, windowId: number | null, foregroundChanged: boolean | null }
- getAXState(options?: { emit?: boolean, disableDiffing?: boolean, includeMenus?: boolean, details?: boolean }) -> string
- getScreenshot(options?: { emit?: boolean }) -> CuaScreenshot
- getAXStateAndScreenshot(options?) -> { state: string, screenshot: CuaScreenshot }
- hover(target: number | [x, y], options?: { relative?: boolean }) -> { dispatched, verified, hoverRoute, systemPointerMoved }
- click(target: number | [x, y], options?: { mouseButton?: "left" | "right" | "middle", clickCount?: 1 | 2, modifiers?: Array<"command" | "control" | "option" | "shift" | "fn">, relative?: boolean }) -> action result
- setValue(elementIndex: number, value: string) -> action result
- selectText(elementIndex: number, text: string, options?: { prefix?: string, suffix?: string, selectionType?: "text" | "cursor_before" | "cursor_after" }) -> action result
- performSecondaryAction(elementIndex: number, action: string) -> action result
- scroll({ x, y, deltaLinesX, deltaLinesY, relative? }) -> action result
- drag(from: [x, y], to: [x, y], options?: { mouseButton?: "left" | "right" | "middle", modifiers?: Array<"command" | "control" | "option" | "shift" | "fn">, relative?: boolean }) -> action result

Raw operation tools use { method, params }, including params: {} for parameterless methods. getApp selects without activating the app. Keep applications in the background for observation and routine input. Do not activate or raise an app during initialization, before each action, or merely because another app is foreground. Prefer advertised AX actions. If a window is hidden or minimized, try app.show() or window.show() and read fresh state. show requests unhide and unminimize without activation, raising or switching Spaces; it chooses the explicit, focused, main or sole AX window. A null windowId means no window was selected for restoration. foregroundChanged compares the front app and top window before and after the request; null means unavailable, and delayed focus changes remain possible. If restoration is unsupported or the window remains unusable, including another Space or Stage Manager, explain the needed foreground step, use app.activate() or an advertised raise action, and read fresh state. Completing the task takes priority when foreground access is necessary. Avoid repeated activation when the user switches away; continue background-capable steps and report what requires foreground access. Applications may still change focus in response to input.

Await operations sequentially. After input, read fresh state to verify the effect. A successful action means dispatched, not verified completion. Cancellation may leave partial effects; never retry uncertain input without observing. STALE_APP requires getApp again; STALE_SNAPSHOT requires getState again. Absolute coordinate input requires a fresh screenshot of that window. Relative input can use a successful AX observation or screenshot. SCREENSHOT_REQUIRED means capture a fresh screenshot before using pixel coordinates. For click and hover, coordinate targets must be [x, y], for example hover([650, 400], {relative:true}). A bare number such as hover(650) is always an AX element index. The relative option applies only to coordinate targets, not AX indices. Window resizing since the latest observation rejects coordinate input; movement alone preserves window-local coordinates. WINDOW_CHANGED requires fresh state before any retry; use an advertised AX action or explicitly restore the window before screenshot or coordinate input, then observe again. PERMISSION_DENIED requires the user to grant macOS Accessibility or Screen Recording access in System Settings. After granting access, observe fresh state before continuing; do not automatically replay prior input.

Hover first uses advertised AX alternate UI without moving the system cursor, preserving revealed descendants until the pointer target leaves their region. When unavailable, it moves the visible system cursor without pressing a button; that route requires the target point to be unobscured in the foreground app. FOREGROUND_REQUIRED requires explicit activation or raising and a fresh observation before retrying. Returning, AX reads and screenshots do not restore the previous point. Wait for the application's hover delay, observe, then hover into the revealed controls before clicking. Use successive hover calls for intermediate points. The result reports hoverRoute and systemPointerMoved. Other input or application changes can interrupt the interaction; app objects do not reserve applications between calls.

Use selectText only on controls advertising selectionWritable. It selects a unique literal occurrence, or places the cursor before/after it; prefix and suffix must be immediately adjacent. AMBIGUOUS_TEXT requires more context; TEXT_NOT_FOUND or SELECTION_CHANGED requires a fresh observation before deciding on input. Left clicks support single/double clicks; right and middle clicks support single clicks. Modified clicks use pointer input. Keypad names such as KP_0 and KP_Enter retain their physical key identity. Window objects expose observation and pointer/AX actions; keyboard input remains app-scoped and follows current focus. Scroll deltas are integer lines from -10 to 10; positive values reveal content above or left. Paste delivers plain text or HTML through the application's enabled standard Paste menu command. Paste follows the target app's focused text input. Foreground requirements vary by application; for example, ChatGPT/Codex was observed to accept background Paste without reading clipboard data. PASTE_NOT_CONSUMED means the command was dispatched but no clipboard read was observed before the configured deadline. Inspect the target contents, explicitly activate the app and focus the intended input, then observe again before deciding whether to retry; a delayed paste may still run. Original clipboard formats are restored if the clipboard still belongs to this paste; a later copy is preserved. Unsupported Paste commands fail without typing fallback. CLIPBOARD_CHANGED means another writer intervened; observe before deciding on further input. Browser applications can be controlled with getApp like other native apps; browser tabs are unavailable. Installed-app search covers standard macOS application directories; use an absolute application path for another location. Launch does not restore a window or document, and cancellation may leave an application already started. The execution host must install the object API and own variable persistence; this plugin does not preload a cua global. In persistent PTC, use the host-provided initialization snippet below once. Its installation-owned file URL works independently of the project directory. Retain app objects between calls. Observation methods emit by default and also return their value. Use void await app.getAXState() to avoid a duplicate REPL completion, or pass emit:false and print the returned text once. End screenshot calls with void await app.getScreenshot() or void await app.getAXStateAndScreenshot() so image bytes are not serialized as the program completion value.
```

#### トークン効果

プラグインの有効化は固定スキーマとガイダンスを追加する。AX 観測、操作結果、承認済み画像がモデル入力を追加する。保持オブジェクトはこのパッケージによってプロンプトに直列化されない。

#### KV キャッシュ効果

ツール結果はセッション履歴に追記される。プラグイン設定やツール表示の変更はリクエスト接頭辞を変え得る。app オブジェクトの保持は既存履歴を変えない。

## 既知の制限と将来の課題

キューは個々のネイティブリクエストを順序付ける。app オブジェクトの保持はセッションをまたいでアプリケーションを確保しない。[継続相互作用](../../../.agents/notes/implemented/architecture/2026-10-13-cua-continuous-hover.md)は呼び出し横断の所有を与えない。復帰しないキャプチャ RPC は単一キャプチャスロットを占有し、新しい app オブジェクトの作成はそのシステム接続をリセットしない。

<a id="known-limitations-and-deferred-work"></a>

- macOS ネイティブ実装のみ提供される。Windows 対応は開発中であり、対応完了までこのパッケージは `experimental` に残り、その後 `computer-use` グループへ移動する。ブラウザタブ、AX 差分、関連付けのないシステムパネル、アクセサリ専用アプリは未対応である。
- 座標はタイトルバーを含む返却スクリーンショットのピクセルを使う。`relative: true` は 1000 分の 1 整数を選択する。ネイティブポイント変換はホスト所有である。ウィンドウ移動、アプリケーション変化、他のデスクトップ利用者が観測と入力に競合し得る。
- macOS Stage Manager はバックグラウンドウィンドウの境界とスクリーンショットをサムネイルに縮小し得る。この状態での全ウィンドウ観測と座標入力は保証されない。モデルガイダンスはフォアグラウンドの必要性の説明と繰り返しのフォーカス奪取の回避を要求する。
- バックグラウンド入力は非公開 SkyLight シンボルに依存する。macOS 更新で利用不可になり得る。対象 OS バージョンごとに検証する。
- 観測された失敗には、ディスパッチ済み Unicode テキストが Blender に表示されないことや、バックグラウンドの Command+A が AppKit で全テキストを選択しないことがある。入力後にアプリケーション状態を検査する。成功ツール結果はディスパッチのみを確認する。
- ネイティブバイナリはローカルビルドを要する。署名、配布、システム権限オンボーディングは将来の課題のままである。
- 永続 PTC は外部依存の仮定であり、このパッケージの実装ではない。実モデルでのタスク成功はネイティブおよびプロトコル fixture を超える個別評価を要する。

-----

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト</summary>

なし。

</details>
