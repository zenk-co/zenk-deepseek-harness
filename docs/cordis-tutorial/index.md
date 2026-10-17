# Cordis チュートリアル

日本語 | [English](index.en.md) | [中文](index.zh.md)

Cordis は DeepSeek Harness の土台にあるプラグインフレームワークである。ツール・LLM アダプター・ファイルアクセス・エージェントループ自体など、すべてのケイパビリティは共有コンテキストにマウントされるプラグインである。このチュートリアルは Cordis を実践で教える。各章はこのリポジトリ内の作業ディレクトリで組み立てる実行可能な例であり、最後は実際のハーネスサービスに配線されたプラグインになる。

読み手はエージェント開発者である。深い TypeScript 経験は不要であり、馴染みのない構文は下記の [TypeScript メモ](#typescript-notes) が説明し、すべての章が正確なコマンドと期待出力を示す。

一巡りではなく凝縮した概念参照が欲しければ [Cordis 入門](../cordis-primer.md) を読むこと。網羅的な API 参照は[サブシステムページ](../subsystems/core.md)上の生成 `cordis-surface` 領域と [Cordis コア API](../cordis-api/context.md) ページにある。

ハーネス自体のプラグイン（`cordis.yml` から読み込まれ、下記のランチャーではなく Web UI から駆動される）を書きたい場合は、[初めてのハーネスプラグイン](../user/develop/basic/index.md)から始めること。

## セットアップ

このリポジトリの複製と依存関係のインストールが必要であり、前提条件は[開発ガイド](../development.md#setup-tutorial)に一覧がある。このチュートリアルに API キーは不要であり、すべての例はキーレスで動作する。

```sh
git clone git@github.com:zenk-co/zenk-deepseek-harness.git
cd deepseek-harness
pnpm install
```

章が作業する作業ディレクトリを作る。`tmp/` は git 無視されるため、そこに書いたものはバージョン管理に触れない:

```sh
mkdir -p tmp/cordis-tutorial
cd tmp/cordis-tutorial
```

すべての章はこのディレクトリから同じコマンドを実行する:

```sh
node --import tsx ../../vendor/cordis/bin.js
```

その 1 ファイルランチャー（[vendor/cordis/bin.js](../../vendor/cordis/bin.js) 参照）はルート `Context` を作り、Loader プラグインをマウントし、現ディレクトリの `./cordis.yml` を読み込むよう指示する。それ以外のすべて（どのプラグインが存在するか、どう設定されるか）はその YAML ファイル由来であり、まもなく書くことになる。`--import tsx` 指定で、設定が指す TypeScript ファイルをビルド手順なしに Node で実行できる。

## 章

1. [初めてのプラグイン](01-first-plugin.md) — プラグインは関数であり、ローダーがそれをマウントする。
2. [ライフサイクルとエフェクト](02-lifecycle-and-effects.md) — Cordis 管理の登録はプラグインのアンロード時に解かれる。
3. [サービス](03-services.md) — `ctx` 上にケイパビリティを公開し、`inject` で依存する。
4. [イベント](04-events.md) — 型付きイベント・放送配送・ウォーターフォール短絡。
5. [設定](05-config.md) — `cordis.yml` からの検証済み設定。不正入力には大声で失敗する。
6. [コンポジションと HMR](06-composition-and-hmr.md) — プラグインツリーとしての設定ファイル・ホットリロード・読み込まれないプラグインの診断。
7. [ハーネスの世界へ](07-into-the-harness.md) — 実際のハーネスサービスに対するモデル呼び出し可能なツールの登録。

<a id="typescript-notes"></a>

## TypeScript メモ

サンプルは通常の現代 JavaScript を超える 3 つの TypeScript 機能を使う:

- **型注釈**は値を記述するだけで実行時動作を変えない。`ctx: Context` は `ctx` が Cordis コンテキスト API を持つことを言い、`who: string` はテキストを受け付け、`string[]` は文字列の配列を意味する。
- **`import type { Context } from '@deepseek-ai/cordis'`** は型情報のみをインポートする。実行時には消えるため、注釈用にのみ `Context` が要るプラグインファイルは実行時依存を増やさない。
- **宣言統合**（`declare module '@deepseek-ai/cordis' { ... }`）は Cordis が既に宣言するインターフェースにあなたのエントリーを追加する。例えば新しい `ctx.greeter` 属性やイベント名の型である。実行時配線を生成せず、プラグインはサービス提供やイベント送出を別に行う。第 3 章がパターンの全体を示す。

第 5 章は設定オブジェクトの欄を記述する `interface` と、スキーマがどのオブジェクト欄を検証するかを言う `Schema<Config>` のような総称型も使う。それらの宣言は示されるとおり複写できる。各々が何を結ぶかは周囲の本文が説明する。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
