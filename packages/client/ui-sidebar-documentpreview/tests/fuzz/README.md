# XLSX ファズ診断

日本語 | [English](README.en.md) | [中文](README.zh.md)

Openpyxl と XlsxWriter で表計算ファイルを生成し、ソース XLSX アダプターを独立に記録されたセル値、数式、未対応コンテンツ区分と比較する。この明示的な診断キャンペーンは失敗を保持し非ゼロ終了する。既定ユニットスイートの一部ではない。

## キャンペーンの実行

ワークスペース依存をインストールし、Openpyxl、XlsxWriter、Pillow を備えた Python インタープリターを使う。PowerShell で `$excelFuzzPython` にそのインタープリター実行パスを設定する。リポジトリルートから新しい出力ディレクトリで実行する。

```powershell
& $excelFuzzPython packages/client/ui-sidebar-documentpreview/tests/fuzz/generate.py .artifacts/excel-fuzz-new --seed 4863 --random-cases 400
pnpm exec tsx packages/client/ui-sidebar-documentpreview/tests/fuzz/run.client.ts .artifacts/excel-fuzz-new
```

シードは機能組み合わせ、値、バイト変異を制御する。ZIP メタデータは固定である。再現性には `manifest.json` に記録された writer バージョンも必要である。ジェネレーターは内部関係ターゲットを検証し、ブックを有効と分類する前に Openpyxl で oracle セルを再読み込みする。拒否された候補は `generatorErrors` に残る。ランダムバイト変異は別に分類される。

既存コーパスから選択ケースを再実行する。

```sh
pnpm exec tsx packages/client/ui-sidebar-documentpreview/tests/fuzz/run.client.ts .artifacts/excel-fuzz-new --only openpyxl-table --report table.json
```

ランナーは各入力に使い捨てワーカー期限 10 秒を与え、入力不変性、セル値、数式キャッシュ、通知順序・一意性を検査する。`--timeout-ms` はその診断期限を変更する。レポートはすべての結果を保持する。`repros/` は機能組み合わせの少ない代表的失敗を含み、全体最小入力の主張ではない。受け入れられた破損 ZIP は情報であり、別途検査が必要である。

## 古いアダプターとの比較

`--baseline-ref <commit-or-ref> --report baseline.json` はそのリビジョンの `xlsx.ts` を Git から読み、通知比較を無効化する。現在の依存バージョンと共有変換ヘルパーはそのまま使う。パッチ導入後にパッチなし ExcelJS baseline を再現できない。元の依存状態のレポートを保持するか、そのリビジョンを別のチェックアウトで実行する。一時 baseline モジュールはワーカー終了後に除去される。これはソース構文解析の比較であり、FortuneSheet ブラウザー描画や出荷 Web プロファイルの比較ではない。

## 保持された回帰

[OPC フィクスチャ](../fixtures/excel-opc/)はシード 4863 コーパスから複写された 5 つの分離失敗と結合 Openpyxl ブックを含む。Openpyxl 3.1.5 はコメント、テーブル、名前空間接頭辞と部品名ケースを生成する。XlsxWriter 3.2.9 は相対ターゲットケースを生成する。結合ブックは図、条件付き書式、固定見出し、非表示行・列・シート、結合、スタイル、ハイパーリンク、XML 風リテラルテキスト、数式を追加し、次に `sheet-prefix` と `sheet-filename` 変異を適用する。Openpyxl は保存済み入力を独立に検証する。ユニットとブラウザーテストは Python なしにこれらのコミット済みバイトを読む。

[XML フィクスチャ](../fixtures/excel-xml/)は 1 つの XlsxWriter 3.2.9 ブックと 7 つの等価符号化を保持する。すなわち UTF-16 ワークシートまたはメタデータ XML、再配置されたブック・スタイル・共有文字列、CDATA テキスト、再配置されたワークシート・描画ディレクトリである。各々は数式キャッシュ、Unicode と XML 風テキスト、コメント、テーブル、スタイル、結合、固定見出し、非表示内容、4 つの通知区分すべてを保持する。ExcelJS 更新時は Node とブラウザー両エントリーを通じて完全プレビューとコメント・テーブルメタデータを比較し、次にビルド済み Worker に対して `apps/web/tests/excel-opc.e2e.ts` を実行する。元のコーパスレポートを保持する。再実行結果は新しい `--report` 名で保存し、ZIP ディレクトリ完全性を独立リーダー受容とは別に検査する。

[opening フィクスチャ](../excel-opening-fixture.ts)は結合 Openpyxl ファイルから Strict URI 別名、ルートターゲットと部品名の大文字小文字変種、孤立 DrawingML を導出する。これらの変換はセルデータを保持し、両パーサーエントリー、完全プレビュー比較、出荷ブラウザー Worker を通じて実行される。曖昧な ASCII 大文字小文字等価エントリーは拒否される。非 ASCII 名は区別されたままである。

Node とブラウザーバンドルのパーサー回帰を実行する。

```sh
pnpm exec vitest run packages/client/ui-sidebar-documentpreview/tests/excel-opening.client.spec.ts packages/client/ui-sidebar-documentpreview/tests/excel-opc.client.spec.ts packages/client/ui-sidebar-documentpreview/tests/excel-xml.client.spec.ts
```

ファズレポートは各入力の SHA-256、開けたかどうか、ワークツリー状態を記録する。`validOpened` と `validRejected` は開放失敗と値差異を分離する。厳密終了状態はどちらの欠陥も拒否する。既知の 1904 時刻・期間オフセットと空文字数式キャッシュ差異は診断失敗のままである。パーサーが受け入れた破損入力は情報のままである。

ExcelJS パッチは公開パッケージに対して `pnpm patch` と `pnpm patch-commit` で保守する。インストール済み依存ツリーはパッチに入れてはならない生成ランチャーを含む。キャッシュ済みインストールに対するテストに頼る前に、新しい `pnpm patch --edit-dir <new-directory>` 展開でパッチ適用を検証する。
