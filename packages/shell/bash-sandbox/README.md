---
description: "拒否とエスカレーションの事実を伴う封じ込めコマンド実行を選択、設定、またはデバッグするデプロイメントとメンテナーのための、サンドボックスを消費する Bash エグゼキューター。"
kind: "package-reference"
---

# @deepseek-ai/dsh-bash-sandbox

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-bash-sandbox` は、Harness プロセスの完全な権限ではなくファイルアクセスの封じ込めを伴って各 Bash コマンドを実行するために使う。結果は、選択されたモード、拒否されたファイル操作、およびランナーがそのモードを完全に強制したかどうかを報告する。封じ込めモードを強制できるランナーがない場合、コマンドは非封じ込めで実行されるのではなく `SANDBOX_UNAVAILABLE` で失敗する。デプロイメントがファイル分離を必要とする場合にこれを選ぶ; ネットワークアクセスとプロセス可視性はその保証の外にとどまる。

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

コマンドが Harness プロセスの完全なファイル権限で実行されてはならない場合は、`dsh-bash-local` の代わりにこのエグゼキューターをマウントする。これは `ctx.shell` として登録され、`ctx.sandbox` プロバイダーと `ctx.sandboxPolicy` を必要とする; モデル向けの `bash` ツールは変更なしでその上で機能し、`sandbox_permissions`/`justification` エスカレーションフィールドを広告する。

### いつ選ぶか

デプロイメントが Bash コマンドにファイルレベルの封じ込めを必要とする場合にこれを選ぶ: 設定されたポリシーがデフォルトモードとワークスペースルートを決め、各セッションはツールのエスカレーションフローを通じて呼び出しごとに異なるモードで実行できる。モードはファイル効果のみを統治する — ネットワークは無制限のままで、プロセス可視性はバックエンド固有である。非封じ込め実行や、プラットフォーム上にサンドボックスバックエンドが利用できない場合は、代わりに `dsh-bash-local` をマウントする。

### モードとファイル効果

| モード | ファイル効果 |
|---|---|
| `read-only` (デフォルト) | どこにも書き込めない; `/dev` のうち書き込み可能なのは `/dev/null` ノードのみで、`>/dev/null` は引き続き機能する |
| `workspace-write` | ポリシーのワークスペースルートと `/tmp` の下にのみ書き込める (bwrap では一時的、Landlock ではホストの `/tmp`、Seatbelt では `/private/tmp` とユーザーごとの一時ディレクトリ) |
| `danger-full-access` | 封じ込めなし; プロバイダーは決して参照されず、結果は `sandbox: { mode, denied: false }` を伴う |

### 最小構成

エグゼキューターは独自のサンドボックス設定を取らない: デフォルトモードとワークスペースルートは `ctx.sandboxPolicy` から来て、ランナーの選択は `ctx.sandbox` プロバイダーに属する。自身の設定はローカルエグゼキューターのノブそのままである; 生成された[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-bash-sandbox)が網羅的な情報源である。

```yaml
- id: sandbox
  name: '@deepseek-ai/dsh-sandbox-local'
- id: sandbox-policy
  name: '@deepseek-ai/dsh-sandbox-policy'
  config:
    mode: read-only
    workspaceRoot: !!js process.cwd() # fallback for calls without a session cwd
- id: bash
  name: '@deepseek-ai/dsh-bash-sandbox'
