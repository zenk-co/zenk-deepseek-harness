---
description: "耐久イメージ添付ケイパビリティ群のパッケージマップ: イメージ添付でできることと、イメージの保存場所。"
kind: "package-group"
---

# attachment/ — 耐久添付ケイパビリティ群

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`attachment/` グループは耐久イメージ添付を提供する。プロンプトやコマンドにイメージを添付すると、ハーネスはそれらをマシンに保存し、会話履歴に再び表示し、後のターンでモデルに送信する。出荷 `dsh` 構成は設定なしでこれを有効化する。ケイパビリティとそのストレージは下記の 2 パッケージに分かれる。保存済みイメージは再起動を超えて残り、自動削除されることはなく、ラスターイメージフォーマットのみ対応する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

この 2 パッケージが耐久イメージ添付を提供する。各 README がその担当でできることを説明する。

| Package | Role | ctx key |
|---|---|---|
| [`attachment/`](attachment/README.md) | 永続化して履歴に戻ってくるプロンプト・コマンド向けのイメージ添付 | `ctx.attachments` |
| [`attachment-local/`](attachment-local/README.md) | 添付イメージを `DSH_HOME` 配下のこのマシンに保存する | `ctx.attachments` に登録 |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

サービス契約はサブシステム参照から始め、次にケイパビリティシーム表とローカルバックエンドの設定面を読むこと。

- [添付サブシステム参照](../../docs/subsystems/attachment.md) — サービス契約、ペイロード型、`ctx.attachments` Cordis 面。
- [ケイパビリティシーム](../../docs/capability-seams.md) — この群が従う Service Definition / Service Provider / Consumer 分割。
- [生成設定カタログ](../../docs/config-catalog.md#deepseek-aidsh-attachment-local) — ローカルバックエンドの受け付け可能な全フィールド。

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
