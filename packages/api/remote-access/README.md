---
description: "非 owner の Peer に対するメソッド単位の Remote アクセス制御: ロールベースのポリシー判定、リストフィルタリング、および Peer ごとのアクセススナップショット。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-remote-access

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

非 owner の Peer が呼び出せる Remote メソッドと、受信できる転送イベントを判定する。ビジネスパッケージはロール — それぞれ 1 つのリソース kind に対するアクション集合 — を定義し、非 owner のプリンシパル kind ごとに、ロールをリソースにバインドするポリシーを 1 つ登録する。[API Gateway](../gateway/README.md) は呼び出しまたはイベントが触れるリソースを解決し、ルックアップの解決や引数のデコードの前にこのパッケージへ問い合わせる。リストメソッドは `allows()` を通じて項目をフィルタリングし、各 Peer は自身のアクセススナップショットに従うため、Client は Host が拒否するエントリーを非表示にできる。設計は [Peer principals Agent Note](../../../.agents/notes/implemented/architecture/2026-10-12-peer-principal-and-remote-access.md) が所有する。

## 目次

- [ホストサービス: `RemoteAccessService` (ctx key: `remoteAccess`)](#host-service)
- [Client フェイス](#client-face)
- [モデル体験](#model-experience)
- [既知の制限と延期された作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="host-service"></a>
## ホストサービス: `RemoteAccessService` (ctx key: `remoteAccess`)

[API Gateway](../gateway/README.md) をマウントするすべてのコンポジションはこのサービスをマウントする: Gateway は `remoteAccess` を注入し、これなしでは起動しない。[`bundle/base`](../../bundle/base/cordis.patch.yml) が `typert-gateway` の隣でこれをロードする。owner (`{ kind: 'owner' }`) は決してチェックされない; 以下のすべてのメソッドは非 owner のプリンシパルに関する。

| メンバー | 契約 |
|---|---|
| `registerPolicy(kind, policy)` | 1 つの非 owner プリンシパル kind の `RemoteAccessPolicy` を登録する; その `bindings()` と `explain()` はその kind で型付けされたプリンシパルを受け取る。同じ kind に対する 2 つ目のポリシーは throw する。登録は呼び出し元の fiber の Cordis エフェクトである; 登録と解除は開いているスナップショットを再計算する。 |
| `invalidate(principal?)` | 1 つのプリンシパル、またはすべてのプリンシパルのバインディングまたは条件の答えが変化した可能性があることを報告する。ビジネスパッケージは、すべてのグラント、取り消し、モード変更、期限切れでこれを呼ぶ。 |
| `decide(request)` | Gateway 専用。`request` は `{ principal, action, resources, args? }` である: 呼び出し元または受信者、エンドポイント `ns/method` または `event:<name>`、Gateway が解決した有効なリソース、および Typert コンパイル済み型に対して検証された呼び出しの引数 (ルックアップパラメーターは wire の同一性として)。`{ kind: 'allow' }` または `{ kind: 'deny', reason }` を返す; Gateway は拒否された呼び出しに対して details `{ action, reason }` とともに `remote-access/denied` を throw し、拒否されたイベントはエラーを構築せずに破棄する。owner と `remoteAccess/follow` は常に許可される。 |
| `allows(resource)` | サービスにアクセスした Context の呼び出しを読むため、リストメソッドは各項目について `this.ctx.remoteAccess.allows(resource)` を呼ぶ。そのリソースに対する呼び出しのエンドポイントアクションを引数なしで判定し、チェックごとにバインディングを再度読む。owner と Remote 呼び出しの外では true。 |
| `snapshotFor(principal)` | ページが開くときのベースライン: owner には `{ type: 'baseline', owner: true }`、それ以外はプリンシパルの現在のグラント。 |
| `follow(signal)` | Remote ストリーム `remoteAccess/follow`: 1 つの `baseline` に続いて `upsert` と `remove` フレーム。owner は `{ type: 'baseline', owner: true }` だけを受け取る。ストリームは `signal` が abort するかサービスがアンロードされると終了するため、再ロードされたサービスはすべてのリーダーを新しいベースラインから開始する。 |

ロール `{ name, resource, actions }` は、1 つのリソース kind — `global` または `TypertResourceMap` で宣言された kind — に対するアクション集合を名指すプレーンな値である。バインディング `{ role, resource, condition? }` は、ロールの kind の 1 つのリソースに対してそのロールを付与する。ポリシーは、メモリに保持する状態から `bindings(principal)` と省略可能な `explain(request)` に同期的に答える。リクエストは、解決されたすべてのリソースについて、そのリソースを名指すバインディングが存在し、そのロールがアクションを列挙しており、かつ条件がないか条件が許可する場合にのみ許可される。リソースは独立している: `global` 上のグラントは他のどのリソースに対しても何も意味せず、どのリソースも別のリソースを意味しない。条件は `{ action, resource, args? }` を受け取り、リソースとロールが一致するバインディングに対してのみ実行される; `args` はイベント、スナップショット、リストフィルタリングでは存在しない。`bindings()` は `decide()` ごとに 1 回、`allows()` チェックごとに 1 回、スナップショット計算ごとに 1 回実行される; 判定をまたいでキャッシュされることは決してないため、時間依存の状態は次の呼び出しに適用される。

Gateway は `@Remote` および `@RemoteScope` の `resources` リーダー、ルックアップと Host Context アダプターの `resource` 宣言、および `typert.resources` のデフォルトフィールドからリソースを解決し、その順序は [API Gateway](../gateway/README.md) が所有する; このパッケージはどの引数フィールドも読まない。どのリソースも名指さない呼び出しは `global` リソースだけに触れるため、`global` ロールだけがそれを許可できる; アクションを `global` ロールに入れると、プリンシパルは呼び出しが名指さない任意のリソースでそれを呼び出せる。リソースが無効な呼び出しは、`decide()` に問い合わせることなく `resource-invalid` で Gateway が拒否する。

`bindings()`、条件、または `explain()` が throw すると、判定は `policy-failed` で拒否される; スナップショットでは、throw する `bindings()` はプリンシパルにグラントを残さず、throw する条件はそのアクションを除外する。したがって、欠陥のあるルールが共有の `$events` ソース、スナップショットストリーム、ページレンダリングを壊すことは決してない。サービスロガーは、各 `invalidate()` と各ポリシーの登録または解除の後、各ポリシーの最初の失敗を報告する; それまでの間、そのポリシーの以降の失敗は沈黙したままである。

転送イベントは、その転送エントリーのリーダーが名指すリソースに対して、またはエントリーが何も宣言しない場合は `global` に対して、アクション `event:<name>` として判定され、非 owner には丸ごと届くか全く届かないかのいずれかである; そのペイロードがトリムされることは決してない。イベントは自身が宣言するすべてのリソースを運ぶため、`undefined` を返すリーダーはイベントのリソースを無効にし、Gateway は `decide()` に問い合わせることなくそれを非 owner に届けない。イベントが名指すリソースは最大 1 つであるため、コレクションの変更はフォローストリーム (`session/follow`、`session/control`、`workspace/follow`) で伝わり、それらのメソッドは `allows()` を通じて各項目をインラインで判定する。

サービスは、webServer が `webserver/index-inject` を通じてレンダリングするすべてのインデックスに、owner ベースライン `{ type: 'baseline', owner: true }` を保持する `REMOTE_ACCESS_SNAPSHOT_KEY` (`__DSH_REMOTE_ACCESS__`) という名前の `global` 行を追加する。owner Host 上でレンダリングされる liveshare ビューアページなど、非 owner のページをレンダリングするビジネスパッケージは、すべてのインデックス注入行の後に、そのグローバルへの `ctx.remoteAccess.snapshotFor(principal)` の代入を配置する。たとえば `ctx.webServer.collectIndexInjections()` の末尾に追加される `global` 行である。後からの代入が owner ベースラインを置き換え、Client エントリーはマウント時にそのグローバルを読むため、ページは owner のグラントではなくビューアのグラントで開く。

| `remote-access/denied` の `details.reason` | 原因 |
|---|---|
| `resource-invalid` | `decide()` の前に Gateway が与える: リソースリーダーが throw したか空リストを返した、またはリソース id (Context の同一性を含む) が空でない文字列でない。 |
| `no-allow` | プリンシパル kind にポリシーがない、または一部のリソースでアクションを許可するバインディングがなく、条件も `explain()` も理由を名指さない。 |
| `policy-failed` | `bindings()`、条件、または `explain()` が throw した; 失敗は上記のとおりログに記録される。 |
| 条件または `explain()` の理由 | バインディングが許可しない最初のリソースについて、一致するバインディングの最初の拒否条件が理由を名指す; それがなければ `explain(request)` が名指す。 |

スナップショットのグラントは、プリンシパルのバインディングが名指すリソースごとに、それらのバインディングのロールのエンドポイントアクションのうち `decide()` が呼び出し引数なしでそこで許可するものをソートして列挙する。したがってスナップショットは、同じプリンシパル、アクション、リソースに対して `decide()` と一致する; そのようなアクションがないリソースはグラントを得ず、許可集合が空になるとストリームが `remove` をプッシュする。`event:` アクションがスナップショットに入ることは決してない。スナップショットは `invalidate()` とポリシーの登録または解除の後にのみ再計算される。

<a id="client-face"></a>
## Client フェイス

Client エントリーは、インデックスが `REMOTE_ACCESS_SNAPSHOT_KEY` の下で注入したベースラインを同期的に読み、`mountAccess(ctx, contribution, initial)` を通じて生成された `remoteAccess` コントリビューション自体をマウントし、スナップショットストリームをフォローし、次を提供する:

- Client サービス `ctx.remoteAccess.source(kind, id, action)` — 宣言された kind の 1 つのリソースに対する `(kind, id, action)` ごとの同一性安定のブール値ソース;
- 標準 Hook `useRemoteAccess(action)` — `global` リソースについて答える。

ドメイン UI パッケージは `source()` を通じて自身のリソース Hook を公開する: [ui-session](../../client/ui-session/README.md) は Session リソース上の `useSessionAccess(sessionId, action)` と Session スコープの `useAccess(action)` — `global` の `useRemoteAccess` とは別の名前 — を提供し、[ui-workspace](../../client/ui-workspace/README.md) は Workspace リソース上の `useWorkspaceAccess(workspaceId, action)` を提供する。Hook の `action` は `RemoteEndpoint`、すなわちいずれかの Client Remote 名前空間が宣言するエンドポイントである。非 owner の答えは、そのリソースのグラントがアクションを列挙しているかどうかであり、`global` の答えにフォールバックすることは決してないため、グラントがないリソース、またはグラントがアクションを列挙していないリソースは false と答える。owner にはすべての答えが true である; 注入されたベースラインのない非 owner ページ、およびストリームが終端失敗した非 owner ページは false と答える; 終端失敗はそのエラーとともに報告され、非 owner にはページを再読み込みするよう助言し、owner には自身の答えが影響を受けない旨を注記する; 再接続は最後のスナップショットを保つ。不正な注入ベースラインはマウントを失敗させる。Hook はリクエストを発行することは決してなく、Host は依然としてすべての呼び出しをチェックする。Client スペックでは [`dsh-client-test-runtime`](../../test-support/client-runtime/README.md) がこの行を全許可アクセスに置き換える。

<a id="model-experience"></a>
## モデル体験

なし。本パッケージは Client 呼び出し元の Remote アクセスを判定し、モデル向けのものは何も登録しない。

#### KV キャッシュへの影響

直接の影響はなし。

## 既知の制限と延期された作業

<a id="known-limitations-and-deferred-work"></a>

- スナップショットとリストフィルタリングの判定は呼び出し引数を運ばないため、`args` から答えを精緻化する条件は、スナップショットが許可として示す呼び出しを拒否し得る。
- リソースリーダーと自動解決は、メソッドが触れるすべてのリソースをカバーしなければならない; 呼び出しが名指さないリソースはチェックされないため、名指されたリソースにグラントされたプリンシパルはそれに到達する。
- デフォルトのリソース解決は wire フィールド名に一致する; 登録された kind の名前を持つフィールドをメソッドに追加すると、その kind のリソースが呼び出しに追加される。
- 正確な Connection Fetch ルートは Gateway を通らない; 共有 Fetch ハンドラーは、各ルートが独自のアクセスルールを宣言するまで、すべての非 owner Peer に対してそれらを 403 で拒否する。
- インタラクションへの参加 (転送された waterfall への応答) は owner 専用である: 非 owner の `$events` ストリームは、ポリシーがイベントのリソース上で `event:<name>` アクションを許可するブロードキャストフレームだけを受け取る。
- `api-session/added` は `SessionSummary` 全体を運ぶため、それを受信することを許可された非 owner はその `parentSessionId` も知る。
- グラントされた Session の cwd とツールパスにはすでに owner の絶対パスが含まれるため、`$events` の ready フレームは非 owner に `home` を含む完全な `host` を与える; Gateway は `home` を別途隠すことはない。
- `workspace/follow` は、ポリシーが可視性を取り消した Workspace を、その Workspace または Workspace 順序が次に変化したときにのみ認識し、そのとき非 owner のベースラインを置き換える; アクセス変更だけではフレームは送られない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
