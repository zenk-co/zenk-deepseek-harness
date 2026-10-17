---
description: "プロセスサンドボックスのサービス契約。同じ実行ワールドの subprocess 隔離をコンポーズ、使用、拡張するユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-sandbox

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-sandbox` を使うと、subprocess とそれが spawn するすべてを呼び出しごとのファイルアクセスポリシーの下で実行できる。コマンドは書き込みなし（`read-only`）で実行するか、そのワークスペース内のみに書き込む（`workspace-write`）か、無制限に実行する（`danger-full-access`）かを選べる。要求されたモードを強制できない場合、呼び出しは隔離なしで実行される代わりに `SANDBOX_UNAVAILABLE` で失敗する。拒否された呼び出しの後、モデルは人間の承認のために厳密に 1 段階広いモードを要求できる。これは同じ実行ワールドの隔離である。プロセスは引き続きホストのカーネルとファイルシステムを共有する。環境全体を孤立させる必要がある場合はコンテナ、microVM、またはリモートエグゼキューターを使う。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

このサービスを 1 つのバックエンドと隔離されたコンシューマーとともにコンポーズすると、コンシューマーが実行するすべてのコマンドがあなたの解決したポリシーの下で実行される。見えるのは隔離の結果とその強制の完全性だけであり、プラットフォームのランナーは決して見えない。

### いつ選ぶか

コンポジションがホスト上で subprocess を隔離する場合にこのパッケージを選ぶ。ローカルのバックエンドと隔離されたエグゼキューターの両方が実装する契約であり、`sandbox-local` を `ctx.sandbox` の背後に、隔離されたエグゼキューターを `ctx.shell` の背後にマウントすると、すべての bash または pwsh 呼び出しに隔離された既定値が与えられる。プロセスを孤立した環境で実行する必要がある場合は別のものを選ぶ。コンテナ、microVM、またはリモートエグゼキューターは、ここにバックエンドを追加するのではなく、`ctx.shell`/`ctx.fs` ケイパビリティ全体を置き換える。

### コマンドの隔離

サービスをバックエンドと隔離されたエグゼキューターとともにマウントする。出荷済みのコンポジションは [base バンドル](../../bundle/base/cordis.patch.yml)が所有する。

```yaml
- id: sandbox
  name: '@deepseek-ai/dsh-sandbox-local'     # the per-platform backend provider (ctx.sandbox)
- id: sandbox-policy
  name: '@deepseek-ai/dsh-sandbox-policy'    # the deployment default mode and workspace-write root
  config:
    mode: workspace-write                    # the deployment default every session starts from
    workspaceRoot: !!js process.cwd()        # the boundary workspace-write may write under
- id: bash
  name: '@deepseek-ai/dsh-bash-sandbox'      # the confined executor behind ctx.shell
