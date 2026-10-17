---
kind: upgrade-guide
description: "Custom primary-runtime payloads require relocatable Python interpreter aliases."
---

# カスタム Python ランタイムエイリアスは sibling インタープリターを指さなければならない

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

macOS と Linux では、`DSH_PRIMARY_RUNTIME` は以前、ペイロード外を解決するインタープリターリンクや他のリンク経由の解決を受け付けた。ペイロード検証は現在、リンクされた各 `dependencies/python/bin/python` または `python3` が `runtime.json` の Python メジャー・マイナーバージョンにちなんだ通常の sibling インタープリター (例 `python3.12`) を直接指すことを要求する。通常のコマンドファイルは引き続き対応する。Python ホイール配布のものを含む。Windows は不変である。

## 移行手順

1. カスタムペイロードでは、バージョン付きインタープリターを `dependencies/python/bin/` に残し、`python` と `python3` をそのファイル名への相対リンクにする。必要な対象と出力引数は [ランタイム準備手順](../../../../packages/skill/tool-workspace-dependencies/README.md) に列挙されている。
2. 準備済みリソースをコピーする際は相対リンクを保持する。Node `fs.cp` では `verbatimSymlinks: true` を使う。pip はリンクを復元しないため、ホイールビルダーはコマンドファイルを実体化しなければならない。ネイティブビルドスモークは準備済みリソースツリーが両エイリアスを保持することを要求する。
3. `readlink` が両エイリアスについて sibling ファイル名のみ報告することを確認し、ペイロードをビルドディレクトリから移動し、`DSH_PRIMARY_RUNTIME` を新しいディレクトリに向けて、`load_workspace_dependencies` と返された Python コマンドが成功することを検証する。
