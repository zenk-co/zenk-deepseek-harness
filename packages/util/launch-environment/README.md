---
description: "フラット化された process.env を信頼せず、ユーザー向けの値を解決する必要があるパッケージのための、この実行の環境の不変スナップショット。各値がどの層から供給されたかを記憶する。"
kind: "package-library"
---

# @deepseek-ai/dsh-launch-environment

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`@deepseek-ai/dsh-launch-environment` を使うと、フラット化された `process.env` を信頼せずに起動時の環境値を解決できる。継承されたプロセス値、起動ディレクトリの `.env`、Harness ホームの `.env` を凍結し、固定の信頼順序で勝者の値とその出所を返す。呼び出し元は機密性の高い検索のために層を除外できる。除外された層は後の順序変更に関わらず到達不能のままである。スナップショットは不変だが、すべての層は依然として `process.env` にコピーされるため、サブプロセスを隔離しない。ライブラリとしてインポートすること。`cordis.yml` からはマウントできない。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

層が等しく信頼できない場合は常に、`process.env` の代わりにスナップショットを通じてユーザー向けの値を解決する。たとえば呼び出し元がプロジェクトディレクトリから決して取得してはならない認証情報の上書きなどである。

### 値の解決

```ts
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'

declare const ctx: import('@deepseek-ai/cordis').Context
const endpoint = launchEnvironmentOf(ctx).get('DEEPSEEK_BASE_URL')?.value
```

`get(name)` はすべての層を最も信頼度の高い順に検索する。`getFrom(name, sources)` はその信頼順序を変えずに指定された層のみを検索する。ある層を決して受け入れてはならない呼び出し元はそれをリストから外すため、将来の並べ替えでそれが復活することはない。

`launchedThroughSsh(snapshot)` は、継承されたプロセス層に空でない `SSH_CONNECTION` または `SSH_TTY` がある場合にのみ true を返す。Web ブラウザーハンドオフ、アダプティブディレクトリピッカー、Open In はこの述語を共有する。プロジェクトとユーザーの `.env` 値が SSH セッションを確立することはない。

### 層の優先順位

| 層 | 内容 |
|---|---|
| 継承されたプロセス環境 | 起動シェル、CI ジョブ、コンテナーが渡したもの。この実行の明示的な意図 |
| `<invocation cwd>/.env` | ハーネスを起動したプロジェクト。製品がそのエージェントを構成することを信頼する |
| `$DSH_HOME/.env` | ユーザー自身のマシンレベルの既定値 |

名前はプラットフォームの照合方式に従う。POSIX では完全一致、Windows では大文字小文字を区別しない。Windows で大文字小文字を区別する検索を行うと誤った層が優先される。シェルの `deepseek_api_key` とプロジェクト `.env` の `DEEPSEEK_API_KEY` は OS にとって 1 つの変数である。

### ランチャーがツリーを起動していない場合

`launchEnvironmentOf(ctx)` は、製品 CLI がツリーを起動した場合はランチャーのスナップショットを返し、そうでない場合は継承された環境を唯一の層として返す。このフォールバックで規則が弱まることはない。SDK ホストや素の `cordis.yml` はファイルを検出しないため、持っているものは起動時の環境だけである。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

スナップショットは 1 つの分離の上に構築される。どのファイルが存在するかはランチャーが所有し、値の順位付けはスナップショットが所有する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | `createLaunchEnvironmentSnapshot`、`launchEnvironmentOf`、および `ctx.launchEnvironment` スロット |

### スナップショットが不変に保たれる仕組み

`createLaunchEnvironmentSnapshot` は構築時に各層の値をコピーするため、後からソースオブジェクトを変更してもスナップショットは変わらない。検索は構築順序に関わらず正規の信頼順序をたどる。Windows では格納前に名前が大文字に折りたたまれるため、大文字小文字の違いで優先順位が分裂しない。

### 除外の意味

`getFrom` は正規の順序で絞り込み、呼び出し元のリスト順序では絞り込まない。層を除外することは拒否である。その呼び出しを通じて値は到達不能になり、これが特定の決定に層を決して影響させてはならない場合に呼び出し元が使う仕組みである。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

スナップショットを構築するランチャーや、それを通じて解決するコンシューマーが必要な場合に以下のページを読む。

- [Boot パッケージ](../../boot/app-boot/README.md) — 設定エントリーのマウント前に `ctx.launchEnvironment` を設定するランチャー。
- [認証情報ストア](../../credentials/credentials-local/README.md) — 格納された認証情報をスナップショットの層に対して解決する。
- [DeepSeek プロバイダー](../../llm/llm-deepseek/README.md) — 起動環境を通じてプロバイダー設定を読み取る。

-----

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は、スナップショットがセキュリティ境界にならない場合を定義する。これらは現在のパッケージの制約であり、タスクバックログではない。

- **スナップショットはサブプロセス境界ではない** — すべての層は `process.env` にも実体化されるため、通常のプロジェクト変数は [`dsh-subprocess`](../../subprocess/subprocess/README.md) のスクラブの下で子プロセスに到達する。製品ランチャーの [`.env` 契約](../../boot/app-boot/README.md) は実体化前にブートストラップ変数を拒否する。
- **ワークスペースごとの層はない** — プロジェクト層は起動時の起動ディレクトリに固定される。Web UI で後から選択されたワークスペースは何も寄与しない。これは意図的であり、それに従うとモデルのワークスペース自身がセッション途中でハーネス環境を変更できてしまうためである。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
