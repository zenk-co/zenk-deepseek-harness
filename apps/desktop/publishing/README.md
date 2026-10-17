---
description: "完成した Desktop インストーラーと更新フィードを選択されたダウンロードサービスへ公開する。このリファレンスはデプロイの識別、アップロード資格情報、固定ダウンロード、監査レコードを扱う。ビルド構成と署名操作には別のオーナーがいる。"
---

# Desktop の公開

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

完成した Desktop インストーラーと更新フィードを選択されたダウンロードサービスへ公開する。このリファレンスはデプロイの識別、アップロード資格情報、固定ダウンロード、監査レコードを扱う。ビルド構成と署名操作には別のオーナーがいる。

## 目次

- [公開の前提条件](#prerequisites)
- [デプロイとテストリリースの識別](#upload-updates)
- [インストーラーと更新フィードの公開](#publish-feeds)
- [固定インストーラーダウンロード](#fixed-downloads)
- [アップロード資格情報](#credentials)
- [アップロードの監査とリカバリー](#audit-and-recovery)

保持されるセルフホストビルドには [CI 公開ワークフロー](ci/README.md)を使う。これはインストーラーを元のマシンに保持し、再開可能な公開をサポートする。以下のコマンドは既存の手動認可ローカルアップローダーのままである。チェックアウトローカルの監査レコードを保持し、オペレーターの Git アイデンティティを使う。CI パブリッシャーのロック、承認、タグのみのリカバリーは共有しない。1 つのチャネルに対して両方のライターを同時に実行しないこと。両者は同じアップロードプラン検証を使う。オーケストレーションを分けることで、既存の手動コマンドを保ちつつ CI 向けの不変試行リカバリーを追加している。手動コマンドの統合または廃止は別の作業である。

<a id="prerequisites"></a>

## 公開の前提条件

公開には完成したリリース成果物と、オペレーターによる明示的な認可が必要である。インストーラーをビルドしたり Actions 成果物をダウンロードしたりしても公開にはならない。[リリースバージョンのルール](../packaging/README.md#release-versions)を読み、パッケージングの証拠を保持する。マシンプリセットはパッケージング用であり、アップロード/COS コマンド用ではない: `DSH_PACKAGING_PRESET` を unset し、既存のターゲット dotenv アップロード構成を提供する。構成と実際の COS/CDN 受理はリリースオペレーターが検証しなければならない。

<a id="upload-updates"></a>

## デプロイとテストリリースの識別

`DSH_DESKTOP_AUTO_UPDATE_ENV` は、パッケージング中に埋め込まれる URL と後続の COS アップロードの両方に対して `test` または `production` を選択する。値がない場合は `test` を選択する。テストパッケージングは `DOWNLOAD_TEST_ORIGIN` にその HTTPS オリジンを必要とし、production は `https://download.deepseek.com` を使う。アップロードは `DOWNLOAD_TEST_COS_BUCKET` または `DOWNLOAD_PROD_COS_BUCKET` に選択されたバケットを必要とする。Production のフィードは `dsh-desk/feeds/<target>/` を使い、バイナリは `dsh-desk/bin/<target>/` を使う。テストリリースは `DOWNLOAD_TEST_RELEASE_ID` を必要とする: 32 文字の小文字 16 進数で、`dsh-desk/<release-id>/feeds/<target>/` と `dsh-desk/<release-id>/bin/<target>/` として挿入される。YAML 参照、stable チャネルのエイリアス、blockmap はそのリリースディレクトリ内に留まる。ターゲットは `mac-arm64`、`mac-x64`、`win-x64` である。

更新先とアップロード資格情報は選択されたデプロイに従う:

| 環境 | 公開オリジン | COS バケット | COS 資格情報 |
|---|---|---|---|
| `test` または未設定 | `DOWNLOAD_TEST_ORIGIN` | `DOWNLOAD_TEST_COS_BUCKET` | `DOWNLOAD_TEST_COS_SECRET_ID`, `DOWNLOAD_TEST_COS_SECRET_KEY` |
| `production` | `https://download.deepseek.com` | `DOWNLOAD_PROD_COS_BUCKET` | `DOWNLOAD_PROD_COS_SECRET_ID`, `DOWNLOAD_PROD_COS_SECRET_KEY` |

以下のコマンドでテストリリースバッチごとに新しい ID を生成し、その出力を `.env.macos` または `.env.windows` の `DOWNLOAD_TEST_RELEASE_ID` にコピーする。値を所有するのはこれらの Git 管理外のプラットフォームファイルである。シェル変数はそれを上書きせず、dotenv の値はシェル展開されない。パッケージング、アップロード、リトライを通じて ID を保つ。アップロードは更新 URL が異なる完了レコードを拒否する。バージョン間のアップグレードをテストするには、後のバージョンにインストール済みクライアントの ID を再利用する。Production はこのフィールドを使わない。

```sh
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(16).toString('hex'))"
```

各テストバッチはその完全なダウンロードリンクで配布する。インストール済みのテストクライアントはそのバッチのフィードを保ち、新しい ID を自動的に発見しない。形式検証は乱数性を確立できない。ジェネレーターの出力を使う。ランダムなパスは推測を減らすが、リンク保持者によるアクセスは減らさない。バッチを撤回するには、その COS オブジェクトを削除し、CDN ディレクトリをパージする必要がある。

<a id="publish-feeds"></a>

## インストーラーと更新フィードの公開

ターゲット dotenv ファイルで更新オリジンと選択した COS バケット、SecretId、SecretKey を構成し、同じターゲットをパッケージしてアップロードする:

```sh
pnpm run package:desktop:mac:arm64
pnpm run upload:mac:arm64
```

内部テストパッケージング用のターゲット dotenv ファイルは `DSH_DESKTOP_AUTO_UPDATE_ENV=test` と `DOWNLOAD_TEST_ORIGIN=https://download-test.deepseek.com` を明示的に設定する。アップロードは `DOWNLOAD_TEST_COS_BUCKET=bj-toc-download-test-1320056602` と別のテスト資格情報を使う。テストと production の両方が固定の Nightly チャネルを使う。デプロイの選択がチャネル切り替えを有効にすることはない。

初期の内部テストパッケージは `test` デプロイを使う。`production` を明示的に選択するのは production リリースのときだけである。アップロード資格情報を変えても既存パッケージのターゲットは変わらない。パッケージングは COS 資格情報を必要とせず、electron-builder の公開を無効にし、子プロセスから COS 資格情報を除去し、署名と公証が成功した後にのみ完了を記録する。アップロードは資格情報を読む前に、このレコード、デプロイ、ターゲット、共有バージョン、ファイル名、サイズ、SHA-512 を検証する。パッケージと blockmap は YAML より先にアップロードされ、履歴オブジェクトは保持される。すべてのリリースは `nightly.yml` または `nightly-mac.yml` を公開する。stable リリースは同じ成果物を指す `latest.yml` または `latest-mac.yml` も公開する。公開される YAML は絶対バイナリ URL を使う。アップローダーは Cache-Control を未設定のままにする。COS SDK がそうしなければ追加する空ヘッダーも含めてである。キャッシュポリシーはデプロイインフラストラクチャが所有し、フィードは非キャッシュ、バイナリのキャッシュは別途構成可能である。ターゲットごとに公開を直列化し、リリース適格性の確認前に公開成果物とフィード内容を検証する。

Windows NSIS アップロードは、インストーラーの隣に生成された非空の `.exe.blockmap` を必要とする。blockmap はチャネル YAML より先にアップロードされる。NSIS インストーラーのメタデータは、別の web-installer 形式が使う埋め込み `blockMapSize` を必要としない。ファイルプランのテストは、手書きの埋め込みマップフィールドではなく、固定されたビルダーの blockmap ジェネレーターを使う。

<a id="fixed-downloads"></a>

## 固定インストーラーダウンロード

固定インストーラーダウンロードは、リポジトリルートから `pnpm run upload:latest:mac:arm64`、`pnpm run upload:latest:mac:x64`、または `pnpm run upload:latest:win:x64` を使う。完成したターゲットの DMG または EXE を `desktop/dsh-latest-macos-arm64.dmg`、`desktop/dsh-latest-macos-x64.dmg`、または `desktop/dsh-latest-windows-x64.exe` にアップロードする。Production の URL は `https://download.deepseek.com/` で始まり、テストの URL は `DOWNLOAD_TEST_ORIGIN` を使う。どちらのデプロイもターゲット dotenv のデプロイ、バケット、資格情報、通常のリリース検証、以下のアップロード監査を再利用する。各コマンドはフィード、blockmap、リリースタグを公開せずに 1 つの固定オブジェクトを置き換える。テストの固定ダウンロードはテストバケット内のリリース ID 間で共有されるが、パッケージされた更新 URL は依然として元のリリース ID を必要とする。公開はプレリリースバージョンも含めて明示的である。デプロイインフラストラクチャは、置き換え後にキャッシュされた固定ダウンロードの再検証を構成するかパージしなければならない。ローカルループバックテストがアップロードをカバーする。実際の COS と CDN の受理はリリースオペレーターが所有する。

<a id="credentials"></a>

## アップロード資格情報

Windows のオペレーターは、DPAPI で暗号化された `SecretId` と `SecretKey` の SecureString フィールドを持つ CLIXML オブジェクトをリポジトリ外に保持できる。[資格情報ランチャー](../scripts/upload-with-credentials.ps1)は明示的な `-CredentialFile` と `-Environment production` または `test` を要求する。`-Upload` なしでは、復号とローカル Node 子プロセスへの注入だけを検証し、ネットワークリクエストは行わない。`PATH` 上の Node、およびファイルを暗号化した Windows ユーザーとマシンを必要とする。プレーンテキスト、空、空白のみのフィールドは失敗する。親環境は変更されず、子は無関係なシークレットと Node のプリロードオプションが除去された後、選択された COS ペアだけを受け取る。子の生の stderr は抑制され、stdout 内の資格情報値は秘匿される。このチェックは COS 認可を証明するものではない。明示的なアップロードはさらに `-Upload -Target <target> -Bucket <bucket>` と、以下の通常の完成リリース前提条件を必要とする。実際のクラウドアップロードはリリースオペレーターの適格性確認のままである。そのアップロード呼び出しに `-Latest` を加えると、更新フィードやリリースタグを公開せずに固定インストーラーを置き換えられる。このランチャーは恒久キーをサポートし、STS 資格情報はサポートしない。明示的なアップロードは、ネットワーク書き込みの前に、選択されたデプロイとバケットがターゲット dotenv と完成パッケージレコードに一致することを必要とする。dotenv が他の COS キーを含んでいても、DPAPI 資格情報ペアを使う。

<a id="audit-and-recovery"></a>

## アップロードの監査とリカバリー

`upload:*` を通じたテストと production のアップロードは、リリースプリフライト後に新しい `.desktop-build/upload-records/<environment>-<target>-*` ディレクトリを保持する。`plan.json` は宛先、バージョン、すべてのファイルのサイズ/SHA-512、公開された YAML バイトを記録する。フラッシュされた `events.jsonl` は PUT の意図と、利用可能な場合は応答ステータス/リクエスト ID を記録する。`result.json` は完了または最後に失敗したステージを記録する。最終結果の欠如は、成功ではなく中断またはストレージ利用不可を意味する。資格情報値、認可ヘッダー、生の SDK エラーは記録されない。監査書き込みの失敗は以降の PUT を停止する。すべてのオブジェクトは、明示的な長さと Content-MD5 を持つ 1 回のストリーミング Tencent COS PUT である。COS SDK はボディがストリームでない場合にのみリクエストを繰り返し、このアップローダーもどちらもリトライしない。部分レコードを保持し、次の操作の前にリモート状態を検査する: タイムアウトやレシート書き込みの失敗は、オブジェクトが保存されなかったことを証明しない。これらのレコードはローカルであり、改ざん防止でも自動バックアップでもない。各リリースのレコードはビルド証拠とともに管理されたストレージへアーカイブする。公開 CDN の読み戻しは別のリリース適格性確認であり、アップロード結果に明示的に `not-performed` とマークされる。

## 開発者ノート

なし。
