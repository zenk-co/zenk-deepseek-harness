# deepseek-harness-runtime-bin

日本語 | [English](README.en.md) | [中文](README.zh.md)

DeepSeek Harness Python SDK 用のプラットフォームランタイム wheel。通常の `dsh` CLI とその閉じた Node 依存ツリーをネイティブ実行ファイルにパッケージングするため、SDK の利用にシステムの Node.js は不要である。このパッケージは wheel のみを公開する。

## インストールされるコマンドと成果物

wheel は `dsh` コンソールコマンドと `deepseek_harness_runtime` Python モジュールをインストールする。`dsh` は引数を同梱の実行ファイルに転送し、空でない `DSH_HOME` を要求する。`~/.dsh` にはフォールバックしない。

本番実行ファイルは、モジュールの `runtime/` ディレクトリ配下で `deepseek-harness-sdk-runtime-<platform>-<arch>` と命名される。Windows では `.exe` サフィックスを使用する。Linux と macOS の wheel にはターゲットネイティブの `-rg` サイドカーが含まれ、Windows には `-rg.exe`、macOS にはさらに `node-pty` 用の `-spawn-helper` が含まれる。公開ターゲットは Linux x64、Linux arm64、macOS arm64、macOS x64、Windows x64 である。wheel タグとペイロードは正確に一致しなければならない。Windows arm64 の wheel は公開されない。

wheel が含むのは、実行ファイル、ネイティブ実行ヘルパー、および `downloads.json` と軽量な `office-skills/` ツリーを含む `<platform>-<arch>/` のみである。CPython、authoring ライブラリ、スタンドアロン Node、pnpm、完全な Office サイドカーはオプションのダウンロードである。Python モジュールのインポート、SDK プロファイルの起動、Office ファイルの処理がリソースをダウンロードすることは決してない。

いずれのリソースも、使用前に明示的にダウンロードする:

```py
from deepseek_harness_runtime import download_office, download_primary_runtime

office = download_office()
primary_runtime = download_primary_runtime()
```

