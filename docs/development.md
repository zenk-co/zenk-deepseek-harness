# 開発ガイド

日本語 | [English](development.en.md) | [中文](development.zh.md)

セットアップチュートリアルは、新しいコントリビューターを前提条件から検証済みのチェックアウトまで導く。続くコントリビューターリファレンスは、リポジトリレイアウト、日常のワークフロー、CI の編成を扱う。設計根拠と実装の詳細は、リンクされた Agent Notes とスクリプトに属する。

## セットアップチュートリアル

### 前提条件

- Node.js は 22.19+ と 24+ をサポートする。CI は 22.19、24、26 をカバーする。[Node engine floor Agent Note](../.agents/notes/implemented/process/2026-07-06-node-engine-floor.md) を参照。
- Node.js の TypeScript 型ストリッピングが有効であること。リポジトリのビルドスクリプトは tsdown のネイティブ設定ローダーで `tsdown.config.ts` をロードするため、`NODE_OPTIONS` に `--no-experimental-strip-types` がある場合や Node.js ビルドが TypeScript サポートを欠く場合は失敗する。`pnpm run build` はこれを最初にチェックし、原因を名指す。
- Corepack が有効な pnpm。リポジトリは `package.json` で `pnpm@11.28.5` を固定する。`pnpm --version` が Corepack を通じて解決されない場合は `corepack enable` を実行する。
- Git 2.26 以降。フックのセットアップは Git の worktree 固有設定拡張を有効にする。
- 省略可能: Web、ヘッドレス、ACP 自動化のデモと実 API e2e テスト用の DeepSeek API キー。

### Windows と WSL 2

Windows では、ネイティブツールで開発するか、Linux 環境のために WSL 2 を使うことができる。WSL 2 は、Linux の挙動の検証や、ネイティブ依存のコンパイルまたはファイルシステム権限が Windows での開発を妨げる場合に Linux ツールチェーンを使うのに役立つ。各環境は独自のランタイム、ビルドツール、権限を必要とする。WSL は省略可能である。

