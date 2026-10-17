---
description: "コンパクションを構成する配置向け画像 offload 実行器。画像対応経路が画像予算超過として要求を拒否した場合に何が起きるか。"
kind: "package-reference"
---

# @deepseek-ai/dsh-compaction-image-offload

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

古い画像がモデル経路の予算を超えても画像の多い会話は続く。このプラグインはそれらの画像を各添付とその利用可能な読み取り専用パスを指名するテキストに恒久的に置換し、プロバイダー再試行予算を消費せずに再試行する。以降の要求は経路変更・再開・再実行を越えてその選択を保持する。トークン計量はログ化選択に従い、プロバイダーキャッシュ再利用は最初の変更メッセージで終わる。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

画像対応経路でエージェントループを実行するすべての構成にこのプラグインをマウントする。出荷 `dsh` 基盤はそうしている。これなしでは `IMAGE_OFFLOAD_REQUIRED` 失敗が通常回復に届き、ターンを誤差として終える。このプラグインに設定はない。DeepSeek 適合器はファイルモードとインライン代替の予算を強制し、pi-ai 適合器は base64 上限を強制し、各々が offload 必要数を報告する。

### 最小設定

```yaml
- name: '@deepseek-ai/dsh-compaction-image-offload'
```

### 観測できること

各決定は現行メッセージイベントシーケンスと深さ優先画像索引で選んだ出現を特定する `image/offload` イベントを 1 件追記する。メッセージイベントと surface ノード同一性は変わらない。エージェント再試行は新しいメッセージ系列を特定する fresh `request/header` に続く。要約再試行は同一コンパクション括弧内に残る。

### 失敗と回復

このプラグインは `offloadImages` を運ぶ `IMAGE_OFFLOAD_REQUIRED` 失敗にのみ働く。モデル要求順に surface を歩き、アシスタントノードと既に印付けされた画像を省き、その件数の出現に印付ける。offload 対象が残らない場合は `agent/request-error` ウォーターフォールに委譲するため、下流回復または通常ターン誤差が適用される。再試行はプロバイダー再試行予算を消費せず、`llm/retry` イベントをログ化しない。選択記録前のキャンセルは `image/offload` イベントを追加せずに委譲し、コミット済み選択後のキャンセルは再試行を止めるが省略を保持する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このパッケージはイベント宣言・参照検証・不変画像プロジェクション・選択・再試行ポリシーを所有する。画像 offload イベント受付の前に `imageOffloadProjection` を Session に登録する。同一のブラウザー安全定義は分離再実行用に `./projection` からエクスポートされ、設置済み形式カタログはオフライン読み手用にそれを組み立てる。欠落登録はライブ復元を拒否し、使用済み定義の unload は以降のメッセージ導出を阻む。トークン計測は置換 shadow 価格なしで同一選択を折り畳む。

要約失敗は同期 `compaction/summary-error` ウォーターフォールを使う。このプラグインは提供された要約領域のみを選び、省略記録後に true を返す。コンパクションバックエンドは再試行前にその領域を再導出・再価格付けする。各再試行は追加の保持出現を省略するため、残りがなくなった時点で回復は終わる。キャンセルと無関係選択変更は要約を拒否する。記録済み省略は以降の失敗やキャンセルを越えて残る。

純粋プロジェクションは Session がイベントをコミットする前に無効または重複の画像参照を拒否し、この実行器は別途可変 offload 状態を保持しない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [専用画像 offload イベント](../../../.agents/notes/implemented/architecture/2026-09-10-image-offload-events.md) — 耐久性のある選択、所有権、却下された代替案。
- [compaction シーム](../compaction/README.md) — 隣接する要約とテキスト刈り込み操作。
- [compaction-tool-result-pruner](../compaction-tool-result-pruner/README.md) — 画像選択を保持しながらツール出力を刈る兄弟実行器。
- [dsh-llm](../../llm/llm/README.md) — `ImageBlock.offloaded`、`IMAGE_OFFLOAD_REQUIRED`、プレースホルダープロジェクション。
- [llm-deepseek 適合器](../../llm/llm-deepseek/README.md)と [llm-pi-ai 適合器](../../llm/llm-pi-ai/README.md) — offload 数を報告する経路予算。

-----

<a id="model-experience"></a>
## モデル体験

### Offload された要求画像

#### モデルが見るもの

選ばれたすべての画像出現は添付とその利用可能な読み取り専用パスを指名するプレースホルダーテキスト（`offloadedImageText`）としてモデルに届き、未選択の出現は画像のままである。選択は要求を越えて残る。新しいツール読み取りは古いものを復元せずに同一添付の新しい出現を導入し得る。

#### トークン効果

offload された出現は視覚トークンの代わりにそのプレースホルダーテキストを費やす。トークンメーターは各ノード価格付けにログ化選択を適用する。参照専用ヒューリスティック数は offload メタデータを除外する。

#### KV キャッシュ効果

選択は以前の画像をプレースホルダーテキストに変えるため、その要求のプロバイダーキャッシュ再利用は最初の変更画像で終わる。選ばれた出現はその後省略されたままである。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- **Offload された画像は自動で戻らない** — 予算拡大、大きな経路、合計を下げるコンパクションでも印は残り、回復はプレースホルダー内の読み取り専用パスである。
- **すべての offload は失敗試行 1 件を費やす** — 配送前に offload を計画するものはなく、経路の拒否が信号であり、プロバイダー報告の uncacheable 画像への計画移行と一致する。
- **一時的な小予算は恒久的に offload する** — インライン代替を強制する Files 障害、または小予算経路への一時切替は、後の経路が送れたはずの画像を offload する。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

この開発メモは非権威の作業コンテキストである。メンテナー向け記録と未解決の問いである。出荷動作と受容済み根拠は上節、パッケージコード、リンク済みエージェントノートにある。

- `IMAGE_OFFLOAD_REQUIRED` を生む経路ローカルバイト検査は暫定である。プロバイダーが uncacheable 画像を自ら報告するようになれば、適合器はその報告を件数に対応付け、この実行器はそのまま残る。

</details>
