# Python SDK 入門

日本語 | [English](python-sdk.en.md) | [中文](python-sdk.zh.md)

このチュートリアルでは公開 Python SDK をインストールし、出荷済みスタンドアロン最小プロファイルを動かし、同じ `dsh` プロファイルを自分のプログラムからカスタマイズする方法を示す。

## 前提条件

- Python 3.10 以降
- Git
- Linux x64、Linux arm64、arm64 上の macOS 14 以降、または Windows x64
- DeepSeek 互換 API エンドポイントと資格情報
- 分離されたワークスペースと分離された Harness ホーム

## SDK のインストール

<div>
<a id="linux-and-macos"></a>
<a id="windows-powershell"></a>
</div>

::: code-group

```sh [Linux/macOS]
git clone git@github.com:zenk-co/zenk-deepseek-harness.git
cd deepseek-harness
python -m venv .venv
. .venv/bin/activate
python -m pip install deepseek-harness-sdk
```

```powershell [Windows PowerShell]
git clone git@github.com:zenk-co/zenk-deepseek-harness.git
Set-Location deepseek-harness
py -3.10 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install deepseek-harness-sdk
```

:::

インストールには対応ネイティブランタイム wheel と `dsh` コマンドが含まれる。通常の SDK 実行にシステム Node.js は不要である。成果物をビルドするリポジトリ貢献者は[Python 貢献者ワークフロー](../../../python/development.md)を使うべきである。

## チェックイン済み例の実行

資格情報をエクスポートし、必要に応じて互換プロキシエンドポイントを指定する:

<div>
<a id="linux-and-macos-1"></a>
<a id="windows-powershell-1"></a>
</div>

::: code-group

```sh [Linux/macOS]
export DEEPSEEK_API_KEY=sk-your-key-here
# export DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1
```

```powershell [Windows PowerShell]
$env:DEEPSEEK_API_KEY = "sk-your-key-here"
# $env:DEEPSEEK_BASE_URL = "http://127.0.0.1:8000/v1"
```

:::

明示のワークスペースとホームパスで 1 件のタスクを動かす:

<div>
<a id="linux-and-macos-2"></a>
<a id="windows-powershell-2"></a>
</div>

::: code-group

```sh [Linux/macOS]
python python/sdk/examples/minimal.py \
  --workspace /absolute/path/to/disposable-workspace \
  --dsh-home /absolute/path/to/example-dsh-home \
  --session-id example-001 \
  "Inspect the repository and fix the failing tests."
```

```powershell [Windows PowerShell]
python python/sdk/examples/minimal.py `
  --workspace C:\work\disposable-workspace `
  --dsh-home C:\work\example-dsh-home `
  --session-id example-001 `
  "Inspect the repository and fix the failing tests."
```

:::

スクリプトは最終アシスタント応答を表示する。選択されたホームは、生成された `sdk-minimal` プロファイル、インストール済みプラグイン、`sessions/` 配下の非圧縮 JSONL セッションログを受け取る。例と SDK が黙って `~/.dsh` を読むことは決してない。

## 自分のプログラムで SDK を使う

```python
from pathlib import Path

from deepseek_harness import DeepSeekHarness

workspace = Path("/absolute/path/to/disposable-workspace").resolve()
dsh_home = Path("/absolute/path/to/example-dsh-home").resolve()
with DeepSeekHarness(
    provider="deepseek-official",
    model="deepseek-v4-flash",
    max_tokens=49_152,
    cwd=str(workspace),
    dsh_home=str(dsh_home),
    profile="sdk-minimal",
) as harness:
    result = harness.run(
        "Inspect the repository and fix the failing tests.",
        session_id="example-001",
    )

print(result.final_response)
```

SDK はバンドルされた `dsh --profile sdk-minimal` プロセスを遅延起動し、コンテキストマネージャー終了まで再利用する。プロファイル、その永続パッチ、ホームパッチ、順序付き `patches` タプルがアプリケーション構成を形作る。別の Python ランタイム bin や完全設定オプションはない。

## プラグインのインストールと定義

このホームに残すべき依存関係とバンドル層には `dsh plugin` を使う:

<div>
<a id="linux-and-macos-3"></a>
<a id="windows-powershell-3"></a>
</div>

::: code-group

```sh [Linux/macOS]
export DSH_HOME=/absolute/path/to/example-dsh-home
dsh --profile sdk-minimal --dump-default-config >/dev/null
dsh plugin --profile sdk-minimal add file:/absolute/path/to/my-plugin-bundle
```

```powershell [Windows PowerShell]
$env:DSH_HOME = "C:\work\example-dsh-home"
dsh --profile sdk-minimal --dump-default-config | Out-Null
dsh plugin --profile sdk-minimal add file:C:/work/my-plugin-bundle
```

