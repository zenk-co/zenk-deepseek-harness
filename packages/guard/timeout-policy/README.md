---
description: "キャンセル対応のツール呼び出しに対する協調的制限時間。確定したタイムアウトを明確なモデルエラーに対応付ける。このプラグインを選択またはデバッグするユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-call-timeout-policy

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは、ツール呼び出しに設定された協調的制限時間を与え、キャンセルが確定した後に明確なタイムアウトエラーをモデルへ返す。時間内に完了した呼び出しは変更されない。キャンセルを無視する、または遅く処理するツールは呼び出し元を待たせ続ける可能性がある。このパッケージは下流の作業を強制停止できないためである。各ツールが独自の制限を提供し、このパッケージに設定はなく、`dsh` ベースバンドルで有効になっている。

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

一般的な使い方は 1 行である: プラグインを構成に追加する — `dsh` ベースバンドルにはすでに含まれている。制限が設定されたツールは自動的に保護され、その他のツールには何も起きない。

### いつ選ぶか

モデルが長時間かかりうるツールを呼び、それらのツールが `exec.signal` に従い、キャンセルが確定した後に予測可能なタイムアウト応答を望む場合に選ぶ。ツールを制限時間で強制停止しなければならない場合は避ける — プラグインはツールに停止を依頼することしかできず、キャンセルを無視するツールは動作を続けて呼び出し元を待たせ続ける — また、すべてのツールに単一のデフォルト制限を望む場合も避ける。各ツールの制限はそのツール自身の設定から来るためである。

### セットアップ

設定なしでプラグインをマウントする:

```yaml
- name: '@deepseek-ai/dsh-tool-call-timeout-policy'
```

制限はツールが設定される場所で設定される。たとえば `dsh-tool-web` の `fetchTimeoutMs`/`searchTimeoutMs` 設定（デフォルト 30,000 ms）は `web_fetch` と `web_search` に制限を課す。制限のないツール — 出荷済みの `bash`、`read`、`write`、`edit` — は決して切断されない。生成された[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-tool-web)に、制限を生み出すツール設定が一覧されている。

### 得られるもの

デッドラインが発火すると、プラグインは派生した `exec.signal` をアボートする。下流のコードがキャンセルに従い `next()` が確定した後、モデルは `Error: tool call timed out after <ms>ms` をエラー結果として受け取り、再試行、調整、または断念を判断できる。シグナルを無視する、または遅く処理するツールは呼び出し元を待たせ続け、確定するまでタイムアウト結果を生成しない。時間内に完了した呼び出しは変更されない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションでは、プラグインが各ディスパッチの周囲にデッドラインを設定し、それを `TOOL_TIMEOUT` 結果にマッピングする方法を説明し、それを実現するコードを指し示す。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱う。

### 設計思想

このラッパーは 4 つの約束の上に築かれている:

- **執行の本拠地であり、ライブラリではない。** `dsh-timeout` がタイミングと分類（`deadline`、`timeoutOf`）を所有し、このプラグインが `tools/execute` 上の呼び出しごとの配線を所有し、各ケイパビリティが終了処理を所有する。この分割は [timeout-deadline-library Agent Note](../../../.agents/notes/implemented/architecture/2026-07-06-timeout-deadline-library.md) に記録されている。
- **ツールが自身の予算を宣言する。** `timeoutMs` はツールの `ToolDefinition` 上にあり、レジストリから読まれる（`ctx.tools.get(exec.name, exec.agent)?.timeoutMs`）。そのためツール名の打ち間違いは起こりえず、宣言のないツールはそのまま委譲される。
- **スコープ付きの分類。** `TOOL_TIMEOUT` は内部の `deadline` 分類コードと構造化エラーの `code` の両方を兼ねる。`timeoutOf` をそれにスコープすることで、ネストした外側のデッドライン（先に発火した別のラッパーのタイマー）がこのプラグインのタイムアウトと誤読されない — それは通常の上流キャンセルとして読まれる。
- **シグナルの差し替えと復元。** Cordis の `next()` は渡された引数を無視するため、ラッパーは共有 `exec` をその場で変更する: ディスパッチ用に派生デッドラインシグナルを `exec` に差し替え、`finally` で呼び出し元のシグナルを復元する。これにより `tools/post-execute` リスナーはこのプラグインのアボートされた可能性のあるシグナルを見ることがない。

### デッドラインの設定とマッピングの方法

