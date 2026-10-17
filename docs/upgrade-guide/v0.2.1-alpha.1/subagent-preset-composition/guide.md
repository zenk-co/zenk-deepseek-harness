---
kind: upgrade-guide
description: "Subagent persona and toolFilter configuration is replaced by Agent Preset composition."
---

# プリセットでサブエージェント構成を設定する

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

`dsh-tool-subagent` は `persona` と `toolFilter` 設定を拒否する。新しい `SubagentStartRequest` 値とプロバイダーケイパビリティはどちらのフィールドも公開しなくなった。インプロセスの spawn は `agentPreset` 経由でプリセットを選択し、そのペルソナとツールはそのプリセットのプラグインから得る。fork は親のプリセットを継承し、ペルソナを独立に変更したりツールを制限したりできない。モデルとリーズニングエフォートのオプションは不変である。

同梱の `standard`、`ptc`、`cordis` 委譲ツールは `schedule_*` ツールを隠さなくなった。委譲された呼び出し元は引き続き既存の実行拒否を受け取る。履歴上の子セッション記述子は、再開時にペルソナとツール制限を保持する。

## 移行手順

1. プロファイルパッチとカスタムプリセット内の `dsh-tool-subagent` 行から `persona` と `toolFilter` を削除する。プログラムによる呼び出し元とプロバイダーケイパビリティ宣言を更新し、同じフィールドを削除する。
2. spawn には、`dsh-persona` と必要なツールプラグインを含むエージェントプリセットを定義し、委譲ツールの `agentPreset` をその id に設定する。親モデルに複数の宣言済みプリセットを提供するには `allowedAgentPresets` を使う。プリセットはプラグイン構成を選択するものであり、子ごとのツール名フィルターの置換は存在しない。
3. fork ではオーバーライドを削除し、継承された構成を受け入れる。異なる構成が必要なタスクにはプリセット付き spawn を使う。親の会話は継承しない。
4. 新しいセッションを開始してタスクを委譲する。子が選択したプリセットのペルソナとツールを使うことを確認する。既存の永続化済み子セッションに手動編集は不要である。
