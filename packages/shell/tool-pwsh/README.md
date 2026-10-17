---
description: "Windows でのワンショット PowerShell 実行、バックグラウンドジョブ、サンドボックスエスカレーションの選択・設定・デバッグを行うユーザーとメンテナー向けの、モデルに公開される pwsh ツール。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-pwsh

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-tool-pwsh` は、マウントされたシェルエグゼキューターを通じてエージェントが PowerShell コマンドを実行できるようにする。呼び出しごとに新しいプロセスを使用し、ジョブレジストリが構成されている場合はすべてのコマンドが開始した瞬間からジョブになるため、`run_in_background` は即座に id を返し、タイムアウトを超えて生き残ったフォアグラウンドコマンドも同じ id を返して、観察可能な出力を伴う。コマンドは方言変換なしでネイティブの Windows パスと `$env:NAME` 変数を使用する。呼び出しは管理された `DSH_*` 環境を受け取り、サンドボックス実行では Windows の言語モードと名前付きパイプの要件が適用される。`dsh-pwsh-local` のような PowerShell エグゼキューターと `dsh-shell-env` プラグインとともにマウントする。

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

新しいコマンドは Session の現在の作業ディレクトリで開始する。相対的な `workdir` 値はそのディレクトリから解決され、呼び出しごとの上書きとバックグラウンドジョブはこれを変更しない。

エージェントが PowerShell コマンドを実行すべきあらゆる構成でこのプラグインをロードする — 通常は、`ctx.shell` が PowerShell エグゼキューターに支えられた Windows 構成である。エグゼキュータープロバイダーと `dsh-shell-env` レジストリがマウントされると、`pwsh` ツールを登録する。

### どちらを選ぶか

コマンドを PowerShell で — ネイティブパスと `$env:` 変数で — 書く必要がある場合、またはデプロイメントが Windows ネイティブである場合は pwsh ツールを選ぶ。コマンドセットが bash 方言である場合は `dsh-tool-bash` を選ぶ。両者の間に変換はない。呼び出しをまたぐ状態 (cwd、変数) が必要な作業には、永続的な対応版 [`dsh-tool-pwsh-persistent`](../tool-pwsh-persistent/README.md) がオーナースコープの 1 つのシェルを生かし続ける。

### 最小構成

一般的な経路は、PowerShell エグゼキュータープロバイダー、環境レジストリ、そしてこのツールである。

```yaml
- name: '@deepseek-ai/dsh-pwsh-local'
- name: '@deepseek-ai/dsh-shell-env'
- name: '@deepseek-ai/dsh-tool-pwsh'
```

設定フィールドはバックグラウンドサーフェスを統制する。

| フィールド | デフォルト | 意味 |
|---|---|---|
| `enableRunInBackground` | `true` | ジョブレジストリが構成されている間 `run_in_background` を公開する。`false` のとき、強制されたバックグラウンド呼び出しは拒否される |
| `promoteOnTimeout` | `true` | タイムアウトに達したフォアグラウンドコマンドを kill せず、そのバックグラウンドジョブとして実行し続ける |

生成された[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-tool-pwsh)が、受け付けられるすべてのフィールドとその JSDoc の網羅的な情報源である。生成された[ツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-pwsh)が完全な引数スキーマを収録している。

### コマンドの実行

ツールは `pwsh -Command <command>` を実行し、結合された出力を返す。コマンドは呼び出しごとに新しい pwsh プロセスで実行されるため、状態は決して永続化されない — `cd` の代わりに `workdir` を渡す。パスはネイティブ Windows 形式を使い、環境変数は `$env:NAME` で読む。非ゼロ終了は `[exit code: N]` として報告される。Windows では強制 kill されたコマンドはシグナルマーカーなしで `[exit code: 1]` として落ち着くため、エージェントは中断後の裸の exit 1 をコマンド失敗ではなく終了として扱う。スキーマは `description` を `command` より前に列挙し、JSON メンバー順を強制することなく、モデルに最初にそれを出力するよう求める。description は、削除や移動の前に解決された絶対ターゲットパスを検証すること、および `$HOME` のような自動変数に代入しないことをエージェントに伝える。バックグラウンド実行、出力の切り詰め、`description`/`timeoutMs`/`workdir` 引数は、非同期シェル準備中のジョブ所有のキャンセルも含め、[`dsh-tool-bash`](../tool-bash/README.md#running-long-commands-in-the-background) とまったく同じように動作する。

### ジョブとしてのフォアグラウンドコマンド

ジョブレジストリが構成されている場合、フォアグラウンドコマンドは開始時に `ctx.jobs` に登録され、呼び出しはそのジョブを待つ。コマンドは一覧に表示され、`job.list` と `job.follow` を通じてストリームされ、実行中は Web タスクリストから停止できる。タイムアウト内に終了したコマンドは通常のフォアグラウンド結果を返し、そのジョブレコードも一緒にレジストリから離れるため、モデルは id を決して見ない。タイムアウトを超えて生き残ったコマンドは、すでにそうであったジョブとして実行を続け、呼び出しは `[still running after <timeoutMs>ms; moved to background job <id>]` とジョブ引き継ぎのガイダンスを返す。ガイダンスには、それまでの出力を 1 回消費する読み取りがシードされ、`job_output` はその続きから正確に読み進める。呼び出しの外部からの kill (人間によるジョブの停止) は、フォアグラウンド結果を終了マーカーより前に `[stopped: <reason>]` として確定するので、モデルはコマンド失敗ではなく理由を読む。呼び出し自体のキャンセルはジョブを kill する。登録はベストエフォートである: `promoteOnTimeout: false`、ジョブレジストリの欠如、または開始時にジョブを拒否するレジストリ (オーナーのジョブ上限、コントローラーなし) では、代わりにエグゼキューターの期限 kill の下でコマンドを実行し、`timeoutMs` パラメーターの説明は引き継ぎが成り立つ場合にのみそれを告知する。

### Windows 固有のサンドボックス動作

サンドボックス化エグゼキューターの下では、拒否されたコマンドは `[sandbox: file access denied under <mode> mode]` を報告し、同じワンショットエスカレーション経路が適用される: 正確なコマンドを `sandbox_permissions` と `justification` を付けてユーザー承認を通じて 1 回再試行する。justification は、現在のユーザーリクエストの言語を使うようモデルに求める。ツールはまた、その説明の中で Windows 制限トークンの 2 つの契約を教える: 読み取り専用 pwsh は ConstrainedLanguage で実行され (`.NET` 静的呼び出し、`Add-Type`、COM、リフレクションは "only core types" エラーで失敗する)、両方の隔離モードではプログラムが名前付きパイプを開けないため、パイプ経由の stdio で別のプログラムの出力を取り込むコマンドは EPERM で失敗する — 正確なコマンドを 1 回エスカレーションするか、出力の取り込みを避けるよう再構成する。

### 失敗しうるもの

PowerShell エグゼキューターのない構成ではツールは決して有効化されず、注入されるサービス (`tools`、`shell`、`systemPrompt`、`shellEnv`) はすべて存在しなければならない。ジョブランタイムのないバックグラウンド呼び出しは `background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs` で失敗し、サンドボックス化エグゼキューターのない `sandbox_permissions` は `sandbox_permissions is not available in this composition (no sandboxing executor to escalate)` で失敗する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

構造化されたフォアグラウンドとバックグラウンドの結果は、エグゼキューターが解決した起動ディレクトリである `cwd` を公開する。永続化されるプレゼンテーションメタデータも同じ値を運ぶので、確定したカードはその呼び出しが使用したディレクトリを保持する。コマンド自身の `cd` はこの起動値を変えない。ネイティブの結果テキストは stdout、stderr、ステータスマーカーのままである。

このセクションではツールの背後にある設計判断を説明し、それを実現するコードを示す。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱う。

### 設計方針

- **`dsh-tool-bash` の意図的な双子。** フォアグラウンドとバックグラウンドの実行、管理環境、サンドボックスエスカレーションサーフェス、マーカー/切り詰めのレンダリングは、bash ツールを呼び出しごとに鏡写しにするので、一方のコンシューマーは他方のワイヤ形式を受け入れられる ([pwsh ツール bash 同等性リファレンス](README.md))。
- **PowerShell 方言の契約。** ツールの契約は PowerShell である: ネイティブパスと `$env:` 変数、中間シェルなしで `pwsh -Command` を通じて実行する。
- **説明の中で教える Windows サンドボックスの事実。** ConstrainedLanguage と名前付きパイプの契約は Windows 制限トークンの動作である。それらを教える条件は「何らかの隔離エグゼキューターがマウントされていること」であり、同梱されるすべての組み合わせが win32 専用であるため、これは安全である。
- **非ゼロ終了はエラーではなく報告される。** インフラストラクチャの失敗 (spawn エラー、中断) のみがツールエラーとして表面化し、bash と同じ筋書きである。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: ツール登録、プロンプトセクション、引数検証、エスカレーション、リクエスト組み立て |
| [`src/background.ts`](src/background.ts) | 確定したプロセスを汎用ジョブ結果語彙に写像し、リング読み取りをプロセス読み取りとしてレンダリングする |
| [`src/render.ts`](src/render.ts) | モデルに公開される結果テキスト: ストリーム、マーカー、切り詰め通知 (bash の双子) |

### レンダリングと終了マーカー

レンダラーは bash ツールの構造と `dsh-shell` の `parseExitStatus` マーカー契約を共有する: クリーンな終了 (0、シグナルなし) はマーカーを生成しない。UI カードは終了マーカーを終了ステータスピルとして消費する。Windows の強制終了はシグナルなしの exit 1 として落ち着くので、`[killed by signal: …]` はそこでは POSIX 専用である。`tool:pwsh` プロンプトセクション (ファーストパーティ順序 1010) は終了マーカーの慣例と、Windows での中断後 exit 1 の読み方を教える。

</details>

-----

<a id="further-exploration"></a>
## さらなる探索

パッケージレベルの契約では足りないときにこれらのページを読む。シェルファミリーからエグゼキューターシームへ、そして Windows 動作の背後の設計ノートへ進む。

- [shell パッケージマップ](../README.md) — bash ケイパビリティファミリーとその役割。
- [Bash エグゼキューターサブシステム](../../../docs/subsystems/shell.md) — リクエスト/スペック語彙、結果、バックグラウンドプロセス。
- [shell-env](../shell-env/README.md) — すべての呼び出しが受け取る管理された `DSH_*` 環境。
- [tool-jobs](../../jobs/tool-jobs/README.md) — バックグラウンド実行のための `job_output`、`job_list`、`job_kill` コントロール。
- [歴史的な pwsh ツール bash 同等性 Agent Note](../../../.agents/notes/archived/feature/2026-08-02-pwsh-tool-bash-parity.md) — このツールが bash ツールを鏡写しにする理由。
- [Windows ACL 制限トークンサンドボックス Agent Note](../../../.agents/notes/implemented/feature/2026-08-08-windows-acl-restricted-token-sandbox.md) — 言語モードと名前付きパイプの契約。
- [生成されたツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-pwsh) — 正確な `pwsh` 引数スキーマ。
- [生成された設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-tool-pwsh) — 受け付けられるすべての設定フィールドとそのソース宣言。

-----

<a id="model-experience"></a>
## モデル体験

### システムプロンプト

#### モデルが見るもの

このプラグインの登録スコープ内のすべてのリクエストは、ファーストパーティ順序 1010 で以下の pwsh ガイダンスを含む。スコープ付きツール制限は、この独立に登録されたセクションを削除せずにスキーマを隠すことができる。

##### pwsh ガイダンス

```markdown
Non-zero exits are reported as `[exit code: N]` markers; investigate failures before moving on. On Windows a killed process settles as `[exit code: 1]` without a signal marker; treat a bare exit 1 after an interruption as a termination, not a command failure.
```

#### トークン効果

プラグインがアクティブな間、リクエストごとに小さな固定の入力コスト。

#### KV キャッシュ効果

登録スコープとプロンプトテキストが変わらない間はプレフィックス安定。プラグインのアクティブ化または破棄により、このプロンプトセクションからの再利用が無効化されることがある。

### ツールスキーマ

#### モデルが見るもの

モデルは生成された [`pwsh` スキーマ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-pwsh)を見る。その justification は、現在のユーザーリクエストの言語を使うようモデルに求める。エージェントスコープのツール制限は、そのエージェントの定義を削除できる。

#### トークン効果

ツールが可視であるすべてのリクエストに固定のスキーマコスト。

#### KV キャッシュ効果

可視性とツール定義が変わらない間はプレフィックス安定。制限または設定の変更は、最初に変更されたトークンからの再利用を無効化することがある。

### フォアグラウンド結果

#### モデルが見るもの

レンダラーはデータ依存の stdout テールを出力し、続いて省略可能な `[stderr]` と stderr テールを出力する。条件付き行はちょうど `[output truncated; full output: <path-or-(unavailable)>]`、`[sandbox: file access denied under <mode> mode]` に加えてエスカレーションヒント `[sandbox: escalation available — …]` (構成がエスカレーションを告知する場合のみ)、`[timed out after <timeoutMs>ms]`、`[stopped: <reason>]`、`[killed by signal: <signal>]`、`[exit code: <exitCode>]` (非ゼロ終了のみ) である。空の本文は `(no output)` としてレンダリングされる。

#### トークン効果

呼び出し前はゼロ結果トークン。出力はストリームごとに上限が課され、出力された各行はコンパクションまで履歴に残る。

#### KV キャッシュ効果

追記専用。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しない。

### バックグラウンド結果

#### モデルが見るもの

バックグラウンド開始はちょうど `started background job <id>` をレンダリングする。以後の読み取りとステータスは汎用の `job_output`/`job_kill` ツールを通じて流れる。メモリ内切り詰めが未読バイトを落としたときの損失読み取りスピル通知も含む。

#### トークン効果

ack は固定の短い行であり、ジョブ出力は読み取りごとに上限が課される。

#### KV キャッシュ効果

追記専用。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しない。

### ツールエラー

#### モデルが見るもの

検証とインフラストラクチャの失敗は `Error: <message>` として正規化される。このパッケージの安定メッセージは `invalid command: expected a non-empty string`、`invalid description: expected a non-empty string`、`invalid timeoutMs: expected a positive number, got <value>`、エスカレーションペアの失敗、`sandbox_permissions is not available in this composition (no sandboxing executor to escalate)`、共有エスカレーションの失敗 (厳密に広くない / 承認サービスなし / ルーティング先エージェントなし / 承認チャネルなし / ユーザー拒否 / キャンセル済み)、`run_in_background is disabled for this deployment (enableRunInBackground: false)`、`background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs`、`tool call aborted` である。

#### トークン効果

失敗した呼び出しだけがこれらの保持トークンを追加する。中断された呼び出しはコマンド出力を追加しない。

#### KV キャッシュ効果

追記専用。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリーを無効化しない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、ツールが不適切になる、または特別な注意を要する条件を定める。それらは現在のパッケージ制約であり、タスクバックログではない。

- **Windows サンドボックス下の言語モードと名前付きパイプの取り込み** — [Windows ACL サンドボックス](../../sandbox/sandbox-windows-acl/README.md)では、読み取り専用 pwsh は ConstrainedLanguage で開始する。その一時書き込みの拒否により PowerShell の AppLocker プローブがフェイルクローズするからである: `Add-Type`、非コア .NET 静的 (`[System.IO.*]::`、`[math]::`)、COM オブジェクト、リフレクションは "only core types" エラーで失敗し、モードを内部から解除できない。Workspace-write のプライベート一時領域ではプローブが完了できるため、ホストポリシーが別途指示しない限り FullLanguage のままである。両方の隔離モードは名前付きパイプのオープンを拒否するため、隔離されたコマンド内のパイプ stdio での spawn は EPERM で失敗する。ツール説明は両方の契約をモデルに教える。バックエンド README が完全な制限を所有する。
- **永続シェルなし** — すべての呼び出しは新しい `pwsh -Command` を開始する。永続シェルの対応版は [`@deepseek-ai/dsh-tool-pwsh-persistent`](../tool-pwsh-persistent/README.md) であり、呼び出しをまたいで 1 つのオーナースコープ pwsh を生かし続ける。
- **PowerShell 方言の契約** — モデルは bash ではなく PowerShell (ネイティブパス、`$env:` 変数) を書かなければならない。方言変換はない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
