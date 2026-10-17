# クックブック: ワークスペースパッケージを追加する

日本語 | [English](adding-a-package.en.md) | [中文](adding-a-package.zh.md)

新しい `@deepseek-ai/dsh-<name>` パッケージのための、ファイル単位のチェックリスト。このチェックリストは bash パッケージとアダプターパッケージをテンプレートとして検証されている。それらから乖離した場合はここを修正する。

## 1. パッケージを作成する

```
packages/<group>/<pkg>/
  package.json     # copy from packages/core/tools, adjust name/description/deps
  tsconfig.json    # extends ../../../tsconfig.base.json, rootDir src,
                   # outDir lib/types, references: ../../../vendor/cosmokit,
                   # ../../../vendor/cordis (+ ../../../vendor/schemastery if
                   # you use Config, + ../../<group>/<dep> for each dsh dep)
  src/index.ts     # service default export or plugin (name/inject/apply/Config)
  locale/en.json   # optional display metadata: meta.title and meta.description
  locale/zh.json   # translations using the same fields
  README.md        # service API, events, extension points, design notes,
                   # + gated Model Experience context blocks or short form
                   # + the gated "Known Limitations and Deferred Work" section
                   # (or a whitelist entry in scripts/verify-package-readme-limitations.ts)
```

パッケージの役割に合う既存グループ (`core`、`llm`、`shell`、`compaction`、`subagent`、`todo`、`session`、`client`/`host`、`util`、`test-support` のいずれか) がある場合はそれを選ぶ。新しいグループも許されるが、それは純粋なコンテナである: `package.json` もソースファイルも持たず、パッケージは依然としてそのちょうど 1 階層下に置かれる。

package.json の不変条件 (`pnpm run constraints` / `scripts/check-workspace-constraints.ts` が強制する): `private: true`、ルート `package.json` と一致する `version`、`type: module`、`main: "lib/index.js"`、`types: "lib/types/index.d.ts"`、`exports["."].types: "./lib/types/index.d.ts"`、`exports["."].default: "./lib/index.js"`、`@deepseek-ai/cordis` を peerDependencies と devDependencies の両方に (同じ範囲で)。すべての dsh peer 依存を devDependencies に反映する。`@deepseek-ai/schemastery` は (実行時バリデーターであるため) agent-loop に合わせて `dependencies` に入れる。`files` リストにはちょうど `lib/index.js`、`lib/types/**/*.d.ts`、およびゲートが認識するパッケージ固有のランタイム成果物を含める。ランタイムエクスポートが出力ツリー内を指すパッケージは `lib/types/**/*.js` も含める。`src`、宣言マップ、JS マップ、古いルート宣言ファイルを公開しない。パッケージ `bin` を持つ CLI アプリパッケージは、`files` 内の `lib/index.js` の直後に `lib/bin.js` を含める。

パッケージ内の相対インポートは、ソース内で明示的な `.ts` 指定子を使う (たとえば `export * from './types.ts'`)。コンパイラーはそれらを出力 JS では `.js` に書き換え、宣言では明示的な `.ts` 指定子を残す。標準の NodeNext/Node16 TypeScript コンシューマーは、それらを兄弟の `.d.ts` ファイルに解決する。

## 2. ルート設定に登録する

