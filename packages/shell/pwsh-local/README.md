---
description: "shell シーム上で非封じ込めの PowerShell コマンド実行を選択、設定、またはデバッグするデプロイメントとメンテナーのためのローカル PowerShell エグゼキューター。"
kind: "package-reference"
---

# @deepseek-ai/dsh-pwsh-local

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-pwsh-local` は PowerShell エグゼキューターである: すべてのコマンドはプロファイルファイルのない新しい非対話的な `pwsh -Command` プロセスとして実行されるため、呼び出し間でシェル状態は一切残らない。`dsh-bash-local` のセマンティクスを呼び出しごとにミラーし、PowerShell 固有の関心事 — 実行ファイルの解決、UTF-8 出力の固定、およびモデルにやさしいターミナル環境 — を加える。コマンドは Harness プロセス自身の権限で実行される — このエグゼキューターは何も封じ込めない; コマンドがサンドボックスケイパビリティを必要とする場合は `dsh-pwsh-sandbox` をコンポーズする。モデル向けの `pwsh` ツールは、これがマウントされるとそれと対話する。

## 目次

- [本パッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と延期された作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## 本パッケージを使う

コンポジションが封じ込めなしの PowerShell コマンド実行 — 通常は Windows 上 — を必要とする場合にこのエグゼキューターをマウントする。これは `ctx.shell` として登録され、モデル向けの `pwsh` ツールは直ちにその上で機能する: エージェントがツールを呼び出すと、コマンドは以下の予算で新しい `pwsh -Command` プロセスとして実行される。

### いつ選ぶか

これは `dsh-bash-local` の Windows 版である: `pwsh` がプラットフォームシェルである場所でこれを選び、コンポジションが POSIX の行を pwsh の行に入れ替えても同じセマンティクスを保てるようにする。エグゼキューターは `pwsh` 実行ファイルを、明示的な `pwshPath`、よく知られた Windows のインストール場所、PATH エントリー、または最後の手段として Windows PowerShell 5.1 から解決する。非封じ込め実行ではこれがデフォルトである; コマンドがサンドボックスケイパビリティを必要とする場合は `dsh-pwsh-sandbox` をコンポーズする。

### 最小構成

望む予算でエグゼキューターをロードする; すべてのフィールドにデフォルトがあるため、最小のコンポジションはプラグインエントリーのみである。settings プロバイダー (コンポーズされている場合) はこのエントリーの上にユーザーセクションを重ねるため、リロードなしで実行時に予算を変更できる ([実行時の予算の調整](#adjusting-budgets-at-runtime)を参照)。

```yaml
- id: bash
  name: '@deepseek-ai/dsh-pwsh-local'
  config:
    cwd: C:\path\to\workspace
    timeoutMs: 120000
