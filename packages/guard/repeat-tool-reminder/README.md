---
description: "同一のツール呼び出しループからモデルを促し出すアドバイザリーなループ衛生ガード。このプラグインを選択、設定、またはデバッグするユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-repeat-tool-reminder

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは、進展がないまま同じツールを同一の引数で呼び続けるループからモデルが抜け出すのを助ける。設定された繰り返し回数で、モデルに前の結果を検査し、アプローチを変えるか終了するよう求める。リマインダーはアドバイザリーである: 正当な繰り返し呼び出しをブロックしたり遅延させたりすることは決してない。繰り返しはエージェントごとに別々に追跡され、新しいユーザーメッセージでクリアされる。`dsh` ベースバンドルは 3、5、および 8 回の繰り返しでリマインダーを出す設定でこのパッケージを有効にする。

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

モデルが同一のツール呼び出しでループしていることに自ら気づくべき場合にこのプラグインをマウントする。学ぶべきことや配線すべきことは何もない: `dsh` ベースバンドルは既にこれを実行しており、デフォルトはほとんどのセッションで機能する — より早く、より遅く、またはより少ないツールで促しを出したい場合は、以下のしきい値とツールスコープを調整する。

### いつ選ぶか

モデルが長時間自律的に作業し、スタックしたループを力ずくではなく助言で断ち切りたい失敗としたい場合にこれを選ぶ。同一の繰り返しが正当で邪魔されずに実行される必要がある場合 — ガードはリマインドするだけで、リマインダーは繰り返し呼び出しの後の小さな追加メッセージである — や、ほぼ同一のバリアントを捕まえる必要がある場合は避ける。検出されるのは正確な繰り返し (同じツール、プロパティの順序によらず同じ引数) のみであるためである。

### しきい値とスコープの設定

リマインダーが発火するタイミングや対象ツールを変更したい場合は、設定付きでプラグインをマウントする:

```yaml
- name: '@deepseek-ai/dsh-repeat-tool-reminder'
  config:
    thresholds: [3, 5, 8]        # remind at 3, 5, and 8 consecutive repeats
    include: []                  # track every tool; list patterns to track only some
    exclude: [todo_write]        # never track these tools
    argumentsPreviewChars: 500   # cap on arguments shown in the detailed reminder
```

| フィールド | デフォルト | 意味 |
|---|---|---|
| `thresholds` | `[3, 5, 8]` | リマインダーをトリガーする繰り返し回数 |
| `include` | `[]` | これらのツールのみを追跡する; 空はすべてのツールを意味する |
| `exclude` | `[]` | これらのツールは決して追跡されない; それらへの呼び出しはカウントもリセットもしない |
| `argumentsPreviewChars` | `500` | 詳細リマインダーが表示する繰り返し引数の文字数 |

無効な設定は起動時に明確なエラーで失敗する — 空の `thresholds` リスト、2 未満の繰り返し回数、または重複 — 挙動が黙って変わることは決してない。生成された[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-repeat-tool-reminder)が受け入れられるすべての値を文書化する。

### 得られるもの

