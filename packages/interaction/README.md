---
description: "Package map for the human-collaboration capability family: slash commands, one-shot approvals, permission presets, and the question/answer seam that lets a running agent pause for a human decision."
kind: "package-group"
---

# interaction/ — 人間協調プレーン

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`interaction/` グループは、実行中のエージェントを人が導く方法を対象とする。モデル往復を要しない即時アクションにはスラッシュコマンド、機微操作にはワンショット承認、サンドボックスと承認動作をまとめて選択する権限プリセット、エージェントが情報や決定を必要とする場合の質問を使用する。対話型アプリケーションはこれらのケイパビリティを人に公開し、自動化は ACP 経由で自身の承認を処理する。以下のパッケージマップで各ケイパビリティを区別し、完全な動作と設定へリンクする。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ

各パッケージ README とそのサブシステムリファレンスが網羅的な契約を所有する。

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`commands/`](commands/README.md) | モデル往復なしにエージェントへ直接実行するスラッシュコマンドをユーザーが入力できる | `ctx.commands` |
| [`user-approval/`](user-approval/README.md) | 構成済み回答者にワンショットの許可/拒否決定を求め、回答なしではフェイルクローズドする | `ctx.approval` |
| [`permission-presets/`](permission-presets/README.md) | サンドボックスモードと承認ポリシーを束ねたユーザー向け Permissions セレクター | `ctx.permissionPresets` |
| [`user-questions/`](user-questions/README.md) | エージェントが待機する検証済み質問スキーマとスコープ付き回答者ウォーターフォールを定義する | `ctx.userQuestions` |
| [`tool-ask-user/`](tool-ask-user/README.md) | モデルが人間に決定を求められるよう `ask_user_question` ツールを公開する | `ctx.tools` に登録 |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

共有語彙のサブシステムリファレンスから始め、次に隣接する自動化と構成サーフェスを読む。

- [コマンドサブシステム](../../docs/subsystems/commands.md) — コマンドレジストリーの意味と `ctx.commands` Cordis サーフェス。
- [承認サブシステム](../../docs/subsystems/approval.md) — 要求/結果語彙、回答者ウォーターフォール、セッションごとのポリシー。
- [権限プリセットサブシステム](../../docs/subsystems/permission-presets.md) — プリセット表とノブ書き戻し。
- [ユーザー対話サブシステム](../../docs/subsystems/user-questions.md) — 質問語彙、回答者ウォーターフォール、保留質問ライフサイクル。
- [ACP グループ](../acp/README.md) — 自身のエージェント用承認要求に応答する自動化専用トランスポート。

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
