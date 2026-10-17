# プロンプトから永続プラグインを設定する

日本語 | [English](dynamic-cordis.en.md) | [中文](dynamic-cordis.zh.md)

Creator モードは [Plugin Manager](../../../../packages/boot/plugin-manager/README.md) と読み取り専用の [ランタイム検査](../../../../packages/extensions/tool-cordis/README.md) を提供する。プラグイン設定は現在のプロファイルに属し、そのセッションに影響し、プロセス再起動後も残る。

## MCP サーバーに接続する

Web プロファイルを起動して Creator モードを選択する。`ping` を公開する到達可能な Streamable HTTP MCP サーバーを用意し、実際のエンドポイントを使って次のプロンプトを送る:

> このプロファイルの `<endpoint>` にある MCP サーバーを `demo` として設定して。そのツールを今すぐ利用可能にし、ping ツールを呼び出して結果を教えて。

エージェントは設定専用バンドルを書き、そのパッチが `@deepseek-ai/dsh-mcp-client` を挿入し、`plugin_manager install_bundle` でインストールする。HMR が有効なら、同じ実行中セッションにツールが現れる。管理結果（`application: applied`）と `mcp__demo__ping` 呼び出しの成功の両方を確認する。`restart-required` の保存済みエントリーはまだ有効化されておらず、失敗したエントリーは設定の修復が必要である。

設定を編集する前にバンドルパッチを読む。エントリーの無効化やバンドルの削除には Plugin Manager を使う。受け付ける設定と接続失敗時の動作は [MCP クライアントリファレンス](../../../../packages/mcp/mcp-client/README.md) を参照。
