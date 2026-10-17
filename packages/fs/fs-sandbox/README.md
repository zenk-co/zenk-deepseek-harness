---
description: "セッションワークスペースにモデルのファイル変更を閉じ込めるデプロイとメンテナー向けのサンドボックス強制 ctx.fs バックエンド。"
kind: "package-reference"
---

# @deepseek-ai/dsh-fs-sandbox

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-fs-sandbox` は、各セッションのサンドボックスモードに従ってモデルのファイル書き込みと編集を閉じ込め、ローカルファイルシステムの読み取り動作を保つ。`read-only` ではすべての変更を拒み、`workspace-write` ではセッションワークスペース内またはプラットフォーム一時ルート内の対象だけを許し、`danger-full-access` では変更を制限しない。セッションにワークスペース閉じ込めファイル変更が必要な場合、`ctx.sandboxPolicy` と共に `fs-local` の代わりに使う。拒否された操作は `FS_SANDBOX_DENIED` を返し、ファイルシステムツールは有効モードと同ターンエスカレーションヒントと共に提示する。

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

モデルのファイル書き込みと編集をセッションのサンドボックスモードで閉じ込めなければならず、読み取りは閉じ込めないままにする場合に、このバックエンドを `fs-local` の代わりにマウントする。柵は呼び出しごとに適用される。ツール層は呼び出しセッションのモードとワークスペースルートを bash ランナーが受け取るものと同じポリシーへ解決するため、ファイルシステムとシェルファミリーが異なるルートに閉じ込めることはない。

### 最小構成

共有ポリシーサービス、次にこのバックエンド、次にツールを読み込む。編集前読み取りポリシープラグインは任意のままである。

```yaml
- name: '@deepseek-ai/dsh-sandbox-policy'
- name: '@deepseek-ai/dsh-fs-sandbox'
  config:
    cwd: /absolute/path/to/workspace
- name: '@deepseek-ai/dsh-tool-fs'
```

バックエンド構成はローカルバックエンドから不変である（`cwd` 解決既定と `diffBasisMaxBytes` 上書き上限）。[構成カタログ](../../../docs/config-catalog.md#deepseek-aidsh-fs-sandbox)が網羅的ソースである。

### 柵の振る舞い

実効モードは呼び出しセッションの上書きまたはエスカレーション付与から得られ、いずれも有効でない場合はデプロイ既定にフォールバックする。`read-only` は構造化 `FS_SANDBOX_DENIED` ですべての変更を拒む。`workspace-write` は対象がワークスペースルートまたはプラットフォーム一時領域（`/tmp`、`os.tmpdir()`）下に正規化される場合にのみ変更を許す。これは Seatbelt プロファイルが付与するものと同じ書き込み可能集合である。`danger-full-access` は柵なしに委譲する。

### 観察可能な成功と失敗

読み取り、一覧、メタデータ、読み取り専用 watch は `fs-local` とまったく同じく動く。変更柵は観察を制限しない。拒否された変更は実効モードを運ぶ `FS_SANDBOX_DENIED` エラーを返す。ツール経由ではモデルに `[sandbox: file access denied under <mode> mode]` と 1 回承認広域再試行ヒントが見え、bash 拒否と同一である。承認済みエスカレーションを持つセッションは同じ操作をその 1 呼び出しに限り厳密に広いモードで再試行できる。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションではサンドボックスバックエンドの背後にある設計判断を説明し、それを実現するコードを示す。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱う。

### 設計概念

柵はモデル制御パスに対する信頼コード内のポリシーチェックであり、カーネル境界ではない。操作はシーム自身のもの（open、rename）であり、信頼できないのは対象パスだけなので、正規化して閉じ込めることがこの面への完全な答えである。信頼できないコードのカーネル級隔離は `ctx.shell` の仕事であり続ける。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | `SandboxedFileSystem`: `writeText`/`editText` 上のモード柵、`sandboxMode` ファクト |
| [`src/containment.ts`](src/containment.ts) | 字句高速パスと identity ベースフォールバックによる祖先包含検査 |

### 変更が柵付けされる仕組み

各変更は呼び出しごとのポリシーを解決する（`danger-full-access` は呼び出し元対象をそのまま返し、`read-only` は `FS_SANDBOX_DENIED` を throw する）。次に `workspace-write` 向けに対象をただちに再正規化し、単一 `writableRoots` 関数から導出された書き込み可能ルートのいずれか下への包含を要求する。これは Seatbelt プロファイルが付与するものと同じ集合であり、fs 柵と bash ランナーは乖離できない。変更されるのは新しい対象であり、ツールが解決してから交換された symlink 祖先は捕捉される。

### 脅威モデル

解決から syscall までの残存 TOCTOU は書き込み直前の再正規化により狭められ、この脅威モデルでは受容される。カーネルタイトな境界には移植コストに見合わない `openat2` 級プリミティブが必要になる。拒否は stderr 推論ではなく構造化 `FsError` であり、インプロセス柵は何を拒んだか正確に知っている。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときに、これらのページを読む。このバックエンドから共有ポリシーの home と閉じ込め決定の背後へと進む。

- [ファイルシステムサブシステム](../../../docs/subsystems/filesystem.md) — 網羅的プロバイダー契約、ポリシーイベント、エラー分類。
- [dsh-fs](../fs/README.md) — このバックエンドが実装する `ctx.fs` 契約。
- [fs-local](../fs-local/README.md) — これが拡張するローカルバックエンド。
- [sandbox-policy](../../sandbox/sandbox-policy/README.md) — このバックエンドが要求する共有セッションごとポリシー解決。
- [プロセスサンドボックスサブシステム](../../../docs/subsystems/sandbox.md) — モード、呼び出しごとポリシー、fail-closed エラー。
- [横断ファミリー fs サンドボックスリファレンス](../../sandbox/sandbox-policy/README.md) — 共有モード柵とそのエスカレーション振付。

-----

<a id="model-experience"></a>
## モデル体験

### ファイルシステムポリシーと拒否

#### モデルが見るもの

ポリシー所有者はケイパビリティ中立の `sandbox:policy` コンテキストを寄与する。間接的に、`dsh-tool-fs` はこのバックエンドの `FS_SANDBOX_DENIED` 拒否を `[sandbox: file access denied under <mode> mode]` 印と同ターンエスカレーションヒント付きで描画する。

#### トークンへの影響

このバックエンドのマウント中、現ポリシー節が小さなランタイムコンテキストメッセージを追加する。拒否は境界付き印とエスカレーションヒントを会話履歴に追加する。

#### KV キャッシュへの影響

常設ポリシー変更は、保持履歴の後に所有者描画の置換ランタイムコンテキストスナップショットを追記する。操作結果は追記のみのままである。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


サンドボックスバックエンドが不向きな場合や特別な運用注意が必要な場合を定める。これらは現在のパッケージ制約であり、一般サンドボックス比較やタスク backlog ではない。

- **カーネル境界ではなくポリシー柵** — 検査はモデル制御パスに対する信頼コードであり、解決から syscall までの残存 TOCTOU は（その場の再正規化により）狭められるが除去されない。敵対 host プロセスは範囲外である。信頼できないコードのカーネル級隔離は `ctx.shell` のままである。
- **柵対ランナー等価は 1 所有者から導出される** — 書き込み可能集合は Seatbelt プロファイルと共有の `writableRoots` から得られる。他所で自身の書き込み可能集合を定義するランナープロファイルは乖離する。
- **`ctx.sandboxPolicy` を要求する** — ツールは各セッション方針解決に使い、バックエンドはエージェントレス呼び出しフォールバックに使う。それが構成されていないとバックエンドは閉じ込めない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
