---
description: "設定ドメイン基盤プラグイン。dsh Web クライアント向け共有設定フォーム、スキーマサービス、正準設定スロット型契約。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージは、Web クライアント機能が独自の転送やスキーマ処理を実装せずに、Host 設定文書に裏打ちされた編集可能設定を公開できるようにする。各機能は名前空間スコープの読み書き、アトミックな複数フィールド更新、スキーマ検証、同時変更への黙った上書き防止を得る。また設定 chrome・ページ・ヘッダーアクション・プラグイン方法・オンボーディングの標準拡張点を提供し、自らは何も描画しない。設定を持つ任意の機能は、表示パッケージに依存せずこれを使える。設定シェルは別パッケージが提供する。

## 目次

- [このパッケージの使い方](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの使い方

機能プラグインは、転送やスキーマ処理を再実装せずに好みを保存・編集するためこのパッケージを使う。合成ごとに 1 回マウントする。`remote` サービスをその `settings` 名前空間で注入し、ブラウザー内の単一 `settings.describe` リーダーを所有する。

### 設定フォーム

`ctx.configForms.developerTools` は Coding Tools スイッチと共有 Web・desktop 設定 `ui-settings.enabled` (既定 `true`) を所有する。その `enabled` オブザーバブルは受理済み選択を公開し、`setEnabled` は同じ順序付き設定書き込みを使う。Desktop とすべての認証済み Web ブラウザーは Host 文書に永続化する。これは表示と HTML プレビュー権限を制御し、Host 認可や Session 記録は制御しない。Host 支援クライアントは、最初の受理済みスキーマ解決値が届くまで開発者機能を無効のままにする。初期応答の欠落や失敗は有効化しない。後のリフレッシュは最後の受理済み選択を保持する。

機能アダプターは `ctx.configForms.get(entryId)` を使い、その Host エントリーの全エディターが共有する受理済み値と書き込みキューを得る。スナップショットは解決済み `value`、継承 `base`、生 `user`、リビジョン、書き込み可否を含む。`set` と `unset` は 1 操作を、`mutate` は 1 アトミック操作リストを送る。ステージングエディターは編集前に読んだリビジョンを渡し、競合はドラフトを保持する。アンセットは上書きを除去して継承を復元する。

設定フォームはすべての認証済みブラウザー向けに Host 設定サービス経由で永続化される。このポリシーは[認証済みブラウザー Host 設定 Note](../../../.agents/notes/implemented/bug-fix/2026-09-15-authenticated-browser-host-preferences.md)が所有する。書き込み受理可否の権威は `settings.describe.writable` である。

### 提供名前空間への追従

別プラグインが所有する名前空間を編集するページは `ctx.configForms.whileServed(namespaces, register)` 経由で登録する。`register` は列挙名前空間のいずれかが共有ミラーに入った時点で 1 回動き、Host が提供する名前空間集合を受け取り、登録の disposer を返す。その disposer は、どれも提供されなくなった時点か、`whileServed` が返す disposer が動く時点で動く。呼び出し元は返された disposer を所有し `ctx.effect` で包む。`get` と異なり、サービスは呼び出し元コンテキストに何も登録しない。所有者を合成しなかったデプロイではページの痕跡は出ず、Host が提供を止めた名前空間は引っ込む。Plugins ページ上の 4 つの公式ページはこれに乗り、コンパニオンパッケージごとに 1 つである。

### 設定スロットの充填

設定サーフェスはこのパッケージが宣言するスロット型に登録する。シェル (占有者 `sidebar.settings`、ナビゲーション、chrome) は ui-settings-general にあり、機能ページは `settings.section` 貢献を登録する。Plugins セクションは `settings.plugins.tab` ページをホストし、オンボーディング手順は `settings.onboarding` を登録する。横断名前空間サーフェス (スキーマ内観、提供名前空間ディレクトリ、`hasDocument`) は同じミラーを `ctx.configForms.describe()` 経由で読む。

### 観測可能な成功と失敗

コミット済み書き込みはその回答を共有ミラーに折り込む。拒否された書き込みは最新の Host 値をリフレッシュする。ブラウザー検証は直列化 Config スキーマを使い、Host は直列化できない検査を含む完全構成を検証する。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

任意 `settings.launcher` 貢献は、サイドバージオメトリ、開いた Settings パネルがサイドバーを覆うか、設定ナビゲーションコールバック、実効 Settings キーラベルとアクセス可能組み合わせを受け取る。シェルは、束縛なしコマンドのショートカット表示を省き、launcher 登録なしでは素の Settings トリガーを保持する。

<details>
<summary>実装の内部 — クリックして展開</summary>

このパッケージは 1 つの所有権規則を実現する。ブラウザーは設定文書の共有ミラーを 1 つ保持し、すべての派生サーフェスはその単一情報源を読むため、任意の瞬間に同じ文書リビジョンを示す。

### describe ミラー

`ui-settings` エントリーの Host Config は既定オン `enabled` 設定を宣言する。Client プラグインは `remote` をその `settings` 名前空間で注入し、ブラウザー内の唯一 `settings.describe` リーダーを所有する。転送済み `settings/document-updated` イベントごとと `connection/reset` 時 (初回接続を含む、積極読み取りと SSE 購読の間にコミットが着地する窓を閉じる) にリフレッシュされる共有ミラーである。横断名前空間サーフェスは `ctx.configForms.describe()` 経由でそれを読む。読み/折り込み面 (`getSnapshot`/`subscribe`/`ensure`、書き込み回答を折り込む `acceptView` 付き) である。

### 共有エントリー書き込み

プロバイダーは Host エントリーごとに購読と書き込みキューを含むコントローラーを 1 つ所有する。繰り返しの `get(entryId)` は同じフォームを返す。コンシューマーは独自ビュー購読を解放する。呼び出し元スコープ設定束縛は作られない。起動 RPC 予算は共有 describe リーダーを扱う。

### スキーマサービス

`ctx.settingsSchema` はスキーマを再水和し、ドラフトを検証し、入れ子値を編集する。無効な wire 値は受理済み値を置き換えない。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

これらのページは設定サーフェスファミリーとその背後の耐久シームを扱う。

- [ui-settings-general](../ui-settings-general/README.md) — 設定シェル。トリガー chrome、ナビゲーション、General セクション、オンボーディング投影。
- [ui-settings-plugins](../ui-settings-plugins/README.md) — 目録方法周りの Built-in plugins セクションシェル。
- [ui-settings-shell](../ui-settings-shell/README.md)、[ui-settings-agent-loop](../ui-settings-agent-loop/README.md)、[ui-settings-subagent](../ui-settings-subagent/README.md)、[ui-settings-web-search](../ui-settings-web-search/README.md) — Plugins ページ上の公式設定ページ。各々 `whileServed` で名前空間を追う。
- [ui-settings-models](../ui-settings-models/README.md) — Models ページとこの基盤上の DeepSeek オンボーディング。
- [settings](../../settings/README.md) — 耐久ユーザー設定シームとそのファイルプロバイダー。
- [ui-sidebar](../ui-sidebar/README.md) — 設定トリガーを下部座席にホストするサイドバーシェル。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはブラウザー側 UI プラグイン層であり、モデルに面した登録は一切ない。

#### KV キャッシュへの影響

なし。このパッケージはプロバイダーリクエストを組み立ても送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>


これらの制限は設定転送の到達範囲と設定文書共有者を定義する。これらは現在のパッケージ制約である。

- **Host 設定は認証済みエントリー横断で共有される** — 同じ設定文書に触るブラウザーは永続設定を共有し、ブラウザー単位選択は保持しない。

<a id="dev-note"></a>
### Dev Note

<details>
<summary>メンテナ向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
