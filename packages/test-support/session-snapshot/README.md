---
description: "キーなしプロファイルテストのためのセッションログスナップショットサポート: マニフェスト、ID リダクション、正規化、ワークスペースチェック、プロトコルアダプター。"
kind: "package-library"
---

# @deepseek-ai/dsh-session-snapshot

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-session-snapshot` は、キーなしの記録済みセッションテスト（`pnpm run test:snapshot`）を支える共有サポートを提供する。閉じたマニフェスト、型付き ID リダクション、正規化、ワークスペース比較、フィクスチャガード、および headless、SDK（`sdk` と `sdk-minimal`）、ACP、Web の各オーナー向けのプロトコルアダプターである。ACP アダプターは、テスト対象のプロファイルを実際のサブプロセスとして起動し、決定論的な入力スクリプトを駆動し、記録・再生・更新の完全なスイートを登録する。各シナリオは、エージェントの報告を信用せずにモデル可視の出力とファイルシステムへの影響を証明するのに十分なコミット済みの証拠を所有する。パッケージエントリーは vitest をインポートするため、vitest 実行内でのみ利用できる。

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

このパッケージは、出荷済みプロファイルのシナリオをキーなしスナップショットスイートに変える。シナリオテーブルとフィクスチャディレクトリを書き、対応するアダプターを 1 回呼ぶと、あとはキットがプロファイルの起動または構成、シナリオの駆動、正規化出力の比較、コミット済みフィクスチャのガードを所有する。

### スナップショットスイートを書く

利用側の `*.snapshot.ts` は、シナリオテーブルと 1 回のファクトリー呼び出しである。サブプロセスの cwd がリポジトリの外に位置するため、`AgentUnderTest` は絶対の `binScript`、オプションの `libBinScript`、`configPath`、`tsconfigPath` パスを供給する:

```ts
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  defineAcpSnapshotSuite,
  type Scenario,
  type SnapshotSuiteOptions,
} from '@deepseek-ai/dsh-session-snapshot'

function snapshotMode(value: string | undefined): SnapshotSuiteOptions['mode'] {
  switch (value) {
    case undefined:
    case '':
    case 'replay': return 'replay'
    case 'record': return 'record'
    case 'refresh': return 'refresh'
    default: throw new Error(`unknown DSH_SNAPSHOT mode: ${value}`)
  }
}

const SCENARIOS: Scenario[] = [
  { name: 'text-turn', hasModelTurn: true, recorded: true, pinsHeader: true },
]

