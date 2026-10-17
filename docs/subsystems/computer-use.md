# 計算機利用

日本語 | [English](computer-use.en.md) | [中文](computer-use.zh.md)

計算機利用は設定済み提供子を通じて模型に地域卓面を観測操作させる。共有 DSH ケイパビリティは**計算機利用**と呼ばれ、**Cua Driver** は上流実装を名指す。


[`macOS CUA 提供子`](../../packages/experimental/cua-macos/README.md)は[共有 CUA 対象と実行子](../../packages/experimental/cua/README.md)を使い、利用者質問とプロファイル設定を通じて応用承諾を強制する。

## 提供子を選ぶ

同一組み立てに [`dsh-computer-use`](../../packages/computer-use/computer-use/README.md) と提供子 1 つを載せる。両 Cua Driver 提供子は試験公開 npm パッケージであり、明示的参加を要する。

| 提供子 | 実行時 |
|---|---|
| [Cua Driver MCP](../../packages/experimental/computer-use-cua-driver-mcp/README.md) | MCP 経由で接続された導入済み `cua-driver` 実行物 |
| [Cua Driver 本来](../../packages/experimental/computer-use-cua-driver-native/README.md) | npm 依存で導入される台本来実行時 |

各提供子は上流道具目録を供給する。共有サービスは名のみを登録し、同名の別実体を含む 2 件目の提供子を拒む。共通卓面操作法も模型制御選択子も持たない。

## 寿命と卓面共有

提供子は道具と所有資源を閉じつつ登録を保つ。起動失敗は試みた登録を放す。MCP 提供子は再接続中に登録を保つ。

登録済み提供子 1 つはセッション用に卓面を確保しない。呼び出し側はセッション群と分離 DSH 過程にまたがり完全な観測、動作、検証作業流を調整する。取り消された呼び出しは卓面が既に受けた入力を取り消せない。

## 結果と台要件

道具は通常実行管路とセッション記録を使う。付属貯蔵付き画像対応模型経路は durable 截図を受け、未対応画像経路は既存 MCP 画像診断を受ける。提供子 README が導入、許可、台制限を所有する。

[決定記録](../../.agents/notes/implemented/architecture/2026-09-12-computer-use-provider-registration.md)は登録のみサービスと 2 つの Cua Driver 統合を述べる。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

`scripts/gen-cordis-catalog.ts` によりソースから生成 (doc-sync 内の `pnpm run verify-cordis-catalog` で鮮度を検証。`pnpm run gen-cordis-catalog` で再生成) — 言語面は地域固有の対訳文書経路のみが異なる。署名ブロックは `ts cordis-catalog` フェンスを使い元のソース JSDoc を保つ。送出様式は[入門](../cordis-primer.md#dispatch-modes)で定義し、継承 `ctx` API は [cordis-api/inherited.md](../cordis-api/inherited.md) にある。

<a id="ctxcomputeruse--computeruseregistry"></a>

### `ctx.computerUse` — `ComputerUseRegistry`

共有計算機利用サービス内の任意提供子登録 1 件を所有する。

```ts cordis-catalog
/**
 * Reserve the sole provider slot until the contribution is disposed.
 * A second registration fails even when it repeats the current name. Providers
 * must stop their tools and await owned work before releasing this registration.
 * @param name - provider-owned name used in registration diagnostics.
 * @returns the effect disposer for this exact registration.
 */
register(name: ComputerUseProviderName): () => Promise<void>
```

ソース: [`packages/computer-use/computer-use/src/index.ts`](../../packages/computer-use/computer-use/src/index.ts)
<!-- END GENERATED cordis-surface -->
