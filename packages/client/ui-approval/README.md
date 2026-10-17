---
description: "スコープ付き対話パス経由で Host 権限要求に答えるブラウザー承認 UI。"
kind: "package-reference"
---
# @deepseek-ai/dsh-client-ui-approval

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Agent スコープ Remote Event ウォーターフォール上のブラウザー承認表示。プラグインは各待ち要求を `ctx.uiSession` 経由で公開し、Conversation コンポーザーを乗っ取り、相関ツール詳細を任意描画し、ユーザーの決定を待ち Host 要求に返す。待ち Host 操作の承認をブラウザーで集める場合に使う。

## 目次

- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

承認詳細領域にフォーカスして Enter で承認し、Escape で拒否する。マウント済みプラグインは両キーを編集可能ショートカットに対して予約する。フォーカス済み Reject ボタン上の Enter は本来の拒否動作を保持する。入力制御と IME 候補は独自キーを保持する。キーボードとポインター操作は 1 つの待ち要求ロックを共有する。引っ込められたり置換された要求は別回答を受理できず、より早い失敗回答はその置換の錠を解けない。

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはブラウザーで承認要求を表示し、モデルに面した登録は一切ない。

#### KV キャッシュへの影響

なし。承認要求と応答描画はモデルリクエストを変えない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **パネルは一過性決定のみ公開する** — 1 回許可と拒否を支援し、永続権限ポリシーは Host 側承認パッケージが所有のままである。要求者提供ローカライズ表示文は監査理由を変えずモデル生成文を翻訳せずに UI 言語に従う。


<a id="dev-note"></a>
### Dev Note

<details>
<summary>メンテナ向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