デフォルトでは、同一の引数で同じ呼び出しを繰り返すモデルは、3 回目の繰り返しで短いリマインダー — 再度呼び出す前に前の結果を分析するよう — を受け取り、5 回目と 8 回目で詳細なリマインダーを受け取り、ツールと繰り返された引数を名指すため、アプローチを変えるか、さらに証拠を集めるか、終了するかを決められる。新しいユーザーメッセージがカウントをクリアするため、新しい指示がループとして扱われることは決してない。リマインダーは繰り返し呼び出しの結果の後にプラグインに帰属されて会話に現れるため、モデルは他のメッセージと同様にそれらを読む。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションはガードが繰り返しを検出してリマインダーを届ける方法を説明し、それを実現するコードを指し示す; 観察可能な挙動は[本パッケージを使う](#use-this-package)で完全に扱う。

### 設計哲学

ガードは 4 つのコミットメントの上に構築されている:

- **拒否権ではなく助言。** ガードは post-execute の決定をモデルコンテキストで enrich する; 呼び出しをブロックしたり書き換えたりすることは決してないため、`PostToolDecision` のブロックは後続のリスナーの仕事のままである。
- **post-execute でカウントする。** 検出は `tools/post-execute` で実行され、拒否された呼び出しでも発火する; そこでカウントすることで、1 つのリスナーがクロスイベント状態なしにすべての試行をカバーできる。
- **完全一致の正規化。** 引数はループの `JSON.parse` 出力 (またはその生文字列フォールバック) としてガードに到達するため、JSON の値領域が入力領域の全体であり、深いキーソートと `JSON.stringify` が完全で決定論的な同一性である — 入力経路がそれらを生成しえないため、bigint、サイクル、または `undefined` の処理は存在しない。
- **ロード時に大声で失敗する。** `thresholds` と `argumentsPreviewChars` は `apply` で検証されスローする; デフォルトへのフォールバックは決してしない。

### 検出: 繰り返しチェーン

各エージェントのチェーンは `(tool name, canonical arguments)` でキーされる — 同じツールと同じ正規化済み引数を持つ 2 つの呼び出し (プロパティ順序は無視) は連続としてカウントされ、異なる追跡対象の呼び出しはカウントを 1 にリセットする。チェーンは `WeakMap<Agent, Chain>` に置かれる。

- **追跡されない呼び出しはチェーンに対して透明である。** `include`/`exclude` で除外された呼び出しはカウンターを増やしもリセットもしないため、`todo_write` が除外されている場合、`grep X → todo_write → grep X` は依然として 2 つの連続する `grep X` としてカウントされる — ループに挟まれたブックキーピングツールはそれを洗浄しない。
- **拒否された呼び出しもカウントされる。** 検出は `tools/post-execute` に位置し、これは `tools/pre-execute` リスナーが拒否した呼び出しでも実行される; 拒否された呼び出しを叩き続けるモデルはまさに断ち切る価値のあるループである。
- **エージェントのない呼び出しは無視される。** 直接の `ctx.tools.execute()` 呼び出し元にはリマインドすべきモデルがなく、キーとする生きた agent オブジェクトもない。
- **エージェントごとのキー付け、ユーザープロンプトでリセット。** あるエージェントの繰り返しが別のエージェントのリマインダーをトリガーすることは決してない; ユーザープロンプト (`agent/pre-step`) が送信したエージェントのチェーンを削除し、オブジェクトの寿命が破棄リスナーなしに弱エントリーを境界付ける。
- **インメモリのみ。** 永続化から再開されたセッションは新しいチェーンで始まる — ガードはヒューリスティックな促しであり、ログに記録された不変条件ではないため、再開後のリマインダーは受け入れられたコストである。

### リマインダーの配信

リマインダーは post-execute の決定の `additionalContexts` (ソース `{kind: 'repeat-tool-reminder', form: 'notice', summary: '<tool> × <count>'}`) に乗り、`content` の置換には決してならない: `tool/result` イベントは監査のためにツール自身の出力のままである。ループはそのコンテキストをバッファし、ステップのツール結果の後に注入された `user/message` として追加し、セッションはそれをプレーンな合成ユーザーメッセージとしてレンダリングする — モデル可視で、ソースが帰属され、新しいセッションイベントなしにセッションログから再構築可能である。ガードは常に `next()` を通じて委譲し、リマインダーを下流の決定のコンテキスト配列の先頭に付加するため、どちらの決定バリアント (ブロックされた呼び出しを含む) も促しを受け取り、すべてのエントリーが自身のソースとメタデータを保つ。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: `Config` スキーマ、フェイルラウド検証、チェーンリスナー |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では不十分なときにこれらのページを読む。ツール waterfall から網羅的な設定とガードグループマップへ進む。

- [Tools サブシステムリファレンス](../../../docs/subsystems/tools.md) — このガードが消費する `tools/execute` waterfall、`additionalContexts`、および決定の形。
- [生成された設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-repeat-tool-reminder) — 受け入れられるすべての設定フィールドとそのソース宣言。
- [guard グループマップ](../README.md) — 兄弟ガードパッケージとループ衛生ファミリー。

-----

<a id="model-experience"></a>
## モデル体験

### 最初のしきい値のコンテキストメッセージ

#### モデルが見るもの

最初に設定された連続繰り返しのしきい値で、そのエージェントは以下のリマインダーを受け取る。ツールスキーマや通常呼び出しのテキストは追加されない。

##### 最初のしきい値のリマインダー

```markdown
You are repeating the exact same tool call with identical arguments. Carefully analyze the previous result before calling again: if the task is not complete, try a different approach or different arguments instead of repeating the call.
```

#### トークンへの影響

しきい値前はゼロトークン。リマインダーはそのエージェントの保持された履歴である。

#### KV キャッシュへの影響

追記のみ; 新たに可視になった内容は再利用可能なリクエストプレフィックスに従い、既存の KV キャッシュエントリーを無効化しない。

### 後続しきい値のコンテキストメッセージ

#### モデルが見るもの

後続のしきい値は以下の詳細リマインダーテンプレートを受け取る。上限付きの引数プレビューは正確に `… (+<omitted> more chars)` で終わる。

##### 後続しきい値のリマインダー

```markdown
Repeated tool call detected:
- tool: <toolName>
- consecutive_calls: <count>
- arguments: <canonicalArguments>
The repeated calls are not making progress. Do not call this tool with these exact arguments again. Inspect the latest result and choose a different action, different arguments, or finish the task if enough evidence has been gathered.
```

#### トークンへの影響

各リマインダーは保持された履歴である; `argumentsPreviewChars` がそのデータ依存の引数テキストを制限し、エージェントは独立したカウンターを保つ。

#### KV キャッシュへの影響

追記のみ; 新たに可視になった内容は再利用可能なリクエストプレフィックスに従い、既存の KV キャッシュエントリーを無効化しない。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このガードが適さない場合を定義する。それらは現在のパッケージ制約であり、タスクのバックログではない。

- **完全一致検出のみ** — 正規化は深いキーソートであるため、ほぼ同一のバリアント (微調整されたパス、値内の余分な空白) はチェーンを逃れる; ファジーマッチングは必要性の証拠が出るまで拒否されている。
- **compaction はチェーンをリセットしない** — compaction チェックポイントをまたぐチェーンはカウントを続ける。
- **助言のみ** — 高いしきい値でブロッキング形式へエスカレートすることは実装されていないが、`PostToolDecision` は既にブロッキングをサポートしている。
- **subagent 間のチェーン共有なし** — チェーンはエージェントごとに分離されたままである; 親とその subagent が同じ呼び出しを繰り返しても決して合算されない。
- **正当な冪等ポーリングもしきい値を超えると促しを引く** — 圧力弁は `thresholds`/`exclude` の設定である。
- **最高しきい値を超えるとチェーンは沈黙する** — リマインダーは設定された正確な回数でのみ発火し、それを超えて発火することは決してない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

この開発メモはメンテナー向けの作業コンテキストである: 未解決の質問と未決定の方向性。明示的に非権威である — 出荷済みの挙動、制限、および受け入れられた根拠は上記のセクション、パッケージコード、およびリンクされた Agent Notes にある。

[repeat-tool-guard 機能ノート](../../../.agents/notes/archived/feature/2026-07-08-repeat-tool-guard.md)は旧パッケージ名の下の元の設計と代替案を記録している; [命名台帳](../../../.agents/notes/archived/architecture/2026-08-11-repository-naming-contract-and-rename-ledger.md)は `repeat-tool-reminder` への改名とその理由を記録している。

</details>
