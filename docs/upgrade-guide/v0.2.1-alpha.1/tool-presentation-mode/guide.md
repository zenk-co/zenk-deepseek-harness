---
kind: upgrade-guide
description: "ツール提示は native または ptc を受け付け、混合の both モードは拒否される。"
---

# ネイティブまたは PTC のツール提示を選択する

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

`@deepseek-ai/dsh-tools` と `@deepseek-ai/dsh-agent-tool-presentation` の `mode` フィールドは `native` または `ptc` のみを受け付ける。`both` 値は拒否される。これは出荷プロファイルパッチ経由でツール構成を提供する `DSH_TOOLS_MODE=both` にも影響する。

`native` は可視ツールを直接の関数呼び出しとして公開する。`ptc` は `run_code` を公開し、プログラムは生成された SDK 経由で可視ツールを呼び出す。異なるエージェントプリセットは同じアプリケーション内で引き続き異なるモードを使える。

## 移行

1. `cordis.yml`、プロファイル `cordis.patch.yml`、またはカスタムオーバーレイで、直接呼び出しには `mode: both` を `mode: native` に、プログラムベースの呼び出しには `mode: ptc` に置き換える。
2. `DSH_TOOLS_MODE=both` を `DSH_TOOLS_MODE=native` または `DSH_TOOLS_MODE=ptc` に置き換える。プリセット固有の選択には、代わりにプリセットの `@deepseek-ai/dsh-agent-tool-presentation` 行を更新する。
3. `ctx.tools.presentAs('both')` を呼び出すコードを `native` または `ptc` の選択に更新する。PTC プログラムでは呼び出しを `run_code` 内に保ち、SDK 関数名を直接のモデルツール呼び出しとして送出しない。
4. 影響を受けるプロファイルを起動し、設定が読み込まれることを確認する。ネイティブリクエストは許可された直接ツールを公開し、PTC リクエストは `run_code` とその SDK 手順を公開する。
