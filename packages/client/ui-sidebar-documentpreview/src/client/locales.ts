/**
 * `sidebarDocumentPreview` namespace dictionaries.
 *
 * The failure lines are the point of this file: a preview that cannot show a
 * page has to say which of several different things went wrong, and each one
 * suggests a different next step for the reader.
 */

/** Simplified Chinese dictionary and key-set source of truth. */
export const zh = {
  loading: '文档渲染中...',
  loadMore: '加载更多',
  changed: '文件已更新，当前显示为旧内容',
  reloadNow: '重新载入',
  reload: '重新读取文件',
  autoRefresh: '自动刷新',
  'autoRefresh.enable': '开启自动刷新',
  'autoRefresh.disable': '关闭自动刷新',
  'wrap.enable': '自动换行',
  'wrap.disable': '取消换行',
  'wrap.aria': '自动换行',
  openWith: '打开方式',
  'viewer.text': '纯文本',
  resourceUnavailable: '文件资源服务不可用',
  rendererUnavailable: '预览器 {name} 不可用',
  unsupportedFile: '该格式文件暂时无法预览',
  'error.notFound': '文件不存在，可能已被移动或删除',
  'error.tooLarge': '单页内容超过 {limit} 上限，无法读取',
  'error.notText': '该格式文件暂时无法预览',
  'error.notRegularFile': '该路径不是普通文件，没有可显示的内容',
  'error.unavailable': '读取失败：{message}',
  retry: '重试',
} satisfies Record<string, string>

/** Text-preview dictionary key union. */
export type SidebarDocumentPreviewKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en = {
  loading: 'Rendering document...',
  loadMore: 'Load more',
  changed: 'The file has changed, showing the previous content.',
  reloadNow: 'Reload',
  reload: 'Read the file again',
  autoRefresh: 'Auto refresh',
  'autoRefresh.enable': 'Enable auto refresh',
  'autoRefresh.disable': 'Disable auto refresh',
  'wrap.enable': 'Turn on line wrap',
  'wrap.disable': 'Turn off line wrap',
  'wrap.aria': 'Line wrap',
  openWith: 'Open with',
  'viewer.text': 'Plain text',
  resourceUnavailable: 'The file resource service is unavailable.',
  rendererUnavailable: 'The {name} preview is unavailable.',
  unsupportedFile: 'Preview is not available for this file type yet.',
  'error.notFound': 'File not found. It may have been moved or deleted.',
  'error.tooLarge': 'This page exceeds the {limit} limit and cannot be read.',
  'error.notText': 'Preview is not available for this file type yet.',
  'error.notRegularFile': 'Not a regular file, nothing to display.',
  'error.unavailable': 'Read failed: {message}',
  retry: 'Retry',
} satisfies Record<SidebarDocumentPreviewKey, string>

/** Japanese dictionary, checked against the Chinese key set. */
export const ja = {
  loading: 'ドキュメントを描画しています...',
  loadMore: 'さらに読み込む',
  changed: 'ファイルが更新されました。古い内容を表示しています',
  reloadNow: '再読み込み',
  reload: 'ファイルを再読み込み',
  autoRefresh: '自動更新',
  'autoRefresh.enable': '自動更新をオンにする',
  'autoRefresh.disable': '自動更新をオフにする',
  'wrap.enable': '自動折り返しをオンにする',
  'wrap.disable': '折り返しをオフにする',
  'wrap.aria': '自動折り返し',
  openWith: '別の表示方法',
  'viewer.text': 'プレーンテキスト',
  resourceUnavailable: 'ファイルリソースサービスは利用できません',
  rendererUnavailable: '{name} プレビューは利用できません',
  unsupportedFile: 'この形式のファイルはまだプレビューできません',
  'error.notFound': 'ファイルが見つかりません。移動または削除された可能性があります',
  'error.tooLarge': '1ページの内容が {limit} の上限を超えているため、読み込めません',
  'error.notText': 'この形式のファイルはまだプレビューできません',
  'error.notRegularFile': '通常のファイルではないため、表示できる内容がありません',
  'error.unavailable': '読み込みに失敗しました：{message}',
  retry: '再試行',
} satisfies Record<SidebarDocumentPreviewKey, string>
