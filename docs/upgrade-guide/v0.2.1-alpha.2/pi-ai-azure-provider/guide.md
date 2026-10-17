---
kind: upgrade-guide
description: "The pi-ai Azure provider route is renamed from azure-openai-responses to azure."
---

# Azure プロバイダールートの改名

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

インストール済み pi-ai カタログは Azure プロバイダーを `azure-openai-responses` ではなく `azure` として識別する。`azure` ルートは Responses と Chat Completions の両モデルを含む。Responses API 識別子は `azure-openai-responses` のままであり、`AZURE_OPENAI_*` 環境変数も名前を保つ。旧プロバイダーキーを用いる設定とモデル選択は Azure カタログを解決しなくなる。

## 移行手順

1. `$DSH_HOME/profiles/<profile>/cordis.patch.yml` または他の提供層内の `llm-pi-ai` 設定で、`config.providers.azure-openai-responses` を `config.providers.azure` に改名する。既存フィールドと `apiKeyEnv` 参照は保持する。
2. `models` 下にカタログモデル ID を使う。カスタム Azure デプロイ名は `AZURE_OPENAI_DEPLOYMENT_NAME_MAP` で対応付ける。混成カタログはカタログに無いモデル ID のプロトコルを推論できない。ルートレベルの明示的 `api` はそのルート上の全モデルを上書きし、Azure プロバイダーを選択しない。
3. 明示的なリクエスト/既定プロバイダー選択を `azure` に更新し、既存セッション継続時は Azure モデルを再選択する。旧エントリ用にキーが保存されていた場合は設定 → モデルで新しい Azure エントリを構成する。履歴セッションイベントは編集しない。
4. 設定 → モデルが `azure` を提供し期待モデルを列挙すること、構成したデプロイで短いリクエストを送信できることを確認する。
