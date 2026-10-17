---
description: "セキュアコンテキスト専用の crypto.randomUUID 呼び出しを置き換えるメンテナー向けクロスランタイム UUID 生成。"
kind: "package-library"
---

# dsh-util-crypto

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

依存のないブラウザー安全な UUID およびバイト列エンコードヘルパー。UUID 生成は `crypto.getRandomValues` を使う。これは出荷されるすべてのコンテキストが提供する唯一の乱数プリミティブである。`crypto.randomUUID` はセキュアコンテキストの Web API であり、LAN アドレス上の素の HTTP で提供されるページやワーカー（ブラウザープレビューデプロイ）にはそのようなメソッドがないため、そこで動作しなければならないコードはそれを呼び出せない。リポジトリー全体の `no-restricted-properties` lint 規則は `crypto.randomUUID` の呼び出し元をここに誘導する。`node:crypto` から `randomUUID` をインポートする Node 専用コードはそのままにする。

## 目次

- [このパッケージの使い方](#use-this-package)
- [API](#api)
- [モデル体験](#model-experience)
- [既知の制限と将来の課題](#known-limitations-and-deferred-work)
- [開発ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの使い方

これは**ライブラリーであり、サービスやプラグインではない**。`ctx` なし、登録なし、状態保持なし。

-----

<a id="api"></a>
## API

```ts
import { bytesToBase64, randomUUID, type Uuid } from '@deepseek-ai/dsh-util-crypto'
```

| エクスポート | 役割 |
|---|---|
| `bytesToBase64(data)` | バイト配列向け正規 base64。有界チャンクでエンコードされる。 |
| `randomUUID()` | ランダムな RFC 9562 v4 UUID 文字列。`crypto.getRandomValues` から生成される。`crypto.randomUUID()` のドロップイン代替。 |
| `Uuid` | 5グループ UUID 文字列型。`crypto.randomUUID` の宣言済み返却形状に一致する。 |

<a id="model-experience"></a>
## モデル体験

リクエスト、セッション、添付ファイルの識別子を生成する消費者経由で間接的に関わる。それらはいずれもプロンプトの意味内容に入らない。

#### KV キャッシュへの影響

直接の無効化なし。識別子生成を行う消費者がリクエスト変更を所有する。

## 既知の制限と将来の課題

<a id="known-limitations-and-deferred-work"></a>

- **v4 のみ** — 他の UUID バージョン、名前空間、パースはなし。さらに必要なら正式な UUID 依存を使うこと。
- **一意性は確率的** — 122 ビットの乱数であり、`crypto.randomUUID` と同じ保証である。衝突検出は行わない。


<a id="dev-note"></a>
### 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
