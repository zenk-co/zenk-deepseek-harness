---
description: "ctx.fileReferences 検出の有効化・サイズ調整・デバッグを行うユーザーとメンテナー向けのローカルワークスペース @file 補完プロバイダー。"
kind: "package-reference"
---

# @deepseek-ai/dsh-file-reference-local

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

エージェントと host UI は、各エージェントのローカルワークスペースからの順位付きパスで `@file` 言及を補完できる。大規模リポジトリでも応答性を保つ境界付き検出であり、結果はツール活動後に更新されて補完を阻まず、ディレクトリ symlink を決してたどらない。`read` が利用可能な場合、モデルは参照パス解釈のための安定ガイダンスも受け取る。`read` が Harness host ファイルシステムを使う場合に、このパッケージを選ぶ。リモートや仮想名前空間には一致する検出が必要である。

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

セッションの作業ディレクトリ変更は前ディレクトリの検索索引を破棄する。次の補完は新ディレクトリを検索する。
`@file` 補完が Harness host 自身のファイルシステムを検出すべき場合に、このプロバイダーをマウントする。出荷済み `read` ツールが操作する名前空間である。各エージェントのワークスペースはそのセッションの現作業ディレクトリ起点で索引付けされる。

### プロバイダーの有効化

既定値は典型ワークスペースに適するため、最小マウントに構成は不要である。

```yaml
- name: '@deepseek-ai/dsh-file-reference-local'
  config:
    maxResults: 20
```

### 得られるもの

host UI で `@` を打つと、対象エージェント向けに最大 `maxResults` 件の順位付きパス候補が返る。`/` を含むクエリーは一致ディレクトリのエントリを直接列挙し、素のクエリーは境界付き再帰索引をファジー順位付けする。ディレクトリ候補は末尾スラッシュ付きで言及を開いたままにする。ツール結果の後はいずれもエージェントの索引が古いと印付けられる。次のクエリーは依然としてそれから答え、置換はバックグラウンドで構築されるため、再構築がキャレットの前に座ることはない。

### 構成

| フィールド | 既定値 | 意味 |
|---|---|---|
| `maxResults` | `20` | 1 クエリーに返す最大順位付き候補数 |
| `maxEntries` | `50000` | エージェントワークスペースごとに索引付ける最大ファイル・ディレクトリ数 |
| `excludedDirectories` | `['.git', 'node_modules', 'dist', 'build', 'out', 'coverage', 'target', '.next', '.nuxt', '.turbo', '.venv', '__pycache__', '.pytest_cache', '.mypy_cache', '.gradle']` | 走査と候補から省くディレクトリ基底名 |

すべての数値は正の安全整数でなければならず、除外名はすべて `/` や `\` を含まない空でない基底名でなければならない。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックして展開</summary>

このセクションではプロバイダーの設計を説明する。観察可能な動作は[このパッケージを使う](#use-this-package)で扱う。

### 設計概念

プロバイダーはエージェントごとに再利用可能 `WorkspaceFileSearch` を 1 件維持し、そのセッションの `cwd` を根とする。ディレクトリスコープクエリー（`a/b/...`）はライブディレクトリ状態を列挙し、素のファジークエリーは 1 つの境界付き再帰走査を共有する。走査を待つのはワークスペースの最初の素クエリーだけである。`tool/result` イベントは決着済みエントリを古いと印付け、次の素クエリーはそれらに仕えながら置換を構築する。モデルガイダンスは、対象エージェントが `read` ツールを持つ間のみ寄与されるエージェントごとのプロンプト節である。生成はプロンプト導入を待ち、失敗時はロールバックし、エージェント破棄は索引とプロンプトファイバーの両方を解放する。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | `LocalFileReferenceService`: 構成検証、エージェントごと検索、プロンプト導入 |
| [`src/search.ts`](src/search.ts) | `WorkspaceFileSearch`: 走査、順位付け、除外、古さとバックグラウンド再構築 |

### 主な流れ

`list(agent, query, signal)` 呼び出しは 1 ディレクトリのエントリを列挙するか、共有境界付き索引を読み、候補を順位付けし（完全・接頭辞・部分文字列・次に部分列スコアとディレクトリボーナス）、確定的順序で最大 `maxResults` 件返す。`tool/result` イベントは対象エージェントの索引を古いと印付け、後の素クエリーが新しいツリーを観察する。読めないまたは除外サブツリーは候補を寄与せず、読めないルートは走査を失敗させる。一時的失敗が良好な既存エントリを空索引で置換してはならない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

パッケージレベルの契約では足りないときに、これらのページを読む。このプロバイダーが実装するシームから、その候補が指すツールへと進む。

- [ファイル参照シーム](../file-reference/README.md) — このプロバイダーが実装するサービス契約と `@file` 文法。
- [セッション参照サブシステム](../../../docs/subsystems/session-reference.md) — host UI 背後の共有ファイル参照契約。
- [ファイルシステムツールカタログ](../../../docs/tool-catalog.md#deepseek-aidsh-tool-fs) — 検出が一致しなければならない `read` ツールの名前空間。
- [Context グループマップ](../README.md) — 兄弟リクエストコンテキストパッケージ。

-----

<a id="model-experience"></a>
## モデル体験

### read 利用可能時のファイル参照ガイダンス

#### モデルが見るもの

対象エージェントが実効 `read` ツールを持つ場合、プロバイダーはこの安定したシステムプロンプト節を寄与する。

##### ファイル参照指示

```markdown
Tokens prefixed with @ are paths the user explicitly referenced. Relative paths resolve from the workspace root; absolute paths identify files or directories on the host. A trailing slash marks a directory: list it when its contents matter. Anything else is a file: use the read tool when its contents are needed, and do not claim to have inspected it before reading. @"..." quotes a path containing spaces.
```

#### トークンへの影響

条件付きかつ固定である。1 文は対象エージェントに `read` が可視の間存在する。候補検索自体はトークンを追加せず、選択パスは通常のユーザーメッセージ文字のみ寄与する。

#### KV キャッシュへの影響

安定した文はシステムプロンプトプレフィックスに加わる。このプロバイダーのマウント・除去や `read` 可視の変更はそのプレフィックスを変える。クエリー・候補・索引の古さは変えない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


プロバイダーが不向きな場合を定める。これらは現在のパッケージ制約である。

- **Host ローカル名前空間** — プロバイダーは Harness host ファイルシステムを走査するため、リモートや仮想 `read` 実装には名前空間が一致するプロバイダーが必要である。
- **境界付き助言索引** — 非常に大きなワークスペースは `maxEntries` 後にパスを省くことがあり、除外または読めないディレクトリは現れない。既定除外はエコシステムがソースにも使うビルド出力だけを名指しし、`lib` は意図的に含まれない。そこへビルドするワークスペースは `excludedDirectories` 経由でその名前を追加する。
- **古さの 1 回の無効化** — ツール結果直後の素クエリーは前回走査時点のツリーを反映し、次のクエリーは再構築を見る。
- **ignore ファイル意味なし** — `.gitignore` や他のプロジェクト ignore ファイルは検出に影響せず、構成済みディレクトリ基底名のみ除外される。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
