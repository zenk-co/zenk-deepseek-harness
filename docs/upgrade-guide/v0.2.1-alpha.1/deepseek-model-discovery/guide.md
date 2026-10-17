---
kind: upgrade-guide
description: "DeepSeek API キーのモデル検出には設定済み資格情報が必要である。"
---

# DeepSeek API キーのモデル可視性

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

`deepseek-official` ルートは以前 API キーなしで設定済みモデルを列挙していた。現在は資格情報がない場合に空のカタログを返すため、Desktop と Web は DeepSeek グループを隠す。モデル検出は不正な資格情報と資格情報ルックアップ失敗を報告する。カタログにない保存済み・デフォルト選択は、保存された選択を変えずに「Select model」と表示される。独立した DeepSeek アカウントルートは引き続きアカウントログインを使う。

## 移行

1. API キールートを使うには Settings → Models でキーを設定するか、起動環境を通じて `apiKeyEnv` が指名する参照（デフォルト `DEEPSEEK_API_KEY`）を提供する。
2. モデルセレクターを開き直し、DeepSeek グループが現れることを確認する。カスタム検出コンシューマーは資格情報設定前の空カタログを処理しなければならない。モデル列挙はリモート API がキーを受け付けることを検証しない。
