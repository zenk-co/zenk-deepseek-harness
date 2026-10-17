---
description: "アプリ内ディレクトリ閲覧面:ワークスペースディレクトリフローを満たす Miller カラムのワークスペースディレクトリ選択ダイアログ。Web 選択体験の利用者と保守者向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-directory-picker-browse

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは Web GUI 向けのアプリ内ディレクトリ閲覧面を提供する。ローカルホスト越しにフォルダーを一覧・移動・作成するワークスペースディレクトリ選択ダイアログであり、OS の選択部品は介在しない。`ui-workspace` が宣言する 2 つのディレクトリフロー用スロットを満たし、1 つの cordis.yml 行で閲覧選択操作のクライアント側を合成する。ブラウザーがリモートまたはプロセス内にあり、ローカル OS 選択部品がない場合に選ぶこと。ローカルデプロイでは [`-native`](../ui-directory-picker-native/README.md) 面が好ましい場合がある。

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

`ui-workspace` とホストバックエンド [`dsh-host-directory-picker-browse`](../../host/directory-picker-browse/README.md) と並べてこのプラグインをマウントすると、1 つの cordis.yml 行で閲覧選択操作全体が合成される。ワークスペースフローがディレクトリ要求を開くと、利用者はアプリ内ダイアログを見る。パス表示と編集可能パス域を持つヘッダー、次に行選択までは単一全幅水準、行選択後は水準と子水準に割れる列である。

### 移動と作成

フォルダーを辿るか、パスを直接編集するか、最終ペインを接頭辞で絞る。ホストが隠し指定したエントリーは、フッターの切り替えで表示するまで隠れたままである。**新規フォルダー**は選択フォルダーを対象とする入れ子の作成ダイアログを開き、作成したものを選択する。**開く**は選択フォルダーを採用し、なければ一覧水準にフォールバックする。ディレクトリの確定が選択パスであり、ダイアログの破棄が取り消しである。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

ダイアログは 680×500 の Miller カラムビュー（短い・狭いビューポートでは収める）であり、`ctx.workspaces` 越しのホスト `listDirectory`・`createDirectory` プリミティブで駆動する。両登録は入れ子の `ctx.slots.inject()` 呼び出しで 1 トランザクション効果として設置される。宣言エントリーのいずれも後から有効化・宣言置換がありうるためである。ダイアログのコピーはこのパッケージ独自のロケール名前空間にあり、2 辞書が 1 単位で着地する。閲覧失敗はダイアログ独自の警告面内に留まるため、この占有者は所有者の `onError` 側を駆動しない。ノード側はホスト名簿にプラグインを保つ空 `apply` である。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

選択面だけでは足りないときにこれらのページを読む。ブラウザー側からホストバックエンドとそれが満たすスロットへ進む。

- [dsh-host-directory-picker-browse](../../host/directory-picker-browse/README.md) — この面が駆動するディレクトリ一覧バックエンド。
- [ui-workspace](../ui-workspace/README.md) — ディレクトリフロー用スロットを宣言し、選択会話を所有する。
- [ui-directory-picker-native](../ui-directory-picker-native/README.md) — ローカルデプロイ向けのネイティブ OS 選択肢。
- [Web クライアントアーキテクチャ](../../../docs/subsystems/web-client.md) — ブラウザープラグイン行の読み込みとスロット登録。

-----

<a id="model-experience"></a>
## モデル体験

なし。ディレクトリブラウザーはブラウザー装飾であり、ここの何もモデル要求に届かないため。

#### KV キャッシュ効果

なし。このパッケージはプロバイダー要求を組み立ても送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


現在の閲覧面を定める制限である。汎用ファイルブラウザー比較でもタスクのバックログでもなく、現在のパッケージ制約である。

- **検索・複数選択・名前変更や削除なし** — ダイアログはディレクトリを一覧・作成する。対象には移動・パス編集・最終ペインの接頭辞絞り込みで到達する。
- **隠しエントリーの絞り込みはクライアント側** — ホストは常に隠しエントリーを一覧して印を付けるため、切り替えはダイアログの描画のみを変える。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
