---
description: "永続化型の遷移とその互換性の確認応答を記録する。"
kind: persistence-change
---

# 2026-09-16-session-format-v4

日本語 | [English](2026-09-16-session-format-v4.en.md) | [中文](2026-09-16-session-format-v4.zh.md)

## 概要

確定した V4 ライターのために宣言済みの SessionHeader.version を 3 から 4 に進め、ファーストクラスの tool ロール結果と producer 所有のソースを記録し、turn/end.reason に forked バリアントを追加する。name のみのツール追加を履歴の request ヘッダーに束縛する developer ロールの Session 変更、ツール削除、deferred-loading スキーママーカーも追加する。

## 目次

- [宣言](#declaration)
- [互換性](#compatibility)
- [検証](#verification)
- [開発メモ](#dev-note)

<a id="declaration"></a>
## 宣言

```yaml persistence-change
schemaVersion: 1
id: 2026-09-16-session-format-v4
baseline: false
changes:
  - root: "SessionHeader"
    previous: "2026-09-11-initial"
    after: "1a3440e3577382704d42a6263aa463504eb74c566734a55e9503a63efcd02445"
    decision: version-bump
  - root: "event:agent/inbox/spliced"
    previous: "2026-09-14-image-offload"
    after: "1506a9b8224986c83015ae99d2cb5ede705538c58c063d6a48ef6d761a31ba6c"
    decision: version-bump
  - root: "event:assistant/attempt"
    previous: "2026-09-14-image-offload"
    after: "15d5dfdd822aa35e115afd74a8982825a493880457774e6850bc1520b50875e4"
    decision: version-bump
  - root: "event:assistant/message"
    previous: "2026-09-14-image-offload"
    after: "1033093edd0db80ff410e00830b523405e00bb0c7684948e531ff65095799625"
    decision: version-bump
  - root: "event:compaction/summary"
    previous: "2026-09-14-image-offload"
    after: "e2f9a41e0989f54ed8cee80f8db2bcf9d60a5c810dc9d45b83fa050b9dce7602"
    decision: version-bump
  - root: "event:developer/message"
    previous: null
    after: "eef4ef54dc7a133d47448a4ee822e45a351314923ef5f66db34c8b24e4b32d80"
    decision: version-bump
  - root: "event:request/header"
    previous: "2026-09-11-initial"
    after: "4208123b50df5006b181481ab45fcf1cde807b88d3fd4d340090bc2e202fac41"
    decision: version-bump
  - root: "event:session/title-llm-request"
    previous: "2026-09-14-image-offload"
    after: "fa8f7d3ebf08a76c7f7a8b0781873c4d819b964da5dbb52cd3cdfa5da34f452d"
    decision: version-bump
  - root: "event:system/message"
    previous: "2026-09-14-image-offload"
    after: "69081694be231d56fd9580ba14645fd5e35373202605d5c5c841a9435b5fa3b1"
    decision: version-bump
  - root: "event:team/message/queued"
    previous: "2026-09-14-image-offload"
    after: "21fb6a90d5068f6a0003b7ab316ed2f56342477146a65c00db0f13c4d8df667d"
    decision: version-bump
  - root: "event:tool/ptc-dispatch"
    previous: "2026-09-14-image-offload"
    after: "100f6dca1468538239522cde3533e5bd721d0f1a7b50bea8b0eb533ea6c96163"
    decision: version-bump
  - root: "event:tool/result"
    previous: "2026-09-14-image-offload"
    after: "7c9f44e90a0058f4cc532ae20dad0c10afa6eba22e70a6c79fc79490bad64397"
    decision: version-bump
  - root: "event:turn/end"
    previous: "2026-09-14-image-offload"
    after: "0f8512903d94f57a4748fa1a2092e64342856796684e6b8343db685b192745ce"
    decision: version-bump
  - root: "event:user/message"
    previous: "2026-09-14-image-offload"
    after: "3f72db3d87a0c5c43e68be467b4cca728eaf5adc1d5d2b6975ff42bfbd961761"
    decision: version-bump
```

<a id="compatibility"></a>
## 互換性

tool ロールの宣言は 10 個のイベントルートを変更する。inbox エントリー、message イベント、compaction サマリー、title リクエスト、team メッセージ、PTC ディスパッチが共有の `Message` または `ContentBlock` 宣言を埋め込んでいるためである。その union から `tool-result` を削除し、message ロールを特化することは、10 個の独立したイベントプロトコルを追加することなく、それらの到達可能なスキーマを変更する。`turn/end` の変更は forked 理由を別途記録し、`SessionHeader` はバージョン増加を記録する。

[native V4 検証の決定](../../.agents/notes/implemented/architecture/2026-09-17-native-v4-read-validation.md)が、これらの現在のフィールドが必要とするリーダー受理を所有する。

V3 から V4 へのマイグレーションは、リリース済みの user ロールのツール結果を、必須の toolCallId とオプションの isError を持つ tool ロールメッセージへ持ち上げる。tool-result ラッパーは content-block union を離れる。このマイグレーションは受理されたすべてのソースイベントと継承されたカットを保持し、同じ永続化ルート内の保持された直接子ログから欠落した親 subagent/カタログレコードを追記する。履歴の body 復元は明示的な子エビデンスセットを必要とし、バックフィルできる子がない場合は空のセットを含む。欠落、複数、または unknown-version の子記述子はその子のバックフィルをスキップする。矛盾するアイデンティティ、タイムスタンプ、またはモードは公開なしでマイグレーションを拒否する。既存のカタログの事実は残る。履歴 read オープンは結果をメモリ内で準備する。write オープンは、変更されていない前任ファイルの隣に現在の後継を公開する前に、子メンバーシップとリビジョンを再検証する。配信世代チェックは履歴の確認応答がアクティブな V4 ウォーターマークになることを防ぐ。V3 リーダーはより新しい世代を拒否する。確定した遷移は turn/end.reason に forked を追加する。exact-cut フォークは継承されたマーカーの後に子所有のエラー結果とクローザーを追記する。V4 はチェックされた not-started フォーク結果を決定論的なブランチ固有の ID と文言で受理する。リリース済みの V0–V3 バリデータと記録済みの前任世代は変わらない。

`request/header` スキーマはさらに、退役した `system` キーを禁止として記録する。この宣言は、保存データやプロンプト再構成を変えずに、既存の native-reader の拒否を捕捉する。後で値を許可するには、通常のオプションフィールド追加として分類するのではなく、同一バージョン変更の互換性レビューまたは明示的なバージョンアップが必要である。

producer 所有のソースは [V3-to-V4 マイグレーション](../../packages/session/session-format-v3-to-v4/README.md#v3-to-v4-specification)を通じてリリース済みのプラグインラッパーを置き換える。凍結されたリネームテーブルと衝突規則はソースフィールドとイベント座標を保持する。未知の producer 帰属は自身のすべての JSON プロパティを保持する。native の read と write のオープンは Session を公開する前にソースフィールドを検証する。既存の V4 ファイルは incoming マイグレーションエッジを再実行しない。

core 所有の user source プロパティは帰属保持ポリシーを記録する。tmux-context は producer ローカルの重複抑制を保持しつつ、その location 帰属を修飾する。Auto Review と compaction サマライザーは request-only のユーザー入力を使用し、履歴マイグレーションサポートを削除せずにそれらのアクティブなソース登録を削除する。これらの入力は耐久性のある Session メッセージとして書き込むことができない。Catalog formatVersion 2 はポリシーメタデータを格納し、Session バージョンを変更せず、凍結されたスキーマレコードを書き換えない。system、model、tool の各ソースはその厳格なセマンティクスルールを保持する。

developer イベントは元のロールを保持し、開いているステップを必要とする。各追加は toolName を格納し、developer/message.headerSeq は完全に一致する 1 つの ToolSchema を含む以前の既知の request/header を識別する。1 つのイベント内のすべての追加はその履歴ヘッダーリビジョンを共有し、削除のみおよびその他の developer メッセージは headerSeq を省略する。native と Session の受理は、欠落、前方参照、非ヘッダー、未知ヘッダー、曖昧、不完全定義、退役したインライン定義の形式を、未知の無視可能レコードを解釈せず、無関係な JSON メタデータを落とさずに拒否する。同名置換、再起動、フォーク、サーフェス置換、compaction は、最新のヘッダーやレジストリを参照せずに履歴スキーマアイデンティティを保持する。汎用の sourceEventSeqs は独立したままである。developer ソースは user ソースと同じ記録済み帰属保持ポリシーを使う。オプションの deferLoading マーカーは追加履歴と独立である。出荷されるプロファイルは developer レコードを emit しない。プロバイダーシリアライズ、自動 emit、UI サポートは先送りのままである。

PTC プロデューサーは `source.kind: 'ptc-mode'` を書き込む。V3-to-V4 エッジは `tools-code-mode` と `tools-ptc` を履歴のプラグインルックアップキーとして保持し、両方をその現在の kind にマップする。ソースポリシーは帰属のみの修飾に対して `ptc-mode` を予約する。

<a id="verification"></a>
## 検証

exact-cut フォークの統合後、フォーカスされた Session、agent-loop、Session Controller、V4、chat-view、compaction の各スイートは 63 ファイルにわたる 1,523 テストに合格した。V4 フォークテストはエンコード、デコード、復元を通じて元の ID とテキストを保持し、不正な結果を拒否し、ネストされた継承カットを検証する。tool ロールマイグレーションのテストと SDK スナップショットのリフレッシュも発端の変更で合格した。ビルド済み Python ランタイムの sdk-snapshot シナリオが合格し、フォーカスされた pi-ai と auto-review のカバレッジが影響を受ける 3 モジュールの 100% カバレッジで 351 テストに合格した。

生成された request-header 予約のリグレッションと既存の退役構文および Session サーフェスのテストは 3 ファイルにわたる 65 テストに合格した。生成されたフィールドはオプションの `never` を保持する。現在の分類器はオプション文字列の許可を互換性レビューが必要とマークし、native リーダーは依然として退役キーを拒否する。

producer ソースと request 入力のチェックは 12 ファイルにわたる 447 テストに合格し、プロバイダー等価性、request-only 型の拒否、user 帰属の保持、ソースマイグレーション、native ソースの受理を含む。生成されたインベントリを tool ロールの親と比較すると、4 つの変更されたルートと 447 の変更されていない型フィンガープリントが報告される。

フォーカスされた Session、V4、request 入力のスイートは 38 ファイルにわたる 884 テストに合格し、完全な V3-to-V4 パッケージと Session サーフェスについて 100% の statements、branches、functions、lines を達成する。カバレッジには、履歴の同名スキーマバインディング、複合的な追加/削除、不正な参照と定義、未知ヘッダーの拒否、不透明な未知レコード、メタデータ保持、フォーク、置換、compaction 参照、および世代を書き換えない native の plain/zstd read/write 受理が含まれる。

<a id="dev-note"></a>
## 開発メモ

なし。
