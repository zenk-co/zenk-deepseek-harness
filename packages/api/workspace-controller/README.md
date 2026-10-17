---
description: "ホストとクライアントのワークスペース制御: ワークスペースナビゲーションを変更し、その完全な投影を追従する。"
kind: "package-reference"
---
# ワークスペースコントローラー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`@deepseek-ai/dsh-api-workspace-controller` はホスト `ctx.workspaceController` サービスと生成済みクライアント `ctx.remote.workspace` 名前空間を所有する。そのリモートメソッドはワークスペースを作成、改名、削除、並べ替え、ワークスペース内のセッションを並べ替え、ワークスペースナビゲーションからセッションをアーカイブ/アンアーカイブし、完全なワークスペース投影を追従する。クライアントがワークスペースナビゲーションを変更または追従しなければならないときに API ゲートウェイ経由で使う。このパッケージは `ctx.directoryPickerController` と生成済み `ctx.remote.directoryPicker` 名前空間も所有する。それが運ぶディレクトリ選択シームは抽象であり、それ自体のローダーエントリーになることは決してないためである。

## 目次

- [このパッケージを使う](#use-this-package)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

ホストコントローラーは正しさが現在のレジストリ状態に依存する変更を直列化し、想定失敗には安定エラーコード付き `RemoteError` を投げる。その `follow()` ストリームは耐久ワークスペース変更に同期的に接続し、まず完全なベースラインを 1 件送出し、次に順序付き `upsert`、`remove`、`order`、`archived`、`pinned` 増分を送出する。アーカイブとピン集合はセッション id 配列であり、ピン配列では直近ピン留め id が先頭である。再接続は置換ベースラインで別の世代を始め、コンシューマーは切断中の全増分の受信に依存しない。`stopActivity` なしの `archiveSession` は動作中作業のあるセッションを `workspace/session-active` として拒否する。その詳細はその作業をファミリー (`turn`、`subagent`、`job`、`schedule`) ごとに項目 id とラベル付きで列挙する。`stopActivity: true` ではレジストリのプロバイダーが先に作業を止め、アーカイブ集合が耐久化されると応答が届き、停止はバックグラウンドで確定する。

コントローラーは `remoteAccess` を注入し、`typert.resources` 経由で既定フィールド `workspaceId` 付き `workspace` リソース種別を登録する。`workspace/follow` はリソースを読まないため、その呼び出しは `global` リソースに触れる。プリンシパルが所有者でないピアは、そのプリンシパル種別のポリシーが [`dsh-api-remote-access`](../remote-access/README.md) 中でアクションを列挙する `global` 役割を束縛するときにのみそれを追従できる。その呼び出し元には、ベースライン、`upsert` フレーム、`order` id は `ctx.remoteAccess.allows()` が `workspace` リソースとして認めるワークスペースだけ、各ワークスペース内とアーカイブ・ピン集合中で `session` リソースとして認めるセッション id だけを保つため、`workspace` と `session` の役割は同じアクションを列挙する。ストリームは配信したワークスペースを追跡する。次回変更時または新しい順序で認められなくなったものがあると、ストリームは `remove` の代わりに完全なフィルタ済み状態を運ぶ `replace` 増分を送る。取り除かれた id はクライアント上で決して復活しないためである。`replace` は開始ベースラインのようにクライアントが適用する通常増分であり、新世代の開始ではなく、エラーを報告も再接続もしない。アクセスが戻るとワークスペースは通常 `upsert` で再登場する。`remove` フレームは削除を報告し、そのワークスペースを受け取った呼び出し元にのみ届く。所有者フレームはフィルタされない。

クライアントエントリーは `ClientWorkspaceModel` と `createWorkspaceStateStream()` を提供する。モデルはワークスペース行、レジストリ順序、アーカイブとピン留めセッションアイデンティティ、単項変更エコー、ストリーム/単項競合解決を所有する。新しいホスト行は `updatedAt` で勝つ。コミット済みストリーム順序は古い単項応答に勝る。削除済みワークスペース id は遅延データで復活できない。ピンスナップショットはアイデンティティまたは順序が変わるときにのみ変わる。パッケージはフレームワーク中立スナップショットと購読を公開し、ナビゲーションポリシーと React フックは UI 所有者に残す。`WorkspaceController.archiveSession(sessionId, { stopActivity })` はホストの `rpcError` 付き `WorkspaceArchiveError` を投げるため、表面は動作中作業の拒否と欠落セッションや搬送障害を区別し、作業停止を提案できる。

<a id="first-use-workspace"></a>
### 初回利用ワークスペース

`workspace.initializeDefault()` は耐久既定ワークスペースを返す。クライアントサービスはそれを `workspaces.initializeDefault(signal?)` として公開する。リクエストを取らない。ホストは固定 `default-workspace` ディレクトリ名を所有し、レジストリは同じ部分から初期タイトルを導出するため、1 インストールは全言語で 1 オンディスクパスと 1 保存タイトルを保つ。ホストはリモート Web ホストを含めてそのアカウントの `<Documents>/deepseek-harness` 配下にディレクトリを置く。OS ファイル名制限が適用される。Linux システム照会は有効な Documents ディレクトリ付き `xdg-user-dir` を要する。それのないホストは `documentsDirectory` を設定するかフォルダーピッカーを使わなければならない。

[ワークスペースレジストリ](../../workspace/workspace/README.md#first-use-workspace)は適格性、ディレクトリ作成、耐久初期化を所有する。既存の既定ワークスペースは別の Documents 照会なしに返され、改名も移転もされない。不適格な初回利用は `undefined` を返すため、起動はディレクトリ選択をユーザーに残せる。照会と作成の失敗は標準リモートエラー処理を使う。初期化はセッションを作らず、メッセージも送らない。

`DEFAULT_WORKSPACE_DIRECTORY` と `workspaceDisplayTitle(title, localizedDefault)` はブラウザーコンシューマー向けに `./default-workspace` から公開される。自動タイトルを運ぶワークスペースは読み手のローカライズ既定名として読まれ、他のすべてのタイトルは逐語で読まれる。ちょうど `default-workspace` に改名されたユーザー所有ワークスペース — またはピッカーから採用されたその名のフォルダー — は既定としてラベル付けされる。他は何もその区別に依存しない。

| 構成 | 既定値 | 目的 |
| --- | --- | --- |
| `documentsDirectory` | システム Documents ディレクトリ | 完全修飾ホストディレクトリ上書き |
| `documentsLookupTimeoutMs` | `10000` | OS ディレクトリ照会の最大正持続時間ミリ秒 |

Documents 照会はレジストリ変更キューを保持するため、選択ディレクトリ登録を含む他のワークスペース変更は最大 `documentsLookupTimeoutMs` 待たされ得る。キャンセルは照会を止められる。解決成功後のキャンセルは作成や登録をロールバックしない。

-----

<a id="model-experience"></a>
## モデル体験

なし。ワークスペース編成はブラウザーとホストの制御状態であり、プロンプト、ツール、セッションイベントを登録しないためである。

#### KV キャッシュへの影響

直接の影響なし。ワークスペース変更はモデルリクエストを変えない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- `follow()` は再接続後に全体投影を置き換え、耐久カーソルも増分追いつきプロトコルもない。
- プロセスローカルの削除マーカーはクライアントモデル存続期間にのみ遅延データによる削除済みワークスペースの復活を防ぐ。


<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
