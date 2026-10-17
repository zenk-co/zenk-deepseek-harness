---
description: "Windows ACL サンドボックスと通常サブプロセス Job ランナーを実装またはデバッグするメンテナー向けの低レベル Win32 プロセスプリミティブ。"
kind: "package-library"
---

# @deepseek-ai/dsh-win32-process

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

この低レベル Win32 プロセスライブラリは、Windows ACL サンドボックスと通常サブプロセス Job ランナーに消費される。再利用可能なプロセス・stdio・Job Object 操作のためのリポジトリ唯一の Koffi 結合テーブルを所有する。Cordis サービスではなく、サンドボックスポリシーや公開子動作を選ばない。いずれかのネイティブプロセスパスを保守する場合やハンドル寿命の制限を確認する場合に、このページを読む。

## 目次

- [動作](#behavior)
- [ヘッダー検証](#header-verification)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="behavior"></a>
## 動作

- **再利用可能な ABI 所有者 1 件** — `abi.ts` は両プロセスパスが消費する Win32 定数と x64 レイアウト値を所有する。`ffi.ts` は `kernel32.dll` と `advapi32.dll` を遅延読み込みし、`STARTUPINFOW` と `PROCESS_INFORMATION` を検証し、型付き操作とエラー整形を公開し、サンドボックスポリシーが同じ読み込み済みライブラリ経由で残り API を結合できるようにする。
- **制限トークン生成** — `RestrictedProcessSpawnOptions` はサンドボックスのプライマリトークンを要求し、`CreateProcessAsUserW` を使う。パイプと継承 stdio パスはコマンドライン引用、cwd、制限トークン null 環境ポリシー、検査済み戻り値、ハンドルクリーンアップを共有する。
- **パイププロセスプリミティブ** — `spawnPipedProcess()` は匿名 stdin/stdout/stderr パイプを作り、stdin をただちに閉じ、2 つの読み端を返し、プロセス待機とパイプ排出を呼び出し元に残す。すべての部分失敗は操作が既に所有したハンドルを閉じ、すべての Koffi out パラメーター・構造体確保は Win32 寿命の後に解放される。
- **継承 stdio Job プリミティブ** — `spawnInheritedJobProcess()` は kill-on-close Job を 1 件作り、現在の stdio ハンドルを一時的に継承可能にし、制限子を中断状態で作り、Job に割り当ててから初期スレッドを再開する。Job 割り当て前にターゲットコードは実行できない。制御された割り当てや再開の失敗は、中断中の子を終了させるか、所有するすべてのハンドルを解放する前に割り当て済み Job を閉じる。
- **通常 Job ランナープリミティブ** — `CurrentTokenProcessSpawnOptions` は解決済み `applicationName`、完全なターゲット環境、ターゲット stdin・stdout・stderr 専用の 3 つのランナー CRT 記述子を要求する。`spawnCurrentTokenJobProcess()` は Node 公開 `uv_get_osfhandle()` 経由でそれらの記述子を OS ハンドルへ写像し、無効な結果を拒み、ハンドルを一時的に継承可能にし、`STARTF_USESTDHANDLES` 経由で渡す。`CREATE_UNICODE_ENVIRONMENT` 付きでソート済み UTF-16LE 環境ブロックを送り、`CreateProcessW` 経由でターゲットを中断状態で作り、無名 kill-on-close Job に割り当て、割り当て後にのみ再開する。元のコマンドライン argv エントリは不変のままであり、ランナーは Node 自身の標準ストリームに触れずにキャリア記述子を閉じられる。
- **通常決着操作** — `pollProcessExit()` は直接終了を別々に公開し、`isJobEmpty()` は `ActiveProcesses` がゼロに達するまで `QueryInformationJobObject(JobObjectBasicAccountingInformation)` を読む。検査済み Job 終了とハンドル閉鎖により、ランナーが唯一のネイティブ所有者であり続ける。
- **明示的決着所有** — `waitForProcessExit()` は待機してサンドボックスプロセスハンドルを閉じる。通常ランナーのプロセスポーリング、Job 会計、検査済み Job 終了・閉鎖は別操作のままである。`drainPipe()` は排出中に 1 つのネイティブ数スロットを再利用し、解放してパイプ読みハンドルを閉じる。各呼び出し元は自身の結果合成と返されたハンドルを所有する。

プロセス生成はターゲットコード実行前に `SW_HIDE` 付き `STARTF_USESHOWWINDOW` を設定する。コンソール継承を保ち、制限トークン下で DLL 初期化を失敗させうる `CREATE_NO_WINDOW` や `CREATE_NEW_CONSOLE` は追加しない。既存の親コンソールウィンドウは隠されない。
Windows ACL サンドボックスはこれらのプリミティブの上に SID、DACL、付与、ワークスペース、公開子ポリシーを加える。

- **継承制御記述子** — Job 生成は任意の fd-7 パイプを受け入れる。`STARTUPINFO.cbReserved2/lpReserved2` は標準ハンドル、閉じたスロット 3〜6、スロット 7 の制御パイプを持つ 8 スロット CRT 記述子テーブルを運ぶ。テーブルは CreateProcess が返るまで確保され、一時的ハンドル継承は成功時も失敗時もリセットされる。Node が既に確保した記述子を上書きしないよう、Node 開始前にスロットを初期化する。

<a id="header-verification"></a>
## ヘッダー検証

プロセス・stdio・Job 定数と選択された構造体サイズ・オフセットは、MinGW Windows ヘッダーに対して [`verify/abi-probe.cpp`](verify/abi-probe.cpp) で検査される。

```sh
g++ -std=c++20 -municode -O2 -o abi-probe.exe verify/abi-probe.cpp && ./abi-probe.exe
```

Koffi の `STARTUPINFOW` と `PROCESS_INFORMATION` 定義はモジュール読み込み時に 64 ビットサイズも assert する。プローブはさらにポインターとハンドル幅、Unicode 環境フラグ、静穏判定に使う基本 Job 会計レコードサイズと `ActiveProcesses` オフセットを固定し、記録された他のオフセットと定数の証拠であり続ける。

<a id="model-experience"></a>
## モデル体験

### プロセスプリミティブ

#### モデルが見るもの

直接は何もない。このパッケージはサンドボックスと通常ランナー向けに `Win32ProcessBindings`、`CurrentTokenProcessBindings`、プロセスプリミティブを公開し、モデル可視ツール・出力・診断はすべてそれらが所有する。このパッケージはプロンプトテキストやツールスキーマを寄与しない。

#### トークンへの影響

直接はない。プロセス出力がツール結果や後のモデルリクエストに入るかはコンシューマーが決める。

#### KV キャッシュへの影響

このパッケージは安定したリクエストプレフィックスを寄与しないため、モデル KV キャッシュを無効化しない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **Windows 専用ネイティブ読み込み** — 汎用型の import は移植性があるが、結合テーブルの解決は Windows DLL を読み込むため他の host では失敗する。クロスプラットフォームテストはネイティブ API 読み込みの代わりに結合テーブルを注入する。
- **公開プロセスサービスなし** — このパッケージは意図的にプリミティブを Cordis や Node ストリームで wrap しない。コンシューマーは自身のポリシー、非同期スケジューリング、出力制限、キャンセル、最終ハンドル閉鎖を所有しなければならない。
- **制限トークン null 環境** — `CreateProcessAsUserW` サンドボックスプリミティブは null 環境ブロックを渡し、先に `SetEnvironmentVariableW` 経由で変更を確立する。Koffi 経由の明示ブロックは `ERROR_INVALID_PARAMETER` で失敗するためである。通常 `CreateProcessW` ランナーは代わりに完全なターゲット環境を要求し、`=X:` ドライブエントリを含むソート済み・二重 NUL 終端 UTF-16LE ブロックを渡し、自身の環境を変更しない。
- **スタンドアロンプロセス API なし** — このパッケージは現在のサンドボックスと通常ランナーのコンシューマーが必要とする操作を公開するが、Node ストリーム、公開ハンドル、出力ポリシー、キャンセル、耐久状態は所有しない。
- **生成から割り当てまでの割込** — ターゲットは中断状態で開始し、Job 割り当て前に実行できないが、プロセス生成と割り当ての狭い間隔でランナーが外部終了されると中断中のターゲットが残ることがある。このパッケージは原子的な Job 付着を主張しない。
- **ヘッダー証拠はアーキテクチャ固有** — コミット済み ABI プローブとレイアウト定数はリポジトリの現行 64 ビット Windows ターゲットをカバーする。新しいポインター幅や非互換 Windows ABI は、対応を主張する前にプローブ更新を要する。


<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
