---
description: "Host ctx.schedule サービス上のプリセットスコープリマインダー管理ツール (schedule_create、schedule_list、schedule_update、schedule_delete)。どのエージェントが耐久リマインダーを保持できるか選ぶデプロイ向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-schedule

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-tool-schedule` を使い、エージェントが `schedule_create`、`schedule_list`、`schedule_update`、`schedule_delete` で耐久 Host リマインダーを作成・列挙・編集・削除できるようにする。パッケージはそれをマウントするプリセットまたは Agent スコープに 4 ツールを登録するため、どのエージェントが受け取るかは合成が決める。`minimal` は保持しない。各呼び出しは呼び出し Agent の Session に作用し、格納済みリマインダーのみ管理する — 記憶域・スケジューリング・配送は Host `@deepseek-ai/dsh-schedule` サービスが所有する。失敗は記憶域詳細ではなく 1 つの構造化エラーコードを返す。

## 目次

- [このパッケージの使い方](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの使い方

そのプリセットのエージェントが耐久リマインダーを管理すべき場合、プリセットのプラグイン一覧に下の行を追加する。出荷 Web `standard`、`cordis`、`ptc` プリセットはマウントし、`minimal` はしない。

### いつ選ぶか

自身 Session で将来作業を予定すべきプリセットのエージェントには選ぶ。同じプロセスに `@deepseek-ai/dsh-schedule` をロードする。このパッケージはそのサービスのモデルに面したコンシューマーにすぎない。ケイパビリティ貧弱のままにすべきプリセット — 出荷例は `minimal` — は行を省き、そのエージェントはリマインダーツールをまったく見ない。

### 4 つのツール

- `schedule_create(prompt, title, <one selector>)` — リマインダー 1 件を作成する。非空 prompt、最大 120 文字の title、`after_seconds`、`at`、`every_seconds`、`daily`、`weekly`、`cron` のちょうど 1 つを提供する。正準リマインダービューを返す。
- `schedule_list()` — 呼び出し Session の全有効リマインダーをその id・タイトル・UTC 目標・状態・配送モード付きで列挙する。
- `schedule_update(id, <title|prompt|one selector>)` — 名前・指示・タイミングをその場で置換する、またはそれらの組み合わせ。未知または終了済みリマインダーは理由コード付き `updated: false` を返す。`after_seconds` は作成専用である。
- `schedule_delete(id)` — 保持リマインダー 1 件を除去する。有効・終了済みを問わない。未知または削除済み id は `deleted: false` を返す。

### 最小構成

```yaml
- name: '@deepseek-ai/dsh-tool-schedule'
```

パッケージは `Config` フィールドを宣言しない。`ctx.tools` を注入し、スコープが Host `ctx.schedule` サービスを解決したら 4 ツールを登録するため、そのサービスを切った合成はリマインダーツールをマウントしない。各呼び出しはそれをディスパッチした Agent の Session に作用する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

プラグインはそれをロードするコンテキスト経由で 4 つの `defineTool` 定義を登録するため、プリセットマウントが可視性と Cordis effect 所有権を決め、マウントと共に破棄される。実行は Session 束縛に `exec.agent` を、記憶域に注入 `ctx.schedule` サービスを読む。委任深度ガードはセレクターと識別子検査より先に動き、すべてサービス呼び出しより前であり、サービスが上げる失敗のうち `ScheduleInputError` でないものは `internal_error` に畳まれるため、記憶域詳細は決してモデルに届かない。モデル内容は返値の正準 JSON であり、Host サービスが永続化・スケジューリング・Session 復元・配送を所有する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグイン入口。4 登録、セレクター検証、描画/表示ヘルパー |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [Schedule サービス](../schedule/README.md) — これらツールが管理する Host タスク蓄積・ランタイム・配送動作。
- [Schedule グループマップ](../README.md) — このグループの兄弟パッケージ。
- [生成されるツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-schedule) — モデルが受け取る正確な 4 スキーマ。
- [Schedule サブシステム](../../../docs/subsystems/schedule.md) — `ctx.schedule` Cordis 面と格納型。
- [Schedule ユーザーガイド](../../../docs/user/guide/schedule.md) — ユーザーに面したリマインダーワークフロー。

-----

<a id="model-experience"></a>
## モデル体験

### ツールスキーマ

#### モデルが見るもの

呼び出し Agent のスコープでこのパッケージが見える場合の、生成される [`schedule_create`、`schedule_list`、`schedule_update`、`schedule_delete` スキーマ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-schedule)。タイトル案内は格納タイトルを書き換えず、既存の非空・長さ検査を超える検証を追加しない。

#### トークンへの影響

パッケージをマウントするプリセットの Agent からの全リクエストに固定スキーマコストがかかる。行を省くプリセット配下のエージェントは支払わない。

#### KV キャッシュへの影響

ツール定義と可視性不変の間は接頭辞安定である。マウント・破棄・スコープ変更は最初の変更スキーマトークンから再利用を無効化しうる。

### リマインダー結果

#### モデルが見るもの

呼び出しごとに 1 つの非損失 JSON テキストブロック。`schedule_create` にはリマインダービュー、`schedule_list` にはビュー配列、`schedule_delete` には `{ id, deleted }`、`schedule_update` にはリマインダービューまたは `{ id, updated: false, code }`。拒否呼び出しは公開エラーコード 1 件を運ぶ `{ code, message }` を返す。

#### トークンへの影響

結果は圧縮まで呼び出し Session の履歴に残り、格納リマインダーフィールドを繰り返す。長いリマインダー一覧は後の全リクエストでその完全描画長を費やす。

#### KV キャッシュへの影響

追記のみ。新規可視内容は再利用可能なリクエスト接頭辞の後に続き、既存 KV キャッシュエントリを無効化しない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **Host サービスなしではツールなし** — `ctx.schedule` なしでこのパッケージをマウントする合成はプラグインを待ちのままにし、4 ツールはどれも登録されない。
- **すべての呼び出しは呼び出し Agent を要する** — なしでディスパッチされた呼び出しは Session 推測ではなく `internal_error` を返す。
- **削除はキュー済みメッセージを引っ込めない** — Host が既に配送したリマインダーは `schedule_delete` 後も Session inbox に残る。
- **リマインダータイミングは Host に属する** — ツールは目標時刻補正・時刻源・配送再試行を公開しない。それらの制限はサービスのものである。
- **すべてのツールは委任呼び出し元を拒否する** — `schedule_create`、`schedule_list`、`schedule_update`、`schedule_delete` の各々はディスパッチ前に呼び出し Agent の委任深度を読み、ゼロ超過で `{ code: 'subagent_session', message: 'A delegated subagent cannot use reminders.' }` を返す。ガードはこのパッケージにあり、委任上限が強制するのと同じ計算 `delegationDepthOf` を `@deepseek-ai/dsh-subagent` から読むため、ツールをマウントする任意プリセットで保たれる。
- **委任子が所有する Session はリマインダーを仕掛けられない** — Session の Agent 委任深度がゼロ超過の場合、`ScheduleService.create` はコード `subagent_session` の `ScheduleInputError` を投げ、`ScheduleService.update` は非変更 `subagent_session` 結果を返す。委任深度は委任上限自体が読む計算であり、永続セッションヘッダーがコールド再開をまたいで運ぶ。規則はこれらツールではなくサービスにあり、他のインプロセス消費者にも届く。Automation 面を含む。`schedule_list` と `schedule_delete` はその Session に引き続き仕えるため、この規則以前に格納されたリマインダーは除去可能なままである。

<a id="dev-note"></a>
### Dev Note

<details>
<summary>メンテナ向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
