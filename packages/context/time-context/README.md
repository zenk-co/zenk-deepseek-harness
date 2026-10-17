---
description: "現在の時刻、ブラウザーゾーン、経過時間を持つステップごとの時計コンテキスト。プラグインを調整するユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-time-context

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-time-context` はモデルに時計を与える。対象ステップでは、現在の時刻、その開いているリクエストに付随するブラウザーゾーン、前回モデル可視メッセージからの経過時間を備えた耐久性・ソース帰属付きリーディングを追記する。ユーザーのブラウザーゾーンにおける修飾なし日時解釈を助け、現ターンのブラウザーゾーンが混在または欠如している場合は質問するよう伝える。出荷済み Web 構成にはその行がなく、`standard`、`cordis`、`ptc` が宣言する。リーディングは既定で 10 分の最小間隔であり、`refreshIntervalMs: 0` は対象のすべてのステップで注入する。

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

モデルがユーザーのゾーンにおける修飾なし日時を解釈すべき場合や、リクエストローカルのブラウザーゾーンが利用可能または構成済みフォールバックが許容できる場合に、このプラグインをマウントする。各注入は耐久履歴におけるユーザー role メッセージ 1 件分であり、ステップごとのリーディングが会話に過剰な場合は `refreshIntervalMs` で間引く。出荷済み Web 構成には Host `time-context` 行がなく、`standard`、`cordis`、`ptc` プリセットはそれを消費するリマインダーツールの隣で宣言し、`minimal` はいずれも宣言しない。

### モデルが得るもの

注入される各リーディングは 3 行からなる。数値オフセットと IANA ゾーン付き ISO 形式タイムスタンプ、そのリクエストのブラウザーゾーンポリシー、直近のモデル可視メッセージからの経過時間をコンパクトな秒単位で表す。ステップ 1 は直前のモデル可視メッセージ起点で測り、後続ステップは同ターン内の直前 time-context イベント起点で測る。ベースライン欠如は `unavailable` を報告し、壁時計の逆行は経過時間をゼロにクランプする。

### 構成

最小のマウントには構成は不要である。正の `refreshIntervalMs` は最新分からそのミリ秒以内の注入を抑止し、省略時は 600000 ms（10 分）を使い、`0` はシグナルが既に abort されていない対象の進入プリステップすべてで注入する。

```yaml
- name: '@deepseek-ai/dsh-time-context'
  config:
    timeZone: Asia/Shanghai
