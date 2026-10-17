# DeepSeek Harness Python SDK

日本語 | [English](README.en.md) | [中文](README.zh.md)

DeepSeek Harness をサブプロセスとして駆動する Python パッケージ。クライアント SDK はバンドルされたランタイムと stdio 上の改行区切り JSON-RPC で通信する。

## パッケージ

| Directory | Dist / module | Role |
|---|---|---|
| [sdk](sdk/README.md) | `deepseek-harness-sdk` / `deepseek_harness` | High-level turns API and lower-level JSON-RPC client |
| [sdk-runtime](sdk-runtime/README.md) | `deepseek-harness-runtime-bin` / `deepseek_harness_runtime` | Bundled `dsh` CLI executable and native sidecars |

## 動作

呼び出し側が別の `dsh` 実行ファイルやプロファイルを選ばない限り、SDK は一致するバンドル済み `dsh --profile sdk` ランタイムを起動する。実行可能な最小例は出荷スタンドアロン `sdk-minimal` プロファイルを選択する。同じランタイムは個別の CLI 利用向けに `dsh web` とそのフロントエンドアセットも同梱する。すべての起動で明示的に選択された Harness ホームが必要であり、Python が黙って `~/.dsh` を読むことはない。ランタイム選択、プロファイル、パッチ、外部プラグイン管理は [SDK リファレンス](sdk/README.md) と [ランタイムキャリアーリファレンス](sdk-runtime/README.md) が所有する。

## コントリビューターのワークフロー

[Python コントリビューターのワークフロー](development.md) ではランタイム成果物のビルド、パッケージ検証、ソースモード開発、配布を扱う。
