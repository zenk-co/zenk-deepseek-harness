# DeepSeek Harness

日本語 | [English](README.en.md) | [中文](README.zh.md)

DeepSeek Harness（`dsh`）は [DeepSeek AI](https://deepseek.com) が開発したオープンソースのエージェントハーネスである。

**everything-is-a-plugin** アーキテクチャ上に構築され、[Cordis](https://github.com/cordiverse/cordis) に駆動される。その設計は [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512) で説明されている。

ドキュメント: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## 開発者プレビュー

DeepSeek Harness は _開発者プレビュー_ 段階にあり、急速に反復されている。**互換性を壊す変更が行われる。**

プロジェクトを実行する前に[安全通知](SAFETY.md)を確認すること。

## 実行

### `npm` から実行する

`Node.js` をインストールしてから実行する:

```sh
npx @deepseek-ai/dsh web
```

このコマンドはデフォルトで `http://127.0.0.1:3080` に Web UI を起動し、ローカル起動ではデフォルトブラウザーで開く。SSH 起動では、SSH クライアントまたはエディターがローカル転送アドレスを所有するため、ホスト URL のみ出力する。ブラウザーを開かずにサーバーを実行するには `--no-open` を渡す。[Web UI ガイド](docs/user/guide/index.md)を参照。

### ソースから実行する

リポジトリチェックアウトから実行するには:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` はリポジトリアーティファクトを準備する。`pnpm dsh web` は再ビルドせずにそのビルド済みアーティファクトを使用する。

## コミュニティとサポート

- [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) を通じてフィードバックやバグ報告を送信する。
- 検出可能性のため、プラグインリポジトリに [`dsh-plugin`](https://github.com/topics/dsh-plugin) トピックを追加する。
- <a href="https://discord.gg/4MrtZUhpxg">DeepSeek Harness Discord コミュニティ</a>に参加する。

## 貢献

[CONTRIBUTING.md](CONTRIBUTING.md) を参照。

## 開発

[開発ガイド](docs/development.md)と[アーキテクチャ文書](docs/architecture.md)から始めること。

`pnpm run dev:web` は 1 つのターミナルでビルド、提供、ソース編集時のクライアントバンドル再ビルドを行い、`make help` は Web と Desktop 用の対応する Make ターゲットを一覧する。完全な表はガイドのアプリケーションコマンド節が所有する。

エージェントは [AGENTS.md](AGENTS.md) に従うこと。

## 引用

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## ライセンス

[MIT](LICENSE)

サードパーティ依存とそのライセンスは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) で開示されている。
