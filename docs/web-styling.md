# Web UI スタイルリファレンス

日本語 | [English](web-styling.en.md) | [中文](web-styling.zh.md)

このリファレンスはブラウザークライアントパッケージのスタイル所有権とコンポーネント規則を定義する。現行トークン値は [`packages/client/ui-theme/src/styles/`](../packages/client/ui-theme/src/styles/) にあり、この文書はそのソース生成目録を重複しない。

## 所有権

[`ui-theme`](../packages/client/ui-theme/README.md) は `--dsw-*` 静的 scale・意味別名・書体・ motion・グラデーション・影・スクロールバー様式・明暗設定を所有する。[`ui-layout`](../packages/client/ui-layout/README.md) は解決済みテーマ snapshot を文書に適用する。機能パッケージは意味別名を消費し、別の全体テーマを定義しない。

全体様式表は `ui-theme/src/styles/` に属する。コンポーネント様式はコンポーネントのそばに CSS Modules として置く。コンポーネントはその値がそのコンポーネントの配置や表示契約の一部である場合にローカルカスタム特性を定義できる。共有色・書体・ elevation・motion はテーマパッケージに属する。

<a id="component-rules"></a>
## コンポーネント規則

- 制御を再装飾する前に再利用する。[ui-primitives コンポーネントカタログ](../packages/client/ui-primitives/README.md#component-catalog)は機能パッケージを横断する唯一の経路であり、意図的な外観差は第 2 複製ではなくそこの prop に属する（[リファレンス](../packages/client/ui-primitives/README.md)）。
- CSS Modules と `clsx` を使う。コンポーネントライブラリや Tailwind を追加しない。
- 機能コンポーネントでは `--dsw-alias-*` 意味トークンを使う。静的 palette 値を複写したりリテラル色を書いたりしない。
- 機能コンポーネント CSS にテーマ選択子を置かない。明暗上書きはテーマ所有者に属する。
- フォントサイズと行高を対にし、既存役割が一致する場合はテーマ書体変数を使う。
- そのコンポーネント契約が列保持を要求する場合、ソース文・端末出力・差分行を折り返さない。部品固有スクロールバー選択子ではなく共有スクロールバー様式を使う。
- 表示は CSS に置く。インライン React 様式はコンポーネントローカルのカスタム特性値を渡せるが、テーマ分岐を符号化してはならない。
- 遷移やホバー専用制御を追加する場合、キーボードフォーカス可視性と reduced-motion 動作を保持する。
- 角丸は対応エンジン上で ui-theme の `corner-shape.css` から全体 superellipse 平滑化を継承する。完全な丸 `border-radius`（`50%`、`100%`、pill 半径）ごとに `corner-shape: round` を対にし、円とカプセルが円弧を保つようにする。ui-theme 角形状仕様がその対付けを強制する。
- 隆起面（メニュー、popover、モーダル、パネル、浮動ボタン、コンポーザー）は `border: 0` を設定し、`box-shadow: var(--dsw-elevation-panel)`、`var(--dsw-elevation-prominent)`、またはコンポーザーの `var(--dsw-elevation-soft)`（低い alpha で大きな blur）を取る。0.5px hairline 罫は最初の影層であり、`--dsw-elevation-stroke-color` は面や状態ごとに再束縛または抑制する。`--dsw-alias-border-*` 境界と lv/elevation 影を対にしない。ui-theme elevation 仕様がその対付けを拒否する。状態色境界（warn パネル）は実境界のままである。
- 既存と新規の dropdown・context・submenu・選択メニューは `Menu` を使うか独自内容を `MenuSurface` で包む。素材はテーマ所有の `--dsw-menu-surface-fill` と `--dsw-menu-backdrop-filter` であり、機能と平台 CSS はどちらも上書きしてはならない。ui-theme メニュー仕様は包まないメニュー/listbox 描画器、素材上書き、トークン再定義を拒否する。schedule 所有の `TaskMenu` と `ClockPicker` は明示例外として既存容器と素材を保持する（[所有者](../packages/client/ui-schedule/README.md)）。
- 設定や確認ダイアログを含むモーダル backdrop は blur なしの半透明暗 mask を保持する。テーマは `--dsw-mask-blur` を `none` に設定する。Desktop 所有モーダルオーバーレイも親ページを filter しないままにする。
- メニュー背景 filtering は分離層に置き、入れ子メニューと固定オーバーレイが配置と backdrop を保持できるようにする。macOS では `MenuSurface` が各メニュー範囲内でのみページ内容背後に不透明 backing を加え、Chromium がネイティブ vibrancy 上の内容を blur できるようにする。CSS アンカーは配置と寸法に従い、unmount は backing を除去する。この backing のないオーバーレイは `--dsw-specific-menu` を使い、そのテーマ所有 macOS fill は 94% 不透明であり、下の文の透けを防ぐ。その fill を使う他の隆起面は固定オーバーレイを含む場合に自らの分離背景上で同一 filter と対にする。
- 中立 `--dsw-alias-border-*` トークンを使う平坦境界と区切りは `0.5px` で描く。ボタン、入力、カード、行区切り、充填箱として描かれる区切り（メニュー区切り、会話ヘッダー seam、markdown `hr`、垂直 rail）は hairline 太さを共有し、Chromium は 1 機器 pixel として描く。破線 affordance と状態色境界は 1px を保ち、spinner 環 track は仕様の明示 allowlist を通じて幅を保つ。ui-theme elevation 仕様は幅広の中立実線境界を拒否する。
- クリック可能成果物リンク（markdown アンカー、散文ファイル言及、Web ソースと fetch リンク、生成ファイル chip、ワークフローメンバー link）は `--dsw-alias-link` で `font-weight: 500` の色付けとし、静止時は下線なし、ホバー/フォーカス時は 3px offset の点線下線とする。Compact Thinking Markdown は tertiary 文色と静止時点線下線を保つ（[compact 表示](../packages/client/ui-primitives/README.md#rendering-agent-output)）。文先頭アンカーは ui-primitives `LinkIconMedium` 分類グリフを `currentColor` 乗りで先導し、著名外部ホストでは globe の代わりにその site 独自印とする。ワークフローメンバー link と画像専用アンカーはグリフを持たず、ツール行ファイル link は灰色点線 affordance を保つ。

<a id="corner-radii-and-settings-cards"></a>
## 角半径と設定カード

[DSH 統一角半径標準](ui-radius.md)は半径 scale、コンポーネント寸法対応、円とカプセル例外、入れ子ホバー形状、設定カード fill と罫を定義する。

## 系の変更

共有トークンの追加や変更は所有 `ui-theme` 表で行い、機能パッケージからその意味別名を消費する。公開スタイル契約が変わる場合は所有パッケージリファレンスを更新する。視覚動作は[検査ポリシー](testing.md)に従い、[アーカイブ済みスタイル系エージェントノート](../.agents/notes/archived/process/2026-07-19-web-styling-system.md)は枠組み根拠を記録する。