チェックアウト、インストール済み依存、ツールチェーンは同じオペレーティングシステム環境に保つ。WSL 2 ではチェックアウトを Linux ファイルシステムに置き、ネイティブ Windows ツールでは Windows ファイルシステムを使う。2 つのファイルシステムをまたぐファイルアクセスは、Git、依存のインストール、ビルドなど I/O 集約的な操作にオーバーヘッドを加える。Microsoft の [file storage and performance guidance](https://learn.microsoft.com/en-us/windows/wsl/filesystems#file-storage-and-performance-across-file-systems) を参照。

ネイティブバイナリとリンクはオペレーティングシステム間で異なり得るため、各環境で依存を別々にインストールする。テスト結果はテストを実行した環境に適用される。Windows 固有の挙動には依然としてネイティブ Windows での検証が必要である。

### 初回セットアップ

pnpm は厳格なシンボリックリンクロードを使うため、宣言されていない依存はホイスティングに頼るのではなく失敗する。依存のビルドスクリプトは `pnpm-workspace.yaml` で明示的に許可リストに載せておく。

リポジトリルートから依存をインストールする:

```sh
pnpm install
```

インストールは `scripts/install-lefthook.mjs` を通じて worktree ローカルの Lefthook フックも構成する。フックパスの安全 contract は [worktree-local hooks Agent Note](../.agents/notes/implemented/process/2026-07-27-worktree-local-lefthook.md) が所有する。

[DevTools フロントエンド](../packages/experimental/inspector/README.md#use-this-package)は、固定された npm ソースパッケージと Vite からローカルでコンパイルされる。依存のインストール後、そのビルドはネットワークアクセスもブラウザーのインストールも必要としない。ワークスペースと公開パッケージのインストールは DevTools リソースダウンロードフックを実行しない。公開された Inspector パッケージはビルド済みフロントエンドを含む。

依存がキャッシュから復元されたか `postinstall` がスキップされたためにフックが欠けている場合は、手動でインストールする:

```sh
node scripts/install-lefthook.mjs
```

ラッパーが既存の Git 設定を拒否した場合や古いロックを報告した場合は、worktree メタデータを当て推量で編集するのではなく、その診断とリンクされた Agent Note に従う。チェックアウトを移動した後は、ラッパーを再実行して所有パスを再生成する。

新しくクローンした後は一度 typecheck を実行する:

```sh
pnpm run typecheck
```

`pnpm run typecheck` が正常終了すればセットアップは完了である。

## コントリビューターリファレンス

### TypeScript プロジェクトレイアウト

リポジトリは分離された Host と Client の集約を使う。通常のパッケージはちょうど 1 つの集約に登録される: Host パッケージは `tsconfig.host.json` に、Client パッケージは `tsconfig.client.json` に登録される。3 つのパッケージ (`host/webserver`、`compaction/compaction`、`typert/registry`) は共有リーフとして両方の集約から参照され、各側が同じソースを型チェックする。

| ファイル | 役割 | プログラムを構成するか? |
|---|---|---|
| `tsconfig.json` | ソリューションルート: base を `extends` し、`files: []` と 2 つの集約への参照を持つ。tsserver の検出エントリーであり、完全な Project Reference グラフを明示的に実行するためのエントリーである。継承された `paths` を通じて、`scripts/` を実行する tsx の解決設定でもある。 | いいえ |
| `tsconfig.host.json` | Host 集約: Host パッケージ、examples、tests、scripts、website、および `api/remotes` の例外的な Host プロジェクト。 | はい |
| `tsconfig.client.json` | Client 集約: `packages/client/*` パッケージとそのテスト、`apps/web`、および `api/remotes` の例外的な Client プロジェクト。 | はい |
| `tsconfig.base.json` | 共有の compilerOptions とソース `paths` マップ。vitest 設定が vite-tsconfig-paths を向ける解決ファサードでもある: `include` を持たないため、その `paths` はすべてのインポーターに適用される。 | いいえ |
| `tsconfig.base.client.json` | Client 集約とすべての `packages/client/*` パッケージが拡張するブラウザーコンパイラー設定 (`jsx`、DOM ライブラリー、`types: []`)。 | いいえ |

Host と Client は 2 つの集約プログラムのままでいる。両側が cordis `Context` インターフェースを同じキーで異なるサービスとして宣言マージし、両方のマージを見る 1 つのプログラムは衝突を報告するからである。衝突は `ts.Program` の内側にのみ存在し — モジュール解決がそれを引き起こすことは決してない — そのためソリューションは両方の集約を参照でき、1 つの paths ファサードが両側にまたがり得る。3 つの規律が続く:

- `tsconfig.base.json` は `include` や `files` を決して得ない: それらは拡張するすべてのパッケージプロジェクトに漏れ出し、ファサードの全マッチスコープを狭める。
- リポジトリ全体の `ts.Program` を構築するスクリプトは `tsconfig.host.json` または `tsconfig.client.json` を明示的にシードする — ルートソリューションは決して使わない。両方の集約を 1 つのプログラムに平坦化すると `Context` のマージが衝突するからである。
- 新しいパッケージはちょうど 1 つの集約に登録される。両方のリーフ設定を持つのは上記の分割パッケージだけであり、共有リーフは両方の集約に登録される。各側が同じソースを型チェックしなければならないからである。Node ローダーエントリーとブラウザーエントリーの両方を持つことは、パッケージを分割する理由にはならない。通常の Client プラグインは Client ビルドフェーズ中に両方のランタイム成果物を生成する。

6 つのパッケージが Host と Client の tsconfig を分割する: `api/remotes`、`api/gateway`、`api/session-controller`、`api/workspace-controller`、`client/connection`、`session-query/session-log-export`。`api/remotes` の Host エントリーは Host Typert グラフに参加し、その Client エントリーは生成された `/remote` 宣言をインポートする。`session-log-export` は Node アーカイブ生成をブラウザーコントローラーの外に保つ。したがって各分割パッケージルートの `tsconfig.json` はソリューションにすぎず、2 つの集約と直接のコンシューマーはそれぞれ `tsconfig.host.json` または `tsconfig.client.json` を参照する。ワークスペースの `constraints` ゲートは到達可能な Project Reference グラフをたどり、各参照側プロジェクト自身のコンパイラーフェイスをチェックする: 単一設定のターゲットはどちらのフェイスからも有効のままであり、分割ターゲットはソリューションルートや反対側のリーフではなく一致するリーフを名指さなければならない。ゲートは両方のリーフ設定の存在から分割パッケージを検出するため、新しい分割は自動的にゲートに参加する。[`api-remotes` README](../packages/api/remotes/README.md) と [`session-log-export` README](../packages/session-query/session-log-export/README.md) がそれぞれの分割を説明する。

`pnpm run build:artifacts` は生成された依存順ですべての成果物を出力し、各コンパイラーフェイスのパッケージ参照のみをチェックしてコンパイルする:

```sh
pnpm run build:native-system
tsc -b <tsconfig.host.json references>
tsdown --env.DSH_BUILD_FACE host
pnpm --filter @deepseek-ai/dsh-desktop run bundle
tsc -b <tsconfig.client.json references>
tsdown --env.DSH_BUILD_FACE client
pnpm run build:web
```

`pnpm run build:check` は `tsc -p tsconfig.host.json` と `tsc -p tsconfig.client.json` のみを並行して実行する。プロジェクトモードは各集約のリポジトリ全体のテストとスクリプトプログラムを、すでにディスク上にあるパッケージ宣言に対してチェックし、参照をコンパイルすることは決してないため、`build:check` は欠落または古い `build:artifacts` 出力を検出も再ビルドもしない。欠落した出力はコンパイラーエラーとして表面化する。`pnpm run build` は両方のステップセットを 1 つの[スケジュールされた](../scripts/run-gates.ts)依存グラフとして実行する: 各集約チェックは自身のフェイスのパッケージコンパイルが終わると開始し、残りの成果物ステップと重なる。3 つのコマンドすべてで、`DSH_GATE_CONCURRENCY` が並行ステップを制限し (`1` は依存順に実行する)、`DSH_GATE_FAIL_FAST=1` は最初の失敗で残りのステップを止める。そうでなければ失敗はその依存先のみをスキップするため、独立したエラーはすべて報告される。失敗したステップは自身の出力を表示し、いかなる失敗も client build record を書かずに非ゼロで終了する。

変更が必要とするものによってコマンドを選ぶ:

| 状況 | コマンド |
|---|---|
| パッケージソースを反復し、実行可能な成果物が必要 | `pnpm run build:artifacts`; `dev:web` と `dev:desktop` は起動前にこれを実行する |
| テスト、スクリプト、ベンチマーク、または website のコードを型チェックする | 最新の `build:artifacts` の後に `pnpm run build:check`; パッケージソースが変わった場合は先に `build:artifacts` を再実行する |
| TypeScript 作業の完了を宣言する前 | 最新の `build:artifacts` の後に `pnpm run build:check`、または `pnpm run build` |
| 必須の CI ビルドレーンが実行する完全な検証 | `pnpm run build` |
| Web と Desktop の成果物なしの型チェック | `pnpm run typecheck` |
| Lint またはドキュメントのコードブロックチェック | `pnpm run lint` または `pnpm run doc-typecheck`; それぞれが `host-contracts` を自身で準備する |

PR 成果物ビルダーは `build:artifacts` を実行する。必須の Linux と Windows の通常ビルドおよび公開 `typecheck` は、リポジトリ全体のテストとスクリプトプログラムもチェックする。CI ベンチマークの準備はさらに、使い捨てのライブラリー出力に `--noCheck` を使い、診断はそれらの必須ビルドに頼る。他の成果物ビルダーはパッケージチェックを保つ ([根拠](../.agents/notes/implemented/process/2026-10-05-pr-artifact-typechecks.md))。

両方の tsdown パスは `vendor/*`、`packages/*/*`、`apps/cli` にマッチする。Host パスは `apps/desktop-host` にもマッチする。ビルド成果物をスキャンして Client パッケージを発見することも、Host/Client パッケージのフィルターリストを保守することもない。パッケージローカルの tsdown 設定は `DSH_BUILD_FACE` を通じて現在のフェーズのエントリーを選ぶ: 通常の Client プラグインは Client フェーズ中に Node ローダーとブラウザーバンドルの両方を生成し、`api-remotes` は `hostPhase: true` を使って Host エントリーを早く生成し、Client フェーズではブラウザーバンドルのみを生成する。Tsdown は先行する tsc フェーズが `lib/types` に出力した JavaScript のみを消費する。Tsdown はマッチしたワークスペースメンバーを並行してビルドするため、メインバンドルがワークスペースの devDependencies をその `lib/` 出力からインライン化する `apps/desktop` は、Host パスの後に自身のステップでバンドルする ([Desktop README](../apps/desktop/README.md#bundled-workspace-dependencies))。

Typert は `tsconfig.host.json` をシードとして Host 型を分析し、Host リフレクション成果物と Host-for-Client Remote プロジェクションの両方を生成する。Client tsdown は Typert を起動しない。Host tsdown はそれをプラグインとして実行し、[`generate-typert.ts`](../scripts/generate-typert.ts) はバンドルなしで同じ生成を実行し、バイト単位で同一のファイルを書く。バンドルなしパスはワークスペースパッケージをソースからのみ読み、Host プログラムがパッケージの `lib/` 出力をロードしようとする場合はインポートと追加すべき `paths` エイリアスを名指して失敗するため、Host パッケージコンパイルの隣で実行できる。Client ソースは生成された Remote 宣言をインポートするため、Client パッケージのコンパイルは常に 2 つのパスのいずれかに続く。`pnpm run typecheck` は `build.ts --scope typecheck` グラフを実行する: バンドルなし Typert パスの隣で Host パッケージコンパイル、その後 Client パッケージコンパイル、各集約は自身のフェイスのパッケージがコンパイルされるとビルドモード (`tsc -b`) でチェックされる。ネイティブアドオン、すべてのバンドル、Web、client build record はスキップする。`lint`、`lint:fix`、`doc-typecheck` は生成された宣言を読むが Host 集約チェックは読まないため、Host パッケージコンパイルとバンドルなし Typert パスのみを準備する (`compile-referenced-projects.ts host-contracts`)。これらのコマンドはいずれもバンドルを書かない: 実行可能な `lib/` 出力は最後の `build:artifacts` が残したままの状態にとどまるため、ビルド済み出力を起動またはテストする前に `build:artifacts` を実行する。

`pnpm run build` と `build:artifacts` は、ルートパッケージのバージョン、7 文字のソースコミット、および Git がローカル変更を報告した場合の dirty マーカーを埋め込む。呼び出し元が供給した他の `DSH_CLIENT_*` 値も継承する。`pnpm run build:official` は CI とリリースの成果物ビルドのクロスプラットフォームなローカル同等物であり、ローカルの dirty マーカーを省略する。成功した各 `build` または `build:artifacts` は、正確な公開値を Vite 出力と動的クライアントバンドルに結び付ける gitignore されたレコードを書く。リリースパッキングとビルド済み Web テストは、レコードの欠落または後続の部分ビルドで変わった成果物を拒否する。`pnpm run dev:web` は最初に `build:artifacts` を実行し (`--skip-build` は代わりに既存の成果物ツリーを再利用する)、次に現在のバージョンと Git 状態を一度サンプリングし、その環境をセッション中のすべての watcher ステージで共有する。watcher ステージが記録された成果物を書き換えるため、完全ビルドレコードを検証しない。

静的解析とテストは、ワークスペースインポートを base `paths` マップを通じて `src` に解決し、クリーンなツリーでパスしなければならない。ビルド済み `lib/` 出力を消費するゲートはその依存を明示的に宣言する。生成された Host-for-Client Remote 宣言は意図的な例外である: 公開 `typecheck`、`lint`、`doc-typecheck` コマンドはそれらを最初に生成し、内部の `*:contracts-ready` スクリプトは、呼び出した公開コマンドまたはスケジューラーゲートが Typert contract 生成パスまたは完全ビルドにすでに依存していると仮定する。ゲート準備の contract については [Typert Remote note](../.agents/notes/implemented/architecture/2026-08-02-typert-remote-method-calls.md) を参照。

ビジネスサービスは Host 上で呼び出し可能なメソッドを `@Remote` または `@RemoteScope` で宣言する。Host ビルドは Host-for-Client 型とランタイムコントリビューションを生成し、Client の `api-remotes` コンポジションはそれらのコントリビューションを `ctx.remote` およびスコープ付き `agentCtx.remote` 名前空間の下にロードする。両側の生成成果物、それらの組み立て関係、SRC 開発フォールバック、Web ビルド順については [API Gateway](api-gateway.md) を参照。

関連するローカルチェックがビルド済みパッケージ出力を消費する場合は、先に一度ビルドする:

```sh
pnpm run build
```

`pnpm run hygiene` は `publint` (パッケージエントリーポイントをビルド済み `lib/*.js` ファイルに対して検証する) と `verify-node-next-types` (ビルド済み宣言を一時的な NodeNext コンシューマーに対して検証する) を含む。新しい worktree は `pnpm run build` が走るまでバンドルされた JS や宣言を持たない。通常のコミットとプッシュは、選択されたチェックがそれを消費しない限り、そのビルドを必要としない。

### 環境変数

実際の DeepSeek アダプターとキーを使う agent デモは、環境またはリポジトリルートの gitignore された `.env` から資格情報を読む:

```sh
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://... # optional
```

`DEEPSEEK_BASE_URL` は省略可能で、デフォルトは公開 API である。実際の資格情報をコミットしてはならない。実 API e2e スイートは `DEEPSEEK_API_KEY` が設定されていない場合は自己スキップする。

### Git 統合

`.i18n.yaml` レコードは Git のデフォルトテキストマージを使う。レコードが競合するのは、両方のブランチが同じ見出しセクション内の言語固有コンテンツを変更した場合だけである。Markdown を解決し、`pnpm run verify-translation-pairing --write <pair>` を再実行する。`pre-merge-commit` がそれ以外はクリーンなマージを拒否した場合、Git は完全な結果をコミットなしでステージしたままにする。失敗を修復して `git commit` を実行するか、`git merge --abort` を実行する。

lefthook は高速なローカルチェックポイントとして `lefthook.yml` で構成される:

- `pre-commit` はステージされたペアリングレコードをステージされたオーナーブロブに対して検証し、プロジェクト非依存の `.oxlintrc.staged.json` プロファイルでステージされたファイルを検証して 1 回の制限付き再試行で Oxlint 修正を適用し、ステージされた差分の空白エラーをチェックし、pi-ai プロバイダーメタデータの入力または生成ファイルがステージされている場合にそれをチェックし、vendor マニフェストガードを実行する。
- `pre-merge-commit` は Git が自動マージコミットを作成する前に、同じインデックス裏付けのペアリングチェックを実行する。
- `pre-push` は `pnpm run typecheck` を実行する。これは Client TypeScript チェックの前にバンドルなしで Typert contract を生成し、両方の集約をチェックする。

vendor マニフェストガードは、`vendor/*/src` 配下の変更が一致する `vendor/README.md` マニフェスト更新とともにステージされていることをチェックする。ベンダーコードを編集する前に `vendor/README.md` を参照。

pi-ai チェックは期待メタデータをメモリー内で再生成する。ファイルを書き換えたりステージしたりせずに古いデータを拒否する。pi-ai 依存またはジェネレーターの変更後は、パッケージの [provider metadata update steps](../packages/llm/llm-pi-ai/README.md#generated-provider-metadata) に従う。

スコープ付きのペアリングとプロバイダーメタデータのチェックを除き、フックは意図的にテスト、スナップショット、ドキュメントチェック、ビルド、hygiene を実行しない。コントリビューターは[変更された挙動に関連するチェック](../AGENTS.md#run-relevant-checks-locally)を一度実行する。網羅的なカバレッジ、ビルド済み成果物のスモーク、Node 22.19、24、26 の互換性マトリックスは CI が所有する。

コントリビューターは `pnpm run check:all` で包括的なローカルゲートセットにオプトインできる。このコマンドは Git フックから独立しており、agent 指示ではない。

CI の外 (`CI` が `true` 以外) では、デフォルトのワーカー数は[ローカルワーカー予算](../scripts/parallelism.ts)に従う: ゲートスケジューラー、`build`、`typecheck`、Oxlint、publint には 12、Vitest フォークとローカルカバレッジには 48。`doc-sync`、`test:docs`、`hygiene`、`check:all` は CI でも同様に最大 8 ゲートを同時に実行する。`os.availableParallelism()` はコンテナーの CPU クォータではなくホスト CPU を報告するため、上限なしのデフォルトは共有ホストをオーバーサブスクライブする。CI はランナーの CPU 数を保つ。`DSH_GATE_CONCURRENCY`、`DSH_OXLINT_THREADS`、`DSH_COVERAGE_MAX_WORKERS`、Vitest の `--maxWorkers` がデフォルトを上書きする。

### CI ゲート

キー不要の [CI ワークフロー](../.github/workflows/ci.yml) は独立したゲートを広いレーンにグループ化し、サポートされる Node バージョンにまたがるより小さな互換性シグナルを実行する。成果物コンシューマーは自身のレーン内の 1 回のビルドを待つ。カバレッジパーティションは、設定されたワーカー上限内で作業をバランスさせるために、プラットフォームとランナープールにスコープされたファイルタイミングを再利用する。必須ベンチマークは標準の GitHub ホストの Linux で別途実行される。ルーティングとジョブタイムアウトは[ベンチマークランナーリファレンス](../benchmarks/AGENTS.md)が所有する。別個の実 API ワークフローは、設定されたワーカー上限で `pnpm run test:e2e` を実行する。現在のゲートとジョブのインベントリーについては [scripts/run-gates.ts](../scripts/run-gates.ts) とワークフローファイルを参照。

資格情報不要の dsh 依存レイアウトと dsh/vendor パックのリハーサルは、`DSH_CI_FAILOVER_LINUX=selfhosted` でイベントが信頼された master プッシュまたは同一リポジトリの非フォーク、非 Dependabot プルリクエストである場合にのみ、既存の Linux セルフホストプールを使う。手動ディスパッチを含む他のすべてのケースは `ubuntu-24.04` を使う。手動パブリケーションはホストのままである。永続ストアの分離とフォールバックの制限については[リリースリハーサルランナーリファレンス](../.agents/notes/implemented/process/2026-07-26-ci-failover-runbook.md)を参照。

### 日常のコマンド

ルートの[コントリビューター指示](../AGENTS.md#commands)が一般的なコマンドを要約し、現在のスクリプトとゲートのインベントリーは [`package.json`](../package.json) と [scripts/run-gates.ts](../scripts/run-gates.ts) が所有する。変更されたサーフェスをカバーする最小のチェックを選ぶ。ドキュメント変更は `pnpm run doc-sync` を使う。パッケージ公開の挙動変更は所有する README または JSDoc も更新し、ビルド済み成果物のチェックは先に `pnpm run build` を必要とする。

### プロファイル実行

これらのソースチェックアウトデモを使う前に、リポジトリのビルドを別途実行する:

```sh
pnpm run build
```

単発の Headless コーディングエージェントは環境またはリポジトリルートの `.env` に `DEEPSEEK_API_KEY` を必要とする:

```sh
pnpm dsh --profile headless "summarize this workspace"
```

PTC モードのデモは、コードプレゼンテーションを有効にした同じヘッドレスプロファイルを実行する:

```sh
pnpm run demo:ptc -- "summarize this workspace"
```

### アプリケーションコマンド

Web と Desktop は 1 組のコマンドを共有する。`start:*` は先行する `pnpm run build` または `build:artifacts` の成果物を起動し、`dev:*` は最初に `build:artifacts` を実行してから起動する。Web はさらに、ソース編集時にクライアントバンドルを再ビルドし続ける。Host はソースから実行され、ブラウザーはビルド済みバンドルをロードするからである:

```sh
pnpm run start:web       # serve built Web artifacts through the source launcher (the same launch as pnpm dsh web)
pnpm run dev:web         # build, serve, and rebuild Web client bundles on source edits
pnpm run start:desktop   # launch built Desktop artifacts
pnpm run dev:desktop     # build, then launch Desktop
```

Web コマンドの後に続く引数は `dsh web` に届く。たとえば `pnpm run dev:web --no-open --port 3081` である。`dev:web` はさらに `--skip-build` を受け入れて既存の成果物ツリーを再利用し、`--no-serve` で別の場所で起動されたサーバーの隣で再ビルド watcher のみを実行する。両方の Web コマンドは通常の Harness home を使い、Desktop コマンドは [Desktop README](../apps/desktop/README.md) に記載された分離された開発 home を使う。ルートの `Makefile` は同じコマンドを `make web`、`make dev-web`、`make desktop`、`make dev-desktop`、`make build` として名付ける。`ARGS='--no-open'` がオプションを転送する。

### TODO マーカー

コード内の既知の問題に印を付けるには、緊急度順に並んだ 3 つのコメントタグのいずれかを使う:

- `FIXME` — 新リリースをブロックすべき問題。レビュアーがその変更をそれでもマージしてよいと明示的に同意しない限り、リリースは未解決の `FIXME` を抱えて出荷すべきでない。
- `TODO` — リソースが得られ次第、早く修正すべき問題。
- `XXX` — いつか修正するかもしれない問題。最低優先度で、コミットメントはない。

コードを走査する誰もがリリースブロッカーと「いつかやるかも」を区別できるよう、緊急度に一致するタグを選ぶ。

### 型の逐語的文書化 (`ts type-equiv`)

[subsystems](subsystems/README.md) ページは、ソース等価の宣言を元の JSDoc とともに貼り付け、読者が正確な型定義とソース contract を見られるようにする。ソース変更時に貼り付けがドリフトしないように、` ```ts type-equiv ` (` ```ts ` の代わり) としてフェンスし、`scripts/type-equiv.manifest.json` にミラーするソースファイルとシンボルを登録する:

```json
{ "doc": "docs/subsystems/session.md", "symbol": "SessionEvent", "source": "packages/core/session/src/types.ts" }
```

`pnpm run verify-type-equiv` (`doc-sync` の一部) は、TypeScript パーサーを通じてソースからそのシンボルの宣言と付随する JSDoc を抽出し、ブロックが両方にマッチすることを表明する。実装本体がカタログに属さないクラスには、` ```ts public-api ` を使い、`"projection": "public-api"` を設定する。チェックされるプロジェクションは公開フィールド、コンストラクター、アクセサー、メソッド、元のクラス/メンバー JSDoc を保ち、本体と private または protected メンバーを省略する。比較は空白と JSDoc 以外のコメントを無視するが、メンバー文書を含むすべての元の JSDoc コメントを要求するため、読者は正確な型定義の隣でソース contract を見る。ゲートは、プライマリブロックとマニフェストエントリーの間に、文書、シンボル、プロジェクションによる 1:1 の対応を強制する。ペアの `.zh.md` ブロックは、追跡されたフェンス列全体がバイト単位で同一で同順である場合にのみ、サフィックスのない兄弟のエントリーを再利用する。`doc-typecheck` は同じ派生ルールをコンパイル可能なフェンスに適用しつつ、両方のソース等価フェンス種別をコンパイルとそのオプトアウト比率からスキップする。文書化された宣言またはその JSDoc を変更した場合、貼り付けを更新するまでゲートは失敗する。プライマリブロックを追加または削除した場合は、同じ変更でマニフェストを更新する。
