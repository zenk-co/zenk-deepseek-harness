---
description: "DeepSeek api-key 認証とモデル検出。"
kind: "package-reference"
---

# @deepseek-ai/dsh-llm-deepseek-api-key

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`deepseek-official` 向けの認証とモデル検出を登録する。このプラグインは [Messages トランスポート](../llm-deepseek/README.md)を共有し、資格情報の解決とカタログの利用可否を所有する。
Messages と Files の両リクエストに対して、検証済み API キーを `x-api-key` で返す形で認証解決を行う。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

<a id="use-this-package"></a>
## このパッケージを使う

`apiKeyEnv` の既定値は `DEEPSEEK_API_KEY` であり、リクエストごとおよびモデル検出ごとに解決される。credentials サービスが存在する場合はそちらの優先順位が適用され、そのサービスを持たない構成だけが起動環境を直接読む。資格情報が欠けているリクエストは `MISSING_CREDENTIAL` で失敗し、不正な形式の資格情報は `INVALID_CREDENTIAL` で失敗する。資格情報が欠けている場合、モデル検出は空のカタログを返し、設定エントリを残したままモデルセレクターからルートを隠す。不正な形式の資格情報やその他の検索失敗は伝播する。キーの追加や削除は次回の検出呼び出しに影響する。

```yaml
- id: llm-deepseek
  name: '@deepseek-ai/dsh-llm-deepseek-api-key'
  config:
    reasoningEffort: high
    apiKeyEnv: DEEPSEEK_API_KEY
```

エンドポイントと資格情報の参照は 1 回の構成解決から得られる。実行中のリクエストはそのスナップショットを保持し、後続の更新は後続の呼び出しに影響する。アカウントのログイン状態はこのルートの資格情報を変えられない。
`models` はこのプロバイダー向けに独立して構成可能なカタログであり、既定値とプロトコルケイパビリティは共有トランスポートから得られる。検出は推論エンドポイントをプローブしない。設定の名前空間は Cordis エントリ id であり、エントリがなければプラグイン名である。製品プロファイルは公式エントリ id `llm-deepseek` を保持し、アカウントルートには `llm-deepseek-account` を使う。

<a id="understand-the-implementation"></a>
## 実装を理解する

登録とリスナーはプラグインと共に破棄される。共有 Host 配線が添付ファイル、リクエスト拡張、匿名 identity、原子的なリトライポリシー更新を提供し、このプラグインは自身のルートだけを登録する。

<a id="further-exploration"></a>
## さらに調べる

[LLM ストリーミング](../../../docs/subsystems/llm-streaming.md) · [Messages](../llm-deepseek/README.md)

<a id="model-experience"></a>
## モデル体験

### 認証済みモデルリクエスト

#### モデルが見るもの

`deepseek-official` 上のリクエストでは、このプラグイン由来のモデル可視テキストは追加されない。共有 Messages トランスポートがリクエストをシリアライズする。

#### トークンへの影響

認証と検出は入力トークンを追加しない。実際の使用量は選択されたモデルとリクエスト内容で決まる。

#### KV キャッシュへの影響

資格情報とカタログの利用可否はモデル入力に入らない。リクエストプレフィックスのシリアライズはプロトコルトランスポートが所有する。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- カタログは構成メタデータであり、モデルが受け入れられることのリモート検証ではない。実際の呼び出しは依然として失敗しうる。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

登録と認証のテストは、共有トランスポートパッケージ内の Loader 構成もカバーする。

</details>
