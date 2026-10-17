---
description: "呼び出しセッションのファイルポリシー下で保持 Git worktree を作成して入る。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-worktree

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

ローカルコミットから分離 checkout を作成し、同一セッションでその中に続ける。各操作は新しい名前付き分岐を作成し、ソース checkout はそのまま残す。既存サンドボックスがすべての書き込みを統治する。checkout を離れてもそのファイルと分岐は保持される。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

`workingDirectory`、`fs`、`subprocess`、`sandbox`、`sandboxPolicy` プロバイダーのそばにサービスをマウントする。モデルが操作を必要とする場合にツールパッケージを追加する。

```yaml
- name: '@deepseek-ai/dsh-experimental-worktree'
- name: '@deepseek-ai/dsh-experimental-tool-worktree'
```

`ctx.worktrees.create(agent, { name?, from? }, signal?)` は新しい分岐と checkout を作成し、`ctx.workingDirectory.set` 経由で正規 checkout ディレクトリに入る。`from` は作成前にローカルコミットに解決し、既定は `HEAD` である。段階・非段階・追跡外・無視のソースファイルは複写されない。`baseCommit` は解決済みコミットオブジェクト名を報告する。リポジトリローカル置換参照は checkout 内容に依然適用される。Checkout はリポジトリ設定を変更せずに設定済み Git clean・smudge・プロセス filter を無効化する。既存分岐や checkout パスは誤差である。返却レコードは `path`、`branch`、`baseCommit`、`repositoryRoot` を含む。

既定 checkout ディレクトリは `<現行 checkout ルート>/.agents/worktrees/<name>` である。返却 `repositoryRoot` は呼び出し側の現行 checkout の最上位ディレクトリであり、リンク checkout の場合は pool がその内側に入れ子になる。省略名は `worktree-`＋UUID を使う。サービスは割り当てが pool を作成した場合に限り `*` と末尾改行を含む `.gitignore` を書き、既存ファイルと無視規則は保持する。相対 `directory`、生成 `namePrefix`、実行可能選択、プロセス制限は[設定カタログ](../../../docs/config-catalog.md#deepseek-aidsh-experimental-worktree)で設定できる。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックして展開</summary>

Git とディレクトリ割り当ては呼び出しセッションの既存ファイルポリシーでマウント済みサブプロセスとサンドボックスプロバイダー経由で実行される。作成は宛先や共有 Git 管理ディレクトリへの書き込み権を広げない。ディレクトリ作成は宛先を排他的に獲得し、キャンセルと失敗 setup は保持成果物を残し得て、そのパスは誤差に現れる。サービス破棄は保留操作を中断し、その解決を待つ。

| ソース | 責任 |
|---|---|
| [`src/index.ts`](src/index.ts) | ソース改訂の解決、checkout 作成、新作業ディレクトリの公開 |
| [`src/process.ts`](src/process.ts) | リテラル argv の閉じ込め、出力上限、プロセス終了待機 |
| [`src/directory.ts`](src/directory.ts) | 宛先の獲得と新規作成 pool の無視ファイル初期化 |

実行時不変 companion は公開されない。Git が checkout 登録を所有し、作業ディレクトリサービスがセッションディレクトリを所有する。このパッケージはどちらについても独立プロジェクションを保持しない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [Worktree サブシステム](../../../docs/subsystems/worktrees.md) — 要求・結果・サービスリファレンス。
- [作業ディレクトリ](../../session/working-directory/README.md) — 記録済みセッションディレクトリとディレクトリ変更。
- [Worktree ツール](../tool-worktree/README.md) — モデル向け作成。
- [サブプロセス](../../subprocess/subprocess/README.md) — プロセス所有権と実行 world。
- [作成決定](../../../.agents/notes/implemented/feature/2026-09-13-explicit-worktree-creation.md) — 保持 checkout と既存書き込み許可。

-----

<a id="model-experience"></a>
## モデル体験

間接的に、worktree ツールの作成結果と作業ディレクトリサービスの記録済みセッション文脈を通じて。

#### KV キャッシュ効果

このパッケージはプロンプト文を提供しない。そのコンシューマーが追記ツール結果と記録済みディレクトリ文脈を所有する。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- **保持成果物** — worktree を離れても分岐とファイルは残る。Setup 失敗も部分成果物を残し得る。除去・刈り込み・分岐削除はユーザーまたは他コンシューマーに属する。
- **ローカル改訂のみ** — 作成はコミットの取得や欠落 partial-clone オブジェクトの取得、submodule 初期化、依存関係 install、未コミットファイル複写を行わない。要件を満たす Git でも、欠落ローカルオブジェクトは作成を失敗させる。
- **filter 済み表現** — checkout は設定済み filter を省き、リポジトリ設定プログラムの実行や暗黙 download を起こさないようにする。Git LFS ポインターと暗号化 blob は保存表現のまま残り、hydrate や復号は別のユーザー制御操作である。
- **実行要件** — サブプロセスプロバイダーはファイルシステムプロバイダーと同一実行 world に Git と Node を提供しなければならない。Git は `GIT_NO_LAZY_FETCH` を尊重しなければならず、Git 2.45 と 2.39.4、2.40.2、2.41.1、2.42.2、2.43.4、2.44.1 の保守 release がそうである。旧 release はそれを無視して失敗せずに進むため、作成は promisor リモートから欠落 partial-clone オブジェクトを取得し得る。`git --no-lazy-fetch` 選択肢はこれらの release を拒否するが、Git 2.45 以降にのみ存在し、patch 済み保守 release も拒否する。既存サンドボックスはすべての checkout と共有 Git メタデータ書き込みを許可しなければならない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

サンドボックス化 Node 子が排他的ディレクトリ作成を提供し、このサービスが pool を作成したかを識別する。[ファイルシステムサービス](../../fs/fs/src/index.ts) はそれを公開せず、[fs-local](../../fs/fs-local/src/index.ts) のような素プロバイダーが書き込み時に `sandboxPolicy` を無視することをファイルシステム契約は許す。`createIfAbsent` はファイルを保護するが、権限を強制せず、そのディレクトリの作成者を識別しない。ディレクトリ割り当てと無視ファイル作成を Git と同一プロセスサンドボックス下に保つことで、既存 checkout パスの拒否と `.gitignore` 作成条件を保持する。

</details>