```

| フィールド | 既定値 | 意味 |
|---|---|---|
| `timeZone` | プロセスゾーン | 開いているターンに一意なブラウザーゾーンがない場合のフォールバック表示ゾーン |
| `refreshIntervalMs` | `600000`（10 分） | 1 セッション内における耐久注入の最小間隔ミリ秒 |

生成された[構成カタログ](../../../docs/config-catalog.md#deepseek-aidsh-time-context)は、受け入れるすべてのフィールドとその JSDoc の網羅的ソースである。

### ゾーンの選択

開いているターンが Host 検証済みブラウザーゾーンをちょうど 1 件含む場合、タイムスタンプはそのリクエストローカルゾーンで整形される。ブラウザーゾーン記録の欠如や混在がある場合、構成済み `timeZone` が表示を整形する。省略時はプラグイン読み込み時に Node プロセスゾーンを 1 回解決し、明示的フォールバックはすべて `Intl.DateTimeFormat` 経由で検証される。解決された指示は、修飾なし日時を模式的ゾーン行で解釈し、それらの記録が混在または利用不可の場合にユーザーへ明確化を求めるようモデルに伝える。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションではプラグインの設計を説明する。観察可能な動作は[このパッケージを使う](#use-this-package)で扱う。

### 設計概念

プラグインは `agent/pre-step` リスナーを先頭に追加し、まず委譲して、注入すべきで下流決定がステップに入る場合にソース付き `UserMessage` を 1 件追記する。各リーディングは正確なスナップショットソース `{ kind: 'time-context', form: 'snapshot', sections: [{ name: 'time-context', text }] }` を使う。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグイン入口: プリステップリスナー、到来スケジューリング、リーディング合成 |
| [`src/request-zone.ts`](src/request-zone.ts) | 開いているターンの `user-rpc` ソースからのブラウザーゾーンポリシー導出 |
| [`src/timestamp.ts`](src/timestamp.ts) | `Intl.DateTimeFormat` 生成とタイムスタンプ整形 |

### 主な流れ

注入すべき場合、プラグインは壁時計をサンプリングし、開いているターンの `user-rpc` メッセージからブラウザーゾーンポリシーを導出し、表示ゾーン（リクエストローカルまたはフォールバック）を解決して 3 行リーディングを描画する。正間隔スケジューリングは最新のプラグイン帰属メッセージを素の耐久セッションイベントから走査し、コンパクションで影に入ったものも含めるため、スケジュールはプロセスローカルキャッシュなしに再開をまたいで存続する。リーディングは完了または送信済みリクエストではなく入ったステップを記録するため、後の準備失敗が履歴に残すことがある。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときに、これらのページを読む。設計判断から、このプラグインをマウントする構成と網羅的構成へと進む。

- [Schedule ユーザーガイド](../../../docs/user/guide/schedule.md) — このプラグインをマウントする公式の構成パス。
- [Context グループマップ](../README.md) — 兄弟リクエストコンテキストパッケージ。
- [生成された構成カタログ](../../../docs/config-catalog.md#deepseek-aidsh-time-context) — 受け入れるすべての構成フィールドとそのソース宣言。

-----

<a id="model-experience"></a>
## モデル体験

### 準備時テンポラルコンテキスト

#### モデルが見るもの

注入される各メッセージは 3 行を含む。`<timestamp>` は数値オフセットと IANA ゾーン付き ISO 形式タイムスタンプであり、期間はコンパクトな秒単位を使う。

##### 最初のステップ

```markdown
Time sampled while preparing turn <turn>, step 1: <timestamp>
Browser time zone for this request: <iana-zone-or-mixed-or-unavailable-policy>.
Elapsed since the preceding model-visible message: <duration-or-unavailable>.
```

##### 後続ステップ

```markdown
Time sampled while preparing turn <turn>, step <step>: <timestamp>
Browser time zone for this request: <iana-zone-or-mixed-or-unavailable-policy>.
Elapsed since the preceding step context: <duration-or-unavailable>.
```

#### トークンへの影響

各リーディングはコンパクションで影に入るまで蓄積する。正の間隔は追加を減らし、`0` は対象のすべての準備試行で 1 件追加する。

#### KV キャッシュへの影響

追記のみ。新しく可視になる内容は再利用可能なリクエストプレフィックスの後に続き、既存の KV キャッシュエントリを無効化しない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


時計コンテキストが不向きな場合を定める。これらは現在のパッケージ制約である。

- **プロンプトガイダンスのみ** — ブラウザーゾーンコンテキストは自然言語解釈を導くが、他のツールの必須ゾーンフィールドを黙って補わない。
- **混在ターンは質問する** — 開いている 1 ターンが異なるブラウザーゾーン由来のプロンプトを含む場合、どちらが修飾なし時刻を所有するか推測せず明確化するようモデルに伝える。
- **フォールバックはユーザー権威ではない** — 現ターンのブラウザーゾーンが欠如または混在している場合に構成済みまたはプロセスゾーンが時計を整形するが、モデル向けポリシーは依然として明確化を求める。
- **秒単位表示** — 耐久イベント時刻がミリ秒を保持していても、タイムスタンプと期間はサブ秒精度を省く。
- **コンパクション間の履歴コスト** — `0` は対象のすべての試行にリーディングを 1 件残す。正の間隔はコストを減らすがなくさず、新しいブラウザーゾーンガイダンスなしに後のリクエストが残ることがある。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
