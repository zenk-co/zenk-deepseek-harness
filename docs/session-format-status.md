# セッション形式バージョンとリリース状態

日本語 | [English](session-format-status.en.md) | [中文](session-format-status.zh.md)

## 概要

このリファレンスを使い、チェックアウト writer、受け入れ済み互換性 baseline、最新の公開セッション形式を区別する。コード定数が writer を所有し、以下の確定記録とリリース記録が受け入れ済み履歴と公開証跡を別々に特定する。他の文書はそれらの値を再掲せずここへリンクする。

## 目次

- [真実の情報源](#sources-of-truth)
- [確定記録](#finalization-record)
- [リリース記録](#release-record)
- [記録の更新](#updating-the-record)
- [開発者ノート](#dev-note)

<a id="sources-of-truth"></a>
## 真実の情報源

- **チェックアウト writer:** [core セッション型](../packages/core/session/src/types.ts)内の `SESSION_FORMAT_VERSION` は、コード内で手保守される唯一の現行 writer 番号である。[カタログ生成器](../scripts/gen-session-format-catalog.ts)はコーデック順序を導出し、隣接マイグレーションがそこに到達することを検査する。パッケージバージョン、コーデックエクスポート名、フィクスチャファイル名、射影キャッシュバージョンは writer の権威ではない。
- **最新のリリース済み形式:** 以下の記録内の `latestReleasedVersion` は公開セッション形式を特定する。`evidenceTag` はその値を持つタグ付き writer の公開製品リリースを指名する。その形式を運ぶ最初のリリースである必要はない。バイリンガル対訳は同じ記録に対して検査され、別の決定として保守されない。
- **リリース状態:** writer 定数を検証済みリリース記録と比較する。等しさは writer 形式が出荷済みであることを意味する。より大きな writer バージョンはまだ公開として記録されていない。その確定記録は受け入れ済み互換性 baseline を独立に特定する。古いチェックアウトを新しいブランチの検証済み記録と比較する場合、より低い writer バージョンは古い writer 形式を特定する。ローカル整合性ゲートは 1 つのチェックアウト内でのその順序を拒否する。別のリリース済み真偽値は保守されない。より大きなバージョンを未リリースと宣言する前に、公開リリースが記録を進めていないことを検証する。

alpha、beta、リリース候補の製品公開は、リリース済みセッション形式義務を確立する。GitHub の prerelease フラグで永続化ユーザーデータを使い捨てにできない。欠落したリリース記録は非公開の証拠ではない。[バージョン付与と権威の決定](../.agents/notes/implemented/architecture/2026-08-10-session-log-version-mechanism.md)は互換性決定を所有し、[リリース済み形式マイグレーション](../.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.md)は不変世代と隣接変換を所有する。

[形式リファレンス](persistence-changes/historical-formats/README.md)はゼロからチェックアウト writer までのすべての整数を、歴史的スキーマと既存の現行カタログと共に文書化する。

<a id="finalization-record"></a>
## 確定記録

```yaml session-format-finalization
latestFinalizedVersion: 4
```

V4 は[チェックポイント](persistence-changes/finalized/v4.json)に受け入れ済み互換性 baseline を持つ。[リーダー互換性規則](persistence-changes/README.md#compatibility-rules)が満たされ、必要なレビューが記録された場合、スキーマ変更は V4 のまま残り得る。バージョン上げ決定にはより高い writer バージョンと独自のヘッダー遷移が必要であり、受け入れ済み 3→4 遷移を再利用できない。受け入れ済み機械記録と after スキーマは不変のままである。

確定は将来のすべての V4 追加を凍結せず、公開を主張しない。以下のリリース記録は独立に検証された公開バージョンを保持する。受け入れ済み意味を保つ通常のコメント、別名、ソース位置、実装修正はこの baseline を変えない。

[最終 V3 語彙](cookbook/adding-a-session-format-version.md#final-v3-vocabulary)は歴史的なままであり、現在の V4 追加から独立している。

<a id="release-record"></a>
## リリース記録

```yaml session-format-release
latestReleasedVersion: 4
evidenceTag: dsh-v0.2.0-rc.2
```

証跡: 公開製品タグ `dsh-v0.2.0-rc.2`。タグ付き writer: `packages/core/session/src/types.ts`。

<a id="updating-the-record"></a>
## 記録の更新

セッション形式上げを実装する場合はコード定数と隣接カタログを一緒に更新する。公開前にこのリリース記録を進めない。製品リリースがより高いセッション形式を初めて公開する場合は公開とそのタグ付き writer を確認し、次にこの記録と証跡タグおよびタグ付き writer パスを同じバイリンガル更新で進める。同じ形式を運ぶ後の製品リリースでは記録の変更は不要である。開発トランク上でこれを下げることは決してない。

[文書標準テスト](../scripts/doc-standard.spec.ts)は記録構造、バイリンガル等価性、証跡タグと writer パス整合性、および文書化リリースがチェックアウト writer を超えないことを検査する。このキーレス検査は GitHub に問い合わせず、記録が最新であることも証明しない。公開検証はリリース更新の一部であり続ける。

一般的な動作には「現在の形式」と「次の隣接バージョン」を使う。固定マイグレーション入出力、wire スキーマ、歴史的証跡、それら特定バージョンのテストには明示的な番号を保持する。[形式バージョンクックブック](cookbook/adding-a-session-format-version.md)は最新の確定またはリリース済み形式に N を、その後継に N+1 を使う。

<a id="dev-note"></a>
## 開発者ノート

なし。
