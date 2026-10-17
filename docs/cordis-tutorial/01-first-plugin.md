# 1. はじめてのプラグイン

日本語 | [English](01-first-plugin.en.md) | [中文](01-first-plugin.zh.md)

ここで使用するローダー構成では、Cordis プラグインモジュールは `apply` 関数を名前付きエクスポートする。Cordis が読み込む際、プラグインが提供するものをすべて登録するための **コンテキスト** である `ctx` オブジェクトを渡して `apply` を呼び出す。

## プラグインを書く

`tmp/cordis-tutorial` ディレクトリ内（[セットアップ](index.md#setup)を参照）に `hello.ts` を作成する:

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'hello'

export function apply(ctx: Context) {
  console.log('hello from my first plugin')
}
```

`name` エクスポートは任意の表示用メタデータであり、診断出力でプラグインにラベルを付ける。

## アプリケーションを組み立てる

このチュートリアルのランチャーは設定からアプリケーションを組み立てる。`cordis.yml` を作成する:

```yaml
- name: './hello.ts'
```

このファイルはプラグインエントリのリストである。`name` はモジュール指定子（相対パスまたは npm パッケージ名）であり、ローダーはすべてのエントリをマウントする。エントリは並行に開始するため、リスト内の位置によってどのプラグインが先に読み込まれるかは決まらない。順序はファイル内の位置ではなくサービス依存関係（`inject`、[第 3 章](03-services.md)）によって決まる。

## 実行する

```sh
node --import tsx ../../vendor/cordis/bin.js
```

期待される出力:

```
hello from my first plugin
```

実行中のものがなくなるとプロセスは自動的に終了する。起こったことは次のとおり:

1. ランチャーがルート `Context` を作成し、**Loader** プラグインをマウントした。
2. Loader が `cordis.yml` を読み込み、`./hello.ts` を解決して子プラグインとしてマウントした。
3. Cordis があなたの `apply(ctx)` を呼び出した。

あなたのファイルにフレームワークのブートストラップコードはない。プラグインは提供するものを記述し、`cordis.yml` がアプリケーションを組み立てる。たとえば [`dsh` ベース](../../packages/bundle/base/cordis.patch.yml)は、デプロイオーバーレイがパッチする長いプラグイン構成である。

## 他の 2 つのプラグイン形式

関数が最も一般的な形式だが、Cordis は 3 つを受け付ける:

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

// 1. Function plugin (what you just wrote).
export function apply(ctx: Context) {}

// 2. Object plugin: an object with an `apply` method.
export const objectPlugin = {
  name: 'object-plugin',
  apply(ctx: Context) {},
}

// 3. Class plugin: a Service subclass (covered in chapter 3).
export class MyService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'myTutorialService')
  }
}
```

サービスを公開する必要が生じるまでは関数形式を使う。[第 3 章](03-services.md)ではクラス形式がふさわしい場合を説明する。

## 壊してみる

`apply` が例外を投げるようにする:

```ts ignore-check
export function apply(ctx: Context) {
  throw new Error('apply exploded')
}
```

もう一度実行すると、プロセスはあなたのエラーで終了する。読み込みに失敗したプラグインはスキップされるのではなく、大きな失敗として扱われる。

早めに知っておくべき注意点が 1 つある。モジュールを **解決** できない設定エントリ（パスやパッケージ名のタイプミス）はプロセスをクラッシュさせる代わりに Cordis ロガーサービス経由で報告され、起動時にはコンソールエクスポーターが監視を始める前にその報告が失われることがある。追加したばかりのエントリが何もしないように見える場合は、まず綴りを確認すること。

次へ: [ライフサイクルとエフェクト](02-lifecycle-and-effects.md) — プラグインのアンロード時に起こること。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
