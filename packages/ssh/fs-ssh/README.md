---
description: "SSH 子過程と文件を共有する利用者向け遠隔文件系意味論。"
kind: "package-reference"
---

# @deepseek-ai/dsh-fs-ssh

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-fs-ssh` は SSH 補助者の文件系に `ctx.fs` を提供する。文件道具は遠隔 Bash、端末、言語服務器、Node 計画が見るのと同じ文件を読み変異させる。遠隔正準化、版防護、不可分変異は補助者脇に導入された地域文件系実装を使う。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに探る](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と後回しの作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

この提供子を [`dsh-ssh`](../ssh/README.md) と `sandboxPolicy` で載せ、実行には対の SSH 子過程と砂箱提供子を使う。この提供子に設定項目はない。接続同一性と既定作業域は `dsh-ssh` に属し、文件効果様式は `sandboxPolicy` に属する。

`resolve()` は遠隔 host 上で経路を正準化する。`processPath()` と `fileUrl()` は同遠隔名空間の文件を名指し、host 側到達を与えない。文件 URL は文字通りの百分率記号、逆斜線、改行を文件名を変えずに符号化する。`processPathFromHostPath()` は `undefined` を返すため、導入済み実行物や起動素を要する利用者は遠隔成果物を明示に供給しなければならない。

読み取りは共有文件系誤り符号を保つ。書込と編集は解決済み呼毎方針を補助者に送り、補助者は作業域を正準化して不可分変異の脇でそれを強制する。輸送喪失は入出力失敗を報告し、変異は既に確定して自動再試行されないことがある。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

補助者は [`fs-local`](../../fs/fs-local/README.md) と [`fs-sandbox`](../../fs/fs-sandbox/README.md) を再利用し、 symlink 同一性、古版拒否、差分基盤、公表意味論を保つ。UTF-8 流送は有界引張要求を使い、利用者が早く止めれば遠隔反復子を閉じる。

</details>

-----

<a id="further-exploration"></a>
## さらに探る

- [文件系 subsystem](../../../docs/subsystems/filesystem.md) — 共有操作と誤り意味。
- [SSH 接続](../ssh/README.md) — 配備と切断動作。

-----

<a id="model-experience"></a>
## モデル体験

既存文件系利用者を通じて間接的に関わり、遠隔経路と文件内容を示しつつ道具と prompt はすべて所有する。

#### KV キャッシュへの影響

この提供子は要求接頭辞内容を提供しない。その利用者が模型可視な道具と結果を所有する。

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>

- 全文読みと個別字窓は補助者により 8 MiB までである。大読みには文流送または複数字窓を使うこと。他の JSON 転送も接続の枠上限に従う。
- 文件系監視は未対応である。提供子は `watch()` 上書きを保たないため、基底 `FS_IO_ERROR` 拒否が投票や遠隔経路用地域監視を開かずに当たる。通常読みと利用者所有の手動更新は利用可能なままである。
- 遠隔文件 URL は実行座標であり、host 文件系把手でも Web 下載連鎖でもない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
