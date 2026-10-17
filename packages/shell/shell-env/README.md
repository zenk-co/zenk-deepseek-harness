---
description: "すべてのモデルシェル呼び出しが実行される環境を選択・設定・拡張するユーザーとメンテナー向けの、管理された DSH_* シェル環境。"
kind: "package-reference"
---

# @deepseek-ai/dsh-shell-env

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-shell-env` は、すべてのモデルシェル呼び出し — bash または pwsh — が実行される信頼された `DSH_*` 環境を提供する: `DSH_HOME`、`DSH_SHELL=1`、エージェントの `DSH_SESSION_ID`、起動されたプロファイルの `DSH_PROFILE` と `DSH_PROFILE_DIR` といった組み込みファクトである。プラグイン作者は宣言されたキーを持つ独自のファクトを登録でき、それらは実行ごとに収集され、プラグインとともに破棄される。重複する所有権や未宣言の実行時キーは、黙って上書きするのではなく大きく失敗する。このレジストリはモデルが見る他の何も変えない — シェルツールが自身のスキーマとプロンプトを所有する。モデルシェルツールをマウントするあらゆるコンポジションでこれを選ぶ。設定が選ぶのは Harness ホームディレクトリのみである。

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

モデルシェルツール（`dsh-tool-bash` または `dsh-tool-pwsh`）をマウントするあらゆるコンポジションでこのプラグインをロードする: すると各フォアグラウンドまたはバックグラウンドのシェル呼び出しが、プロセスが継承した `DSH_*` 値ではなく、新しく収集された管理環境で実行される。

### すべてのシェル呼び出しが受け取るもの

すべての呼び出しが `DSH_HOME`（Harness ホームの絶対パス）、`DSH_SHELL=1`、およびエージェント呼び出しでは `DSH_SESSION_ID`（呼び出しているセッションの id）を受け取る。ランチャーがプロファイルコンテキストを提供した場合、すべての呼び出しは `DSH_PROFILE`（プロファイル名）と `DSH_PROFILE_DIR`（その絶対ディレクトリ。その `node_modules` はプロファイルでインストールされたパッケージのみを保持し、ハーネス自身のバンドルは dsh インストールから解決される）も受け取る。プロファイルなしで起動されたコンポジションは両方とも省略する。

### 独自の環境ファクトを追加する

他のプラグインは、安定した名前、返しうる `DSH_*` キーの完全な集合、キーごとの説明、および 1 回の実行の値を計算するリゾルバーを持つコントリビューターを登録することでファクトを提供する:

```ts
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-shell-env'

export const inject = ['shellEnv']

export function apply(ctx: Context): void {
  ctx.shellEnv.register({
    name: 'deployment-region',
    variables: { DSH_DEPLOYMENT_REGION: { description: 'Current deployment region.' } },
    resolve: execution => execution.agent === undefined ? {} : { DSH_DEPLOYMENT_REGION: 'cn-north' },
  })
}
```

コントリビューターは返すすべてのキーを宣言しなければならない。未宣言または非文字列の値を返すと呼び出しは失敗する。登録は登録したプラグインとともに破棄されるため、プラグインのホットリロードはそのファクトを除去する。

### Harness ホームの選択

単一の設定フィールドが `DSH_HOME` として公開されるホームディレクトリを選ぶ。デフォルトの解決順序は `dshHome` 設定、次に環境の `$DSH_HOME`、次に `~/.dsh` である。

| フィールド | デフォルト | 意味 |
|---|---|---|
| `dshHome` | `$DSH_HOME`、次に `~/.dsh` | `DSH_HOME` として公開される Harness ホームの絶対パス |

生成される [設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-shell-env) が、受け付けられるすべてのフィールドとその JSDoc の網羅的な情報源である。

### 何がうまくいかないことがあるか

2 つのコントリビューターが同じキーを宣言する、またはコントリビューターが予約済みの組み込み（`DSH_HOME`、`DSH_SHELL`、`DSH_SESSION_ID`、`DSH_PROFILE`、`DSH_PROFILE_DIR`）を主張すると、プラグインのロードが大きく失敗する。`DSH_*` キーはアンダースコア付きのすべて大文字（たとえば `DSH_REGION`）でなければならず、説明の欠落は登録を失敗させる。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このセクションではレジストリ背後の設計判断を説明し、それを実現するコードを指し示す。観察可能な動作は[このパッケージを使う](#use-this-package)で完全に扱う。

### 設計哲学

- **信頼された名前空間、呼び出しごとに再構築。** 環境は Harness 所有の `DSH_*` 名前空間である: シェルエグゼキューターは継承された `DSH_*` 値を破棄し、実行ごとにレジストリの現在のスナップショットをマージするため、ネストしたハーネスと並行する親/子エージェントが古いアイデンティティを漏らすことはできず、`process.env` が変更されることも決してない。
- **宣言された所有権、大きな競合。** コントリビューターはキーを事前に宣言するため、重複する所有権は最初のコマンドの前に検出される。リゾルバーは宣言されたキーしか返せない。
- **組み込みはここにとどまる。** `DSH_HOME`、`DSH_SHELL`、`DSH_SESSION_ID`、`DSH_PROFILE`、`DSH_PROFILE_DIR` はレジストリのために予約されており、コントリビューターはそれらを主張できない。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | プラグインエントリー、`ShellEnvRegistry` サービス、組み込みファクト |

### 収集

`collect(execution)` は組み込みから始め、実行がエージェントを運ぶときはセッション id を加え、その後、登録された各コントリビューターの解決済み値をコントリビューター名でソートしてマージする。結果は凍結されたキーソート済みスナップショットであり、`ShellExecRequest.dshEnv` を通じて渡される。`list()` はリゾルバーを実行せずに宣言を列挙するため、実行依存の値を反映できない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では不十分なときにこれらのページを読む。シェルファミリーからエグゼキューターのシームと生成カタログへと進む。

- [shell パッケージマップ](../README.md) — bash ケイパビリティファミリーとその役割。
- [Bash エグゼキューターサブシステム](../../../docs/subsystems/shell.md) — ツールが実行を通す `ctx.shell` シーム。
- [tool-bash](../tool-bash/README.md) — この環境を消費する bash ツール。
- [tool-pwsh](../tool-pwsh/README.md) — この環境を消費する pwsh ツール。
- [home paths パッケージ](../../util/home-paths/README.md) — `DSH_HOME` の解決方法。
- [生成される設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-shell-env) — 受け付けられるすべての設定フィールドとそのソース宣言。

-----

<a id="model-experience"></a>
## モデル体験

間接的に、シェルツール（`dsh-tool-bash`、`dsh-tool-pwsh`）を通じて。これらがすべてのシェルツール呼び出しでこのレジストリの管理された `DSH_*` ファクトを公開する。

#### KV キャッシュへの影響

管理環境は決してリクエストプレフィックスに入らないため、プロバイダーのキャッシュ再利用を無効化しない。プレフィックスの変更を所有するのはシェルツールの定義と現在のリクエストエンベロープである。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、レジストリが不向きになる、または注意を要する状況を定義する。これらは現在のパッケージ制約であり、タスクバックログではない。

- **`list()` はプラグインがコントリビュートした変数のみを列挙する** — レジストリ所有の組み込み（`DSH_HOME`、`DSH_SHELL`、`DSH_SESSION_ID`、`DSH_PROFILE`、`DSH_PROFILE_DIR`）は含まれないため、診断、プロンプト、UI のコードは `list()` を網羅的な環境カタログとして扱ってはならない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
