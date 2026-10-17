---
description: "Caller-relative lazy loading for CommonJS-compatible Host dependencies whose initialization is not needed during application startup."
kind: "package-library"
---

# @deepseek-ai/dsh-lazy-require

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-lazy-require` は、アプリケーション起動時に初期化が不要な CommonJS 互換 Host 依存を、最初の実際の操作まで未読み込みに保つ。解決は利用パッケージ相対のままであり、1 回成功したモジュール値はプロセスレルムの残りで再利用される。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と後回しにした作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

依存のリテラル指定子と呼び出し元の `import.meta.url` を渡す:

```ts
import { createLazyRequire } from '@deepseek-ai/dsh-lazy-require'

interface NativeModule { open(): void }
const requireNative = createLazyRequire<NativeModule>('native-package', import.meta.url)
```

`requireNative()` の呼び出しで依存を 1 回読み込む。失敗した読み込みはキャッシュされない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

このユーティリティは提供された呼び出し元 URL から Node の `require` を作成し、成功した戻り値のみをキャッシュする。明示的な呼び出し元 URL により、公開後もパッケージローカルな依存解決が保持される。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | 呼び出し元相対ローダーと成功結果キャッシュ |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [ユーティリティパッケージマップ](../README.md) — 隣接する共有プリミティブ。
- [NPM リリース手順](../../../.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md) — 公開依存分類と初回使用時読み込みポリシー。

-----

<a id="model-experience"></a>
## モデル体験

なし。この Host ユーティリティはモデル向け動作を登録しない。

#### KV キャッシュへの影響

なし。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

- **CommonJS 互換依存のみ** — ESM 専用パッケージは呼び出し元所有の非同期ファクトリーを必要とする。
- **WebWorker パッケージ化には明示的リクエストが必要** — 静的パッカーは `createLazyRequire()` 呼び出し内でのみ命名された依存を検出しない。Preview イメージで使用されるパッケージは、パッカーがこのヘルパーを認識するまで、対応するリテラルリクエスト経由で依存に到達可能に保たなければならない。

<a id="dev-note"></a>
### 開発メモ

なし。
