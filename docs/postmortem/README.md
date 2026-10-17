# ポストモーテム

日本語 | [English](README.en.md) | [中文](README.zh.md)

インシデントの記録: バグが本来到達すべきでない場所に到達した (実在のユーザー、マージ済み PR、リリース) 場合の書き起こしであり、興味深い点は一行の修正そのものではなく、*なぜプロセスがそれを通してしまったのか* である。

ポストモーテムは [Agent Note](../../.agents/notes/README.md) (意図的な設計判断と棄却した代替案を記録するか、将来の作業を提案するもの) ではない。失敗の後ろ向きの記録である: 何が壊れたか、その仕組み、なぜすべての安全網が見逃したか、そして同じ種類のバグが次回は大きな音を立てて失敗するよう追加した具体的なガードレール。

バグが **subtle** (仕組みが自明でなく、注意深いエンジニアでも苦労して再導出することになる)、**systemic** (逃げた理由が単発の typo ではなくテスト/ツール/規約の隙間にある)、かつ **costly to rediscover** (実際にデバッグ時間を費やし、再び費やすことになる) 場合に書く。ポストモーテムが動機付けたガードレール (テスト、AGENTS.md のルール、ADR) へリンクする。

すべてのポストモーテムは **Executive summary** で始める: 詳細な Summary / Timeline / Root cause / Guardrails セクションの前に、多忙な読者が 30 秒で吸収できる短い段落 — 何が壊れたか、平易な言葉での根本原因、なぜ逃げたか、耐久性のある教訓 — を置く。

| # | タイトル |
|---|---|
| [0001](0001-acp-default-export-drops-inject.md) | ACP サーバーが接続時にクラッシュ: `export default` がプラグインの `inject` を落とした |
| [0002](0002-js-expression-disabled-filesystem-tools.md) | ファイルシステムのスナップショットツールがリテラルの `!!js` オブジェクトにより恒久的に無効化された |
| [0003](0003-web-agent-gui-feedback-loop.md) | Web エージェントがセッションをホストする GUI ではなく置換サーバーを検証した |
| [0004](0004-landlock-partial-notice-misclassified-child-failures.md) | Landlock 部分適用通知が子プロセスの失敗を誤分類した |
