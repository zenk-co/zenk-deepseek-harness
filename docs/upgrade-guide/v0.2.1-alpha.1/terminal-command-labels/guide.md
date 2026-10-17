---
kind: upgrade-guide
description: "カスタム TerminalBlock コンシューマーは、はみ出すコマンド行にローカライズされたアクセシブル名を提供しなければならない。"
---

# ターミナルコマンドラベル

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

`@deepseek-ai/dsh-client-ui-primitives` の `TerminalBlockLabels` は `commandLine(line: number): string` フォーマッターを必要とする。以前、呼び出し側はコマンド行にアクセシブル名を提供しなかった。水平にはみ出す各行はキーボードフォーカス可能なグループにこの名前を使うようになった。収まる行（折り返し行を含む）は Tab ストップを追加しない。これは `TerminalBlock` を描画するカスタム UI プラグインに影響する。

## 移行

1. `TerminalBlock` に渡す各 labels オブジェクトに `commandLine` を追加する。引数は作成時の行番号で、1 から始まる。
2. プラグインのロケール辞書を通じて「Command line 1」のようなローカライズ名を返す。元のコマンドテキストはこの名前と分けて保つ。
3. プラグインをリビルドする。長いコマンドがキーボードフォーカスを受け、矢印キーでスクロールできること、短いコマンドや折り返しコマンドが Tab ストップを追加しないことを検証する。
