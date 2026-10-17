# クックブック: ベンダーパッケージを追加する

日本語 | [English](adding-a-vendored-package.en.md) | [中文](adding-a-vendored-package.zh.md)

ハーネスが別の上流 Cordis パッケージ（例 `@cordisjs/plugin-http`）を必要とするときは、npm 依存として追加せず、ピン留めソースとして `vendor/` 配下に**ベンダー化**する。[vendor/README.md](../../vendor/README.md) が理由を述べ、ベンダー化済みパッケージの更新手順を扱う。このガイドは**新規**追加のファイルごとの検査表である。（既存ベンダー化集合との照合済み。ずれがあればここで直す。）

## 1. ソースを複写する

```
vendor/<dir>/
  package.json     # from upstream; rescope the name, keep exports/type (publishable release member, no private flag)
  tsconfig.json    # extends ../../tsconfig.base.json (see configuration below)
  src/             # the upstream src/ verbatim
  README.md LICENSE # if upstream ships them
```

`tsconfig.json` は他のベンダー化パッケージを映す。`rootDir: src`・`outDir: lib/types`・上流コードに要る厳格さ緩和・インポートする他のベンダー化パッケージごとの `references` エントリーである:

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src", "outDir": "lib/types",
    "noUncheckedIndexedAccess": false, "exactOptionalPropertyTypes": false,
    "noImplicitOverride": false, "noUnusedLocals": false, "noUnusedParameters": false
  },
  "include": ["src"],
  "references": [{ "path": "../cordis" }, { "path": "../cosmokit" }]
}
```

`package.json` 不変条件: 名前のリスコープ（[対応表](../rescope.md)）を行い、上流の `exports`/`type` を保つ。宣言メタデータは `lib/types` を指し、公開 `.d.ts` と `.d.ts.map` 宣言出力を公開し、その cordis 依存を `peerDependencies` に列挙する（上流マニフェストに合わせる）。ベンダー化パッケージは公開可能なリリース構成員であるため、`private: true` を設定してはならず、`publishConfig.access: public` を設定しなければならない。`version` 欄はハーネスリリース順に従う（[vendor/README.md](../../vendor/README.md) 参照）。推移的上流依存は自前でベンダー化されるか既存でなければならない。1 パッケージのベンダー化はしばしばその依存木のベンダー化を意味する（例 `@cordisjs/plugin-http` は `@cordisjs/fetch-file` を引く）。

ベンダー化 TypeScript ソース内のローカル相対インポート・出力は複写後に明示的 `.ts` 指定子を使う。これは上流とのリポジトリ内ビルド差異である。`rewriteRelativeImportExtensions` は `.js` 実行時インポートを出し、宣言は NodeNext/Node16 TypeScript 利用者が解決できる明示的 `.ts` 指定子を保つ。

## 2. ルート設定に登録する

| ファイル | 変更 |
|---|---|
| `tsconfig.base.json` | `paths` に `"<npm-name>": ["./vendor/<dir>/src"]` を加える |
| `tsconfig.host.json` | `references` に `{ "path": "./vendor/<dir>" }` を加える（`packages/*` エントリーより前。ベンダー化コードはホスト集約経由でのみグラフに入る） |
| `vendor/README.md` | マニフェスト表の行（dir・npm 名・バージョン・上流リポジトリ・コミット SHA）を加え、ローカル変更を記録する |
| `scripts/publint-all.ts` | ベンダー化パッケージ自体をここから公開する場合のみ（ベンダー化依存は通常公開しない。跳ばす） |

グロブで自動的に対象となるため編集不要: ルート `package.json` ワークスペース（`vendor/*`）・`tsdown.config.ts`・`vitest.config.ts`・`.oxlintrc.json`。パッケージごとの `vendor/<dir>/tsdown.config.ts` はビルド設定がルート既定と異なる場合にのみ要る（双 ESM/CJS または複数エントリー。`vendor/schemastery` と `vendor/logger-console` 参照）。そのエントリーは `lib/types` 配下に出た JS を読むべきである。

## 3. マニフェスト番に注意する

`scripts/check-vendor-manifest.sh`（pre-commit フック）は `vendor/*/src` 配下の何かが `vendor/README.md` もなしに stage されると失敗する。マニフェスト更新をソースと並べて stage し、コミットを通すこと。

## 4. 検証する

```sh
pnpm install        # registers the workspace
pnpm run typecheck
pnpm run build && pnpm run constraints
```

[テスト方針](../testing.md)が選ぶ動作検査を実行する。ソース `paths` 対応表は `tsconfig.base.json` に一度だけあり、すべてのグラフに仕える。重要な分離境界はプロジェクト参照グラフである。ベンダー化ソースは集約の厳格プログラムに引き込まず、独自 `vendor/<dir>/tsconfig.json` 経由で参照しなければならない（[配置](../development.md#typescript-project-layout)）。
