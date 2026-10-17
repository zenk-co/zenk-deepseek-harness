---
description: "PTC 実行ケイパビリティファミリーのパッケージマップ: プログラム実行が何を行うか、そして各部位をどのパッケージが所有するか。"
kind: "package-group"
---

# ptc-runtime/ — PTC 実行ケイパビリティファミリー

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`ptc-runtime/` グループは、Host 提供の非同期関数に対するモデルプログラムを実行する。既定の Node バックエンドは設定済みサンドボックスポリシー下で新しいプロセスを開始する。オプトインの `executionMode: persistent-in-memory` は明示的な状態所有者ごとに個別の閉じ込め REPL を保持し、メモリーはプロセスまたは所有者とともに終了する。実験的な Python バックエンドは新しい CPython プロセスを使う。失敗は結果として返され、呼び出し元が診断またはモデルへの提示を行う。

## 目次

- [パッケージ](#packages)
- [関連ドキュメント](#related-documentation)
- [開発ノート](#dev-note)

-----

<a id="packages"></a>
## パッケージ

この3つのパッケージを合わせてプログラム実行を提供する。各部位の役割は各 README が記述する。

| パッケージ | 役割 | ctx キー |
|---|---|---|
| [`ptc-runtime/`](ptc-runtime/README.md) | PTC ランタイムの役割を定義する: Host 提供バインディングに対する単一プログラムの実行と、表示と返値の報告 | `ctx.ptcRuntime` |
| [`ptc-runtime-node/`](ptc-runtime-node/README.md) | ファイルポリシー下の新しいプロセスで TypeScript を実行する。または同じファイルポリシー下で保持されるオプトイン REPL で実行する | `ctx.ptcRuntime` を登録する |
| [`experimental/ptc-runtime-python/`](../experimental/ptc-runtime-python/README.md) | 実験的な Python バックエンド: Node ホストと CPython サブプロセス間の fd-3 ワイヤープロトコルと CPython ランタイム実装を所有する | — |

-----

<a id="related-documentation"></a>
## 関連ドキュメント

サービス契約はサブシステムリファレンスから、このケイパビリティを消費する PTC モード設計とその従うケイパビリティシームモデルはその次に読み進めること。

- [PTC ランタイムサブシステムリファレンス](../../docs/subsystems/ptc-runtime.md) — リクエスト/結果語彙、バインディング、`ctx.ptcRuntime` Cordis サーフェイス。
- [PTC モード Agent Note](../../.agents/notes/implemented/feature/2026-06-15-ptc.md) — ツールレジストリーがモデルに `run_code` を提示する仕組み。
- [ケイパビリティシーム](../../docs/capability-seams.md) — このファミリーが従う Service Definition / Service Provider / Consumer 分割。

<a id="dev-note"></a>
## 開発ノート

<details>
<summary>メンテナー向け作業コンテキスト — クリックして展開</summary>

なし。

</details>
