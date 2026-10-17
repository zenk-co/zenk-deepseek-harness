---
description: "相対経路の結合、POSIX ホームの省略、表示題の導出を行うブラウザー安全な Workspace 経路補助。"
kind: "package-library"
---

# dsh-util-workspace-path

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Workspace 対面のクライアントと制御器パッケージが共有するブラウザー安全な経路補助。このパッケージは Workspace 相対経路を結合し、表示用に POSIX ホーム directory を省略し、POSIX または Windows 経路から Workspace 題を導き、表示用に経路を directory 群と末尾断片に分け、サイドバーと資源模型にまたがり作業域ファイルを名指す `dsh-resource://file/…` 住所文法を所有する。`relativizeToCwd` はその directory 外の経路を保ちつつ、表示用に作業域接頭辞を取り除く。Cordis サービスもランタイム状態も持たない。

## 目次

- [ファイル住所](#file-addresses)
- [既知の制限と後回しの作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="file-addresses"></a>
## ファイル住所

資源住所は `dsh-resource://<type>/…` であり、種別 — URI ホスト — は資源規約鍵 (`file`、またはプラグインが `ResourceProtocolMap` で宣言するもの) である。それ以外の scheme は他所で定義される誘導規約である。`dsh-resource://file/session/<sessionId>/<path>` は Host 読み取りを認可するセッションと作業域相対または絶対の経路を名指す。先頭斜線は経路の一部として残る。`/etc/hosts` は `dsh-resource://file/session/s//etc/hosts` であり、Windows 駆動は `dsh-resource://file/session/s/C:/x/y.txt`、UNC は `dsh-resource://file/session/s///server/share/y.txt` である。Host は経路を解決して到達を強制する。`absolute/<path>` 形式は構文解析可能なまま認可セッションを持たないため、ファイル提供子はそれを読めず Preview も主張しない。現在も Tab セッションも借りない。文法は [`src/file-address.ts`](src/file-address.ts) にあり、経路補助はそれを再表出する [`src/index.ts`](src/index.ts) にある。

`sessionFileAddress(sessionId, path)` は `\` を `/` に正規化し先頭 `./` を落とすが、先頭 `/` 文字は保つ。各 id と経路段片は `:` を文字通りに保って要素符号化される。`fileAddressFor(sessionId, cwd, path)` は常にセッション住所を組み立てる。`cwd` 内の経路は相対になり、`cwd` 不明時を含むその他の絶対経路はそのセッション住所内で絶対のままである。`absoluteFileAddress(absolutePath)` はセッションなし形式のみを組み立てる。`parseFileAddress(address)` は厳密なファイル住所接頭辞を検査し、照会と断片接尾辞を無視し、各断片を復号して、セッション住所には `{ scope, sessionId, path }` を、セッションなし形式には `{ scope, path }` を返す。他種別や scheme、未知適用範囲、欠落 id や経路、不正 escape は `undefined` を返す。

`fileMediaUrl(base, path)` は復号済み絶対経路から認証付きファイル経路 URL を組み立てる。HTTP(S) 応用基盤と Desktop `dsh-app://app/` 起点を許し、文字通りの百分率記号と配備接頭辞を保ち、その他の応用基盤、相対経路、網経路接頭辞、制御文字を拒む。Markdown 所有者は呼び出し前に著述 URL を復号し、生ファイル札経路は変えずに渡す。

-----

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>

- **解決は語彙的** — POSIX 絶対経路、Windows 駆動経路、UNC 経路を認識し、相対経路結合時に Workspace 経路の区切りを保ち、ファイル系に触れず `.` や `..` 断片を正準化しない。
- **ホーム省略は POSIX のみ** — 移植可能なブラウザーは Windows ホーム経路等価を安全に推測できないため、Windows 経路は変わらない。


<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
