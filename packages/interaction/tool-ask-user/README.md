---
description: "user-questions シーム上のモデル向け ask_user_question ツール。対話的なエージェント面を構成またはデバッグするユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-ask-user

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`ask_user_question` は、ユーザーに確認、選択、または不足情報を求める。デフォルトでは回答を待つ。`mode: timed` では、デッドラインによってモデルが独立した作業を続行する一方で、質問は回答可能なままにできる。`timeout: -1` は無期限に待つ。生きた子エージェントはこのツールを呼び出せない。回答 UI は呼び出し元が提供する。

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

モデルがユーザーの判断を必要とする場合、このプラグインを `ctx.userQuestions` とともに構成する。回答者がいない場合、ブロッキング呼び出しは失敗し、有限の timed 呼び出しはデッドラインで pending を返す。

出荷済みプリセットはブロッキングモードを使用する。timed モードを有効にするには、アクティブなプリセットの `config.plugins` リストで `tool-ask-user` 行に `mode: timed` を設定する:

```yaml
- id: tool-ask-user
  name: '@deepseek-ai/dsh-tool-ask-user'
  config:
    mode: timed
    timeout: 120
```

これはトップレベルの `--patch` エントリではなく、プラグイン行である。Web プロファイルでは `preset-standard` プラグインリストを変更するか、Agent Preset エディターを使う。`mode: legacy` または設定の省略はブロッキングスキーマを維持する。行の `timeout` はデフォルトで各 timed 呼び出しに適用され、`-1` はモデルが正の timeout を指定しない限り無期限に待つ。モデルが指定した `-1` はその呼び出し（すべての質問を含む）にのみ適用される。

### ツールを呼び出すタイミング

呼び出し内で一意な ID を持つ 1 つ以上の質問を送る。回答はそれらの ID をエコーする。推奨オプションを先頭に置き、そのラベルに `(Recommended)` を付ける。任意の呼び出しごとの `timeout` は秒単位である。回答なしでは安全に作業を続行できない場合は `-1` を使う。タイムアウトが承認になることは決してない。Web カードでは、編集または Take time の選択も、送信またはキャンセルまでそのクライアントの待機を保持する。

```json
{
  "questions": [
    {
      "id": "cleanup",
      "question": "Proceed with the destructive cleanup?",
      "header": "Confirm",
      "options": [
        { "label": "Yes, delete them (Recommended)", "description": "Removes the three stale files." },
        { "label": "No, keep them", "description": "Aborts the cleanup." }
      ]
    }
  ]
}
```

### モデルが返されるもの

回答は質問ごとに 1 つの項目を返す。`selected` はオプションのラベルを保持し、`custom` は複数選択の回答を補足するか、単一選択の選択肢を置き換える。スキップされた項目は空の `selected` を持ち、`custom` を持たない。

有限の timed 呼び出しでは、`{ "pending": true, "callId": "…" }` はフォアグラウンドの待機が回答なしで終了したことを意味する。質問は回答可能なままで、モデルは独立した作業を続行できる。後からの回答は `kind`、`tool`、`callId` で識別されるユーザーメッセージとして届く。Web チャットはその質問と回答を対にする。他のコンシューマーはコンパクトな JSON テキストを受け取る。

```json
{ "answers": [{ "id": "cleanup", "selected": ["Yes, delete them (Recommended)"] }] }
```

### 呼び出しが失敗するとき

legacy および `timeout: -1` の呼び出しは回答またはキャンセルを待つ。受け入れる回答者がいない場合、エラーを返す。回答者のいない有限の timed 呼び出しは、デッドラインで pending を返す。キャンセル、および呼び出し元が正確な生きたランタイムルートでない場合もエラーを返す。生きた子エージェントは `DELEGATED_CALLER` で拒否され、未解決の判断を自身の最終結果に含めなければならない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

