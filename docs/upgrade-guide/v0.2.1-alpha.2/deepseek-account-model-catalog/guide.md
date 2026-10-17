---
kind: upgrade-guide
description: "DeepSeek アカウントルートはモデルカタログを受け付けなくなる。アカウント一覧がモデルを供給し、modelOverrides がそれらを調整する。"
---

# DeepSeek アカウントのモデルはアカウント一覧から取得される

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

`deepseek-account` ルートは従来、`llm-deepseek-account` エントリの `models` フィールドからモデルカタログを読み取っており、モデルページでアカウント用に編集できた。現在ルートはアカウントの `GET /models` エンドポイントの一覧からモデルを提供し、一覧読み込みまでは内蔵カタログを出し、モデルごとの調整は `modelOverrides` 経由でのみ受け付ける。このルート向けのエディターをモデルページは提供しなくなる。一覧のモデルが新しい DeepSeek Harness を要求する場合があり、そのようなモデルは非表示となり、それへの要求は `CLIENT_UPGRADE_REQUIRED` で失敗する。エントリに残った `models` フィールド（以前のモデルページエディターが保存したものを含む）は、読み込み時に `llm-deepseek-account: models is no longer configurable` でプラグインを停止させ、フィールド削除までデスクトップと Web にアカウントモデルは表示されない。保存済みカタログのないサインイン済みアカウントでは操作は不要である。

## 移行

1. `$DSH_HOME/profiles/<profile>/cordis.patch.yml` を開き、`id: llm-deepseek-account` のエントリを探す。
2. その `models` フィールドを削除する。フィールドを変更したモデルごとに、変更したフィールドのみを `modelOverrides.<model id>` の下に移す。

   ```yaml
   - id: llm-deepseek-account
     config:
       modelOverrides:
         deepseek-flash:
           maxTokens: 131072
   ```

3. DeepSeek Harness を再起動し、DeepSeek アカウントにサインインして、モデルセレクターにアカウントモデルが並び、モデルページにアカウントがサインイン済みと表示されることを確認する。一覧のモデルが拒否した上書き、または未知のモデルを指名する上書きは、モデルページ上のアカウント診断として表示される。
