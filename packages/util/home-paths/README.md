---
description: "DeepSeek Harness ホームと共有エージェント設定ルートの共有解決に加え、ユーザーデータパス、チルダ展開、安定監視パス。"
kind: "package-library"
---

# @deepseek-ai/dsh-home-paths

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`@deepseek-ai/dsh-home-paths` はパッケージ作者がコンシューマーの読む DeepSeek Harness データルートと共有エージェント設定ルートを解決できるようにする。明示パスは環境変数に優先し、環境変数は OS ホーム配下の既定に優先する。空の環境値は無視される。その公開ヘルパーは絶対マシンパスを明かさずにルートを描画し、素または現行ユーザーのチルダ形式のみを展開し、末尾要素がまだ存在しない監視対象を正規化できる。`cordis.yml` 経由ではなく直接ライブラリ依存として使う。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

ユーザーデータの場所についてハーネス残部と一致しなければならないすべての場所でこれらのヘルパーを使う。ホームを 1 回解決し、すべての子パスをそこから導出する。

### ホームの解決

```ts
import { resolveDshHome, dshHomePath, dshCachePath } from '@deepseek-ai/dsh-home-paths'

const home = resolveDshHome()                // configured path, else $DSH_HOME, else ~/.dsh
const settings = dshHomePath('settings')     // join one child onto the resolved home
const cache = dshCachePath('models')         // $DSH_HOME/cache/models, default ~/.dsh/cache/models
```

明示設定パスが最優先であり、次に `$DSH_HOME`、次に既定 `~/.dsh` である。空または空白のみの `$DSH_HOME` は未設定として扱うため、空上書きがホームを現行作業ディレクトリに解決することはない。

`dshCachePath(...segments)` は解決済みホームの `cache` ディレクトリからパスを導出する。区分なしではキャッシュディレクトリ自体を返す。先頭 options オブジェクト `dshCachePath({ dshHome: home }, ...segments)` を渡すと、同一優先順位とチルダ展開で明示設定ホームを使う。ディレクトリを作成せずに絶対パスを返す。

### 共有エージェントルートの解決

```ts
import { resolveAgentsHome, agentsHomeDisplay } from '@deepseek-ai/dsh-home-paths'

const agents = resolveAgentsHome()   // configured path, else $DSH_AGENTS_HOME, else ~/.agents
agentsHomeDisplay(agents)            // ~/.agents, or $DSH_AGENTS_HOME for any configured root
```

`resolveAgentsHome` は `resolveDshHome` と同一の優先順位・空値扱い・チルダ展開を適用する。ルートは他のエージェントツールも共有するため意図的に `$DSH_HOME` の外である。`dsh-agent-instructions` はそのユーザーグローバル `AGENTS.md` を読み、`dsh-skill-filesystem` はその `skills/` ディレクトリを走査する。

### ホームの表示

ユーザー向けパスではマシンパスではなく記号的にルートを描画する。既定ハーネスホームは `~/.dsh`、設定済みハーネスホームは `$DSH_HOME`、既定共有エージェントルートは `~/.agents`、設定済み共有エージェントルートは `$DSH_AGENTS_HOME` と表示する。いずれの表示形式も絶対マシンパスを漏らさない。

### ユーザーパスの展開

`expandHomePath` は先頭 `~`、`~/`、`~\` を OS ホームに対して展開し、他はすべてそのままにする。非チルダパスや `~alice/...` のような名前付きユーザー形式は変更せずに通す。

### 監視パスの正規化

`canonicalizeWatchPath` はネイティブファイルシステム監視器にその対象の正規綴りを 1 件与える。存在する最深祖先を `realpath` で解決し、欠落接尾辞を復元するため、作成前のファイルやディレクトリを監視できる。これにより Windows が通常ファイル祖先を通常の不在として扱うことを防ぎ、ネイティブ監視バックエンドが出す長いパスと 8.3 短名別名の混在を防ぐ。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

このパッケージは 1 原則の上に構築される。ハーネスユーザーデータは 1 ルート配下にあり、共有エージェント設定ルートは他のエージェントツールも読むため別に残る。`resolveRoot` と `rootDisplay` が両ルートの優先順位と表示規則を所有するため、どちらも他から乖離できない。

### ソースマップ

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | ホーム解決、パス結合、表示、チルダ展開、監視パス正規化 |

### 解決規則

`resolveDshHome` は明示上書き、次に `$DSH_HOME` を読み、OS ホームと `.dsh` の結合にフォールバックする。`resolveAgentsHome` は `$DSH_AGENTS_HOME` と `~/.agents` について同一 3 階層を読む。選んだ値はチルダ展開され絶対パスに正規化される。`dshHomePath` は Node の平台パス規則で子区分を結合する。`dshHomeDisplay` と `agentsHomeDisplay` は解決パスを既定ルートと比較して記号ラベルを返すため、設定済みルートは絶対パスを漏らさない。

### 正規化の仕組み

`canonicalizeWatchPath` は対象から上向きに歩いて存在する祖先を見つけ、`realpath` で解決し、列挙可能ディレクトリであることを証明し、欠落接尾辞を復元する。不在以外の誤差は伝播し、ディレクトリでない欠落接尾辞祖先は拒否される。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

ランチャーや単一ホームルートに依存するコンシューマーが必要な場合にこれらのページを読む。

- [Boot パッケージ](../../boot/app-boot/README.md) — プラグインマウントの前にホームを解決するランチャー。
- [シェル環境](../../shell/shell-env/README.md) — `DSH_HOME` がモデルシェル呼び出しにどう届くか。
- [匿名ユーザー id](../../identity/anonymous-user-id/README.md) — 解決済みホーム配下の保存済み同一性ファイル。

-----

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>


ヘルパーが適材でない場合をこれらの制限が定義する。これらはタスクバックログではなく現行パッケージ制約である。

- **展開は意図的に狭い** — 素 `~`、`~/...`、`~\...` のみが現行 OS ホームを使う。`~alice/...` のような名前付きユーザー形式、環境変数、シェル式は変更されないままである。
- **正規化は読み取りのみで変更しない** — `canonicalizeWatchPath` は `realpath` による探索を行い、不在以外の誤差を伝播する。結果パスのディレクトリ作成・権限・信頼ポリシーは依然呼び出し側が所有する。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