defineAcpSnapshotSuite({
  agent: { // absolute paths, resolved from the suite's own location
    binScript: fileURLToPath(new URL('../../../apps/cli/src/bin.ts', import.meta.url)),
    configPath: fileURLToPath(new URL('../cordis.yml', import.meta.url)),
    profile: 'acp',
    tsconfigPath: fileURLToPath(new URL('../../../tsconfig.json', import.meta.url)),
  },
  snapshotsDir: join(dirname(fileURLToPath(import.meta.url)), 'snapshots'),
  scenarios: SCENARIOS, // exactly one entry per header class sets pinsHeader
  mode: snapshotMode(process.env.DSH_SNAPSHOT),
})
```

各記録済みセッションディレクトリは、閉じた `snapshot.yml` マニフェストと、正規の親ロールおよび連続する子ロールを保持する。親のファイル名は `session[.vN].jsonl`、子は `session.<ordinal>[.vN].jsonl` である。v0 は `.v0` を省略し、正のバージョンは小文字の `.vN` を使い、すべてのファイル名はそのヘッダーと一致する。ロールは古い世代を保持してよいが、ハーネスは数値上最大のものを選択する。所有マニフェストは `sessionFormat.version` と 1 つ以上の閉じた `coverage` 名を宣言して、その歴史的世代を明示的な移行フィクスチャとして保持できる。その宣言がない場合、record と refresh は現在の世代を書き込み、replay は[コーパスポリシー](../../../snapshots/AGENTS.md)の下で、親/子ロールごとに保持された V3 ベースラインまたは現在の世代を独立に受け入れる。明示的な `sessionFormat.version` は、選択されたすべてのロールがそのバージョンに一致することを要求する。マニフェストはまた、シナリオ、出荷済みプロファイル、構成/ヘッダークラス、記録ソース、および完了したセッションが再構築できない replay、プラットフォーム、許可、環境、ワークスペース、または入力の事実のみを名指す。ストレージガードは、選択されたすべての親ロールと子ロールのツール結果とポータブルパスを検査する。プロンプト/スキーマのスクラブ、メッセージ ID、リクエスト前のプロンプト順序は現在の世代に適用され、保持された先行世代はその歴史的表現を保つ。アダプターは expected-output、セッションログ、およびオプションの `workspace.expected/` 比較を登録する。ガードは孤立ディレクトリ、欠落ロール、非正規名、絶対パス、不正なマニフェスト、プラットフォーム固有のセパレーターを拒否する。

`normalizeSessionSnapshot` は完全なセッションヘッダーとイベントペイロードを保持するが、パスを正規化しシステムプロンプトテキストとツールスキーマをスクラブした後、コミット済みフィクスチャからトップレベルの `seq`/`time` エンベロープを省略する。また、埋め込みストリームクロックと歴史的な packed 行の `seq0`/`time0` エンベロープ、およびカタログの子作成クロックを正規化する。イベント順序とソースイベント参照順序は保持される。record と refresh はトップレベルの `sourceEventSeqs` を展開された配列として書き込む。replay はトップレベルのエンベロープをメモリ内で合成し、ランタイム永続化は引き続き完全なログを書き込む。マルチセッション比較は、ID リダクションと正規化の前に、ビルド時に静的に提供される厳密なセッション形式カタログを通じて期待ログと収穫ログを検証する。ソースのファイル名が形式検証を変えることはできない。保持された歴史的 replay 入力は、ネイティブの現行形式ライター出力のオラクルではない。構造的移行はリクエストの意味を保つが、異なるイベントレイアウトを生みうる。正規化は `system` を含む予期しないリクエストヘッダーフィールドを保持し、リグレッションが可視のまま残る。バージョンのないプロトコルアダプター単体フィクスチャは、リリースされたセッション形式コーパスの外に留まる。[現在のライター形式](../../../docs/session-format-status.md)のフィクスチャはイベントごとに 1 行を使い、保持された v0/v1 フィクスチャは正規の packed 行を使ってよい。[一時的なリポジトリ移行ツール](../../../scripts/migrate-packed-session-fixtures.ts)（`pnpm run migrate:packed-session-fixtures`）は古い歴史的レイアウトを書き換え、その[削除提案](../../../.agents/notes/proposed/process/2026-07-26-remove-packed-session-fixture-migrator.md)がその削除を所有する。

スピルシナリオは、プライベートな一時ルートの下で実際のローカルプロバイダーを通じて保存する。それらのフィクスチャアダプターは固定長の論理ロケーターを公開し、この実行で保存されたロケーターだけを実ファイルへマップして取得させる。これにより、共有の論理パスへ書き込むことなくプレビュー予算を保つ。既知のスナップショットスピルパスは安定したロケータートークンへ正規化される。JSON 省略通知の中に引用され、Windows セパレーターが JSON エスケープされたパスも含む。refresh の抽出は、リテラル置換のために一致したシリアライズ済みパスの綴りを保持する。正規化が変えるのはロケーターのみである。保存されたバイト長と省略件数は比較の証拠として残る。

保持された歴史的シナリオは、正規のセッションファイルを変更せず replay 用に選択したまま保ち、固定ディレクトリ内に新しい正規の兄弟を持たない。それらの正確な正規化済みネイティブライター出力は、親では `writer.expected.jsonl`、子では `writer.<ordinal>.expected.jsonl` に別途記録される。これらは出力オラクルであり、replay 世代ではない。出力オラクルは古いサポート対象世代を保持してよい。比較は厳密なカタログを通じてそれらを復元し、収穫ログはチェックアウトのライターを使わなければならない。新ライターのゴールデン比較は `nativeWriterOutput` を選択して、厳密な復元後に各入力の元のライター世代で修飾された配送マーカーのみをトークン化する。他の配送世代とキャプチャ済みソースフィールドは数値のまま残る。ソース対移行済みアーティファクトの比較は、既定で正確な世代を保持する。記録と refresh はこれらの比較トークンを保存しない。保持された SDK シナリオは現在のプロトコル出力に `notifications.current.expected.jsonl` を使う。比較は現在のイベントを歴史的形式へ投影し戻すことも、構造的差異を取り除くこともない。独立した移行テストは、ネイティブライターのレイアウトを期待イベントシーケンスとして扱うのではなく、公式の変換を検証する。

Headless/ACP と SDK のアダプターは、正規化の前に、生のカタログ子作成時刻と収穫された子ヘッダーを比較する。refresh は、継承されたコピーを含む一致するすべてのカタログエントリーで選択された子ヘッダー時刻を保持するので、保持されたヘッダークロックが新しく書き込まれたカタログクロックから乖離することはない。コミット済みの歴史的不整合は、変更されない移行拒否の証拠として残る。そのクロックを正規化しても、移行の成功は確立されない。

### 記録、再生、更新

`pnpm run test:snapshot:record` はライブ LLM を呼び出し、収穫した現在の世代をその正規のバージョン付きファイル名で書き込む。記録と refresh は完了した世代を決して改名も削除もしない。後の実行に存在しない子ロールの世代も含む。レビュー済みのソースツリー整理は、同じロールに検証済みの現在の代替ができた後にのみ先行世代を削除する。明示的な `sessionFormat` を持つシナリオは record モードでも読み取り専用のままである。`pnpm run test:snapshot:refresh` はキーなしのままで、選択された最大の replay 入力を実行し、stdout、所有するプロンプトとツールスキーマのサイドカー、および新鮮な現行世代の比較可能なセッション出力を書き込む。保持された歴史的シナリオは、正規の現行形式 replay 世代ではなく、別個のライター出力オラクルを書き込む。Headless と SDK のシナリオは、実行フィクスチャ用にローカルの `runtime.cordis.yml` パッチを追加してよい。各構成オーナーは replay パッチをライブパッチの隣に保つ。トップレベルの `snapshots/` はセッション駆動のシナリオを所有し、他の期待出力は所有パッケージの隣に留まる。[`dsh-llm-replay`](../llm-replay/README.md) は `DSH_SNAPSHOT_*` 環境値で選択された記録済みストリームを提供する。

### リクエストヘッダーとシステムプロンプトの固定

ピンは既定で自身の生成する `system-prompt.expected.md` または `tool-schemas.expected.json` サイドカーを所有する。`systemPromptSource` と `toolSchemasSource` は、対応する完全なシーケンスが同一である場合に別のピンを名指すので、異なる各バージョンは 1 回だけコミットされる。システムプロンプトはサーフェスノード 0 であり、そのステップの最初の `request/header` より前に `system/message` イベントとしてログ記録される。すべてのフィクスチャはそのテキストブロックを `"text":"{{system}}"` として保存し、プロンプトサイドカーが完全なテキストを保持する。ピンの `request/header` イベントは config と reason を保持しつつ `"tools":"{{tools}}"` を保存し、構造化スキーマサイドカーが完全なカタログを保持する。開発者メッセージを含むログは、歴史的な追加参照が検証可能なまま残るよう、各ヘッダーでトークンではなく順序付きのツール名を保持する。自身のスコープが異なるリクエストを構成する子セッションは、フィクスチャインデックスごとに `pinsChildToolSchemas` と `pinsChildSystemPrompts` でそれを宣言する。実行中にリクエストヘッダーを変更するシナリオは `expectedHeaderChanges` を宣言する。実行中にプロンプトが変わるシナリオ（ノード 0 の置き換え、または `in-history` ルートでキャッシュ済み履歴の後への追記）は `expectedPromptChanges` を宣言し、各変更はプロンプトサイドカーに `<!-- system/message change N -->` セクションを追加する。マニフェストはこれらを `header.changes` と `header.promptChanges` と綴る。

### プラットフォームと構成のバリアント

非 Windows ホストを必要とするシナリオは `posixOnly` を宣言する。これは Windows での実行テストをスキップし、フィクスチャガードはどこでもコミット済みファイルをカバーし続ける。構成に使用可能な `pwsh` を必要とするシナリオは `pwshOnly` を宣言する。一時ディレクトリのグラント自体がテスト対象である場合、`workspaceParent` は生成される子 cwd をプラットフォームの一時ディレクトリの外へ移動する。シナリオのコミット済み `workspace/` はまずその子へコピーされ、次にエージェントの開始前に `prepareWorkspace` が生成された cwd に対して実行される。既定の生成ワークスペースはセッションフィクスチャに `{{cwd}}` として保存されるので、プラットフォームの一時ルートやランダムなベース名が記録に影響しない。セッションのワークスペースグラント自体がテスト対象の場合、Headless マニフェストは `workspace.parent: outside-temp` を使う。アダプターは、親が書き込み可能でシステムの一時グラントの外にある場合はプラットフォーム一時ルートの隣に、そうでなければホームの下に割り当て、自動一時書き込みグラントで既にカバーされている生成 cwd を拒否する。

### 何がうまくいかなくなりうるか

- **永続的な待機がタイムアウトする** — `waitForTurnStart`、`waitForTurnEnd`、`waitForSubagentTurnEnd`、`waitForGoalPhase`、`waitForInboxMessage`、`waitForTitleAfterTurnEnd`、`waitForEventAfterTurnEnd` は、最初のログ収穫がそのデッドラインを超える場合でも、セッションまたは子とデッドラインを識別する。子の待機は要求されたターンも名指す。すべてが根本の失敗をエラー原因として保持する。`waitForTurnStart` は不正なターンレコードを即座に拒否する。
- **フィクスチャガードがコミット済みファイルを拒否する** — 孤立したシナリオディレクトリ、欠落ファイル、1 つのヘッダークラスに対する複数のピン、重複したサイドカー内容、スクラブされていないプロンプトテキストまたはツールスキーマ、先行する `system/message` のない `request/header`、不正なピンヘッダーは、すべて比較の実行前にスイートを失敗させる。
- **セッション収穫には生の JSONL モードが必要** — スナップショット設定は JSONL バックエンドの `compression: 'none'` を設定する。圧縮された JSONL にはスナップショット収穫パスがない。
- **ビルドモードには現在のアーティファクトが必要** — `DSH_EXAMPLE_MODE=lib` を選択する前に `pnpm run build` を実行する。ソースモードは引き続きビルド不要のパスである。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

この節はキットの設計を説明する。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱っている。

### 設計

共有コアは、マニフェスト、世代で修飾されたロール選択、ワークスペースのセットアップ/比較、型付き ID マッピング、正規化器、フィクスチャ不変条件を所有する。ACP アダプターは 4 つの合成可能な層を追加する。ランチャー、シナリオハーネス、正規化器、スイートファクトリーである。`launchAcpTestAgent` は、tsx の下でソースプロファイルを、またはプレーン Node の下でビルド済み `lib` プロファイルを起動し、生バイトの stdout tee 上で SDK クライアントを接続し、セッション更新と stderr を収集し、未処理の許可リクエストでフェイルクローズドし、シャットダウンを所有する。`runScenario` は ACP JSON-RPC stdio を駆動し、すべてのセッションディレクトリについて、永続化された生 JSONL の数値上最大の世代を収穫する。純粋な正規化器は cwd パスと型付き ID を安定したトークンへ置き換え、時刻をゼロにし、物理ソースイベント範囲を展開し、システムプロンプトテキストとツールスキーマの大部分をスクラブする。`defineAcpSnapshotSuite` は比較、世代修飾されたフィクスチャの書き戻し、ライブ均一性ガードを登録する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/launcher.ts`](src/launcher.ts) | サブプロセス/クライアントランチャーとシャットダウンの所有 |
| [`src/harness.ts`](src/harness.ts) | スクリプト化されたシナリオドライバーとセッションログ収穫 |
| [`src/manifest.ts`](src/manifest.ts) | 閉じた `snapshot.yml` スキーマ、収集、所有規則 |
| [`src/session-files.ts`](src/session-files.ts) | 正規の親/子世代文法、ヘッダー一致、最大ロール選択 |
| [`src/identity.ts`](src/identity.ts) | 親ログと子ログにまたがる型付き初回出現 ID のトークン化 |
| [`src/normalize.ts`](src/normalize.ts) | 純粋な正規化器とスクラブヘルパー |
| [`src/workspace.ts`](src/workspace.ts) | シナリオワークスペースのセットアップと完全な期待状態比較 |
| [`src/suite.ts`](src/suite.ts) | シナリオテーブルスイートファクトリー、フィクスチャガード、record/refresh の書き戻し |
| [`src/index.ts`](src/index.ts) | 4 つの層を再エクスポートするパッケージエントリー |

