---
description: "通常 Cordis YAML でエージェントの子プラグインを定義する。複数プリセットを宣言し、セッションに 1 つを選ばせる。定義は先行読み込みされ、編集は後続作成エージェントに影響する。"
kind: "package-reference"
---

# @deepseek-ai/dsh-agent-preset

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

通常 Cordis YAML でエージェントの子プラグインを定義する。複数プリセットを宣言し、セッションに 1 つを選ばせる。定義は先行読み込みされ、編集は後続作成エージェントに影響する。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

```yaml
- id: agent-preset-registry
  name: '@deepseek-ai/dsh-agent-preset-registry'
  config:
    default: standard
- id: preset-standard
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    id: standard
    plugins: []
```

| フィールド | 既定値 | 意味 |
|---|---|---|
| `id` | required | 安定したプリセット識別子 |
| `plugins` | required | 子プラグインエントリー一覧 |
| `name` | unset | 表示名 |
| `description` | unset | 表示説明 |
| `order` | unset | 名簿順序 |

宣言行の `id` は Loader 編集を宛てる。`config.id` はセッションが保存するプリセット識別子である。子エントリー ID は省けて Loader が割り当てる。

パッケージは Creator 方式が `skill-filesystem` 越しにマウントする `skills/` ディレクトリも配布する。`agent-experience`（ツール説明と効率的コンテキスト読み込み）・`cordis-plugin-development`（`references/` を要求時読み・複写可能 `templates/` バンドル付きの短手順）・`editing-cordis-compositions`・`cordis-composition-reference` であり、その `references/packages.md` は `scripts/gen-plugin-packages.ts` で生成され、`doc-sync` で鮮度ゲートされる。2 つの手順スキルはエージェントにまず検査結果、次に `Config.listConfigs` が報告する `packageDir` 配下のパッケージ README、次にビルド済み `lib/` または checkout ソースを読むよう指示する。配布済み `SKILL.md` は `skill` ツール結果として描画され、すべて標準プリセットのツール結果枝刈りが結果を刈る 8192 文字閾値を下回り続ける。

`skills/agent-experience/SKILL.md` で `agent-experience` を編集する。リポジトリ探索パス `.agents/skills/agent-experience/SKILL.md` はこのファイルへの相対シンボリックリンクであり、公開パッケージは通常ファイルを含む。

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

[index.ts](src/index.ts) は定義を登録し、その破棄子を Cordis に返す。プラグインのグループ標識は子 `!!js` 式を自身のプラグイン読み込みまで保持する。[レジストリ](../agent-preset-registry/README.md)がリビジョン保持と解放を所有する。

</details>

<a id="further-exploration"></a>
## さらに調べる

- [スコープ](../../core/scope/README.md) — 登録分離。
- [エージェント](../../core/agent/README.md) — セッション実行時。
- [Cordis](../../../docs/cordis-primer.md) — プラグイン設定とライフサイクル。

<a id="model-experience"></a>
## モデル体験

間接的に、宣言プラグインを通じて関わり、それらがモデル可視のツールとプロンプトを所有する。

#### KV キャッシュ効果

稼働エージェントのコンポジションは安定のままである。新規エージェントは更新定義を使える。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- `agentPresets` サービスが必要である。重複プリセット ID は宣言読み込みを失敗させる。宣言はディレクトリ・ファイル複写・ファイル削除の操作を提供しない。
- `agent-experience` のリポジトリ探索にはシンボリックリンク有効の checkout が必要である。`core.symlinks=false` では Git はリンク対象を素テキストとして書き、スキルにならない。Creator 方式はパッケージ内の通常ファイルを使い、その別名に依存しない。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
