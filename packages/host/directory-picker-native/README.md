---
description: "directory-picker シームのネイティブ OS チューザーバックエンド: Web GUI ホストのディスプレイ前にいるオペレーター向けに選択ごとにプラットフォームチューザーを 1 件開く。"
kind: "package-reference"
---

# @deepseek-ai/dsh-host-directory-picker-native

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

ホストのディスプレイ前のオペレーターはネイティブ OS チューザーでワークスペースディレクトリを選ぶ。`dsh-host-directory-picker-native` は選択ごとにプラットフォームディレクトリチューザーを 1 件開き、選ばれた絶対パスを解決する (キャンセル時は `null`)。macOS は標準編集メニューを運ぶスクリプト AppKit パネルを駆動し、Linux は KDialog フォールバック付き Zenity を使い、Windows は生成子プロセスでモダンな `IFileOpenDialog` を開く。ホストのディスプレイ前にオペレーターがいるときにのみ viable であり、リモートデプロイメントは代わりに [browse バックエンド](../directory-picker-browse/README.md) を構成する。1 構成行はワークスペースフロー中の一致するブラウザー側操作も登録するため、両側を選ぶ。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

オペレーターがホストのディスプレイ前で作業し、ネイティブチューザーが適切な操作であるときにこのバックエンドを構成する。ディレクトリピッカーを開くワークスペースフローは開要求ごとに `pick(signal)` を 1 回呼ぶ。返された promise は選ばれた絶対パスで解決し、オペレーターがキャンセルすると `null` になる。

### 選ぶべきとき

macOS、Windows、デスクトップ Linux のワークステーションローカルオペレーターにはこのバックエンドを選ぶ。OS チューザーに届かないクライアント (リモートブラウザー、SSH 転送セッション、無人ホスト) には [browse バックエンド](../directory-picker-browse/README.md) を選ぶ。状況が変わり得るときは[適応チューザー](../directory-picker-auto/README.md) が起動時に解決する。

### オペレーターが体験すること

各呼び出しはホストディスプレイにネイティブチューザーを 1 件開き、オペレーターを待つ。呼び出し元シグナルの中断はチューザープロセスを開いたままにせず終了させる。Linux のチューザーは Zenity または KDialog のいずれかのインストールを要する。どちらもないと、`pick` は型付きパスプロンプトへのフォールバックではなく、対処可能なエラーで拒否する。このパッケージのブラウザー半分はワークスペースフローに描画なしフロー占有を登録する — すべての `open` 要求が `directoryPicker/pick` を駆動し、1 件の結果 (選択パス、キャンセル、失敗) を報告する。

### 観測可能な失敗

キャンセルはエラーではなく `null` を返す。プラットフォーム道具の欠落、チューザー起動失敗、中断された選択は UI が提示できる拒否として現れる。[browse バックエンド](../directory-picker-browse/README.md)はネイティブ選択が信頼できないデプロイメント向けの構成レベルフォールバックのままである。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

### 設計コンセプト

バックエンドはプラットフォームチューザー上の薄いサービスである。`NativeDirectoryPicker` は `pick` を `pickNativeDirectory` に転送する `native` ケイパビリティを登録し、チューザーはホストプロセスがダイアログでブロックしないようサブプロセスとして走る。コマンド境界 (`DirectoryPickerRunner`) とプラットフォーム事実は注入可能であり、共有ノーシェルサブプロセスランナーは [`dsh-native-command`](../../util/native-command/README.md) にある。

### プラットフォーム機構

プラットフォーム道具はシェルなしで走る。macOS では `osascript -l JavaScript` スクリプト 1 件がシステム JXA ホスト経由で走り、標準編集キー相当を運ぶ主メニューを据え、`NSOpenPanel` を開く。ネイティブパネルはフォーカス欄ではなくそのメニューに対して ⌘C/⌘V/⌘A/⌘X を解決する。AppleScript のメニューレス `choose folder` ダイアログはこれを提供できなかった。Linux は Zenity を使い、KDialog をフォールバックにする。呼び出し元の中断はネイティブプロセスを終了させる。Windows は生成子プロセスでモダンな `IFileOpenDialog` を開く — 子の主スレッド上の koffi 駆動 COM 会話であり、ホストが受け入れる最良のスレッド DPI 認識 (まず per-monitor-v2) を使い、ダイアログスレッドへの `WM_CLOSE` 送付で中断する。`Show` 直前に子は `keybd_event` 経由で Alt 押下を 1 回合成し、バックグラウンドホストプロセスが子を生成してもダイアログがフォアグラウンドウィンドウとして活性化できるようにする。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: 安定 `native` ケイパビリティを持つ `NativeDirectoryPicker` サービス |
| [`src/native-picker.ts`](src/native-picker.ts) | チューザー振り分け: プラットフォーム選択、サブプロセス実行、中断配線 |
| [`src/win32-dialog.ts`](src/win32-dialog.ts) + 姉妹編 | koffi 経由の Windows 子プロセス `IFileOpenDialog`、DPI 処理、`WM_CLOSE` 中断 |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

バックエンド契約では足りないときにこれらを読むこと。まずシーム定義、次に代替バックエンドと両者を選ぶチューザーへ進む。

- [Directory-picker シーム](../directory-picker/README.md) — `native` ケイパビリティ契約と型付きエラー語彙。
- [Directory-picker ケイパビリティシーム決定](../../../.agents/notes/archived/architecture/2026-07-28-directory-picker-capability-seam.md) — 操作形状がバックエンドで異なる理由。
- [Browse バックエンド](../directory-picker-browse/README.md) — リモートクライアント向けアプリ内代替。
- [適応チューザー](../directory-picker-auto/README.md) — ネイティブと browse 間の起動時解決。
- [ノーシェルサブプロセスランナー](../../util/native-command/README.md) — チューザーが載る共有サブプロセスプリミティブ。

-----

<a id="model-experience"></a>
## モデル体験

なし。GUI ホスト選択バックエンドはモデル向けに何も登録しないためである。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立てず送らない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限はネイティブ操作が利用不可または脆い場合を定める。現在のパッケージ制約であり、タスクバックログではない。

- **Linux はデスクトップ道具を要する** — Zenity も KDialog もインストールされていないと `pick` は対処可能なエラーで拒否する。型付きパスプロンプトにはフォールバックしない (browse バックエンドが構成レベルのそのフォールバックである)。
- **Windows に機構フォールバックなし** — パッケージ済み koffi 経由の子プロセスピッカーが唯一のネイティブ層であるため、COM 拒否やダイアログクラッシュは失敗を表面化させる。browse バックエンドは引き続き構成レベルのフォールバックである。
- **Windows フォアグラウンド付与は注入入力に依存** — 子は `Show` 前に Alt 押下を合成し、バックグラウンドホストからダイアログがフォアグラウンドを取れるようにする。合成入力が抑止される所 (セキュアデスクトップ、制限リモートセッション、昇格フォアグラウンドウィンドウ) ではダイアログが他ウィンドウの背後に開き得る。この手法は Windows 11 でのみ検証されている。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
