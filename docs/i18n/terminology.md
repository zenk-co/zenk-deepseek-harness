# 用語集（terminology）

本表は、本リポジトリの中国語と英語の用語の統一訳を定める。

**一般ルール:**
- 「中文」列は中国語訳文の本文でデフォルトで使う語。同列が英語の場合は、中国語訳文の本文では英語のまま保持し、翻訳しない。
- 初出は「首次出现」列のとおりに書く（括弧注釈付き）。以降の出現では括弧より前の部分のみを書き（中国語の場合も英語の場合もある）、括弧内の注釈は書かない。
- 「不要译作」列は厳格に禁止される訳法。
- ある用語が別の用語の構成要素としてすでに括注されている場合（例: `agent loop（智能体循环）` には `agent` の括注がすでに含まれる）、その用語が後に単独で出現するときに再度括注する必要はない。

## 略語類（中英テキストのいずれでも略語を使用）

| English | 中文 | 首次出现 | 不要译作 | 备注 |
|---|---|---|---|---|
| ACP | ACP | ACP（Agent Client Protocol） | | |
| AI | AI | AI（人工智能） | | |
| API | API | | | |
| CI | CI | | | |
| CLI | CLI | CLI（命令行界面） | | |
| e2e | e2e | | | |
| HMR | HMR | HMR（热模块替换） | | |
| JSON Schema | JSON Schema | | | |
| JSONL | JSONL | | | |
| LLM | LLM | LLM（大语言模型） | | |
| MCP | MCP | | | |
| PR | PR | PR（Pull Request） | | |
| RAG | RAG | RAG（检索增强生成） | | |
| SDK | SDK | | | サポート対象の Python と TypeScript SDK が使う JSON-RPC クライアント／サーバープロトコルのみを指す；DeepSeek Harness プロジェクト自体は SDK ではない |
| SSE | SSE | SSE（Server-Sent Events） | | |

## 英語類（中英テキストのいずれでも英語を使用）

| English | 中文 | 首次出现 | 不要译作 | 备注 |
|---|---|---|---|---|
| agent | agent | agent（智能体） | | |
| Agent Note | Agent Note | | 智能体注记、智能体笔记 | リポジトリが定義するドキュメント種別。提案、実装済みの決定、却下された提案を対象とする；中国語対側の H1 は固定プレフィックス `# Agent Note: ` を保ち、タイトルに用語の括注を付けない |
| agent harness | agent harness | agent harness（智能体框架） | | agent の複合語（agent harness/workflow/loop/skill など）は全体を英語のまま保持する；agent がまだ括注されていない場合、初出は対応する複合語の行または agent の行に従って処理する |
| agent loop | agent loop | agent loop（智能体循环） | | |
| blob hash | blob hash | | | `git hash-object` の結果 |
| coding agent | coding agent | coding agent（编程智能体） | | agent の複合語。本文では英語のまま保持する |
| Cordis | Cordis | | | |
| dispose | dispose | dispose（资源释放） | | |
| doc-sync | doc-sync | doc-sync（文档同步门禁） | | |
| fiber | fiber | | | |
| fixture | fixture | fixture（测试前置数据） | | |
| fork | fork | | | |
| Function Calling | Function Calling | Function Calling（函数调用） | | |
| harness | harness | | | |
| harness engineering | harness engineering | | | |
| KV Cache | KV Cache | | | 固有の技術名称。大文字小文字と空白を保持する |
| lint | lint | | | |
| mock | mock | | | 英語のまま保持する；テストダブルを指す |
| loader | loader | | | |
| manifest | manifest | manifest（元数据清单） | | |
| monorepo | monorepo | | | |
| Round | Round | | 回合、目标回合、Ralph 回合 | 外層戦略が Round を使う場合、領域階層は Session > Round > Turn（轮次） > Step（步骤） である；Round は任意の外層戦略イテレーションであり、すべてのセッションターンに存在する汎用階層ではない。Goal Round と Ralph Round はどちらも英語のまま保持する。1 つの Round は 1 つのターンを担い、ステップはそのターンに属する；明示的なゼロステップのターンも元の意味のままである。 |
| schema | schema | | | |
| schema DSL | schema DSL | | | |
| seam | seam | | 接缝 | 置き換え可能な能力の全体であり、Service Definition / Service Provider / Consumer の 3 つの役割を含む；役割が独立に進化する必要があるときにのみパッケージを分割し、同一のパッケージが複数の役割を担ってもよい。`packages/shell` を範例とする；Service Definition は Cordis の `Service`（抽象クラスまたは具象 registry サービス）であり、TypeScript interface ではない。単一の役割、普通の境界、拡張点を seam と呼ぶことはできない。本リポジトリの本文では英語のまま保持する；`extension point` とは異なる概念である |
| Service Provider | Service Provider | | Service provider | ケイパビリティ seam の命名役割；単数は固定で Service Provider、複数は Service Providers と書く。サービス提供を広く指す provider には本項を適用しない |
| skill | skill | skill（技能） | | |
| slot | slot | | 坑位、孔位 | クライアントアーキテクチャにおける名前付きの登録可能位置。英語のまま保持する |
| spill | spill | | | ツール出力が上限を超えたときにディスクへ書き出す機構；複合語は `spill 文件`、`spill 路径` と書く |
| spawn | spawn | | | |
| steering | steering | steering（中途引导） | | |
| job id | job id | | 任务 id | 英語のまま保持する |
| subagent | subagent | | | ドキュメント本文では英語のまま保持する；中国語 UI では「子智能体」と訳し、「子代理」は使わない |
| transcript | transcript | transcript（文本记录） | | セッションがユーザーまたはエディターにレンダリングする完全なテキストを指し、イベントログとは区別される |
| Typert | Typert | | TypeRT、typeRT、Type RT | DeepSeek Harness の型グラフ、生成器、loader、ランタイム registry の製品上の綴り |
| waterfall | waterfall | waterfall（瀑布式事件） | | |
| wheel | wheel 包 | | | Python のパッケージング形式 |
| worktree | worktree | | | git の作業ツリー概念 |
| Zstandard | Zstandard | | | RFC 8878 の圧縮形式；`zstd` はコード値のままである。 |

