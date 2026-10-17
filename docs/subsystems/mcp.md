# MCP

日本語 | [English](mcp.en.md) | [中文](mcp.zh.md)

## 概要

Model Context Protocol (MCP) は、モデルを外部サーバーが提供するツールに接続する。設定された各サーバーは、キャンセル、権限チェック、記録された結果、対応する画像出力を備えた通常の harness ツールを提供する。共有ツールは、呼び出し元のスコープでサーバーが設定されている場合にリソースを検出して読み取り、サーバーの instructions はログに記録されるシステムプロンプトに加わる。公式 SDK は、モダンなプロトコルリビジョンおよびサポート対象のレガシーリビジョンをネゴシエートする。このリファレンスでは、MCP パッケージグループの責務、スコープ、構成の選択肢を扱う。サーバー設定は [client README](../../packages/mcp/mcp-client/README.md) が所有する。

## 目次

- [設定](#configuration)
- [責務とスコープ](#responsibilities-and-scope)
- [プロトコルと結果](#protocol-and-results)
- [リソースと instructions](#resources-and-instructions)
- [リソースプロバイダーの型](#resource-provider-types)
- [制限](#limits)
- [関連資料](#further-reading)

-----

<a id="configuration"></a>
## 設定

MCP サーバーはオプトインである。サーバーごとに 1 つの `@deepseek-ai/dsh-mcp-client` エントリを、意図した Cordis スコープで設定する。出荷されるすべてのプロファイルは [tool registry](tools.md) を提供し、共有リソースサービスを一度マウントする。ユーザーが設定するのはクライアントエントリのみである。可視の設定済みサーバーを持たない呼び出し元は、native モードでも PTC モードでも MCP のプロンプトテキストやツールを受け取らない。

| 選択肢 | 設定の所有者 |
|---|---|
| サーバー ID、ローカルプロセスまたは HTTP エンドポイント、資格情報、プロセス環境 | [クライアント設定](../../packages/mcp/mcp-client/README.md#use-this-package) |
| ツールとリソースのリクエストタイムアウト、起動失敗ポリシー、再接続 | [クライアント設定](../../packages/mcp/mcp-client/README.md#use-this-package) |
| リソースの検出と読み取り | [MCP resource service](../../packages/mcp/mcp-resources/README.md#use-this-package) が出荷プロファイルに含まれる。設定フィールドはない |
| サーバー instructions のサイズ制限 | クライアントの `maxInstructionBytes`。[システムプロンプトの組み立て](system-prompt.md)は構成が提供する |
| 権限の決定と対応する画像出力 | [ツール実行](tools.md)と[添付](attachment.md) |

プロトコルのネゴシエーションは SDK がサポートするリビジョンに従う。プロトコルリビジョンを強制する製品設定は存在しない。[設定カタログ](../config-catalog.md#deepseek-aidsh-mcp-client)に、受け付けられるクライアントフィールドとデフォルト値が一覧されている。

-----

<a id="responsibilities-and-scope"></a>
## 責務とスコープ

クライアントはサーバーごとの接続プラグインであり、harness の tool registry のコンシューマーである。共有の `ctx.mcp` サービスは公開しない。MCP 操作を実装するのは外部サーバーであり、プロトコル交換は SDK が所有し、クライアントは検出したツールを harness の実行に適合させる。

`mcp-resources` は共有リソースツールを所有し、呼び出し元のスコープでプロバイダーを選択する。各 MCP クライアントは自身の接続を通じてリソース操作を提供する。スコープ内で最初のプロバイダーがローカルの共有ツールを有効にし、最後のプロバイダーを削除するとそれらも削除される。継承されたプロバイダーは可視のままである。サービスは、特定のクライアントから独立して、これらのツール登録を所有する。可視のクライアントエントリがアクティブである限り、接続障害が共有リソースツールを削除することはない。

設定された `serverName` は、その登録スコープ内でサーバーを識別する。同じスコープ内の 2 つのエントリが同じ名前を予約することはできない。別々の Agent スコープでは再利用できる。公開ツール名には設定済みサーバー名が含まれるため、異なるサーバーにある同名のツールも区別される。名前と検出されたツールは登録 effect が所有する。プラグインの破棄は接続を閉じ、そのコントリビューションを削除する。

[native Cua Driver プロバイダー](../../packages/experimental/computer-use-cua-driver-native/README.md)は、MCP 接続を開かずにクライアントがエクスポートする結果アダプターを共有する。デスクトッププロバイダーの選択は [computer-use サブシステム](computer-use.md)に属する。

-----

<a id="protocol-and-results"></a>
## プロトコルと結果

stdio と Streamable HTTP の両方が、公式 SDK のネゴシエーション、検出、プロトコル検証、キャンセルを使用する。ツールリストの変更は、レガシー通知またはモダンなサブスクリプションを通じて検出をトリガーする。更新に失敗した場合は以前のツール世代が保持される。接続の回復は [クライアントライフサイクル](../../packages/mcp/mcp-client/README.md#use-this-package)に従う。

結果アダプターは、プログラムによる呼び出し元向けに正規の MCP JSON を保持しつつ、通常のツールコンテンツを準備する。対応する画像は添付システムを使用し、対応しないリッチコンテンツは明示的なテキスト診断を生成する。ポリシー違反と置き換えられた結果については、tool registry が引き続き権威である。記録と最終表示は [ツールコントラクト](tools.md)が所有し、MCP 固有の射影の詳細は [クライアント結果リファレンス](../../packages/mcp/mcp-client/README.md#use-this-package)が所有する。

-----

<a id="resources-and-instructions"></a>
## リソースと instructions

リソース呼び出しには、明示的に設定されたサーバー名が必要である。システムプロンプトの組み立てが利用可能な場合、リソースサービスは、ディスパッチに使用されるものと同じレジストリから呼び出し元に可視の名前を一覧する。ツールも instructions も持たないサーバーも含まれる。共有レジストリはディスパッチ前に呼び出し元 Agent のスコープでその名前を解決する。利用できないサーバーは、ネットワークリクエストを行わずに失敗する。検出と読み取りはオンデマンドであり、ツールなしでリソースを公開するサーバーも同様である。ページネーションとコンテンツのレンダリングは [リソースパッケージ](../../packages/mcp/mcp-resources/README.md)が所有する。生成されるツールスキーマは[ツールカタログ](../tool-catalog.md#deepseek-aidsh-mcp-resources)にある。

リソースプロバイダーは引き続き接続が所有する。スコープの破棄は登録を削除する。キャンセルと回復は MCP クライアントが制御する。正規の結果はプログラムによる呼び出し元向けに完全な JSON を保持し、テキスト射影はバイナリ BLOB を説明に置き換える。返されたテキストは通常のツール履歴に入る。サーバーが接続したというだけではコンテンツは取得されない。

システムプロンプトの組み立てが構成されている場合、クライアントは空白でないサーバー instructions を、サーバーに帰属するスコープ付きセクションとして公開する。instructions はそのままのテキストとして扱われ、公開前に設定されたサイズ制限を通過する。置き換え接続は、検出が成功した後にのみ instructions を公開する。instructions が存在しない場合はセクションが追加されない。組み立てと記録は [システムプロンプトサブシステム](system-prompt.md)が所有する。

-----

<a id="resource-provider-types"></a>
## リソースプロバイダーの型

接続プロバイダーは、1 つの操作と元のツール実行(呼び出し元とキャンセルシグナルを含む)を受け取る。

```ts type-equiv
/** One supported resource operation, with server-owned cursors and URIs. */
type McpResourceRequest =
  | { method: 'resources/list' | 'resources/templates/list'; cursor?: string }
  | { method: 'resources/read'; uri: string }
```

```ts type-equiv
/** One configured server's resource access, owned by its MCP connection plugin. */
interface McpResourceProvider {
  /**
   * Run an operation against one live connection generation.
   * @param request - MCP resource method and parameters.
   * @param exec - caller identity and cancellation for this invocation.
   * @returns the protocol result as lossless JSON.
   */
  request(request: McpResourceRequest, exec: ToolExecution): Promise<JsonValue>
}
```

-----

<a id="limits"></a>
## 制限

MCP のプロンプトテンプレート、人間入力の elicit、タスクベースの実行、リソースサブスクリプションはサポートされない。リソースツールには呼び出し元に可視の設定済みサーバーが必要である。バイナリリソースは、モデル向けのテキスト説明を伴うプログラム用データのままである。tools ケイパビリティを持たないサーバーは、空のツールセットで接続する。接続と検出のタイムアウトは SDK に従い、クライアントに別個の設定はない。

-----

<a id="further-reading"></a>
## 関連資料

- [MCP パッケージグループ](../../packages/mcp/README.md) — パッケージのエントリポイント。
- [MCP resources](../../packages/mcp/mcp-resources/README.md) — 共有ツールとリソースプロバイダーのセマンティクス。
- [リソース可視性リファレンス](../../packages/mcp/mcp-resources/README.md) — 共有プロファイルのマウントと設定済みサーバーからの可視性。
- [サードパーティ製メモリサーバー](../user/guide/mcp-memory.md) — 製品設定ガイド。
- [プロトコルネゴシエーションリファレンス](../../packages/mcp/mcp-client/README.md) — SDK の所有権と互換性の決定。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によってソースから生成される(doc-sync の `pnpm run verify-cordis-catalog` で最新性を検証。再生成は `pnpm run gen-cordis-catalog`)。言語版の違いは、ロケール固有のペアドキュメントパスのみである。シグネチャブロックは `ts cordis-catalog` フェンスを使用し、元のソース JSDoc を保持する。ディスパッチモードは [primer](../cordis-primer.md#dispatch-modes) で定義され、フレームワーク継承の `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxmcpresources--mcpresourceruntime"></a>

### `ctx.mcpResources` — `McpResourceRuntime`

スコープ付きリソースアクセスと、設定済み MCP サーバーが共有する 3 つのツール。

```ts cordis-catalog
/**
 * Register one server and expose resource tools while that scope has providers.
 * @param server - configured server name, unique in this scope.
 * @param provider - connection-owned resource operations.
 * @returns the effect disposer for this exact registration.
 */
register(server: string, provider: McpResourceProvider): () => void
```

ソース: [`packages/mcp/mcp-resources/src/index.ts`](../../packages/mcp/mcp-resources/src/index.ts)
<!-- END GENERATED cordis-surface -->
