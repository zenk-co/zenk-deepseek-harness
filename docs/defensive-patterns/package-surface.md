# パッケージサーフェスのルール

日本語 | [English](package-surface.en.md) | [中文](package-surface.zh.md)

パッケージが何をエクスポートし、どのようにビルドされ、どのように依存関係を宣言するかのルール。[development.md](../development.md#typescript-project-layout) はレイアウト自体を説明し、[packages/AGENTS.md](../../packages/AGENTS.md) が常設の指示を持ち運ぶ。

## プラグインパッケージは Loader がロードするものをエクスポートする

プラグインパッケージのエントリーポイントは 2 つの形式のいずれかを取り、混在しない。**関数プラグイン**は `name`、`inject`、`Config`、`apply` を名前付きエクスポートする: `name`、`inject`、`apply` は小文字で、`Config` は大文字で `interface` としてとその Schemastery スキーマ値の両方として現れる。**サービスプラグイン**はそのサービスクラスを default エクスポートし、Loader はそのようにロードする。4 つに並ぶ default エクスポートは、Loader に関数プラグインの名前空間を破棄させる。それら以外に、Host エントリは他のパッケージが拡張または throw する Service Definition クラスとエラー型をエクスポートしてよい — ケイパビリティシームが消費するのはまさにそれらである — が、テスト便宜の値は決してエクスポートしない。UI プラグインパッケージの `/client` エントリはより厳格で、その規律は [packages/client/AGENTS.md](../../packages/client/AGENTS.md) が所有する: 同一パッケージのテストは相対 `../src/...` パスまたは `./src/*` サブパスを通じて内部に到達するため、テスト専用の必要が恒久のエクスポートになることは決してない。このルールはテスト便宜が公開 API に凍結するのを止める。

- Loader の 4 つ組とその正確な形式は [cordis-primer.md](../cordis-primer.md#loader-configuration) で定義されている。
- 判定条件: 関数プラグインのエントリ(`src/index.ts`)が 4 つを超えるエンティティをエクスポートしているか。4 つの並びに default エクスポートが追加されているか、2 つの形式が混在しているか。`/client` エントリが実装値をエクスポートしているか、別の機能プラグインにそれをインポートさせているか。フィクスチャが相対パスで別のパッケージに到達しているか。
- 境界: 拘束されるのは Loader プラグインのエントリーポイントのみである。内部モジュール、ヘルパー関数、フックは値のエクスポートを続ける。Host エントリの Service Definition クラスとエラー型は期待されるエクスポートである。テストフィクスチャは自身のパッケージ内に留まる — 別のパッケージの `src` への相対パスは `exports` マップとパッケージ境界チェックを迂回する。
- 例外: デフォルトではなし。真に必要な例外にはドメインオーナーの確認が必要である。

準拠したエントリ — 4 つのエクスポートと、5 番目のエクスポートではなくコメントとして記録された同一パッケージのテストパス。

```ts
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

// The plugin entry: the Loader four, and no fifth value
export const name = 'web-app'
export const inject = ['webServer']
export interface Config { /* … */ }
export const Config = z.object({ /* … */ })
export function apply(ctx: Context, config: Config): void { /* … */ }

// A same-package test imports '../src/internal/header.ts' instead of this entry
```

エントリが持ってはならないエクスポートを得る 3 つの方法。3 つとも差分で可視である。

```ts ignore-check
// The entry widened so a test could reach one helper
export { isHeaderLine } from './internal/header.ts'

// Both plugin forms on one entry: the Loader discards the four
export default class WebApp {}

// A fixture reaching into another package by relative path
import { isSurfaceEligibleType } from '../../core/session/src/surface.ts'
```

## 2 つのパッケージ形態があり、どちらも動的プラグインパッケージである

新しいパッケージは Host パッケージまたは Host + Client パッケージのいずれかであり、どちらも動的プラグインパッケージである。第 3 の形態は存在せず、例外もない。シェルが [packages/client/web/src/platform.ts](../../packages/client/web/src/platform.ts) の `PLATFORM_MODULES` を通じてシードする静的クライアントライブラリ — `client-store`、`ui-slots`、`ui-primitives`、`ui-dockkit` — と [packages/util/](../../packages/util/) の下のゼロ依存ライブラリは、このルールより前に存在し、クローズされている: 現状のまま動作し続け、新しいパッケージがそれらに加わることは決してない。真に両面のパッケージのみがコンパイラフェイスを分割し、ビルド出力は `lib` に行き、`include`、`external`、名簿のリストは手書きではなくワークスペースのスキャンによって導出される。手書きのリストや発明されたコンパイラフェイスは、ビルド出力とマニフェストを不一致にし、その後のすべてのパッケージが自身のリストを維持しなければならなくなる。

- 判定条件: 新しいパッケージが動的プラグインパッケージ以外としてビルドされているか(静的リンクバンドル、手書きの全 external リスト)。第 3 の `tsconfig` バリアントか。手書きの `include`、`external`、または名簿リストか。
- ここにある数値を信頼するのではなく、形態を再計算する: `packages/*/*` の下の `tsconfig.json` ファイルを列挙し、次に `tsconfig.client.json` と `tsconfig.host.json` も持つパッケージ、次に `dsh.client` を宣言するものを列挙する。
- 境界: 両面パッケージは `include` または `exclude` に現れてもよい。
- 例外: なし。承認パスは存在しない。パッケージの形態またはコンパイラフェイスの変更は、所有ドキュメントから始まり、ドメインオーナーの確認を必要とする。
- オーナー: コンパイラフェイスは [development.md](../development.md#typescript-project-layout)、パッケージグループは [packages/README.md](../../packages/README.md)、手順は [adding-a-package.md](../cookbook/adding-a-package.md)。

2 つの形態のいずれかにあるパッケージ。標準のマニフェストフィールドを持ち、手書きの external リストを持たない。

```json
{
  "name": "@deepseek-ai/dsh-example",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" }
  }
}
```

手書きの `external` リスト — そしてそれに並んで 1 つのパッケージのために発明された `tsconfig.foo.json` — はスキャンに何も導出させないため、ビルド出力とマニフェストの一致が止まる。

```json
{ "name": "@deepseek-ai/dsh-example", "external": ["@deepseek-ai/*"] }
```

## `package.json` の `exports` は標準キーセットを使用する

`package.json` の `exports` マップは標準キーセットのみを使用し、そこではすべてのキーがリポジトリ全体で 1 つの意味をすでに持ち、パッケージが自身のローカル目的のためにキーを開くことは決してない。文書化するオーナーなしにごく少数のパッケージだけが使用するキーは前例ではない: キーの形式化は、以下の文書化されていないキーを含め、所有ドキュメントとチェックを同じ変更で変えることを意味する。小さな共有キーセットが、コンシューマーに名前からキーの目的を推測させ、スキャンにエクスポートマップを判定させられるようにする。

- 標準キー(それぞれが `packages/*/*/package.json` と `apps/*/package.json` をまたいでリポジトリ全体で 1 つの意味を持つ): `.`(パッケージエントリ)、`./package.json`(ツールチェーンアクセスであり、セマンティックエクスポートではない)、`./src/*`(テストとツールのためのソースパススルー。その文書化ステータスはまだ未決である)、`./client`(ブラウザーエントリで、`dsh.client` 宣言と対になる)、`./types`(型エントリ)、`./typert`(typert 型ランタイム)、`./remote`(`@Remote` 呼び出しサーフェス)、`./locale/*.json`(ロケールリソース)、`./cordis.patch.yml`(`dsh.bundle` が宣言するバンドルパッチレイヤー)。カウントは次のパッケージで腐るためここには列挙しない。以下の再計算コマンドがそれらを出力する。
- そのセット外のキー(5 パッケージの `./brand`、4 の `./worker`、それぞれ 2 の `./startup`、`./runner`、`./protocol`、および多数の一回限りのキー)は文書化された意味を持たない。それらはレビュー待ちであり、コピーすべきパターンではない。
- 判定条件: 変更が標準セット外のエクスポートキーを追加しているか。
- 例外: デフォルトではなし。新しいキーは、ドメインオーナーの確認を得て、先に所有ドキュメントとチェックを変更する。
- 分布を再計算する:

```sh
python3 -c "import json,glob,collections; c=collections.Counter(); [c.update(json.load(open(p)).get('exports',{}).keys()) for p in glob.glob('packages/*/*/package.json')+glob.glob('apps/*/package.json') if isinstance(json.load(open(p)).get('exports'),dict)]; print(c.most_common())"
```

準拠したマップ — リポジトリ全体の意味で使用される 3 つの標準キー。クライアントエントリも宣言するパッケージにある。

```json
{
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./types": { "types": "./lib/types/types.d.ts", "default": "./lib/types/types.js" },
    "./src/*": "./src/*",
    "./package.json": "./package.json"
  }
}
```

1 つのパッケージのローカル目的のために開かれたキー — ここでは `./brand` と `./worker` で、文書化ステータスは未決 — は、エクスポートマップを、コンシューマーもスキャンも読めないパッケージごとの慣例に変える。

```json
{
  "exports": {
    ".": "./lib/index.js",
    "./brand": "./lib/brand.js",
    "./worker": "./lib/worker.js"
  }
}
```

## 依存関係宣言とバージョン一貫性は依存関係スキャンによって強制される

依存関係宣言とバージョン一貫性は依存関係スキャンによって機械的に保証される。このページは `devDependencies` と `peerDependencies` のフィールド規則も、独自のパッケージ承認リストも再掲しない。スキャンが失敗したら、ローカルで再現し、それが名指しするマニフェストを修正する。ルールはスキャンとそのポリシーファイルが所有するからである。変更を着地させるためにスキャンを編集したりポリシーを緩めたりするのは通常の編集ではなく、ドメインオーナーの確認を必要とする。

- エントリーポイント: [verify-package-dependencies.ts](../../scripts/verify-package-dependencies.ts)。`pnpm run verify-package-dependencies` として、`scripts/run-gates.ts` によって `package-dependencies` ゲートとして、そして `.github/workflows/release.yml` によって直接実行される。
- ポリシーオーナー: [package-dependency-policy.ts](../../scripts/package-dependency-policy.ts) が `PACKAGE_DEPENDENCY_POLICY` をエクスポートする。宣言セクション、バージョン形式、免除はそこで定義され、パッケージレベルの文脈は [packages/README.md](../../packages/README.md) にある。
- 境界: このページはパッケージ、フィールド規則、しきい値を列挙しない。代わりに所有ファイルを指す。
- 配線を見つける: `grep -rn "verify-package-dependencies" package.json .github/workflows scripts/run-gates.ts`。
- 例外: スキャンまたはポリシーの変更には、ドメインオーナーの確認と、変更に記録された理由が必要である。

再現可能な手順: 再現し、診断を読み、それが名指しするマニフェストを修正する。

```sh
# 1. Reproduce what CI reports
pnpm run verify-package-dependencies

# 2. The diagnostic names the manifest, the section, the dependency, and the expected range
#    packages/example/package.json: dependencies.@deepseek-ai/dsh-base must use workspace:*, found workspace:~

# 3. The fix goes into the manifest, never into the policy file or the scan
#    "dependencies": { "@deepseek-ai/dsh-base": "workspace:*" }

# 4. Re-run the scan until every package matches the published policy
pnpm run verify-package-dependencies
```

機械的保証を失う 2 つの方法: マニフェストではなくチェックを変更するか、ルールをここに再掲してそのオーナーから乖離させるか。

```text
Relaxing PACKAGE_DEPENDENCY_POLICY, or dropping the scanned section that fails, to go green
Restating a required-devDependency package list or the field rules on this page instead of linking the policy file
```

## 内部依存関係の構文はパッケージファミリーに従う

内部依存関係の構文はパッケージファミリーに従う: `@deepseek-ai/dsh` と `@deepseek-ai/dsh-*` は `workspace:*` を使用し、他のすべての内部パッケージは `workspace:~` を使用し、`workspace:^` は引退した。同じ依存関係名はすべてのワークスペースで同じように書かれ、不一致はレビュアーが免除できる警告ではなく、ハードスキャン失敗である。均一な構文は 1 つの解決パスを保ち、依存関係の重複インスタンスとそれに続く解決の差異を防ぐ。

- 判定: [verify-package-dependencies.ts](../../scripts/verify-package-dependencies.ts) の `workspaceRange()` による。`@deepseek-ai/dsh` と `@deepseek-ai/dsh-*` ファミリーは `workspace:*` を取り、他のすべての内部パッケージは `workspace:~` を取る。スキャンは管理対象マニフェストを走査し、同じ依存関係名のすべての宣言を比較する。
- 境界: ワークスペースメンバーでない同一名前空間のパッケージは通常のサードパーティ範囲を宣言し、ファミリールールの外にある — `@deepseek-ai/libreoffice-kit` は `apps/desktop-host/package.json`(dependencies)、`packages/bundle/web-app/package.json`(devDependencies)、`packages/document/office-to-pdf/package.json`(dependencies)、`packages/skill/skill-office/package.json`(dependencies)で `^0.1.5` と宣言されている。
- 分布はここに再掲しない。以下の再計算コマンドが `workspace:*`、`workspace:~`、`workspace:^`、およびファミリールール外の正確な範囲宣言の現在のカウントを出力する。
- 例外: スキャンが機械的に決定する。真の例外は、ドメインオーナーの確認と変更に記録された理由とともに、スキャンとポリシーファイルを変更することを意味する。
- 再計算:

```sh
python3 -c "import json,glob,collections; c=collections.Counter(); [c.update([r]) for p in glob.glob('apps/*/package.json')+glob.glob('packages/*/*/package.json')+glob.glob('vendor/*/package.json') for s in ('dependencies','devDependencies','optionalDependencies','peerDependencies') for n,r in (json.load(open(p)).get(s) or {}).items() if n.startswith('@deepseek-ai/')]; print(c.most_common())"
```

各ファミリーをその形式で。非メンバーの例外は通常のバージョン範囲のまま残す。

```json
{
  "dependencies": {
    "@deepseek-ai/dsh-base": "workspace:*",
    "@deepseek-ai/cordis": "workspace:~",
    "@deepseek-ai/libreoffice-kit": "^0.1.5"
  },
  "devDependencies": {
    "@deepseek-ai/dsh-typert-registry": "workspace:*"
  }
}
```

`workspace:~` 上の `dsh-*` パッケージと、外部範囲に固定されたワークスペースメンバー — それぞれがハードスキャン失敗であり、正確なバージョンに固定するという引退したルールは代替として利用できない。

```json
{
  "dependencies": {
    "@deepseek-ai/dsh-base": "workspace:~",
    "@deepseek-ai/cordis": "^4.0.0"
  }
}
```

## 新しい resolve フックは明確に拒否される

新しい `resolve` フックはデフォルトで拒否される — 回避したいという選好ではなく、明確な禁止である。真の必要には 2 つの前提条件が同時に必要である: 変更を動機付けた指定子にパッチを当てるのではなく、解決戦略を全体として再監査すること、そして何かが着地する前にドメインオーナーの確認を得ることである。このケースは特別だという作者自身の判断は確認ではない。

- 判定条件: 変更が `resolve` フックを追加しているか。同じ指定子を書き換える既存フックのラッパーも含む。
- 境界: このルールはフックを追加してよいかどうかを決める。解決、ホットリロード、プラグイン管理の責務の分離は別に統治され、新しいフックを許可しない。
- 唯一の解決パスは `dsh` ソース起動が登録する tsx ESM フックであり、その根拠は[ソース起動の Agent Note](../../.agents/notes/implemented/architecture/2026-07-29-dsh-source-launch-tsx-esm.md)にある。
- 例外: 上記の 2 つの前提条件のみ。両方とも変更に記録される。

新しい解決動作が真に必要な場合の、順を追った準拠パス。

```text
A new resolve hook is allowed only after both preconditions hold:

1. Re-audit the resolve strategy as a whole — resolution, hot reload, and plugin
   management responsibilities together, not only the specifier at hand.
2. Record the domain owner's confirmation on the change.
3. Only then add the hook, linking both records from the change.

Until both hold, the answer is no; "this case is special" is the author's judgment,
not a confirmation.
```

1 つの指定子がこのパッケージの期待する場所に着地するために追加されたフック、または既存のフックの同等のラッパー — 解決パスは分岐を得て、リゾルバーが返すものは `node_modules` と一致しなくなる。

```ts ignore-check
// Added so one specifier resolves to the local source copy
export async function resolve(specifier: string, parentURL: string, importAttributes: object) {
  if (specifier === '@deepseek-ai/dsh-example') return { url: localSourceUrl, shortCircuit: true }
  return defaultResolve(specifier, parentURL, importAttributes)
}

// The equivalent shape: wrapping the hook that already exists
const previous = hooks.resolve
hooks.resolve = (specifier, context, next) =>
  pinned.has(specifier) ? pinned.get(specifier) : previous(specifier, context, next)
```

## パッケージモジュールはモジュールスコープで await しない

パッケージのソースモジュールは、自身の reject を処理する明示的な `main()` のような、呼び出す関数の中で非同期作業を開始し、モジュールスコープで `await`、`for await`、`await using` を決して使用しない: モジュールスコープの待機はすべてのインポーターの評価を待たせ、reject をモジュール評価失敗に変え、ブラウザーワーカーイメージの同期 CommonJS ラッパーに降ろせない。

- 判定: [verify-no-top-level-await.ts](../../scripts/verify-no-top-level-await.ts) による。`pnpm run verify-no-top-level-await` として、また `scripts/run-gates.ts` によって `no-top-level-await` ゲートとして実行される。すべての `packages/*/*/src/**/*.{ts,tsx}` ファイルをパースし、実行可能ファイルを宣言によってのみ除外する: `#!` で始まるソース、またはパッケージの `bin` フィールドが名指しする `lib/` 出力のソースである。
- 例外: なし。
