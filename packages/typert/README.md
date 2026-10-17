---
description: "Typert グループマップ: 型付き Host から Client への呼び出しを可能にするビルド時型グラフ生成器、ランタイムレジストリー、Loader 統合、共有 Remote プロトコル。"
kind: "package-group"
---

# packages/typert

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Typert グループにより、Client 環境は手書きのワイヤーコードなしに Host ケイパビリティを型付きメソッドとして呼び出し、生成済みスキーマとリフレクションを共有できる。ビルド時生成器はソースの型宣言からコンパイラー非依存のモデルとランタイム成果物を生成し、ランタイムレジストリーはそれらの成果物を格納し、Loader 統合は Loader 構成内でそれらを自動登録する。共有プロトコルパッケージは Remote 呼び出し宣言（デコレーター、ワイヤー記述子、コーデック、プロバイダー契約）を供給し、ビジネスパッケージ、生成成果物、Host Gateway、Client API がすべて消費する。このページは4つのパッケージを対応付ける。各パッケージの設定、使い方、制限は各パッケージ README が所有する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`generator/`](generator/README.md) | ソースの型をビルド時に解析し、ランタイムが読み込むリフレクション、スキーマ、Remote 記述子を生成する | — |
| [`loader/`](loader/README.md) | Loader 構成から生成済み Typert 成果物をランタイムレジストリーに自動登録する | `ctx.loader` と `ctx.typert` を消費する |
| [`protocol/`](protocol/README.md) | Host と Client が共有する Remote デコレーター、ワイヤー記述子、コーデック、プロバイダー契約を宣言する | — |
| [`registry/`](registry/README.md) | 生成済みパッケージリフレクションとライブ Zod スキーマをランタイムに格納し、lookup と Context プロバイダーレジストリーを提供する | `ctx.typert` |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [Typert サブシステムリファレンス](../../docs/subsystems/typert.md) — protocol と registry の型から記録された文字通りの公開契約。
- [API Gateway リファレンス](../../docs/api-gateway.md) — 生成済み Remote 記述子が動作中の Host から Client への呼び出しになる仕組み。
- [Remote 呼び出し Agent Note](../../.agents/notes/implemented/architecture/2026-08-02-typert-remote-method-calls.md) — Remote 呼び出しの背後にあるアーキテクチャとトランスポートの決定。
- [パッケージワークスペースマップ](../README.md) — ワークスペース内のすべてのグループとそれぞれの所有範囲。

-----

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
