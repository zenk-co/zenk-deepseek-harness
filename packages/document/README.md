---
description: "Package map for Host Office conversion and reusable PDF results."
kind: "package-group"
---

# document/ — Office 変換

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Host で承認済み Office ファイルを再利用可能な PDF に変換する。共有サービスは LibreOffice kit 経由で変換する。宣言済みネイティブエンジンを持つ対象はそれを使い、他の対象は Node WASM を使う。

## 目次

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## パッケージ

各パッケージは独自の設定とライフタイム規則を所有する。共有変換操作はサブシステムリファレンスが表す。

| Package | Role | ctx key |
|---|---|---|
| [office-to-pdf](office-to-pdf/README.md) | 承認済み Office バイトから有界キューとキャッシュで完全な PDF を作る | `ctx.officeToPdf` |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

コンシューマーはソース承認と表示を所有する。

- [ドキュメント変換](../../docs/subsystems/office-to-pdf.md) — 共有操作と生成サービスリファレンス。
- [独立した kit 所有](../../.agents/notes/implemented/architecture/2026-09-14-independent-libreoffice-kit.md) — エンジン配布とアプリケーション統合。
- [Workspace Files](../api/workspace-files/README.md) — 承認され有界なソース読み取り。

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
