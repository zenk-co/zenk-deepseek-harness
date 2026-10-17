---
description: "呼び出し元ヒントを締め、期限を融合し、タイムアウト対キャンセルを分類する共有タイムアウト算術、期限融合、タイムアウト対キャンセル分類。期限を設け両者を後で区別しなければならないケイパビリティ向け。"
kind: "package-library"
---

# @deepseek-ai/dsh-timeout

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-timeout` を使うと、呼び出し元は境界付き期限を作業に適用し、ローカルタイムアウトと上流キャンセルを区別し、ストリーム読み取りの無活動を監視できる。`clampTimeout` は欠けたヒントをバックエンド既定で埋め、許容上限で締め、作業開始前に無効値を拒む。`deadline` は選ばれたタイムアウトと上流キャンセルを 1 信号に融合するが、自身のプロセス・ソケット・タスクを実際に止める責任は呼び出し元に残る。`idleWatchdog` はプロバイダー読み取り待ちに費やした時間のみ数え、ゼロは公開構成ではなくバックエンド所有の無期限作業向けに予約される。

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

ケイパビリティが呼び出し元可視タイムアウト下で 1 単位作業を実行する場合は `deadline` を使い、ストリームトランスポートを読む場合は `idleWatchdog` を使う。まず `clampTimeout` で呼び出し元ヒントを検証し、`deadline` に届く `timeoutMs` が常に正かつ有限になるようにする。

### タイムアウトヒントの締め付け

```ts
import { clampTimeout } from '@deepseek-ai/dsh-timeout'

declare const requested: number | undefined
declare const DEFAULT_TIMEOUT_MS: number
declare const MAX_TIMEOUT_MS: number

const timeoutMs = clampTimeout(requested, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, 'bash-local: request.timeoutMs')
```

`clampTimeout` はヒント欠如時にバックエンド既定を埋め、結果をバックエンド上限で締め、非正または非有限ヒントを呼び出し元提供名付きで拒む。ゼロはここでは決して受け付けない。公開のタイムアウト無効値ではない。

### 期限下での作業実行

```text
import { deadline, timeoutOf } from '@deepseek-ai/dsh-timeout'

using d = deadline(upstream, timeoutMs, 'BASH_TIMEOUT')
const outcome = await runWork({ signal: d.signal })   // work listens on d.signal and terminates itself
const timedOut = timeoutOf(d.signal, 'BASH_TIMEOUT') !== undefined
const aborted = d.signal.aborted && !timedOut
```

信号は通知のみである。呼び出し元は自身の終了を付随させなければならない。`d.signal` を `fetch` に渡すか、`abort` を listen して子を kill する。タイマーに対する promise 競合は、子プロセスやソケットを漏らしたままツール呼び出しを解決してしまう。

### 結果の分類

`timeoutOf(signal, code)` はこの期限のタイマーが先に発火した場合にのみタイムアウト理由を回収する。ネスト下で合成できるよう自身の `code` を渡すこと。`upstream` 自体が期限信号の場合、外部タイムアウトはローカルタイマー満了の主張ではなく通常の上流キャンセルとして読まれる。

### アイドル看視付きストリーミング

```ts
import { idleWatchdog } from '@deepseek-ai/dsh-timeout'

declare const upstream: AbortSignal | undefined
declare const idleMs: number
declare const providerIterator: AsyncIterator<unknown>