:::

最初のコマンドは出荷済みスタンドアロンプロファイルを初期化する。2 件目はパッケージ管理を `pnpm` に転送し、`dsh.bundle` 層をエクスポートするインストール済みパッケージを記録する。この管理コマンドのためだけに `pnpm` をインストールする。インストール済み SDK の起動にそれは不要である。永続行変更は `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` を編集し、起動単位変更は Python からパッチファイルを渡す。

`@deepseek-ai/dsh-sdk-app` または別の JSON-RPC サーバー行を含む場合、別の `profile` も有効である。サーバー行欠落、未解決プラグイン、無効パッチは、別の合成へのフォールバックではなく起動中に失敗する。

<a id="opt-in-to-str_replace_editor"></a>
### `str_replace_editor` へのオプトイン

バンドルランタイムは `str_replace_editor` を含むが、`sdk-minimal` は既定 Cordis ツリーからそれを省く。使うには、この設定を `editor.patch.yml` として保存する。`insert` は既存ファイルシステムプロバイダーを使ってエディターを追加する:

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@deepseek-ai/dsh-tool-str-replace-editor'
```

`DeepSeekHarness(profile="sdk-minimal", ...)` 構築時に `patches=("/absolute/path/to/editor.patch.yml",)` を渡すか、永続設定として `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` にパッチを置く。次回ランタイム起動時、モデルリクエストは既定ツールに並んで `str_replace_editor` を含む。ローカルファイルシステムプロバイダーは相対パスにランタイム作業ディレクトリを使い、最小シェル同様そのディレクトリへのアクセス隔離はしない。同じパッチは標準 `sdk` プロファイルでも動く。

## 最小プロファイルの理解

| プロパティ | 値 |
|---|---|
| システムプロンプト | `DSH_SYSTEM_PROMPT`、フォールバックは `You are a helpful software engineer assistant.` |
| `minimal.py` 内モデル | `--model`、次に `DSH_MODEL`、次に `deepseek-v4-flash` |
| モデルに面したツール | Linux/macOS では永続 `bash`、Windows では `pwsh`、`read_image`、`working_directory` |
| シェルタイムアウト | 300 秒 |
| 任意ランタイムコンテキスト | なし |
| コンテキスト圧縮 | 自動。追加モデルリクエストで古い履歴を要約する |
| セッション永続化 | `<dsh_home>/sessions` 配下の非圧縮 JSONL |

プロファイルの唯一バンドルは完全ツリーを空ルート上に挿入し、`dsh-base` を含まない。後の base プロファイルツールは暗黙に現れえない。SDK プロトコル、環境設定 DeepSeek アダプター 1 件、ローカル実行、永続化を含み、テキストファイルツール・設定・管理資格情報・OTel テレメトリー・Web ツール・サブエージェント・ローカル指示探索は不在である。[DeepSeek セッションログ貢献者](../../../packages/session/session-log-deepseek/README.md)は既定で未受理ログイベントを DeepSeek リクエストと共にアップロードし、1 リクエスト最大 `maxBytes` (8 MiB)。無効化にはプロファイルパッチで `session-log-deepseek.enabled: false` を設定する。`danger-full-access` を固定するため、プラットフォーム選択永続シェルはランタイムに見える任意パスを変更できる。使い捨てチェックアウトかコンテナーを使う。

画像読み取りには画像対応ルートが必要である。自動圧縮は完全 Session ログを保持する。モデルと記憶域効果は[バンドルリファレンス](../../../packages/bundle/sdk-minimal/README.md)を見る。SDK プロンプト文は `/compact` や他のスラッシュコマンドを実行しない。

インストール済み wheel は依然として完全 `web` プロファイルとフロントエンド資産を同梱する。Python SDK デプロイでもブラウザーアプリケーションが必要な場合は明示 `DSH_HOME` で `dsh web` を動かす。`web` は別の CLI アプリケーションであり、Python SDK クライアントに仕えることはできない。

プロファイル・プラグイン・資格情報・設定・セッションを分離すべき場合は fresh ホームを使う。独立作業には fresh セッション id を使う。同一耐久会話とセッション所有リソースを継続する場合のみハーネス・ホーム・id を再利用する。

[バンドルリファレンス](../../../packages/bundle/sdk-minimal/README.md)が正確なツリーを、[例リファレンス](../../../python/sdk/examples/README.md)が実行可能プログラムを所有する。[Python SDK リファレンス](../../../python/sdk/README.md)はライフサイクル・結果・通知・低レベル動作を扱い、[dsh CLI リファレンス](../../../apps/cli/reference/README.md)はプロファイル層化を扱う。
