---
description: "拒否の事実を伴う制限付き PowerShell コマンド実行を選択・設定・デバッグするデプロイメントとメンテナー向けの、サンドボックス消費型 PowerShell エグゼキューター。"
kind: "package-reference"
---

# @deepseek-ai/dsh-pwsh-sandbox

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-pwsh-sandbox` はサンドボックス消費型の PowerShell エグゼキューターです: すべてのコマンドは新しい `pwsh -Command` プロセスとして実行され、`ctx.sandbox` ケイパビリティを通じて制限されます。選択されたモード、適用状況、拒否の事実は、確定した各結果に刻印されます。Windows ではサンドボックスシームは ACL 制限トークンのランナーチェーンに解決され、Linux と macOS では bwrap、Landlock、または Seatbelt を使います。制限付きモードを適用できるランナーがない場合、呼び出しは制限なしで実行されるのではなく、構造化された `SANDBOX_UNAVAILABLE` エラーでフェイルクローズします。これは `dsh-bash-sandbox` の pwsh 版の双子で、呼び出しごとに対応しています。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と保留作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

PowerShell コマンドをハーネスプロセスの完全なファイル権限で実行してはならない場合は、`dsh-pwsh-local` の代わりにこのエグゼキューターをマウントします。これは `ctx.shell` として登録され、`dsh-pwsh-local` のプロセスメカニクスを継承し、`ctx.sandbox` プロバイダーと `ctx.sandboxPolicy` を必要とします。

### 選ぶべきとき

デプロイメントが PowerShell コマンドにファイルレベルの制限を必要とする場合、通常は Windows でこれを選びます。制限の実体はプラットフォーム中立です: サンドボックスシームがプラットフォームのランナー — Windows では ACL 制限トークンチェーン、それ以外では bwrap/Landlock/Seatbelt — を選び、このエグゼキューターは pwsh 側を所有します。サンドボックスポリシー (モードとワークスペースルート) はこのパッケージの設定ではありません: 各呼び出しに `ctx.sandboxPolicy` から同乗し、ツール呼び出しは呼び出し元セッションの解決済みポリシーを渡し、直接呼び出しはデプロイメントポリシーにフォールバックします。

### モードとファイルへの影響

| モード | ファイルへの影響 |
|---|---|
| `read-only` (デフォルト) | 書き込みは拒否される。共有ハードリンク、非制限リード、AppContainer ACL の制限により境界は部分的のまま |
| `workspace-write` | ポリシーのワークスペースルート配下とプライベート一時ディレクトリへの書き込み。スポーン前に `TMP`/`TEMP` がそこへ書き換えられる |
| `danger-full-access` | 制限なし。プロバイダーは決して照会されず、結果は `sandbox: { mode, denied: false }` を運ぶ |

### 最小構成

Windows では ACL 制限トークンプロバイダーをマウントし、Linux と macOS では代わりにローカルランナープロバイダーをマウントします。エグゼキューター自身の設定はローカル pwsh エグゼキューターのノブそのままで、生成された[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-pwsh-sandbox)が網羅的な情報源です。

```yaml
- id: sandbox
  name: '@deepseek-ai/dsh-sandbox-windows-acl'
- id: sandbox-policy
  name: '@deepseek-ai/dsh-sandbox-policy'
  config:
    mode: read-only
    workspaceRoot: !!js process.cwd() # fallback for calls without a session cwd
- id: bash
  name: '@deepseek-ai/dsh-pwsh-sandbox'
