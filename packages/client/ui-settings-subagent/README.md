---
description: "dsh Web クライアントのプラグインページにあるサブエージェント設定ページ:subagent 名前空間上の委譲の深さと容量、subagent-model-selection 上でエージェントが選べるモデルを 1 ページ 1 保存で。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-subagent

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

サイドバーの**プラグイン**を開き、Official グループの**サブエージェント**を選ぶと、委譲の深さと広さ、エージェントがそのサブエージェントに選べるモデルを設定できる。ページは 2 つのホスト名前空間 `subagent` と `subagent-model-selection` を 1 保存の下に束ね、ホストがどちらかを提供する間存在し、提供されている節を表示する。

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

**制限**は**最大再帰深さ**と**サブエージェント並列度上限**を並べ、狭い画面では積む。各表示名の横の情報ボタンがその規則を開示する。2 行の深さ例と、容量が区切る件数である。範囲内の整数でない下書きは保存を止め、欄の下にその旨を示す。深さはツール独自の最大値に譲り、容量は主エージェントを除き、1 主エージェント配下の全水準の稼働サブエージェント総数を数える。

**モデル選択**は許可スイッチと正確なアダプタールートを一緒に段階化する。有効化には選択済みルートが 1 件以上必要であり、無効化は選択済みルートを後日のために保持する。ホストが保存したがアダプターが広告しないルートは**保存済みだが現在利用不可**の下に一覧されたまま削除可能であり、読み込みに失敗したプロバイダーは他を隠さず報告され、失敗した読み込みには**再試行**が提示される。

1 回の**保存**は両節をそれぞれの名前空間越しに書き込み、各々は下書きが読んだリビジョンで fence される。書き込みは独立である。ホストが拒んだ節は下書きを保持したまま失敗が報告され、他方は着地する。新しいホストリビジョンに取って代わられたモデル下書きは、新しいルートを上書きせず、破棄すべき競合として報告される。ページを離れるとすべての下書きは捨てられる。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

ホスト側は空の `apply` であり、パッケージがクライアントモジュールシステムがブラウザー側を提供するための Loader 行を保持するためだけに存在する。ブラウザー側は各名前空間を `ctx.configForms.get` 経由で束縛する。`SubagentLimitsCardController` は `ui-primitives` の共有 `SettingsFormModel` 上で制限を段階化し、各欄の下限以上の安全な整数を受け付ける欄仕様を持つ。`SubagentModelSelectionCardController` は 2 欄を 1 回のリビジョン fence 付き `mutate` で保存するため独自の下書きを保ち、保存済みルートを `remote.session.modelCatalog()` と結合し、`llm/adapters-updated` と `settings/document-updated` でカタログを読み直し、接続リセットで下書きを捨てる。`subagentCardFace` は両者を共有 `SettingsForm` 内で `SubagentCard` が描画する 1 面に合成し、その保存は両方を検証して汚れた方を書く。ページは両名前空間上の `ctx.configForms.whileServed` 経由でプラグインページの `plugins.item` スロットに登録する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

- [ui-plugin-manager](../ui-plugin-manager/README.md) — プラグインページと、ページが登録する `plugins.item` スロット。
- [ui-settings](../ui-settings/README.md) — 設定スコープと、ページが乗る提供名前空間監視。
- [ui-primitives](../ui-primitives/README.md) — 制限節が描画する設定フォームモデルと欄。
- [tool-subagent](../../subagent/tool-subagent/README.md) — 両名前空間を登録する委譲ツール。

-----

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはモデル面を登録しないブラウザー側設定面であるため。

#### KV キャッシュ効果

なし。このパッケージはプロバイダー要求を組み立ても送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **カタログは 3 信号でのみ読み直す** — アダプター変更・文書コミット・再接続であり、それらなしに広告を始めたプロバイダーは次のいずれかまたは**再試行**で現れる。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
