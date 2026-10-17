---
description: "Reuse Computer Use application and window objects with authorized, logged platform operations."
kind: "package-library"
---

# @deepseek-ai/dsh-cua

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

アプリケーションを検査し、PTC 呼び出しまたぎでウィンドウオブジェクトを保持し、通常のツールパイプラインでアクションを送ります。プラットフォームプロバイダーがネイティブ実行を提供します。このライブラリーはオブジェクト API、リクエスト検証、アプリケーション同意、画像許容を所有します。外部 PTC ランタイムは変数永続化を所有します。

## 目次

- [このパッケージの利用](#use-this-package)
- [実装の理解](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [モデル体験](#model-experience)
- [既知の制限と deferred work](#known-limitations-and-deferred-work)
- [開発者ノート](#dev-note)

-----

<a id="use-this-package"></a>
## このパッケージの利用

ネイティブ操作を有効化するには [macOS プロバイダー](../cua-macos/README.md) をマウントします。外部 PTC ホストは `@deepseek-ai/dsh-cua/bridge` から `connectCua` をインポートし、現在の `tools.cua` バインディングを提供します。ソース構成とネイティブ準備はプロバイダーに属します。

単一ウィンドウタスクには App メソッドを使います。`getApp` は初期アクセシビリティ状態を読みます。明示ウィンドウが必要な場合は `getWindows` と `getWindow` で選択します。1 つの app/window スコープの再読込はその要素インデックスを置換し、別ウィンドウのスナップショットは無効化しません。キーボード入力はアプリケーションのフォーカスに従います。無効なリクエスト引数はディスパッチ前に読みやすいメソッド、パラメーター、要件で拒否されます。

観測メソッドは結果を送出して返します。1 つの可視コピーには `void await app.getAXState()` を使い、`emit:false` では返却テキストを一度だけ出力します。スクリーンショットは `bytes`、`mimeType`、`pixelWidth`、`pixelHeight`、`windowId` を持つ `CuaScreenshot` を返します。画像シンクは同じオブジェクトを受け取ります。拡張子選択や画像宣言にはその MIME 型を使います。形式は PNG、JPEG、WebP、GIF になります。各スクリーンショットはアタッチメントパイプラインに一度だけ入ります。`emit:false` はオブジェクトシンクのみ抑制します。

`tools.cua` は操作値を直接返します。スクリーンショット値は符号化画像 Base64 を保持し、ツールレンダラー向け durable `attachment` 参照を加えます。モデル内容は符号化バイトなしに座標メタデータと 1 画像を含みます。キャプチャー前に、ツールはアタッチメントストアと画像入力を宣言する解決済みモデルルートを要求します。許容と保存の失敗は呼び出しを拒否します。オブジェクトブリッジはスクリーンショットバイトと検証済みメタデータを保持し、同じ画像の再アップロードや再送出はしません。

アプリケーション同意は起動、観測、キャプチャー、入力に先行します。タスクアクセスは選択インスタンスに属します。保存済み許可にはプラットフォーム検証済み実行ファイル同一性が必要です。取消は影響エージェント接続を閉じるため、古いオブジェクトは新規選択が必要です。キャンセル、タイムアウト、再接続後に入力は再送されません。

アクションは `dispatched:true, verified:false` を返します。結果検証には新規状態を読みます。座標アクションは既定で最新の返却スクリーンショットのピクセルです。`relative: true` は成功ウィンドウ観測後に 0〜1000 の整数を受け付けます。ホストはスクリーンショット返却前にアタッチメント正規化と選択モデルルートの画像投影を解決し、入力をネイティブウィンドウポイントに変換します。リサイズはスクリーンショットマッピングを無効化します。`SCREENSHOT_REQUIRED` は絶対座標に新規スクリーンショットを要求します。リサイズは古い座標を `WINDOW_CHANGED` で拒否します。移動だけではウィンドウローカル座標を保持します。

-----

<a id="understand-the-implementation"></a>
## 実装の理解

<details>
<summary>Shared execution and platform ownership</summary>

プロバイダーは準備済みヘルパー、接続ファクトリー、ガイダンスで [installCua](src/index.ts) を呼びます。[NativeClient](src/native-client.ts) はリクエスト相関、バイト制限、キャンセル確認、失敗確定を所有します。プラットフォームコネクターは起動と接続クリーンアップを所有します。共有エグゼキューターはエージェントごとに 1 接続を保持し、破棄中に飛行中画像書込みを結合します。

[The operation schema](src/protocol.ts) はモデルパラメーターと別宣言のホスト専用フィールドの正です。ネイティブ実装は実行時にターゲット同一性、ウィンドウ形状、リソース制限、OS アクセスを強制します。このライブラリーには別投影レジストリーも durable 状態もないため、不変コンパニオンは公開されません。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [macOS provider](../cua-macos/README.md)
- [Object interfaces](src/types.ts)

-----

<a id="model-experience"></a>
## モデル体験

### 許可済みアプリケーション操作

#### モデルが見るもの

プラットフォームプロバイダーは共有 `cua` ツールをマウントし、操作命令を提供します。呼び出しと観測は同じ app/window インターフェースを使い、通常のセッション履歴に入ります。プラットフォームガイダンスは [macOS プロバイダー](../cua-macos/README.md#model-experience) に文書化されます。

#### トークン効果

操作結果と許容画像がモデル入力を加えます。保持 JavaScript オブジェクトはプロンプトに直列化されません。呼び出し側の重複出力は観測テキストを繰り返すことがあります。

#### KV キャッシュ効果

結果は履歴に追記されます。オブジェクト保持は prior メッセージを書き換えません。マウントツールやガイダンスの変更はリクエストプレフィックスを変えることがあります。

## 既知の制限と deferred work

<a id="known-limitations-and-deferred-work"></a>

- ネイティブ実行は現在 macOS プロバイダーを使います。Windows 対応は共有 app/window API、許可、スナップショット有効性、アクション結果意味を保持する別プロバイダーパッケージとして C# ヘルパーで計画されます。その実装はシステム固有制限を文書化し、クロスコンパイル証拠と Windows デスクトップ検証を区別しなければなりません。
- 永続変数は一連の操作またぎにアプリケーションを予約しません。他エージェントとユーザーはその状態を変更できます。ホバーと観測は prior ポインター位置を復元しません。[continuous interaction](../../../.agents/notes/implemented/architecture/2026-10-13-cua-continuous-hover.md) は呼び出しまたぎ所有権を使いません。
- Windows 対応とプラットフォーム検証で `computer-use` グループへの昇格が可能になるまで、このパッケージは `experimental` に留まります。

-----

<a id="dev-note"></a>
### 開発者ノート

None.
