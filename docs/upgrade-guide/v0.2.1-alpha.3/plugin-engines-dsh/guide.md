---
kind: upgrade-guide
description: "Plugin compatibility checks read engines.dsh before DSH peerDependencies, and refusals report requirements instead of peers."
---

# プラグイン互換性は `engines.dsh` を先に読む

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

v0.2.1-alpha.3 では、インストールとプロファイル起動はプラグインまたはバンドルを `@deepseek-ai/dsh` と `@deepseek-ai/dsh-*` への `peerDependencies` のみで判定し、`engines.dsh` を無視した。次回リリースでは、独自の `engines.dsh` 範囲が単独で決定し、それらのピアは無視される。ピアの規則は `engines.dsh` が無い場合にのみ適用される。`workspace:` 値はピア内でのみ有効であり、`engines.dsh` 内では互換性が無い。非オブジェクトの `engines` または非文字列の `engines.dsh` は互換性判定用にマニフェストを読み取り不能にし、パッケージを拒否する。`engines.dsh` を宣言するパッケージ、または `engines` をオブジェクト以外のものとして宣言するパッケージの作者が影響を受ける。

プラグインマネージャーがクライアントに返す `incompatible-version` 拒否レコード、`IncompatiblePlugin`、およびアプリ起動時の `PluginCompatibility` 結果は、`peers` を `requirements` に改名する。キーは、engines 規則では `engines.dsh`、フォールバックではピアのパッケージ名である。これらのレコードを読むコードが影響を受ける。

## 移行手順

1. パッケージが `engines.dsh` を宣言している場合、DSH ピア範囲が広げたり狭めたりしなくなるため、その範囲がパッケージの対応するすべての DSH リリースをカバーするようする。ピア基準の検査を維持するには `engines.dsh` を削除する。
2. `engines.dsh` 内の `workspace:` 値をセマンティックバージョン範囲に置き換える。
3. `IncompatiblePlugin` と `PluginCompatibility` から `peers` ではなく `requirements` を読む。
4. `dsh plugin --profile <profile> add <package@version>` またはプラグインマネージャーでパッケージをインストールして確認する: 不一致の場合、拒否理由に `engines.dsh` またはピアパッケージが名前で示される。
