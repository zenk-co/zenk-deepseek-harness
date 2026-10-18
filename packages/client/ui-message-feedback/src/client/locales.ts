/** `feedback` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'action.like': '好的回答',
  'action.likeActive': '取消标记',
  'action.dislike': '有问题的回答',
  'action.dislikeActive': '取消标记',
  'dialog.title': '提交反馈',
  'dialog.categories': '反馈分类',
  'dialog.detail': '反馈详情',
  'dialog.hint': '填写详情以帮助我们改进体验，提交内容会包括当前对话的日志',
  'category.task-result': '任务结果',
  'category.instruction-following': '指令理解与遵循',
  'category.product-interaction': '产品功能与交互',
  'category.service-stability': '稳定性和速度',
  'category.resource-cost': '资源使用与费用',
  'category.security-privacy-permission': '安全隐私与权限',
  'category.other': '其他',
  'toast.recorded': '感谢你的反馈',
  'error.conflict': '这条反馈已在别处改动，已显示最新状态',
  'error.load': '反馈状态加载失败',
  'error.generic': '反馈保存失败',
  'error.noteTooLarge': '描述太长，请缩短后再提交',
} satisfies Record<string, string>

/** The feedback namespace key union. */
export type MessageFeedbackKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The feedback surface's copy: the message controls, the dialog, and the acknowledgement. */
    feedback: MessageFeedbackKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'action.like': 'Good response',
  'action.likeActive': 'Remove rating',
  'action.dislike': 'Bad response',
  'action.dislikeActive': 'Remove rating',
  'dialog.title': 'Submit feedback',
  'dialog.categories': 'Feedback category',
  'dialog.detail': 'Feedback details',
  'dialog.hint': 'Add details to help us improve. Your submission will include the current conversation log.',
  'category.task-result': 'Task result',
  'category.instruction-following': 'Instruction understanding and following',
  'category.product-interaction': 'Product features and interaction',
  'category.service-stability': 'Stability and speed',
  'category.resource-cost': 'Resource usage and cost',
  'category.security-privacy-permission': 'Security, privacy, and permissions',
  'category.other': 'Other',
  'toast.recorded': 'Thanks for your feedback',
  'error.conflict': 'This feedback changed elsewhere; the latest state is shown',
  'error.load': 'Could not load feedback',
  'error.generic': 'Could not save feedback',
  'error.noteTooLarge': 'The description is too long; shorten it and submit again',
} satisfies Record<MessageFeedbackKey, string>

/** Japanese dictionary, checked complete against the zh key set. */
export const ja = {
  'action.like': '良い回答',
  'action.likeActive': '評価を取り消す',
  'action.dislike': '問題のある回答',
  'action.dislikeActive': '評価を取り消す',
  'dialog.title': 'フィードバックを送信',
  'dialog.categories': 'フィードバックのカテゴリ',
  'dialog.detail': 'フィードバックの詳細',
  'dialog.hint': '体験改善のため詳細をご記入ください。送信内容には現在の会話ログが含まれます',
  'category.task-result': 'タスクの結果',
  'category.instruction-following': '指示の理解と遵守',
  'category.product-interaction': '製品機能と操作性',
  'category.service-stability': '安定性と速度',
  'category.resource-cost': 'リソース使用量と料金',
  'category.security-privacy-permission': 'セキュリティ・プライバシー・権限',
  'category.other': 'その他',
  'toast.recorded': 'フィードバックありがとうございます',
  'error.conflict': 'このフィードバックは他の場所で変更されたため、最新の状態を表示しています',
  'error.load': 'フィードバックの状態を読み込めませんでした',
  'error.generic': 'フィードバックを保存できませんでした',
  'error.noteTooLarge': '説明が長すぎます。短くしてから再送信してください',
} satisfies Record<MessageFeedbackKey, string>
