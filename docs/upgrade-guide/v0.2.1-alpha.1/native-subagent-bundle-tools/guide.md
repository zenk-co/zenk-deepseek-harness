---
kind: upgrade-guide
description: "Claude Code と Codex のバンドルは、パッケージと行のアイデンティティを保ったまま、グローバルな委譲ツールを追加します。"
---

# ネイティブサブエージェントバンドルがグローバルツールを含むようになります

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

`@deepseek-ai/dsh-subagent-claude-code` と `@deepseek-ai/dsh-subagent-codex` は、パッケージ名、バンドル選択、プロバイダー行 ID、設定、ネイティブ認証を保ちます。選択されたバンドルは、その委譲ツールを Host グローバルツールとしても登録し、minimal を含むすべてのプリセットから可視になります。以前はバンドルはそのプロバイダーのみを登録していました。ライブのエージェントはバンドルが有効になった後の次のリクエストからツールを見て、バンドルがオフに切り替わるとそれを失います。

提供される Host 行は `tool-subagent-claude-code` と `tool-subagent-codex` です。後続のユーザーレイヤーは行 ID でそれらの設定や無効状態を上書きできます。上書きは未選択のバンドルを選択しません。同名の独自ツールを登録するプリセットは、そのエージェントに対してグローバルツールを影で覆います。

委譲は共有の managed-activation API に従います: ツールは子 ID を返し、完了は親エージェントへのログ付き通知として届きます。廃止された `backgroundMode` 設定を削除してください。`maxDepth: provider-managed` はこれらのネイティブプロバイダー向けに引き続きサポートされます。

## マイグレーション

1. 選択済みのバンドル名、プロバイダー設定、認証を保ちます。既存のプロバイダーのみのパッケージは、ツールを提供するバンドルを受け取るために Plugins → Official での **Update** が必要です。要求されたら再起動してください。新しいプロバイダーを採用するには、そのカードを有効にします。[インストールターゲット](../../../../packages/boot/plugin-manager/README.md#use-this-package)は公開 DSH バージョンまたはソースチェックアウトに従います。等しいバージョン文字列が古いレジストリパッケージを開発リンクと等価にはしません。Off は選択解除のみを行い、Remove は別個のままです。
2. ツールは通常の行パッチで設定します。設定の上書きは依然として完全な設定を置き換えます。たとえば、これはプロバイダーを登録したまま Codex ツールを無効に保ちます:

   ```yaml
   - id: tool-subagent-codex
     disabled: true
   ```

3. 手動の Host 行が同じツール名を登録している場合は、その冗長な行を削除するか、バンドルの行を無効にします。セッションで有効なツールカタログを検証してください。
4. プラグインクライアントは必須の `BundleInfo.official` と `BundleInfo.availability` フィールドを受け取ります。詳細スロットの `PluginPackageRef` も同様にそれらを受け取ります。`official` はプロジェクトのメンテナンスを識別し、`availability` は `installation`、`profile`、または `missing` を報告し、`installed` は依然としてプロファイル依存関係の宣言を意味します。既存のフィールドを表示するだけの詳細スロットのリーダーは変更不要です。コンストラクターと厳密なバリデーターは新しいフィールドを含めなければなりません。任意の `installTarget` は、提供されるバージョンとレジストリまたはローカルリンクの仕様を識別します。

**その他のプロファイル。** バンドルレイヤーは Host 行のみを挿入するため、headless、SDK、ACP、カスタムプロファイルもそれらを選択できます。プロバイダーパッケージを保ちつつそのバンドルを選択しないプロファイルは、[Codex](../../../../packages/subagent/subagent-codex/README.md#exposing-the-tool) または [Claude Code](../../../../packages/subagent/subagent-claude-code/README.md#exposing-the-tool) の例を使って同じ行をコンポーズできます。
