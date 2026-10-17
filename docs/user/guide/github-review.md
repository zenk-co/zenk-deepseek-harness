# GitHub Webhook からレビューセッションを作成する

日本語 | [English](github-review.en.md) | [中文](github-review.zh.md)

このオプトインのオーバーレイは、署名付き GitHub エンドポイントを `dsh web` に追加する。設定されたリポジトリのプルリクエストがドラフトからレビュー待ちに変わると、ルールはリポジトリの Web ワークスペース配下にタイトル付きルートセッションを作成し、読み取り専用のレビュープロンプトを開始する。

## 前提条件

- DSH が Web ワークスペースとして登録できるローカルチェックアウト。
- `DSH_GITHUB_WEBHOOK_SECRET` 資格情報参照経由で利用できる高エントロピーの GitHub Webhook シークレット。
- 1 つの公開 URL をループバックリスナーに転送できる TLS リバースプロキシまたはトンネル。
- Pull requests イベントへの GitHub Webhook 購読（コンテンツタイプ `application/json`）。

オーバーレイはワークスペースの既定値を起動ディレクトリ、リスナーの既定値を `127.0.0.1:3081` とする。`DSH_GITHUB_REVIEW_WORKSPACE` と `DSH_GITHUB_WEBHOOK_PORT` で上書きできる。

## DSH を起動する

シークレットを生成し、再起動をまたいで同じ値を保持する:

```sh
export DSH_GITHUB_WEBHOOK_SECRET="$(openssl rand -hex 32)"
printf '%s\n' "$DSH_GITHUB_WEBHOOK_SECRET"
```

まず両方の experimental パッケージを Web プロファイルにインストールする。プロファイルはピアを自動インストールしないため、GitHub アダプターには webhook ランタイムを明示的に指定する必要がある:

```sh
dsh plugin --profile web add @deepseek-ai/dsh-webhook @deepseek-ai/dsh-webhook-github
export DSH_GITHUB_REVIEW_WORKSPACE=/path/to/deepseek-harness
dsh web --patch "${DSH_HOME:-$HOME/.dsh}/profiles/web/node_modules/@deepseek-ai/dsh-webhook-github/examples/github-review/cordis.yml"
```

アダプターはサンプルを配布し、プロファイルのインストールディレクトリから読み込むため、ルールモジュールはプロファイルにインストールされたピアを解決できる。プロファイル外の任意のディレクトリからルールを実行してはならない。カスタマイズするには、2 つのサンプルファイルを `$DSH_HOME/profiles/web/github-review/` にコピーし、設定を編集して、そのコピーの `cordis.yml` を `--patch` に指定する。`DSH_HOME` が未設定の場合は `~/.dsh` を使う。

リポジトリのサンプルは `packages/experimental/webhook-github/examples/github-review/` にある。CLI は webhook パッケージをインストールもせず、Official プラグインとしても一覧表示しない。パッケージのインストールとオーバーレイの指定は別の手順である。

## 専用エンドポイントを公開する

メインの Web UI と `/api` はポート 3080 のままである。オーバーレイは隔離されたレルムに 2 つ目の WebServer をマウントする。そこに登録されるのは `POST /github` のみであり、それ以外のパスはすべて `404` を返す。

Caddy 設定でそのリスナーのみを公開できる:

```caddyfile
hooks.example.com {
  route {
    @github path /github
    reverse_proxy @github 127.0.0.1:3081
    respond 404
  }
}
```

GitHub 側は次のように設定する:

```text
Payload URL:  https://hooks.example.com/github
Content type: application/json
Secret:       DSH_GITHUB_WEBHOOK_SECRET value
Events:       Pull requests
Active:       yes
```

## ルールの動作

ルールが受け付けるのは、ソース `primary-github`、リポジトリ `deepseek-ai/deepseek-harness`、イベント `pull_request`、アクション `ready_for_review` のみである。正確な head SHA と選択した PR フィールドをレビュープロンプトに渡し、その JSON を信頼できないメタデータとして表示し、ファイル・ブランチ・PR・GitHub の変更を禁じる。

セッション要求は `standard` エージェントプリセットと `read-only` 権限プリセットを選択する。`workspacePath` は `WorkspaceRegistry.create()` 経由で正規化されるため、最初の一致する配送で存在しない Web ワークスペースが作成され、以降の配送はそれを再利用する。

HTTP 応答は意図的にエージェントの結果より弱い。`202` は署名と JSON を受け付け、ルール呼び出しをメモリ内で予定したことを意味する。このルールが一致したことやセッションが作成されたことを意味しない。

## プログラムによる拡張

`run()` は通常の信頼された JavaScript である。デプロイはセッション要求を返す前に内部ポリシーサービスに問い合わせできる:

```js
const response = await fetch('https://policy.internal/pr-review', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ repository: payload.repository.full_name }),
  signal,
})
if (!response.ok || (await response.json()).automaticReview !== true) return null
```

リポジトリを異なるローカルパスに対応付けることもできる:

```js
const workspacePath = {
  'deepseek-ai/deepseek-harness': '/path/to/deepseek-harness',
  'deepseek-harness/dsh-sdk': '/path/to/dsh-sdk',
}[payload.repository.full_name]
if (workspacePath === undefined) return null
```

## 配送セマンティクス

webhook ランタイムは配送状態も実行状態も保存しない。配送が繰り返されるとルールが再実行され、別のセッションが作成される場合がある。クラッシュするとプロンプト承認前のルール呼び出しは失われる。プロンプト承認後は、通常のセッションログ・永続化・ワークスペース・エージェントライフサイクルが作業を引き継ぐ。

webhook シークレットは受信 GitHub データを認証するだけである。ルールコードにも作成されたエージェントにも送信側の GitHub アクセス権を与えない。ルールやエージェントがそれを必要とする場合は、その権限を別途設定する。
