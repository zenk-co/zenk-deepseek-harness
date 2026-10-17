/** Locale bundles for the agent-preset hero chip, header label, and management section. */

import { guideEn, guideJa, guideZh, type PresetGuideKey } from './guide-locales.ts'

/** Locale keys these surfaces render. */
export type AgentPresetSettingsKey =
  | PresetGuideKey
  | 'builtInGroup'
  | 'customGroup'
  | 'seatHint'
  | 'headerHint'
  | 'nav'
  | 'sectionIntro'
  | 'setDefault'
  | 'view'
  | 'presetStandardName'
  | 'presetStandardDescription'
  | 'presetPtcName'
  | 'presetPtcDescription'
  | 'presetMinimalName'
  | 'presetMinimalDescription'
  | 'presetCordisName'
  | 'presetCordisDescription'
  | 'inUse'
  | 'noDescription'
  | 'brokenBadge'
  | 'switchRefused'
  | 'standardUnavailable'
  | 'close'
  | 'creatorDraft'
  | 'createPlugin'
  | 'createPluginDescription'
  | 'createPluginChecking'
  | 'createPluginUnavailable'
  | 'createPluginMissing'

/** English copy. */
export const en: Record<AgentPresetSettingsKey, string> = {
  ...guideEn,
  builtInGroup: 'Built-in', customGroup: 'Custom',
  sectionIntro: 'Choose the agent’s tools and how it works. Use Standard mode for everyday tasks, or Creator mode to add capabilities to DSH.',

  seatHint: 'Choose the agent preset for your new task',
  headerHint: 'The agent preset chosen when this task started',
  nav: 'Agent presets',

  setDefault: 'Set as new task default',
  view: 'View configuration',

  presetStandardName: 'Standard mode',
  presetStandardDescription:
    'Work with code, files, and information. Suitable for most tasks, with search, editing, terminal commands, and other tools available as needed.',
  presetPtcName: 'PTC mode',
  presetPtcDescription:
    'Includes all Standard mode capabilities. Better suited to tasks that call tools in batches and then filter, organize, deduplicate, count, or summarize the results.',
  presetMinimalName: 'Minimal mode',
  presetMinimalDescription:
    'The agent uses a terminal and image reading, with context compaction. Useful for testing and comparing its basic performance.',
  presetCordisName: 'Creator mode',
  presetCordisDescription:
    'Customize DSH through conversation. Let the agent write plugins that add features or UI, or combine tools and prompts to create your own mode.',

  inUse: 'New task default',

  noDescription: 'No description.',
  brokenBadge: 'Failed to load',

  switchRefused: 'Could not switch to {name}: {reason}',
  standardUnavailable: 'Standard mode is unavailable. Restore it or choose another available mode.',

  close: 'Close',

  creatorDraft: 'Let the agent help me create a preset',
  createPlugin: 'Let the agent create a plugin',
  createPluginDescription: 'Enter Creator mode and make your own DSH plugin',
  createPluginChecking: 'Checking whether Creator mode is available',
  createPluginUnavailable: 'Temporarily unavailable. Reopen this menu to retry',
  createPluginMissing: 'Creator mode is not included in this configuration',

}

