---
description: "トークンのプレッシャーが高まる中で、古い履歴がどのように要約されるかを選択・調整・デバッグするデプロイ向けの、会話の自動圧縮。"
kind: "package-reference"
---

# @deepseek-ai/dsh-compaction-basic

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは、モデルのコンテキスト上限付近でも長いエージェント会話を機能させ続ける。トークンのプレッシャーが高まると、最近のメッセージを保持しつつ最も古い履歴を要約に圧縮し、コンテキストオーバーフローエラーが起きた後は圧縮して再試行する。`/compact` で圧縮を要求することもでき、その前にサイズ超過のツール出力をトリミングすることも任意で可能である。圧縮は追加のモデルリクエストを 1 回使用し、その要約テキストのみを保持する。システムプロンプト、ツール、セッションプレフィックスを削減したり、1 つの巨大なツール呼び出しのような不可分な単位を分割したりすることはできない。

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

LLM、セッションストレージ、トークン計測をすでに提供する構成でこのパッケージをマウントすると、会話の自動圧縮が得られる。同梱の `dsh` base はこれをデフォルトで有効にする。圧縮を開始するタイミングを制御するには明示的にマウントする。

### 得られるもの

デフォルト設定では 4 つの動作が得られる。会話がモデルのコンテキスト上限に近づくにつれての自動圧縮、確認済みのコンテキストオーバーフローエラー後のリカバリー（会話が圧縮され、リクエストが再試行される）、`/compact` コマンドによるオンデマンド圧縮、そしてプルーナーがマウントされている場合の、圧縮前のサイズ超過ツール出力のトリミングである。

### 最小の動作構成

セッションストレージ、トークン計測、任意のプルーナー、このバックエンド、そして任意でオンデマンドコマンドをマウントする:

```yaml
- name: '@deepseek-ai/dsh-session'
- name: '@deepseek-ai/dsh-token-meter'
- name: '@deepseek-ai/dsh-compaction-tool-result-pruner'
- name: '@deepseek-ai/dsh-compaction-basic'
- name: '@deepseek-ai/dsh-command-compact'
```

成功は、本来ならオーバーフローする地点を越えて会話が続くことと、`/compact` を実行して即時圧縮が行われることで確認できる。構成に LLM、セッションストレージ、トークン計測のいずれかが欠けている場合、プラグインはロードに失敗する。1 つのバックエンドで異なるコンテキストサイズのモデルにサービスできる。モデル単位のオーバーライドでルートごとに独自のしきい値と保持量を与える:

```yaml
- name: '@deepseek-ai/dsh-compaction-basic'
  config:
    thresholdRatio: 0.8
    retainRatio: 0.16
    modelPolicies:
      - provider: local
        model: small-context
        thresholdRatio: 0.7
        retainTokens: 2048
```

### 圧縮の開始タイミングを調整する

すべての設定は任意である。コンテキストウィンドウ `W`、有効なリクエスト出力上限 `O`、ヘッドルーム `B` を使うと、デフォルトのトリガーは `floor(min(W × 0.8, W − O − B))` である（`B = 65,536` トークン）。保持は `W − O` の最新 16% をそのまま保つ。以下の表はすべての設定を列挙する。生成される[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-compaction-basic)にはそれらの型も含まれる。

| フィールド | デフォルト | 意味 |
|---|---|---|
| `thresholdRatio` | `0.8` | `floor(min(W × thresholdRatio, W − O − headroomTokens))` で使われるウィンドウ比率。 |
| `headroomTokens` | `65536` | ルーティングされた出力予約を超える追加のプレッシャーヘッドルーム。非負の整数。 |
| `retainRatio` | `0.16` | `W − O` に対する比率としてそのまま保持される最近の会話。`retainTokens` と相互排他。 |
| `retainTokens` | — | そのまま保持される最近の会話の絶対予算。`retainRatio` と相互排他であり、解決されたしきい値を下回る必要がある。 |
| `summarizationProvider` | `''` | `summarizationModel` と一緒に設定する。空のペアは最新のルーティング済みリクエストターゲットを使い、次に `AgentOptions` のペアを使う。 |
| `summarizationModel` | `''` | `summarizationProvider` と一緒に設定する。空のペアは最新のルーティング済みリクエストターゲットを使い、次に `AgentOptions` のペアを使う。 |
| `maxTokens` | `headroomTokens`（`65536`） | 正の要約出力上限。プロバイダーが計上する reasoning トークンを含む。明示的なモデル単位の上限は明示的なグローバル上限を上書きし、そうでなければ上限は解決されたヘッドルームに従う。 |
| `compactionRetries` | `1` | プレッシャーがしきい値を超えたままの場合に、最初の後に行う追加の圧縮試行。 |
| `maxOverflowRetries` | `1` | 確認済みのコンテキストウィンドウオーバーフロー後の最大再試行回数。`0` はリカバリーのみを無効化する。 |
| `modelPolicies` | `[]` | 個々のモデルルートに対する正確な `{ provider, model, ...partialPolicy }` オーバーライド。 |
| `auto` | `true` | 自動圧縮とオーバーフローリカバリーを有効にする。手動専用の運用には `false` を設定する。 |

