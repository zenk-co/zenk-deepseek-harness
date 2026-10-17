---
description: "Web GUI のブラウザ側のパッケージマップ: シェルのブート、ブラウザ・ホスト間通信、共有クライアントサービス、ローカライズ、開発時のリロード、UI 機能プラグイン。"
kind: "package-group"
---

# client/ — Web GUI のブラウザ側

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`client/` グループは、dsh Web GUI のブラウザ体験を提供する。会話、ナビゲーション、設定、承認、ファイルアクセス、その他のインタラクティブ機能を含む。ブラウザに表示される動作を追加する場合はこのファミリーのパッケージを選び、サーバー側のページ配信とホスト統合には [`host/`](../host/README.md) を使用する。パッケージは共有ブラウザ基盤と焦点を絞った UI 機能の両方をカバーし、各子 README が自身の設定と動作を所有する。作成ルールは [AGENTS.md](AGENTS.md) にあり、以下の関連ドキュメントがパッケージ間の構成を説明する。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## パッケージ

カーネルパッケージがページを起動して配信し、UI 機能パッケージがそれを表示する。各パッケージ README が自身のコントラクトと設定を所有する。

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`web/`](web/README.md) | ブラウザシェルを起動する | — |
| [`modules/`](modules/README.md) | ブラウザ側のクライアントモジュールを読み込む | `ctx.clientModules` / `ctx.modules` |
| [`connection/`](connection/README.md) | ブラウザとホスト間の RPC 通信とイベント配信を維持する | `ctx.connection` |
| [`file-upload/`](file-upload/README.md) | ページスレッドの外で生の Blob とバイトストリームのリクエストボディを送信する | `ctx.fileUpload` |
| [`shortcuts/`](shortcuts/README.md) | アプリケーションのキーボードコマンドを登録する | `ctx.shortcuts` |
| [`ui-shortcuts/`](ui-shortcuts/README.md) | キーボードショートカットのリファレンスを表示する | — |
| [`store/`](store/README.md) | React 非依存のオブザーバブルおよびスナップショットストアのプリミティブを提供する | — |
| [`hmr/`](hmr/README.md) | 開発中にクライアントプラグインを更新する | — |
| [`locale/`](locale/README.md) | ローカライズ設定とメッセージ辞書を提供する | `ctx.locale` |
| [`test-runtime/`](../test-support/client-runtime/README.md) | クライアント機能パッケージ向けの共有リポジトリテストサポート | — |
| [`ui-renderer/`](ui-renderer/README.md) | スロットデータを React に紐付け、組み立てられたアプリケーションをマウントする | `ctx.uiRenderer` |
| [`ui-slots/`](ui-slots/README.md) | 型付き拡張 Slot と再利用可能な Component Factory を定義する | — |
| [`ui-session/`](ui-session/README.md) | Session Controller の状態を標準の Slot ソースとフックに適合させる | — |
| [`ui-theme/`](ui-theme/README.md) | 選択されたカラーテーマを適用する | — |
| [`ui-primitives/`](ui-primitives/README.md) | 共有の React コントロール、アイコン、コンテンツレンダラーを提供する | — |
| [`ui-attachment/`](ui-attachment/README.md) | コンポーザーとメッセージ画像の添付表示を登録する | — |
| [`ui-layout/`](ui-layout/README.md) | アプリケーションの主要領域を配置する | — |
| [`ui-dockkit/`](ui-dockkit/README.md) | ドッキングレイアウト操作と React コンポーネントを提供する | — |
| [`ui-sidebar/`](ui-sidebar/README.md) | ワークスペースとセッションのナビゲーションを表示する | — |
| [`ui-sidebar-right/`](ui-sidebar-right/README.md) | 右サイドバーとそのタブ種別を所有する | `ctx.sidebarRight`, `ctx.sidebarRightTabs` |
| [`ui-sidebar-documentpreview/`](ui-sidebar-documentpreview/README.md) | 右サイドバーのタブにドキュメントを表示する | `ctx.documentPreviews` |
| [`ui-sidebar-browser/`](ui-sidebar-browser/README.md) | 右サイドバーのタブで、ループバックサービスを含むサンドボックス化された HTTP(S) ページを閲覧する | — |
| [`resources/`](resources/README.md) | 統合リソースモデル: `useResource` セッション標準フックの背後にあるプロトコルプロバイダー | `ctx.resources` |
| [`ui-sidebar-files/`](ui-sidebar-files/README.md) | 右サイドバーのワークスペースファイルツリーのタブ種別 | — |
| [`ui-brand-official/`](ui-brand-official/README.md) | 汎用のブラウザブランドスロットに公式の名称とマークを設定する | — |
| [`ui-workspace/`](ui-workspace/README.md) | ワークスペースの選択と作成のサーフェスを提供する | — |
| [`ui-conversation/`](ui-conversation/README.md) | アクティブな会話とその入力サーフェスを表示する | — |
| [`ui-chat/`](ui-chat/README.md) | Chat 会話ターゲットを射影してレンダリングする | — |
| [`ui-approval/`](ui-approval/README.md) | 承認リクエストを表示し、ユーザーの決定を返す | — |
| [`ui-tool/`](ui-tool/README.md) | ツール呼び出しツリーとツールごとのキー付きビューを構成する | — |
| [`ui-workflow-run/`](ui-workflow-run/README.md) | 永続的なワークフロー実行をネストされたチャットの開示として再生する | — |
| [`ui-goal/`](ui-goal/README.md) | 現在のゴールを表示および管理する | — |
| [`ui-trajectory/`](ui-trajectory/README.md) | エージェントアクティビティの代替ビューを表示する | — |
| [`ui-commands/`](ui-commands/README.md) | セッションを認識するコマンドの検出とディスパッチを提供する | — |
| [`ui-input-trigger/`](ui-input-trigger/README.md) | インラインのコマンドとリファレンスのサジェストを調整する | — |
| [`ui-skill/`](ui-skill/README.md) | インラインサジェストにスキル参照を追加する | — |
| [`ui-reference/`](ui-reference/README.md) | 統合 Web `@file` / `@session` リファレンスソース | — |
| [`ui-secret-mask/`](ui-secret-mask/README.md) | 送信されるユーザーテキスト内の認識された資格情報をマスクする | — |
| [`ui-subagent/`](ui-subagent/README.md) | サブエージェントのナビゲーション、子トランスクリプトの状態、インラインリファレンスを提供する | — |
| [`ui-jobs/`](ui-jobs/README.md) | このセッションのバックグラウンドジョブを、オンデマンドのストリーミング記録パネル付きで一覧する | — |
| [`ui-schedule/`](ui-schedule/README.md) | 現在のセッションのアクティブなリマインダーを読み取り専用のヘッダーカタログに一覧する | — |
| [`ui-model-selection/`](ui-model-selection/README.md) | 会話サーフェスでモデル選択を提供する | — |
| [`ui-permission-presets/`](ui-permission-presets/README.md) | デフォルト権限を設定し、現在のセッションのアクセスを切り替える | — |
| [`ui-plan/`](ui-plan/README.md) | アクティブなプランモードの状態とその終了コントロールを表示する | — |
| [`ui-settings-plugins/`](ui-settings-plugins/README.md) | 組み込みプラグイン設定セクションのシェルとそのタブ拡張ポイントを所有する | — |
| [`ui-user-questions/`](ui-user-questions/README.md) | エージェントが要求するインタラクティブな質問を表示する | — |
| [`ui-agent-preset/`](ui-agent-preset/README.md) | セッションのエージェントプリセットを選択し、プリセット構成を作成する | — |
| [`ui-settings/`](ui-settings/README.md) | 設定インターフェースとその拡張領域をホストする | — |
| [`ui-settings-general/`](ui-settings-general/README.md) | 一般設定セクションを提供する | — |
| [`ui-settings-models/`](ui-settings-models/README.md) | モデルプロバイダーの設定と DeepSeek オンボーディングを提供する | — |
| [`ui-settings-shell/`](ui-settings-shell/README.md) | Plugins ページにシェル設定ページを提供する | — |
| [`ui-settings-agent-loop/`](ui-settings-agent-loop/README.md) | Plugins ページに agent-loop 設定ページを提供する | — |
| [`ui-settings-session-log/`](ui-settings-session-log/README.md) | 一般設定で API セッションログのアップロードを制御する | — |
| [`ui-settings-subagent/`](ui-settings-subagent/README.md) | Plugins ページに Subagent 設定ページを提供する | — |
| [`ui-settings-web-search/`](ui-settings-web-search/README.md) | Plugins ページに Web 検索設定ページを提供する | — |
| [`ui-plugin-manager/`](ui-plugin-manager/README.md) | サイドバーの Plugins パネルを提供する: インストール済みパッケージのインストール、有効化、無効化、再試行、構成 | — |
| [`ui-plugin-market/`](ui-plugin-market/README.md) | Plugins ページに Discover タブを提供する: マーケットインデックスを閲覧し、そのバンドルをインストールする | — |
| [`ui-settings-plugin-inventory/`](ui-settings-plugin-inventory/README.md) | Plugins 設定に読み取り専用の Host Loader インベントリタブを提供する | — |
| [`ui-deliverables/`](ui-deliverables/README.md) | 変更ファイルカードを、比較タブ、デリバリーカード、クリック可能な最終応答のファイル参照とともに生成する | — |
| [`ui-message-feedback/`](ui-message-feedback/README.md) | 評価、`/feedback`、またはセッションヘッダーメニューから開かれるメッセージ評価とフィードバックダイアログを提供する | `ctx.feedbackUi` |
| [`ui-directory-picker-browse/`](ui-directory-picker-browse/README.md) | ワークスペースディレクトリフロー用のアプリ内ディレクトリ閲覧サーフェス | — |
| [`ui-directory-picker-native/`](ui-directory-picker-native/README.md) | ローカルの Desktop または Host OS の選択ダイアログを駆動するネイティブディレクトリピッカーサーフェス | — |
| [`ui-open-in-app/`](ui-open-in-app/README.md) | ワークスペースディレクトリをインストール済みアプリケーションで開くセッションヘッダーの分割ボタン、および 1 つのファイルに対するドキュメントプレビューの既定アプリケーションコントロール | — |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

まずサブシステムリファレンスと、パッケージ間構成の決定を所有する 2 つのノートから始め、次にこのページを配信するホスト側へ進む。

- [Client modules サブシステム](../../docs/subsystems/client-modules.md) — Web プラグインテーブル: `dsh.client` 宣言、ブートグラフのワイヤ、バンドルルート。
- [Slot システム標準](../../.agents/notes/implemented/architecture/2026-07-22-slot-type-chain-implementation.md) — 決定的なスロットモデル: 登録、props シェア、ストア。
- [Web クライアントアーキテクチャリファレンス](../../docs/subsystems/web-client.md) — ロードチェーン、オブジェクト層、クライアントサービス。
- [Host グループマップ](../host/README.md) — このブラウザ側に配信するホスト側。

<a id="dev-note"></a>
## Dev Note

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
