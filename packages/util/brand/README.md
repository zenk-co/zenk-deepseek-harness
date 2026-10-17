---
description: "混同しうる領域値を所有するパッケージ向けの、状態なし構築子付き名目文字列・数値型。"
kind: "package-library"
---

# @deepseek-ai/dsh-brand

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

`dsh-brand` は構造的に同一の文字列や数値を型水準で交換不能にする。`SessionId` は `ToolCallId` を期待する箇所に渡せず、イベント連番はログオフセットを要求される箇所に渡せない。`brandString<T>()` と `brandNumber<T>()` は共有実行時状態なしに名目ブランドを適用するため、所有パッケージは無関係なケイパビリティをインポートせずに領域型を定義できる。

## 目次

- [このパッケージを使う](#use-this-package)
- [実装を理解する](#understand-the-implementation)
- [さらに調べる](#further-exploration)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

領域値がパッケージ境界を越え、同じプリミティブで表される別の値と混同しうるときにブランド化する。すべての文字列や数値にブランドが必要なわけではない。ブランド化された値は TypeScript 呼び出し側への契約である。その領域を期待する関数にのみ入り、異なるブランドはコンパイル時に拒否される。

### 文字列のブランド化

所有パッケージでブランド化型を宣言し、そのパッケージが文字列を受け付ける箇所で適用する:

```ts
import { brandString, type Branded } from '@deepseek-ai/dsh-brand'

export type SessionId = Branded<'SessionId'>

const sessionId = brandString<SessionId>('session-1')
```

`brandString()` は静的型のみを変え、実行時検証を行わない。所有型に文法がある場合は呼び出し前に領域文法を検証すること。ブランド化されれば、id は通常文字列として比較・記録・JSON 直列化・送受信される。

### 数値のブランド化

所有パッケージで数値ブランドを宣言し、そのパッケージが数値を受け付けた後にのみ適用する:

```ts
import { brandNumber, type BrandedNumber } from '@deepseek-ai/dsh-brand'

export type SessionSeq = BrandedNumber<'SessionSeq'>

const seq = brandNumber<SessionSeq>(7)
```

`brandNumber()` は元の数値を返し、検証を行わない。所有パッケージはブランド化前に非負安全整数範囲などの要件を検証する。比較・算術・記録・JSON 直列化・送受信は通常数値の動作を保つ。算術はブランドなし数値を生むため、所有者は領域再進入の前に再受け付けしなければならない。

### ブランド化すべきとき

パッケージ境界を越え、混同しうる値をブランド化する。`dsh-llm` の `ToolCallId`、`dsh-session` の共有エージェント・セッション `SessionId`、`dsh-jobs` の `JobId`、`dsh-session` の `SessionSeq` 対 `SessionLogOffset` がそれである。ローカルに留まる値や混同しえない値にこの抽象化は不要である。

-----

<a id="understand-the-implementation"></a>
## 実装を理解する

<details>
<summary>実装の内部 — クリックで展開</summary>

パッケージは 2 つの交差型 `string & { readonly [BRAND]: B }` と `number & { readonly [BRAND]: B }` を定義する。`BRAND` はモジュール非公開の `unique symbol` である。

### ソース対応表

| ファイル | 役割 |
|---|---|
| [`src/index.ts`](src/index.ts) | 状態なし構築子付きのブランド化文字列・数値型 |

### 値が移植可能であり続ける仕組み

非公開シンボルは実行時に存在しない。TypeScript が消去するため、ブランド化値に札もプロトタイプもない。`brandString()` と `brandNumber()` は入力をそのまま返す。したがって別々にインストールされたコピーはレジストリや構築子識別子を共有せずに交換可能な値を生む。

### 依存なしであり続ける理由

これらのヘルパーを独自パッケージに保つことで、`dsh-jobs` は無関係なケイパビリティパッケージをインポートせずに `JobId` をブランド化でき、各ケイパビリティは具象 id の意味と検証を引き続き所有する。

</details>

-----

<a id="further-exploration"></a>
## さらに調べる

これらのプリミティブがブランド化する値や周囲の型慣習が必要なときにこれらのページを読む。

- [コアサブシステム](../../../docs/subsystems/core.md) — 共有 `SessionId` ブランドと型規則の文書化箇所。
- [LSP サブシステム](../../../docs/subsystems/lsp.md) — このプリミティブ上に作られたブランド化プロバイダー id である `LspProviderId`。
- [Jobs パッケージ](../../jobs/jobs/README.md) — ジョブケイパビリティが所有する `JobId` ブランド。

-----

<a id="dev-note"></a>
## 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックで展開</summary>

なし。

</details>
