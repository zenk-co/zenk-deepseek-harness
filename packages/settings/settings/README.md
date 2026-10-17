---
description: "Config 由来フォームでライブのプラグイン設定を閲覧・編集する。"
kind: "package-reference"
---

# @deepseek-ai/dsh-settings

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

プラグインが `.volatile()` で宣言した項目を編集し、その実効値を閲覧する。フォームは各プラグインをプロファイル項目 id で識別し、秘密値を保持し、古い書き込みを拒む。変更は有効プロファイルの Cordis パッチを通じて持続する。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに探る](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と後回しの作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

<a id="use-this-package"></a>
## このパッケージを使う

このプラグインを Loader と[設定エディター](../../boot/config-editor/README.md)でマウントする。基本バンドルがこの組み立てを提供する。

```yaml
- id: settings
  name: '@deepseek-ai/dsh-settings'
```

このプラグインに設定項目はない。フォームは有効で一意に宛名付けされたプロファイル項目由来の揮発性項目のみを表す。通常設定は Cordis 設定ファイル経由で編集可能なままである。

Settings 開始後に Loader が全項目を落ち着かせると、旧リリースが harness ホームに残した `settings.yaml` は一度だけ取り込まれる。各節は同 id の項目に書き込まれ (`ui-developer-tools` → `ui-settings`、`ui-onboarding` → `ui-settings-general`、`shell` → プラットフォームのシェル実行子項目)、最初の書き込み前にファイルは `settings.yaml.imported` に改名され、動作中の組み立てが拒む節は記録されて改名後のファイルにのみ残る。

リセットはプロファイル上書きの下の値を復元し、スキーマ既定を含む。ホームパッチとコマンドラインオーバーレイが優先し、それらに上書きされるフォーム書き込みは拒まれる。

各フォームはスキーマから頁を組み立てるクライアント向けに `autoGenerate` を報告し、既定で有効だが、出荷クライアントでそうするものはまだない。独自頁を出荷するプラグインは `apply` 内の任意 `ctx.inject(['settings'], ...)` 子からエフェクトとして `configure({ auto: false }, ctx.fiber)` を登録する。子は方針が属するプラグインファイバーを名指しし、遅れて読み込まれたり置換されたりした Settings サービスが方針を取り込み、業務プラグインは Settings なしで動作する。方針は設定の読み書きを取り除かない。

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装内部 — クリックで展開</summary>

[フォーム投影](src/schema.ts)はランタイム参照と通常項目を取り除く。[サービス](src/index.ts)は改訂付き記述子を供給し、全プラグイン Config に対して編集を検証してから持続化に委ねる。業務プラグインは Config 参照を直接読む。

秘密ロールは値、継承値、プロファイル上書き、スキーマ既定から編集され、クライアントは存在標識を受け取る。パス編集はクライアントが受け取らなかった項目を保持する。

</details>

<a id="further-exploration"></a>
## さらに探る

- [設定リファレンス](../../../docs/subsystems/settings.md) — フォーム値と変異。
- [揮発性設定](../../../vendor/loader/README.md) — 参照寿命と通知。
- [設定エディター](../../boot/config-editor/README.md) — 持続化と再読み込み順序。

<a id="model-experience"></a>
## モデル体験

モデル対面プラグインが消費する設定値を通じて間接的に関わる。

#### KV キャッシュへの影響

リクエスト接頭辞を変える利用者がキャッシュ影響を定める。

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>

- 入れ子の Include は個別設定を所有し、有効プロファイルのフォームでは編集できない。
- 項目単位のリセットは継承値を復元し、下位設定層が供給した値を削除できない。配列添字の解除はその要素を取り除く。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