観察可能な動作は[このパッケージを使う](#use-this-package)で扱う。このセクションではツール定義と、それがシームとどう関係するかを説明する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | デフォルトのブロッキングツール定義とモード選択 |
| [`src/timed.ts`](src/timed.ts) | オプトインの timed ツール定義と結果レンダリング |

### コンシューマーの役割

このプラグインは 1 つのツール定義を登録する。legacy モードは `ask()` を呼び、timed モードは正のタイムアウトには `askTimed()` を、`-1` には `ask()` を呼ぶ。どちらも呼び出し元エージェントとターンシグナルを `ctx.userQuestions` へ転送する。timed リクエストはツール呼び出し ID を `wait` に含めるため、クライアントはカードを再び開ける。プロジェクションは、記録されたツールスキーマの `timeout` フィールドから timed のネイティブ呼び出しを識別する。呼び出しがその引数を省略しても同様である。

### 結果のレンダリング

`render` 出力は構造化値を `JSON.stringify` 経由で単一のテキストブロックへ射影する。これが、モデル向けの結果がよりリッチなコンテンツブロック語彙ではなくコンパクトな JSON である理由である。

</details>

-----

<a id="further-exploration"></a>
## さらなる探索

パッケージレベルの契約では足りないときにこれらのページを読む。ツールの面からシーム契約とその回答者ウォーターフォールへと進む。

- [ユーザー対話サブシステムリファレンス](../../../docs/subsystems/user-questions.md) — このツールの背後にあるサービス契約、質問語彙、回答者ウォーターフォール。
- [ツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-ask-user) — 生成された `ask_user_question` スキーマ。
- [user-questions パッケージ](../user-questions/README.md) — このツールが消費するシーム。
- [interaction グループのマップ](../README.md) — 隣接する承認とコマンドの面。

-----

<a id="model-experience"></a>
## モデル体験

### ツールスキーマ

#### モデルが見るもの

出荷済みプリセットは元のブロッキング [`ask_user_question` スキーマ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-ask-user)を公開する。`mode: timed` を設定したカスタム Cordis 行は代替スキーマに切り替わる。そこには質問 ID、プロンプト、見出し、オプション、複数選択フラグ、`timeout`、pending 結果が含まれ、モデルは選択された定義だけを見る。

#### トークンへの影響

ツールが可視であるすべてのリクエストに固定のスキーマコスト。

#### KV キャッシュへの影響

定義と可視性が変わらない限りプレフィックスは安定する。プラグインライフサイクルまたはスコープ付き制限が、このスキーマ以降の再利用を無効にする場合がある。

### ツール呼び出し履歴と結果

#### モデルが見るもの

アシスタントのツール呼び出しは質問を保持する。待機中の回答は次のステップでコンパクトな `{"answers":[{"id":"<id>","selected":["<label>"],"custom":"<text>"}]}` JSON として現れる。未使用の `custom` は省略される。タイムアウトした呼び出しは `{"pending":true,"callId":"<pending-call-id>","message":"<instruction>"}` を返す。後からの回答は、`kind: "answer_to_pending_question"`、`tool: "ask_user_question"`、呼び出し ID、元の質問、回答を伴うユーザーメッセージとして届く。送信前の UI アクティビティはモデルコンテキストではない。

#### トークンへの影響

引数と回答 JSON はデータ依存の保持トークンである。人間を待っている間のトークンコストはない。

#### KV キャッシュへの影響

追記のみ。新たに可視になる内容は再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリを無効にしない。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このツールが不向きな場合を定義する。これらは現在のパッケージ制約であり、UI バックログではない。

- **legacy ツールは pending を報告しない** — 回答かエラーを返す。ネイティブ legacy 呼び出しは `userQuestions` プロジェクションに入らず、中断された呼び出しは遅れての回答を受け取れない。
- **中断された PTC 待機は質問を失うことがある** — `run_code` プロセスが、`ask_user_question` サブ呼び出しの `tool/ptc-dispatch` 結果を記録する前に終了すると、プロジェクションはそのサブ呼び出しを遅れての回答のために再構築できない。
- **ランタイム所有のサブエージェントはユーザーに質問できない** — `ask_user_question` は別のエージェントが所有する生きた子を `DELEGATED_CALLER` で拒否する。子は未解決の質問や判断を自身の最終結果に含めなければならない。永続的リネージはこの境界を決めないため、リネージを持ちランタイムルートとして再開されたセッションは通常どおり質問できる。
- **ネイティブの回答は JSON テキストとしてレンダリングされる** — 正規の値は構造化されたままであるが、モデル向けの結果はよりリッチなコンテンツブロック語彙ではなくコンパクトな JSON を使う。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

[`userQuestions` プロジェクション](../user-questions/src/projection.ts)は、呼び出し引数ではなく記録された各ツールスキーマを読む: timed 呼び出しは `timeout` を省略する場合があり、timed の `-1` 呼び出しも timed スキーマを使う。プロジェクション折り畳みの変更には `stateVersion` のバンプが必要で、保存されたキャッシュはログから再折り畳みされる。

</details>
