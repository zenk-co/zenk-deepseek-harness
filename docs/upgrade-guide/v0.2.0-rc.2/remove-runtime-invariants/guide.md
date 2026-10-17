---
kind: upgrade-guide
description: "ランタイム不変条件レジストリパッケージと各パッケージの `./invariant` サブパスエクスポートは削除される。"
---

# ランタイム不変条件プラグインは削除される

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

v0.2.0-rc.2 では、`@deepseek-ai/dsh-invariants` が `ctx.invariants` サービスを提供し、`@deepseek-ai/dsh-session`、`@deepseek-ai/dsh-agent`、`@deepseek-ai/dsh-scope`、`@deepseek-ai/dsh-agent-loop` などのワークスペースパッケージが、それにチェックを登録する `./invariant` コンパニオンプラグインを公開していた。`sdk-minimal` プロファイルは、`invariants`、`session-invariant`、`agent-invariant`、`scope-invariant`、`agent-loop-invariant` の ID を持つ 5 行をマウントしていた。

次のリリースでは、`@deepseek-ai/dsh-invariants`、`InvariantRegistry`、`InvariantInstaller`、`InvariantFailure`、`InvariantError`、およびあらゆる `<package>/invariant` サブパスを公開しなくなる。`sdk-minimal` プロファイルは 5 行を含まなくなる。`credentials/reference-updated`、`credentials/record-updated`、`authorization/settled`、`llm/adapters-updated` の各エミッターは、`code: 'INVARIANT'` を持つエラーを含め、あらゆるリスナー失敗を捕捉してログに記録し、再スローしなくなる。

削除されたモジュールを指名する `cordis.yml`、パッチ、またはオーバーレイでは、その読み込みに失敗する。5 つの `sdk-minimal` ID のいずれかを対象とするパッチは `patch: entry <id> not found` をログに記録する。削除されたモジュールやシンボルをインポートする TypeScript コードはコンパイルできなくなる。

## 移行

1. `cordis.yml`、`$DSH_HOME/profiles/<name>/cordis.patch.yml`、および `--patch` オーバーレイから、`name` が `@deepseek-ai/dsh-invariants` である行、または `/invariant` で終わる行を削除する。
2. `invariants`、`session-invariant`、`agent-invariant`、`scope-invariant`、`agent-loop-invariant` の各 ID を対象とするパッチエントリを削除する。
3. `package.json` の依存から `@deepseek-ai/dsh-invariants` を削除し、それおよび `<package>/invariant` サブパスへのインポートを削除する。4 つのエミッターのいずれかから再スローされる `INVARIANT` 失敗に依存していたプラグインは、自身のチャネルでその失敗を報告しなければならない。
4. 確認する。プロファイルがモジュール未検出エラーや `patch: entry ... not found` 警告なしに `dsh` で開始すること、および `tsc` がモジュールやエクスポートの欠落を報告しないこと。
