---
description: "ライブプラグイン設定のためのスキーマ由来フォーム。"
kind: "package-group"
---

# settings/ — plugin configuration forms

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

各プラグインの Config スキーマから導出されたフォームを通じてライブプラグイン設定を編集する。アクティブなプロファイルパッチが編集を保存し、Loader が適用する。プラグインは自身の volatile 参照を読む。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

<a id="packages"></a>
## パッケージ

フォーム動作はパッケージ README が所有し、型は settings リファレンスが文書化する。

| Package | Purpose | ctx key |
|---|---|---|
| [`settings`](settings/README.md) | Config projection and revisioned form edits | `settings` |

<a id="related-documentation"></a>
## 関連ドキュメント

- [設定リファレンス](../../docs/subsystems/settings.md) — descriptors and edits.
- [設定エディター](../boot/config-editor/README.md) — profile persistence.
- [Volatile 設定](../../vendor/loader/README.md) — updates without remounting.

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

None.

</details>
