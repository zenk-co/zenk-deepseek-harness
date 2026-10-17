---
kind: upgrade-guide
description: "Subpath plugins no longer read display text or icons from an exported <subpath>/package.json; they use locale meta and <subpath>/icon."
---

# サブパスプラグインは `<subpath>/package.json` の代わりに `<subpath>/icon` を読む

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

v0.2.0-rc.2 では、プラグインマネージャーと設定は `my-plugins/search` のようなサブパスプラグインを、パッケージがエクスポートしている場合に `my-plugins/search/package.json` 経由で読んだ。`name` と `description` は欠落したロケールフィールドを埋め、`icon` は行画像を提供した。サブパスはパッケージではないため、次回リリースではその `package.json` を決して読まない。そのタイトルと説明は `my-plugins/search/locale/*.json` からのみ得て、画像はエクスポートされた `my-plugins/search/icon` リソースから得る。パッケージルートのプラグインは `package.json` テキストと `icon` を保持する。`icon` 省略時はエクスポートされた `./icon` が画像を提供する。サブパスの `package.json` ファイルをエクスポートするパッケージの作者が影響を受ける。

## 移行手順

1. サブパスマニフェストの `name` と `description` をサブパスロケールファイルの `meta.title` と `meta.description` に移動してエクスポートする。例 `"./search/locale/*.json": "./locale/search/*.json"`。
2. サブパスマニフェストの `icon` を icon エクスポートに置き換えて対象を公開する:

   ```json
   {
     "exports": { "./search/icon": "./assets/search.svg" },
     "files": ["assets/search.svg"]
   }
   ```

3. `./search/package.json` エクスポートとそのファイルを削除する。
4. DSH チェックアウトで `pnpm run verify-package-meta` を実行するかプラグインマネージャーを開き、サブパス行にタイトル、説明、画像が表示されることを確認する。
