---
description: "ネイティブ macOS ヘルパーのプロトコル、入力セマンティクス、共有サービスのライフサイクル、および検証コマンド。"
kind: "package-reference"
---

# dsh-cua ネイティブヘルパー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

この macOS 14+ の JSON-lines ヘルパーは、Swift 6、AppKit、Accessibility、CoreGraphics、ScreenCaptureKit を使用する。Windows サポートは開発中である。外部ドライバーをロードせずに、MIT ライセンスの Cua Driver の振る舞いの一部を適合している。`upstream.json` は固定されたアップストリームバージョン、適合した Swift ファイル、ローカルモジュールを記録し、`LICENSE.cua-driver` は MIT 表示を保持する。

## 目次

- [ビルドとサービス](#build-and-service)
- [リクエストプロトコル](#request-protocol)
- [観測と入力](#observation-and-input)
- [検証](#verification)

-----

<a id="build-and-service"></a>
## ビルドとサービス

`swift build --package-path packages/experimental/cua-macos/native --configuration release` でビルドする。バイナリはこのディレクトリ配下の `.build/release/dsh-cua-native` である。Host は `--ensure-shared` を管理された起動コマンドとして実行する。その後、サービス提供プロセスは接続されたクライアントに属し、最後の接続がクリーンアップを終えると終了する。`.build/` ディレクトリはコミットされない。

共有サービスは `/tmp/dsh-cua-<uid>` の下の所有者専用 Unix ソケットを使用し、実行ファイルの SHA-256 でキー付けされる。バージョンロックが 1 つのプロセスを選出し、追加の実実行ファイルパスロックが同じパスにある異なるビルドを排除する。最初のフレームはプロトコル 1 の `hello` で、ランタイムキーとこの接続のバイト、AX、操作、スクリーンショット、イベント間隔、クリーンアップの制限を運ぶ。`ready` は検証済みのランタイムキー、PID、インスタンス ID を報告する。すべての接続は独立した AXWorker を所有する。stdin/stdout エントリーはこのサービスへの診断プロキシである。

AppKit はメインイベントループで実行される。ブロッキング AX と入力は各接続のシリアルアクターを使用し、すべての接続が完全なデスクトップ操作のための FIFO を共有する。ソケット書き込みはその操作スロットを保持しない。リクエストのキャンセルはネイティブ作業の停止を待ち、接続のライフタイムラッチはキャンセルしない。スクリーンショットのタイムアウトはそのリクエストのみを終了する。未完了のシステムキャプチャは、実際のコールバックが届くまで単一のキャプチャスロットを保持し、新しいキャプチャを CAPTURE_BUSY で拒否し、AX/入力は利用可能なままにする。停止できない操作またはクリーンアップだけが共有プロセスを無効化し得る。プロキシは `--max-request-bytes`、`--max-response-bytes`、`--ax-timeout-ms`、`--timeout-ms`、`--screenshot-timeout-ms`、`--shutdown-grace-ms`、`--text-event-interval-ms` を受け入れる。Host は hello で同じ制限を設定する。AX のデッドラインは個々のシステムコールを制限する。キャンセルは部分的な入力に続くことがあり、不確定な入力が自動的に再生されることはない。


-----

<a id="request-protocol"></a>
## リクエストプロトコル

操作フレームは `{ "id": "opaque request id", "method": "method name", "params": {} }` のままである。対応する返信は `result` または `error: {code, message}` のいずれか 1 つだけを含む。不正なエンベロープは null ID とともに `INVALID_REQUEST` を返す。接続は一度に最大 1 つの操作を送信する。`{ "type": "cancel", "id": "request id" }` はそのリクエストをキャンセルする。遅延したキャンセルは追加の返信を生まない。`protocol.schema.json` が操作フィールドを定義する。

スクリーンショット診断は、発信元の接続で `type: "diagnostic"` フレームを使用する。レコードは requestId、stage、受信からの elapsedMs、および任意の errorCode を含み、ウィンドウタイトル、AX テキスト、画像バイトは含まない。stdin/stdout プロキシはそれらを `[cua-screenshot]` 付きで stderr に転送する。操作の返信は stdout に残る。Host は制限付きの診断バッファを保持し、スクリーンショットの失敗にそれを含める。

成功した `activate` と `performSecondaryAction` の AXRaise 結果は、`{dispatched: true, verified: false}` に加えて `foreground` を含む。これは `requestId`、`operation`、`targetPid`、null 許容の `targetWindowId`、`activationRequested`、`raiseRequested`、および即時の `before`/`after` 観測を記録する。`frontPid` は WindowServer から来る。`focusedWindowId` はターゲットアプリの AX フォーカスウィンドウであり、`frontWindowId` と `frontWindowPid` は最初の可視の通常ウィンドウを識別する。未知の値は null である。観測は逐次的であり、アトミックでも因果性の証明でもない。ツール所有のリクエストは記録されたツール呼び出し ID を使用する。失敗した操作は既存のエラー応答を保ち、部分的な効果を持ち得る。

| メソッド | 結果 |
| --- | --- |
| `getCapabilities` | `{platform: "macos", permissions: {accessibility, screenRecording}, sessionLocked, methods, coordinateSpace: "window-points", browser: false}`。パーミッション値はブール値の事前確認観測であり、システムプロンプトは開かない。 |
| `listApps` | 実行中の通常アプリケーションの `{pid, name, bundleId}` の配列。 |
| `findApps` | 標準のアプリケーションディレクトリまたは絶対アプリケーションパスからの、インストール済みの一致 `{id, displayName, path, isRunning, pid?}`。検出がそれらを起動することはない。 |
| `getApp` | 正確な名前、バンドル ID、10 進数 PID、またはアプリケーションパスで選択された `{appHandle, pid, name, bundleId, authorization}`。停止した選択は `pid: null` を持ち、Host の同意を待つ。曖昧な名前は失敗する。 |
| `launchApp` | 同意後の Host 専用の継続。選択されたアプリケーションをアクティベーションを要求せずに起動し、起動完了を待ち、ハンドルを検証済みのプロセス identity にバインドする。 |
| `listWindows` | 所有する通常ウィンドウと `{windowId, pid, appName, title, bounds, isOnScreen, onCurrentSpace}`。Space のメンバーシップは null になり得る。 |
| `getState` | `{appHandle, pid, windowId, focusedWindowId, snapshotId, tree, elements, windows, truncated}`。`windowId` はアプリ全体の観測では null である。要素は index、role、title、value、description、identifier、bounds、actions、および enabled 状態を含む。要素の bounds は null またはスクリーンポイントの [x, y, width, height] であり、ウィンドウ入力はローカルポイントを使用する。これらの構造化要素診断はネイティブチェックによって保持され、モデルツールのプロジェクションでは省略される。利用できない任意の記述プロパティは null で、利用できないアクションリストは空である。パーミッション、通信、ウィンドウ検出の失敗は依然として観測を拒否する。 |
| `hover`, `click`, `setValue`, `selectText`, `typeText`, `paste`, `pressKey`, `scroll`, `drag` | `{dispatched: true, verified: false}` はネイティブのディスパッチを記録する。意図したアプリケーション変更を検証するには、新鮮な状態を読み取る。 |
| `screenshot` | `{mimeType: "image/png", data, pixelWidth, pixelHeight, bounds, coordinateSpace: "window-points", windowId}`。PNG のピクセル寸法は、Retina ディスプレイではウィンドウのポイント寸法と異なり得る。 |

すべてのアプリ対象の操作は、同じヘルパー内の `getApp` からの `appHandle` を要求する。ヘルパーは PID とカーネルのプロセス開始時刻を固定し、プロセス終了または PID 再利用の後にハンドルとそのすべてのスナップショットを無効化する。`getApp` の呼び出しは、古いハンドルを再有効化することなく置き換えプロセスを取得できる。ヘルパーごとのランダムな名前空間が、終了したヘルパーのハンドルがその代替のものと一致することを防ぐ。同じライブプロセスの繰り返し取得はそのハンドルを共有する。

安定したエラーコードは `INVALID_REQUEST`（不正なエンベロープ）、`INVALID_ARGUMENT`（無効なパラメーター）、`UNSUPPORTED`（未知の操作）、`APP_UNAVAILABLE`、`AMBIGUOUS_APP`、`STALE_APP`、`STALE_SNAPSHOT`、`WINDOW_UNAVAILABLE`、`WINDOW_CHANGED`、`PERMISSION_DENIED`、`FOREGROUND_REQUIRED`（ホバーターゲットが遮蔽されていない最前面ウィンドウでない）、`PANEL_NOT_READY`（入力前にシステムパネルの受信者が利用できない）、および `NATIVE_ERROR`（残りのオペレーティングシステムの失敗）である。エラーは、部分的にディスパッチされた入力がロールバックされたことを決して約束しない。ホストは入力を自動的に再試行してはならない。

アプリケーション選択は、Host に認可 identity を返す前に、実行ファイルパスとコード署名の要件を検証する。署名のない実行中アプリケーションはプロセスライフタイムの identity を受け取り、停止した署名なしアプリケーションは実行ファイルのダイジェストを使用し、永続的な同意を受け取れない。Host は起動、観測、または入力の前に人間の同意を得る。

プロトコル宣言は[共有プロトコル](../../cua/src/protocol.ts)から生成される。リポジトリルートから `pnpm exec tsx packages/experimental/cua-macos/native/generate-protocol.ts` を実行する。パッケージテストが生成された JSON と Swift のフィールド/列挙テーブルを検証する。モデルが提出できるパラメーターは、Host のリソース境界とプライベートな起動継続を除外する。


-----

<a id="observation-and-input"></a>
## 観測と入力

`getState` はオプションで、AX トラバーサルを所有ウィンドウまたはネストされたシートの `windowId` にスコープする。新規または失敗した更新は、そのアプリ/ウィンドウスコープの以前のスナップショットを無効化し、他のウィンドウスコープは使用可能なままである。所有する CG ウィンドウに対応する AX サーフェスがない場合、getState は空の tree/elements と切り捨てなしの新しいスナップショットを返し、その座標とスクリーンショットは利用可能なままである。トラバーサルの後に、プロセスのライフタイム、ウィンドウの所有権、ロック解除されたセッション、および Accessibility パーミッションを再確認する。ウィンドウ検出の APIDisabled と通信エラーは失敗のままである。サポートされない、または存在しない任意の AX 属性は空の観測を生み得る。欠如した、または他者所有のウィンドウが空の成功を生むことは決してない。トラバーサル中に無効化された AX 要素は読み取り全体を `STALE_SNAPSHOT` で拒否し、部分的なスナップショットは公開されない。呼び出し元は、入力を繰り返さずに、アプリケーションの変更後に再び読み取ってよい。要素アクションは正確なスナップショット ID を要求する。ネイティブ参照が JSON を越えることはない。座標アクションの任意のスナップショット ID は、そのウィンドウまたはアプリ全体の観測に属していなければならない。ウィンドウリストの更新は、閉じられたウィンドウのスナップショットを解放する。ネイティブのプロセス identity、スナップショット世代、およびウィンドウ所有権のチェックは、同時のユーザーやアプリケーションの変更に対してデスクトップをロックしない。

要素クリックは、広告された AX アクションを優先し、そうでなければポインターデリバリーを使用する。座標クリック、スクロール、ドラッグは、ウィンドウの所有権と境界を検証してから、バックグラウンドの PID/ウィンドウ指向プリミティブを使用する。各イベントは利用可能な場合は SkyLight を使用し、そうでなければ公開の PID 対象 API を使用する。ポストされたイベントがもう一方の API を通じて繰り返されることはない。座標は、タイトルバーを含むウィンドウ全体の左上からの macOS ポイントである。正の `deltaLinesY` は上方向のコンテンツを現し、負は下方向を現す。正の `deltaLinesX` は左方向のコンテンツを現し、負は右方向を現す。各軸は -10 から 10 の整数を受け入れ、少なくとも 1 つは非ゼロでなければならない。ヘルパーは行単位のスクロールイベントを直接送信する。クリックとドラッグは left/right/middle ボタンと command/control/option/shift/fn 修飾子を受け入れる。ダブルクリックをサポートするのは左クリックだけである。修飾された要素クリックはポインターデリバリーを使用する。ドラッグは 1 つのウィンドウ内で 1 回のボタン押下/移動/解放を使用し、呼び出し元が durationMs（1..5000）と steps（1..240）を明示的に供給する。移動遅延の予算はセグメント間で小数精度をもって分割され、固定の押下/解放のセトリングとスケジューラー遅延が加算される。グローバルデスクトップ入力を送る暗黙のフォールバックはない。

キャプチャとポインターデリバリーは、正確なウィンドウの AX フレームクエリの前後に CG 境界を読み取る。クエリ中の移動は WINDOW_CHANGED を返す。有効な AX/CG フレームは、外側に丸めた整数ポイント矩形が一致していなければならない。既知の不一致は、マウス移動、プライミング、またはボタンデリバリーの前に WINDOW_CHANGED を返す。ヘルパーは CG ジオメトリの代わりに AX ジオメトリを代入せず、両方の座標ソースを保持する。欠如した、または使用不能な AX ジオメトリは unknown のままで、AX 通信、パーミッション、無効要素のエラーは伝播する。Accessibility パーミッションなしのキャプチャは、その CG/SCK チェックを保つ。広告された AX アクションはこのポインター事前確認をバイパスし、AX アクションのエラーがポインター入力をトリガーすることはない。これらの読み取りは、その後の移動に対してウィンドウをロックせず、どのジオメトリチェックもウィンドウをアクティブ化またはレイズしない。

`typeText` と `pressKey` は、正確なウィンドウではなく、選択されたプロセスの現在のフォーカスコントロールを対象とする。キーコードは、ベースキーの前に PID 対象の修飾子遷移を送信し、修飾子を逆順に解放する。これらのイベントはグローバル HID キューを使用しない。バックグラウンドのポインターアクションがそのキーボードフォーカスを変え得る。KP_0 や KP_Enter のようなキーパッド名は、その物理キーコードを保つ。テキスト注入は Unicode 文字を個別に送信し、クリップボードを使用しない。LF、CR、CRLF は 1 つの Return を送り、タブは Tab を送る。アプリケーションは、インデントやフォーカスナビゲーションを含む通常の編集動作を適用する。各 down/up イベントの後に設定されたテキスト間隔が続く。ディスパッチの完了は、受信側アプリケーションがすべてのイベントを消費したことを確認するものではない。キャンセルは、部分的な入力の後にテキストやジェスチャーを中断し得るが、受信済みのイベントを取り消すことはできない。非常に長いテキストはホストの操作デッドラインを超え得る。続行方法を決める前に、観測されたアプリケーション状態を検証する。

責任を負うホスト/ヘルパーは、AX 状態と入力のために macOS の Accessibility パーミッションを、スクリーンショットのために Screen Recording パーミッションを必要とする。ケイパビリティの事前確認とパーミッションエラーがパーミッションを与えることはない。キャプチャは、画像の読み取り中に移動またはリサイズしたウィンドウを拒否する。関連付けのないシステムパネルとアクセサリ専用アプリケーションは選択できない。

観測は、各非レイアウトノードの記述プロパティと子を `AXUIElementCopyMultipleAttributeValues` を通じて読み取る。属性ごとのエラーは個別読み取りの規則を保ち、サポートされないバッチ API は個別読み取りを使用する。値はその観測中にのみ保持され、入力はライブ属性を読み取る。アプリケーション状態はノード間で変わり得る。バッチがツリー全体をアトミックにするわけではない。

システムファイルパネルのキーボードルーティングは、選択されたアプリのフォーカスされた AX シートを通じてリモート受信者を解決する。受け入れられるのは Apple の Open and Save Panel Service だけであり、そのフォーカスされた祖先は識別されたリモートウィンドウを依然として含んでいなければならない。要素のポインターフォールバックは、AXWindow が利用できない場合に AX 親を通じてアプリ所有のウィンドウまたはシートを解決する。AX アクションはポインター入力より優先される。視覚的なクリックマーカーはシステムカーソルの移動を必要としない。

リクエストの修飾子配列は command/control/option/shift/fn を受け入れる。オブジェクト API はディスパッチ前にキーコードのエイリアスを正規化する。

`selectText` は新鮮な要素スナップショットと書き込み可能な AXSelectedTextRange を要求する。1 つのリテラル出現を、直接隣接するプレフィックス/サフィックスで絞り込んで一致させ、テキストを選択するか、その前/後にカーソルを置く。一致と報告される範囲は UTF-16 オフセットを使用する。曖昧または欠如したテキストは失敗する。ヘルパーはコンテンツを書き換えずに値と選択範囲を再確認する。AX テキストは利用可能な writable、disabled、selected、および selection-range 情報を含む。AXAccess がインデックスとネイティブ参照を所有し、AXTextFormatter が観測値を描画する。

`paste` は 1 つのプレーンテキストまたは HTML のクリップボード形式を公開し、アプリケーションの有効な標準 Paste メニューコマンドをディスパッチし、クリップボードデータ要求を待つ。その後、所有権マーカーと変更カウントがまだ一致している場合にのみ、保存された形式を復元する。Host はファイルロックでヘルパー間のペーストを直列化する。maxClipboardBytes は入力と保存内容の両方を制限し、サポートされないメニューと過大なデータはディスパッチ前に失敗する。後のコピーは保存される。キャンセルは、可能な場合は所有するクリップボードデータを復元する。強制終了は復元を保証できず、データ要求はターゲットが編集を完了したことを証明しない。ディスパッチの後、`pasteReadTimeoutMs` はクリップボード消費の待機を制限する。期限切れは `PASTE_NOT_CONSUMED` を返し、約束されたデータプロバイダーを閉じ、まだ所有している場合にのみ元のクリップボードを復元する。この失敗はアプリがキューに入った Paste コマンドを処理しないことを証明しない。再試行するかどうかを決める前にターゲットを検査する。

`hover` は観測された要素インデックスまたはウィンドウローカルのポイントを受け入れ、マウスボタンを押すことは決してない。無効なコントロールもホバーできる。リクエストの完了、AX 読み取り、スクリーンショットが以前のポイントを復元することはない。後続の hover 呼び出しは現れたコンテンツに入り得る。クリックは、ウィンドウ外のプライミングクリックなしでターゲットにそのボタンイベントを送る。個々のリクエストは直列化されるが、呼び出し間でアプリケーションが予約されることはない。他の入力やアプリケーションの変更がインタラクションを中断し得る。

`hover` はまず、`AXShowAlternateUI` と `AXShowDefaultUI` の両方を広告する同一ウィンドウの要素または祖先を使用する。現れた子孫は親 UI を保ち、離れると一度だけ復元する。AX アクションの失敗は、別の入力経路を試すことなく伝播する。適用可能な AX 経路がない場合、hover は前景 PID とそのポイントでの AppKit マウスヒットテストを確認した後、システム入力キューを通じて可視のシステムカーソルを移動する。入力透過のウィンドウと透明領域はターゲットをブロックしない。チェックの失敗はカーソルを移動せずに `FOREGROUND_REQUIRED` を返す。結果は `hoverRoute` を `accessibility` または `system-pointer` として識別し、`systemPointerMoved` を報告する。Hover はフォーカスをアクティブ化、レイズ、または復元しない。他の入力やウィンドウの変更がチェックとディスパッチに競合し得る。


-----

<a id="verification"></a>
## 検証

`python3 packages/experimental/cua-macos/native/tests/test_swift.py` を、選択された Apple ツールチェーンの Swift Testing フレームワーク/ランタイムパスを使うオフライン単体チェックに使用し、`python3 packages/experimental/cua-macos/native/tests/protocol_e2e.py` を、デスクトップ操作なしの JSONL アドミッション、順序付けられた返信、EOF シャットダウンに使用する。アプリケーションとプロトコルの e2e チェックは、別途ビルドされた比較バイナリを選択する `--helper` を受け入れる。

`python3 packages/experimental/cua-macos/native/tests/shared_helper_e2e.py --helper /absolute/helper` を実行して、所有された AppKit フィクスチャで、同時起動、共有サービスの PID、独立したハンドル、同一アプリケーションのハンドオフ、リクエストローカルのスクリーンショットデッドライン、接続のクリーンアップ、シグナルシャットダウンを検証する。既存の Accessibility と Screen Recording の許可が必要である。`--without-desktop` はチェックをプロトコルとプロセスのライフタイムに限定する。

ビルドして Mac のロックを解除した後、`python3 packages/experimental/cua-macos/native/tests/axless_e2e.py` を実行して、アプリケーションが AX ルートを除去し後に復元する所有ウィンドウを検証する。チェックは既存の Accessibility/Screen Recording の許可を必要とし、古い要素インデックスを拒否し、AX のないウィンドウをキャプチャし、フィクスチャの状態ファイルで座標クリックを検証し、復元を確認する。システムのパーミッション設定を変更することは決してない。

`python3 packages/experimental/cua-macos/native/tests/observation_benchmark.py --reference-helper /absolute/reference --candidate-helper /absolute/candidate --artifacts /private/evidence` を実行して、35 行と 400 行の合成行を持つ同じ所有 AppKit ウィンドウの完全な観測を比較する。各ヘルパーは 1 回のウォームアップと 3 回の交互の計測リクエストを受け取る。ヘルパーが生成するアプリとスナップショット ID を除き、すべての結果フィールドが一致しなければならない。レポートは生のタイミング、バイト数、ハッシュ、返信を保つ。CI の速度しきい値を設定せず、メモリの主張もしない。フィクスチャの起動がアプリケーションをアクティブ化し得る。他のデスクトップ自動化やコンパイルジョブなしで実行する。

`--panels-only` を使用してシステムファイルパネルのチェックを分離する。フィクスチャウィンドウはアプリケーションセットに参加できるため、バックグラウンド入力中に Stage Manager がそれらを縮小しない。`--hover-only` を `e2e.py` または `electron_e2e.py` とともに使用して、キーボードとファイルパネルのシナリオとは独立にホバーを検証する。`--alternate-hover` を `e2e.py` に追加して、AX の表示、子孫への進入、クリック、および退出を、サンプリングされたシステムポインターの安定性とともに検証する。`--input-overlays` は、パススルーオーバーレイがホバーを許可し、入力ブロックオーバーレイがポインターを移動せずにそれを拒否することを検証する。

ビルド後、`python3 packages/experimental/cua-macos/native/tests/e2e.py` を実行して、分離された 2 ウィンドウの AppKit フィクスチャを試す。これはボタン数、Unicode テキスト、実際のスクロール位置、右クリックコールバック、およびドラッグ解放位置を独立に記録する。スクロール、右ボタンの down/up、およびドラッグの down/up カウンターは、要求されたジェスチャーごとにそれぞれちょうど 1 回増加しなければならない。チェックはまた、実際の NSOpenPanel シート、パス入力のキーボードルーティング、および選択されたファイル URL を検証する。スコープ付きスナップショットの置き換え、スクリーンショットの寸法、古いアプリのクリーンアップ、および EOF シャットダウンをカバーする。`--artifacts DIRECTORY` はフィクスチャ専用のスクリーンショットとプライベートなプロトコルトランスクリプトを書き込む。トランスクリプトは実行中アプリのインベントリを含み、公開成果物ではない。

Blender のキーボードチェックには、`python3 packages/experimental/cua-macos/native/tests/blender_keyboard_e2e.py --blender /absolute/path/to/Blender.app/Contents/MacOS/Blender` を実行する。これはプライベートなユーザーディレクトリを持つ 1 つの所有されたファクトリースタートアップ GUI を起動し、実際のテキストエディターのテキスト、選択、および受信した修飾子フラグを観測し、Command+A の置き換え、Shift+Left の選択、修飾子解放後の通常入力をチェックする。ロック解除された macOS セッションと Accessibility パーミッションを必要とする。テストは自身のインスタンスをアクティブ化するため、同時のデスクトップ自動化なしで実行する。`--helper` はネガティブコントロール用に以前の互換バイナリを選択し、`--artifacts` は新しいプライベート証拠ディレクトリの親を選択する。Blender ランタイムはダウンロードされない。

テキストペーシングの比較には、`native/tests/text_input_benchmark.py` を `--reference-helper`、`--candidate-helper`、`--blender`、`--artifacts` とともに使用する。これは同一の合成 200/2000 スカラー文字列を新しい Blender テキストエディターに入力し、中国語、絵文字、改行を含む完全なテキスト一致を要求する。繰り返し指定できる `--reference-arg` / `--candidate-arg` オプションがヘルパーの起動フラグを選択する。生のリクエストと検証済み効果のタイミングは観測者の公開レイテンシを含み、起動は除外する。これらの手動計測には CI の速度しきい値はない。

独立に分離された Electron/Chromium チェックには、`python3 packages/experimental/cua-macos/native/tests/electron_e2e.py --electron /absolute/path/to/Electron.app/Contents/MacOS/Electron` を実行する。`--electron` を省略すると、すでにインストールされたデスクトップワークスペースランタイムを使用する。チェックが Electron をダウンロードすることは決してない。そのレンダラーは、Node 統合を無効にし、コンテキスト分離と Chromium サンドボックスを有効にし、プライベートな userData/sessionData/log ディレクトリとローカルフィクスチャページで実行される。レンダラーのクリック/入力イベントは、メインプロセスを通じて独立した観測を書き込む。すべてのテストアクションは引き続きネイティブヘルパーを使用する。AX ポーリングは、Chromium のアクセシビリティアクティベーション後に実際のコントロールを待つ。ネイティブと Electron のサブプロセスグループは所有され、一時ファイルが削除される前に停止される。任意の成果物には、フィクスチャ専用のスクリーンショットとプライベートなリクエストトランスクリプトが含まれる。

`python3 packages/experimental/cua-macos/native/tests/capabilities_e2e.py --helper /absolute/helper --artifacts /private/evidence` を実行して、停止したアプリケーションの検出と起動、Unicode 選択、複数行のプレーン/HTML ペースト、ミドル/修飾子ジェスチャー、およびキーパッド identity を、分離された AppKit 受信者を通じて検証する。既存の Accessibility/Screen Recording の許可が必要で、受信者の実際の状態をディスパッチ結果とは別に記録する。

`python3 packages/experimental/cua-macos/native/tests/paste_e2e.py --artifacts /private/evidence` を実行して、所有された AppKit アプリがデータを読まずにバックグラウンドの Paste アクションを受け入れ、`PASTE_NOT_CONSUMED` を報告し、その後フォアグラウンドで同じペーストを消費することを検証する。テストはロック解除された Mac と Accessibility パーミッションを必要とし、自身の 2 つのアプリケーションだけをアクティブ化し、受信したアクションとテキストをヘルパーの返信とは独立に記録する。

-----

## さらに調べる

- [macOS プロバイダー](../README.md)

## 開発者ノート

なし。