`download_office()` は、ロックされた npm Kit、ターゲットエンジン、完全な依存ツリー、および Kit CLI 用のスタンドアロン Node をダウンロードする。`download_primary_runtime()` は、CPython、ロックされた Python ライブラリ、Node、pnpm、Office スキルを独立してダウンロードする。どちらも絶対リソースディレクトリを返し、完了済みキャッシュを再利用する。authoring のダウンロードは、戻る前にターゲット、インタープリター、ライブラリディレクトリ、スキルを検証する。既存のローカル `installPrimaryRuntime()` 操作は、利用可能なペイロードをコピーするだけで、ダウンロードは行わない。共有ビルダーは [NumPy/pandas テストファイルの除外](../../apps/desktop/README.md#bundled-workspace-dependencies)を適用する。

`DSH_RESOURCE_CACHE` は絶対キャッシュルートを選択し、デフォルトは `~/.cache/deepseek-harness/resources` である。リソース ID にはリリースのロックされた入力が含まれる。ダウンロードはアーカイブのハッシュとパッケージ ID を検証し、実行権限を保持し、完了したディレクトリをアトミックに公開する。失敗したダウンロードは再試行できる。`DSH_RESOURCE_DOWNLOAD_TIMEOUT_MS` は各アーカイブのダウンロード(ボディを含む)を制限する。デフォルトは `300000` で、受け付けられる値は `1` から `2147483647` の整数である。ダウンロードは Harness のプロキシ環境ポリシーに従う。インストール済みの wheel ファイルが変更されることはない。リリースバージョンごとに別々のキャッシュディレクトリを持ち、未使用バージョンの削除は手動で行う必要がある。ダウンロードはロックされた上流 URL を使用し、レジストリやミラーのオーバーライドはない。

以降の起動時、同梱のブートストラップはダウンロード済みリソースを SDK プロファイルに公開する。`DSH_PRIMARY_RUNTIME` はキャッシュされた authoring 環境をオーバーライドし、空の値はそのクエリを無効にする。`DSH_OFFICE_SIDECAR` は、スタンドアロン Node を含む絶対サイドカーディレクトリを選択できる。ユーザーは authoring 環境をダウンロードせずに独自の Python 環境とドキュメントライブラリを提供できる。Office スキルは、どちらかのリソースが選択されている場合に利用可能になる。authoring 専用のデプロイでは、Kit CLI を無効にしてスキルが公開される。外部の authoring ペイロードは `primary-runtime/` と隣接する `office-skills/` のレイアウトを維持する。SDK はリソースを `DSH_HOME` にコピーせず、その場で読み取る。`sdk-minimal` プロファイルはこれらのプロバイダーをマウントしない。

スキルの選択はデリバリーから独立している。プロジェクト、カスタムディレクトリ、ユーザーファイルシステムのスキルは、同名の同梱スキルをオーバーライドする。SDK パッチは、Python クエリを維持したまま Office プロバイダーのみを無効にできる:

```yaml
- id: skill-office
  disabled: true
```

Office 操作スキルは、プロファイルのシェルコマンドを通じて設定された Node と Kit CLI を呼び出す。コマンドの選択とスキルコレクションの置き換えについては [Office プロバイダー](../../packages/skill/skill-office/README.md#use-this-package)を参照。設定パッチはプロセス起動時に適用される。スキルの変更にランタイム wheel や Python 環境の再ビルドは不要である。

リポジトリのビルドでは、開発専用の `runtime/node/` キャリアも生成される。これはシステムの Node 22.19 以降で `node runtime/node/runtime-bootstrap.mjs` を実行する。自動的に選択されることはなく、wheel と sdist からは除外される。

両方のキャリアは同じ `dsh` 文法と出荷されるプロファイル(スタンドアロンの `sdk-minimal` ツリーや、フロントエンドアセットを含む完全な `web` プロファイルを含む)を実行する。プライベートな `dsh-python-runtime-closure` マニフェストがパッケージ化される依存クロージャを定義する。Python 固有の Node アプリケーションやチェックインされたデフォルトの `cordis.yml` は存在しない。

## Python モジュール API

- `bundled_package_dir() -> Path` はインストール済みモジュールデータのルートを返し、そのリリースメタデータを検証する。
- `bundled_runtime_path() -> Path` は現在のプラットフォームの実行ファイルを返し、必要なサイドカーを検証する。
- `resolve_bundled_launch_args(mode=None) -> tuple[str, ...]` はデフォルトで実行ファイルの argv を返す。明示的な `mode="node"` または `DSH_RUNTIME_MODE=node` はリポジトリ専用の Node キャリアを選択する。
- `download_office() -> Path` は Office サイドカーとそのスタンドアロン Node を明示的にダウンロードまたは再利用する。
- `download_primary_runtime() -> Path` は authoring 環境を明示的にダウンロードまたは再利用する。
- `resolve_office_launch_args() -> tuple[str, str]` はダウンロードせずにインストール済みの Node と Kit CLI を探す。リソースがない場合はダウンロード手順を含む `FileNotFoundError` を送出する。
- `main()` はインストール済みの `dsh` コンソールコマンドを実装し、`DSH_HOME` が存在しない場合または空白の場合は拒否する。Windows では標準ストリームを継承して同梱プロセスを待機し、その終了ステータスを転送する。POSIX では Python プロセスを置き換える。

サポートされないプラットフォーム、および実行ファイルやサイドカーがない場合は、ビルドとインストールの手順を含む `FileNotFoundError` を送出する。不明なランタイムモードは `ValueError` を送出する。

## パッケージ化されたプロファイルの解決

`dsh` は明示された home の下で出荷プロファイルを初期化し、そのバンドルパッチを構成し、実行ファイルの仮想ファイルシステムから同梱プラグインをロードする。ランタイム解決は、ディスク上のシンボリックリンクやプロキシパッケージの代わりに、インメモリの世代を使用する。フォールバックインポートは、実行ファイルの仮想ファイルシステム内のパスを含む、記録された宣言元パッケージのパスを使用するため、組み込みの行と外部プラグインのピアが同梱の Cordis/モジュールインスタンスを共有する。ネイティブ共有ライブラリと Windows ConPTY アドオンはネイティブアドオンとしてパッケージ化され、ripgrep と macOS の PTY ヘルパーは実行可能サイドカーのままである。

Python と同梱のブートストラップはリソースレイアウトを共有する: `<cache>/<identity>/office/`、`node/bin/node[.exe]`、`node_modules/@deepseek-ai/libreoffice-kit/lib/cli.js`。Office キャッシュの自動検出には、`complete` マーカーがマニフェスト ID と一致することが必要である。明示的な `DSH_OFFICE_SIDECAR` には Node と CLI のファイルが必要である。Python ブートストラップは、明示的にダウンロードまたは選択されたサイドカーから Office kit を解決するため、ネイティブヘルパーと URL Worker は実際のファイルシステムパスを使用する。同じリソース準備の実装が、リポジトリのビルドと明示的な Python ダウンロードの両方に使用される。kit はドキュメント操作を所有する。Office スモークテストは、ロードされたスキルから CLI パスを取得し、空の PATH でケイパビリティと DOCX 変換を実行する。

外部プロファイルの管理には `dsh plugin --profile <name> ...` を使用する。このコマンドは `PATH` 上の `pnpm` を必要とするが、通常の SDK/プロファイル実行には必要ない。

## ビルドと配布

本番デプロイでは、ランタイムクロージャ外のパッケージに対する未使用のワークスペースパッチが許可される。含まれるパッケージのパッチは引き続き正常に適用されなければならない。この例外は deploy コマンドに限定され、リポジトリのインストールは未使用のパッチを依然として拒否する。

リポジトリルートから `pnpm exec tsx scripts/build-exe-for-python-sdk.ts` を実行すると、クロージャの検証、パッケージのビルド、シンボリックリンクなしツリーのデプロイ、選択されたターゲットのパッケージング、実行ファイルとサイドカーのこのモジュールへの同期を行う。パッケージ化されるのはターゲットプラットフォームの PTY プリビルドのみである。パッケージ README、CHANGELOG、HISTORY の Markdown、ソースマップ、ランタイムアセット外の TypeScript 宣言は省略される。デプロイはワークスペースのホイスティングを無効にし、パッケージングはチェックアウトの依存関係とデプロイ外のワークスペースソースツリーを除外するため、依存関係スキャンが開発パッケージをペイロードに追加することはない。ステージングは、同じ pnpm 依存 ID を持つネストされたコンシューマーとルートワークスペースパッケージを共有し、異なるピア解決を維持しつつシングルトンサービスを保つ。`scripts/build-python-release.py` は、リポジトリルートのバージョンでリリース形式の wheel をステージングし、`deepseek-harness-sdk` を正確なランタイムバージョンに固定する。

インストール済み wheel のスモークテストは、チェックアウト外にクリーンな仮想環境を作成し、インストール済みディストリビューションと実行ファイルの同一性を証明したうえで、デフォルトおよびカスタマイズされた SDK プロファイル、外部プラグイン、MCP、ネイティブツール、直接の JSON-RPC、コミット済みスナップショット、信頼された実行での実際のプロバイダーを試す。その Office シナリオは、軽量なターゲットペイロードを移動し、サイドカーを明示的にダウンロードし、必要なプラットフォームエンジン(ターゲットが宣言したネイティブエンジン、ネイティブエンジンが宣言されていない場合は WASM)で DOCX を変換する。[Python コントリビューターワークフロー](../development.md)と[インストール済み wheel テストの決定](../../.agents/notes/implemented/testing/2026-08-23-installed-python-wheel-black-box-ci.md)を参照。
