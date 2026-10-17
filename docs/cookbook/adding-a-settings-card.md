# クックブック: ライブ設定フォーム

日本語 | [English](adding-a-settings-card.en.md) | [中文](adding-a-settings-card.zh.md)

プラグイン設定スキーマにライブ欄を宣言し、製品所有の設定カード越しに公開する。出力される `Config` インターフェースはプラグインが受け取る値を記述し、各 `Volatile<T>` 参照を含む。

## 1. ライブ欄を宣言する

```ts
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

export interface Config {
  endpoint: Volatile<string | undefined>
  retries: Volatile<number>
}

export const Config = z.object({
  endpoint: z.string().volatile(),
  retries: z.number().step(1).min(0).default(3).volatile(),
})

export function apply(ctx: Context, config: Config): void {
  ctx.on('loader/volatile-update', () => {
    ctx.logger.info('Retry limit: %d', config.retries.get())
  })
}
```

操作開始時に `.get()` を読む。一貫したスナップショットが必要な要求は値を一度取得する。欄間の設定検証には `.check()` を使う。これらの検査は永続化前にホストで実行され、直列化フォームスキーマからは省かれる。

## 2. プラグインを組み立てる

各インスタンスに一意のプロファイルエントリー id を与える。ベースバンドルは設定と設定エディターをマウントする。独自プロファイルでは、同じサービスをマウントする前にそのパッケージ README を読むこと。

`role('secret')` は値をフォーム応答から外す。資格情報ドメインが管理する値には資格情報参照を使う。通常欄は設定スキーマから外しておく。

## 3. 編集を検証する

プラグインで欄を変えて保存する。プロファイルパッチ・次の利用者操作・不変のプラグインインスタンス識別子・再起動後の復元を検証する。不正値を拒否し、ファイルもライブ値も変わっていないことを検証する。

独自プラグインページはプラグインページ所有者から `form.state` と `form.mutate(operations, expectedRevision)` を受け取る。ホストは完全な設定を検証し、設定エディターと揮発性 HMR 経由で編集を適用する。[プラグイン設定パッケージ](../../packages/client/ui-settings-plugins/README.md)が既存カード例を所有する。

## 4. 別プラグインのページに寄与する

所有しないバンドル・行・Official プラグインについて述べたいプラグインは、`plugins.detail.actions`（ページ先頭の操作部品）・`plugins.detail.badge`（題名横の札）・`plugins.detail.section`（ページ独自内容の下の節）に登録する。すべてのエントリーはページの `subject`（`{ kind: 'bundle', pkg }`・`{ kind: 'row', pkg, row }`・`{ kind: 'item', id }`）と共に描画され、関係ない subject には null を返す:

```tsx ignore-check
ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register({
  name: 'plugins.detail.badge',
  id: 'acme-update',
  locale: 'acmeUpdate',
}, ({ t, subject }) => subject.kind === 'bundle' && hasUpdate(subject.pkg) ? <Tag tone="info">{t('update')}</Tag> : null))
```

## 5. ブラウザー側が乗る場所

ブラウザー側は[クライアントモジュールシステム](../../packages/client/modules)によりページへ提供され、`dsh.client` を宣言するパッケージを求めて有効 Loader エントリーを走査し、各パッケージのビルド済み `./client` 出力を提供する。ただしパッケージ側は Loader 行の指定子が素パッケージ名のものに結び付く。サブパス出力からマウントされた行は側を持たないため、1 パッケージを複数行に分けるバンドルは側をルート行に保持し、その行を切ると登録したすべてのページが消える。他行より長生きしなければならないページを持つサブプラグインは独自パッケージとして出荷する。

ビルド済み `./client` ファイルはクライアントモジュールシステムの遅延 CJS ファクトリー形式でなければならない。ページのモジュールローダーにパッケージ名と `factory(require)` を登録する 1 スクリプトであり、[クライアントモジュールシステムの README](../../packages/client/modules/README.md)で説明される。それを出す `clientBundle` tsdown プリセットは公開パッケージではなく `packages/client/tsdown.client.ts` にあるため、このリポジトリ外のパッケージはそのビルドを自前で再現する。

```jsonc
{
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" }
  },
  "dsh": { "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-ui-settings"] } }
}
```

組み込み名前空間の伴走パッケージは、空のホスト `apply` を持つクライアント専用パッケージ内の同じブラウザー側であり、Web コンポジションのプラグイン名簿（[`packages/bundle/web-app/cordis.patch.yml`](../../packages/bundle/web-app/cordis.patch.yml)）に列挙され、`ctx.configForms.whileServed` 経由で `plugins.item` に登録するため、ホストが名前空間を提供するちょうどその間ページが存在する。
