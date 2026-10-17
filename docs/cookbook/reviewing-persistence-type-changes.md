---
description: "プルリクエストを開く前に、セッション永続型の変更をローカルで生成・確認・検証する。"
---

# クックブック: 永続型の変更をレビューする

日本語 | [English](reviewing-persistence-type-changes.en.md) | [中文](reviewing-persistence-type-changes.zh.md)

## 概要

このチュートリアルは、依存関係をインストール済みのコントリビューターチェックアウトで、宣言済みのセッション永続型を変更した後に使います。バイリンガルの互換性説明を用意すると、1 つのコマンドが変更を分類し、その記録を生成します。ファイルと自動ルールについては[記録のリファレンス](../persistence-changes/README.md)が説明します。比較の入力はすべてチェックアウト内にあり、ベースブランチやネットワークアクセスは必要ありません。

## 目次

- [任意: 変更を検査する](#generate)
- [1. 変更を記録する](#acknowledge)
- [2. チェック、コミット、プッシュ](#verify)
- [未受理の記録を更新する](#competing-records)
- [開発メモ](#dev-note)

-----

<a id="generate"></a>
## 任意: 変更を検査する

記録する前のプレビューとして、リポジトリルートから実行します:

```sh
pnpm --silent run verify-persistence-changes --json
```

JSON を消費するときは `--silent` を使ってください。そうしないと pnpm がライフサイクルの失敗テキストを stdout に追記します。失敗したコマンドは引き続き終了コード 1 で終了します。

報告される root、path、変更種別、互換性レビューの要否を読みます。参照される型が複数のイベントダイジェストに影響することがあります。影響を受けるすべての root を検査してください。履歴が新しいスキーマをカバーするまで、検証は失敗します。古い生成インベントリも検証を失敗させます。記録コマンドがそれを更新します。フィールドやユニオン代替の並べ替え後に `changes` が空の場合、`pnpm run gen-persistence-catalog` を実行してチェックを繰り返してください。ダイジェストが変わらなければ、コピーされた宣言やソース位置がカタログの差分を生んでも新しい確認は不要です。

確認履歴とは独立に PR をレビューするには、ベースとヘッドのインベントリをローカル JSON ファイルとして保存し、次を実行します:

```sh
pnpm --silent run persistence-review --before .artifacts/base.schema.json --after docs/persistence-schema.json
```

記録された決定は、この比較から遷移を隠すことはありません。`--check` は現在のソースと確認済み履歴を比較するだけです。記録後は、base/head レビューの代わりになることも、人間が変更をレビューしたことを立証することもできません。

レポートと共に、それらのファイルを提供したコミットを記録してください。構造化出力には `--json` を追加します。この読み取り専用の比較は、共有された変更を影響を受ける root と共にグループ化し、ユニオン内の位置ではなく実際のリテラル `kind`/`form` 値を使います。曖昧な代替は別々の追加と削除のままです。その互換性セクションは各 root の権威ある分類結果をコピーします。構造の説明は確認チェックの代わりではありません。現在のカタログラベルと宣言名は説明的メタデータであり、型を識別するのは構造アンカーとフィンガープリントです。

現在のマシンインベントリは完全なグラフを `roots` に保存します。`types` エントリは `digest`、`names`、`sources` を含み、root がそのグラフを正確に再構築できない場合は明示的な `schema` も含みます。リーダーは省略されたグラフをダイジェストによって root サブグラフから解決し、明示的なグラフを直接検証して、すべての型とそのメタデータを保ちます。過去の完全なエントリは読み取り可能なままです。`formatVersion` は正規化ルールを識別します。ストレージのコンパクションは root のフィンガープリントを変えず、確認も要求しません。

<a id="acknowledge"></a>
## 1. 変更を記録する

まず[受理済みベースライン](../session-format-status.md#finalization-record)を確認し、そのロックされた記録を保ってください。[互換性ルール](../persistence-changes/README.md#compatibility-rules)の下で、両方向のリーダーを評価します。構造の違いは、安全な解釈または拒否の証拠があれば同一バージョンのままにできます。自動的に高いライターバージョンを要求するものではありません。

`en` と `zh` を含み、それぞれに `summary`、`compatibility`、`verification` 文字列を持つローカル JSON ファイルを書きます。次の入力は、実際に試験済みの required→optional のフック監査フィールド変更を説明しています。説明とテスト証拠は、あなたの変更に関する事実に置き換えてください。CLI はこれらの主張を立証しません。

入力を `.artifacts/persistence-change.prose.json` として保存します。必要なら無視対象のディレクトリを作成してください:

```json
{
  "en": {
    "summary": "Makes the persisted hook audit decision optional.",
    "compatibility": "Existing records remain valid. Hook execution consumes HookOutput instead of replaying this audit field. Producers still write decisions, and absence does not imply pass.",
    "verification": "pnpm exec vitest run packages/experimental/hook-protocol/tests/events.spec.ts: 10 tests passed."
  },
  "zh": {
    "summary": "将持久化的钩子审计决策改为可选。",
    "compatibility": "已有记录仍然有效。钩子执行消费 HookOutput，不回放此审计字段。写入方仍然记录决策，缺失不代表 pass。",
    "verification": "pnpm exec vitest run packages/experimental/hook-protocol/tests/events.spec.ts：10 个测试通过。"
  }
}
```

この例の ID の代わりに、日付と説明的なスラッグを使ってください:

```sh
pnpm --silent run persistence-changes --record 2026-09-11-poc-optional --prose .artifacts/persistence-change.prose.json --json
```

このコマンドは履歴と対訳の prose を検証し、確立済みの同一バージョン決定を推論し、書き込み前に明示的な互換性決定をチェックします。記録ペアを生成し、スキーマ、両方のカタログ、マシンインベントリ、ペアリング記録が揃って完了します。コミットする前に、説明と返された `changes`、`roots`、`files` をレビューしてください。`--prose` を省略すると未完成のドラフトが作成され、説明が完成するまで検証が拒否します。

`requiresCompatibilityReview` とマークされた変更では、確認の Compatibility セクションで両方向のリーダーを説明し、Verification に実行済みのチェックを記録します。その証拠がバージョン維持を支持する場合は `--decision same-version` を渡してください。ヘッダーバージョンが変わらないフラグ付き変更を、明示的な決定なしで記録または更新すると `decision-required` で失敗します。構造の違いだけではバンプは推論されません。実際のヘッダーバージョンの増加は `version-bump` を推論できます。有効な判別子が安全でない解釈を防げない場合は、[セッション形式バージョンの追加](adding-a-session-format-version.md)に従い、`--decision version-bump` を選んでください。その記録は、それ自身の増加する `SessionHeader.version` 遷移を含まなければなりません。無関係な過去のバンプがそれを許可することはできません。定型的な変更が別のベースラインを作ることは決してありません。

<a id="verify"></a>
## 2. チェック、コミット、プッシュ

[テストポリシー](../testing.md)を通じて変更されたオーナーの動作チェックを選び、次にドキュメントチェックを実行します:

```sh
pnpm run doc-sync
```

`doc-sync` は永続インベントリとカタログの最新性、完全な履歴、バイリンガルペアリングをチェックします。記録コマンドの `ok: true` は、これらのチェックやオーナーの動作・移行テストの代わりにはなりません。JSON の失敗は `ok: false`、診断用の `code`、終了コード 1 を保ちます。構造化された変更は安定した種別と root ごとの before/after ダイジェストを含むため、自動化が説明を解析する必要はありません。

記録の生成は自らのカタログと記録ペアを所有しますが、パッケージ README や他のバイリンガルページの編集は通常のペアリングワークフローに従います。意図した差分をレビューしてステージし、通常どおりコミットしてプッシュします。ステージ時の lint、ペアリング、空白のフックと、プッシュ前の Host/Client 型チェックは引き続き適用されます。

<a id="competing-records"></a>
## 未受理の記録を更新する

記録後にソースが変更された場合は、互換性の説明をレビューし、同じ未受理の終端記録を更新します:

```sh
pnpm --silent run persistence-changes --update 2026-09-11-poc-optional --prose .artifacts/persistence-change.prose.json --json
```

このコマンドはマシン宣言、スキーマ、カタログ、ペアリングを更新します。`--prose` なしの場合は既存の説明を保ちます。その説明を完全な遷移に対して再評価し、フラグ付きの同一バージョン更新には `--decision same-version` を渡してください。更新は初期ベースライン、他の記録が依存する記録、ファイナライズ済みチェックポイント記録を拒否します。ファイナライズ済みチェックポイントの外では、ツリーはレビュー受理を推論しません。受理済み履歴を保ち、後継を作成してください。

統合によって競合する終端記録が生じた場合は、残りの履歴に対して未受理の記録を更新し、その結果の差分を再評価します。無関係な root の確認は更新不要です。[メカニズムの決定](../../.agents/notes/implemented/process/2026-09-11-persistence-type-history.md)が、完全なスナップショットと root ごとの先行記録を保持する理由を説明しています。

レビューが必要な既存プロパティの値型変更では、まず prose ファイルの Compatibility セクションと Verification セクションを改訂して、実際の新しい遷移とその実行済みチェックを説明します。別の変更に対して以前の required→optional の説明を再利用しないでください。次に、その prose と明示的な同一バージョンの選択で記録を更新します:

```sh
pnpm --silent run persistence-changes --update 2026-09-11-poc-optional --decision same-version --prose .artifacts/persistence-change.prose.json --json
```

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