| ファイル | 変更 |
|---|---|
| `tsconfig.base.json` | 既存グループなら編集不要。新グループの場合は `@deepseek-ai/dsh-*` ワイルドカードに `./packages/<group>/*/src` 候補を追加する |
| `tsconfig.host.json` (Host パッケージ) または `tsconfig.client.json` (Client パッケージ) | `references` に `{ "path": "./packages/<group>/<pkg>" }` を追加する — 通常のパッケージはちょうど 1 つのアグリゲートに属し、両方には決して属さない。`api/remotes` はリポジトリ固有の分割を使う。Host が生成した契約を Client が後のフェーズで消費するためである。新しいパッケージはそれを模倣してはならない ([レイアウト](../development.md#typescript-project-layout)) |

`packages/client/*` パッケージはさらに `tsconfig.base.json` の代わりに `tsconfig.base.client.json` を継承し、client プラグインパッケージは package.json で `dsh.client` を宣言し、`./client` をエクスポートし、共有 tsdown プリセット (`packages/client/tsdown.client.ts`) を呼び出す — client 側の契約については [packages/client/AGENTS.md](../../packages/client/AGENTS.md) を参照。

glob またはパッケージマニフェストの検出により自動的にカバーされる — 編集不要: ルート `package.json` の workspaces、`scripts/publint-all.ts`、`tsdown.config.ts`、`.oxlintrc.json`、`scripts/check-workspace-constraints.ts`。

## 3. パッケージトポロジーを決める

交換可能なケイパビリティでは、Service Definition / Service Provider / Consumer の役割が独立に進化する場合にそれらをパッケージに分割する (docs/architecture.md の「ケイパビリティシーム」を参照 — shell の 3 点セットがテンプレートである)。単一目的のプラグインは 1 パッケージのままにする。

### 存在する役割に名前を付ける

安定した現在の責務に名前を付ける。最初の実装、将来ありうる拡張、または Cordis 基底クラスに名前を付けない。インターフェースパッケージはケイパビリティに名前を付ける。実装パッケージはそれを区別する機構、プロトコル、環境、またはベンダーを追加する。`local` は、同一ホストでの実行が契約の一部である場合にのみ使う。

1 つのエンジン、ランタイム、ポリシー、コントローラー、リゾルバー、ストア、または現在の設定には単数の `ctx` キーを使う。レジストリ、または複数の名前付きメンバーを所有するサービスには複数形のキーを使う。クラスの役割とキーの数は一致しなければならない。互換性のない host と client の宣言に 1 つの Cordis `Context` キーを再利用しない。TypeScript の宣言マージは、別々のランタイムコンテキストを使う場合でも両方のフェイスを見る。自然な複数形がすでに別のフェイスに属する場合は役割サフィックスを追加する。

| 語 | 使う場合 | 使わない場合 |
|---|---|---|
| `Controller` | コマンドまたはユーザー意図を受け取り、既存の 1 つのドメイン状態またはプレゼンテーション状態を変更する。 | 任意の作業を実行する、プロバイダーフリートを所有する、または表示用の値変換のみを行う。 |
| `Store` | 1 つのデータセットを所有し、主にそのデータに対する CRUD、スナップショット、購読操作を提供する。 | 状態マシンを検証する、権限を裁定する、作業をディスパッチする、またはプロバイダーの優先順位を所有する。マップであることはクラスをストアにしない。 |
| `Directory` | 発見または選択のためにエントリーとメタデータを公開する。 | プロデューサーが任意の実装を登録する、または呼び出し元がそれを介して作業を実行する。 |
| `Presenter` | ドメイン値またはツール引数からレンダリング意図への純粋な変換である。 | I/O を行い、購読し、状態を変更し、またはライフサイクルを所有する。 |
| `Registry` | 名前付き登録の動的集合を所有し、ルックアップ、重複または優先順位の規則、寿命、破棄を含む。 | 主たる契約がディスパッチ、実行、キャンセル、ポリシー、またはオーケストレーションである。 |
| `Runtime` | ライブ作業を実行し、呼び出しをまたぐディスパッチ、キャンセル、プロバイダー調整、または操作ライフサイクルを所有する。 | レコードを保存する、カタログを返す、1 つの値を解決する、または設定を保持するだけである。 |
| `Resolver` | 与えられた入力から 1 つの答えを計算または特定し、その答えのライフサイクルは所有しない。 | 可変コレクションまたは長時間実行を所有する。 |
| `Binder` | 宣言された 1 つのインターフェースを呼び出し元のコンテキストまたはライフサイクルに接続し、バインドされた値を返す。 | 値をコレクションとして所有する、そのドメイン状態を制御する、またはデータ変換のみを行う。 |
| `Engine` | ドメインアルゴリズムまたはステートフルな実行モデルを実装する。 | プロバイダーを選択する、またはプロトコル境界をまたいで転送するだけである。 |
| `Policy` | 何が許可され、選択され、制限され、または観察されるかを決定する。 | 決定が許可する機構を実行する。 |
| `Executor` | 1 つのケイパビリティ内で 1 つの明示的なリクエストまたは解決済み仕様を実行する。 | 広範なアプリケーションライフサイクルまたはプロバイダーカタログを所有する。 |
| `Gateway` | プロセス、ネットワーク、RPC、または API の境界を適応する。 | 同一プロセスのサービスを登録する、またはメタデータを保存するだけである。 |
| `Provider` | ケイパビリティ定義の 1 つの実装を提供する。複数存在しうる場合は機構またはベンダーの修飾子を追加する。 | ケイパビリティ定義、プロバイダーレジストリ、またはコンシューマーランタイムである。 |
| `Backend` | 定義されたインターフェースの背後で交換可能な下位の永続化、トランスポート、または実行を実装する。 | ユーザー向けサービス、または返される 1 つのライブリソース参照である。 |
| `Handle` | 1 つのライブリソースを参照し、そのリソースを制御または観察する。 | 完全なリソースプールを作成および管理する。 |
| `Config` | 1 つの解決済み設定値、または 1 つの厳密に境界付けられたレコードとその更新契約を所有する。 | 一般的なコレクションを保存する、作業を実行する、または無関係な設定を公開する。 |
| `Service` | 上記のより鋭い役割のいずれも正直に述べられない、凝集したドメインサービスを所有する。 | クラスが Cordis `Service` を拡張するという理由だけで名前が存在する。 |

`SDK` は、サポートされる Python および TypeScript SDK が使う JSON-RPC クライアント/サーバープロトコルにのみ使う。DeepSeek Harness 自体はエージェントハーネスであり、SDK プロジェクトではない。正規の製品表記 `Typert` を使い、`TypeRT` や `typeRT` は決して使わない。

<a id="4-write-the-package-readme"></a>

## 4. パッケージ README を書く

パッケージ固有のサービス API、設定、イベント、拡張ポイント、設計ノートを先頭に置く。[dsh-doc メタデータリファレンス](../../.agents/skills/dsh-doc/references/metadata-links-i18n.md#the-kind-system)の 4 つの kind ラベル — group、reference、library、bundle — から、パッケージのリポジトリ上の位置とエントリーの形式に合う frontmatter `kind` を選ぶ。各 kind は 1 つの README テンプレートを選択する。制限セクションには、このパッケージが所有する永続的なコンシューマーギャップと自明でないメンテナー制約を記録する。通常のクリーンアップはソースの TODO または Agent Note に残す。間接的な Model Experience の文は、このパッケージの貢献を表面化するコンシューマーに言及してよいが、そのコンシューマーの実装を繰り返してはならない。パッケージ README はこの正規の並びで終える:

````markdown
## Model Experience

### Request context and condition

#### What the model sees

The exact data-dependent fields, an anchored generated-catalog link, or an introduction to the verbatim literal below.

##### Verbatim text for this field, when needed

```markdown
Stable system-prompt prose of any length, or another long non-generated literal, copied exactly from source.
```

#### Token effect

Fixed, conditional, retained, replaced, capped, or zero-direct token effect.

#### KV Cache effect

Append-only, prefix-stable, replacing, or independent behavior, including the exact conditions that may invalidate reuse.

## Known Limitations and Deferred Work

- **Consumer-visible gap** — exact missing operation or case, its consequence, and any maintainer constraint.
````

Model Experience は実装から記入する。直接、条件付き、上限付き、ライフタイム、または補助のモデルコンテキストエントリーごとに 1 つの H3 を使い、上に示した順序の 3 つの H4 フィールドとそれぞれの下に 1 つの散文段落を置く。パッケージが所有する安定テキストを引用する: システムプロンプトの散文は、それを導入するフィールド — 通常は `What the model sees` — の下のタイトル付き H5 と `markdown` フェンスに置き、他の短いリテラルは名前付きプレースホルダー付きでインラインにとどめ、他の長いリテラルは同じネスト形式を使う。データ依存またはプロバイダー所有のテキストのみを要約する。ツールスキーマのエントリーは、生成された[ツールカタログ](../tool-catalog.md)のアンカー付きセクションにリンクし、そこにない差分のみを述べる。プロンプトとスキーマのエントリーは、スコープ設定が一方を他方なしで隠せる場合は分けておく。`KV Cache effect` では、追記専用の成長、安定した繰り返しプレフィックス、以前のリクエストトークンの置き換え、独立したモデルリクエストを区別し、次に再利用を無効化しうるパッケージ所有の変更を名指す。「無効化しない」とは、パッケージがすでに再利用可能なプレフィックスを保存することを意味する。プロバイダーのキャッシュ可用性とエビクションはパッケージの契約の外にとどまる。[prose standard](../../.agents/skills/dsh-prose-standard/SKILL.md) が完全性と所有権を規定し、検証器が必要なセクション構造を強制する。

コンテキスト効果がない、または 1 つのコンシューマー所有の経路を持つパッケージは、[`SENTENCE_MODEL_EXPERIENCE`](../../scripts/verify-package-readme-model-experience.ts) の監査済み `None, as ` または `Indirectly, through ` 文を使い、続けて `KV Cache effect` H4 と 1 つの非空段落を置く。モデル非依存の汎用パッケージは代わりに `NO_MODEL_EXPERIENCE_SECTION` に加わってよい。どちらの場合も、別のパッケージの作業の説明に拡張してはならない。制限の[許可リスト](../../scripts/verify-package-readme-limitations.ts)は独立である。[アーカイブ済み Model Experience Agent Note](../../.agents/notes/archived/process/2026-07-12-package-model-experience-contract.md) が根拠を記録している。

<a id="plugin-display-metadata"></a>

## 5. 任意のプラグイン表示メタデータを追加する

npm パッケージプラグインでは、`locale/en.json` にタイトルと説明を定義する。`locale/zh.json` のような他の言語ファイルも同じフィールドを使う:

```json
{
  "meta": {
    "title": "Workspace Tools",
    "description": "Tools for your workspace."
  }
}
```

これらのエントリーを `package.json` にマージし、既存のランタイムエクスポートと公開ファイルを保持する:

```json
{
  "exports": {
    "./package.json": "./package.json",
    "./locale/*.json": "./locale/*.json"
  },
  "files": ["locale/*.json"]
}
```

言語ファイルは `locale/` にまとめ、`en.json` を検出エントリーとする。フィールドは省略可能であり、値が存在する場合は非空文字列でなければならない。ファイルやフィールドの欠如はフォールバックを許すが、不正な JSON や無効なフィールドはプラグインごとの診断を生成する。

フィールドは、ビュー固有の名前整形の前に、既存の locale 言語チェーンを最初に使って独立にフォールバックする:

- タイトル: locale の `meta.title` → パッケージルートプラグインでは `package.json.name` → 完全な Cordis プラグイン名。
- 説明: locale の `meta.description` → パッケージルートプラグインでは `package.json.description` → 説明なし。

locale ルックアップのために `<package name>/locale/en.json` をエクスポートする。パッケージフィールドのフォールバックやアイコン宣言のために `<package name>/package.json` を公開する。`<package name>/search` のようなサブパスプラグインはパッケージではなく、`./search/package.json` でエクスポートされたものであっても `package.json` を決して読まない。テキストには `./search/locale/*.json` を、画像には `./search/icon` を使う。

バンドルカード、詳細、コンポーネント行の画像は、パッケージルートプラグインがエクスポートされたマニフェストのトップレベルに `"icon": "./icon.svg"` を設定するか、そのフィールドを省略した場合は `./icon` をエクスポートする。サブパスプラグインは `"./search/icon": "./search.svg"` のように独自のアイコンをエクスポートする。各画像を `files` に含める。マニフェストの `icon` はマニフェストのディレクトリからの相対である。絶対パス、URL、そのディレクトリの外のパス、およびその外に解決するシンボリックリンクは拒否される。エクスポートされたアイコンは locale リソースと同様に Node exports を通じて解決され、そのパッケージの内側にとどまらなければならない。SVG、PNG、JPEG (`.jpg`/`.jpeg`)、WebP ファイルが 256 KiB までサポートされる。画像は自己完結でなければならない。SVG はインライン HTML ではなく画像としてレンダリングされる。Host はプラグインをアクティブ化せずに data URL を返す。無効な宣言や読めないファイルは、エクスポートを試みることなく、有効なテキストを保持したままメタデータ診断を生成する。画像が欠落しているかデコードできない場合はパネルのデフォルトアートワークを使う。

インストール済みバンドルのカードと詳細、コンポーネントリストと設定詳細、および Settings のプラグインインベントリーは、無効化されたプラグインやプリセットプラグインを含め、このメタデータを表示する。読み取りはプラグインをアクティブ化しない。

Settings だけが、npm スコープと Cordis/DSH プレフィックスを除去して、リテラルのパッケージ名とモジュール名のフォールバックを短縮する。Plugin Manager は完全な名前を保つ。locale のタイトルと説明は変更されない。行設定ページは、プラグインに表示用の説明がない場合、登録されたサマリーを使ってよい。

Install ビューは依然として locale メタデータではなく `pnpm view` からの npm レジストリ情報を使う。

結果を検証する:

1. リポジトリルートから `pnpm run verify-package-meta` を実行し、フィールド、リソースエクスポート、公開範囲を確認する。
2. インストール済みプラグインの該当する Plugin Manager と Settings のエントリーを英語と中国語の間で切り替え、タイトル、説明、フィールドごとのフォールバック、および Settings 専用のコンパクトな技術名を確認する。

## 6. 検証する

```sh
pnpm install        # registers the workspace
pnpm run doc-sync
pnpm run constraints && pnpm run typecheck && pnpm run lint
pnpm run build && pnpm run hygiene
```

新しいパッケージに必要な動作固有のチェックとカバレッジについては、[リポジトリのテストポリシー](../testing.md)に従う。