設定ミスは即座に失敗する。未知の設定、モデル単位オーバーライドの重複、無効なトークン数、両方の保持形式の併用、またはしきい値比率以上の保持比率は、ロード時にプラグインを拒否する。モデルが最初に使用されるとき、`W − O − B` は正でなければならず、解決された保持予算はトリガーを下回る必要がある。ヘッドルームが 0 の場合は、グローバルまたはそのモデルポリシーで明示的な正の `maxTokens` が必要である。小さいウィンドウのデプロイは、容量に合ったヘッドルームを構成する必要がある。より早く圧縮するには `thresholdRatio` を下げる。

### 圧縮が実行されるとどうなるか

最も古いバランスの取れたスパンが 1 つの要約メッセージに置き換えられ、最近のテールはそのまま残る。会話はその要約から続く。この操作は、圧縮された履歴項目の数と、解放された推定トークン数を報告する。安全に圧縮できるものが何もない場合 — たとえば会話全体が 1 つの不可分な単位である場合 — は何も変わらず、セッションログに何も書き込まれない。要約を書くためのモデルが利用できない場合（設定されたターゲットもルーティング済みリクエストもまだない場合）、圧縮は明確なエラーで失敗し、summarization provider と model を設定するか、リクエストを 1 つルーティングするよう伝える。

### /compact によるオンデマンド圧縮

`dsh-command-compact` をマウントすると、チャット UI で `/compact` と入力して即座に圧縮できる（プレッシャーしきい値を下回っていても可能）。このコマンドは、圧縮された履歴項目の数と、節約された推定トークン数を報告する。エージェントがターン途中であるか、圧縮がすでに実行中の場合、`/compact` は圧縮が利用できないことを報告する。実行中に送信したプロンプトは受け付けられ、終了後に開始される。

### サイズ超過のツール出力のトリミング

このパッケージの前に `dsh-compaction-tool-result-pruner` をマウントすると、圧縮の一環としてサイズ超過のツール結果をトリミングできる。トリミングはモデル呼び出しを行わず、要約の必要自体をなくすことがある。トリミング後の会話がしきい値内に収まる場合、圧縮は要約をスキップする。トリミングは圧縮トリガーが条件を満たした後にのみ実行される。プレッシャーを下回る会話が触れられることはない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションでは、このバックエンドの背後にある設計上の決定を説明する。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱う。

### 設計哲学

このバックエンドは 4 つのコミットメントに基づいて構築されている:

- **単一の計測サービスがすべての決定に価格を付ける。** シングルトン `ctx.tokenMeter` は、1 つの消費済みログリビジョンで、最新の正規ログエンベロープと現在のサーフェスを計測する。ルーティングされたアダプターがリクエスト画像の価格を宣言している場合、メーターはそれを画像履歴に適用する。プレッシャー、最近テールの保持、範囲選択、縮小検証は同じルート価格付きノード数値を使用する。ログ記録された置換のシャドウ価格はルート非依存のヒューリスティックのまま留まり、純粋なプロジェクションの畳み込みが一貫し続ける。
- **ログに記録されるブラケットがトランザクションである。** すべてのエントリーポイントは 1 つのブラケット優先のリージョントランザクションを共有する。範囲とライブロックを検証し、`compaction/start` を同期的に追記し、要約を準備して待機し、再検証し、`compaction/summary` と置換を追記し、正確に 1 回のクローズ試行を行う。自動呼び出しと明示的リージョン呼び出しには、数値のオープンターンオーナーとサーフェス全体の安定性が必要である。`compactNow()` はアイドル承認を予約し、`turn: null` を使用し、選択されたスパンの外側にある追記のみのコンテキストを受け入れ、クローズされたすべての試行をフラッシュし、`finally` で承認を解放する。
- **要約はプロバイダーのウォームプレフィックスを再利用する。** サーフェスノード 0 の `system/message` が保持するシステムプロンプト、最後にルーティングされたリクエストのツール、およびシャドウされたリージョンのメッセージをバイト単位で再生すると、補助呼び出しは会話の真のプレフィックスになる。そのため、キャッシュされないのは末尾の指示と要約出力だけである。
- **`summarize()` が唯一のサブクラスフックである。** テンプレートまたはリモートのサマライザーサブクラスがこれをオーバーライドできる一方、プレッシャー、保持、引用されたソースイベント、縮小検証、シャドウトークン会計はトークンメーター側に留まる。

