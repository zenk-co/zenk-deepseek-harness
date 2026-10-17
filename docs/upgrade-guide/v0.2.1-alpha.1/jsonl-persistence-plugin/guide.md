---
kind: upgrade-guide
description: "JSONL persistence uses a namespace plugin import; direct service-class construction and class type annotations must use the persistence service instead."
---

# JSONL 永続化をプラグイン経由でマウントする

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

`@deepseek-ai/dsh-session-persistence-jsonl` は名前付き `name`、`Config`、`apply` エクスポートによる関数プラグインをエクスポートし、デフォルトエクスポートは無い。デフォルトインポート、直接構築、サブクラス化、`instanceof`、クラス型注釈が影響を受ける。プラグインはこのプロバイダーの削除によるコンシューマーアンロードで発動するリスナーとハンドルを保持し、並行ルート破棄は順序不定のままである。`sessionPersistence` サービス API、YAML 設定、保存ファイルは不変である。

## 移行手順

1. デフォルトインポートを `import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'` に置き換える。既存の `ctx.plugin(JsonlSessionPersistence, config)` 呼び出しは引き続き有効であり、直接構築をこのマウント呼び出しに置き換える。動的インポートでは `await import(...)` が返すモジュール名前空間をその `.default` の代わりに使う。コンシューマーは `inject: ['sessionPersistence']` を宣言し `ctx.sessionPersistence` にアクセスする。
2. サービス注釈には `@deepseek-ai/dsh-session-persistence` の `SessionPersistence` 型を使う。具体クラスの `instanceof` 検査とサブクラスをそのサービスのコンシューマーに置き換える。具体的な JSONL クラスはプライベートである。
3. プラグイン起動を待機し、セッションを作成・フラッシュ・再開できることを確認する。バックエンドのアンロードが待機するよう、非同期コンシューマークリーンアップを `sessionPersistence` を注入するスコープに登録する。
