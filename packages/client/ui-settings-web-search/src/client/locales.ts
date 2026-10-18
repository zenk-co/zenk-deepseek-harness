/** Locale bundles for the web-search provider's settings page. */

import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'

/** Locale keys the page renders. */
export type WebSearchSettingsLocaleKey =
  | 'title' | 'description'
  | 'apiKey' | 'apiKeyHint' | 'apiKeySet' | 'apiKeyUnset'
  | 'baseUrl' | 'baseUrlHint' | 'maxUses' | 'maxUsesHint'
  | 'overridden' | 'reset' | 'readOnly' | 'unavailable'
  | 'save' | 'saving' | 'saveFailed' | 'invalidNumber'

/** English copy. */
export const en: Record<WebSearchSettingsLocaleKey, string> = {
  title: 'Web search',
  description: 'Set up the DeepSeek search provider.',
  apiKey: 'API key',
  apiKeyHint: 'Stored outside the settings file. Leave blank to keep the current key.',
  apiKeySet: 'A key is configured.',
  apiKeyUnset: 'No key is configured; only conversations using a DeepSeek Account model can search, through the default endpoint.',
  baseUrl: 'Endpoint',
  baseUrlHint: 'Leave blank to use the provider default.',
  maxUses: 'Max searches per request',
  maxUsesHint: 'How many times one request may search before it must answer.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  invalidNumber: 'Enter a number, or leave blank to use the default.',
}

/** Simplified Chinese copy. */
export const zh: Record<WebSearchSettingsLocaleKey, string> = {
  title: '网页搜索',
  description: '设置 DeepSeek 的搜索提供方。',
  apiKey: 'API Key',
  apiKeyHint: '不写入设置文件。留空表示保持当前密钥。',
  apiKeySet: '已配置密钥。',
  apiKeyUnset: '未配置密钥；仅使用 DeepSeek 账号模型的对话可以通过默认接口地址搜索。',
  baseUrl: '接口地址',
  baseUrlHint: '留空则使用提供方默认地址。',
  maxUses: '单次请求最多搜索次数',
  maxUsesHint: '一次请求在必须作答前最多可以搜索多少次。',
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载，暂时无法配置。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  invalidNumber: '请填数字；留空表示使用默认值。',
}

/** Japanese copy. */
export const ja: Record<WebSearchSettingsLocaleKey, string> = {
  title: 'Web 検索',
  description: 'DeepSeek 検索プロバイダーを設定します。',
  apiKey: 'API キー',
  apiKeyHint: '設定ファイル外に保存されます。現在のキーを保持する場合は空白のままにしてください。',
  apiKeySet: 'キーが設定されています。',
  apiKeyUnset: 'キーが未設定です。DeepSeek アカウントのモデルを使用する会話のみ、既定エンドポイント経由で検索できます。',
  baseUrl: 'エンドポイント',
  baseUrlHint: 'プロバイダーの既定値を使う場合は空白のままにしてください。',
  maxUses: 'リクエストごとの最大検索回数',
  maxUsesHint: '1回のリクエストが回答前に検索できる回数。',
  overridden: '上書き済み',
  reset: '既定値に戻す',
  readOnly: 'このデプロイの設定は読み取り専用です。',
  unavailable: 'このプラグインは読み込まれていないため、現在設定できません。',
  save: '保存',
  saving: '保存中…',
  saveFailed: 'このデプロイではこれらの値を受け付けませんでした。修正用に残してあります。',
  invalidNumber: '数値を入力するか、既定値を使う場合は空白のままにしてください。',
}

/**
 * The form frame's copy, read from this page's dictionary.
 * @param t - the page's locale reader.
 * @returns the labels the shared settings form renders.
 */
export function formLabels(t: (key: WebSearchSettingsLocaleKey) => string): SettingsFormLabels {
  return { unavailable: t('unavailable'), readOnly: t('readOnly'), saveFailed: t('saveFailed'), save: t('save'), saving: t('saving') }
}
