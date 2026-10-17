---
kind: upgrade-guide
description: "Python ランタイムホイールは、Office 変換とバンドルされたオーサリング環境のために明示的なダウンロードを必要とする。"
---

# オプションの Python ランタイムリソースを明示的にダウンロードする

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更

Python ランタイムホイールは Office サイドカーとオーサリング用のインタープリターやライブラリを含まない。SDK の起動時にそれらをダウンロードしない。Office 操作には明示的なダウンロードが必要であり、オーサリング環境と変換エンジンは個別に選択できる。SDK には通常の `dsh` CLI が引き続き同梱され、システムの Node.js は不要である。

## 移行

1. Office ファイルを処理する前に `deepseek_harness_runtime.download_office()` を呼び出す。バンドルされたオーサリング環境を使う前に `deepseek_harness_runtime.download_primary_runtime()` を呼び出す。どちらも完了済みキャッシュを再利用し、絶対パスを返す。
2. オフライン配置では、対象プラットフォーム上で一致するランタイムリリースでキャッシュを準備し、そのプラットフォームの配置先にコピーする。ダウンロードと SDK 起動の前に `DSH_RESOURCE_CACHE` をその絶対ルートに設定する。[ランタイムリファレンス](../../../../python/sdk-runtime/README.md) を参照。
3. SDK を起動し、必要なリソースが利用可能であることを確認する。`deepseek_harness_runtime.resolve_office_launch_args()` はダウンロードせずに Office CLI パスを検査する。既存の `DSH_PRIMARY_RUNTIME` パスは引き続きサポートされ、空の値はオーサリングクエリを無効にする。プロファイルパッチで `skill-office` を個別に無効化できる。
