---
description: "資格情報ケイパビリティファミリーのパッケージマップ: 資格情報参照シーム、環境とファイルのプロバイダー、認可フローレジストリ、および参照がどのように秘密値を構成から締め出すか。"
kind: "package-group"
---

# credentials/ — 資格情報と認可

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`credentials/` グループは、構成が秘密の値を埋め込む代わりに名前を指定できるようにする。資格情報の保存、検索、削除には `credentials/`、環境フォールバック付きのマシン上のプライベートストレージには `credentials-local/`、資格情報の取得に人間への問い合わせが必要な場合は `authorization/` を使う。ローテートされた保存値は次のモデルリクエストに適用され、保存値は `DEEPSEEK_API_KEY=… dsh` より優先される。構成ファイルには資格情報の名前のみが含まれ、ローカルの秘密値は同じ OS ユーザーのみが読める状態を保つ。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ

3 つのパッケージが資格情報機能を提供する: 1 つは実行時に秘密を保存、検索、削除し、構成はそれらを名指しするだけである。2 つ目はデフォルトのマシン上ストアである。3 つ目は、問い合わせる必要がある資格情報をプラグインが取得できるようにする。それぞれの README が日常的な使用を扱い、サブシステムリファレンスが網羅的な契約を所有する。

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`credentials/`](credentials/README.md) | 構成は名前を指定するだけにしつつ、実行時に秘密を保存、検索、削除する | `ctx.credentials` |
| [`credentials-local/`](credentials-local/README.md) | デフォルトのマシン上ストア: 環境フォールバックより優先されるプライベート YAML ファイル | `ctx.credentials` を登録する |
| [`authorization/`](authorization/README.md) | 人間に尋ねることで資格情報を取得する、プラグイン所有のフロー | `ctx.authorization` |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

共有語彙にはサブシステムリファレンスから始め、次にケイパビリティシームの表とローカルストアの構成サーフェスへ進む。

- [資格情報サブシステムリファレンス](../../docs/subsystems/credentials.md) — `CredentialRef` と `CredentialKey`、操作ごとの解決、UI 安全な `CredentialInfo`、認可フロー、および生成された Cordis サーフェス。
- [ケイパビリティシーム](../../docs/capability-seams.md) — このファミリーが従う Service Definition / Service Provider / Consumer の分割。
- [生成された構成カタログ](../../docs/config-catalog.md#deepseek-aidsh-credentials-local) — ローカルストアが受け付けるすべてのフィールド。

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
