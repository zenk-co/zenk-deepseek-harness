---
description: "Account screens use authenticated Remote commands and a snapshot stream. The controller exposes login state without returning tokens or PKCE secrets."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-account-controller

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

アカウント画面は認証済み Remote コマンドとスナップショットストリームを使用する。コントローラーはトークンや PKCE シークレットを返さずにログイン状態を公開する。

## 目次

- [このパッケージを使う](#use-this-package)
- [モデル体験](#model-experience)
- [既知の制限と後回しにした作業](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## このパッケージを使う

アカウント名前空間は getState、getProfile / getBalance、getUnnotifiedBonuses、ackBonusNotified、startSignIn、cancelSignIn、signOut、watch を公開する。watch は初期の完全な状態と、その後の完全な状態を送出する。切断はログイン試行ではなく観測を停止する。取り消しは試行 ID を指定するため、古い画面が新しいログインを取り消すことはない。アカウントが存在しないか変更されている間、getUnnotifiedBonuses は null を返し、ackBonusNotified は false を返す。呼び出し元が再試行すべき失敗は、投げられた Remote エラーとして届く。

Platform に到達するすべての操作は、呼び出し元 UI の `AccountClientMetadata`（クライアントバージョン、アクティブ言語、秒単位 UTC オフセット）を受け取る。これにより Host は最後に見た呼び出し元ではなく、要求した UI を報告する。取り消しと watch は Platform に到達しないため ID を持たない。

`watchExpiry` は、初期アイテムやリプレイなしにライブのクレデンシャル有効期限通知を配信する。Desktop は Welcome への切り替え時にワンショットトーストを受け渡すためにこのストリームを使用する。

`hasRunningAccountTasks` は、アカウント所有の述語により実行中のエージェントを検査する。対象はツールと再試行を含む最新のログ済みリクエストコンテキストである。アイドル状態のエージェントと API キーコンテキストは除外される。アカウントプロバイダーはクレデンシャル除去時、一致するタスクを独自に取り消す。

<a id="understand-the-implementation"></a>
## 実装を理解する

コントローラーは操作をアカウントサービスに転送し、独自のアカウント状態を保持しない。

<a id="further-exploration"></a>
## さらに調べる

[クレデンシャルサブシステム](../../../docs/subsystems/credentials.md)がストレージ API を所有し、[アーキテクチャ](../../../docs/architecture.md)がアプリケーション構成を説明する。

<a id="model-experience"></a>
## モデル体験

なし。アカウントクレデンシャルは HTTP 認証に影響し、モデルプロンプト、セッションログ、ツール結果には入らない。

#### KV キャッシュへの影響

モデルリクエストプレフィックスの変更はない。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

- 切断された UI は watch 経由でアカウント状態を回復できるが、Host 終了後に試行を再開できない。クレデンシャルとリクエストトークン解決は Remote 操作ではない。

<a id="dev-note"></a>
### 開発メモ

[デスクトップログイン決定](../../../.agents/notes/implemented/architecture/2026-09-14-deepseek-account-login.md)は取り消しとストレージ所有権を記録している。
