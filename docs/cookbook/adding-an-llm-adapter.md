# クックブック: LLM アダプターの追加

日本語 | [English](adding-an-llm-adapter.en.md) | [中文](adding-an-llm-adapter.zh.md)

新規モデルプロバイダーの接続方法。参照実装は `packages/llm/llm-deepseek` (直接 HTTP、`eventsource-parser` で枠付けした SSE) と `packages/llm/llm-pi-ai` (LLM ライブラリーの被覆) である。先に `packages/llm/llm/src/types.ts` 内の `StreamChunk` 文書を読むこと — 両アダプターが照合検証された規約合意を記録している。

## 形状

```ts ignore-check
class MyAdapter extends LlmAdapter {
  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> { … }
}

export const name = 'llm-myprovider'
export const inject = ['llm']
export const Config: z<Config> = z.object({ apiKey: z.string(), … })

export function apply(ctx: Context, config: Config) {
  ctx.llm.registerAdapter(['my-provider'], new MyAdapter(…))
}
```

登録はエフェクト基準 (HMR 安全) であり、プロバイダー経路ごとにアダプター 1 つ — 重複は送出し、複数経路登録は全か無かである。`options.provider` がアダプターを選択し、`options.model` がプロバイダーモデル id であるため、動的カタログアダプターはライフサイクル再構成なしに新規モデルに応答できる。秘密は cordis 本来型である。環境後退付き schemastery 設定であり、`!!js process.env.MY_KEY` 経由で cordis.yml から供給される。場当たり的な鍵ファイルをコードで読んではならない。

## 規約義務 (2 実装が検証した契約)

- `finish` の前に `usage` を発し、`finish` の後に何も発しない。堅牢な方法は、プロバイダーのストリーム終端標識まで finish/usage を緩衝し、それから流すことである (末尾の usage のみ塊を送るプロバイダーに対処できる)。
- ツール呼び出し `arguments` は端から端まで生 JSON 文字列であり、断片は `argumentsDelta` で流す。プロバイダーが解析済みオブジェクトを渡す場合は `block-end` で再文字列化する。
- 塊 `index` は初出ストリーム順に割り当て、同じ塊の各差分にその添字を再利用する。
- エラーには認可された経路がちょうど 2 つある。`stream()` からの送出 (輸送と規約の失敗 — 安定符号付き `LlmError` を使う)、または `finish {kind: 'error' | 'aborted'}` でのストリーム終了 (プロバイダー帯内失敗) である。利用者は両方を扱う。失敗種別ごとに選んで文書化する。
- `options.signal` を尊重する (fetch / SDK に渡す)。
- プロバイダーが名誉できない `GenerateOptions` 項目 (停止列を持たないプロバイダーでの `stop` 一覧など) は黙って落とさず `LlmError(..., 'UNSUPPORTED_OPTION')` を送出する。
- プロバイダーが追続呼び出しに返答 id、署名、その他本来メタデータを要求する場合は、最小の可逆 JSON 投影を `finish.replayState` として発する。履歴再構築時にそれを検証する。`LlmRuntime` は歴史プロバイダー経路と対象プロバイダー経路が現在まったく同じアダプター実体に所有される場合にのみそれを渡し、同モデル、異モデル、異プロバイダーの復元が合法かはアダプターが定める。状態不在時にプロバイダー/モデル名のみから本来再演を推測してはならない。

プロバイダー固有の思考モード切替はアダプターの Config に残る。厳密なモデルメタデータは 1 つのプロバイダー中立なケイパビリティシームを使う。プロバイダー/モデル同一性と任意 `context` および `reasoning` 項目で `resolveModel()` を実装し、存在する場合のみ設定済み `defaultEffort` を宣言し、解決子の任意 `AbortSignal` を尊重する。推論 effort はアダプターがプロバイダーリクエストに写像する順序付き不透明 id である。最終配線綴りを開示したり未対応値を締めたりせず、対応時のアダプター定義 `off` を含むアダプター権威の選択可能一覧を保つ。id は配線表現と等しくなくてよい。

## 実装構造

配線型、要求直列化、輸送構文解析、塊翻訳、アダプタークラスを個別の責務に保つこと。[`llm-deepseek`](../../packages/llm/llm-deepseek/README.md) が参照配置である。

## 検証

[リポジトリ試験方針](../testing.md)に従うこと。アダプター適用範囲、実プロバイダー検査、公開項目要件を所有する。
