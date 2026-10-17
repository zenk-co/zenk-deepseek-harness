---
description: "Desktop インストーラーをローカルまたは Windows / macOS Actions でビルドし、デプロイと署名モードを選択して、成果物と診断を取得する。このガイドはビルド操作を公開やインストール済みアプリケーションの適格性確認から分離する。ハードウェア資格情報を使う前に、プラットフォームの署名詳細と共有ランナーのリスクを確認すること。"
---

# Desktop パッケージング

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Desktop インストーラーをローカルまたは Windows / macOS Actions でビルドし、デプロイと署名モードを選択して、成果物と診断を取得する。このガイドはビルド操作を公開やインストール済みアプリケーションの適格性確認から分離する。ハードウェア資格情報を使う前に、プラットフォームの署名詳細と共有ランナーのリスクを確認すること。

## 目次

- [ビルドパスの選択](#choose-a-build)
- [リリースバージョン](#release-versions)
- [構成とローカルビルド](#configuration-and-local-builds)
- [Windows Actions パッケージング](#windows-actions)
- [macOS セルフホストパッケージング](#macos-actions)
- [未署名 Windows テストインストーラー](#unsigned-windows-test-installer)
- [リリース署名なしのローカル macOS DMG](#local-macos-dmg-without-release-signing)
- [macOS リリース署名と診断](#macos-release-signing)
- [ディレクトリビルドと準備](#directory-and-preparation)
- [ループバックレジストリからのローカル Official バンドル](#local-official-bundles-from-a-loopback-registry)
- [ランタイムファイル選択とインストールチェック](#runtime-file-selection)
- [Desktop ランタイム準備](#desktop-runtime-preparation)
- [インストールとリリース検証](#verification)

<a id="choose-a-build"></a>

## ビルドパスの選択

ロック済み依存関係をインストールした後、リポジトリルートでローカルコマンドを実行する。ローカルビルドにはプラットフォーム別のコマンドを使い、登録済みセルフホストランナーにはプラットフォーム別の Actions を使う。テストまたは production のデプロイは、署名あり・署名なしモードとは独立に選択する。Windows の署名付きビルドや共有ランナーの利用の前には [Windows 署名とランナーの運用](../windows-signing/README.md#trust-and-isolation)を読むこと。インストールはパッケージングとは別であり、[公開](../publishing/README.md)はさらに明示的な操作である。

<a id="release-versions"></a>

## リリースバージョン

Desktop パッケージングを実行する前に、まず現在のユーザーと完全なバージョン文字列を確認する。選択されたデプロイ、dsh ベースバージョン、保持されているリリースレコード、公開済みオブジェクトを確認し、正確なバージョンを提案して承認を得る。そのバージョンがユーザーに確認されるまでパッケージングを開始しないこと。デプロイ設定だけではバージョン選択を承認したことにならない。

現在の dsh バージョンをベースとして記録する。production の Desktop リリースは、`alpha`、`beta`、`rc` 識別子を含めてその正確なバージョンを使う。テストリリースは完全なプレリリースベースを保ったまま `.YYYYMMDD.index` を追加し、安定ベースの場合は代わりに `-test.YYYYMMDD.index` を使う。

| dsh ベース | Production Desktop | Test Desktop の例 |
|---|---|---|
| `0.1.6-alpha.1` | `0.1.6-alpha.1` | `0.1.6-alpha.1.20260916.1` |
| `0.1.6-beta.2` | `0.1.6-beta.2` | `0.1.6-beta.2.20260916.1` |
| `0.1.6-rc.3` | `0.1.6-rc.3` | `0.1.6-rc.3.20260916.1` |
| `0.1.6` | `0.1.6` | `0.1.6-test.20260916.1` |

実際の作成日を Asia/Shanghai で使う。各ベース・各日付についてインデックスは 1 から始め、保持されているリリースレコードと公開済みオブジェクトを確認してから増やす。公開済みバージョンを再利用しないこと。テスト配布では対応するサフィックスなしベースを公開しない。

手動の Desktop CI は別個の未公開ビルド識別子を使う。`auto` は UTC 日付、ワークフロー実行番号、試行回数を追加する（`.YYYYMMDD.run.attempt`。安定ベースでは `-test` を付ける）。例: `0.2.1-alpha.1.20261008.42.2`。これらの番号は予約済みリリース連番ではない。

確認済みバージョンを `--build-version` としてパッケージングコマンドに渡す。この値は成果物名、更新フィード、アップロード検証に単一の値として届く。マニフェストは製品バージョンを保持するため、テストビルドがリリースファミリーを書き換えることはなくなり、 revert すべき変更も残らない。

```sh
pnpm --dir apps/desktop run package:win:x64 --build-version 0.1.6-alpha.1.20260916.1
```

`--build-version auto` は今日の次のインデックスを提案する。宛先バケット内の公開済みオブジェクトを読み、バケットが未構成の場合や一覧が期限内に完了できない場合はこのターゲットのローカル出力ディレクトリにフォールバックする。アップロードの前に表示された提案を確認すること。run スクリプトは `--` を独自に転送し、パッケージング入口はどちらの書き方も受け付ける。

production リリースは製品バージョンを公開し、`--build-version` を取らない。これをアップロードすると、成果物が公開された後にパッケージ化したコミットへ `desktop-v<version>` のタグが付けられる。変更のあるチェックアウトからのビルドにはタグを付けず、タグ付けの失敗は完了済みアップロードを失敗させずに手動実行用のコマンドを表示する。テストビルドとローカルビルドには意図的にタグを付けず、すべての成果物はマニフェストに `dshBuildCommit` と `dshBuildDirty` を記録するため、直接受け渡したビルドも追跡可能である。

インストーラーはバージョンやデプロイとは独立に `DSH_DESKTOP_UPDATE_CHANNEL` を埋め込む（既定は `nightly`、`latest` も可）。安定バージョンでも自動更新はそのチャネルに留まり、もう一方のチャネルを手動インストールすると切り替わる。latest パッケージはプレリリースバージョンを拒否する。安定製品は nightly の `-test.<date>.<sequence>` ビルドを生成できるが、そのバージョンは安定ベースより低く評価され、既にインストールされた上位バージョンをアップグレードできない。自動ダウングレードは無効のままにし、安定の修正リリースには製品バージョンのバンプが必要である。CI のバージョン選択と公開は [CI 公開](../publishing/ci/README.md#package-and-publish)に記載されている。

<a id="configuration-and-local-builds"></a>

## 構成とローカルビルド

ローカル Windows コマンド用に、`DSH_PACKAGING_CONFIG_DIR` へマシン構成ディレクトリの絶対パスを、`DSH_PACKAGING_PRESET` へ `test` または `production` を設定する。ローダーは `presets/<preset>.env` を読み、署名付きコマンドはさらに `secrets/windows-signing.env` を読む。相対の証明書パスと SignTool パスは、それを宣言したファイルの隣を基準に解決される。公開プリセットは資格情報を拒否し、署名ファイルは公開設定を上書きできない。構成が欠けている場合は `.env.windows` へのフォールバックなしに失敗する。プリセットなしのコマンドは従来の dotenv 動作を保つ。未署名プリセットと準備専用プリセットは署名ファイルを一切読まない。キャッシュメンテナンスも公開プリセット設定のみを読む。テスト署名付きパッケージはさらに既存のダウンロードオリジンとリリース ID を要求するが、アップロード資格情報は不要である。`--build-version auto` 付きのローカルプリセットコマンドはローカル成果物のみから採番し、Actions は実行番号と試行回数を使う。

両方の手動パッケージングワークフローは `test_release_id` を受け付ける。空欄ではマシンプリセットを使い、空でない値は 32 文字の小文字 16 進数でなければならず、テストプリセットを要求する。ローダーはプリセットファイルを変更せず、`PACKAGE_TEST_RELEASE_ID` を通じて適用する。そのプラットフォームで連続するアップグレードテストには同じ値を使い続けること。既定値のローテーションは将来のビルドにのみ影響する。インストール済みクライアントは元の更新アドレスを保持し、古いオブジェクトは別途削除されるまでアクセス可能である。ランダムなプレフィックスは推測しにくくするが、ダウンロードを認証するものではない。

マシンプリセットモードの外では、パッケージング、アップロード、手動 macOS 署名検証（ローカル未署名 macOS ビルドを除く）は対象プラットフォームに応じて `apps/desktop/.env.windows` または `.env.macos` を読む。[Windows テンプレート](../.env.windows.example)または [macOS テンプレート](../.env.macos.example)をコピーしてローカル設定を記入する。Git は両ローカルファイルを無視し、パッケージ成果物もそれらを含まない。リリースフィールドは選択された構成ファイルからのみ取得し、システム変数やシェル変数へのフォールバックはない。`PATH`、プロキシ、ビルドツール設定は引き続き継承される。公開バージョンはリリースフィールドではなく引数であり、アップロードはパッケージング実行が書き込んだ完了レコードから読み取る。ファイルは BOM 付き可の UTF-8 を使い、相対の証明書・SignTool・Apple API キー・キーチェーンパスは `apps/desktop` を基準に解決され、値はシェル展開されず、`#` や空白を含むパスワードには引用符が必要である。Windows CI も同じマシンプリセットを読む。

各パッケージコマンドは、ビルドやダウンロードの前にアプリケーション ID とモード別の更新・署名構成を確認し、次に実行で使う外部ツールを調べる。アーカイブリーダーと、Windows ターゲットではインストーラーコンパイラである。macOS は ID、Team ID、完全な公証戦略 1 式、読み取り可能なローカル `CSC_LINK` p12 ファイル、明示的な `CSC_KEY_PASSWORD`、参照された API キーとキーチェーンファイルを確認する。Windows は公開コード署名証明書、SignTool ファイル、コンテナー名、PIN 形式を確認する。Windows の準備専用ビルドと両プラットフォームの明示的未署名ビルドは署名資格情報を要求しない。構成チェックは PIN の認証、トークンへのログイン、キーチェーンのアンロック、Apple への問い合わせを行わず、実際の署名と公証がそれらを確認する。マシンプリセットなしでは `--check` 下も含めて `--build-version auto` が宛先バケットに問い合わせる。同じチェックを個別に実行する。

```sh
pnpm --dir apps/desktop run check:package
```

`prepare:desktop` は前提条件ではない。

```sh
pnpm run package:desktop
```

リリース自動化は固定ターゲットコマンドを使うため、ランタイム準備、dsh 準備、electron-builder が同じプラットフォームとアーキテクチャを受け取る。

```sh
pnpm run package:desktop:mac:arm64
pnpm run package:desktop:mac:x64
pnpm run package:desktop:win:x64
```

macOS arm64 コマンドは Apple Silicon を要求する。macOS x64 コマンドは Intel macOS または Rosetta 付き Apple Silicon で実行する。Windows x64 コマンドは Windows x64 を要求する。Linux はサポートされた Desktop リリースターゲットではない。

リリースとローカル未署名の両 macOS DMG は [electron-builder 構成](../scripts/electron-builder-config.mjs)で LZMA 圧縮（`dmg.format: 'ULMO'`）を使う。固定ビルダーの検証と TypeScript 宣言にこの形式を追加するのが[ビルド時パッチ](../../../patches/app-builder-lib@26.17.0.patch)である。

各ターゲットは、パック済みパッケージ入力、準備済みランタイム、パッケージ集合、dsh ツリー、pnpm 準備状態、展開済みアプリケーション、更新メタデータ、最終成果物を `apps/desktop/.desktop-build/targets/<target>/` 配下に所有する。Electron アーカイブキャッシュは `.desktop-build/downloads` 配下で共有されたままである。すべてのアーカイブ名がバージョン・プラットフォーム・アーキテクチャを含み、展開前に検証されるためである。ターゲットビルドが別ターゲットの可変な準備状態を使うことはない。

<a id="windows-actions"></a>

## Windows Actions パッケージング

監督付きランナー起動と復旧については [Windows ランナーマシンセットアップ](../windows-signing/README.md#machine-setup)に従うこと。

`Package Desktop · Windows` [手動ワークフロー](../../../.github/workflows/windows-package.yml)は専用 Windows x64 ランナーラベル `dsh-win-package-trial` とマシンプリセット `test` または `production` を選択する。`signed`（既定）または `unsigned` を選択する。署名ありモードは既存の EV トークンプリフライト、署名キャッシュ、障害インターロックを使う。リリースの公開やアップロードは行わない。`build_version` は既定で `auto` であり、[リリースバージョン](#release-versions)の CI 識別子を使う。明示値はチェックアウトの製品バージョンか、製品 `0.2.1-alpha.1` に対する `0.2.1-alpha.1.20261009.1` のような拡張ビルドバージョンでもよい。バージョンのプレフィックスは選択したチェックアウトと一致しなければならず、検証エラーは現在の例を示す。マニフェストは変更されない。

Actions でワークフローを選択し、ソースブランチ、プリセット、署名モード、バージョンを選んで Run workflow をクリックする。入力変更をマージする前に、プッシュ済みブランチを `gh workflow run windows-package.yml --ref <branch> -f preset=test -f signing=unsigned -f build_version=auto` でテストし、マージ後に Web フォームを確認する。push や PR トリガーはない。ログと成功した EXE は 14 日間保持される。パッケージングを信用する前に保持されたログとインストーラーを検査すること。インストールは別である。チェックアウトの前に、Node は依存関係ジャンクションをたどらずにランナー所有のソースディレクトリを削除する。ワークフローはその場所を検証し、リンクされた祖先を拒否する。開発用チェックアウトを指定しないこと。実行は 1 つの同時実行グループを共有し、実行中のビルドを取り消さない。保留は 1 件のみ残り、新しいディスパッチが置き換える。診断のアップロードは成功したクリーンチェックアウトを要求する。マシン設定はチェックアウトの外に留まり、成果物としてアップロードされることはない。

完了した実行を Actions で開き、Artifacts をダウンロードする。`windows-x64-signed-<version>-<run_id>-<run_attempt>` と `windows-x64-unsigned-<version>-<run_id>-<run_attempt>` は対応する EXE を含み、`windows-package-logs-<run_id>-<run_attempt>` はパッケージング診断を含む。アップロードステップは `Retain verified signed installer`、`Retain verified unsigned installer`、`Retain packaging diagnostics` であり、ステップ所要時間とタイムスタンプ付きログがアップロード時間を示す。これらの成果物は Release でもダウンロードサイト公開でもない。

<a id="macos-actions"></a>

## macOS セルフホストパッケージング

`Package Desktop · macOS` [手動ワークフロー](../../../.github/workflows/macos-package.yml)は Apple Silicon ランナー（ラベル `dsh-mac-package-trial`）を対象とする。`test` または `production` を選択し、`build_version=auto` を UTC 日付・実行番号・試行回数から解決し、既存の署名・公証・パッケージ済みランタイムチェックを使う。成功した DMG/ZIP と診断ログは 14 日間保持される。このワークフローはリリースを公開しない。オペレーターはランナーを登録し、完全な Actions 実行を検証してからパッケージングを信用しなければならない。

`node apps/desktop/scripts/setup-macos-packaging.mjs "$HOME/dsh-ci"` を実行して、既存ファイルを上書きせずにプライベートな `runner/`、`packaging/{presets,secrets,certificates}`、`cache/macos-signatures` ディレクトリを準備する。`--check` を追加すると検査のみ行う。チェックアウトの外で[プリセット](../config/macos-packaging/test.env.example)と[署名](../config/macos-packaging/macos-signing.env.example)のテンプレートを記入する。シークレットと証明書ファイルはモード `0600` にする。`DSH_PACKAGING_CONFIG_DIR` は絶対 `packaging` ディレクトリを選択し、`DSH_PACKAGING_PRESET` はそのプリセットを選択する。ファイルが欠けている場合は `.env.macos` へのフォールバックなしに失敗する。署名付きと準備専用の Mac ビルドは `secrets/macos-signing.env` を読む。相対資格情報パスはそのファイルの隣を基準に解決される。公開プリセットは署名資格情報を拒否し、署名ファイルは公開設定を上書きできない。ローカル未署名 Mac ビルドは従来の構成なし動作を保つ。

`bash apps/desktop/scripts/start-macos-packaging-runner.sh "$HOME/dsh-ci/runner" "$HOME/dsh-ci/packaging" <absolute-node-24-bin-directory> --check` を実行してホストツールと構成ファイルを確認する。スクリプトはアクティブな Xcode とその macOS SDK を一体で選択し、小さなリンカープローブをコンパイルする。登録後は `--check` を外してフォアグラウンドで実行する。継承環境をクリアし、ランナー存命中はアイドルスリープを抑止する。以下のサービスをインストールする前に Ctrl-C で停止する。ランナーは開発日常とは別の `_work` チェックアウトを所有する。アカウントは署名ファイルを読めるため、信頼できるコードのみを実行すること。既存の公証プロキシ復元規則が適用され、強制終了後は保持された復旧レコードを検査してから次のビルドを行うこと。新規セットアップテンプレートは `DSH_DESKTOP_MACOS_SIGNATURE_CACHE_DIR` をチェックアウト外の絶対 `cache/macos-signatures` ディレクトリに設定する。既存インストールではセットアップを再実行し、各プリセットにそのフィールドを追加する。既存ファイルは保持される。これによりクリーンチェックアウトを跨いで署名を保持する。キャッシュ検証と上限は [macOS 署名](#macos-release-signing)に記載されている。


`skip_notarization` ワークフローオプションの既定は `false` であり、同等の CLI フラグは `--skip-notarization` である。Developer ID 署名、DMG 署名検証、パッケージ済みランタイム検証は保持し、Apple 公証とステープルを省略して Apple 公証資格情報を要求しない。DMG/ZIP ファイル名には `-unnotarized` が付き、`.desktop-build/targets/<target>/unnotarized-artifacts/` 配下に保存され、`unnotarized-debug` ラベルでアップロードされる。これらの成果物は内部デバッグ専用である。ダウンロードしたコピーは Gatekeeper にブロックされる場合があり、配布や更新公開の適格性はない。リリース完了レコードは書き込まれない。このフラグは未署名ビルド、Windows ビルド、準備専用ビルドを拒否する。

ユーザーサービスは、ランナーを登録したのと同じアカウントで、チェックアウトから `sudo` なしでインストールする。

```sh
bash apps/desktop/scripts/macos-runner-service.sh install "$HOME/dsh-ci/runner" "$HOME/dsh-ci/packaging" /opt/homebrew/opt/node@24/bin
bash apps/desktop/scripts/macos-runner-service.sh start "$HOME/dsh-ci/runner"
bash apps/desktop/scripts/macos-runner-service.sh status "$HOME/dsh-ci/runner"
```

インストーラーは起動スクリプトを `runner/dsh-service` へコピーし、サービス PATH を Node 24 とシステムツールに設定し、GitHub の `svc.sh` と `runsvc.sh` を使う。LaunchAgent は SSH 切断後も存続するが、再起動後はそのアカウントのデスクトップログインが必要であり、デスクトップログアウトで停止する。FileVault のディスクアンロックは引き続きオペレーター手順であり、無人ブートは提供しない。ログは `runner/dsh-service/stdout.log` と `stderr.log` であり、`Connected to GitHub` と `Listening for Jobs` を確認する。インストール済み起動コードやツールパスを更新するには、ランナーがアイドルになるのを待って `stop` から `uninstall` を実行し、再インストールする。どちらの操作もランナーの登録解除やパッケージング資格情報の削除は行わない。アンインストールは `runner/dsh-service`（ログを含む）と明示的 `.path` を保持し、再インストールは起動スナップショットと PATH を置き換える。

<a id="unsigned-windows-test-installer"></a>

## 未署名 Windows テストインストーラー

Windows x64 では、ローカルインストールテストに完全な未署名パッケージングコマンドを使う。

```sh
pnpm run package:desktop:win:x64:unsigned
```

このコマンドは `.env.windows` を読み、`DSH_DESKTOP_APP_ID` と実際の HTTPS サービスオリジンを含む[必須更新ポリシー設定](../README.md#mandatory-update-policy)を要求する。ローカル実行と CI は Node 24 を使い、残りのツールはルート `packageManager` バージョンの pnpm、Git、PowerShell、tar、Python、Visual C++ Build Tools、Windows SDK である。`PATH` に Python がなければ `PYTHON` を設定する。インストーラーを `.desktop-build/targets/win-x64/unsigned-artifacts/` に書き込み、通常の自動更新構成を省略し、署名資格情報を除去し、リリース完了レコードを作成しない。EV とアップロードの資格情報は不要である。署名付きパッケージングとアップロードは引き続きリリース要件を保持する。

`pnpm install --frozen-lockfile` を実行し、次に `pnpm run package:desktop:win:x64:unsigned --check` を実行して、上記の完全コマンドの前に構成とツールチェーンを検証する。パッケージングは独自の完全ビルドと隔離されたランタイムスモークをオンラインモデルなしで実行する。ステージログは `.desktop-build/packaging-runs/` 配下に残り、ビルド成功だけではインストーラーの適格性は確立しない。依存関係インストールとランタイム準備は npm、GitHub リリースアセット、nodejs.org へのアクセスを必要とし、ネットワークが要求する場合は既存のレジストリとプロキシ構成を使うこと。キャッシュとツール配置はビルドマシンに属し、追跡される個人パスではない。

<a id="local-macos-dmg-without-release-signing"></a>

## リリース署名なしのローカル macOS DMG

`pnpm install` の後、リポジトリルートで 1 つのコマンドを実行する。`.env.macos`、Apple アカウント、証明書、更新サービス構成は不要である。

```sh
pnpm run package:desktop:mac:arm64:unsigned
pnpm run package:desktop:mac:x64:unsigned
```

`--check` を追加するとビルドせずにローカル構成とツールのみ検証し、`--dir` を付けると展開済みアプリケーションで停止する。DMG は `apps/desktop/.desktop-build/targets/<target>/unsigned-artifacts/deepseek-harness-<version>-mac-<arch>-unsigned.dmg` である。すべてのチェック通過後、コマンドは `DMG:` に続けて絶対パスを表示する。それを開き、アプリケーションをローカルテストディレクトリへコピーする。

これらのコマンドは `.env.macos` と継承されたリリース設定を無視し、アプリ ID に `com.deepseek.harness` を使い、自動更新と必須更新の構成を省略する。ビルドツール、標準ネットワークプロキシ、`DSH_DESKTOP_NPM_REGISTRY` は引き続きシェルから利用できる。Developer ID 署名、Apple 公証、一時署名キーチェーン、公証プロキシ変更をスキップする。変更済み実行可能ファイルが動作するよう、Electron には証明書なしのローカルアドホック署名が付与され、DMG は未署名である。準備と組み立て済みアプリケーションは引き続きランタイム完全性とスモークのチェックを実行する。ローカルビルドは更新フィード、ZIP、リリース完了レコードを省略し、アップロードコマンドはそれらを公開できない。公証されていないアプリケーションを開くには、システム設定 → プライバシーとセキュリティでの承認が macOS で要求される場合がある。

<a id="macos-release-signing"></a>

## macOS リリース署名と診断

署名付き macOS 構成は、キーチェーン内で最初に見つかった証明書を受け入れるのではなく、要求されるリリース環境を使う。空値、不正な Team ID、electron-builder がサポートしない `Developer ID Application:` プレフィックスを含む署名 ID、不完全な公証資格情報を拒否する。署名付き macOS パッケージングは構成された ID とその秘密鍵を要求する。ランタイム準備はその ID、安全なタイムスタンプ、hardened runtime をすべての組み込み Mach-O ファイルに適用し、アプリケーション署名後に deep strict チェックで他のリーフ権威や Team ID を拒否してから成果物を作成する。署名付き固定ターゲット macOS インストーラーコマンドは署名済みアプリケーションの別コピーを作成し、2 つの成果物レーンを並行実行する。一方のレーンは App を公証・ステープルしてから ZIP とその更新メタデータを生成する。もう一方は署名済み App コピーを署名付き DMG に収め、次に DMG を公証・ステープル・検証する。その内側 App には個別ステープルされたチケットはない。両レーンが成功してから成果物が最終ディレクトリに届き、リリース完了レコードが書き込まれる。署名付きディレクトリ専用コマンドも公証資格情報を要求し、Apple 公証と App ステープルを待つ。[並行公証の決定](../../../.agents/notes/implemented/process/2026-09-09-parallel-macos-notarization.md)はコピー分離とコンテナーチケットの意味を所有する。`CSC_LINK` は Developer ID Application 証明書と秘密鍵を含むローカル p12 を指名しなければならず、URL と Base64 入力はサポートされない。`CSC_KEY_PASSWORD` はそのエクスポートパスワードであり、Apple アカウントやログインパスワードではない。明示的な空値は暗号化されていない p12 をサポートする。ビルドの前に、パッケージングはプライベートな一時キーチェーンを作成・アンロックし、p12 をインポートして署名を認可し、小さなプローブに署名する。ランタイムと App の署名はこのキーチェーンを明示的に使い、既存ログインキーチェーンの設定や手動アンロックは不要である。子プロセスは p12 パスワードなしでそのパスを受け取る。キーチェーンは成功時も通常失敗時も削除され、強制終了後は CI が一時資格情報をクリーンアップしなければならない。短命 CI はシークレットストアから証明書と `.env.macos` を書き込み、ファイルアクセスを制限し、ジョブ後に両方を削除する。セルフホストマシンプリセットはチェックアウト外にプライベートファイルを保持する。環境の `CSC_NAME` と証明書探索順はリリース所有者を選択しない。公証資格情報は代わりに electron-builder の完全な Apple ID またはキーチェーンプロファイル戦略を使える。`pnpm --dir apps/desktop run verify:mac-signature -- <path-to-app>` でアプリケーション検査を手動再実行する場合も、この 2 つの macOS ID 変数が必要である。

macOS 署名は Framework シンボリックリンクエイリアスをたどらずに実ファイルを訪問する。PAK リソースは出荷される全言語を保持し、個別署名ではなく外側 Framework またはアプリケーション署名で封印される。[リリースポリシー](../../../.agents/notes/implemented/architecture/2026-08-25-electron-desktop-packaging-and-updates.md)は依存関係パッチと検証要件を所有する。

macOS ランタイム準備は、検証済み単一アーキテクチャ Mach-O 署名を `.desktop-build/targets/<target>/signature-cache` にキャッシュする。ただし `DSH_DESKTOP_MACOS_SIGNATURE_CACHE_DIR` が外部ストレージを選択した場合は除く。明示パスは絶対かつ既存でなければならず、リンクされた祖先を含まず、現アカウント所有でモード `0700` かつ読み書き検索アクセスが必要である。不正または空の設定はフォールバックなしにプリフライトで失敗する。フィールドを省略するとターゲットローカルストレージを保つ。キーには入力バイトとパーミッション、署名プローブの実際のリーフ証明書、識別子、エンタイトルメントバイト、macOS バージョン、署名ツールとポリシーが含まれる。Git コミットは再利用を決めない。コミットされていないバイト変更は対象ファイルを無効にする。ヒットするたびにキャッシュバイト、strict 署名、証明書、識別子、エンタイトルメント、安全なタイムスタンプ、hardened runtime を検証してから変更のない入力を置き換える。Universal バイナリは毎回署名する。ランタイム完全性とスモークチェック、App 署名、Apple 公証は引き続き実行する。キャッシュは信頼できるローカルビルドストレージを要求する。キャッシュ破損や安全でないリンクはビルドを失敗させ、影響キャッシュディレクトリを削除して再試行する前にパッケージングを停止する。署名成功ステージは完全エントリーを 1 GiB ペイロード予算まで刈り込む。中断された一時エントリーは手動削除が必要である。並行排除はリーダーを安全に失敗させうる。ログはヒット・ミス・非キャッシュ件数を報告する。

Mac パッケージコマンドは `apps/desktop/.desktop-build/packaging-runs/` 配下の一意ディレクトリとともに `DESKTOP_PACKAGING_RECORD` を表示する。ローカル構成の読み取り後、各実行は `run.json`（公開バージョン、製品バージョン、Git コミット、ダーティワークツリーフラグ、ターゲットと Node バージョン）、`events.jsonl`（タイムスタンプ付きフェーズ、所要時間、並行出力の帰属、プロキシ復元）、秘匿済み子 `stdout.log` / `stderr.log`、`result.json`（全体結果、ステージ結果、成果物ディレクトリ）を保持する。イベントはパック並行度と各プロキシの構成有無も記録する。ログは失敗や後のビルドを超えて残り、自動削除は実行されない。`result.json` の欠落は完了未確認を意味する。既知資格情報値は秘匿され、環境全体や notarytool 認証引数は記録されない。ランタイム準備はパッケージステージング、インストール、マテリアライズ、署名、マニフェスト、スモークチェック、記述子検証、クリーンアップを個別に記録する。入れ子フェーズの所要時間は重複するため合算してはならない。

App と DMG の公証はそれぞれ submission ID と個別の `notarytool:upload:*`・`notarytool:wait:*` 所要時間を記録する。アップロードは `submit --no-wait` を使い、認証、ローカル検証、転送、サーバー受理を含み、純粋な転送時間ではない。待機はそのコマンド復帰後に始まり、ポーリングと残りの Apple 処理を含む。Apple はアップロード送信復帰前に処理を開始しうる。Apple ステータスと診断ログは拒否を含めて保持され、署名検査・受理検査・ステープルは引き続き `@electron/notarize` が所有する。ディレクトリ専用パッケージコマンドも同じ計測済み App 公証パスを使う。個別サブプロセス出力は引き続きターミナルにライブ表示され、フェーズ失敗と入れ子エラーはジャーナルに保持される。両プラットフォームは親プロセスのパッケージング失敗を記録し、プロキシ復旧手順を含む秘匿済み診断をターミナルに表示する。構成専用 `check:package` コマンドは実行ログを作成しない。

Mac パッケージングは `.env.macos` から 3 つの調整フィールドを読む。

| 設定 | 既定値 | 適用範囲 |
|---|---|---|
| `DSH_DESKTOP_MACOS_PACK_CONCURRENCY` | `4` | ファーストパーティとベンダーワークスペース tarball 用ワーカー数。正の整数を要求する。 |
| `DSH_DESKTOP_MACOS_DOWNLOAD_PROXY` | 空 | Electron、ランタイムアセット、pnpm インストール、ビルダーダウンロード用の HTTP/HTTPS プロキシオリジン。 |
| `DSH_DESKTOP_MACOS_NOTARIZATION_PROXY` | 空 | 一時システムプロキシ設定を通じて Apple ツールが使う HTTP プロキシオリジン。 |

プロキシフィールドは独立であり、URL 資格情報・パス・クエリ・フラグメントを拒否する。空値は継承ネットワークを保つ。明示ダウンロードプロキシは子プロセスのプロキシ変数を置き換え、ローカルホストのみバイパスする。システム設定は変更しない。Windows と単独 `release:pack` は既存の並行度既定値を保つ。会社プロキシアドレスは無視されるローカルファイルに属し、アドレスは内部ドキュメントを参照すること。

Apple ツールはアクティブ macOS ネットワークサービスの HTTP/HTTPS プロキシを使う。公証ルーティングを構成すると、プロキシ到達性を確認し、そのサービスの設定を保存し、両成果物レーンの前後でプロキシを有効化し、両レーン確定後に保存設定を復元する。元々無効でサーバーが空・ポートがゼロのプロキシは、無効化で復元する。一時サーバーとポートは保存されたまま非アクティブで残る場合がある。ディレクトリ専用ビルドは署名済みディレクトリビルド後の App 公証に適用する。これは一時的に他アプリケーションへ影響し、システムプロキシ変更の権限を要求する。PAC、自動検出、SOCKS、認証付きプロキシ構成は先に無効にしなければならない。パッケージングと復旧は、復旧データ読み取りやプロキシ変更の前に同じユーザー別 POSIX ファイルロックを取得する。プロセス終了で所有権は解放され、ロックファイルは残る。ロックはスクリプト開始時ではなく初回使用時に `@deepseek-ai/node-addon-system/flock` を読み込むため、`check:package` とパッケージング入口は `native/system` をビルドしていないチェックアウトでも読み込める。ロック時にホスト addon バイナリや入口 JavaScript が欠けている場合、ローダーはロック前に `pnpm run build:native-system` と `pnpm --dir native/system run build:ts` を実行するため、復旧はそのようなチェックアウトでも動作する。これによりチェックアウトを跨ぐプロキシトランザクションの重なりを防ぐ。他ユーザーやネットワーク設定ツールは同時にこれらの設定を変更してはならない。SIGINT/SIGTERM は復元前にアクティブ作業を待つ。強制終了や復元エラー後は、残存公証プロセスを停止して `pnpm --dir apps/desktop run restore:mac-proxy` を実行する。保存レコードは復元成功まで残る。構成チェックは URL 構文のみ検証し、システム設定の変更やプロキシへの問い合わせは行わない。

<a id="directory-and-preparation"></a>

## ディレクトリビルドと準備

インストーラーの代わりに実行可能なアプリケーションディレクトリを作成するには、次のような対応 `:dir` コマンドを使う。

```sh
pnpm run package:desktop:dir
pnpm run package:desktop:mac:arm64:dir
```

準備済みホストターゲットリソースを検査・トラブルシュートするために electron-builder を呼ばずに止めるには、同じパイプラインを準備後に停止する。

```sh
pnpm run prepare:desktop
```

この診断コマンドは代替の停止点であり、2 コマンドビルドの前半ではない。後の `package:desktop*` コマンドは公式ビルドと準備を繰り返すため、古い dsh パッケージ、ランタイムファイル、dsh コンテンツを使うことはない。

<a id="local-official-bundles-from-a-loopback-registry"></a>

## ループバックレジストリからのローカル Official バンドル

テスト DMG は Official オンデマンドカタログが宣伝するプロバイダーランタイムを除外し、リリースは対応バンドルバージョンを npm へ公開する。そのリリースの前にローカルビルド済みバンドルをインストールするには、カタログの完全なローカル依存クロージャをパックして提供するループバックレジストリを起動する。

```sh
pnpm run dev:bundle-registry
```

このコマンドはカタログとワークスペースインベントリを検証し、`pnpm run build:official` を実行し、クロージャを新規 `dist/test-bundles/<run-id>/` ディレクトリへパックし、完了マーカーとして `bundle-registry.json` を最後に書き、その後に成果物パス、レジストリ URL、正確な `name@version` 仕様を表示する。新規名前空間で割り当てポート上の `127.0.0.1` を Ctrl+C または SIGTERM まで提供し、停止しても成果物とインストール済みパッケージはディスクに残る。`.env.macos`、Apple 資格情報、npm 資格情報は不要であり、`pnpm run package:desktop:unsigned` を変更しない。

パッケージ済みアプリケーションで プラグイン → プラグインを追加 を開き、表示された仕様を貼り付け、**カスタムアドレス**を選択して、表示されたレジストリ URL を貼り付けてインストールする。カスタムレジストリは単独で問い合わせられるため、この手順はすべての依存関係に応えなければならない。リポジトリ所有パッケージは実行自身のアーカイブから提供され、サードパーティパッケージは `registry.npmjs.org` への固定リダイレクトを通じて npm の実際のメタデータとバイトを保つため、引き続きネットワークアクセスが必要である。パッケージ名がカタログにあるため、インストール済みエントリーは Official のままである。レジストリ選択はこのブラウザーに記憶され、提供レジストリを再度選択すると切り戻せる。

実行の成果物は不変のため、リビルドは新規名前空間と新規 URL を提供し、インストール済みバージョンと実行中バージョンが一致する間は Official の**更新**コントロールは表示されない。プロファイルは前回実行の tarball URL を `pnpm-lock.yaml` に記録し、pnpm は記録済みエントリーを検証するため、そのバンドルを新規 URL に対してインストール・再インストールすると `ERR_PNPM_TARBALL_URL_MISMATCH` で拒否され、以前のファイルが残る場合がある。同じバージョンで変更コードをテストするには、先に古い解決をクリアする（`$DSH_HOME/profiles/<profile>` で `pnpm clean --lockfile`、または新規プロファイルへインストール）。その後、新規 URL から再度インストールする。`bundle-registry.json` は各アーカイブのバージョン・ファイル名・サイズ・SHA-512 完全性を、パックしたチェックアウトのコミットとダーティフラグとともに記録する。

提供される `time` は実際のパック時刻のため、pnpm 11 の既定 24 時間 `minimumReleaseAge` はプロファイルの `pnpm-workspace.yaml` に付与した免除を記録する（`minimumReleaseAgeExclude`）。そこで明示的により厳格なポリシーがある場合は、上書きされず pnpm 自身のメッセージでインストールが失敗する。`~/.npmrc` やプロファイルの `.npmrc` の `@scope:registry` 経路はそのスコープに対して `--registry` を上書きするため、提供スコープを経路指定してはならない。

<a id="runtime-file-selection"></a>

## ランタイムファイル選択とインストールチェック

Desktop はワークスペースパッケージをローカルでパックし、外部依存関係はターゲットのバンドル済み Node と pnpm を通じてインストールする。次に [Desktop のファイルポリシー](../scripts/runtime-file-policy.ts)が不変の `resources/app.asar/dsh/node_modules` コピーを署名・完全性封印の前にフィルタする。TypeScript 宣言、認識済み JavaScript/CSS/TypeScript ソースマップ、TypeScript ビルドキャッシュ、Domino のテストディレクトリと Yarn 開発メタデータ、選択されたネイティブコンパイラ出力、他プラットフォーム用 node-pty prebuild を省略する。非 Windows ターゲットはさらに `node-pty/third_party/conpty` を省略し、Windows ターゲットはそのディレクトリを保持する。ランタイム JavaScript、ターゲットネイティブモジュールとその DLL/EXE ヘルパー、WASM、不明アセット、ライセンス、注意書きを保持する。依存関係マニフェストは完全性封印の前に electron-builder のメタデータクリーンアップを通過するため、アーカイブは記録バイトを保持する。このポリシーは npm tarball、バンドル済みパッケージマネージャー、ユーザーインストール済みプラグインファイルを変更しない。

[Electron シェルファイル一覧](../scripts/electron-builder-config.mjs)は別個の `resources/app.asar/node_modules` 依存関係収集から認識済み JavaScript/CSS/TypeScript ソースマップと TypeScript ビルドキャッシュを除外する。これらの除外はランタイムコード、ネイティブモジュール、WASM、データファイル（通常の `.map` アセットを含む）、ライセンス、注意書きを保持する。[シェルアーカイブテスト](../tests/shell-file-selection.spec.ts)は保持バイトと除外を検査する。

[Office 変換プロバイダー](../../../packages/document/office-to-pdf/README.md)はターゲットの宣言済みネイティブエンジンを運び、キットが対応ネイティブターゲットを宣言しない場合は WASM である。ターゲットエンジン欠落の準備はパッケージング前に拒否される。CLI、JavaScript ライブラリ、選択エンジンの実行ファイル・データ・ライセンス・注意書きを含む完全な Office 依存関係は `resources/app.asar.unpacked/dsh/node_modules/` 配下に展開される。Desktop Host はエンジンマニフェストをこれら物理ディレクトリへ解決し、読み込んだスキルへ絶対のスタンドアロン Node と展開済み CLI パスを提供する。Node は `resources/runtime/primary-runtime/dependencies/node/bin/` に存在し、CLI は展開済み `@deepseek-ai/libreoffice-kit/lib/cli.js` である。macOS では、ネイティブヘルパーは [LibreOffice の UNO ブリッジ](https://github.com/LibreOffice/core/blob/master/sysui/desktop/macosx/hardened_runtime.xcent.in)が要求する JIT エンタイトルメントを受け取る。

パッケージ済みアプリケーションはコンパイル済み JavaScript と事前生成 Typert メタデータを実行し、TypeScript プラグインをコンパイルしない。ソースレベルのデバッガーナビゲーションとエディター宣言は開発パッケージで利用可能である。[コピーポリシーテスト](../tests/runtime-file-policy.spec.ts)は除外と保持アセットをカバーし、[ペイロードスモーク](../tests/fixtures/runtime-payload-smoke.mjs)は Host スモークと最終インベントリ検証の前に Electron RunAsNode 配下で実行する。ペイロードスモークは検索ツールの ripgrep 実行ファイルを解決し、テキスト検索とファイル列挙を検証する。署名付き Windows ビルドは依存関係署名後にこれらのチェックを実行し、他のビルドは `prepare:dsh` 中に実行する。[Host スモーク](../scripts/smoke-runtime.ts)はバンドル済み Python で DOCX・XLSX・PPTX 入力を作成し、実際の Office プロバイダーで各変換を行い、PDF 出力を検査する。ディレクトリと未署名ビルドを含むすべての組み立て済みアプリケーションは、ASAR に対してペイロードと Host のチェックを繰り返す。アーカイブ完全性チェックは、準備との完全なアーカイブ記述子比較、アーカイブと展開ツリー両方のファイルバイトと所属、アーカイブファイルの記録済み実行フラグ、展開ファイルの物理パーミッションを比較する。Host スモークはさらに読み込み済みスキルから CLI パスを取得し、空の PATH でケイパビリティと DOCX 変換を実行する。変換失敗はリリースレコード書き込み前にパッケージングを停止する。macOS DMG/ZIP ビルドは公証前にこれらのチェックを実行する。

Windows リリース適格性確認はさらに Desktop ビルド後に[ディレクトリと置換のチェック](../scripts/smoke-windows.ps1)を手動実行する。固定ビルダーの NSIS コンパイラへ `$Makensis` を、7-Zip 実行ファイルへ `$SevenZip` を、x86-unicode NSIS プラグインディレクトリへ `$PluginDir` を設定し、準備済み `window-frame.dll` を `-FrameLibrary` として渡してネイティブ展開パスとその失敗報告も試す。リポジトリルートから以下のコマンドを実行する。ディレクトリ置換とロールバック、両ロックファイル置換モードを検証する。単体テストレーンの一部ではない。

```powershell
pwsh -NoProfile -File apps/desktop/scripts/smoke-windows.ps1 -Makensis $Makensis -SevenZip $SevenZip -PluginDir $PluginDir -FrameLibrary apps/desktop/.desktop-build/targets/win-x64/installer-ui/window-frame.dll
```

Windows インストーラーは起動時と宛先選択後、新バージョンをインストールディレクトリの隣に展開する前に、実行中アプリケーションを確認する。同一ボリューム rename によるディレクトリ置換の前にも再確認する。実行中アプリケーションはインストールをブロックし、更新起動では終了まで最大 10 秒待つ。同パスアップグレードは昇格成功まで旧ディレクトリを保持し、展開失敗ではそのまま残し、昇格失敗では復元を試みる。インストーラーは起動前に旧バックアップを削除する。強制終了や電源断は `.new-*` や `.old-*` ディレクトリを残しうる。インストール場所とスコープの移行は electron-builder の旧アンインストーラーフローを保持する。

ディレクトリ rename、空宛先削除、復元は Windows エラー 5・32・33 を最大 10 試行まで再試行し、250 ms ずつ増加する遅延を挟む（操作ごとに合計 11.25 秒の待機）。他のエラーは即時停止する。置換失敗は Windows エラー、影響パス、復元結果を抽出レポートの隣の `directory-failure-<timestamp>.log` に報告する。復元に失敗した場合、インストーラーはロックされていないステージングファイルを削除し、バックアップを保持する。その失敗を報告した後の終了クリーンアップは復元を再試行しない。レポートに記載されたバックアップパスを保持し、再インストールの前にサポートへ連絡すること。サイレントインストールはダイアログなしで同じ診断を保存する。

展開失敗時、インストーラーは 7-Zip 結果とその完全なエラー出力を含むレポートを更新キャッシュディレクトリへ `%LOCALAPPDATA%\<package-derived name>-updater\installer-logs\extract-failure-<timestamp>.log` として書き込む（現在は `@deepseek-aidsh-desktop-updater`）。最初のエラー行を**エラー詳細をコピー**ボタンとともに表示する。サイレントインストールはレポートのみ書き込む。未署名 Windows ビルド（`DSH_DESKTOP_UNSIGNED=1`）はインストーラーを `deepseek-harness-<version>-win-x64-unsigned.exe` と命名するため、リリース成果物と誤認できない。

Windows パッケージングはバンドル NSIS デコーダーとの互換性のため 7-Zip フィルターを `BCJ` に固定する。これにより x64 インストーラーが運ぶ依存関係の ARM64 バイナリを保持する。自動 ARM64 フィルタリングはこのデコーダーが展開できないエントリーを生成する。

NSIS はインストール中に一時展開ツリーを削除する。完了ページや自動起動の前である。インストール済み本番パッケージは通常ファイルのまま残り、起動時に再度展開しない。インストールは引き続き完全なアプリケーションツリーを書き込む。

<a id="desktop-runtime-preparation"></a>

## Desktop ランタイム準備

Desktop の[パッチポリシー](../scripts/runtime-patch-policy.ts)は各ワークスペースパッチを共有・ワークスペース専用・ランタイム専用に明示分類する。共有エントリーはルートパッチバイトを再利用し、ルートロックファイルに対してハッシュを検証する。ランタイム専用エントリーはワークスペースインストールを変更せずに別のリポジトリファイルを使う。ワークスペース専用パッチはビルドツールまたはクライアントバンドルに既に組み込まれた依存関係に属する。未分類や古いエントリー、欠落ファイル、変更されたハッシュ、互換性のない解決バージョン、ランタイムに入るワークスペース専用パッケージはパッケージングを停止する。[準備スクリプト](../scripts/prepare-runtime-patches.ts)は一時プロジェクトにのみ書き込み、pnpm は選択パッチを適用して適用失敗を拒否する。

Desktop 依存関係オーバーライドはパッチバージョンから推論せず、パッチポリシーモジュールに個別宣言する。pi-ai 制約は共有パッチで適格性確認されたバージョンにランタイムバージョンを保つ。Desktop は引き続き各ビルドで新規ランタイムロックファイルを解決し、`--frozen-lockfile` でインストールする。別ビルド間の依存関係解決はまだ再現可能ではない。CLI パックインストールテストなど他の配布フローは独自構成を保持する。

各パッケージコマンドはリポジトリをビルドし、dsh とプライベート Desktop Host を起点とするファーストパーティ本番クロージャをパックし、ターゲット Electron 配布と共有 pnpm CLI 付きプライマリランタイムを準備する。`prepare:dsh` は本番グラフをビルド時に 1 回インストールし、electron-builder が `app.asar/dsh` 配下にアーカイブするためのマテリアライズ済みパッケージを準備し、パッケージマネージャーメタデータを削除し、共有パッケージバージョンと最終ファイルハッシュを含む `desktop-runtime.json` を書く。署名付き macOS ビルドはインベントリ生成前にネイティブファイルへ署名・検証し、electron-builder はこの署名済みツリーを入れ子再署名から除外する。リソースマッピングは既定ルートディレクトリフィルターが省略する `dsh/node_modules` を明示的に含み、準備済みランタイムインベントリはネイティブ署名後に検査される。ネイティブ実行ファイルとライブラリは ASAR の隣に展開され、Python・スタンドアロン Node・pnpm は外部ランタイムリソースに残る。Windows パッケージングは未署名ビルドも含めて準備済み PE のすべてを ASAR 展開エントリーおよびバイト同一ディスクコピーと照合する。ビルダー glob 規則は PE ファイル名の中括弧を単一文字ワイルドカードとして扱うため、隣接する一致ファイルも展開される場合がある。準備済みランタイムスモークはビルドホストアーキテクチャではなく検証済みターゲット記述子を使う。署名済みインストーラー、公証、インストール済みアップグレード、ターゲット別ネイティブモジュール適格性確認はリリース環境を要求する。

署名付き macOS パッケージングは App 組み立て中かつコード署名前に `Contents/Resources/app-update.yml` を書き込む。並行 ZIP・DMG レーンへ供給するディレクトリビルドも含む。署名フックは正確なフィードと更新キャッシュディレクトリを検証する。両レーンコピーと昇格 App はリリース完了レコード書き込み前に再検査され、構成の欠落や不一致は成果物昇格を防ぐためアップロードも防ぐ。

展開済み成果物は Electron、マテリアライズ済み dsh 本番ツリー、pnpm、シェルアプリケーションを含む。インストーラーサイズとファイルシステムサイズは異なり、リリース適格性確認は両方に加えてプロファイルのプラグインストレージと初回起動レイテンシを測定する。ランタイムはユーザーマシンでのコアパッケージインストールをなくす代わりにアプリケーションファイルを増やしている。

<a id="verification"></a>

## インストールとリリース検証

生成されたインストーラー、そのバージョン、パッケージングレコードは一体で保持する。署名とランタイムチェックをインストール前にレビューし、次にインストール済み起動とアップグレード証拠について[インストール済み更新適格性確認手順](../tests/installed-update/README.md)に従う。[Desktop テストレコード](../tests/README.md)は検証の限界を所有し、ワークフロー成功だけでは本番プリセット・新規ワークステーション・インストール済みアップグレードの受け入れは確立しない。

## 開発者ノート

なし。
