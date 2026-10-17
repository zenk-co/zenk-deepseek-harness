---
description: "DeepSeek Harness セッションログ上のモデル向け todo_write ツール: リスト全体の置き換え、セッションごとの所有権、todos プロジェクション。ツールを選択、構成、デバッグするユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-todo

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-tool-todo` はエージェントに計画のための構造化タスクリストを与える。多段階の作業を具体的なタスクに分解し、作業中のタスクをマークし、終わったタスクにチェックを付ける。リストはターンと再開されたセッションをまたいで生存するので、エージェントと UI は常に最新の計画を見る。1 つの設定フラグが、作業を並行実行するエージェントのために、複数のタスクを同時に進行中にしてよいかを決める。エージェントが可視のタスクリストを維持すべきあらゆる場所で使う。各更新はリスト全体を置き換え、所有エージェントセッションだけが変更できる。

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

エージェントが作業中に可視のタスクリストを維持してほしいときにこのパッケージを使う。多段階の作業を計画し、何がアクティブかを示し、完了を記録する。並行フラグ付きでマウントするのが唯一のセットアップである。その後は計画が変わるたびにエージェントが自身の計画ツールを通じてリストを更新する。

### いつ選ぶか

1 つのエージェントセッションがタスクリストを所有し、リスト全体の更新で問題ない場合 — 計画ツールの一般的な形 — にこれを選ぶ。複数のエージェントが 1 つのリストを共有しなければならない場合や、項目ごとの編集が必要な場合は避ける。リストは 1 つのエージェントに属し、すべての更新がリスト全体を置き換える。これが機能するにはエージェントセッションの存在が必須である。エージェントを一切実行しないオートメーション専用サーフェスはこれを使えない。

### 最小構成

`allowParallelInProgress` は既定値なしの必須である。これを省略した構成はロード時に失敗し、非ブール値は拒否される。作業を並行実行しうるエージェント（subagent、バックグラウンドコマンド、ワークフローファンアウト）には `true` を、シングルアクティブの規律には `false` を設定する。

```yaml
- name: '@deepseek-ai/dsh-tool-todo'
  config:
    allowParallelInProgress: true