```

### 拒否とエスカレーション

拒否されたコマンドは事実として報告されます: 結果は `sandbox: { mode, denied: true }` を運び、ツール層がそれを標準の permission-denied サーフェスへ変換します — bash ツールが使うものと同じです。エスカレーションが利用可能な場合、モデルは正確なコマンドを、最も狭いより広いモードと 1 文の正当化を伴って 1 回だけリトライできます。承認プロンプトがユーザーに尋ね、承認前に何も実行されません。このエグゼキューター自体が権限を交渉することは決してありません。

### 失敗と回復

制限付きモードを適用できるランナーがない場合、フォアグラウンド呼び出しは `SANDBOX_UNAVAILABLE` で失敗し、バックグラウンドプロセスはランナー失敗の事実を記録します — 暗黙の非制限実行になることは決してありません。プロバイダーの拒否が制限ランナーに帰属されるのは、その `ENOENT`/`EACCES` パスまたはシステムコールが独立に `argv[0]` を名指す場合だけです。それ以外はローカルエグゼキューターのステージ中立なプロバイダー失敗セマンティクスを保ちます。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

このセクションではエグゼキューターの設計を説明し、それを実現するコードを示します。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱います。

### 設計概念

このエグゼキューターは `dsh-bash-sandbox` の pwsh 版の双子です: `dsh-pwsh-local` のプロセスメカニクスを継承し、その argv レベルのシーム (`argv()`/`executeArgv()`/`onProcessDone()`) を消費し、スポーン前に正確な pwsh 呼び出しを `ctx.sandbox.confine()` を通じてラップします。制限の実体はプラットフォーム中立で、サンドボックスシームがプラットフォームのランナーに解決されます。このパッケージが所有するのは pwsh 側のみです: 結果上の選択されたモード、適用の完全性、拒否の分類です。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: `SandboxPwshExecutor`、プロセスごとの事実保持、実行の準備 |
| [`src/helpers.ts`](src/helpers.ts) | 拒否、ランナー失敗、ランナースポーン失敗の分類 |
| `tests/` | ACL ランナーとプラットフォームランナーをまたいで試験される動作 |

### メインフロー

制限付きモードでは、`resolve()` が呼び出しごとのポリシーを刻印し、`execute` がプロバイダーを通じた pwsh argv の準備を待ち、制限済みの argv を継承したサブプロセスパスへ渡します。確定時にエグゼキューターが結果を分類します: コマンドが実行されなかったためランナー失敗は拒否より優先され、stderr がランナーの拒否方言を運ぶ失敗実行は `denied: true` として報告され、すべての制限付き実行はそのモードと適用の事実を運びます。`danger-full-access` はプロバイダーを完全に迂回し、`denied: false` を刻印します。

### 不変条件

- **フェイルクローズ** — 使用可能なランナーのない制限付きモードは `SANDBOX_UNAVAILABLE` で拒否されます。制限付きポリシーに対して非制限のパススルーが起こることは決してありません。
- **シームでは拒否のみ** — このエグゼキューターが権限を許可することは決してありません。承認フローはツール層にあります。
- **プロセスごとの事実** — 制限の事実は確定までハンドルごとに保持されます。プロバイダーが重複する呼び出し間で適用内容を変えることがあるからです。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

エグゼキューター契約では足りないときに、これらのページを読んでください。シームから制限バックエンドと pwsh ツールへと進みます。

- [shell シーム](../shell/README.md) — このプロバイダーが実装するエグゼキューター契約 (request/spec 分割を含む)。
- [bash-sandbox](../bash-sandbox/README.md) — このエグゼキューターの bash 版の双子。共有の拒否・エスカレーションサーフェスを持つ。
- [pwsh-local](../pwsh-local/README.md) — このエグゼキューターが継承するプロセスメカニクス。
- [sandbox-windows-acl](../../sandbox/sandbox-windows-acl/README.md) — Windows の制限トークンランナーチェーン。
- [Bash エグゼキューターサブシステム](../../../docs/subsystems/shell.md) — request/spec 語彙、結果、サービス契約の全体。
- [pwsh エグゼキューターとツールのノート](../../../.agents/notes/archived/feature/2026-08-01-pwsh-tool-and-executor.md) — pwsh エグゼキューターとツールのペア背後の決定。

-----

<a id="model-experience"></a>
## モデル体験

### 制限は機能し、拒否はコマンド失敗として現れる

#### モデルが見るもの

制限付きコマンド自身の stderr — たとえば Windows ACL ランナーでの `Access to the path '...' is denied.`。ツール層は分類された拒否を、bash ツールとまったく同様に標準の permission-denied サーフェスへ変換します。

#### トークン効果

コマンドの stderr とツール層の標準拒否サーフェス以外に、モデル可視のテキストはありません。

#### KV キャッシュ効果

直接にはなし。拒否サーフェスはツール層に属します。

## 既知の制限と保留作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このエグゼキューターが Windows で部分的な境界に留まる場合を定義します。これらは現在のパッケージ制約であり、ロードマップではありません。

- **Windows では読み取りは制限されない** — ACL ランナーは書き込みのみを制限します。読み取り境界は `@deepseek-ai/dsh-sandbox-windows-acl` に文書化されています。
- **Windows の workspace-write の一時権限はプライベート** — ライブのセッション/ワークスペースのペアごとです。エージェントレス呼び出しは呼び出しごとに新しいプライベートディレクトリを受け取ります。環境の一時ルートが付与されることは決してなく、ランナーはスポーン前に `TMP`/`TEMP` をプライベートディレクトリへ書き換えます。
- **Windows の read-only は明示的な書き込み可能ルートを付与しないが部分的なまま** — NTFS ハードリンクは 1 つのファイルオブジェクトを複数のパスに別名付けし、読み取りは制限されないままで、別の AppContainer ツールがパッケージ SID で ACL を付けたツリーは低整合性の子プロセスから読み取り不能です。NUL は両モードで書き込み可能のままです。デバイス DACL が Everyone に書き込みを付与し、より高いラベルを持たないためです。PowerShell の `> $null` リダイレクトは、それを開かずに引き続き機能します。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