using watchdog = idleWatchdog(upstream, idleMs, 'LLM_STREAM_IDLE_TIMEOUT')
const next = await watchdog.next(providerIterator)    // timer runs only while this read is outstanding
```

タイマーは反復子 `next()` が outstanding の間のみ armed され、値を生まないトランスポート活動向けには `pulse()` で再 armed されるため、読み取り間のコンシューマー思考時間は無活動として数えられない。間隔は正・有限かつ `MAX_TIMER_DELAY_MS` 以下でなければならない。

### タイムアウトを持たないもの

ローカルファイル `read`/`write`/`edit` は `timeoutMs` を取らない。ファイル IO は無期限で実行される。期限は OS がそれでも終える作業を kill してしまうためである。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

ライブラリは 1 境界の上に構築される。タイミングと分類を共有し、ハード kill はローカルに保つ。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | `clampTimeout`、`deadline`、`idleWatchdog`、`timeoutOf`、`TimeoutReason`、`MAX_TIMER_DELAY_MS` |

### 期限がソースを融合する仕組み

`deadline` はタイマーを 1 件 armed し、上流信号との abort を `AbortSignal.any` 経由で融合する。これは先に abort した側の理由を採用するため、競合は単一原因に解決される。`TimeoutReason` はケイパビリティ所有の `code` と経過 `timeoutMs` を運び、`timeoutOf` はタイムアウト勝利時にのみそれを読む。上流勝利は通常 abort 理由のまま残る。`[Symbol.dispose]` はタイマーを消去する。

### 無期限センチネル

`timeoutMs <= 0` はタイマーを armed せず上流信号のみ転送する。ない場合は決して abort しない信号であり、すべての呼び出し元は 1 呼び出し形状を保つ。センチネルはバックエンド所有バックグラウンド作業向けに存在する。外部リクエストヒントは `deadline` に届く前に正かつ有限に検証される。

### アイドル看視が再 armed する理由

`idleWatchdog` は安定した融合信号を 1 件保持し、`next()` が outstanding の間のみタイマーを armed する。解決で disarm し、後の要求や `pulse()` で再 armed し、破棄で消去し、並行要求を拒む。`deadline()` と異なり、アイドル看視は自身期限に outstanding 要求を自ら決着させる。abort 後にトランスポートが保留したままにした読み取りは看視の `TimeoutReason` で `next()` を拒むため、信号を観察しないトランスポートは待機を無活動間隔より延ばせない。信号は依然としてトランスポートに自身リソース解放を伝える。DeepSeek と pi-ai アダプターは abort 時に応答本体や SDK リクエストを閉じる。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

ライブラリ背後のコンシューマーや境界決定が必要なときに、これらのページを読む。

- [タイムアウト期限ライブラリ Agent Note](../../../.agents/notes/implemented/architecture/2026-07-06-timeout-deadline-library.md) — 共有タイミング・ローカル kill 境界。
- [ツール呼び出しタイムアウトポリシー](../../guard/timeout-policy/README.md) — 宣言ツールタイムアウトを強制するコンシューマー。
- [Bash プロバイダー](../../shell/bash-local/README.md) — プロセスグループを kill するフォアグラウンド期限コンシューマー。
- [ファイルシステムサブシステム](../../../docs/subsystems/filesystem.md) — ローカルファイル IO が無期限で実行される理由。

-----

<a id="model-experience"></a>
## モデル体験

間接的に、タイムアウト結果を描画するタイムアウトコンシューマーを通じてである。

#### KV キャッシュへの影響

直接の無効化なし。リクエストプレフィックス変更はタイムアウトコンシューマーが所有する。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


ライブラリが意図的にしないことを定める。これらは現在のパッケージ制約であり、タスク backlog ではない。

- **通知のみ** — 期限は信号を無視する作業を止められない。すべてのケイパビリティは依然として自身のソケット・プロセス・タスク終了パスを要する。
- **`timeoutMs <= 0` は内部語彙** — 所有バックエンドが方針解決した後にのみローカルタイマーを無効化し、公開のモデル・プラグイン向け knobs としては決してない。
- **最初の abort 理由が分類に勝つ** — 上流キャンセルがローカルタイマーに勝つと、この層は自身タイムアウトも満了したはずと後から報告できない。
- **アイドル看視は全体期限ではない** — outstanding 反復子要求ごとに再 armed し、コンシューマー思考時間を意図的に除外する。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
