# 5. 設定

日本語 | [English](05-config.en.md) | [中文](05-config.zh.md)

各 `cordis.yml` エントリーは `config` ブロックを運ぶことができ、プラグインは `apply` 実行前にそれを検証するスキーマを宣言する。不正な設定は正確なエラーでロードに失敗する。プラグインが半構成で開始することは決してない。

## 設定可能なプラグイン

`tmp/cordis-tutorial` に `config-demo.ts` を作成する。

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export const name = 'config-demo'

export interface Config {
  greeting: string
  targets: string[]
}

export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  targets: Schema.array(String).default(['world']),
})

export function apply(ctx: Context, config: Config) {
  for (const target of config.targets) {
    console.log(`${config.greeting}, ${target}!`)
  }
}
```

エクスポートされた `Config` は TypeScript インターフェースであり同時に同名のランタイムスキーマである。コンシューマーは型を得て、Cordis は検証器を得る。このリポジトリはスキーマに [Schemastery](https://github.com/shigma/schemastery) を使う。Cordis 自体は任意の [Standard Schema](https://standardschema.dev/) 検証器を受け付けるため、`Config` としてエクスポートされたプレーンオブジェクトは動作しない。

それを設定する。

```yaml
- name: './config-demo.ts'
  config:
    targets: ['alpha', 'beta']
```

実行する。

```
Hello, alpha!
Hello, beta!
```

`greeting` は省略されたため、スキーマ既定値がそれを補った。`apply` は常に完全で検証済みの設定を受け取る。

## 大きく失敗する

次に不正なものを供給する。

```yaml
- name: './config-demo.ts'
  config:
    targets: 'not-an-array'
```

```
ValidationError: invalid config:
  - $.targets expected array but got not-an-array (at targets)
```

プラグインのファイバーは FAILED になり、このチュートリアルのランチャーはエラーを表示した後に状態 1 で終了する。プラグインは、利用できないリソースやプロバイダーを指名するスキーマ上有効な設定も、その参照を解決できるようになり次第拒否すべきである。

<a id="volatile-fields"></a>
## Volatile フィールド

各操作中にプラグインが読むフィールドには `.volatile()` を使う。そのフィールドの変更はプラグインを再マウントせずに安定参照を更新する。それを `.get()` で読む。

```ts
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import Schema from '@deepseek-ai/schemastery'

export const Config = Schema.object({
  greeting: Schema.string().default('Hello').volatile(),
})

export function apply(ctx: Context, config: ReturnType<typeof Config>) {
  ctx.on('loader/volatile-update', () => {
    console.log(config.greeting.get())
  })
}
```

直接の `Config(raw)` 呼び出しも参照を返す。既定値のない任意フィールドも参照を持つ。`.get()` は不在の場合に `undefined` を返す。参照を保持するか、1 つの操作のためにその値を捕捉する。`await` をまたぐ場合も含む。その値を後の操作のために保持しない。オブジェクトと配列値は切り離され再帰的に凍結されたプレーンデータのスナップショットである。関数、クラスインスタンス、循環は拒否される。

ローダーはスキーマ宣言された volatile フィールドを無視して生設定を比較する。volatile のみの変更はプラグインの `internal/config` フックを通じてパースされ検証される。すべての通常実効値がなお一致する場合、ローダーは新しい値を実行中の参照にコミットし、変更パスをキーの配列として伴うインスタンス単位の `loader/volatile-update` を 1 つ発行し、対象プラグインの `internal/update` を迂回する。等しい値は通知しない。不正な候補はログに記録され、次の有効化まで実行中の参照を変更しないままにする。変更された通常実効値（変更された式結果を含む）と同時の通常フィールド変更は既存の更新フローを保持し、古い参照を変更せず通知もしない。Group/Include は依然として子更新を配送する。直接の `fiber.update()`、コード置換、依存置換はライフサイクルを保持する。`noSave` は依然として直接更新の永続化を制御する。通知はリソース再設定の待機なしに通常の `emit` を使う。

volatile フィールドは固定オブジェクトパスで宣言するか、オブジェクトまたは配列全体を volatile として印付ける。配列、辞書、union または intersect 分岐、lazy スキーマ、transform、別の volatile 値の内部の独立参照は拒否される。設定ファイルは通常値を格納する。`simplify()` は参照をアンラップする。直列化スキーマはスキーマ駆動フォームのためにフィールド型、既定値、役割、volatile 印を保持する。既存の設定コンシューマーは引き続き独自の設定インターフェースを使う。

## 計算設定値

このリポジトリで使うローダーは、読み込み時に計算しなければならない設定値のための `!!js` タグを支える。

```yaml
- name: './config-demo.ts'
  config:
    greeting: !!js process.env.DEMO_GREETING ?? 'Hello'
```

`!!js` は `config` の内部とエントリーの `disabled` フィールドでのみ動作する。`disabled: !!js ...` はすべてのマウント決定時にローダーコンテキストに対して評価される（このリポジトリの拡張）。そのため行はプラットフォームや環境で自身を門前払いできる。その他のメタデータ（`name`、`id`、`inject` など）は静的なまま残り、式は通常の真値データである。[ローダー設定](../cordis-primer.md#loader-configuration)参照。

次へ: [構成と HMR](06-composition-and-hmr.md) — `cordis.yml` をアプリケーションとして扱う。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
