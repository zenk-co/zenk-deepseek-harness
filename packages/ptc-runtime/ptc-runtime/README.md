---
description: "抽象 PTC 実行シーム（`ctx.ptcRuntime`）。Host 提供のバインディングに対してモデルが書いた 1 つのプログラムを実行するバックエンドをコンポーズ・消費・構築するユーザーとメンテナー向け。"
kind: "package-reference"
---

# @deepseek-ai/dsh-ptc-runtime

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-ptc-runtime` は、モデルプログラムを Host 提供の非同期関数に対して実行するために使う。リクエストはロスレス JSON、キャプチャされたログ、または構造化された失敗を返す。拒否されたプロミスは呼び出し元の誤用を示す。プロバイダーは異なる状態オーナーを隔離し、ソースが非同期関数本体か REPL 文かを宣言する。プロバイダーは明示的なオーナーのためにメモリを解放まで保持してよいが、そのメモリを Session から復元することは決してない。言語と隔離の記述子は構文と実行基盤を識別するものであり、セキュリティ保証ではない。

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

モデルが書いたプログラムを実行するデプロイをコンポーズする場合、`ctx.ptcRuntime` を直接消費する場合、またはプログラムを実行するバックエンドを構築する場合にこのパッケージを選ぶ。`dsh-tools` の PTC モードはツールプログラムのためにこれを使い、`dsh-workflow-ptc` はワークフローオーケストレーションのためにこれを使う。各コンシューマーは自身のモデルへ返す内容を所有する。

### プログラムを実行する

プログラムとバインディング名前空間を伴って `resolve(request)` に続けて `run(spec)` を呼ぶ。解決は cwd、タイムアウト、サンドボックスの選択を検証し、プロバイダーのデフォルトを適用する。`programFormat` はトップレベルの `await` と `return` を持つ非同期関数本体か、トップレベルの宣言、`await`、最終式を持つ REPL 文を選択する。ロスレス JSON の完了は `result.value` になり、テキストは `result.logs` になり、失敗は `result.error` になる。

```text
const spec = ctx.ptcRuntime.resolve({
  program: 'return await tools.add({ a: 1, b: 2 })',
  bindings: [{ global: 'tools', functions: { add: async (args) => args.a + args.b } }],
})
const result = await ctx.ptcRuntime.run(spec)
// result.value === 3
```

### バックエンドを選ぶ

バックエンドは `language` と `isolation` を診断記述子として公開する。どちらも権限を与えたり隔離を証明したりしない。[`dsh-ptc-runtime-node`](../ptc-runtime-node/README.md) は、解決されたサンドボックスポリシーの下で新しい管理対象 Node プロセスで消去可能 TypeScript を実行する。プライベートな [`dsh-experimental-ptc-runtime-python`](../../experimental/ptc-runtime-python/README.md) プロバイダーはファイル隔離なしで新しい CPython サブプロセスで Python を実行する。`sandboxMode` はプロバイダーのデプロイファイルポリシーモードを通知するか、そのケイパビリティがサポートされていない場合は存在しない。

オプションの [Node インメモリモード](../ptc-runtime-node/README.md#persistent-repl)では、実行をまたいで同じ `stateOwner` オブジェクトを渡し、オーナーの終了時に `release(owner)` を待つ。異なるオブジェクトアイデンティティが環境を共有することは決してなく、オーナーを省略した場合は一時的な環境を使う。ステートレスなプロバイダーは所有権を無視する。1 つの保持されたオーナーに対する呼び出しは重複してはならない。

### バインディングにポータブルな名前を付ける

バインディンググローバルとエラークラスの名前は言語ポータブルである: `[A-Za-z_][A-Za-z0-9_]*` に一致し、すべてのポータブルなターゲット言語の予約語を避け、バックエンド所有のスロットを避けなければならないため、1 つの名前空間リストがすべてのバックエンドに対して有効である。`$tools`、`lambda`、`console` のような名前は実行が始まる前に失敗させる。正確な除外セットはシーム契約の一部である。

### 何がうまくいかなくなりうるか

失敗は直交する `kind` を伴う `result.error` として到着する: `exception`、`timeout`、`abort`、`worker-exit`、`invalid-output`、`output-limit`、`protocol`、`sandbox-unavailable`。プロバイダーは成功または失敗とは別に、該当する `result.sandbox` ファクトを返す。無効またはサポートされていない実行オプションは `resolve` 中に失敗し、`run` は未解決の入力、無効なバインディング名、破棄後の呼び出しなど、呼び出し元の誤用を拒否する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションではシームの背後にある設計を説明する。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱う。

### 設計概念

このパッケージは PTC 実行ケイパビリティシーム（[ケイパビリティシーム](../../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.md)）の Service Definition の役割である: `ctx.ptcRuntime` として登録される抽象 `PtcRuntime extends Service` と、プロバイダーとコンシューマーが共有する語彙から成る。プロバイダーは `PtcRuntime` を継承し、`resolve` と `run` を実装し、サービスを登録する。`dsh-tools` の PTC モードがツールバインディングを所有し、`dsh-workflow-ptc` がワークフローフックと子エージェントを所有する。ランタイムは契約上ツールとセッションに無知なままである: プログラム、名前付き非同期バインディング、解決済み実行オプションを受け取り、キャプチャされた出力、結果、該当するサンドボックスファクトを返す。

### サービス API

読み取り専用の `timeout` 記述子は、コンシューマーの表示のために数値の `{ defaultMs, maxMs }` を公開する。記述子が存在しない場合は数値による上書きがサポートされていないことを意味する。省略された `timeoutMs` はプロバイダーのデフォルトを選択し、数値は検証され上限付きの経過予算を要求し、明示的な `null` は経過時間デッドラインなしを要求する。プロバイダーはサポートしない選択を拒否する。Node ワークフローアダプターは `null` を要求する一方、モデル向けの `run_code` ツールは正の数値による上書きのみを受け付ける。

`executionInstructions` はプロバイダー所有の使用ガイダンスを提供するか、不要な場合は空文字列を提供する。コンシューマーはその言語や隔離記述子からプロバイダーを特定することなく、プログラムの表示にそれを含めることができる。PTC はログに記録される `run_code` スキーマにそれを含める。

`resolve(request)` はサポートされるオプションの検証とデプロイのデフォルト適用を所有する。`run(spec)` は完全な入力を受け取って実行し、クリーンアップの後にプログラムの結果を解決する。言語と基盤の記述子は表示を導き、`sandboxMode` はコンシューマーが解決済みファイルポリシーを渡せるかどうかを示す。記述子もプログラムの成功結果も、バックエンドが報告するエンフォースメントファクトの代わりにはならない。

網羅的なセマンティクスは [PTC ランタイムサブシステムリファレンス](../../../docs/subsystems/ptc-runtime.md)にあり、正確なシグネチャは [`src/index.ts`](src/index.ts) にある。

### 語彙

`PtcRunRequest` はプログラム、Host バインディング、キャンセル、任意の実行選択を運ぶ。`PtcRunSpec` は解決された cwd と、明示的な数値または null のデッドライン選択を要求する。`PtcBindingNamespace` はプログラムグローバルと任意の型付き拒否コンストラクターを宣言する。`PtcRunResult` はログ/値、失敗、`PtcRunSandbox` ファクトを分離する。正確なフィールドとプロバイダーの義務は [`src/types.ts`](src/types.ts) にある。

### ポータブルな識別子

バインディンググローバルとエラークラスの名前は言語ポータブルである: 識別子のサブセット `[A-Za-z_][A-Za-z0-9_]*` に一致し（JS 専用の `$` は不可）、シームがエクスポートする除外セットを通過しなければならないため、1 つの `bindings` リストがすべてのバックエンドに対して有効である。このパッケージはすべてのバックエンドが強制する契約 — `PORTABLE_RESERVED_WORDS`（ECMAScript ∪ Python の予約語）、`RESERVED_BINDING_GLOBALS`（`console` や `__dsh_main__` のようなバックエンド所有グローバル）、`RESERVED_ERROR_MEMBERS` と `DUNDER_MEMBER`（エラーメンバーの除外） — をエクスポートするため、`$tools`、`lambda`、`__dsh_main__` のような名前はどのバックエンドでもシームの誤用として `run()` を拒否させる。正確なセットは `src/index.ts` を参照。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー: 抽象 `PtcRuntime` サービスとポータブル識別子の除外セット |
| [`src/types.ts`](src/types.ts) | 語彙: `PtcRunRequest`、`PtcRunSpec`、バインディング、結果、失敗、サンドボックスファクト |

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では不十分なときにこれらを読む。PTC モードのコンシューマーからバックエンドとケイパビリティシームのモデルへと進む。

- [PTC モード Agent Note](../../../.agents/notes/implemented/feature/2026-06-15-ptc.md) — ツールレジストリが `ctx.ptcRuntime` をどう消費し、`run_code` をモデルにどう提示するか。
- [Node プロセスバックエンド](../ptc-runtime-node/README.md) — 出荷される TypeScript 実行バックエンド。
- [実験的 Python バックエンド](../../experimental/ptc-runtime-python/README.md) — プライベートな CPython サブプロセスプロバイダーとその fd-3 プロトコル。
- [PTC ランタイムサブシステムリファレンス](../../../docs/subsystems/ptc-runtime.md) — リクエスト/結果の語彙、バインディング、`ctx.ptcRuntime` の Cordis サーフェス。
- [ケイパビリティシーム](../../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.md) — Service Definition / Service Provider / Consumer の分割。

-----

<a id="model-experience"></a>
## モデル体験

間接的に、`dsh-tools` の PTC モードとワークフローアダプターを通じて。これらはプログラムの結果を自身のツール結果として提示する。

#### KV キャッシュへの影響

直接の無効化はない。名前指しされたコンシューマーがリクエストプレフィックスの変更を所有する。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、シームができないことを定義する。これらは現在のパッケージ制約であり、タスクバックログではない。

- **`run()` はワンショットである** — `logs` は解決された `PtcRunResult` にのみ到着する。シームはライブプログラムの出力のためのストリーミングログや進捗の API を公開しない。
- **保持されたメモリは破棄可能である**: プロバイダーは明示的なオーナーのために状態を保ってよいが、再起動、解放、プロバイダー固有の失敗はそれを破棄する。プログラム、バインディング呼び出し、結果はコンシューマーによってログに記録されたままである。ライブオブジェクトはシリアライズもリプレイもされない。
- **プロバイダーは異なる隔離ケイパビリティを持つ** — 出荷される Node プロバイダーは解決されたファイルポリシーを強制する一方、プライベートな実験的 Python プロバイダーは明示的なポリシーを拒否する。コンテナプロバイダーは提供されていない。
- **プロバイダー間で統一されたバインディングのバイト上限はない** — 各プロバイダーが自身のトランスポート制限を所有する。バインディングは結果がその制限に達する前にメモリを確保できる。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

この開発者ノートはメンテナー向けの作業コンテキストである: 未決定の方向性と未解決の疑問。これは明示的に非権威である — 出荷される動作と制限は上記のセクションとパッケージコードにある。

#### 保持状態

保持状態にはディスクチェックポイントも復元プロトコルもない。コンシューマーはその損失を許容し、モデル可視のプログラムと結果のみを Session ログに保持しなければならない。

#### 将来: コンテナバックエンド

コンテナクラスのバックエンドは、コードとシェル実行の両方にハードなマルチテナント境界を提供するだろう。よく知られた `isolation` の値以外に決まっていることは何もない。

</details>
