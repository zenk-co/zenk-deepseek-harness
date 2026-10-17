# native/

日本語 | [English](README.en.md) | [中文](README.zh.md)

DeepSeek Harness と共に保守されるネイティブソースと公開パッケージ。[`system/` ワークスペース](system/README.md) は Landlock ランチャーと POSIX flock バインディング、そのプラットフォームパッケージ、[リリース手順](system/docs/release.md) を所有する。

## ワークスペースとリリース境界

`system/` とそのパッケージはリポジトリーのルート pnpm ワークスペースとロックファイルに属する。Harness コンシューマーは開発と CI で現在のワークスペースエントリーパッケージを使うため、ランチャー契約の変更とそのコンシューマー更新を一緒に着陸・テストできる。

メインリポジトリーの `Node Addon System` ワークフローはサポートされる各アーキテクチャーをビルド・テストする。`Node Addon System Release` はそれらのネイティブ成果物を集め、npm ターボールをパック・検証し、任意で 1 つのネイティブバージョンとして公開する。エントリーパッケージはプラットフォームパッケージを npm optional dependencies として保持するため、npm はユーザーの OS と CPU に一致するパッケージのみを引き続きインストールする。
