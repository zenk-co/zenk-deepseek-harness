---
description: "IANA time-zone validation and canonicalization for maintainers accepting a caller-reported zone at a wire boundary."
kind: "package-library"
---

# dsh-util-time

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

呼び出し元報告のタイムゾーンをワイヤ境界で受け付けるメンテナー用の、依存ゼロのゾーン語彙。`canonicalClientTimeZone` は `UTC` または IANA `Area/Location` 名を受け付け、そのプラットフォーム正規綴りを回答するため、別名が durable 記録に到達しない。ゾーン ID はメッセージに格納され、後に別プロセスが再導出する。別名では等価比較できないためである。このライブラリは検証と正規化のみ行う。時刻整形を行わず、失敗語彙も所有しない。各境界が独自のドメインコードを投げるためである。

## 目次

- [このパッケージを使う](#use-this-package)
- [API](#api)
- [モデル体験](#model-experience)
- [既知の制限と後回しにした作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

これは**サービスやプラグインではなくライブラリ**である。`ctx` なし、何も登録せず、状態を持たない。

ゾーンを受け取る境界で、値が durable なものに到達する前に呼び出す。使用できない名前には `undefined` を回答し、呼び出し元が独自の拒否を上げる。セッションプロンプト用は `session/invalid-time-zone`、サブエージェント継続用は `subagent/invalid-time-zone` である。

-----

<a id="api"></a>
## API

```ts
import { canonicalClientTimeZone } from '@deepseek-ai/dsh-util-time'
```

| エクスポート | 役割 |
|---|---|
| `canonicalClientTimeZone(value)` | 受け付けたゾーン用の正規 `UTC` または IANA `Area/Location` 名。空白、パディング、略称、単一セグメント、プラットフォーム未対応のものには `undefined`。 |

<a id="model-experience"></a>
## モデル体験

durable メッセージに正規ゾーンを記録する利用者を通じて間接的に関与する。そこから `dsh-time-context` がターンのモデル可視ゾーン指示とタイムスタンプを描画する。

#### KV キャッシュへの影響

独自のものはない。ゾーン由来の行をリクエストに注入する利用者が、そのリクエストのキャッシュ動作を所有する。

## 既知の制限と後回しにした作業

<a id="known-limitations-and-deferred-work"></a>

- **別名解決はランタイムの ICU データに従う** — 別名グループがどの名前に正規化されるかはプラットフォームの回答であるため、異なる Node ビルド上の 2 プロセスが一致しないことがある。
- **検証のみ** — 整形、オフセット演算、DST 推論、瞬時変換は行わない。それらが必要な利用者は `Intl` を直接使用する。

<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業コンテキスト — クリックで展開</summary>

なし。

</details>
