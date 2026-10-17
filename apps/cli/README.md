# `@deepseek-ai/dsh`

日本語 | [English](README.en.md) | [中文](README.zh.md)

`dsh` コマンドは唯一サポートされる Node アプリケーションランチャーである。プロファイルはユーザー自身の上書き配下のプラグインバンドルパッチ層の順序付きスタックである。SDK と ACP はプロファイルであり、別の公開 bin ではない。Python ランタイム wheel は同じコマンドをパッケージする。SDK は既定で `sdk` を使い、最小例は `sdk-minimal` を選ぶ。[`src/args.ts`](src/args.ts) がコマンド文法を所有し、[`src/bin.ts`](src/bin.ts) は選ばれたランナーのみ読み込む。無効コマンド、別モードのオプション、致命的な構成または起動失敗は非ゼロ終了する。

## エントリーモード

| コマンド | 目的 |
|---|---|
| `dsh <name>` / `dsh --profile <name>` | `$DSH_HOME/profiles/<name>` 配下の名前付きプロファイルを起動する。 |
| `dsh --profile <name> --from-default-profile <template>` | カスタムプロファイルを出荷テンプレートの新しいコピーで置き換えてから起動する。 |
| `dsh --profile acp` | 切断まで ACP stdio で自動化クライアントに提供する。 |
| `dsh --profile headless "job"` | 新しい永続セッションを 1 件実行し、最終回答を印刷して終了する。 |
| `dsh --profile sdk` | シャットダウンまたは切断まで JSON-RPC stdio で SDK クライアントに提供する。 |
| `dsh --profile sdk-minimal` | 独立最小エージェントツリーで SDK クライアントに提供する。 |
| `dsh web` | Web プロファイルを起動する。 |
| `dsh plugin --profile <name> <pnpm args>` | プロファイルディレクトリで pnpm に転送してプロファイルのプラグインを管理する。 |

