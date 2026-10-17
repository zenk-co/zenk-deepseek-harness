# Git ワークツリー

日本語 | [English](worktrees.en.md) | [中文](worktrees.zh.md)

実験的な [`dsh-experimental-worktree`](../../packages/experimental/worktree/README.md) サービスは `ctx.worktrees` を提供する。その [`create_worktree`](../../packages/experimental/tool-worktree/README.md) コンシューマーは新しい Git ブランチとチェックアウトを作成し、次に[作業ディレクトリサービス](working-directory.md)を通じてそれを選択する。[Git ワークツリー任意バンドル](../../packages/experimental/tool-worktree/README.md#use-this-package)は両パッケージを GUI プラグインマネージャー経由で読み込む。出荷時は無効であり、明示的な構成でも 2 つのパッケージをマウントできる。

## 作成と保持

呼び出しセッションの現在ディレクトリがソースリポジトリを選択する。作成はチェックアウト割り当て前に要求されたローカルコミット、ブランチ、タグを固定する。省略時は `HEAD` を選択する。各名前は新しいブランチと未使用チェックアウトパスを特定しなければならない。操作は欠落オブジェクトの取得も、ソースチェックアウトからのステージ済み・未ステージ・未追跡・無視ファイルのコピーも行わない。

既定の宛先は `<現在のチェックアウトルート>/.agents/worktrees/<name>` である。`repositoryRoot` は呼び出し元の現在チェックアウトの最上位ディレクトリである。したがってリンクされたチェックアウトは独自プールを含む。サービスは、設定されたプールディレクトリを割り当て作成した場合にのみ `*` と末尾改行を含む `.gitignore` を書き込む。既存ファイルと無視規則は保全される。呼び出しセッションの既存サンドボックスポリシーは宛先と共有 Git 管理ディレクトリへの書き込みを許可しなければならない。正常な Git 設定が作業ディレクトリ変更に先行する。

`working_directory({ cd: path })` による退出はチェックアウトとブランチを保持する。取り消しや失敗も部分成果物を残し得る。エラーはその場所を特定する。サービスは破棄時に保留操作を中止して排出する。[パッケージ README](../../packages/experimental/worktree/README.md)は設定と Git 要件を所有する。

## 要求と結果

要求は新しい名前とローカルリビジョンのみを選択する。結果は作成されたチェックアウトと正確なコミットを特定する。セッションの元プロジェクトや書き込み権限は変えない。

```ts type-equiv
/** A new checkout from a locally available Git commit, branch, or tag. */
interface CreateWorktreeRequest {
  /** New branch name, also used as the relative checkout directory; omission generates a name. */
  name?: string
  /** Local revision to resolve before creation; omission selects HEAD. */
  from?: string
}
```

```ts type-equiv
/** Committed Git baseline and the calling Session's resulting working directory. */
interface CreatedWorktree {
  /** Canonical absolute checkout directory in the filesystem provider's execution world. */
  path: string
  /** Newly created branch name. */
  branch: string
  /** Resolved commit object name; repository-local replacement refs can change its checked-out content. */
  baseCommit: string
  /** Canonical root of the source checkout. */
  repositoryRoot: string
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される(doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。再生成は `pnpm run gen-cordis-catalog`)。言語版の違いは、ロケール固有のペアドキュメントパスのみである。シグネチャブロックは `ts cordis-catalog` フェンスを使用し、元のソース JSDoc を保持する。ディスパッチモードは [primer](../cordis-primer.md#dispatch-modes) で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxworktrees--worktreeservice"></a>

### `ctx.worktrees` — `WorktreeService`

マウントされたファイルシステムとサンドボックスプロバイダーの下に保持される Git ワークツリーを作成する。

```ts cordis-catalog
/**
 * Create a fresh branch and checkout at a pinned local revision, then enter it.
 * Existing branches or checkout paths fail. Uncommitted files stay in the source checkout.
 * Checkout disables configured clean, smudge, and process filters without changing Git config.
 * Repository-local replacement refs still apply; baseCommit reports the resolved object name.
 * The new checkout becomes current only after Git setup succeeds. Failures may retain newly
 * allocated Git/filesystem artifacts; no branch or checkout is removed automatically.
 * @param agent - caller whose current directory selects the source repository and file policy.
 * @param request - optional new name and local revision; defaults are generated name and HEAD.
 * @param signal - cancellation of lookup, creation, and working-directory publication.
 * @returns canonical checkout path, branch name, pinned commit, and source repository root.
 */
async create(agent: Agent, request: CreateWorktreeRequest = {}, signal?: AbortSignal): Promise<CreatedWorktree>
```

型: [Agent](core.md)

ソース: [`packages/experimental/worktree/src/index.ts`](../../packages/experimental/worktree/src/index.ts)
<!-- END GENERATED cordis-surface -->
