---
description: "シェルシーム上で非閉じ込めのコマンド実行を選択、設定、デバッグするデプロイメントとメンテナー向けの、デフォルトの POSIX Bash エグゼキューター。"
kind: "package-reference"
---

# @deepseek-ai/dsh-bash-local

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-bash-local` は POSIX 向けのデフォルト Bash エグゼキューターである: すべてのコマンドは rc ファイルなしの、新規の非ログイン `bash -c` プロセスとして実行されるので、呼び出し間でシェル状態は残らない。設定された予算 — 作業ディレクトリ、タイムアウト、出力上限 — を各コマンドに適用し、タイムアウトとキャンセルを分類し、ストリームが溢れたときにスピルファイル回復を伴う上限付き出力を返す。コマンドはハーネスプロセス自身の権限で実行される: このエグゼキューターは何も閉じ込めないので、コマンドがサンドボックスのケイパビリティを必要とする場合は `dsh-bash-sandbox` を構成すること。モデル向けの `bash` ツールはこれがマウントされるとこれと話す。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらなる探索](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

構成が POSIX 上で閉じ込めなしの Bash コマンド実行を必要とするときにこのエグゼキューターをマウントする。これは `ctx.shell` として登録され、モデル向けの `bash` ツールがすぐにその上で機能する: エージェントがツールを呼ぶと、コマンドは以下の予算で新規の `bash -c` プロセスとして実行される。

### 最小構成

望む予算でエグゼキューターをロードする。すべてのフィールドにデフォルトがあるので、最小の構成はプラグインエントリーだけである。設定プロバイダー（構成されている場合）はこのエントリーの上にユーザーセクションを重ねるので、予算はリロードなしに実行時に変更できる（[実行時の予算調整](#adjusting-budgets-at-runtime)を参照）。

```yaml
- id: bash
  name: '@deepseek-ai/dsh-bash-local'
  config:
    cwd: /path/to/workspace
    timeoutMs: 120000
