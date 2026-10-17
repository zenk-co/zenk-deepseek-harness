---
description: "セッションコントローラーの一覧、対話状態、セッションごとのコンテキスト向け React および Slot アダプター。"
kind: "package-reference"
---
# @deepseek-ai/dsh-client-ui-session

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

このパッケージを使うと、標準 Slot フック経由でセッションカタログ、保持情報、統一 UI 状態を公開できる。`SessionBinding` ごとのフックと props を実体化し、`SessionProvider` は外側のバインディングを継承するか、明示的な `SessionReference` をバインドできる。コントローラートランスポート、履歴、参照を所有せず、プロセス局所の保留中対話と完了リマインダーポリシーを所有する。

実行状態は Host の一覧ベースラインまたは状態イベントから来る。サブエージェントカタログ行と保持されたサブエージェントフォールバック行は実行状態を確立しない。メイン view 参照は引き続き完了を確認する。

## 目次

- [アクセスフック](#access-hooks)
- [モデル体験](#model-experience)
- [既知の制限と将来の課題](#known-limitations-and-deferred-work)
- [開発ノート](#dev-note)

-----

<a id="access-hooks"></a>
## アクセスフック

このパッケージはクライアントの `remoteAccess` サービスを挿入し、その `source()` 上でセッションアクセスフックを公開する。ルートの `useSessionAccess(sessionId, action)` は1つのセッションリソースに答え、セッションスコープの `useAccess(action)` はバインド済みセッションのリソースに答える。`global` リソースへの答えは別のフック `useRemoteAccess(action)` であり、互いに隠さない。セッションがバインドされていない間、セッションメイビースコープの `useAccess(action)` は `undefined` を返し、呼び出し元はそれを許可なしとして扱う。`global` リソースへの決定は代わりに `useRemoteAccess` を読む。スナップショットセマンティクスは [`dsh-api-remote-access`](../../api/remote-access/README.md#client-face) に属する。

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはブラウザー側セッション状態を適合させるものであり、モデル向けには何も登録しない。

#### KV キャッシュへの影響

なし。セッションセレクターと Slot スコープはモデルリクエストを組み立てない。

## 既知の制限と将来の課題

<a id="known-limitations-and-deferred-work"></a>

- **保留中の対話はプロセス局所の投影である** — 所有する Remote ウォーターフォールはブラウザー再接続後に未完了リクエストを再送しなければならない。


<a id="dev-note"></a>
### 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
