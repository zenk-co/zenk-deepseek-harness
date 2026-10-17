---
description: "spill ストレージサービス: 過大なツールテキストまたはキャプチャされたセッション参照を保存し、取得可能なロケーターを返す。"
kind: "package-reference"
---

# @deepseek-ai/dsh-spill

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-spill` は、プラグインとツールが公開 `ctx.spillStore` API を通じて過大なテキストを保存し、不透明なロケーター、正確なバイト数、取得ガイダンスを受け取れるようにする。完全な結果がモデルコンテキストを埋めずに取得可能なままでなければならない場合に選ぶ。ローカル永続化には `dsh-spill-local` を構成し、過大なツール結果を上限付きプレビューにすべき場合は `dsh-spill-policy` を追加する。API は保持、置き換え、取得、検索の操作を提供しない。保存はストレージ失敗で拒否し、呼び出し元はコンテンツをインラインに保つか失敗するかを選ぶ。

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

spill 成果物を保存する構成は 1 つのバックエンドをマウントする — このパッケージ単体は何も保存しない。`dsh-spill-policy` がツール結果をいつ spill するかを決め、`dsh-session-reference` はそのポリシーを必要とせずに切り詰められた参照トランスクリプトを直接保存する。呼び出し元は明示的な owner を付けて `ctx.spillStore.saveText()` を使う。オプションのコンシューマーは `ctx.get("spillStore")` でバックエンドを発見する。

### いつ選ぶか

フェッチされたページボディやキャプチャされたセッション参照トランスクリプトのように、モデルが上限付きプレビューを見た後も完全なテキストを取得可能に保つ必要があるデプロイでは、spill ストレージを選ぶ。ロケーターと取得ヒントがデプロイで使用可能なバックエンドが前提条件である。ローカルファイルシステムアクセスはサービスの要件ではない。

### 最小の動作構成

バックエンドとポリシーを一緒にマウントする。`maxInlineTokens` を設定すると、過大なテキスト/画像ツール結果は自動的にプレビューとロケーターになる。

```yaml
- name: '@deepseek-ai/dsh-spill-local'
- name: '@deepseek-ai/dsh-spill-policy'
  config:
    maxInlineTokens: 12500