```

| フィールド | デフォルト | 意味 |
|---|---|---|
| `cwd` | `process.cwd()` | コマンドのデフォルト作業ディレクトリ |
| `timeoutMs` | `120,000` | デフォルトのフォアグラウンドタイムアウト（ミリ秒） |
| `maxTimeoutMs` | `600,000` | 呼び出しごとのタイムアウト上書きの上限 |
| `maxOutputBytes` | `64,000` | ストリームごとのインメモリ出力上限。溢れは一時ファイルにスピルする |
| `maxSpillBytes` | `67,108,864` | ストリームごとの完全出力スピル上限 |
| `graceMs` | `3,000` | kill エスカレーションと終了後のパイプドレインの猶予期間 |

生成された[構成カタログ](../../../docs/config-catalog.md#deepseek-aidsh-bash-local)が、受理されるすべてのフィールドとその JSDoc の網羅的なソースである。

### コマンドの実行

実行の `result()` プロジェクションを await してコマンドを実行する。非ゼロ終了、タイムアウト、キャンセルは説明的な結果で解決し、拒否するのはインフラストラクチャ失敗のみである。呼び出しごとの `timeoutMs` 上書きは設定によって上限がかけられ、`workdir` は未設定のとき設定されたデフォルトにフォールバックする。信頼された呼び出し元は呼び出しごとの stdout キャプチャ予算を引き上げることもでき、stderr は `maxOutputBytes` を保つ。環境はデフォルトでモデルにやさしい: `NO_COLOR=1 TERM=dumb PAGER=cat GIT_PAGER=cat` はページャーと ANSI カラーが出力を乱すのを防ぎ、呼び出し元が明示的に与えたエントリーは依然として勝つ。

```text
const execution = await ctx.shell.execute(ctx.shell.resolve({ command: 'ls -la' }))
const result = await execution.result()
if (result.timedOut) console.log('timed out after', result.timeoutMs)
```

### バックグラウンドプロセス

`onExpiry: 'none'` で resolve して `execute` を await すると、コマンドをバックグラウンドで実行する。期限は設定されない。キャンセルまたは準備失敗はハンドルが公開される前に拒否する。`readOutput()` はストリームのデルタを 1 つの消費読み取りにマージし、stderr を `[stderr]` セクションの下にマークする。`kill()` はプロバイダーが管理する範囲を終了させる。`done` は直接コマンドが閉じたときに決着し、決して拒否しない。ジョブ id、所有権、ポーリング、通知は汎用の `ctx.jobs` ランタイムに属し、ツールレイヤーがハンドルをそこに登録する。

<a id="adjusting-budgets-at-runtime"></a>
### 実行時の予算調整

実行予算は、各コマンドを解決するときにサンプリングされる揮発性の Config フィールドである。Plugins ページがアクティブなエグゼキューターのプロファイルエントリーを編集する。完全な Config 検証は、フォームの書き込みがディスクに到達する前に無効な数値とタイマー制限を拒否する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションではエグゼキューターの設計を説明し、それを実現するコードを指し示す。観察可能な挙動は[このパッケージを使う](#use-this-package)で網羅されている。

### 設計概念

このエグゼキューターは subprocess ケイパビリティ上に構築された `ctx.shell` シームの Service Provider である: bash らしいものすべて — コマンドのデフォルト化と上限、期限の融合と原因分類、モデルにやさしいターミナル環境、バックグラウンド読み取りのマージ — を所有し、管理範囲の機構（上限付きスピル裏付け出力、資格情報スクラブ、終了エスカレーション、静止、破棄）は subprocess サービスに属する。すべての呼び出しは rc ファイルなしの新規の非ログイン `bash -c` をスポーンするので、コマンドは決定論的で、シェル状態が呼び出し間で漏れることはない。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: `LocalBashExecutor`、`Config`、設定セクションの配線 |
| `tests/executor.spec.ts` | 検証される挙動: 予算、分類、バックグラウンドハンドル、所有権 |
| `tests/settings.spec.ts` | 構成エントリーの上への設定の階層化 |

### メインフロー

呼び出しは 3 つのステップを経る: `resolve()` が config とリクエストから `workdir`/`timeoutMs`/`onExpiry`/`stdoutMaxBytes` を埋め（呼び出しごとの上書きに上限をかける）。`execute` が期限ポリシーに従って期限を配線する — `'kill'` はクランプされたタイムアウトと呼び出し元の abort シグナルを融合し、`'none'` は何も設定しない — そして明示的なバイト上限と `graceMs` を伴って `ctx.subprocess` を通じて `['bash', '-c', command]` をスポーンする。決着した結果は第一原因で分類される — エグゼキューター自身のタイムアウトだけが `timedOut` を報告し、上流のキャンセルは `aborted` を報告し、自らシグナルしたコマンドはどちらも報告しない — そして `result()` がそれを収集された出力を持つ `ShellRunResult` に投影する。

フォアグラウンドの期限は argv の準備前に始まり、実行を通じて同じシグナルと残りの予算を保持する。準備のタイムアウトは空の出力、`timedOut: true`、null の `exitCode` と `signal` を返す。プロセス公開前の呼び出し元のキャンセルは依然として拒否する。遅れての準備の成功または失敗がスポーンをトリガーすることはできない。

### 不変条件と所有権

- `graceMs` の予算は正で有限で、`MAX_TIMER_DELAY_MS` 以下でなければならない（Node が 1 つのタイマーで表現できるように）。無効な値はそれが書き込まれる場所で拒否される。
- 環境の階層化は固定である: 最初にターミナルの上書き、次に呼び出し元の `env`、最後に信頼された `dshEnv` スナップショット。subprocess サービスは周囲の資格情報と継承された `DSH_*` 名を独立にスクラブする。
- バックグラウンドプロセスは subprocess サービスに属する: エグゼキューターだけのリロードを生き延び、サービスが破棄されるときに kill されて join される。

</details>

-----

<a id="further-exploration"></a>
## さらなる探索

エグゼキューターの契約では足りないときにこれらのページを読むこと。シームから、閉じ込めを行う姉妹とその下の機構へと進む。

- [shell シーム](../shell/README.md) — このプロバイダーが実装するエグゼキューター契約（request/spec 分割を含む）。
- [bash-sandbox](../bash-sandbox/README.md) — コマンドがサンドボックスのケイパビリティを必要とするときに代わりに構成する閉じ込めエグゼキューター。
- [tool-bash](../tool-bash/README.md) — このエグゼキューター上のモデル向け `bash` ツール。
- [Bash エグゼキューターサブシステム](../../../docs/subsystems/shell.md) — request/spec の語彙、結果、サービス契約の全体。
- [subprocess-local](../../subprocess/subprocess-local/README.md) — このエグゼキューターの背後の管理範囲機構。

-----

<a id="model-experience"></a>
## モデル体験

間接的に、`dsh-tool-bash` を通じて。これがこのエグゼキューターの上限付き stdout/stderr テール、バックグラウンドプロセスのデルタ、スピルファイルパス、インフラストラクチャ失敗をレンダリングする。

#### KV キャッシュ効果

直接の無効化はない。名前を挙げられたコンシューマーがリクエストプレフィックスの変更を所有する。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このエグゼキューターが不向きな場合を定義する。これらは現在のパッケージ制約であり、ロードマップではない。

- **それ自体は閉じ込めない** — コマンドはハーネスプロセス自身の権限で実行される。閉じ込めを必要とするデプロイメントは `dsh-bash-sandbox` を構成し、呼び出しごとの allow/deny/ask ポリシーはツールの `pre-execute` ウォーターフォールに属する。
- **永続シェルも PTY もない** — すべての呼び出しが新規の非ログイン `bash -c` を開始する。cwd のみの永続化と対話的ターミナルセッションは、実際のワークフローがそれを必要とするまで先送りのままである。
- **POSIX 専用** — `bash` バイナリはハードコードされており、基盤サービスのグループセマンティクスは POSIX である。Windows は非サポートである。
- **バックグラウンドのプロバイダー失敗ノートは stderr ストリーム全体である** — `SubprocessHandle.done` はターゲットの実行開始の前にも後にも拒否しうる。subprocess サービスは一度も報告しなかったターゲットの出力をバッファリングしないので、エグゼキューターはステージ中立の `subprocess failed before reporting an outcome: …` を観測された stderr ストリームとして供給し（オフセットリーダーは自身のオフセットでそれを再読み取りする）、それをちょうど 1 つの `readOutput()` デルタに畳み込む。そのデルタを破棄する消費側リーダーは `observed.stderr` を通じてのみそれを回復できる。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