### 自動トリガーとオーバーフローリカバリー

`auto: true` の場合、直列の `agent/pre-step` リスナーがリクエスト派生の前にプレッシャーを確認する。最新の永続的なルーティング済みリクエストエンベロープを `ctx.tokenMeter` で価格付けし、プレッシャーがルーティングされたモデルのしきい値を超えると、まずプルーニングし、次に価格付けされた最近テールを保ちながら最も古いバランスの取れたスパンを要約する。選択されるすべての範囲は `system/message` でない最初のサーフェスノードで始まるため、サーフェスノード 0 のシステムプロンプトがシャドウされることはない。履歴内プロンプト更新によって追記された後発の `system/message` は通常の履歴であり、範囲がそれをシャドウしてもよく、その場合テキストが異なればエージェントループのプロジェクションがノード 0 を現在のプロンプトで置き換える（[決定ルール](../../core/agent-loop/README.md#understand-the-implementation)）。`agent/request-error` リスナーはプロバイダーが確認した `CONTEXT_WINDOW_EXCEEDED` に反応する。通常のしきい値と保持ポリシーをバイパスし、最大のバランスの取れた先頭削減を 1 回試み、サーフェス置換の世代が進んだ後にのみ再試行を承認する。キャンセルは全体を通じて権威であり続ける。

プレッシャーポリシーは、永続ルートを所有するアダプターから容量を解決する。容量の欠如、出力とヘッドルームがウィンドウを使い果たすこと、またはしきい値以上の保持予算は、手動プレッシャーパスにターゲット固有の設定エラーを throw させる。自動リスナーはその正確なターゲットについて 1 回警告し、設定が修正されるまでプロアクティブな圧縮をスキップする。プロバイダーが確認したオーバーフローリカバリーは引き続き利用できる。

### 要約のメカニクス

直接の `ctx.llm.stream()` 呼び出しは、設定された provider/model ペアと上限を使用し、最新のログ記録されたリクエストターゲット、次に `AgentOptions` のペアへフォールバックする。ループ専用の `agent/request` 拡張ポイントは実行しない。この呼び出しは、サーフェスノード 0 の派生 `system/message` を `messages` の先頭エントリーとして再生し、続けてシャドウされたリージョンのメッセージ（シャドウされた履歴内 `system/message` をそのサーフェス位置で含む）を再生し、ルート固有の投影のためにヘッダーのアクティブツールを提供する。選択されたアダプターは、再生されたメッセージ内の画像参照を解決するか、明示的に拒否しなければならない。呼び出しは圧縮指示を最後のユーザーメッセージとして追記し、投影が許す範囲でプロバイダーのウォームプレフィックスを保つ。空の内容のシステム先頭はメッセージを寄与しないが、圧縮範囲の外側に留まる。最後の指示は、永続アイデンティティもソースも持たないフリーズされた `RequestUserInput` である。再生された履歴と永続化されたチェックポイントは永続メッセージのままである。呼び出しは `GenerateOptions.purpose` を `compaction` に設定する。チェックポイントに入るのは返されたテキストのみであり、reasoning とツール呼び出しは除外される。画像出力は消えるのではなく `UNSUPPORTED_CONTENT` で失敗する。置換ユーザーメッセージは要約を `<compacted-summary>` タグで囲む。生の要約は `compaction/summary` イベントに残る。呼び出しは `Session.toolHistory()` も運び、ランタイムが遅延定義と保持定義を投影できるようにする。更新メッセージを欠くプレフィックスは、developer 更新なしのアクティブ宣言を使用する。

### リージョントランザクション

失敗した要約リクエストは、キャンセルと選択の安定性を確認した後に同期的な `compaction/summary-error` をディスパッチする。リカバリーリスナーは、再試行を要求する前に永続的な入力変更を記録しなければならない。バックエンドは選択されたメッセージを再派生し、それらのトークン価格と縮小ベースラインを更新する。画像オフロードプラグインが画像選択を所有し、その記録された省略は、要約が後で失敗またはキャンセルされても有効なままである。

トランザクションはサーフェススパンと永続ロックを検証し、`compaction/start` を追記し、フックを通じて要約し、安定性を再検証し（自動呼び出しはサーフェス全体、手動呼び出しは選択スパン）、ソースを縮小しない要約を拒否し、`compaction/summary` と置換 `user/message` を追記し、正確に 1 回の `compaction/end` 試行を行う。ライブの未一致 start が永続ロックである。新しい `session/end-seed` より前の未一致マーカーは、以前のライフサイクルからの古い証拠でありブロックしない。その境界より後のものは `busy` を報告する。失敗したクローズは意図的にブロッキングオーファンを残す。キャンセルはクリーンアップと永続化の後も権威であり続ける。

### 設定の解決

`resolveConfig` はデフォルトを検証してデタッチし、`resolveTargetPolicy` は正確な provider/model オーバーライドをマージし、`resolveCompactSpec` はトリガーと保持予算を解決するために明示的なアダプター容量とルーティング済み出力予約を要求する。有効なエンベロープの `maxTokens` がその予約を供給し、アダプターのデフォルト、次にゼロへフォールバックする。モデル探索（`listModels()`）がポリシーのために参照されることはない。重要なのは永続ルートの容量だけである。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー。`BasicCompactionEngine`、自動リスナー、エントリーポイントのディスパッチ |
| [`src/region.ts`](src/region.ts) | 保持の選択と、共有されるブラケット優先のコンパクショントランザクション |
| [`src/summarizer.ts`](src/summarizer.ts) | デフォルトの `ctx.llm.stream()` 要約、チェックポイントのフレーミング、安全な要約の投影 |
| [`src/config.ts`](src/config.ts) | ロード時の検証とルーティング済みモデルポリシーの解決 |
| [`src/types.ts`](src/types.ts) | `BasicCompactionConfig` と解決済みポリシーの語彙 |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では不十分なときにこれらのページを読む。共有シームから任意のコンパニオン、そして決定の証拠へと進む。

- [Compaction seam](../compaction/README.md) — このバックエンドが実装する圧縮の契約。
- [Compaction subsystem reference](../../../docs/subsystems/compaction.md) — 圧縮の語彙、結果、サービス動作。
- [Tool-result pruner](../compaction-tool-result-pruner/README.md) — 先にサイズ超過のツール出力をトリミングする任意のコンパニオン。
- [Human /compact command](../command-compact/README.md) — プレッシャーを待たないオンデマンド圧縮。
- [Token meter](../../llm/token-meter/README.md) — いつ圧縮するかを決定する計測サービス。
- [Generated configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-compaction-basic) — 受け付けられるすべての設定フィールドとそのソース宣言。

-----

<a id="model-experience"></a>
## モデル体験

### 会話履歴

#### モデルが見るもの

成功したステップがしきい値を超えた後、任意のプルーナーがロードされている場合は、まずサイズ超過のツール結果が書き換えられる。要約が依然として必要な場合、次のリクエストは以下に示すチェックポイントの前文、空行、`<compacted-summary>`、データ依存の要約、`</compacted-summary>` を受け取る。オーバーフローリカバリーは、サーフェスを前進させた置換から即時再試行を再構築する。チェックポイントは選択された古い範囲を置き換え、その後に保持された最近の単位が続く。

##### 会話チェックポイントの前文

```markdown
This is an automatically generated checkpoint condensing an earlier span of the conversation to free up context. Treat the captured context as established background and build on it without restating it. Continue the task directly from the messages that follow, without acknowledging this checkpoint.
```

#### トークンへの影響

モデルを使わないプルーニングは補助呼び出しを完全に回避できることがある。そうでなければ、要約が古い範囲を置き換える前にその呼び出しのトランスクリプトを削減する。置換は 2 つ目のコピーを追記するのではなく、将来の入力履歴を削減する。要約は後のコンパクションが置き換えるまで残り、不可分な非ツール単位は依然として予算を超えることがある。

#### KV キャッシュへの影響

追記のみではなく置換である。各チェックポイントは、置き換えられた最初の履歴トークンから再利用を無効化する。その範囲より前の変更されていないリクエストプレフィックスは再利用可能なままである。

### 補助サマライザーリクエスト

#### モデルが見るもの

要約モデルは、システムプロンプトとシャドウされたリージョンの履歴を、そのルート向けに投影されたツール宣言と developer 更新とともに受け取り、最後に 1 つの最終ユーザーメッセージ — 以下に示す圧縮指示 — が続く。会話モデルがこのプライベートなリクエストやその reasoning を見ることはない。保存されるのは返されたテキストだけである。

##### 圧縮指示（最終ユーザーメッセージ）

```markdown
You are now acting as a compaction engine for this AI coding assistant. Condense the conversation ABOVE into a structured checkpoint that lets another model resume the work with no loss of essential context.

Output EXACTLY the Markdown structure below: keep every section, in order. Use terse bullets, not prose paragraphs. Write "(none)" for an empty section — never drop a section.

## Primary Request and Intent
- [the user's original and evolving goals; quote verbatim where the exact wording matters]

## Key Technical Concepts
- [technologies, frameworks, patterns, and conventions in play]

## Files and Code
- [exact path: why it matters, key changes or snippets]

## Errors and Fixes
- [error: how it was resolved, plus any related user feedback]

## Pending Jobs
- [explicitly requested work not yet completed]

## Current Work
- [precisely what was in progress at this checkpoint]

## Next Step
- [the single next action, directly in line with the most recent request, or "(none)"]

## Critical Context
- [decisions and their rationale, constraints, user preferences, open questions, data needed to continue]

Rules:
- Write concise English engineering prose. Preserve exact file paths, commands, error strings, identifiers, numeric values, function signatures, and syntax fragments.
- Capture user feedback and explicit instructions faithfully, especially corrections.
- Do NOT mention this summarization request or that the context was compacted.
- Output only the checkpoint text: do not call any tool or take any other action.
- If the conversation already contains a <compacted-summary> block, it is a PRIOR checkpoint. Do not copy it forward verbatim: preserve still-true facts, drop stale ones, and merge newer information into a single consolidated summary under the same structure.
```

#### トークンへの影響

これは別個のモデル呼び出しである。入力は再生された会話プレフィックスと固定の指示で、出力は `maxTokens` で上限付けされる。収束の再試行はこのコストを複数回支払うことがある。

#### KV キャッシュへの影響

再生されるシステムプロンプト、ツール、シャドウされたリージョンのメッセージは、会話の最後にルーティングされたリクエストとバイト単位で一致するため、プロバイダーのウォームプレフィックスキャッシュは末尾の指示まで再利用される。キャッシュされないのはその指示と要約出力だけである。サマライザーを別の provider/model にルーティングしたり、先頭以外の範囲を圧縮したりすると、この再利用は失われる。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、自動圧縮が適さない、または特別な注意を要する状況を定義する。これらは現在のパッケージ制約である。

- **メーターの精度は固定ヒューリスティックに従う** — 再利用可能なプロバイダー使用量が欠けている場合は、正確なトークン化ではなく文字数と構造的オーバーヘッドにフォールバックする。画像の出現は、アダプターがリクエスト画像価格を宣言するルートでのみ、プロバイダー正確な視覚トークンを持つ。
- **オーバーフロー分類はアダプターが保守する** — プロバイダーの文言は変わりうる。両方の DeepSeek アダプターは、認識したコンテキスト上限の失敗を `CONTEXT_WINDOW_EXCEEDED` に正規化する。
- **一部の不可分単位とエンベロープのみのオーバーフローはサーフェス圧縮の対象外に残る** — リカバリーは system/tools/prefix を縮小したり、不可分な非ツールノードを分割したり、プルーニングできない残余が依然としてウィンドウを超えるツール単位を修復したりできない。任意のプルーナーは、それ以外は不可分なペアの内部にあるテキストを含むツール結果の大部分を縮小できる。
- **`compactRegion` はオープンターンを必要とする** — 完全に閉じたセッションへの手動呼び出しは、圧縮する代わりに throw する（「no open turn」）。
- **要約の失敗は最新の永続サーフェスを保持する** — 置換の前であれば、自動パスは警告をログに記録し、予算超過の完全な履歴で続行する。プルーニングがすでに適用されている場合、後続の要約失敗はその永続的なプルーニング済みサーフェスから続行する。隠れた reasoning トークンが消費しうる `maxTokens` での要約の切り捨ては、同じルールに従う。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発者ノートはメンテナー向けの作業コンテキストであり、明示的に非権威である。出荷される動作は、上記のセクション、パッケージコード、およびリンクされた Agent Notes にある。

- **デフォルト比率は未決定** — `thresholdRatio: 0.8` と `retainRatio: 0.16` は固定のデフォルトである。`modelPolicies` によるモデル単位の調整は存在するが、理想値に関するコーパスに裏付けられたガイダンスは記録されていない。
- **トークナイザー正確な計測は先送り** — トークンメーターの 1 トークン 4 文字ヒューリスティックは CJK テキストと JSON Schema ドキュメントを安く見積もりすぎる。正確なトークン化は計測サービスの未解決の方向性として残る。
- **正規エラーを超えるオーバーフローリカバリーは未決定** — リカバリーは `CONTEXT_WINDOW_EXCEEDED` でのみトリガーされる。その他のプロバイダー側のコンテキスト失敗は分類されない。

</details>
