---
kind: upgrade-guide
description: "レガシーな ui-chat.transcriptView 値 normal と、非 Desktop Web での未設定値は、Standard ではなく Detailed として表示されるようになった。"
---

# レガシーな `normal` の作業詳細は Detailed として表示される

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

ホスト設定 `ui-chat.transcriptView` は Settings → General → Work details を選択する。v0.1.7-rc.2 ではクライアントはレガシーの保存値 `normal` を `standard` として表示し、設定が存在しない、`null`、または無効な場合、すべてのクライアントが `standard` を使っていた。

次リリースから:

- 保存済み `normal` は Desktop と Web で `detailed` として表示される。ディスク上の保存値は書き換えられない。
- 存在しない、`null`、または無効な値は非 Desktop Web（npm の `dsh web` インストール）で `detailed` として表示される。Desktop は引き続き `standard` を使う。
- 保存済みの `compact`、`standard`、`detailed`、`verbose` 値は変わらない。

以前の表示に頼っていたユーザーは、実行中のターンが折りたたみサマリーではなく展開されたプロセスグループ本体で見える。

## 移行

1. 以前の表示を保つには Settings → General → Work details を開いて Standard を選ぶ。クライアントは `standard` を `ui-chat.transcriptView` に保存し、以降のデフォルト変更はそれに触れない。
2. 確認: ツールを呼び出すターンを開始し、プロセスグループがライブタスク詳細付きの折りたたみサマリーを表示することを確かめる。