```

| フィールド | デフォルト | 意味 |
|---|---|---|
| `cwd` | `process.cwd()` | コマンドのデフォルト作業ディレクトリ |
| `timeoutMs` | `120,000` | デフォルトのフォアグラウンドタイムアウト (ミリ秒) |
| `maxTimeoutMs` | `600,000` | 呼び出しごとのタイムアウト上書きの上限 |
| `maxOutputBytes` | `64,000` | ストリームごとのインメモリ出力上限; 超過分は一時ファイルへ spill される |
| `maxSpillBytes` | `67,108,864` | ストリームごとの全出力 spill 上限 |
| `graceMs` | `3,000` | kill エスカレーションと終了後のパイプドレインの猶予期間 |
| `pwshPath` | 解決済み | 明示的な pwsh 実行ファイル; なければよく知られた場所、次に PATH |

生成された[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-pwsh-local)が、受け入れられるすべてのフィールドとその JSDoc の網羅的な情報源である。

### コマンドの実行

実行の `result()` プロジェクションを await してコマンドを実行する; 非ゼロ終了、タイムアウト、またはキャンセルは説明的に解決し、インフラストラクチャの失敗だけが拒否する。コマンド文字列は `-Command` への 1 つの引数として渡される: PowerShell がテキスト自体を解析し、中間シェルは存在しないため、エスケープすべきシェル引用層はなく、ネイティブの Win32 パスはそのまま通る。すべてのコマンドは最初に UTF-8 出力を固定するため、Windows PowerShell 5.1 フォールバックでも非 ASCII 出力が文字化けしない。環境はモデルにやさしい: `NO_COLOR=1 PAGER=cat GIT_PAGER=cat` (`TERM=dumb` は POSIX の概念なのでなし)、呼び出し元が明示的に提供したエントリーは引き続き優先される。

```text
const execution = await ctx.shell.execute(ctx.shell.resolve({ command: 'Get-ChildItem' }))
const result = await execution.result()
if (result.timedOut) console.log('timed out after', result.timeoutMs)
```

### バックグラウンドプロセス

`onExpiry: 'none'` で解決し `execute` を await してコマンドをバックグラウンドで実行する; 期限は設定されない。キャンセルまたは準備の失敗はハンドルが公開される前に拒否する。`readOutput()` はストリーム差分を 1 つの消費読み取りにマージし、stderr を `[stderr]` セクションの下に印付ける; `kill()` はプロバイダー管理レンジを終了させる; `done` は直接コマンドが閉じたときに決着し、決して拒否しない。ジョブ id、所有権、ポーリング、通知は汎用の `ctx.jobs` ランタイムに属し、ツール層がハンドルをそこに登録する。

<a id="adjusting-budgets-at-runtime"></a>
### 実行時の予算の調整

実行予算は揮発性の Config フィールドであり、各コマンドの解決時に標本化される。Plugins ページはアクティブなエグゼキューターのプロファイルエントリーを編集する。完全な Config 検証は、フォーム書き込みがディスクに到達する前に無効な数値とタイマー制限を拒否する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションはエグゼキューターの設計と、それを実現するコードを指し示す; 観察可能な挙動は[本パッケージを使う](#use-this-package)で完全に扱う。

### 設計概念

エグゼキューターは subprocess ケイパビリティ上に構築された `ctx.shell` シームの PowerShell サービスプロバイダーである: pwsh 固有のものすべて — 実行ファイルの解決、コマンドのデフォルト化と上限、期限の融合と原因分類、UTF-8 出力の固定、モデルにやさしいターミナル環境、バックグラウンド読み取りのマージ — を所有し、管理レンジの機構 (上限付き spill ベースの出力、クレデンシャル洗浄、終了エスカレーション、静止、および破棄) は subprocess サービスに属する。すべての呼び出しは `-NoLogo -NoProfile -NonInteractive` 付きの新しい非対話的な `pwsh -Command` を spawn するため、コマンドは決定論的で、プロファイル状態が呼び出し間で漏れることは決してない。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: `PwshLocalExecutor`、`Config`、settings 配線、argv シーム |
| [`src/resolve.ts`](src/resolve.ts) | 純粋な `resolvePwshPath`/`candidatePwshPaths` 実行ファイル解決 |
| `tests/` | 実証される挙動: 予算、分類、解決、バックグラウンドハンドル |

### メインフロー

呼び出しは 3 つのステップを通る: `resolve()` が設定から `workdir`/`timeoutMs`/`stdoutMaxBytes` を埋め (呼び出しごとの `timeoutMs` 上書きに上限を適用する); エグゼキューターは pwsh の argv — `pwsh -NoLogo -NoProfile -NonInteractive -Command <encoding preamble + command>` — を構築し、設定でクランプされたタイムアウトと呼び出し元の abort シグナルを 1 つの期限に融合し、明示的なバイト上限と `graceMs` を伴って `ctx.subprocess` を通じて spawn する; 決着した結果は分類され `ShellRunResult` へ投影される。Windows は強制終了をシグナルなしの終了コード 1 として報告するため、シグナルを刻まれた事実はそこでは POSIX 専用である; タイムアウト/abort の分類はプラットフォーム非依存である。

フォアグラウンドの期限は argv 準備の前に始まり、実行を通じて同じシグナルと残り予算を保持する。準備のタイムアウトは空の出力、`timedOut: true`、および null の `exitCode` と `signal` を返す; プロセス公開前の呼び出し元キャンセルは依然として拒否する。遅れての準備の成功または失敗が spawn を引き起こすことはできない。

### 不変条件と所有権

- `graceMs` 予算は正で有限であり、Node が 1 つのタイマーで表現できるよう `MAX_TIMER_DELAY_MS` 以下でなければならない; 無効な値は書き込まれる場所で拒否される。
- 環境の重ね合わせは固定である: 最初にターミナルの上書き、次に呼び出し元の `env`、最後に信頼された `dshEnv` スナップショット; subprocess サービスはアンビエントのクレデンシャルと継承された `DSH_*` 名を独立に洗浄する。
- 実行ファイル解決は `(configured, env, platform)` の純粋関数であり、保存された `pwshPath` が現在の実行ファイルの解決元と異なる場合にのみファイルシステムを再探索する。
- バックグラウンドプロセスは subprocess サービスに属する: エグゼキューターだけのリロードを生き延び、サービスの破棄時に kill されて join される。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

エグゼキューターの契約では不十分なときにこれらのページを読む。シームから封じ込めを行う兄弟と PowerShell ツールへ進む。

- [shell シーム](../shell/README.md) — このプロバイダーが実装するエグゼキューター契約 (request/spec 分割を含む)。
- [bash-local](../bash-local/README.md) — このエグゼキューターが呼び出しごとにミラーする POSIX の対応物。
- [pwsh-sandbox](../pwsh-sandbox/README.md) — コマンドがサンドボックスケイパビリティを必要とするときに代わりにコンポーズする封じ込めエグゼキューター。
- [tool-pwsh](../tool-pwsh/README.md) — このエグゼキューター上のモデル向け `pwsh` ツール。
- [Bash エグゼキューターサブシステム](../../../docs/subsystems/shell.md) — request/spec の語彙、結果、およびサービス契約の全体。

-----

<a id="model-experience"></a>
## モデル体験

間接的に、`dsh-tool-pwsh` を通じて。それはこのエグゼキューターの上限付き stdout/stderr テール、バックグラウンドプロセスの差分 (汎用ジョブランタイム経由)、spill ファイルパス、およびインフラストラクチャの失敗をレンダリングする。

#### KV キャッシュへの影響

直接の無効化はなし; 名前を挙げられたコンシューマーがリクエストプレフィックスの変更を所有する。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このエグゼキューターが適さない場合を定義する。それらは現在のパッケージ制約であり、ロードマップではない。

- **単体では非封じ込め** — コマンドは Harness プロセス権限で実行される; 封じ込めを必要とするデプロイメントは代わりにサンドボックスエグゼキューターまたはポリシーをコンポーズする。
- **永続シェルまたは PTY なし** — すべての呼び出しが新しい `pwsh -Command` を開始する。
- **コマンド文字列は PowerShell テキストである** — `-Command` の領域にはシェル引用層はないが、モデル向けのコマンドは PowerShell 自身が解析するため、PowerShell の構文エラーは起動の失敗ではなくコマンドの失敗である。
- **バックグラウンドのプロバイダー失敗ノートが stderr ストリームの全体である** — `SubprocessHandle.done` はターゲット実行の開始前または後に拒否しうるし、subprocess サービスは報告しなかったターゲットの出力を何もバッファしないため、エグゼキューターはステージ中立の `subprocess failed before reporting an outcome: …` を観察された stderr ストリームとして提供し (オフセットリーダーは自身のオフセットで再読する)、それをちょうど 1 つの `readOutput()` 差分に畳み込む; その差分を捨てる消費リーダーは `observed.stderr` を通じてのみそれを回復できる。
- **Windows の終了はシグナルを報告しない** — 強制 kill されたプロセスは `signal: null` とともに終了コード 1 として決着するため、シグナルベースのステータス分類は Windows では適用されない; `kill()` 起点の停止は依然として直接 `killed` を刻む。
- **エンコーディングプリアンブルはコマンドの前に置かれる** — PowerShell は `param(...)`、`#requires`、および `using` ステートメントをスクリプトの最上部に要求するため、最初のステートメントがそれらのいずれかであるコマンドは UTF-8 出力プリアンブルの下では実行できない; `param(...)` スクリプトは `& { … }` で包み、`using`/`#requires` スクリプトは代わりにファイルから実行する。
- **Windows PowerShell 5.1 での非 ASCII stdin は誤デコードされる可能性がある** — プリアンブルは出力エンコーディングのみを固定する; `[Console]::InputEncoding` は、リダイレクトされた stdin の下で設定すると例外を投げるため、ホストのデフォルトのままである; pwsh 7 は UTF-8 がデフォルトであり影響を受けない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
