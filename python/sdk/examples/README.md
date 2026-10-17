# Python SDK の例

日本語 | [English](README.en.md) | [中文](README.zh.md)

唯一のアプリケーションランチャーである `dsh --profile sdk-minimal` 上で動作する、実行可能な Python SDK の例。Python クライアントは JSON-RPC stdio を所有し、プロファイルはエージェント構成、永続化、実行ポリシー、プラグインを所有する。

## 最小エージェントを実行する

`deepseek-harness-sdk` をインストールし、モデルのクレデンシャルをエクスポートしてから、分離された Harness ホームとワークスペースを指定する:

```sh
export DEEPSEEK_API_KEY=sk-your-key-here
python python/sdk/examples/minimal.py \
  --dsh-home /absolute/path/to/example-dsh-home \
  --workspace /absolute/path/to/disposable-workspace \
  --session-id example-001 \
  "Inspect the repository and fix the failing tests."
```

互換プロキシには `DEEPSEEK_BASE_URL`、スクリプトのデフォルトモデルには `DSH_MODEL`、デプロイのペルソナには `DSH_SYSTEM_PROMPT` を設定する。`--model` は単一の実行時モデル選択であり、対応する環境変数は不要である。`--profile` で別の SDK 提供プロファイルを選択できる。選択したホームには、生成された `sdk-minimal` プロファイルと非圧縮の JSONL セッションログが `sessions/` 配下に格納される。スクリプトが `~/.dsh` を暗黙に読み込むことはない。

出荷される [`@deepseek-ai/dsh-sdk-minimal` バンドル](../../../packages/bundle/sdk-minimal/README.md)は、このモード用の完全で明示的な Cordis ツリーである。公開するのは正確に次のものだけである:

- Linux/macOS ではオーナースコープの永続的 `bash`、Windows では `pwsh`
- 画像対応モデルでの PNG/JPEG/WebP/GIF ファイル用 `read_image`
- セッションディレクトリの確認・変更用 `working_directory`

このバンドルは `dsh-base` を含まないため、追加の行はすべて明示的なプロファイル変更となる。実行時コンテキスト、テキストファイルツール、ローカル命令検出、設定、管理クレデンシャル、テレメトリー、Web ツール、サブエージェント、完全なデフォルトツール群は存在しない。ツリーには SDK 起動と JSON-RPC 提供、環境設定された 1 つの DeepSeek アダプター、ローカル実行、JSONL 永続化が残る。[自動コンテキスト圧縮](../../../packages/bundle/sdk-minimal/README.md#model-experience)は、完全なログを保持しながら、追加のモデルリクエストを通じて古い履歴を要約する。SDK プロンプトテキストはスラッシュコマンドを実行しない。

永続的 PTY は実行時プロセスが到達できるあらゆるパスを変更できるため、使い捨てのチェックアウトまたはコンテナーを使用すること。

## プラグインを追加する

同じ明示的ホームに対して、ランタイムホイールの `dsh` コマンドを使用して永続的なプロファイル変更を行う:

```sh
export DSH_HOME=/absolute/path/to/example-dsh-home
dsh plugin --profile sdk-minimal add file:/absolute/path/to/my-plugin-bundle
```

この例を拡張するにはそのコマンドで `sdk-minimal` を、完全なベース付き SDK プロファイルを拡張するには `sdk` を使用する。Python 呼び出しでは `patches=(...)` に追加の絶対パッチパスを渡すこともでき、後のファイルが優先される。選択したプロファイルは `@deepseek-ai/dsh-sdk-app` または別の JSON-RPC サーバー行を保持しなければならない。この例は完全な Cordis ファイルや任意のプロセス argv を受け付けない。

同じランタイムホイールは `web` プロファイルとそのフロントエンドアセットをパッケージしており、CLI から直接使用できる。`dsh web` はその別のアプリケーションを起動する。Python SDK クライアントは JSON-RPC サーバー行を持たないため `web` を選択できない。

[Python SDK チュートリアル](../../../docs/user/guide/python-sdk.md)と [SDK リファレンス](../README.md) を参照。