```

| フィールド | 既定値 | 意味 |
|---|---|---|
| `allowParallelInProgress` | required | 複数の todo が同時に `in_progress` になってよいか。モデル説明のアクティブステータス条項も選択する |

生成された [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-tool-todo) が受け入れられるフィールドの網羅的なソースである。

### 各呼び出しが行うこと

エージェントは更新のたびにリスト全体を送信する。新しいリストが前のものを置き換えるので、部分更新や項目ごとの編集はない。各項目は短いタスク説明と、`pending`、`in_progress`、`completed` のいずれかのステータスからなる。成功した更新は新しいカウント — `Updated todo list: <pending> pending, <inProgress> in progress, <completed> completed.` — を返し、UI は新しい計画を表示する。更新は、タスク説明が空または重複している場合、項目が説明とステータス以外のフィールドを持つ場合、または並行作業が無効な場合に複数のタスクが進行中とマークされている場合に、目に見えて失敗する。

### 単一オーナー

タスクリストはそれを作成した 1 つのエージェントセッションに属する。subagent とその他のエージェントはそれぞれ自分のリストを持ち、エージェント間でリストを共有する方法はない。エージェントセッション外からの呼び出しは拒否されるので、エージェントは黙ってどこにも書かれないのではなく、更新が失敗したことを知る。エージェント間で共有されるリストが必要なら、このパッケージはそれを提供しない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

この節ではツール背後の設計判断とそれを実現するコードを説明する。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱っている。

### 設計哲学

このツールは 4 つの約束の上に成り立っている:

- **リスト全体の置き換え、ログに支えられた状態。** モデルはリスト全体を再送する。`todo/write` スナップショットはイベントソースのセッションログ上にあり、durable 性、リプレイ、再開時の再構築はサービスではなくログから来る。
- **単一オーナー。** リストは呼び出し元エージェントセッションに属する。共有スコープもスウォームスコープもなく、非エージェント呼び出し元は拒否される。
- **コーディングされたルールではなくデプロイポリシー。** ツールは実行時の並行性を観察できないので、`allowParallelInProgress` は必須の構成選択である。
- **検証がログのスナップショットを正直に保つ。** 不明なキーのスキーマレベルの拒否と、空または重複コンテンツの `execute` レベルの拒否により、durable スナップショットはモデルが書いたと信じているものと等しく保たれる。

[todo_write ツール Agent Note](../../../.agents/notes/archived/feature/2026-06-29-todo-write-tool.md) が元の設計と代替案を記録し、[parallel in-progress Agent Note](../../../.agents/notes/archived/feature/2026-07-26-todo-parallel-in-progress.md) がポリシー決定を記録する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリ: `Config` スキーマ、ツール登録、`todos` プロジェクションユニット |
| [`src/types.ts`](src/types.ts) | `todos` プロジェクションキー宣言とそのペイロード型の唯一の拠り所 |
| [`src/client.ts`](src/client.ts) | types アウトレットのクライアント名前空間再エクスポート |

### エクスポート形状

このプラグインは関数／名前空間プラグインである。`name` / `inject` / `apply` をエクスポートし、デフォルトエクスポートを持たない。誤って `export default` があると、Loader の `unwrapExports` がモジュールを畳み込み、`inject` を落とす（[postmortem 0001](../../../docs/postmortem/0001-acp-default-export-drops-inject.md) を参照）。

### セッションプロジェクション

構成が `ctx.sessionProjections`（[`@deepseek-ai/dsh-session-projection`](../../session/session-projection/README.md)）をマウントすると、このパッケージは注入された子に `todos` ユニットを登録する。プロジェクションは常設の計画である — 最新の `todo/write` リスト全体、最初の書き込み前は `null`、次のターンが始まるとクリアされるが、`turn/end` は終了したチェックリストを可視のまま保つ。キーはここで `SessionProjectionMap` にマージされる。キャリアは履歴テールページと `session/projection` プッシュフレームでその値を供給する。レジストリのない構成は影響を受けない。ユニット登録は [src/index.ts](src/index.ts) を参照。

### 呼び出しの仕組み

各呼び出しは送信されたリストをスキーマに対して検証し、整合しない入力を拒否し、成功すると完全なスナップショットを `todo/write` セッションイベントとして追記して新しいカウントを返す。現在のリストは常にログ内の最新の `todo/write` である（リプレイでは後書き優先）。正確な検証と追記のステップは [src/index.ts](src/index.ts) を参照。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルのコントラクトでは足りないときにこれらのページを読む。セッションサブシステムから、生成されたカタログとツール背後の決定記録へ進む。

- [Todo サブシステム](../../../docs/subsystems/todo.md) — `todo/write` イベントペイロード、所有権ルール、`TodoItem`。
- [todo グループマップ](../README.md) — 兄弟グループページとそのパッケージ表。
- [生成されたツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-todo) — モデルが受け取る `todo_write` スキーマ。
- [生成された設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-tool-todo) — 受け入れられるすべての設定フィールドとそのソース宣言。
- [todo_write ツール Agent Note](../../../.agents/notes/archived/feature/2026-06-29-todo-write-tool.md) — 元の設計、代替案、脱落したフィールド。
- [parallel in-progress Agent Note](../../../.agents/notes/archived/feature/2026-07-26-todo-parallel-in-progress.md) — アクティブ数の上限がなぜデプロイポリシーなのか。

-----

<a id="model-experience"></a>
## モデル体験

### ツールスキーマ

#### モデルが見るもの

モデルは生成された [`todo_write` スキーマ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-todo) を見る。1 つの必須の `todos` 配列を持ち、その項目は `{ content, status }` で、`status` は `pending`、`in_progress`、`completed` のいずれかである。`todos` の説明は、各呼び出しがリスト全体を置き換えることを述べる。ツール説明のアクティブステータス条項は `allowParallelInProgress` に従う。

#### トークンへの影響

ツールが可視のすべてのリクエストに固定スキーマコスト。説明とスキーマは所与の構成に対して安定している。

#### KV キャッシュへの影響

定義と可視性が変わらない間はプレフィックス安定。プラグインライフサイクルまたはスコープ付き制限は、このスキーマからの再利用を無効化しうる。

### ツール呼び出し履歴と結果

#### モデルが見るもの

各アシスタントツール呼び出しは、その引数に置き換えリスト全体を保持する。成功は正確に `Updated todo list: <pending> pending, <inProgress> in progress, <completed> completed.` を返す。安定した失敗は ``Error: invalid todo: `content` must be a non-empty string``、`Error: invalid todos: duplicate content "<content>"`、`Error: todo_write requires an owning agent session`、そして — デプロイが `allowParallelInProgress: false` を設定した場合にのみ — `Error: invalid todos: at most one task may be in_progress (got <n>)` である。完全な `todo/write` セッションイベントは UI とリプレイの状態であり、2 つ目のモデルメッセージではない。

#### トークンへの影響

トークン増加はモデルが送信するリスト全体ごとに比例し、それらの呼び出し引数は compaction まで残る。結果自体は小さく、形状が固定である。

#### KV キャッシュへの影響

追記専用。新たに可視になったコンテンツは再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリを無効化しない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、ツールが適さない状況を定義する。現在のパッケージ制約であり、タスクバックログではない。

- **単一オーナースコープのみ** — リストは呼び出し元の 1 つのエージェントセッションに属する。subagent、共有、スウォームのスコープは意図的なカットであり、非エージェント呼び出し元は拒否される。
- **項目の形状は意図的に最小** — `content` と 3 状態の `status`。リスト全体の置き換えには安定 id、優先度、アクティブ形フィールドは不要である。
- **リスト全体の置き換えが唯一の操作** — 部分更新、読み戻しツール、項目ごとの編集はない。モデルは呼び出しのたびにリスト全体を再送しなければならない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

この開発者ノートはメンテナー向けの作業コンテキストである。すなわち、未決の問いと決定されていない方向性である。これは明示的に非権威である。出荷済みの動作、制限、受け入れられた根拠は、上の節、パッケージコード、リンクされた Agent Notes にある。

#### 将来: エージェント横断と共有リスト

単一オーナースコープは意図的なカットであり、エージェント横断または共有リストは別個の将来設計のままである。それらには項目ごとのログデルタと明示的なスコープ選択が必要になり、モデル可視のコントラクトを変えることになる。設計はまだ存在しない。

</details>