1 つの `tools/execute` リスナーが、ディスパッチされたツールの宣言済み制限をレジストリから読む（`ctx.tools.get(exec.name, exec.agent)?.timeoutMs`）。制限のないツールはそのまま委譲される。制限のあるツールでは、`deadline(exec.signal, timeoutMs, TOOL_TIMEOUT)` が融合シグナルを構築し、ラッパーがディスパッチ用に `exec` へ差し替え、`finally` で復元するため、`tools/post-execute` リスナーは派生シグナルを見ることがない。ラッパー自身のタイマーが発火した場合 — `timeoutOf(d.signal, 'TOOL_TIMEOUT')` をコードでスコープするため、ネストした外側のデッドラインは通常の上流キャンセルとして読まれる — ディスパッチによってすでにエラー結果に正規化されたディスパッチ結果が、構造化結果で置き換えられる: `isError: true`、内容 `Error: tool call timed out after <ms>ms`、エラー情報 `{ name: 'ToolTimeoutError', code: 'TOOL_TIMEOUT' }`。

### 他のラッパーとの構成

複数の `tools/execute` リスナーは Cordis の登録順で構成され、それがセマンティクスを決める: 外側に登録されたタイムアウトはリトライ操作全体をカバーし、内側に登録されたタイムアウトは各試行をカバーする。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリ: `TOOL_TIMEOUT`、`name`/`inject`/`apply`、`tools/execute` ラッパー |

</details>

-----

<a id="further-exploration"></a>
## さらなる探索

パッケージレベルの契約では足りないときにこれらのページを読む。ツール呼び出しパイプラインから、タイムアウトライブラリの分割、執行される制限、および guard グループのマップへと進む。

- [Tools サブシステムリファレンス](../../../docs/subsystems/tools.md) — このラッパーがフックする `tools/execute` ウォーターフォールと決定の形。
- [Timeout deadline library Agent Note](../../../.agents/notes/implemented/architecture/2026-07-06-timeout-deadline-library.md) — タイミング/終了の分割と、デッドラインが通知のみを行う理由。
- [生成された設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-tool-web) — このポリシーが執行する `dsh-tool-web` の `fetchTimeoutMs`/`searchTimeoutMs` 予算。
- [guard グループのマップ](../README.md) — 兄弟 guard パッケージとループ健全性ファミリー。

-----

<a id="model-experience"></a>
## モデル体験

### 条件付きツール結果

#### モデルが見るもの

このプラグインはプロンプトやスキーマを追加しない。宣言されたデッドラインが勝ち、下流のキャンセルが確定した場合、プロバイダーの結果を `Error: tool call timed out after <ms>ms` と構造化 `TOOL_TIMEOUT` エラーで置き換える。それ以外の場合、元の結果はそのまま通過する。確定しない下流呼び出しはタイムアウト結果を生成できない。

#### トークンへの影響

タイムアウト以外の呼び出しではゼロトークン。タイムアウトは小さな保持済みエラー結果を 1 つ追加し、遅れて届くより大きなプロバイダー結果がコンテキストに入るのを防げる。

#### KV キャッシュへの影響

追記のみ。新たに可視になる内容は再利用可能なリクエストプレフィックスに続き、既存の KV キャッシュエントリを無効にしない。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、このポリシーが不向きな場合を定義する。これらは現在のパッケージ制約であり、タスクのバックログではない。

- **協調的であり、強制終了はしない** — デッドラインは `exec.signal` を介して通知するのみである。シグナルを無視するツールはタイムアウトで停止せず、ラッパーは `await next()` の内側に留まり、下流が確定するまでモデルはタイムアウト結果を受け取らない。
- **包括的な予算はない** — `ToolDefinition` で `timeoutMs` を宣言したツールだけがデッドラインを得る。宣言のないツール（出荷済みの `bash`、`read`、`write`、`edit` は宣言していない）にはレジストリ全体のデフォルトはない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発メモはメンテナー向けの作業コンテキストである: 未解決の疑問と未決定の方向性。明示的に非権威である — 出荷済みの動作、制限、認められた根拠は、上記のセクション、パッケージコード、およびリンクされた Agent Note にある。

`src/index.ts` の FIXME は `@deepseek-ai/dsh-timeout-guard` への改名を決着させることを求めているが、[naming ledger](../../../.agents/notes/archived/architecture/2026-08-11-repository-naming-contract-and-rename-ledger.md)はすでに `@deepseek-ai/dsh-tool-call-timeout-policy` を決定済みの名前として記録しているため、この FIXME はコード整理待ちの古いものである。

</details>
