# クックブック: 組み込みプラグイン機能プレビューを追加する

日本語 | [English](adding-a-plugin-preview.en.md) | [中文](adding-a-plugin-preview.zh.md)

Plugin Manager は組み込みバンドル用の任意機能イラストを所有する。内部 `BUNDLE_PREVIEWS` マップを編集する場合にこのガイドに従う。パッケージはマニフェストやエクスポートを通じてイラストを宣言できない。サードパーティプラグインにプレビューインターフェースはない。

## 1. 画像が役立つかを決める

1 つの具体的な結果または認識可能なケイパビリティを示す。説明で十分な場合はマップエントリーを省略する。画像は必須ではなく、省略は領域を確保しない。必須の指示はイラスト外のローカライズされたテキストまたは設定に残す。

## 2. 固定寸法 SVG を 1 つ描く

| 項目 | 要件 |
|---|---|
| 数量 | バンドルごとに論理的な機能画像ゼロまたは 1 つ。英語と中国語のファイルはその画像の代替であり、ギャラリーやカルーセルではない。 |
| 形式 | SVG のみ。`width="640" height="300" viewBox="0 0 640 300"`（32:15）。ラスタープレビューファイルと他の寸法は未対応である。 |
| 言語 | `en` と `zh` の両方を提供する。見出し、注釈、例内容を翻訳する。公式ブランドアセットと名前は保全する。単一文字列、配列、追加言語はなし。 |
| 構成 | 1 つの主例。任意で 1 つの拡大図。重要な内容は辺から約 32 キャンバス単位離す。ページ実寸でテキストをレビューする。 |
| 書体 | 適切なフォントでレタリングをパスにアウトライン化する。機能と隣接 UI に合わせる。ブラウザーフォント代替に頼らない。 |
| テーマ | ライトとダークのテーマを比較する。1 つのイラストが両方に仕える。ダーク背景で消える透明なダークテキストを避ける。 |

SVG は自己完結である。フォント、リモートリソース、スクリプト、ハンドラー、アニメーション、スタイルシート、`text`、`foreignObject` はなし。`image` 要素は変更のない公式 PNG・JPEG・WebP ブランドアセットを base64 データ URL として埋め込んでよい。小さなプラグインアイコンは形状のみのままである。この例外はブランド artwork を保全するものであり、ラスタープレビューファイルを許可しない。検証はデコード画素ではなくデータ URL 外形を検査する。ページは SVG を `<img>` 経由で描画する。両言語の raw ファイル合計は 1 MiB 以内に収めなければならない。Plugin Manager クライアントバンドルに base64 データ URL として埋め込まれるため、小さく保つ。

## 3. 内部ペアを登録する

`<feature>-preview.svg` と `<feature>-preview.zh.svg` を [Plugin Manager アセット](../../packages/client/ui-plugin-manager/src/client/assets/)の下に置く。両方を [PluginManagerPage.tsx](../../packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx) にインポートし、次に正確な組み込みパッケージ名 1 つを `BUNDLE_PREVIEWS` に追加する。

```ts ignore-check
import examplePreview from './assets/example-preview.svg'
import examplePreviewZh from './assets/example-preview.zh.svg'

// One entry in the existing Map<string, Readonly<Record<'en' | 'zh', string>>>.
['@deepseek-ai/dsh-example-bundle', { en: examplePreview, zh: examplePreviewZh }]
```

マップに必須の `en` と `zh` 型を保持する。パッケージメタデータ、ホスト読み取りメソッド、エクスポートされたプレビューリソース、サードパーティ宣言パスを追加しない。[badge skill](../../packages/client/ui-plugin-manager/src/client/assets/badge-skill-preview.svg) と [voice input](../../packages/client/ui-plugin-manager/src/client/assets/voice-input-preview.svg) イラストを例として使う。voice transcript は説明用のサンプル内容であり、録音結果ではない。

## 4. ページ契約を保つ

| 項目 | 現在の動作 |
|---|---|
| 位置 | 説明と状態通知の下、コンポーネントとソース情報の上。説明に揃える。 |
| 間隔 | 画像上に 24 px。後の details 区分前に 32 px。 |
| 表示 | 1 つの `<img>`、自然 640×300 キャンバス、最大で利用可能幅と高さ 320 px。比例拡縮。ページが境界と 16 px 角を提供する。 |
| 言語 | 現在の UI 言語が必須ファイルの一方を選択する。代替テキストはローカライズされたプラグイン名を使う。 |
| 可用性 | 有効化前に可視である。デコード失敗はコントロールを妨げずにローカライズされた通知を表示する。リストとコンポーネント行は小さなアイコンを保持する。 |

## 5. 検証とレビュー

`pnpm exec vitest run scripts/builtin-plugin-preview.spec.ts packages/client/ui-plugin-manager/tests/components.client.spec.tsx scripts/client-bundle-css.spec.ts` を実行し、次に `pnpm run build` を実行する。アセットテストは登録ペアすべて、固定 SVG 寸法、自己完結内容、合計寸法を検査する。型検査は両言語を必須とする。これらの検査は形式を強制する。視覚品質と両言語での等価な意味は依然としてレビューが必要である。

実際のプラグイン詳細を有効化前に英語と中国語で開く。画像をデコードし、自然 640×300 寸法、配置、ライト・ダーク可読性、390 px での横はみ出しなしを確認する。artwork なし組み込みとサードパーティプラグインも検査する。PR 証跡は [record-browser-gif](../../.agents/skills/record-browser-gif/SKILL.md) に従う。最終 clean コミットから記録し、実演フローを正確にラベル付けする。