### データフロー

シナリオはランチャーの下でエージェントを実行し、ハーネスを通じて入力スクリプトを供給し、stdout と永続化されたログをキャプチャする。正規化器はそれらのキャプチャを正規化する。ID は初回出現シーケンスへ、生成された cwd は `{{cwd}}` へ、`system/message` テキストは `{{system}}` へ、ヘッダーのツールスキーマは `{{tools}}` へ。これにより記録済み実行と新鮮な実行が構造的に比較される。ファクトリーは次に、正規化された stdout と再永続化されたログをコミット済みフィクスチャと比較し、または record/refresh モードで書き戻す。そのガードは、比較結果が信頼される前に、不正またはドリフトしたフィクスチャを拒否する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときにこれらのページを読む。スナップショットキットからモデルフィクスチャソース、起動の仕組み、この層を要求するポリシーへ進む。

- [llm-replay](../llm-replay/README.md) — replay モードが消費するキーなしモデルフィクスチャソース。
- [loader-smoke](../loader-smoke/README.md) — ランチャーが基盤とするモード対応のサブプロセス起動の仕組み。
- [テストポリシー](../../../docs/testing.md) — キーなしスナップショット層、それが要求される場面、フィクスチャ所有の規則。
- [Test-support グループマップ](../README.md) — 兄弟ハーネスとサポートパッケージ。

-----

<a id="model-experience"></a>
## モデル体験

なし。このテスト専用サポートは、エージェントが組み立てるモデルリクエストを変えずに、プロファイルセッションを記録、正規化、比較する。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立ても送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、キットが特別な注意を要する場面を定義する。それらは現在のパッケージ制約であり、タスクバックログではない。

- **セッション収穫には生の JSONL モードが必要** — `runScenario` は永続化された `.jsonl` ログを収集するため、スナップショット設定は JSONL バックエンドの `compression: 'none'` を設定する。圧縮された JSONL にはスナップショット収穫パスがない。
- **ビルドモードには現在のアーティファクトが必要** — `DSH_EXAMPLE_MODE=lib` を選択する前に `pnpm run build` を実行する。ソースモードは引き続きビルド不要のパスである。
- **ACP はプロトコル動作のために残る** — 刺激が ACP クライアントであるキャンセルと許可の往復はそのアダプターに留まる。組み立て済みのワンショットおよび持続制御の動作は headless と SDK アダプターを使う。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