起動ディレクトリは既定ワークスペースルートである。`web`、`headless`、`sdk`、`sdk-minimal`、`acp` プロファイルは初回使用時に出荷テンプレートから自動初期化される。出荷外の名前で別プロファイルを作成またはリセットするには `--from-default-profile` を使い、ベース支援プロファイルは `dsh plugin` 経由で初期化する。`desktop` 名は Electron 所有プロファイル用に予約されており、CLI はそれへの起動と設定ダンプ要求を拒否する。npm CLI はそのプラグイン管理要求も拒否する。[Desktop インストール済みコマンド](../desktop/README.md#bundled-command-runtime)はそのインストールのランタイムを使って初期化済み Desktop プロファイルを管理できる。

## アプリ引数

ランチャーは自身のフラグのみ解析し、それ以降を起動プロファイルに渡す。そこでは注入された任意アプリプラグインが共有不変スナップショットを解析し得る ([`dsh-cmdline`](../../packages/boot/cmdline/README.md))。ランチャーが認識しない最初のトークンがアプリ引数の開始である。

```sh
dsh --profile web --port 8080       # --port belongs to the web app
dsh --profile tui --resume <id>     # example, assuming the tui profile is installed; --resume belongs to the terminal app
dsh --profile headless "run the tests"
dsh --profile web --help            # the web app's flags, not the launcher's
dsh --help                          # the launcher's own help
```

<a id="profiles"></a>
## プロファイル

プロファイルディレクトリは `package.json` (ツリー外プラグイン依存関係と順序付き `bundles` 一覧を持つプロファイルマニフェスト `dsh.profile`) と `cordis.patch.yml` (ユーザー自身のパッチ層) を保持する。YAML で有効化された `dsh-hmr` はプロファイルマニフェストとプロファイル・ホーム両パッチファイルを監視し、直列化再読み込み 1 回で全層を再構成する。HMR なしでは変更は再起動時に適用される。ウォッチャー登録中に届く編集は後の編集と同じ非致命再読み込み報告を使う。[プラグインマネージャー](../../packages/boot/plugin-manager/README.md)は `dsh plugin` とパッケージ操作とプロファイル書き込みロックを共有する。パッケージ更新は無効バンドル選択を保持する。CLI パッケージコマンドは対話ビルド承認を含む認証変数と端末記述子を継承する。サービス呼び出しはスクラブ済み環境と取得済み診断を保持する。

インストールとプロファイル起動は宣言済み `engines.dsh` 範囲を、なければ DSH ピア範囲を、`dsh --version` が示す同じランタイムバージョンに対して強制する。互換性のないプラグインは明示的に承認された正確バージョン免除を要する。プラグインマネージャーの[互換性リファレンス](../../packages/boot/plugin-manager/README.md#version-compatibility-and-exemptions)は `version-exemptions`、`allow-version`、`revoke-version`、永続化、リスクを文書化する。

ツリーは空ルート上に構成される。
- `dsh.profile.bundles` 順の各バンドルのパッチ
- 次にプロファイルの `cordis.patch.yml`、次にホームレベル `$DSH_HOME/cordis.patch.yml`
- 次に `--patch` 上書き

`dsh.profile.bundles` に名指されたバンドルはまず dsh インストールから解決される (`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、`@deepseek-ai/dsh-headless`、`@deepseek-ai/dsh-sdk-app`、`@deepseek-ai/dsh-sdk-minimal`、`@deepseek-ai/dsh-acp-app`)、次にプロファイル自身の `node_modules` から解決され、pnpm はそこにツリー外プラグインをインストールする。

構成済みツリーを起動せずに検査するには `--dump-default-config` と `--dump-config` を使う。`--dump-config-schema` は構成済みツリーの宣言プラグインスキーマを import し、設定値の代わりにエントリーとパッチの JSON Schema を印刷する。信頼できないプラグインを検査する前に[スキーマダンプの安全と範囲](reference/README.md#config-schema-dump)を読むこと。

[CLI 動作リファレンス](reference/README.md)は正確な層優先順位、フラグ、シャットダウン動作、デプロイ既定、ソース実行を所有する。[起動と再読み込み失敗表](../../packages/boot/app-boot/README.md#startup-and-reload-failures)は任意と必須のプラグイン失敗を設定 HMR と比較する。

## 任意上書き

`config/examples/` は GitHub レビュー Webhook、メモリー MCP サーバー、ランタイム Cordis ツール向けのオプトイン上書きを出荷する。これらは既定プロファイルの一部になることは決してない。[ユーザーガイド](../../docs/user/guide/index.md)と[開発者実践ガイド](../../docs/user/develop/practice/index.md)がセットアップと安全指示を所有する。

## 開発

本番実行はビルド済みパッケージとフロントエンド成果物を要する。リポジトリルートから `pnpm run build` を別に実行し、次に `pnpm dsh <args...>` で TypeScript エントリーを実行して全引数を転送する。[ソース実行リファレンス](reference/README.md#source-execution)がモジュール解決契約を所有する。

`@deepseek-ai/dsh/profile-boot` export は Desktop ホストに共有プロファイルライフサイクルを提供する。解決済みアプリケーションプロファイルは Harness ホームパッチ、プロキシ環境、テレメトリスイッチ、パッチ再読み込み、制限シャットダウンを保持しながら、ランタイムパッケージ解決向けに自身のインストールアンカーを提供する。

パッケージ済みインストールは同じ `runCli()` エントリーをパッケージマネージャー実行ファイル付きで呼ぶ。Desktop キャリアーは初期化済みプロファイル向けにプラグイン操作も有効化する。npm 起動はこれらのオプションを省く。インストール所有パッケージ環境はプラグインパッケージ操作にのみ適用される。起動ディレクトリ、通常プロファイル選択、エージェントシェル PATH は CLI の意味を保つ。

[Web 失敗行列](tests/profiles/web/tests/web-failure-matrix.expected.e2e.ts)はビルド済み CLI を `test:expected` で `awaitWriteFinish` 有効の起動失敗とネイティブ設定 HMR 経由で実行する。モデル API 呼び出しなしに認証済み HTTP 応答、診断、回復、プロセス終了、破棄を検証する。[起動受け入れ](tests/profiles/web/tests/web-best-effort-startup.expected.e2e.ts)は出荷必須 Web 依存関係とポート競合もカバーする。
