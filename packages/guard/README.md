---
description: "ループ衛生ガードファミリーのパッケージマップ: 助言的な繰り返しツールリマインダーとツール呼び出しごとのタイムアウトポリシー。ガードの選択や構成を行うユーザー向け。"
kind: "package-group"
---

# guard/ — ループ衛生ガードファミリー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`guard/` グループは2つの代表的な失敗パターンを監視してエージェントループの健全性を保つ。`repeat-tool-reminder` はモデルがまったく同じツール呼び出しを繰り返したことに気づいて手法変更や終了を促すため、行き詰まったループが時間とトークンを浪費しなくなる。`timeout-policy` は制限を宣言したツール呼び出しに時間制限を付け、ハングした呼び出しがセッションを停滞させず明確なタイムアウトエラーをモデルに返す。どちらも `dsh` ベースバンドルで有効なまま出荷され、構成は調整や削除ができる。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

2つの小さなプラグインが2つのパターンを受け持つ。保持、調整、削除の判断は各 README が記述する。

| パッケージ | 提供内容 |
|---|---|
| [`repeat-tool-reminder/`](repeat-tool-reminder/README.md) | モデルが同じツール呼び出しを繰り返したら注意し、手法変更や終了を促す |
| [`timeout-policy/`](timeout-policy/README.md) | 制限を宣言したツール呼び出しをタイムアウトさせ、無限待機の代わりに明確なエラーをモデルに返す |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

ツール呼び出しパイプラインはツールサブシステムリファレンスから、リマインダー設定とポリシーの背後にあるタイムアウトライブラリー決定はその次に読み進めること。

- [Tools サブシステムリファレンス](../../docs/subsystems/tools.md) — 両ガードが構築するツール呼び出しパイプラインと決定。
- [生成設定カタログ](../../docs/config-catalog.md#deepseek-aidsh-repeat-tool-reminder) — 繰り返し呼び出し注意の受け入れフィールドのすべて。
- [タイムアウト期限ライブラリー Agent Note](../../.agents/notes/implemented/architecture/2026-07-06-timeout-deadline-library.md) — `timeout-policy` が強制するタイミング/終了分離。

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
