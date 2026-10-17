---
kind: upgrade-guide
description: "Python PTC 構成はサンドボックスサービスを要求し、直接の Python ファイル操作は解決済みファイルポリシーに従う。"
---

# Python PTC は共有ファイルサンドボックスを適用する

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更点

`@deepseek-ai/dsh-experimental-ptc-runtime-python` は `sandbox` と `sandboxPolicy` を要求する。以前は直接の Python ファイル操作は閉じ込めなしに実行され、プロバイダーは明示的な `sandboxPolicy` 入力を拒否していた。現在は各プログラムに共有ポリシーを適用し、`PtcRunResult.sandbox` で閉じ込めを報告する。閉じ込めを確立できない場合、制限付き実行は `sandbox-unavailable` で失敗する。

これは Python ランタイムを選択するカスタム構成に影響する。出荷プロファイルは引き続き Node ランタイムを使う。Python は macOS または Linux にローカルであり、設定済みリソース予算と、サポート外の呼び出しごとタイムアウト上書きは変更ない。

## 移行手順

1. Python ランタイムを選択する `cordis.yml` またはプロファイルパッチで、既存の共有サンドボックスサービスを保持する。欠けている場合は `@deepseek-ai/dsh-sandbox-local` とその要求する `@deepseek-ai/dsh-session-projection` サービスを持つ `@deepseek-ai/dsh-sandbox-policy` をマウントする。[Python ランタイム要件](../../../../packages/experimental/ptc-runtime-python/README.md#use-this-package) を参照すること。
2. エージェントレス呼び出し向けに共有 `sandbox-policy` 行の `mode` と `workspaceRoot` を設定する。既定モードは `read-only` であり、`workspace-write` はワークスペース書き込みを許可する。PTC ツール呼び出しはセッションの解決済みポリシーとディレクトリーを使う。Python 専用のサンドボックス設定を追加しないこと。
3. 直接のサービス呼び出し元は `runtime.run(runtime.resolve(request))` を使う。信頼済み `sandboxPolicy` は明示的な上書きが必要な場合にのみ渡す。モデル向け `run_code` は1回限りで広いモードにする既存の承認フローを使い、入れ子ツールの権限を変更したりプログラムを自動で再実行したりしない。
4. `workspace-write` 下で意図したワークスペース内に書き込め、その外への書き込みは失敗し、`result.sandbox.mode` と `result.sandbox.enforcement` を返すことを検証する。`read-only` 下では直接ファイル書き込みは失敗する。ファイル操作拒否と `sandbox-unavailable` は区別し、ローカルサンドボックスのインストールを修復してから再試行すること。
