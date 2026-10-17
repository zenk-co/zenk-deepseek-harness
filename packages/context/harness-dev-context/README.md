---
description: "DeepSeek Harness チェックアウトと GUI URL を名指ししつつ、どちらもシステムプロンプトを変更しないようにする、Web GUI のユーザーとメンテナー向けのモデルコンテキスト。"
kind: "package-reference"
---

# @deepseek-ai/dsh-harness-dev-context

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-harness-dev-context` は、DeepSeek Harness Web GUI の背後で実行されるエージェントに、harness 実装チェックアウトがどこにあるか、GUI が「このページ」とどう関係するか、どの URL がそれを提供するかを伝える。システムプロンプトは値を持たないガイダンスのみを運び、現在のチェックアウトパスと GUI URL はランタイムコンテキストとして到着するため、別のチェックアウト、ポート、インストールからプロセスを開始しても、セッションの記録済みシステムプロンプトが書き換えられることは決してない。プロンプトに以前のリリースのそれらの値を依然として埋め込んでいるセッションは、そのテキストを逐語的に保つ。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらなる探索](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と延期された作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

出荷済み Web バンドルはこのプラグインを `harness-dev-context` 行としてマウントする。エージェントが harness チェックアウトや GUI URL を知るべきでない場合は、プロファイルパッチでその行を無効化する。このプラグインは設定を取らず、注入されたすべてのサービスが存在する場所でのみ有効化される: `systemPrompt`、`sessionProjections`、および Web ランタイムの `webApp` サービス。そのため `--help` や非 Web の構成では決してマウントされない。

### モデルが受け取るもの

2 つのシステムプロンプトセクションが、チェックアウトが作業ディレクトリと異なること、および「このページ」がこの GUI を意味することを、GUI 更新契約とともに説明する。2 つのランタイムコンテキスト行が現在の値を述べる: このパッケージの 4 つ上のディレクトリにあるインストールルートと、`webApp.getAdvertisedUrl()` からの Web GUI の告知 URL（`DSH_WEB_URL` および起動 URL と同じ値）。ランタイムコンテキストは共有スナップショットルールに従う: 変更のない値は何も追加せず、変更された値は以前のメッセージを書き換えるのではなくステップの入力の前にスナップショットを追加する。

### 以前のリリースのセッション

以前のリリースは両方の値をシステムプロンプトに埋め込んでいた。セッションの最新の非空システムプロンプトが依然としてそれらの正確な段落を含む場合、セクションはそれらを古い値を含めて逐語的に繰り返すため、後でポートやチェックアウトを変更してもそのセッションのプロンプトはバイト単位で同一のままである。ランタイムコンテキスト行は依然として現在の値を提供する。以前の段落に似ているだけのテキストは現在のガイダンスを受け取る。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションではプラグインの設計を説明する。観察可能な動作は[このパッケージを使う](#use-this-package)で扱う。

### 設計思想

ホスト専用のセッションプロジェクション `harnessDevLegacyPrompt` が、コミットされたすべての非空 `system/message` を、それが含む以前の形式の段落（1 行の値の周りの固定テキストで照合）に畳み込む。セクションテキストプロバイダーは `AssembleContext.agent` を通じてその状態を読み、エージェントのない組み立ては現在のガイダンスを使う。プロジェクションはセッション再開時に他のすべてのユニットとともに復元されるため、履歴イベントが同期的に読まれることはない。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリ: セクション、ランタイムコンテキスト、以前の形式のプロジェクション |

### メインフロー

有効化はプロジェクションユニット、両方のセクション、および両方のコンテキストを登録する。各組み立てでセクションは許可された以前の段落または現在のガイダンスを選び、各リクエスト受付でコンテキストは告知 URL を読む。プラグインファイバーの破棄はすべての登録を削除する。

</details>

-----

<a id="further-exploration"></a>
## さらなる探索

パッケージレベルの契約では足りないときにこれらのページを読む。決定記録から、このプラグインが読むサービスへと進む。

- [ランタイムコンテキストとしてのプロセス固有値](../../../.agents/notes/implemented/bug-fix/2026-10-11-process-specific-prompt-values-in-runtime-context.md) — なぜ値がシステムプロンプトを離れたか、以前のセッションがどう安定を保つか。
- [セッションプロジェクションサブシステム](../../../docs/subsystems/session-projection.md) — 以前の形式の状態が使うプロジェクション契約。
- [Web アプリバンドル](../../bundle/web-app/README.md) — `webApp` サービスとこのプラグインをマウントする行。
- [Context グループマップ](../README.md) — 兄弟のリクエストコンテキストパッケージ。

-----

<a id="model-experience"></a>
## モデル体験

### Harness チェックアウトと Web GUI

#### モデルが見るもの

ファーストパーティ順序 10000 と 10100 の 2 つのシステムプロンプト段落（再利用可能な命令の後）と、コンテキスト順序 200 と 210 の 2 つのランタイムコンテキスト行。以前のリリースで受け入れられたセッションは、以下の 2 つではなく、自身の以前の段落を見る。

##### システムプロンプト段落

```markdown
The runtime context names the DeepSeek Harness implementation checkout. The checkout location and current working directory are separate values and may differ; never infer the working directory from the checkout path. Use pwd to determine the current working directory. Use this checkout only to inspect or extend DSH itself.

