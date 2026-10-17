---
description: "リリース済み v1 セッションの凍結リーダーと、Assistant ストリームをリリース済み v2 イベントに埋め込む濃度変化マイグレーション。"
kind: "package-reference"
---

# @deepseek-ai/dsh-session-format-v1-to-v2

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-session-format-v1-to-v2` はリリース済み v1 セッションを 1 つの状態付きイベント段階経由でリリース済み v2 イベントモデルへ変換する。最上位 `assistant/chunk` イベントを消費し、その正確な時刻付きストリームを対応 `assistant/message` に埋め込み、表面メッセージなしに決着に達した失敗・再試行・キャンセル・ストリームエラー試行を `assistant/attempt` として記録する。エッジは存続イベントと宣言済みすべての同セッション順序参照を密に再写像し、v2 コーデックは 1 行 1 イベントを格納してタグ付き `session/end-seed` 印から継承カットを導出する。

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

### 使う場合

永続化は `dsh-session-format-catalog` 経由でこのエッジを得る。機能構成はマウントしない。静的リリース済み形式カタログを組立・試験する場合や正確な v1-to-v2 変換を検査する場合にのみ直接 import する。

### 入口

```text
const decoder = releasedV1SessionFormatCodec.createDecoder(physicalHeader, 'strict')
for (const row of physicalRows) decoder.decodeRow(row, migrationContext)
const stage = sessionFormatV1ToV2.createStage(stageInput)
stage.transformEvent(event, migrationContext)
const targetInheritedEventCount = stage.finish(migrationContext)
const headerRecord = releasedV2SessionFormatCodec.encodeHeader(currentHeader, targetInheritedEventCount)
const eventRecord = releasedV2SessionFormatCodec.encodeEvent(currentEvent)
```

`releasedV1SessionFormatCodec` は凍結 v1 物理言語を 1 行ずつ読む。`sessionFormatV1ToV2` は静的カタログが v1 イベント配列を保持せずそのデコーダーへ接続する濃度変化段階を作る。カタログは宣言済み参照を再写像し、リリース済み v2 エンベロープ、継承カット、イベント受付、関係を検証する。永続化は公開前に Worker 内で完全な installed-current 検証を適用する。`releasedV2SessionFormatCodec` はリリース済み v2 行デコーダーを作り、v2 ヘッダーとイベントを 1 レコードずつ符号化する。
成功した v1 `assistant/message` は完全な順序付き試行を引用しなければならない。マイグレーションは引用された最上位チャンクと廃止メッセージ チャンク参照を除去し、トークン境界を結合せずにチャンクを圧縮し、ストリームをそのメッセージに格納する。未請求試行は最終チャンク位置にログ専用 `assistant/attempt` 1 件になる。無関係な割り込みイベントは相対順序を保つ。
エッジは、空でない `next-turn` 受信箱挿入の後に前の `turn/end` なしに次の `turn/start` が続く境界付きレガシー再開パターンも閉じる。前のターンを中断として記録する。レガシー round-zero ゴール変更は `goal/change` の後に対応するモデル可視メッセージが通常プラグイン帰属で続く形になり、耐久ゴール状態と歴史的モデル入力の両方が存続する。
マイグレーションは消費済みチャンクへの参照を異なる意味イベントへ向け直すのではなく拒む。宣言済みソースイベント参照、表面置換、コマンドソースイベント、コンパクション範囲と一覧、タイトルメッセージ一覧を再写像する。既にモデル可視の `session/title-llm-request.messages` テキストはソース検証後にバイト同一のままなので、対象検証はそのプロンプトに埋め込まれた旧順序番号を再解釈しない。シード付きソースは Assistant 試行を分断する継承カットも拒み、対象は正確なカットを `session/end-seed { inherited: true }` で印付ける。
v2 物理ヘッダーは `isSeeded` を要求し、数値カットを格納しない。コーデックは最後の継承 end-seed 印からカットを導出し、1 行 1 イベントを書き、`sourceEventSeqs` のみ範囲符号化し、通常イベント語彙とペイロード成長に中立であり続ける。リリース済み現行復元は installed セッションパッケージ既知のイベント型と `ignorable: true` を運ぶ未知イベントを受け入れ、イベント member と関係を検証する。通常セッション復元は埋込みストリームをリプレイせずランタイム必須決着フィールドを検査し、永続化公開と凍結 writer-image 固定具検証は完全なストリーム検証を保持する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

増分エッジは 1 つの未決着 Assistant 試行、その試行に依存して出力位置が決まるイベント、密な旧→新順序写像を保持する。決着済み存続者をソース順に排出し、凍結イベント目録が宣言した参照フィールドのみ書き換える。リリース済み現行検証は変換が保てない関係を拒む。

| ファイル | 役割 |
|---|---|
| [`src/migration.ts`](src/migration.ts) | 試行グルーピング、決着置換、密順序写像、参照書換え |
| [`src/codec.ts`](src/codec.ts) | リリース済み v2 ヘッダー、1 行 1 イベント符号化、ソースイベント範囲、回復可能接頭辞復号 |
| [`src/validation.ts`](src/validation.ts) | 物理 v2 エンベロープ・カット検証とリリース済み現行イベント受付・関係 |
| [`src/dispositions.ts`](src/dispositions.ts) | 凍結リリース済み v2 イベント・ペイロード member 目録 |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [リリース済み v0 to v1 エッジ](../session-format-v0-to-v1/README.md) — ここで再利用するソースコーデックと凍結歴史語彙。
- [静的カタログ](../session-format-catalog/README.md) — ビルド所有のコーデックとマイグレーション順序。
- [セッション永続化サブシステム](../../../docs/subsystems/persistence.md) — 不変世代選択と公開。
- [埋込み Assistant ストリーム決定](../../../.agents/notes/implemented/architecture/2026-09-01-v2-embedded-assistant-streams.md) — 根拠、代替、帰結。

-----

<a id="model-experience"></a>
## モデル体験

### 歴史的復元

#### モデルが見るもの

成功した Assistant メッセージは同じ v1 ストリームから組立てられた内容・プロバイダー・モデル・使用量・リプレイ状態を保持する。失敗または放棄試行は `assistant/attempt` 経由で耐久診断として残るが、`deriveMessages()` には入らない。

#### トークンへの影響

マイグレーションはモデル可視内容を追加しない。導出メッセージ履歴を保ち、現論理イベント順序から最上位チャンクエンベロープのみ除去する。

#### KV キャッシュへの影響

復元モデルメッセージ順序は不変のままなので、マイグレーション単独ではリクエストプレフィックスキャッシュ identity を変えない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **閉じたファーストパーティソース目録** — 未知 v1 イベントはマイグレーションを拒み、`ignorable: true` 印付きイベントも含む。
- **線形再写像状態** — ストリーミングは完全な v1 イベント配列を保持しないが、最終 v2 イベント配列と旧→新順序写像は O（イベント数）のままである。
- **公開・互換フォールバックなし** — 永続化は排他的後継公開を所有し、保持 v1 世代は自動ダウングレードや復元入力ではない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