```

このコンポジションでは、bash 呼び出しは `workspace-write` の下で隔離されて実行される。ワークスペース内の書き込みは成功し、その外の書き込みは拒否され、モデルは以下のエスカレーションフローで回復できる。

### モードと強制

モードはコマンドが実行してよいファイル効果を名指し、強制の完全性はバックエンドがそれらをどれだけ完全に統治するかを報告する。

| モード | 効果 |
|---|---|
| `read-only` | `/dev/null` のような必須のシンクを除き、書き込みを拒否する |
| `workspace-write` | ワークスペースルートとバックエンド定義の一時領域の下への書き込みを許可する |
| `danger-full-access` | 隔離を迂回する。コンシューマーは元の argv を spawn する |

強制は呼び出しごとに報告される。`full` はバックエンドが約束されたすべてのファイル効果を統治することを意味し、`partial` はアクティブなバックエンドまたは古いカーネル ABI が一部のみを統治することを意味する——Windows の ACL 段と古い Landlock ABI が現在の partial の事例であり、絶対的な境界を必要とするコンシューマーはそれらを拒否または表示できる。

### 拒否された呼び出しとエスカレーション

隔離された呼び出しが拒否されると、操作はモードを名指す拒否マーカー——`[sandbox: file access denied under <mode> mode]`——を報告し、コンポジションがエスカレーションを通知する場合はエスカレーションヒントも報告する。モデルは `sandbox_permissions`（十分な最小のより広いモード）と `justification` を伴って正確な呼び出しを一度だけ再試行できる。承認サービスが操作への同意を得る。リクエストはその監査理由を保ち、モデルの justification を変更せずに英語と中国語の提示コピーを供給する。欠落した翻訳はロケールサービスのフォールバック連鎖に従い、最終的に英語になる。リクエスト元が自身の翻訳済み提示テキストに責任を負う。より広いモードは承認を必要とし、その 1 回の呼び出しにのみ適用される。呼び出しの有効なモードを繰り返すと承認なしで成功し、より狭いターゲットは無効のままである。

### フェイルクローズドの挙動

要求されたモードを強制できるバックエンドがない場合、呼び出しは隔離なしで実行されるのではなく `SANDBOX_UNAVAILABLE` で失敗する。エラーテキストは欠落しているプラットフォームランナーを名指す。開始後に失敗したバックエンドも構造化されたランナー失敗シグネチャを報告するため、壊れたサンドボックスをコマンドの失敗と区別できる。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションは契約の背後にある設計判断を説明し、それを実現するコードを指し示す。観測可能な挙動は[このパッケージを使う](#use-this-package)で完全にカバーされている。

### 設計方針

- **1 つの実行ワールド。** ファイルシステム、subprocess、sandbox のプロバイダーは同じファイルシステムとカーネル上で動作する。リモートのコンポジションは 3 つのプロバイダーすべてを置き換え、隔離はそのワールドで非同期に解決される。
- **ポリシーは呼び出しに乗る。** `SandboxPolicy` は呼び出しごとに運ばれ、プロバイダーに固定されることは決してない。2 つのコンシューマーが同じ瞬間に異なるポリシーで隔離でき、エスカレートされた再試行はより広いポリシーを持つ新しい呼び出しである。既定化と解決は明示的なコンシューマーの手順である。
- **フェイルクローズド。** `confine()` は強制用の argv に解決するか、`SandboxUnavailableError` で拒否する。暗黙の隔離なしパススルーは禁じられ、機能プローブが複数ランナーの連鎖を裁定する。
- **拒否とエスカレーションのための 1 つの語彙。** マーカーとヒントのテキスト、および厳密に広くなるラダーはここにあり、bash ファミリーと fs ファミリーがずれることはない。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリ: `SandboxProvider` サービス、モード/強制/ポリシーの型、フェイルクローズドのエラー |
| [`src/escalation.ts`](src/escalation.ts) | エスカレーションの語彙: より広いモードのラダー、引数の検証、拒否とヒントのマーカー、承認の振り付け |
| [`src/roots.ts`](src/roots.ts) | Seatbelt プロファイルとプロセス内 fs フェンスが共有する書き込み可能ルートの導出 |

### エスカレーションの振り付け

ラダーは閉じたテーブルである。`read-only` は `workspace-write` または `danger-full-access` にエスカレートでき、`workspace-write` は `danger-full-access` にのみエスカレートできる。これは実行時に確認され、ツールスキーマに焼き込まれることは決してない。その enum は閉じたターゲット語彙のままである。[`approveEscalation`](src/escalation.ts) は、モードが繰り返された場合は承認なしでそのモードを返し、より狭い、またはサポートされないターゲットを拒否し、より広いモードには承認を要求する。呼び出し元は先に `sandbox_permissions`/`justification` の対を検証する。

### 書き込み可能ルート

`workspace-write` は「ワークスペースルートとホストの一時領域」を意味する。`writableRoots` はその許可リストを正規に導出し、シンボリックリンクを解決して重複を排除するため、Seatbelt プロファイルとプロセス内 fs フェンスがまったく同じルートを許可する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

網羅的な契約はサブシステムリファレンスから始め、次にそれを実現するバックエンド、コンシューマー、ポリシーのソースへ進む。

- [Process サンドボックスサブシステム](../../../docs/subsystems/sandbox.md) — 完全な語彙、呼び出しごとのポリシー、分類の方言。
- [歴史的な subprocess サンドボックスの決定](../../../.agents/notes/archived/feature/2026-07-06-sandbox.md) — ケイパビリティの境界、エスカレーションの設計、先送りされたフェーズ。
- [ローカルサンドボックスバックエンド](../sandbox-local/README.md) — `ctx.sandbox` の背後のプラットフォームごとのランナー。
- [Bash サンドボックスエグゼキューター](../../shell/bash-sandbox/README.md) — 隔離された bash コンシューマー。
- [Sandbox ポリシーパッケージ](../sandbox-policy/README.md) — 呼び出しごとのモードとワークスペースルートの出所。

-----

<a id="model-experience"></a>
## モデル体験

### 隔離エラー（間接的）

#### モデルが見るもの

[`dsh-bash-sandbox`](../../shell/bash-sandbox/README.md) と [`dsh-tool-bash`](../../shell/tool-bash/README.md) を通じて、使用可能なバックエンドのない要求された隔離モードはコード `SANDBOX_UNAVAILABLE` と以下の正確なエラーを生み、実行時のランナー失敗は ` Runner failure: <detail>` を追加する。

##### 正確なエラー

```markdown
sandbox mode "<mode>" is requested but no sandbox backend is usable on this host; refusing to run the command unconfined. Install bubblewrap or run a Landlock-enforcing kernel (Linux), ensure sandbox-exec is usable (macOS), or ensure the ACL restricted-token runner can start (Windows) — otherwise switch the consumer to danger-full-access.
```

#### トークンへの影響

条件付きのエラーテキストはその呼び出しで可視となり、コンパクションまで履歴に保持される。

#### KV キャッシュへの影響

追記専用。新たに可視になった内容は再利用可能なリクエストプレフィックスに続き、既存の KV Cache エントリを無効化しない。

### エスカレーション要求と結果

#### モデルが見るもの

拒否された呼び出しはマーカー `[sandbox: file access denied under <mode> mode]` を、コンポジションがエスカレーションを通知する場合はヒント `[sandbox: escalation available — retry this exact <subject> once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]` も表示する。再試行は `sandbox_permissions` と `justification` を運び、ユーザーの `allowed-once` / `rejected` / `cancelled` の決定がその呼び出しの結果テキストになる。

#### トークンへの影響

可視となるのは拒否された呼び出しのエラーと、あればエスカレーションの結果テキストのみである。どちらもコンパクションまで履歴に保持される。

#### KV キャッシュへの影響

追記専用。エスカレーションのテキストは保持されたプレフィックスに続き、キャッシュ済みエントリを無効化しない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

これらの制限は、この seam が不向きになる、または特別な運用上の注意を要する状況を定義する。一般的なサンドボックスの比較やタスクバックログではなく、現在のパッケージの制約である。

- **ファイル効果がポリシー語彙のすべてである** — seam はネットワーク、プロセス、システムコール、デバイス、資格情報の制限を表現しない。
- **同じ実行ワールドの隔離のみ** — コンテナ、microVM、リモート実行は、ここにプロバイダーを追加するのではなくケイパビリティ実装を置き換えることを要する。
- **拒否の報告は stderr の方言である** — seam は型付きのランタイム拒否チャネルの代わりにバックエンドのシグネチャを返すため、分類を必要とするコンシューマーは子プロセスの出力からそれを推測する。
- **ランナーの診断は帯域内である** — 終了ステータスと stderr の証拠だけでは一致する行をどのプロセスが書いたかを証明できないため、意図的にランナーを模倣する隔離された子が、可用性または診断の誤帰属を引き起こすことがある。これは隔離を迂回できないが、帯域外のランナーステータスチャネルは先送りされている。
- **コンテキストごとに 1 つのプロバイダー** — 異なるサンドボックス機構を同時にコンポーズするにはプロバイダーレベルのラダーか別々の Cordis コンテキストが必要である。呼び出し元はバックエンドの同一性ではなくポリシーを呼び出しごとに選ぶ。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発者ノートはメンテナー向けの作業コンテキストであり、未決定の方向性と未解決の問いを示す。明示的に非権威である。出荷済みの挙動、制限、受け入れ済みの根拠は、上記のセクション、パッケージのコード、およびリンクされた Agent Note にある。

#### 将来: コンシューマーと環境

子エージェントを隔離なしの既定値で隔離する任意の `subagent-acp` コンシューマーと、環境に整合したケイパビリティグループの例は未決定のままである。Windows の隔離は `sandbox-local` の ACL restricted-token バックエンドが提供する。

</details>