```

### 拒否は結果の事実である

拒否されたコマンドは報告され、黙って再試行されることはない: 結果は `sandbox: { mode, denied: true }` を伴い、モデル向けツールが拒否マーカーを追加する。エスカレーションが利用可能な場合、モデルはこの正確なコマンドを、最も狭いより広いモードと 1 文の正当化を伴って 1 回だけ再試行してよい; 承認プロンプトはユーザーに尋ね、承認前に何も実行されない。このエグゼキューターは決して自ら権限を交渉しない — ツール層が上書きを駆動する。

### 失敗と復旧

封じ込めモードを強制できるランナーがない場合、フォアグラウンド呼び出しは `SANDBOX_UNAVAILABLE` で失敗し、バックグラウンドプロセスはランナー失敗の事実を記録する — 黙って非封じ込めで実行されることは決してない。プロバイダーの拒否が封じ込めランナーに帰属されるのは、その `ENOENT`/`EACCES` パスまたは syscall が独立に `argv[0]` を名指しする場合のみである; それ以外はローカルエグゼキューターのステージ中立のプロバイダー失敗セマンティクスを保つ。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションはエグゼキューターの設計と、それを実現するコードを指し示す; 観察可能な挙動は[本パッケージを使う](#use-this-package)で完全に扱う。

### 設計概念

エグゼキューターは `ctx.shell` シームのサンドボックス化サービスプロバイダーである: `dsh-bash-local` のプロセス機構を継承し、各コマンドの正確な `['bash', '-c', command]` argv の封じ込めを `ctx.sandbox.confine()` を通じて await し、返された argv を直接 spawn する。フォアグラウンド準備はローカルエグゼキューターの共有コマンド期限を使う; spawn 前のタイムアウトは強制の主張を伴わない。バックグラウンド準備は呼び出し元シグナルのみに従う。どちらの経路も spawn 前にキャンセルを再チェックする。どのプラットフォームランナーがコマンドを封じ込めるか — そしてそもそも使用可能かどうか — はプロバイダーの関心事である; このパッケージは bash 側のみを所有する: 選択されたモード、強制の完全性、および結果上の拒否分類。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: `SandboxBashExecutor`、プロセスごとの事実保持、実行準備 |
| [`src/helpers.ts`](src/helpers.ts) | 拒否、ランナー失敗、およびランナー spawn 失敗の分類 |
| `tests/` | bwrap、Landlock、および Seatbelt ランナーにまたがって実証される挙動 |

### メインフロー

封じ込めモードでは、`resolve()` が呼び出しごとのポリシー (セッションのモード上書き、またはデプロイメントのフォールバック) を刻む; `execute` はプロバイダーを通じて bash argv の準備を await し、封じ込められた argv を継承した subprocess 経路へ渡す。決着時にエグゼキューターは結果を分類する: ランナー失敗はコマンドが実行されなかったため拒否より優先され、stderr がバックエンドの拒否方言を運ぶ失敗した実行は `denied: true` として報告され、すべての封じ込め実行はそのモードと強制の事実を伴う。`danger-full-access` はプロバイダーを完全に迂回し、`denied: false` を刻む。

### 不変条件

- **フェイルクローズド** — 使用可能なランナーのない封じ込めモードは `SANDBOX_UNAVAILABLE` で拒否する; 封じ込めポリシーに対して非封じ込めのパススルーが起こることは決してない。
- **シームでは拒否のみ** — このエグゼキューターは決して権限を付与しない; 承認フローはツール層にある。
- **プロセスごとの事実** — プロバイダーは重複する呼び出し間で強制を変えうるため、封じ込めの事実は決着までハンドルごとに保持される。
- **ファイル効果のみ** — モードの語彙はファイル効果のみを主張する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

エグゼキューターの契約では不十分なときにこれらのページを読む。シームから、このエグゼキューターが消費するサンドボックスケイパビリティへ進む。

- [shell シーム](../shell/README.md) — このプロバイダーが実装するエグゼキューター契約 (request/spec 分割を含む)。
- [bash-local](../bash-local/README.md) — このエグゼキューターが継承するプロセス機構。
- [sandbox シーム](../../sandbox/sandbox/README.md) — 封じ込めケイパビリティ、そのモード、およびフェイルクローズドの契約。
- [sandbox-policy](../../sandbox/sandbox-policy/README.md) — このエグゼキューターが尊重するセッションごとのモードとワークスペースルート。
- [sandbox-local](../../sandbox/sandbox-local/README.md) — 出荷済みのランナーバックエンド: bwrap、Landlock、および Seatbelt。
- [tool-bash](../tool-bash/README.md) — モデル向け `bash` ツールとそのエスカレーション面。
- [Sandbox リファレンス](../../sandbox/sandbox/README.md) — サンドボックスの設計、エスカレーション、および切り替えの契約。

-----

<a id="model-experience"></a>
## モデル体験

### Bash ツールスキーマ (間接的)

#### モデルが見るもの

生成された [`dsh-tool-bash` スキーマ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-bash)がベースラインである。封じ込め `sandboxMode` を広告することにより、このバックエンドは `bash` を `sandbox_permissions` (enum `workspace-write` | `danger-full-access`) と `justification` で拡張する。ポリシー所有者は別途、現在のケイパビリティ中立の `sandbox:policy` コンテキストを寄与する。

#### トークンへの影響

`bash` が可視のリクエストに対する小さな固定のスキーマ増分、および `dsh-sandbox-policy` が所有する現在ポリシー条項。

#### KV キャッシュへの影響

常設ポリシーの変更は、保持された履歴の後にオーナーレンダリング済みの完全なコンテキストスナップショットを追記し、既存の system/履歴プレフィックスをバイト単位で保つ。エグゼキューターのケイパビリティの変更は `bash` スキーマを変える。

### Bash ツール結果 (間接的)

#### モデルが見るもの

通常の上限付き出力の後、拒否された呼び出しは正確に `[sandbox: file access denied under <mode> mode]` を追加する。エスカレーションが利用可能な場合、続けて `[sandbox: escalation available — retry this exact command once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]` を追加する。決着したバックグラウンドランナー失敗は代わりに `[sandbox: the sandbox runner itself failed under <mode> mode — the command did not run; this is a sandbox problem, not a command failure]` を追加する。

#### トークンへの影響

特筆すべきことのない許可された実行では、通常の出力を超える追加トークンはゼロ。拒否または失敗は引用された条件付きマーカーを追加し、compaction まで保持される。

#### KV キャッシュへの影響

追記のみ; 新たに可視になった内容は再利用可能なリクエストプレフィックスに従い、既存の KV キャッシュエントリーを無効化しない。

### Bash ツールエラー (間接的)

#### モデルが見るもの

封じ込めモードを強制できるランナーがない場合、フォアグラウンド呼び出しは sandbox シームからの `SANDBOX_UNAVAILABLE` エラーを伝播する。`argv[0]` を名指しする `ENOENT`/`EACCES` パスまたは syscall の証拠を伴うプロバイダー拒否は、ランナー失敗の詳細として元のエラーを供給する; それ以外の拒否はステージ中立のプロバイダーエラーのままである。決着したランナー失敗は一致した致命的な stderr 行を供給し、元の stderr コレクションを保つ; 追加された `Runner failure: <detail>` が、汎用の `SANDBOX_UNAVAILABLE` プレフィックスに対する権威ある診断である。

#### トークンへの影響

条件付きエラーテキストはその呼び出しで可視であり、compaction まで履歴に保持される。

#### KV キャッシュへの影響

追記のみ; 新たに可視になった内容は再利用可能なリクエストプレフィックスに従い、既存の KV キャッシュエントリーを無効化しない。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このエグゼキューターが汎用のセキュリティ境界ではない場合を定義する。それらは現在のパッケージ制約であり、ロードマップではない。

- **封じ込めはファイル効果のみを対象とする** — ネットワーク制限と一様なプロセス可視性の保証はなく、モードは汎用のセキュリティサンドボックスではない。
- **拒否は失敗したコマンドの stderr から推論される** — バックエンドのシグネチャにより推論はポータブルだが、一致するアプリケーションエラーが拒否として分類されうるし、保持されたテールから漏れた拒否は見逃されうる。
- **非同期に観察されたバックグラウンドランナー失敗には即時のエラーチャネルがない** — それは決着したプロセスに記録され、呼び出し元が `job_output` で汎用タスクを読むときに表面化する; 同期的な subprocess スローは同じ決着済み kill ハンドルに封じ込められ、ランナーに帰属された失敗は `result()` の拒否によって運ばれる。
- **`danger-full-access` は意図的に `ctx.sandbox` を迂回する** — それは明示的な非封じ込めモードであり、より広いサンドボックスプロファイルではない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
