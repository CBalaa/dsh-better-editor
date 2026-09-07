/**
 * Minimal zh/en/ja copy for the editor plugin. The viewer follows the DSH
 * locale: a simple browser-language check suffices (zh → zh, else en); the
 * DSH app surfaces are Chinese/English, so the copy only needs those two
 * plus Japanese for the opt-in better-locale override.
 */

export const zh = {
  loading: '加载中…',
  loadFailed: '编辑器加载失败',
  edit: '编辑',
  editInWindow: '在编辑窗口中修改',
  save: '保存',
  saved: '已保存',
  saveFailed: '保存失败',
  close: '关闭',
  unsaved: '未保存',
  closeUnsavedConfirm: '有未保存的修改，确定关闭吗？',
  truncation: '文件过大，仅显示前 512KB，暂不支持编辑',
  position: '行 {line}，列 {column}',
} as const

export const en: Record<keyof typeof zh, string> = {
  loading: 'Loading…',
  loadFailed: 'Failed to load the editor',
  edit: 'Edit',
  editInWindow: 'Edit in window',
  save: 'Save',
  saved: 'Saved',
  saveFailed: 'Save failed',
  close: 'Close',
  unsaved: 'Unsaved',
  closeUnsavedConfirm: 'Discard unsaved changes and close?',
  truncation: 'File too large — showing the first 512KB; editing is unavailable',
  position: 'Ln {line}, Col {column}',
}

export const ja: Record<keyof typeof zh, string> = {
  loading: '読み込み中…',
  loadFailed: 'エディターの読み込みに失敗しました',
  edit: '編集',
  editInWindow: '編集ウィンドウで変更',
  save: '保存',
  saved: '保存済み',
  saveFailed: '保存に失敗',
  close: '閉じる',
  unsaved: '未保存',
  closeUnsavedConfirm: '未保存の変更があります。閉じますか？',
  truncation: 'ファイルが大きすぎます — 最初の 512KB のみ表示、編集は利用できません',
  position: '行 {line}、列 {column}',
}

export type CopyKey = keyof typeof zh

let localeService: { getSnapshot(): { active: string } } | undefined

export function attachLocale(service: typeof localeService): void {
  localeService = service
}

function activeLocale(): string {
  return localeService?.getSnapshot().active
    ?? (typeof navigator !== 'undefined' ? navigator.language : '')
    ?? 'en'
}

/** Translate a copy key (zh → zh, else en; ja via an explicit override store). */
export function t(key: CopyKey, params?: Record<string, string | number>): string {
  const dshActive = localeService?.getSnapshot().active ?? ''
  const dict = dshActive.toLowerCase().startsWith('zh') ? zh : en
  let text: string | undefined = dict[key]
  if (text === undefined) text = key
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

export const LOCALE_NS = 'dsh-better-editor'