You are interacting with the user through the DeepSeek Harness Web GUI whose URL the runtime context names. When the user refers to "this page", "this GUI", or "this app" without naming another target, they mean this GUI. The browser provides no implicit DOM, route, or screenshot context. The client-plugin HMR receiver is active, but client-plugin changes reload without a refresh only while `pnpm run dev:web` is also running from this same checkout to rebuild their bundles; verify that watcher before promising automatic updates. Every other change — the apps/web shell and plain packages — requires rebuilding the affected Web artifacts and verifying this existing URL after a page refresh. Starting another server does not update this GUI. The apps/web Vite entry builds the shell but is not a standalone application because only dsh web injects window.__DSH_BOOT__. Do not start a replacement server unless the user asks; if one is needed, use a managed background job and verify its exact URL.
```

##### ランタイムコンテキスト行

```markdown
Current DeepSeek Harness implementation checkout: "<installation root>".

Current DeepSeek Harness Web GUI URL: "<advertised URL>".
```

#### トークンへの影響

セッションごとに 2 つのプロンプト段落と、各ランタイムコンテキストスナップショットに 2 行。チェックアウトまたは URL が変わるとスナップショットが 1 つ追加される。

#### KV キャッシュへの影響

システムプロンプトはチェックアウト、ポート、インストール間で同一であるため、別の場所で開始されたプロセスはキャッシュされたプレフィックスを無傷のままにする。変更された値はその後にランタイムコンテキストスナップショットを 1 つ追加する。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は安定性保証が何をカバーするかを説明する。これらは現在のパッケージ制約である。

- **2 つの段落のみ** — リリース間で変わる他のシステムプロンプトテキストは、履歴内プロンプト更新のないルートで依然として最初のシステムメッセージを書き換える。
- **以前の値は残る** — 以前の形式のセッションは、そのライフタイム全体にわたりシステムプロンプトに古いチェックアウトパスと URL を保つ。現在なのは後のランタイムコンテキスト行だけである。
- **混在リリース** — このパッケージのないリリースは、それとともに開始されたセッションの最初のシステムメッセージを書き換えるため、共有 `DSH_HOME` にサービスを提供するすべてのチェックアウトは、交互に使う前にこのパッケージを必要とする。
- **任意の値** — 2 つのランタイムコンテキスト行は任意であるため、`complete: true` なしに `includeRuntimeContext: false` を設定するカスタムペルソナは、そのリクエストが決して運ばない値を指すセクションを保つ。出荷済み `minimal` ペルソナは両方を設定する。
- **セクションのないセッション** — `surfaceContext: false` が両方の段落を隠している間に作成されたセッションは、ログにどちらも持たないため、最初の再開リクエストが新しいセクションを追加し、履歴内プロンプト更新のないルートで最初のシステムメッセージを書き換える。
- **1 つの以前の文言** — プロジェクションは、このパッケージがそれらをレンダリングする直前のリリースとして段落を認識する。より古い文言を持つセッションは現在のガイダンスを受け取る。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
