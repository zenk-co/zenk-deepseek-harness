---
description: "完全な V2→V3 Session 変換: システムヘッド、監査済み参照、PTC とプリセット名、正規エンベロープ、保持、拒否。"
kind: "package-library"
---

# @deepseek-ai/dsh-session-format-v2-to-v3

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

サポートされるリリース済み V2 Session を、歴史的リクエストの意味を変えずに V3 として復元する。このページはこの隣接エッジの唯一の仕様である。何を変換し、保持し、拒否するかを扱い、その後にネイティブ V3 受け入れを別に扱う。ライブラリはシステムプロンプトをメッセージへ昇格し、ローカルイベント参照を再マップし、PTC とプリセット名を変換し、エンベロープを正規化する。永続化は静的カタログを通じてこれを消費する。ライブラリはファイルを読まず、公開もしない。

## 目次

- [このパッケージを使う](#use-this-package)
- [V2→V3 仕様](#v2-to-v3-specification)
  - [ヘッダーとプリセット参照](#header-and-presets)
  - [システムヘッドとメッセージ ID](#system-head)
  - [シーケンス参照と継承](#sequence-references)
  - [PTC 語彙](#ptc-vocabulary)
  - [正規エンベロープとツールエラー](#canonical-envelopes)
  - [デリバリーガード](#delivery-guards)
  - [ソース監査と拒否](#source-audit)
- [ネイティブ V3 受け入れ](#native-v3-admission)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と延期された作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

### いつ使うか

Session を復元するには[カタログ](../session-format-catalog/README.md)を使う。直接インポートはカタログ組み立てとテストに用いられる。このライブラリに Cordis マウント設定はない。[公開エクスポート](src/index.ts)は、マイグレーション宣言、リリース済み V2 ソースコーデック、V3 ターゲットコーデック、ターゲットヘッダー検証器、ターゲット復元器を提供する。

### エントリーポイント

ヘッダーのみの操作はイベント本体を変換も検証もしない:

```text
const targetHeader = sessionFormatV2ToV3.migrateHeader(sourceHeader)
```

完全な復元はデコード済みイベントを新しいステージに通し、ターゲットアーティファクトを検証する。呼び出し元はステージの部分的な発出を成功した復元として扱ってはならない。エラーは後のイベントまたは `finish()` で発生しうる。[フォーマットプロトコル](../session-format/README.md)がステージのスケジューリングとカタログのエラー処理を所有し、[JSONL 永続化](../session-persistence-jsonl/README.md)が読み取り準備と不変の後継の公開を所有する。

-----

<a id="v2-to-v3-specification"></a>
## V2→V3 仕様

完全なエッジは恒等変換ではない。ソースイベントの相対順序とタイムスタンプ、および各歴史的リクエストの意味を保持するが、挿入されたシステムイベントはイベント数、稠密シーケンス位置、ローカル参照、継承カットを変える。PTC/プリセット変換と最終エンベロープ正規化はイベントを追加しない。変更されるのは以下に名指すフィールドのみである。保持は受け入れられた入力に適用され、任意の未監査の拡張には適用されない。

<a id="header-and-presets"></a>
### ヘッダーとプリセット参照

論理ヘッダーは `version: 2` を `version: 3` に変える。`id`、`createdAt`、`isSeeded`、`delegationDepth`、および受け入れられたオプションの `cwd`、`parentSession`、`origin` を保持する。正確なプリセット id `code` は `header.agentPreset` とすべての `agent-preset/selected.data.agentPreset`（継承およびローカルの選択を含む）で `ptc` になる。他の文字列と存在しないヘッダープリセットは変わらない。選択ペイロードは文字列のプリセット id を要求し、未監査のメンバーを拒否する。

この変換はインストール済みプリセットを検査せず、`code` の他の出現を書き換えない。リリース済み V0/V1 データは、凍結された先行エッジが V2 に到達した後にのみこれを受ける。ネイティブ V3 のカスタムプリセット id は改名されず、`settings.yaml` はこのパッケージの外である。

<a id="system-head"></a>
### システムヘッドとメッセージ ID

最初の `step/start` の直後に空の `system/message` append が続く。ステップがリクエストなしで中断しても同じである。以降のステップは別のヘッドを作らない。ステップもサーフェスもないログはヘッドも捏造されたリクエストも受けない。

すべての `request/header` で、`data.header.system` が存在しないことは空のプロンプトを意味し、それ以外の場合はその文字列が現在のプロンプトと正確に比較される。変更がある場合はそのリクエストヘッダーの直前にシステムメッセージを挿入し、現在の保護ヘッドを正確に置き換え、`sourceEventSeqs` でそれを引用する。変更のないプロンプトは何も挿入しない。空文字列と存在しないフィールドは以前のプロンプトをクリアする。空白のみの文字列は空でないテキストのままである。すべてのリクエストヘッダーは、置換が必要だったかどうかに関係なく `data.header.system` を失う。

合成メッセージは、開いているステップの `turn` と `step`、アンカーイベントの `time`、ロール `system`、ソース `{ kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt' }` を運ぶ。空のプロンプトは `content: []` を使い、それ以外のプロンプトは正確な文字列を含む 1 つのテキストブロックを使う。最初の append はソースイベント参照を持たない。各置換は両方の端点に前のヘッドのターゲットシーケンスを、その唯一のソース参照に前のヘッドを使う。空のヘッドは保護を保つが、モデルメッセージを生成しない。

各合成 id は `v2-to-v3-system-` の後に `JSON.stringify(['session-format-v2-to-v3', sourceHeader.id, anchor.seq, anchor.type])` の 16 進 SHA-256 が続く。アンカーは、初回作成ではソースの `step/start`、置換では変更された `request/header` である。生成されたメッセージ id やソースメッセージ id との衝突は、遭遇順に関係なく拒否される。inbox 挿入やタイトルリクエストメッセージ内の id も含む。既存のメッセージ id は決して変わらない。特に `TOOL_NOT_STARTED` 修復 id は、その正規の歴史的サフィックス `interrupted-tool-result-<callId>-<integer>` を保つ。そのサフィックスはターゲットシーケンス座標ではない。

<a id="sequence-references"></a>
### シーケンス参照と継承

ソースイベントはゼロから稠密でなければならない。各元イベントは、前にある挿入の後にターゲット位置を受ける。[参照マッパー](src/references.ts)はこれらの同一アーティファクト参照のみを変更する。参照される各ソース位置は、確立されたマッピングを持つより早いイベントを名指さなければならない:

| 所有者 | 再マップされるフィールド |
|---|---|
| サーフェスエンベロープ | `sourceEventSeqs[]`、正規リネーム前の `surfaceOp.start/end` |
| `command/done.data` | 存在する場合の `sourceEventSeq` |
| `compaction/summary.data` と `compaction/prune.data` | `shadowedRange.start/end` と `shadowedSeqs[]` |
| `session/title.data` と `session/title-llm-request.data` | `messageSeqs[]` |

再帰的な数値フィールドの書き換えはない。デリバリーの `throughSeq` と `sessionFormatVersion`、セッション参照の `capturedThroughSeq` と `capturedFormatVersion`、ワークフローローカルの `seq`、ストリームブロックインデックス、turn/step 番号、inbox インデックス、トークン/バイト数、およびすべての id はソース値を保つ。埋め込みアシスタントストリーム、モデルリプレイ状態、ツール引数/結果、タイトルリクエスト入力テキストと `data.system` は記録された意味を保つ。コンパクションペイロードの端点は `start/end` という名前を保つ。リネームされるのはエンベロープ置換の端点のみである。

シード済み Session では、`data.inherited: true` を持つ最後の `session/end-seed` がソースカットを特定する。そのソースシーケンスは、そのマーカーを除く継承イベント数である。そのマップされたターゲットシーケンスがターゲットカットである。その前の合成イベントは継承され、後のものはローカルである。タグのないマーカーはカットを確立しない。供給された `sourceInheritedEventCount` は一致しなければならない。マーカーのないシード済みログとマーカーのある未シードログは拒否される。未シードのステージは `headerInheritedEventCount: 0` を公開する。シード済みのステージは `finish()` が正確なカットを導出するまでそれを不明のままにする。これは、前段がイベント数を変えて EOF 前にカットを供給できない V0/V1 チェーンも支える。

<a id="ptc-vocabulary"></a>
### PTC 語彙

正確なイベントタグ `tool/code-dispatch-start` と `tool/code-dispatch` は `tool/ptc-dispatch-start` と `tool/ptc-dispatch` になる。そのペイロードは値を保つ。プラグイン帰属は、次の 3 つのスロットで `source.kind === 'plugin'` のときにのみ、正確に `tools-code-mode` から `tools-ptc` に変わる:

- `user/message.data.source.plugin`
- `agent/inbox/spliced.data.inserted[].source.plugin`
- `session/title-llm-request.data.messages[].source.plugin`

類似のプラグイン名、他のソース kind、任意のテキスト、ネストされた JSON、および `:code:` を含む歴史的 id は変わらない。これは `run_code` やその `code` 引数を改名しない。予約された V3 PTC タグのいずれかをすでに使っている V2 ソースイベントは、ignorable であっても拒否される。不透明なソース拡張がマイグレーションを通じて現在のライフサイクルの意味を獲得してはならない。

<a id="canonical-envelopes"></a>
### 正規エンベロープとツールエラー

構造挿入と参照再マップの後、正規化は元および合成イベント上で、正確なエンベロープ置換 `{ op: 'replace', start, end }` を `{ op: 'replace', startSeq, endSeq }` に変換する。`request/header.data.header` から正確に `tools: []` と `adapterDefaults: {}` を省略する。この最終操作は入力のイベント数、座標、タイムスタンプ、順序、継承カットを保持する。二重に再マップすることも、`config.stop: []` のような無関係な空値を正規化することもない。

4 つすべての V3 サーフェスタイプ（`system/message`、`user/message`、`assistant/message`、`tool/result`）は `surfaceOp` を要求する。アシスタントメッセージだけが `sourceEventSeqs` を禁じる。他のタイプでは、供給されるリストは空でなく、一意で、より早いイベントのみを参照しなければならない。既知のログ専用イベントはサーフェスメタデータフィールドをどちらも許さない。置換はエイリアスも余分なキーも許さない。その端点は、数値シーケンス順ではなく現在のサーフェス順における両端を含むスパンを特定する。復元は実在のメンバーシップ、端点の順序、完全なソースイベント網羅を確認する。

ソースのサーフェスイベントはすでに配置を要求する。マイグレーションは欠落した append マーカーを捏造しない。`data.error` を持つ `tool/result` は、その単一の tool-result ブロックが `isError: true` を運ぶことを要求する。失敗した結果は構造化エラー識別を省略してよい。矛盾する結果は拒否され、`isError` の追加や診断の削除によって修復されることは決してない。通常のツールと PTC のライフサイクル関係は、これらのイベントローカルなチェックの後にも検証を要する。

<a id="delivery-guards"></a>
### デリバリーガード

`data.sessionFormatVersion === 3` を持つ V2 の `session-log-deepseek/delivery-accepted` は拒否され、V3 のアップロードウォーターマークへ昇格されない。他の世代のマーカーはペイロードを保つ。存在しない世代や将来の非ターゲット世代も含む。V2 世代のマーカーは、有効なより早い `throughSeq` を持たなければならない。異なる Session を名指す場合、`parentSession` を持つ Session の継承プレフィックス内でのみ許される。外来のローカルマーカーまたは親メタデータのないものは拒否される。マーカーのエンベロープシーケンスは通常どおり変わり、キャプチャされた受け入れ座標は変わらない。

<a id="source-audit"></a>
### ソース監査と拒否

マイグレーションは[リリース済み V2 イベント目録](../session-format-v1-to-v2/src/dispositions.ts)（ログ専用の `assistant/attempt` を含む）に加えて `feedback/message-put` と `feedback/message-delete` を分類する。[ペイロード検証器](src/payload.ts)は、正確に受け入れられたエンベロープとペイロードのメンバー、およびリリース済みのネスト検証を適用する。未知のイベントは ignorable なものでも、チェック対象レコードの未監査メンバーも拒否される。メッセージソースの分類は以下の 5 つの Message スロットを対象とする。未知のソース kind は拒否され、エージェントリレー帰属は id を Session 参照として解釈せずに受け入れられる。

コンテンツ監査は正確に `text`、`reasoning`、`image`、`file`、`tool-call`、`tool-result` を受け入れる。所有ブロックフィールドを検証し、次の有限の位置集合でネストされたすべての `tool-result.content` を再帰的に監査する:

| 所有者 | 監査されるコンテンツ |
|---|---|
| 5 つの Message スロット | `user/message.data.content`、`assistant/message.data.message.content`、`tool/result.data.message.content`、`agent/inbox/spliced.data.inserted[].content`、`session/title-llm-request.data.messages[].content` |
| キューされたチームメッセージ | `team/message/queued.data.message.content`。歴史的 Team ペイロードは `message.delivery` 付きの `version: 1` のままである |
| コンパクション出力 | `compaction/summary.data.summary` とオプションの `compaction/summary.data.rawOutput` |
| PTC 前身出力 | `tool/code-dispatch.data.content` |
| 埋め込みアシスタントストリーム | `assistant/message.data.stream[]` と `assistant/attempt.data.stream[]` 内の生の `type: 'chunk'` レコード: `block-end` には `chunk.block`、`block-start` には `chunk.blockType`（完了したブロックのない start を含む） |

すべての位置が同じ歴史的 kind 集合を使う。部分的な start は未知の kind を導入できない。未知の kind と不正な所有ブロックはマイグレーション全体を拒否し、カタログ復元は `SessionFormatUnsupportedMigrationError` を報告する。診断はソースイベントタイプ、ソースシーケンス、完全なインデックス付きペイロードパス、違反したルールを特定する。未知 kind のエラーは問題の kind を名指す。不正な既知ブロックのエラーは kind とフィールドエラーを名指す。不正なコンテンツコンテナーや欠落ブロックは kind を捏造せずにその位置を報告する。永続化はソースバイトを変えず、拒否時に後継を公開しない。

受け入れはコンテンツを書き換えない。特に、埋め込みストリームのバイトは、所有ブロックフィールドが検査されても保持される。ツール引数、`replayState.response`、`replayState.blocks` は不透明のままである。任意の JSON 内の一致するフィールド名はこの監査を引き起こさない。ファイル添付メタデータは、id やバイト数を Session 参照として解釈せずに検証される。これは一般的なスキーマ監査や再帰的な座標推論ではなく、ネイティブ V3 の拡張受け入れは別である。

最初のステップより前のサーフェスイベント、開いているステップの外でのプロンプト変更、または生成 id の衝突は、イベントを移動したり所有権を捏造したりせずに `SessionFormatUnsupportedMigrationError` を発生させる。不正なソースフィールド、欠落した配置、無効な参照、矛盾するカット、デリバリー違反、矛盾するツール結果は、直接ステージまたはターゲット検証器でフォーマットエラーを発生させる。カタログはマイグレーションステージと変換済みターゲットの検証失敗を型付きの unsupported migration として報告する。物理デコードの失敗は、選択された回復ポリシーの下での corruption のままである。このエッジによるソースまたはターゲットの修復、世代フォールバック、ファイル書き換えは行われない。

-----

<a id="native-v3-admission"></a>
## ネイティブ V3 受け入れ

すでに V3 とマークされた入力は V2→V3 を実行しない。`validation: 'transformed'` のネイティブカタログ読み取りはコーデックチェックのみを適用し、アーティファクト復元をスキップする。完全な関係、開いているステップの所有権、保護ヘッド操作、語彙チェックには `restoreReleasedV3Artifact` またはカタログの `validation: 'current'` が必要である。以下のルールはそれらの復元チェックをコーデック受け入れと区別するものであり、追加の歴史的変換ではない:

- ネイティブ V3 は履歴内のシステム append、非ヘッドのシステム置換、非ヘッドのシステムノードのコンパクションを受け入れる。システムメッセージは有効なペイロードと一致する開いているステップの所有権を要求する。最初のサーフェスシステムヘッドは、正確にそのヘッドを覆うシステムメッセージによってのみ置換できる。通常の置換とコンパクションはそれを消費できない。マイグレーション自体は初期ヘッドとヘッド置換のみを生成し、ルート依存の履歴内更新は生成しない。
- ネイティブ V3 はすべての `request/header.data.header.system` を、空または不正であっても拒否し、非正規の置換表記と 2 つの空のヘッダーオプションを拒否する。空白コンテンツ、空の stop リスト、受け入れられたネストされた header/source/data 拡張は保持する。その拡張受け入れは V2 ソース監査や正確な論理 Session ヘッダーフィールドを広げない。
- 必要な前身 PTC タグは、インストールされていても拒否される。廃止または未知の ignorable イベントは、その論理メタデータを含めて不透明のまま残り、現在の PTC 関係を満たせない。インストールされた通常のイベント追加はログ専用エンベロープとして受け入れられる。未知の required タイプは語彙認識の復元によって拒否される。物理コーデックは依然としてリリース済みのフレーミングとソースイベント範囲エンコーディングを強制する。
- V3 のイベントローカルなチェックはエンコード前とデコード後に実行される。生の retired-system-header、不正な system-payload、必要な前身 PTC の拒否は、破損行の後を含め、回復可能な抑制の前に実行される。厳格な読み取りは正規のエラーを直ちに拒否する。回復可能な正規デコードは最初の無効イベントとそのサフィックスを保留する。後の `turn/end` がコミットを確立し、そのサフィックスを拒否する。カウントされるのは受け入れられた継承マーカーのみである。それのないシード済みの受け入れ済みプレフィックスは拒否される。未分類のイベントメタデータは、正規の corruption として破棄されるのではなく語彙認識の復元へ持ち越されるため、未知の required タイプを隠せない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

[ステージ](src/migration.ts)はアーティファクトごとの同期的なシーケンスマップ、メッセージ ID 集合、プロンプト/ライフサイクル状態を所有する。コンパクトな実行は増分的に展開する。[コーデック](src/codec.ts)は凍結された V2 フレーミングを再利用する。[復元器](src/validation.ts)は V3 構造を検証してから、凍結された通常の関係検証にプライベートな system/PTC/repair-id と端点のビューを与える。そのビューはデリバリーチェックのために実際のターゲット世代を保ち、決して外へ漏れない。復元は元の V3 アーティファクトと ID を返す。凍結された V0→V1 と V1→V2 の意味は変わらない。

[結合カタログテスト](tests/combined-migration.spec.ts)は変換の合成とネイティブ再オープンを実行する。[マイグレーションテスト](tests/migration.spec.ts)と[正規テスト](tests/canonical-envelopes.spec.ts)が保持と拒否を固定する。[永続化統合](../session-persistence-jsonl/tests/v2-ptc-migration.spec.ts)が公開の証拠を所有する。[リリース済みフォーマットの決定](../../../.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.md)が、隣接する構成をネイティブ受け入れと別にテストする根拠を所有する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [リリース済み V1→V2](../session-format-v1-to-v2/README.md) — 凍結された先行変換とソースコーデック。
- [システムプロンプトサーフェスの決定](../../../.agents/notes/implemented/architecture/2026-09-02-system-prompt-as-surface-node.md) — プロンプト所有権と保護ヘッドの根拠。
- [正規 V3 エンベロープの決定](../../../.agents/notes/implemented/architecture/2026-09-06-v3-canonical-session-envelopes.md) — 厳格な受け入れと検証の所有権。

-----

<a id="model-experience"></a>
## モデル体験

### 履歴の復元

#### モデルが見るもの

各歴史的リクエストはそのプロンプトテキストと通常のメッセージコンテンツを保つ。空のシステムヘッドはモデルメッセージを生成しない。PTC 帰属は `tools-ptc` を使う。ディスパッチイベントはログ専用のままである。

#### トークンへの影響

このエッジはモデルに見えるテキストを追加しない。記録されたプロンプトをリクエストヘッダーからメッセージ履歴へ移す。

#### KV キャッシュへの影響

このエッジは歴史的リクエストの意味とモデル設定を保持する。プロバイダーのキャッシュヒットやバイト単位で同一のネイティブ V3 記録を保証しない。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>

- **歴史的プリセットの曖昧さ** — リリース済みの `code` 参照は、レガシー組み込み id を持つカスタムプリセットを区別できない。[正確なリネーム](#header-and-presets)はホスト非依存である。
- **ファイルや設定のマイグレーションはない** — このパッケージはコミット済み世代や `settings.yaml` を決して変更しない。最終後継の公開は永続化が所有する。既存の V3 世代はその入ってくるエッジを再実行しない。[フォーマットリリース状況](../../../docs/session-format-status.md)と[リリース済みフォーマットポリシー](../../../.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.md)の互換性義務を参照。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
