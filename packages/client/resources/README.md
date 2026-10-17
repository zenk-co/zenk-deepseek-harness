---
description: "クライアントリソースモデル。プロトコル登録されたプロバイダーが URL アドレスをライブ値に変え、任意のスロットコンポーネントが標準 useResource フックを通じて読む。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-resources

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

コンポーネントがタブレコード、リンク、メンションのようなライブデータを URL アドレスでのみ知り、データは別のクライアントパッケージが所有する場合にクライアントリソースを使う。リソースアドレスは `dsh-resource://<type>/…` を使う。スコープが必要なプロトコルはそれをパスに符号化する。コンポーネントは公開 `useResource` フックを通じて現在値と後の更新を受け取る。`sidebar://guide` のような未対応プロトコルと非リソーススキームはリソースなしに解決される。

## 目次

- [このパッケージを使う](#use-this-package)
  - [リソースを読む](#read-a-resource)
  - [プロトコルを提供する](#provide-a-protocol)
  - [リソースを開いたままにする](#hold-a-resource-open)
- [実装を理解する](#understand-the-implementation)
  - [ライフサイクル](#lifecycle)
  - [失敗](#failures)
- [モデル体験](#model-experience)
- [既知の制限と先送り作業](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージを使う

マウントに設定は不要である。プラグインは `ctx.resources` を提供し、`ctx.slots.provideRoot` を通じて `resource` ルートのキーフックを寄与するため、すべてのスロットコンポーネントはスコープに関わらずそれを受け取る。

<a id="read-a-resource"></a>
### リソースを読む

すべてのスロットコンポーネントは props に `useResource` を受け取る。`useResource<P>(address)` は型引数でプロトコルを指定し、`{ status, value, failure }` を返す。アドレスのプロトコルにプロバイダーが登録されていない場合（またはアドレスが `dsh-resource://` URL でない場合）は `none`、プロバイダーがまだ yield していない間は `loading`、最新の `ok` フレームの値と共に `live`、最新フレームが失敗を報告した場合はその失敗を最後の値の脇に伴って `failed` になる。フックを通じた購読がリソースを開いたままにすることである。別の保持者がリソースを生かしている間にマウントしたコンポーネントは最新の値をただちに読む。

<a id="provide-a-protocol"></a>
### プロトコルを提供する

プロトコルを所有するクライアントパッケージは `ResourceProtocolMap` に値型を宣言し、所有エフェクトとしてプロバイダーを 1 つ登録する。`open` は `RemoteResult` フレームを yield する。すなわち最初の現在内容と後の変更ごとに 1 フレームであり、失敗はスローではなく `ok: false` フレームである。`signal` が中止したら停止しなければならない。

```ts ignore-check
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap { note: NoteView }
}

export const inject = ['resources']

export function apply(ctx) {
  ctx.effect(() => ctx.resources.register<'note'>({
    protocol: 'note',
    async *open(address, { signal }) {
      yield await readNote(address, signal)
      for await (const change of followNote(address, signal)) yield change
    },
  }), 'my-notes: note resource provider')
}
```

プロトコルごとにプロバイダーはちょうど 1 つである。2 つ目の登録はスローする。そのプロトコルのアドレスがすでに保持されている間にプロバイダーを登録するとそれらが開く。破棄するとそれらのストリームを終了して `none` に戻す。

<a id="hold-a-resource-open"></a>
### リソースを開いたままにする

`ctx.resources.pin(address, signal)` は `signal` が中止するまで購読なしにリソースを開いたままにする。右サイドバーは開いているすべてのタブのアドレスをタブレコードの寿命の間ピン留めするため、タブ切り替えは本体をアンマウントしてもストリームを閉じず、切り戻しでは最新の値を読む。`ctx.resources.source(address)` はフックの背後にある素の observable であり、React 外の呼び出し元のためのものである。

<a id="understand-the-implementation"></a>
## 実装を理解する

<a id="lifecycle"></a>
### ライフサイクル

アドレスごとに 1 つのレコードがスナップショットストア、保持者数（フック購読者とピン）、実行中ストリームの `AbortController` を持つ。最初の保持者がプロバイダーのストリームを開き、後の保持者はそれを共有し、最後の保持者の解放がストリームを中止してスナップショットをアイドルにリセットする（プロバイダーありで `loading`、なしで `none`）。レコードはページ寿命の間保持されるため、`source()` は React のレンダー後購読ウィンドウや StrictMode 再マウントをまたいで参照安定のままである。

<a id="failures"></a>
### 失敗

失敗はスローではなくフレームである。プロバイダーは `{ ok: false, error }` を yield し、リソースはそのエラーを最後の値の脇に伴って `failed` になる。次の `ok` フレームがそれを晴らす。独力で終了したストリームは最後の状態を保つ。ストリームを中止した解放の後に到着したフレームは落とされ、イテレーターは返される。プロバイダーのストリーム内部のスローはプログラミングエラーであり、捕捉されない。

<a id="model-experience"></a>
## モデル体験

なし。このパッケージはブラウザープラグイン間で値を移動するだけであり、モデル向けのものを何も登録しない。

#### KV キャッシュへの影響

なし。リソースストリームはモデル要求を組み立てない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **レコードはページ寿命の間生きる** — アドレスのレコードは最後の保持者が去った後も registry に残る。破棄されるのはその状態のみである。メモリーは読み取り回数ではなく、読み取られたことのある異なるアドレス数と共に増える。
- **プロバイダーが中止遵守を所有する** — registry は解放済みストリームがなお yield するものを落とすが、`signal` を無視するプロバイダーは次のフレームまで動作し続ける。

<a id="dev-note"></a>
### 開発者ノート

<details>
<summary>メンテナー向けの作業コンテキスト — クリックして展開</summary>

なし。

</details>