## 二言語類（中英テキストがそれぞれ自言語を使用）

| English | 中文 | 首次出现 | 不要译作 | 备注 |
|---|---|---|---|---|
| adapter | 适配器 | | | |
| adapter contract | 适配器约定 | 适配器约定（adapter contract） | | |
| append-only | 仅追加 | | | |
| artifact | 产物 | | 制品 | |
| backend | 后端 | | | |
| binder | 绑定器 | | | 命名役割: 宣言済みインターフェースを呼び出し元の context またはライフサイクルにバインドする |
| config | 配置 | | | 命名役割: 解決済みの設定値、または境界が厳密な設定レコード |
| controller | 控制器 | | | 命名役割: 意図を受け取り、既存の領域状態または表示状態を 1 つ変更する |
| directory | 目录 | | | 命名役割: 発見または選択のためのエントリーとメタデータを公開する |
| engine | 引擎 | | | 命名役割: 領域アルゴリズムまたは状態を持つ実行モデルを実装する |
| gateway | 网关 | | | 命名役割: プロセス、ネットワーク、RPC、または API の境界を適合させる |
| handle | 句柄 | | | 命名役割: ライブリソースを参照し、制御または観測する |
| policy | 策略 | | | 命名役割: 何を許可し、選択し、制限し、または観測するかを決める |
| presenter | 展示转换器 | | | 命名役割: 領域値を純粋にレンダーインテントへ変換する |
| resolver | 解析器 | | | 命名役割: 入力に基づいて答えを計算または特定する |
| store | 存储 | | | 命名役割: データの集合を所有し、主にデータ操作を提供する |
| background job | 后台任务 | | | |
| block | 块 | | | |
| build target | 构建目标 | | | |
| cancel | 取消 | | | |
| canary test | canary 测试 | | 金丝雀测试 | 本リポジトリでは `canary` を保持する |
| capability | 能力 | | | `feature` → `功能` と区別しなければならない |
| capability seam | 能力 seam | | 功能 seam、能力接缝 | 本リポジトリでは、Service Definition、Service Provider、Consumer の 3 役割が完全で置き換え可能な能力を構成するという命名アーキテクチャ概念；普通の `seam` は引き続きその語条に従って処理する |
| feature | 功能 | | 能力 | SDK のプロダクトとエンジニアリングモデルにおける管理可能なプロダクト単位 |
| feature option | 功能选项 | | variant | 1 つの SDK 機能内の有限で選択可能な実装または設定 |
| checkpoint | 检查点 | | | |
| chunk | 分片 | | | |
| compaction | 压缩 | 压缩（compaction） | | |
| companion tool | 配套工具 | | | |
| composition bundle | 组合包 | | | アプリまたはプラグインのコンポジション文脈のみを拘束し、すべての `bundle` を拘束しない |
| Cordis plugin config | Cordis 插件配置 | | | Cordis プラグインが公開する `Config` オブジェクトまたは設定構造 |
| config key | 配置键 | | | Cordis プラグイン設定内の単一フィールド |
| consumer | 消费方 | | 消费者 | |
| content block | 内容块 | | | |
| Cookbook | 实操手册 | | | ドキュメントタイトル用語 |
| context | 上下文 | | | |
| counterpart | 对侧文件 | | 对应物、配对物 | バイリンガルペアの文脈；「もう一方の側」を広く指す場合は「另一侧」と書いてよい |
| configurable-provider directory | 可配置提供方目录 | | | llm seam において `registerConfigurableProviders()` が維持するディレクトリ；Service Catalog →「服务目录」の先例に従う |
| context compaction | 上下文压缩 | 上下文压缩（context compaction） | | |
| contract | 约定 | | | 例: `pairing contract` →`配对约定` |
| Cordis config entry | Cordis 配置项 | | | `cordis.yml` のプラグインリスト内の 1 項目を指す；プラグイン実装自体は「Cordis 插件」と書く |
| Cordis plugin | Cordis 插件 | | | Cordis がロードするプラグイン実装を指し、`cordis.yml` 内の 1 項目の設定は指さない |
| crash recovery | 崩溃恢复 | | | |
| deploy root | 部署根目录 | | | |
| dormant | 休眠 | | 睡眠、蛰伏 | 設定可能と宣言されているが現在ルートが登録されていない提供方を指す |
| durability | 持久性 | | | |
| feature requirement | 功能依赖 | | | 機能または機能オプションが `requires` を通じて宣言する関係 |
| event | 事件 | | | |
| event log | 事件日志 | | | |
| event stream | 事件流 | | | |
| event-sourced | 事件溯源 | | | DDD コミュニティで通行の訳法に従う |
| exchange | 交互段 | | 回合、交换 | Chat において、人による入力から始まるターンから、次のそのようなターンまでの連続するターン；用語集を参照 |
| Executive summary | 摘要 | | | ポストモーテムのタイトル用語 |
| executor | 执行器 | | | |
| expected output | 预期输出 | | 金标 | snapshot 比較の産物を指す；翻訳コーパスの人手校正サンプルはこれに含まれない |
| extension | 扩展 | | | |
| extension point | 扩展点 | | | `seam` との区別に注意 |
| fail-fast | 快速失败 | | | |
| fenced code block | 围栏代码块 | | | MDN の中国語訳に従う |
| fingerprint | 指纹 | | | 汎用のコンテンツフィンガープリント；バイリンガルペアリング機構は sidecar record でセクションごとに両側の hash を記録する |
| finish reason | 结束原因 | | | |
| fold | 折叠区 | | | 設定 UI の文脈: デフォルトで折りたたまれるフィールド区分（collapsed →「收起」）|
| foreground run | 前台运行 | | | |
| freshness | 新鲜度 | | | MDN の中国語訳に従う；本プロジェクトでは、訳文の原文に対する同期状態を指す |
| hook | 钩子 | | | |
| implementation | 实现 | | | |
| inference | 推理 | 推理（inference） | | `reasoning` と区別する必要がある場合は英語の括弧注釈を保持する |
| info string | 信息字符串 | | | CommonMark の中国語訳に従う；コードフェンス ``` に続く言語注記を指す |
| injection | 注入 | | | |
| integration | 集成 | | | |
| interface | 接口 | | | |
| language switcher | 语言切换行 | | | i18n ペアリング機構の用語: バイリンガルペアファイル先頭の相互リンク行 |
| merge | 合并 | | | |
| message | 消息 | | | |
| mod | 模组 | | | |
| model provider | 模型提供商 | | | モデルに API を提供するベンダーまたはゲートウェイを指す；モデル設定ページの文案、ユーザーガイド providers、`ui-settings-models` README では「提供商」を使う；llm seam の開発者ドキュメント（可配置提供方目录、dormant など）は「提供方」に従う |
| model selection | 模型选择 | | 模型目标 | エージェント向けのプロバイダー、モデル、および任意の推論強度の選択。 |
| module | 模块 | | | |
| non-escalation | 非升权 | | 非升级、不可升级 | セキュリティと権限の文脈にのみ使用し、主体が既存の認可を超える権限を取得してはならないことを指す；通常のアップグレードには本項を適用しない |
| npm dependency | NPM 依赖 | | | `package.json` 内のパッケージ関係；`dependencies`、`devDependencies` などのフィールドはそのまま保持する |
| opt-out ratio | opt-out 比例 | | 退出检查比例 | |
| orphan | 遗留 | | 孤儿、孤立 | 英語原文がすでに存在しない `.zh.md` を指す（例:「遗留译文」）；プロセスの文脈では OS の慣用に従い「孤儿进程」と訳す |
| orphan branch | 孤立分支 | | 孤儿分支 | git 公式の中国語訳に従う |
| package | 包 | | | npm パッケージ（`@deepseek-ai/dsh-*`）を指す；`package.json` などのコード識別子はそのまま保持する |
| pairing | 配对 | | | |
| parent-subset grants | 父级子集授权 | | 父集合授权 | 認可の範囲が親が保持する認可の部分集合に限られることを指す |
| peer dependency | 对等依赖 | 对等依赖（peer dependency） | | |
| permission | 权限 | | | |
| persistence | 持久化 | | | |
| pipeline | 流水线 | | | |
| plugin | 插件 | | | |
| postmortem | 事故复盘 | 事故复盘（postmortem） | 事后分析、事故记录 | 事故の記録と分析のドキュメント；ディレクトリまたはパス内の `postmortem` はコード形式のまま保持する |
| prompt | 提示词 | | | |
| provider | 提供方 | | | 広くプロバイダーを指す（検索、検査、settings ファイル、subagent など）；モデルベンダーまたはゲートウェイは model provider の行を参照 |
| provider-neutral | 提供方无关 | | 提供方中立 | |
| quality gate | 质量门禁 | | | |
| quiescence | 完全停稳 | | 静默、静止状态 | ライフサイクルの作業がすべて決着した後の状態を指す |
| reasoning | 推理 | 推理（reasoning） | | `inference` と区別する必要がある場合は英語の括弧注釈を保持する |
| reasoning_content | 思考内容 | | | |
| registry | 注册表 | | | |
| replay | 回放 | | | |
| resume | 恢复 | | | |
| runtime | 运行时 | | | |
| same-world subprocess | 与宿主共享文件系统和内核的子进程 | | 同世界子进程 | |
| sandbox | 沙箱 | | | |
| service | 服务 | | | |
| serving interface | 对外服务接口 | | | |
| session | 会话 | | | |
| session event | 会话事件 | | | |
| setup card | 设置卡片 | | | 初回実行時に行カードの代わりに直接展開される設定カード |
| sidecar file | 伴随文件 | | | ドキュメントと同じディレクトリにある通常の sidecar ファイルを指す |
| sidecar record | 伴随记录 | | 旁挂记录 | ドキュメントと同じディレクトリにある sidecar レコードファイルを指す |
| smoke test | 冒烟测试 | | | |
| snapshot | 快照 | | | |
| source of truth | 真源 | | 事实来源、唯一来源 | |
| spine | 主干 | | | |
| stale | 陈旧 | | 过期 | `fresh`（`新鲜`）と対になる；ゲート出力では英語の `stale` を保持し翻訳しない；`expired` のみ `过期` と訳す |
| step | 步骤 | | | |
| stream | 流 | | | |
| structural signature | 结构签名 | | | i18n ペアリング機構の用語: ゲートが両側のファイルを比較するときに抽出する順序付き構造シーケンス（見出し階層、コードブロック、リストなど） |
| Summary | 概述 | | | ポストモーテムのタイトル用語 |
| system prompt | 系统提示词 | | | |
| taxonomy | 分类体系 | | | |
| token usage | token 用量 | | | |
| tool | 工具 | | | |
| tool call | 工具调用 | | | |
| tool result | 工具结果 | | | |
| tool schema | 工具 schema | | | |
| toolkit | 工具包 | | | |
| turn | 轮次 | | | |
| VFS | VFS | 虚拟文件系统（VFS） | | |
| typecheck | 类型检查 | | | |
| vocabulary | 词汇 | | | |
| wire format | 协议格式 | 协议格式（wire format） | | |
| workflow | 工作流 | | | |
| wrapper | 包装层 | | | ソフトウェア層または SDK のラッパー層 |
| wrapper script | 包装脚本 | | | 実行可能スクリプトのラッパー層 |
