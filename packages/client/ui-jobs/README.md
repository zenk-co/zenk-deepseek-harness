---
description: "セッションヘッダーのバックグラウンドジョブリスト。展開可能なストリーミング出力パネル、実行中・完了済み区分、保持出力のない確定ジョブの静的行。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-jobs

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-client-ui-jobs` はセッションのバックグラウンドジョブを 1 つのヘッダーコントロールに表示し、ライフサイクル、経過時間、進捗、終端詳細を伴う。ライブジョブと保持出力付き確定ジョブは展開可能な出力パネルを提供する。折りたたみでストリームを停止する。ライブ行は刻む所要時間を先頭に、種類と状態が続く。確定行は区分見出しの下に畳まれる。保持出力のないもの（回答がモデルに渡ったサブエージェントを含む）は静的なままである。

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

web-app マニフェストを通じてプラグインを読み込む。セッションが少なくとも 1 つのジョブを見られるようになるまで何も描画しないため、通常の会話が使用していないケイパビリティのためにコントロールを増やすことはない。

### ジョブごとに 1 行

`ctx.jobs` がミラーする `job.list` ストリームが唯一の名簿である。各 `JobView` 行はライフサイクル、所要時間、ライブの `progress` 行または終端の `detail`、保持バイト数を運ぶ。ライブジョブまたは保持出力付き確定ジョブが行を展開可能にする。結合すべき 2 つ目の名簿はない。

実行中ジョブ行は 2 度押し停止コントロールも運ぶ。1 度目が武装し、3 秒以内の確認押しで `ctx.jobs.kill` を呼び、行は名簿ストリームを通じて収束する（`stopping`、次に確定区分。その詳細は `cancelled by the user` を運ぶ）。kill はモデルの通知台帳に何も要求しないため、所有エージェントは依然として標準完了通知を受け取る。モデルは推測に任されるのではなくユーザーがタスクを停止したと知らされる（[リファレンス](../../jobs/tool-jobs/README.md)）。確定区分はライブ作業がある間は件数の背後に畳まれ、クライアント側で消去できる。

### 展開パネル

観察可能な行の展開は、そのジョブの出力観察ストリームを `ctx.jobs`（`dsh-api-job-controller` がインストール）から埋め込み端末パネルに開く。パネルはコマンドをコピーする（出力はしない）。コマンドと出力行を完全に折り返し、出力を折りたたまず固定高さの中でスクロールし、独自の実行状態ドットを描かない。状態は上の行が運ぶ。保持隙間とストリーム中断はパネル上部の通知として描画される。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

ヘッダーアクション帯の 1 つのスロットエントリー（プリセットラベル後）がトリガーを描画する。そのポップオーバーは固定配置の本体マウント `MenuSurface` を使い、ドックパネルや切り取り祖先がそれを覆えないようにする。共有固定フックはスクロール、リサイズ、パネル寸法変更を追跡する。すべてのデータは `ctx.jobs` を通じて到着する。コンポーネントは転送状態を持たない。名簿はマウントに従う。1 つの `useEffect` がコントロール存命中にセッションの `job.list` ストリームを開いたままにする。観察は可視性に従う。別の `useEffect` が展開行ジョブのストリームを開き、折りたたみ、アンマウント、ポップオーバー閉鎖で閉じる。

| ファイル | 役割 |
|---|---|
| [`src/client/JobListAction.tsx`](src/client/JobListAction.tsx) | ジョブリスト。区分、所要時間、パネル |
| [`src/client/index.ts`](src/client/index.ts) | スロット登録と辞書 |
| [`src/client/locales.ts`](src/client/locales.ts) | `job` 名前空間の対訳（zh が正本） |

バックグラウンドジョブ行は[標準メニュー辺形状](../../../docs/ui-radius.md#nested-hover)に従う。塗り実行中行の内部コントロールは緊密な角を保持する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [`dsh-api-job-controller`](../../api/job-controller/README.md) — 行、パネル、停止コントロールの背後にある `job.list` と `job.follow` ストリーム、`job.kill` リモート、`ctx.jobs` サービス。
- [`dsh-jobs`](../../jobs/jobs/README.md) — リングと射影意味を所有する registry 契約。
- [`dsh-client-ui-primitives`](../ui-primitives/README.md) — パネルが設定する `TerminalBlock` サーフェス。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージは人間向けにホスト観察状態とライブ出力を描画するだけであり、プロンプト、メッセージ、スキーマ、ストリーム、ツール結果に触れない。同じ作業に対するモデル自身のビューは [`dsh-tool-jobs`](../../jobs/tool-jobs/README.md) にある。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダー要求を組み立てず送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

これらの制限は現在のパッケージ制約を定義し、タスクバックログではない。

- **チャネルラベルは描画されない** — stdout と stderr チャンクは 1 つのストリームに連結される。チャネルごとの色分けは表示上の追い作業である。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
