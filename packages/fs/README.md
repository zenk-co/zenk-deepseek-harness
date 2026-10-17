---
description: "文件系包群。ctx.fs 提供子契約、地域と砂箱強制後端、編集前読み方針插件、模型対面文件と探索道具。"
kind: "package-group"
---

# packages/fs

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`fs/` 群は応答者に durable な方針統治文件到達を与える。`fs/` 内の `ctx.fs` 服務契約、`fs-local/` と `fs-sandbox/` 内の host 文件系と砂箱強制後端、`fs-observation-policy/` 内の編集前読み方針、`tool-fs/` (`read`、`read_image`、`write`、`edit`) と `tool-fs-search/` (`glob`、`grep`) 内の模型対面道具である。配備は後端 1 つを載せ、新鮮防護変異用に方針を読み込み、模型に見せる道具包を登録する。後端は道具や方針に触れずに交換できる。文件入出力は設計上期限を取らない。期限は OS が依然終える作業を殺すため、取消は syscall 境界の最善努力信号である。

## 目次

- [パッケージ群](#packages)
- [関連文書](#related-documentation)
- [開発メモ](#dev-note)

-----

<a id="packages"></a>
## パッケージ群

7 包が文件系役割を演じる。subsystem 参照が網羅契約と誤り分類を所有する。

| パッケージ | 役割 | ctx 鍵 |
|---|---|---|
| [`fs/`](fs/README.md) | `ctx.fs` 服務契約。実行世界経路、有界文入出力、任意版防護付き不可分変異 | `ctx.fs` |
| [`fs-local/`](fs-local/README.md) | Host 文件系後端。地域機械の実文件を読み書き編集する | `ctx.fs` に登録 |
| [`fs-sandbox/`](fs-sandbox/README.md) | 砂箱強制後端。呼毎砂箱様式で書込と編集を柵付けし読みは通す | `ctx.fs` に登録 |
| [`fs-observation-policy/`](fs-observation-policy/README.md) | 編集前読み方針。観測済み存否を記録し `fs/*` イベントで書込/編集を防護する | `fs/*` 待ち受け |
| [`tool-fs/`](tool-fs/README.md) | 模型対面 `read`、`read_image`、`write`、`edit` 道具とその実行子 | `ctx.tools` に登録 |
| [`tool-fs-search/`](tool-fs-search/README.md) | 梱包 ripgrep 二値裏付けの模型対面 `glob` と `grep` 探索道具 | `ctx.tools` に登録 |
| [`tool-str-replace-editor/`](tool-str-replace-editor/README.md) | 単立 `str_replace_editor` 道具。`ctx.fs` 上の `view`、`create`、`str_replace`、`insert` | `ctx.tools` に登録 |

方針は道具が注入する服務ではなく插件である。それを外すと道具を壊さず裸提供子の無条件変異動作が残る。`fs-sandbox` 内の様式柵と編集前読み門は組み合わさる。`tool-fs-search` は故意に提供子契約を広げない — 探索は過程裏付け ripgrep 作業流であるため、文件系後端は普遍探索 API を持たないままである。

-----

<a id="related-documentation"></a>
## 関連文書

共有語彙と誤り分類は subsystem 参照から始め、群を形作った決定へ進む。

- [文件系 subsystem](../../docs/subsystems/filesystem.md) — 標的、結末、防護、方針イベント、誤り分類。
- [越族 fs 砂箱参照](../sandbox/sandbox-policy/README.md) — 文件系縫目上の共有砂箱様式柵。
- [移植実行世界利用者決定](../../.agents/notes/implemented/architecture/2026-07-28-portable-execution-world-consumers.md) — 文件系と子過程提供子が 1 つの実行世界を共有する理由。

<a id="dev-note"></a>
## 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
