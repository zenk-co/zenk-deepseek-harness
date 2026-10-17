---
description: "Claude Code mod 用 prompt 上帯の Web 帯。橋渡しの Remote から各セッションの mod 木を描き、押釦を送り返す。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-client-ui-claude-code-mods

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

任意のブラウザープラグインであり、[Claude Code mod](../claude-code-mods/README.md) が prompt 上に描く帯を描画する。橋渡しの `claudeCodeMods` Remote を載せ、各開セッションの帯を見守り、直列化された `Box`/`Text`/`Button` 木を作文札上の全幅項目として描く。釦押しは Host で mod の `onPress` を走らせ、帯は描き直される。描く mod なしには何も示されない。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに探る](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と後回しの作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

橋渡しと mod 群の脇に組み立てる。[参加オーバーレイ](../claude-code-mods/cordis.source.patch.yml)は Web プロファイルの source 起動のためにそうする。帯は mod の `ui.render` 掛けが木を返す間のみ現れる。初ターン後の Token Weather 予報、危険指令保留中の Blast Radius の Proceed と Cancel、編集あるターン後の Replay Theater 暗示である。色はこの題材 token 上の Claude Code 端末調色に従い、熱鍵は表示脇に暗示として示され、押しは押下である。押しが飛行中の間すべての釦が無効となり、Host が拒んだ押しは帯下にその文を示す。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>メンテナー詳細 — クリックで展開</summary>

ブラウザー項目は生成済み Remote 寄与を取り込み `mountModsBand` に渡す。これは `ctx.remote.$mount()` 経由で寄与を載せ、`conversation.input.dock` 項目 1 つを登録する。項目の `inject` は溝描画器が `useBand` として表す小観測貯蔵の背後にセッションごとの `watchBand` 流 1 つを保ち、`press` は帯描画時の世代で `pressBand` を呼び、返す snapshot を当てる。破棄は全流と Remote 載せを終える。[`Band.tsx`](src/client/Band.tsx) は直列木を描く。`Box` は持性由来の詰めと間隔を伴う `data-direction`、`data-border` 付き屈曲容器として、`Text` は `data-color`、`data-bold`、`data-dim`、`data-italic`、`data-underline` を運ぶ幅として、`Button` は動作 id なしや押し走行中に無効な釦として描く。

</details>

-----

<a id="further-exploration"></a>
## さらに探る

- [橋渡し](../claude-code-mods/README.md) — 帯の描かれ方と先に描く mod。
- [Claude Code mod との互換性](../../../docs/subsystems/claude-code-mods.md) — この帯が描く要素と持性の部分集合。

-----

<a id="model-experience"></a>
## モデル体験

なし。帯は Host 状態から描かれモデル要求に決して入らない。釦の効果は mod 自身の掛けを通じてのみモデルに届く。

#### KV キャッシュへの影響

直接の影響なし。

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>

- セッションごとに帯 1 つ。据付け `Pane`、`TextInput`、熱鍵、焦点、滑動はない。Host は幅 120 桁で帯向けに描き、帯は折り返す。`width`、`height`、`overflow`、`wrap`、`truncate` 持性は無視される。
- 帯は Host の再描画発動を映す。それらの外で状態を変える mod は次の発動で描かれる。

-----

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー詳細 — クリックで展開</summary>

なし。

</details>
