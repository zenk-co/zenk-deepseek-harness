---
description: "ディレクトリーピッカーシームの適応選択子。Web GUI host の状況を起動時に 1 回解決し、一致するネイティブまたはブラウズバックエンドをマウントする。"
kind: "package-reference"
---

# @deepseek-ai/dsh-host-directory-picker-auto

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-host-directory-picker-auto` は起動ごとに正しいディレクトリー選択対話を選ぶ。host の状況を起動時に 1 回解決し、一致するバックエンド（[native](../directory-picker-native/README.md) または [browse](../directory-picker-browse/README.md)）をそのブラウザー半分と共に、インメモリルートツリー内の実 Loader エントリとしてマウントする。解決は 1 回の純粋な起動時サンプルである。`native` はリモート権威信頼なし、ループバック専用 bind、非 SSH 起動、提供可能な表示セッションを要求し、曖昧なものはどこでも動く `browse` に解決される。対話を固定するとはそのバックエンドを直接構成することである。マウントされたケイパビリティはシーム要求どおりサービス寿命を通じて安定である。

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

同じ構成が異なる host に仕えなければならない場合に、具体バックエンドの代わりにこのプラグインを構成する。すなわちネイティブ選択子が動くローカルワークステーションセッションと、アプリ内ブラウザーだけが動くリモート・ヘッドレスセッションである。選択子は host を起動時に 1 回検査し、一致する対話をマウントする。

### 選択の決まり方

`native` は、操作者が host 表示を見られネイティブバックエンドがそれに仕えられることのすべての信号を要求する。リモート権威信頼なし（検証済みすべての `trustedHosts` エントリがループバックホスト名を名指す。`allowsRemoteAuthorities` は false）、ループバック専用 bind（注入済み `webServer` から読む。リモート権威信頼や非ループバック bind は OS 選択子が届かないリモートブラウザーを許す）、SSH 起動なし（共有[起動環境](../../util/launch-environment/README.md)述語はプロジェクト・ユーザー `.env` 値を無視し、継承された空でない `SSH_CONNECTION`/`SSH_TTY` のみ検査する）、提供可能な表示セッション（darwin と win32 では想定あり、linux では `DISPLAY`/`WAYLAND_DISPLAY` と `PATH` 上の zenity または kdialog バイナリ、その他のプラットフォームでは決してなし）である。曖昧なものはすべてどこでも動く `browse` に解決される。

### 得られるもの

解決された対話は通常 Loader エントリとして届く。バックエンドは `ctx.directoryPicker` を登録し、そのブラウザー半分は構成行のものとまったく同じくクライアントモジュールテーブルに発見されるため、シームの 1 行交換両面不変が保たれる。選択子の unload はエントリを除去し、両面を共に unload する。サンプルは起動ごとにちょうど 1 回起きるため、マウントされたケイパビリティはサービス寿命を通じて安定である。

### 対話の固定

固定はここでの構成フィールドではない。こちらの代わりに `-native` または `-browse` 行を直接構成すること。それがシーム文書化の交換点である。選択子とバックエンド行を共にマウントすると loud に失敗する（重複 `directoryPicker` サービス、`single` 穴内の重複クライアントフロー）。

### 観察可能な失敗

誤った `native` 選択は壊れた構成ではなくバックエンド既存の再試行可能失敗ダイアログに劣化する。プローブが証明できないデプロイ向けには `-browse` 直接構成が安全な対話を選択する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

### 設計概念

選択子は純粋な決定とマウントである。`resolveDirectoryPickerBackend` は host 事実を起動時に 1 回サンプリングしてバックエンド種別を返し、`apply` は一致するバックエンドと表面パッケージをインメモリルートツリー内の実 Loader エントリとしてマウントする。構成ファイルへ永続化されることは決してない。ルートツリーの `write()` が no-op であるためである。エフェクトの破棄子は両エントリを除去し、そのファイバーのティアダウンに join するため、unload はマウントされた対話の両面が静穏化した後にのみ戻る。

### 解決テーブル

| 条件 | バックエンド |
|---|---|
| `trustedHosts` エントリが非ループバック権威を許す | `browse` |
| bind host がループバックではない（`isLoopbackHost`） | `browse` |
| `SSH_CONNECTION` または `SSH_TTY` がある | `browse` |
| darwin または win32 | `native` |
| 選択子バイナリと表示がある linux | `native` |
| その他すべて | `browse` |

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグイン入口: `BACKEND_PACKAGES`/`SURFACE_PACKAGES` 写像、適用マウントと unmount |
| [`src/resolve.ts`](src/resolve.ts) | `resolveDirectoryPickerBackend` — 純粋な起動時決定 |
| [`src/probe.ts`](src/probe.ts) | Host プローブ: `hasLinuxChooserBinary`、`canExecute` |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

選択子の契約では足りないときに、これらを読む。まずシーム定義、次にそれがマウントする 2 バックエンドである。

- [ディレクトリーピッカーシーム](../directory-picker/README.md) — 選択子が合成するケイパビリティ契約。
- [ディレクトリーピッカーケイパビリティシーム決定](../../../.agents/notes/archived/architecture/2026-07-28-directory-picker-capability-seam.md) — バックエンドが対話形状で異なる理由。
- [ネイティブバックエンド](../directory-picker-native/README.md) — ローカル操作者向けにマウントされる対話。
- [ブラウズバックエンド](../directory-picker-browse/README.md) — それ以外すべてにマウントされる対話。

-----

<a id="model-experience"></a>
## モデル体験

なし。GUI host のディレクトリー選択選択子はバックエンド行をマウントするだけであり、モデル向けに何も登録しないためである。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組立も送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


起動時サンプルが host を誤判断する場合を定める。これらは現在のパッケージ制約であり、タスク backlog ではない。

- **検出は起動コンテキストから操作者位置を推論するが、起動側信号で証明できるものはない** — SSH 起動から detach した tmux セッションは `SSH_*` 印を失い、Aqua セッション外の Darwin プロセスも表示ありと数え、ワークステーションローカル起動に後から `ssh -L` で到達したものは `127.0.0.1` から到来して `native` に解決され、無人のワークステーション上で選択子を開く。誤った `native` 選択はバックエンド既存の再試行可能失敗ダイアログに劣化し、そのようなデプロイ向けには `-browse` 直接構成が安全な対話を選択する。
- **Linux 選択子プローブは `PATH` のみ読む** — 他の手段で届く zenity/kdialog（シェル別名、非 PATH インストール）は依然として `browse` に解決される。いずれかのバイナリを `PATH` 上にインストールすれば次回起動時に `native` 適格が復活する。
- **起動時のみ** — 1 解決が起動のすべてのクライアントに仕える。接続ごと適応（ローカルブラウザーには native、リモートには browse、同一サーバー）はクライアントごとのケイパビリティとシームが運ばないワイヤ広告を要し、両方に同時に仕えるデプロイを待つ。
- **ループバックに見せかけるプロキシはリモートブラウザーを隠す** — リクエスト `Host` と `Origin` の両方をループバック権威（たとえば `127.0.0.1:3080`）へ書き換えるリバースプロキシは、非ループバック `trustedHosts` エントリなしにブラウザー信頼 fence を通過する。ブラウザーの `/api` POST は `Origin: https://app.example` を運び、プロキシがそのヘッダーも書き換えない限り Origin fence が拒む。その場合にのみリモートブラウザーは依然として `native` に解決され、host 表示上で選択子を開く。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