```

### テキストの保存

バックエンドをマウントした状態で、所有セッション、ソース記述、推奨ファイル名、完全なテキストを付けて `ctx.spillStore.saveText()` を呼ぶ:

```text
const ref = await ctx.spillStore.saveText({
  owner: { sessionId: 'session-1' },
  source: { kind: 'tool', toolName: 'web_fetch', callId: 'call-1', label: 'result' },
  suggestedName: 'web_fetch.txt',
  content: fullText,
})
```

返される `SpillRef` は 3 つのフィールドを運ぶ: `locator` はバックエンドが生成する不透明なモデル向けハンドル（`dsh-spill-local` ではローカルファイルパス、他のバックエンドではおそらく URI やキー）、`bytes` は書き込まれた正確な UTF-8 バイト数、`retrievalHint` はコンシューマーがモデルに見せるガイダンス（ローカルバックエンドでは、そのパスを読むか grep する）。コンシューマーはロケーターをヒントとともにレンダリングし、ロケーター自体を解析することは決してない。

### 所有権と境界

ストレージは所有セッションによってグループ化される: fork されたセッションは、シードされたログから既存のロケーターをコピーや再所有なしに継承し、fork 後の新しい spill は子セッション ID を使う。セッション参照成果物は、参照されたソースセッションではなく、コンテキストを受け取るターゲットセッションに属する。`suggestedName` は単なるヒントである — バックエンドはそれを 1 つの安全なセグメントに無害化し、パスとして信頼することは決してない。プレビューと spill の判断はコンシューマーが所有し、ストレージと成果物の期限はバックエンドが所有する。

### 失敗と回復

`saveText` が拒否するのは実際のストレージ失敗のみである — 権限、空き容量不足、またはバックエンドの停止。劣化の仕方は呼び出し元が決める: 出荷済みポリシーは拒否をベストエフォートとして扱い、警告をログに記録し、元のインライン結果を保つため、spill の失敗が成功したツール呼び出しをエラーにしたりコンテンツを隠したりすることは決してない。バックエンドがマウントされていない場合は保存するものが何もない。構成で `dsh-spill-local` または別のバックエンドをロードする。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションではサービスの背後にある設計判断を説明する。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱う。

### 設計思想

このパッケージは 1 つの分離と意図的な最小限の上に築かれている:

- **契約、実装、ポリシーは分離したまま。** このパッケージはバックエンドが何をするか（`saveText`）を定義し、`dsh-spill-local` がそれを実装し、`dsh-spill-policy` がいつするかを決める。各関心事は独立に進化して交換される。
- **1 つのメソッド、それだけ。** このシームは保持ポリシー、結果の置き換え、取得または検索 API を所有しない — それらには所有するパッケージがある。
- **拒否し、シームで暗黙に劣化しない。** 劣化は呼び出し元が所有し、シームは実際のストレージ失敗を報告する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリ: 抽象 `SpillStore` サービスとその `saveText` 契約 |
| [`src/types.ts`](src/types.ts) | 語彙: `SaveTextSpill`、`SpillRef`、ブランド付き `SpillLocator`、`SpillOwner`、`SpillSource` |

### データモデル

`SaveTextSpill` はストレージの所有権とソース記述を分離する。`SpillSource` はツールソース `{ kind: "tool", toolName, callId, label }` または `{ kind: "session-reference", sessionId, label }` のいずれかを受け付け、後者の ID はキャプチャされたソースセッションを名指しする。セッション参照はツール呼び出し ID を捏造することは決してない。ソース記述子も owner 名前空間も読み取りアクセスを与えない。コンシューマーは返されたロケーターを不透明として扱い、取得ヒントとともに提示する。

### ライフサイクル

バックエンドは `SpillStore` をサブクラス化してプラグインとしてロードし、`ctx.spillStore` として登録する。コンテキストごとに実装は 1 つで、2 つ目のロードは失敗する。破棄はサービスを解放する。抽象クラス自体は何も登録しない — このパッケージは契約と語彙のみを提供する。

</details>

-----

<a id="further-exploration"></a>
## さらなる探索

パッケージレベルの契約では足りないときにこれらのページを読む。共有語彙から、出荷済みバックエンド、ポリシー、設計根拠へと進む。

- [Spill サブシステム](../../../docs/subsystems/spill.md) — 網羅的な語彙、所有権、バックエンドの関係。
- [Spill パッケージマップ](../README.md) — 3 パッケージファミリーと各役割。
- [dsh-spill-local](../spill-local/README.md) — 出荷済みローカルファイルシステムバックエンド。
- [dsh-spill-policy](../spill-policy/README.md) — 最終結果が大きすぎるかを決めるポリシー。
- [dsh-output-retention](../../util/output-retention/README.md) — ポリシーの背後にあるプレビューの仕組み。
- [ツール出力 spill の決定](../../../.agents/notes/implemented/architecture/2026-07-08-tool-output-spill-files.md) — ケイパビリティ境界と設計根拠。

-----

<a id="model-experience"></a>
## モデル体験

間接的に、spill コンシューマーを通じて。それらがバックエンドのロケーターと取得ガイダンスをモデルにレンダリングする。

#### KV キャッシュへの影響

直接の無効化はない。名前付きのコンシューマーがリクエストプレフィックスの変更を所有する。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、spill ストレージサービスが単体では不完全な場合を定義する。これらは現在のパッケージ制約である。

- **取得または削除 API はない** — コンシューマーはバックエンドのロケーターとガイダンスをレンダリングすることしかできない。ライフサイクルとアクセスのセマンティクスはバックエンド固有のままである。
- **ストレージはアクセス制御ではない** — owner セッションは書き込みを名前空間化するが、ロケーターの読み取りを認可しない。各バックエンドと取得コンシューマーが自身の境界を執行しなければならない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発メモはメンテナー向けの作業コンテキストである: 未決定の方向性と未解決の疑問。明示的に非権威である。

#### 将来: 実行者 spill ファイル統合

このシームには `saveText` しかない。既存の実行者 spill ファイル（たとえば bash の一時ファイルの正規化）のための save-file または link/copy パスと、サブエージェントのロールアウト用のツール所有 spill は、[ツール出力 spill の決定](../../../.agents/notes/implemented/architecture/2026-07-08-tool-output-spill-files.md)に従い延期されたままである。

#### 将来: 非ローカルバックエンドとクリーンアップ

リモートまたはデータベースのバックエンドは未解決のままである。ローカルバックエンドは自身の[起動クリーンアップポリシー](../spill-local/README.md#startup-cleanup)を適用し、このサービスはセッションごとのクリーンアップやロケーター更新 API を定義しない。

</details>
