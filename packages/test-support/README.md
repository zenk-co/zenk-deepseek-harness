---
description: "test-support グループマップ: キーレスのテストハーネス、LLM モック・リプレイサーバー、Loader スモークヘルパー。リポジトリテストを書いて実行する開発者向け。"
kind: "package-group"
---

# packages/test-support

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

test-support グループは、リポジトリテストが実際の製品を動かすための決定論的でキーレスの手段を提供する。Loader アプリケーションハーネス、セッションログスナップショットアダプター、リプレイ LLM プラグイン、スクリプト化可能な OpenAI 互換フォールトサーバーを含む。各パッケージはサポート層のインフラであり、製品契約と製品利用者を得たパッケージはこのグループから移る。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発者ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

| Package | Role |
|---|---|
| [`session-snapshot`](session-snapshot/README.md) | プロファイル駆動テスト向けのセッションログスナップショット対応とプロトコルアダプターを提供する |
| [`agent-loop-testkit`](agent-loop-testkit/README.md) | 具象 AgentLoop を動かすテスト向けの共有前提サービスを提供する |
| [`client-runtime`](client-runtime/README.md) | ブラウザー機能スペック向けの jsdom スロットテストベンチを提供する |
| [`remote-mock`](remote-mock/README.md) | エンドポイント名付き Typert Remote モックと、全体クライアントスペックがインストールする Connection キャリア面を提供する |
| [`loader-smoke`](loader-smoke/README.md) | Loader 構成のアプリケーションを起動し、スモークテスト向けにフィクスチャターンを駆動する |
| [`llm-mock-server`](llm-mock-server/README.md) | 回復テスト向けのスクリプト化可能な OpenAI 互換フォールトサーバーを提供する |
| [`llm-replay`](llm-replay/README.md) | キーレステストとデモ向けに記録済みモデルストリームをリプレイする |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

- [テストポリシー](../../docs/testing.md) — これらハーネスが支えるキーレススナップショット層と、それが必要になる場合。
- [パッケージグループ](../README.md) — サポートグループと製品グループの関係。

-----

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
