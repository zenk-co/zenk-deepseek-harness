---
kind: upgrade-guide
description: "The sdk-minimal default tool roster adds read_image and automatically summarizes older context."
---

# SDK-minimal の画像読み取りと自動コンパクション

日本語 | [English](guide.en.md) | [中文](guide.zh.md)

## 変更内容

`sdk-minimal` は永続シェルと `working_directory` に並んで `read_image` を広告する。自動コンパクションはコンテキスト圧迫が設定済みしきい値に達すると古い履歴を要約する追加モデルリクエストを送る。完全なセッションログは非圧縮 JSONL として保存されたままである。ルート予算を超える画像はリクエストが再試行できるよう添付/パスプレースホルダーに恒久的に置換される。SDK プロンプト文は `/compact` を実行しない。

ツール名を固定するクライアント、プロンプトサイズを測るベンチマーク、モデルリクエストを数える処理はこれらの既定を織り込まなければならない。画像読み取りは画像入力を宣言するアダプタールートを要求する。設定とモデル影響は [バンドルリファレンス](../../../../packages/bundle/sdk-minimal/README.md) を参照。

## 移行手順

1. 新しい既定を受け入れるか、以前の既定ツールと自動コンパクション無効を維持するには `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` にこのパッチを置く:

```yaml
- id: tool-fs
  config:
    read: false
    readImage: false
    write: false
    edit: false
- id: compaction-basic
  config:
    auto: false
```

2. 新鮮な SDK ランタイムを起動する。追加ユーザープラグインが無ければ、そのモデルリクエストは永続 `bash` または `pwsh` ツールと `working_directory` を含み、自動要約リクエストを送らない。