/** Simplified Chinese copy. */
export const zh: Record<AgentPresetSettingsKey, string> = {
  ...guideZh,
  builtInGroup: '内置', customGroup: '自定义',
  sectionIntro: '选择 Agent 的工具和工作方式。日常任务用「标准模式」，扩展 DSH 的能力用「创造模式」。',

  seatHint: '选择新任务使用的 Agent 预设',
  headerHint: '本任务的 Agent 预设，在任务开始时确定',
  nav: 'Agent 预设',

  setDefault: '设为新任务默认',
  view: '查看配置',

  presetStandardName: '标准模式',
  presetStandardDescription: '处理代码、文件和资料，适合大多数任务。Agent 会按需使用检索、编辑和终端等工具。',
  presetPtcName: 'PTC 模式',
  presetPtcDescription: '包含标准模式的所有能力，更适合批量调用工具，并对结果进行筛选、整理、去重、统计或汇总的任务。',
  presetMinimalName: '极简模式',
  presetMinimalDescription: 'Agent 使用终端和图片读取工具，并支持上下文压缩，适合测试和对比其基础表现。',
  presetCordisName: '创造模式',
  presetCordisDescription: '用对话定制 DSH：让 Agent 编写插件，添加新功能或界面；也能组合工具和提示词，创建自己的模式。',

  inUse: '新任务默认',

  noDescription: '暂无描述。',
  brokenBadge: '加载失败',

  switchRefused: '无法切换到「{name}」：{reason}',
  standardUnavailable: '标准模式不可用，请恢复该模式或选择其他可用模式。',

  close: '关闭',

  creatorDraft: '让 Agent 帮我创建预设模式',
  createPlugin: '让 Agent 创建插件',
  createPluginDescription: '进入创造模式，制作属于你的 DSH 插件',
  createPluginChecking: '正在确认创造模式是否可用',
  createPluginUnavailable: '暂时不可用，请重新打开菜单重试',
  createPluginMissing: '当前配置未提供创造模式',

}

/** Japanese copy. */
export const ja: Record<AgentPresetSettingsKey, string> = {
  ...guideJa,
  builtInGroup: '組み込み', customGroup: 'カスタム',
  sectionIntro: 'Agent のツールと動作方式を選択します。日常タスクには「標準モード」、DSH の機能拡張には「クリエイターモード」を利用してください。',

  seatHint: '新しいタスクで使用する Agent プリセットを選択',
  headerHint: 'このタスクの Agent プリセット（タスク開始時に確定）',
  nav: 'Agent プリセット',

  setDefault: '新しいタスクの既定に設定',
  view: '設定を表示',

  presetStandardName: '標準モード',
  presetStandardDescription: 'コード、ファイル、情報を扱い、多くのタスクに適しています。必要に応じて検索、編集、ターミナルなどのツールを使用します。',
  presetPtcName: 'PTC モード',
  presetPtcDescription: '標準モードのすべての機能を含み、ツールを一括呼び出しして結果を選別・整理・重複除去・集計・要約するタスクにより適しています。',
  presetMinimalName: 'ミニマルモード',
  presetMinimalDescription: 'Agent はターミナルと画像読み取りを使用し、コンテキスト圧縮に対応します。基本性能の検証や比較に有用です。',
  presetCordisName: 'クリエイターモード',
  presetCordisDescription: '対話で DSH をカスタマイズします。機能や UI を追加するプラグインの作成、ツールとプロンプトを組み合わせた独自モードの作成を Agent に依頼できます。',

  inUse: '新しいタスクの既定',

  noDescription: '説明がありません。',
  brokenBadge: '読み込みに失敗しました',

  switchRefused: '「{name}」に切り替えられませんでした：{reason}',
  standardUnavailable: '標準モードは利用できません。復元するか、他の利用可能なモードを選択してください。',

  close: '閉じる',

  creatorDraft: 'Agent にプリセット作成を手伝ってもらう',
  createPlugin: 'Agent にプラグインを作成させる',
  createPluginDescription: 'クリエイターモードに入り、自分専用の DSH プラグインを作成',
  createPluginChecking: 'クリエイターモードが利用可能か確認中',
  createPluginUnavailable: '一時的に利用できません。メニューを開き直して再試行してください',
  createPluginMissing: '現在の設定ではクリエイターモードは提供されていません',

}

// The resolution itself is the shared fold in `dsh-agent-preset-registry/display`,
// re-exported here so every surface in this plugin reads one path; the
// Settings plugin list inlines the same fold over this plugin's dictionaries.
export { isBuiltInPreset, presetDisplayText } from '@deepseek-ai/dsh-agent-preset-registry/display'
export type { PresetDisplaySource, PresetDisplayText } from '@deepseek-ai/dsh-agent-preset-registry/display'
