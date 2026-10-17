---
kind: upgrade-guide
description: "Web プロファイルは `webRuntime` サービスと `web-runtime` 行の `trustedHosts` 設定を `webStartup` に置き換え、ワイルドカードのリスナーホストを拒否する。"
---

# Web リスナーと信頼設定は `webStartup` に移動する

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更点

Web プロファイルは `webRuntime` サービスを提供しなくなり、`web-runtime` 行も `trustedHosts` 設定値を宣言しなくなった。`webRuntime` を挿入するプロファイル、オーバーレイ、または `--patch` ファイルは、マウントされないサービスを待つことになり、`ctx.webRuntime.trustedHosts` を読む式は評価に失敗するため、必要な Connection は起動しない。

`web-startup` 行は呼び出し元の `--trusted-host` 権限を運ぶ `webStartup` サービスを1つ提供し、`connection` 行は `ctx.webStartup.trustedHosts` からそれらを読み取る。リスナーホストもローカルインターフェイスの具体的な IPv4 または IPv6 アドレスを1つ指定しなければならない。`host: 0.0.0.0`、`--host ::`、およびその他のすべての未指定アドレスはロード時に拒否される。すべてのインターフェイスにバインドするとポートがネットワークに公開されるためである。

## 移行手順

1. 呼び出しの信頼を必要とするすべての行で `inject: [webRuntime]` を `inject: [webStartup]` に置き換える。
2. `ctx.webRuntime.trustedHosts` 式を `ctx.webStartup.trustedHosts` に置き換え、存在しなくなった `ctx.webRuntime.lanAddresses` を削除する。
3. `webStartup` 用に `connection` オーバーレイを書き直し、`web-runtime` 行が運んでいた `trustedHosts` 値をその式に移動する。パッチは一致した行の `config` 全体を置き換えるため、その設定を完全に記述し直し、配列値の `!!js` 式は引用符付きスカラーとして書くこと。

   ```yaml
   # before
   - id: connection
     inject: [webRuntime]
     config:
       trustedHosts: !!js "['app.internal', ...ctx.webRuntime.trustedHosts]"
   # after
   - id: connection
     inject: [webStartup]
     config:
       trustedHosts: !!js "['app.internal', ...ctx.webStartup.trustedHosts]"
   ```

4. ワイルドカードの `host` をローカルインターフェイスの具体的なアドレス1つに置き換える。バインド IP 自体は Host フェンスに受け入れられ、`--trusted-host` エントリーは不要である。プロキシーまたは DNS 権限には引き続きエントリーが必要である。
5. 移行済みオーバーレイで起動する。`dsh --profile web --patch ./extra.yml --no-open` は `dsh web:` の URL 行を表示してサーブしなければならない。`webRuntime` を待つ行が残っていると必要な Connection が保留のままとなり、アクティベーション失敗が報告され、拒否された `host` はロード時に失敗する。`dsh --profile web --patch ./extra.yml --dump-config` は起動前に合成済みパッチを表示する。合成済み行の所有者は [Web バンドル README](../../../../packages/bundle/web-app/README.md) である。
