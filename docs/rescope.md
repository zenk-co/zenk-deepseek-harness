# ベンダーパッケージのリススコープ

日本語 | [English](rescope.en.md) | [中文](rescope.zh.md)

Cordis フレームワークとその基盤ライブラリは [`vendor/`](../vendor/README.md) 配下にベンダー化され、`@deepseek-ai` スコープで公開される。すべてのハーネスパッケージがフレームワークをピア依存として宣言するためである。この層と共にハーネスを公開することになり、上流名のままではレジストリ上でその名前を奪うことになる。このページは名前対応表であり、決定とその帰結は[リスコープ Agent Note](../.agents/notes/archived/process/2026-08-10-vendor-package-rescope.md)に、上流コミットは [`vendor/README.md`](../vendor/README.md) にある。

## 名前対応表

| ディレクトリ | 上流名 | 公開名 | 上流バージョン | 役割 |
|---|---|---|---|---|
| `vendor/cordis/` | `cordis` | `@deepseek-ai/cordis` | 4.0.0-rc.7 | フレームワーク中核: `Context`・`Service`・`Fiber`・イベント |
| `vendor/cosmokit/` | `cosmokit` | `@deepseek-ai/cosmokit` | 1.8.1 | フレームワークと Schemastery が土台にする共有ユーティリティ |
| `vendor/schemastery/` | `schemastery` | `@deepseek-ai/schemastery` | 3.18.0 | すべてのプラグインの `Config` 背後の設定スキーマ（`Schema`） |
| `vendor/loader/` | `@cordisjs/plugin-loader` | `@deepseek-ai/cordis-plugin-loader` | 1.0.0-rc.5 | `cordis.yml` 読み込み・プラグイン解決・リポジトリキャッシュ |
| `vendor/include/` | `@cordisjs/plugin-include` | `@deepseek-ai/cordis-plugin-include` | 1.0.4 | 設定インクルードとパッチオーバーレイ |
| `vendor/group/` | `@cordisjs/plugin-group` | `@deepseek-ai/cordis-plugin-group` | 1.0.0 | 入れ子のプラグイングループ |
| `vendor/timer/` | `@cordisjs/plugin-timer` | `@deepseek-ai/cordis-plugin-timer` | 1.1.2 | `ctx` 上の破棄対応タイマー |
| `vendor/hmr/` | `@cordisjs/plugin-hmr` | `@deepseek-ai/cordis-plugin-hmr` | 1.0.15 | プラグインと設定のホットモジュールリプレースメント |
| `vendor/logger-console/` | `@cordisjs/plugin-logger-console` | `@deepseek-ai/cordis-plugin-logger-console` | 1.0.0 | コンソールロガー出力先 |

サブパス出力はパスを保つ。`@cordisjs/plugin-loader/repository` は `@deepseek-ai/cordis-plugin-loader/repository` になる。

## 名前変更が触らないもの

- **ディレクトリ名と上流ソースバージョン。**`vendor/hmr/` は `vendor/hmr/` のままであり、表はピン留めソーススナップショットの上流バージョンを記録するため、マニフェストは上流スナップショットとして読める。ベンダー化 `package.json` 自身の `version` フィールドはハーネスのリリースマニフェストバージョンであり、`pnpm run release:vendor` が上げ、再同期が上流バージョンに戻す。
- **依存範囲。**名前変更は依存キーを変えるだけで範囲は変えない。ワークスペースマニフェストは `workspace:` プロトコルを使い、[リポジトリ規則](../AGENTS.md#conventions)が厳密 DSH 参照とベンダー・ネイティブのチルダ範囲を区別する。
- **ローダーの `cordis:` 組み込み接頭辞。**`cordis:include` と `cordis:group` はプロトコル接頭辞であり、パッケージ名ではない。
- **`cordis.yml` 設定ファミリー**（`*.cordis.yml`・`*.cordis.snapshot.yml`・`cordis.patch.yml` を含む）。
- **自身の名前にその語を含むハーネスパッケージ**（`@deepseek-ai/dsh-tool-cordis` など）。
- **上流ランタイム識別子**（Schemastery の `Symbol.for('schemastery')` や `vendor:` メタデータフィールドなど）。
- **`docs/` 外の散文。**`vendor/*/README.md`・パッケージ README・Agent Note は書かれた当時の名前を保つ。そこでの素の `cordis` は Python SDK のオプション名やエージェントプリセット id の場合もある。`docs/` 内では散文とすべての Markdown フェンスが名前変更に従う。

## コードで変えなければならない箇所

| 箇所 | 変更前 | 変更後 |
|---|---|---|
| モジュールインポート | `import { Context } from 'cordis'` | `import { Context } from '@deepseek-ai/cordis'` |
| 型付きイベントのマージ | `declare module 'cordis'` | `declare module '@deepseek-ai/cordis'` |
| `package.json` 依存キー | `"@cordisjs/plugin-hmr": "^1.0.15"` | `"@deepseek-ai/cordis-plugin-hmr": "^1.0.15"` |
| `cordis.yml` プラグインエントリー | `name: '@cordisjs/plugin-include'` | `name: '@deepseek-ai/cordis-plugin-include'` |

## 適用・検証・復帰

[`scripts/rescope-vendor.ts`](../scripts/rescope-vendor.ts) が上記対応表を所有し、名前変更を実行するため、参照を手で書き換えることはない:

```sh
pnpm run rescope-vendor            # report what would change
pnpm run rescope-vendor --apply    # rewrite every reference
pnpm run rescope-vendor:check      # assert the post-state; runs in the hygiene gate
pnpm run rescope-vendor --apply --reverse   # return to the upstream names
```

上流同期の後に再適用し（[手順](../vendor/README.md)）、出力される再生成に従う。ロックファイル向け `pnpm install`、`pnpm run gen-third-party-notices`、触れたバイリンガルペア向け `pnpm run verify-translation-pairing --write` である。
