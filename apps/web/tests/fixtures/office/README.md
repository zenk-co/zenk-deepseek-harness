# バイナリー Office フィクスチャ

日本語 | [English](README.en.md) | [中文](README.zh.md)

`preview.doc`、`preview.xls`、`preview.ppt` は `Office preview 中文文档` を含む。これらは [LibreOffice Kit](https://github.com/deepseek-ai/dsh-libreoffice-kit) の `one-page.doc`、`one-sheet.xls`、`one-slide.ppt` フィクスチャであり、Harness 作成の OOXML から LibreOffice 26.8.0.3 の Word・Excel・PowerPoint 97 フィルターでエクスポートされたものである。ソースドキュメントは Harness MIT ライセンスを保持する。

ブラウザーリグレッションはこれらのコミット済み OLE ファイルを読み、実際の変換と選択可能な PDF テキストを検証する。ユーザードキュメントを含まず、テスト中に Office アプリケーションやフィクスチャ生成器を必要としない。対象は単純なレガシーインポートであり、複雑なドキュメントの忠実度ではない。
