# サードパーティ製 memory MCP サーバーに接続する

日本語 | [English](mcp-memory.en.md) | [中文](mcp-memory.zh.md)

これら 3 件の**既定 off 参照設定**は [`@deepseek-ai/dsh-mcp-client`](../../../packages/mcp/mcp-client/README.md) 経由で 1 件の memory 系を DSH に接続する。1 件を選び、または他サーバー用に同一汎用 MCP 行を複写する。

これらのサードパーティ設定は相互運用例としてのみ提供される。その収録は DeepSeek による支持、推奨、提携、継続的サポートを意味しない。

## DSH が行うこと

DSH は選択した Cordis オーバーレイを解析し、設定済み stdio コマンドを開始するか設定済み Streamable HTTP URL に接続し、MCP ツールを検出し、`mcp__<serverName>__<tool>` として公開する。DSH はサーバーを**ダウンロード**せず、そのデータベースを初期化せず、そのモデルや埋め込みプロバイダーを選ばず、クラウド勘定を作成せず、ベンダーデータを移行せず、別の HTTP サービスを監督しない。stdio では汎用クライアントが DSH プラグインライフサイクルで子を起動停止し、HTTP では上流サービスが既に実行中でなければならない。

stdio ブリッジは資格情報を通常示す名前の環境変数とすべての `DSH_*` 変数を意図的に除去してから子を起動する。他の環境変数は継承されたままである。各例は必要な baseline 上書きのみを追加する。任意の上流機能が他秘密を必要とする場合、その秘密を YAML に直接書く代わりにその変数を行の `config.env` に追加する。

## 1 件選ぶ

| 系 | 検査済み pin | 転送 | 上流前提条件 |
|---|---|---|---|
| [Memorix](https://github.com/AVIDS2/memorix) | `memorix@1.3.0` (`500792cad3144142293bfbb20acb4841c9f7fcfa`) | stdio | Node 22.18+ と `npm install --global memorix@1.3.0` |
| [MCP Reference Memory](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | `@modelcontextprotocol/server-memory@2026.7.4` (`6dd0a683e198783e30feabf7abaf42f925bd18b1`) | stdio | `npm install --global @modelcontextprotocol/server-memory@2026.7.4` |
| [Engram](https://github.com/Gentleman-Programming/engram) | `v1.20.0` (`ba9e46ced152c37a7cb9e576153c41995873e2fc`) | stdio | Go 1.25.10+ と `go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0`、または一致 release バイナリ |

## 1 件有効化する

DSH にオーバーレイ 1 件を渡す。

```sh
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

ファイル名を `mcp-reference-memory.cordis.yml` または `engram.cordis.yml` に置換する。パスはディスク上の任意場所の複写ファイルを指せる。出荷構成に memory サーバーは存在しないため、`--patch` 省略は 3 件すべてを無効のままにする。

実行を越えて選択を保つには、選んだファイルの単一 `insert` パッチをユーザーパッチ層に統合する。1 プロファイル用は `$DSH_HOME/profiles/<name>/cordis.patch.yml`、マシン上の全プロファイル用は `$DSH_HOME/cordis.patch.yml` である。既存ファイルに上書き複写しないこと。無関係のユーザーパッチが既に含まれている場合がある。

## プロバイダー setup

### Memorix

```sh
npm install --global memorix@1.3.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Memorix は LLM や埋め込みサービスなしでローカルヒューリスティックモードで動作する。任意プロバイダーは Memorix 自身の `~/.memorix/config.toml` またはプロジェクト `memorix.toml` で設定する。例は DSH 作業ディレクトリからの Memorix Git プロジェクト同一性を保ち、Memorix 自身の `~/.memorix/data` 既定を使う。DSH 開始前に `MEMORIX_DATA_DIR` を設定して上書きする。

### MCP Reference Memory

```sh
npm install --global @modelcontextprotocol/server-memory@2026.7.4
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/mcp-reference-memory.cordis.yml"
```

この参照サーバーはローカル知識グラフを保存し、entity・relation・observation・read・search・open ツールを公開する。モデルや埋め込みサービスは不要である。例はインストール済み npm パッケージディレクトリの代わりに `$HOME/.dsh-mcp-reference-memory.jsonl` にその JSONL を保存する。DSH 開始前に `MEMORY_FILE_PATH` を設定して上書きする。

検索は entity 名・型・observation 上の大文字小文字不区別部分文字列一致であり、意味検索ではない。サーバーは埋め込み・自動要約・競合解決・忘却ポリシーを追加しない。

### Engram

```sh
go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/engram.cordis.yml"
```

Engram は保存とプロジェクト選択を所有する。既定で `~/.engram` を使い、DSH 作業ディレクトリから Git プロジェクトを検出し、環境上書きとして `ENGRAM_DATA_DIR` または `ENGRAM_PROJECT` を受け付ける。

## 任意の共有モデル指示

サーバーのツール説明が確実に memory 利用を起こさない場合、既存モデル指示にこの短いベンダー中立指示を追加する。

> When the user asks you to remember something, call a memory write tool. When historical information may be relevant, search memory and use relevant results.

これは追加指針のみである。例は DSH のシステムプロンプト persona を置換しない。

## 書き込み・fresh セッション想起・利用を検証する

一意な値 1 件を使い、全体を通じてプロバイダーの保存スコープを変えない。

1. DSH セッション A で尋ねる。`Remember that my validation drink is lapsang-<unique suffix>.` モデルがプロバイダーの書き込みツールを呼び、ツールが成功を返したことを確認する。
2. 同一実行ホストで DSH セッション B を作成する。セッション A の会話を複写しない。尋ねる。`What is my validation drink? Check memory.` モデルがプロバイダーの検索または想起ツールを呼び、その値を返したことを確認する。
3. さらにセッション B で尋ねる。`Use that preference to suggest one drink for the meeting.` 答えが想起値を使っていることを確認する。

新しい DSH セッションが必要であり、ホスト再起動は不要である。クラッシュした MCP 子は backoff 付き自動再接続とツール再同期を起こす。ツールは一覧されたまま、呼び出しは停止中のみ失敗し、再接続予算尽き後はツール登録が外され、再読み込みや再起動まで再接続は止まる。初期検出は非同期であるため、最初の検証プロンプト送信の前にプロバイダーの `mcp__...` ツールを待つ。

## 他 MCP サーバーを持ち込む

同一入口フィールドを複写し、一意な `id` と `serverName` を使う。

```yaml
- insert:
    - id: memory-my-server
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: my-memory
        transport: stdio
        command: my-memory-mcp
        args: []
        env: {}
        cwd: !!js process.cwd()
```

リモートサーバー用には代わりに `transport: streamable-http`、`url`、`headers` を使う。プロバイダー固有の install・同一性・認証・モデル・埋め込み・永続化・ライセンスはプロバイダーの責任のままである。
