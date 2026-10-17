---
description: "宣言的プリセットを通じてエージェントのツール、プロンプトセクション、スキルを選ぶ。1 つのプロセスで複数の構成を実行できる。失敗した定義は可視のまま残り、既存のエージェントは使用中の構成を保持する。"
kind: "package-reference"
---

# @deepseek-ai/dsh-agent-preset-registry

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

宣言的プリセットを通じてエージェントのツール、プロンプトセクション、スキルを選ぶ。1 つのプロセスで複数の構成を実行できる。失敗した定義は可視のまま残り、既存のエージェントは使用中の構成を保持する。

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

### 最小構成

```yaml
- id: agent-preset-registry
  name: '@deepseek-ai/dsh-agent-preset-registry'
  config:
    default: standard
- id: preset-standard
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    id: standard
    plugins: []
```

| フィールド | 既定値 | 意味 |
|---|---|---|
| `default` | 必須 | 要求がない場合に使うプリセット ID |

Web 定義は `dsh-web-app` バンドルから提供される。定義は通常のプラグイン行であり、レジストリはディレクトリを走査せず、プリセットパスも受け付けない。`agent-preset-registry` エントリーの `selectedDefault` volatile フィールドはユーザーの既定値を保持し、新しいセッションはデプロイの `default` よりそれを優先して解決する。プロファイルパッチが廃止された `modeSelectionEnabled` フィールドを運ぶ場合があるが、レジストリはそのようなフィールドを宣言せず、その読み書きも行わない。

レジストリは宣言を書き込まない。`read` リモートは 1 つの宣言の子リストをエントリーリスト YAML（`!!js` 条件を含む）としてレンダリングして返すため、クライアントはプリセットが何を構成するかを表示できる。YAML を受け付けることはない。新しいプリセットや出荷済みのものの上書きはバンドルパッチである。すなわち `@deepseek-ai/dsh-agent-preset` 行の `insert`、またはその行の id をキーとするパッチであり、`plugin_manager` でプロファイルにインストールする。Creator モードは会話の中でそのようなバンドルを作成する。

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

各宣言は即座にレジストリ所有のスコープとインメモリー Loader ツリーを作成する。宣言の更新や削除は以前のリビジョンを廃止する。エージェント、子、過去の一時読み取りは参照を保持し、最後の参照の解放が廃止されたツリーを破棄する。プラグイン登録はプリセットスコープを継承し、エージェントスコープの親リンクが可視性を制御する。ホストは引き続きエージェントループを共有する。

プリセットサービスプロバイダーとそのコンシューマーは 1 つの `cordis:group` 分離レルムを共有しなければならない。エントリー単位の分離はエージェント登録スコープを通じて伝搬しない。通常の Context 検索はグループ外では、すなわち `agent.ctx` も含めてホストのレルムを選択する。`agentPresets.serviceFor()` は保持された構成を明示的に検査する。通常のサービス検索は変えない。

有効化の監査はインポート、不足サービス、グローバルに漏洩したサービスを検査する。インポート失敗、有効化失敗、漏洩はマウントを拒否する。ホストサービス待ちの行はマウントされたまま残り、ホスト Loader ツリーが落ち着くたびにすべての読み取りと束縛が再監査されるため、起動順序が結果を決めることはない。失敗はその定義への新しい束縛を防ぐ。セッションログはプリセット ID と空セッション選択を保持する。再起動後の回復はその ID の現在の定義を使い、欠落した定義は拒否する。`select` は要求されたプリセットを記録した空セッションを残し、その現在のリビジョンをすでに実行中として変更なしに扱い、別の選択記録や `tools/change` は行わない。

`inspectCompositions()` はこのレジストリが保持するすべてのリビジョンを読む。エージェント Context を渡すとその正確なリビジョンを選択し、ここへの束縛がなければ空リストを返す。各 `AgentPresetInspection` はプリセット ID、解決ベース付きのデタッチされたアクティブモジュール参照、漏洩したサービス名を含む。検査器はモジュール単位のマウントテーブルではなくランタイムサービスに問い合わせる。結果に Loader ツリーやファイバーは含まれない。[composition-inventory.ts](src/composition-inventory.ts) がこれらのレコードを定義する。

| ファイル | 責務 |
|---|---|
| [index.ts](src/index.ts) | 登録、リビジョン、エージェント束縛 |
| [mount.ts](src/mount.ts) | スコープ付きプラグインツリーと有効化監査 |

</details>

<a id="further-exploration"></a>
## さらに調べる

- [Scope](../../core/scope/README.md) — 登録の分離。
- [Agent](../../core/agent/README.md) — セッションランタイム。
- [Cordis](../../../docs/cordis-primer.md) — プラグイン設定とライフサイクル。

<a id="model-experience"></a>
## モデル体験

### プリセット選択

#### モデルが見るもの

直接は何もない。選択されたプリセットの `plugins` がモデル可視のツールとプロンプトセクションを所有する。

#### トークンへの影響

このパッケージ自体は何もない。マウントされた各 `plugins` 行が独自のツールとセクションを宣言する。

#### KV キャッシュへの影響

既存のエージェントはプラグインとプロンプトを保持する。新しいエージェントは現在の定義からプレフィックスを構築する。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- プリセットはセキュリティサンドボックスではない。YAML とプラグインはホストコードを実行できる。ユーザー上書きは子リスト全体を置き換え、出荷リストへの将来の変更を自動的にマージしない。古いリビジョン実装はプロセス再起動をまたいで保持されない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
