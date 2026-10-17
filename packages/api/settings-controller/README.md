---
description: "設定と資格設定面の Host Remote 所有者。編集済み読み、書込、資格参照、生文書開きを含む。"
kind: "package-reference"
---
# 設定制御子

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`@deepseek-ai/dsh-api-settings-controller` は browser 設定面向けに生成済み `ctx.remote.settings` と `ctx.remote.credentials` 名空を表す。編集済み設定と資格附属を返し、秘密値を返さずに設定と資格の書込を支え、Host 卓面で提供者所有の設定または Agent 既定位置を provider 所有文書として開く。提供者不在の場合も名空は登録のまま残り、行動可能な設定誤りを返す。

## 目次

- [このパッケージを使う](#use-this-package)
- [設定](#configuration)
- [モデル体験](#model-experience)
- [既知の制限と後回しの作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

browser 設定に給仕する profile でこの包を Loader 項目として載せる。項目は提供者と独立に両名空を登録するため、欠落提供者は呼出時に名付き設定誤りを生じる。生成記述子は厳格 Typert 登録に入り、設定と資格 Definition は独自配線義務のない素の Cordis サービスのままである。

`describe(refs)` は要求名で鍵付けされた 1 図で答えるため、行が運ぶ全参照を述べる設定頁はそれら行をまとめて落ち着かせる。呼ごとに最大 64 名を受け付け、不正名や空書込値を `bad-request` として報告し、各回答項目ごとに写す — `CredentialInfo` が宣言するより多く返す提供者は渡るものを広げられない。有効な `set(ref, value)` と `unset(ref)` 呼出しは提供者拒否を `credential-rejected` として報告し、詳細には参照のみを伴って提供者文を運ぶ。秘密値はこの方向にのみ渡る。ここからはどの手法も 1 つを返さない。

`settings.describe()` は配備事実と `redactSecrets: true` 下の全名空を返す。`settings.update`、`settings.replace`、`settings.mutate` は設定服務の 3 書込操作を表し、名空の新編集済み像を返す。古い書込は `settings-conflict` を使い、他の提供者拒否は `settings-rejected` を使う。

`settings.openSettingsDocument()` は提供者所有の文書を整えて生文本編集子で開く。browser 供給の文件系標的を受け付けない。

-----

<a id="configuration"></a>
## 設定

| 項目 | 既定 | 意味 |
|---|---|---|

受付項目とその JSDoc の網羅源は生成済み[設定目録](../../../docs/config-catalog.md#deepseek-aidsh-api-settings-controller)である。

-----

<a id="model-experience"></a>
## モデル体験

なし。設定と資格設定は browser と Host 状態であり、prompt、道具、セッションイベントを登録しない。

#### KV キャッシュへの影響

直接の影響なし。これら設定値の読み書きは既に飛行中の模型要求を変えない。

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>

- 一括上限は 64 参照に固定され、配備設定項目ではない。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
