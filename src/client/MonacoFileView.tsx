/**
 * The read-only file viewer registered with dsh-better-sidebar: a
 * syntax-highlighted monaco surface (readOnly) with a toolbar "编辑" button
 * that opens the Monaco edit window in a modal. This component lives in the
 * lazy editor chunk (monaco is too heavy for page load); the client bundle
 * mounts it once the chunk arrives (see editor-loader.ts / index.tsx).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as monaco from 'monaco-editor'
import { ensureMonacoEnvironment } from './monaco-setup.ts'
import { applyDshMonacoTheme, DSH_DARK_THEME, DSH_LIGHT_THEME } from './monaco-theme.ts'
import { monacoLanguageForPath } from './monaco-lang.ts'
import { isDarkScheme, subscribeColorScheme } from './theme.ts'
import { t } from './locales.ts'
import { IconEditOutline16 } from './icons.tsx'
import { MonacoEditWindow } from './MonacoEditWindow.tsx'
import type { SessionScope } from './api.ts'
import css from './file-editor.module.css'

/** The viewer props slice this component consumes (FileViewerProps superset). */
export interface EditorViewerProps {
  scope: SessionScope
  path: string
  content?: string
  truncated?: boolean
}

export function MonacoFileView(props: EditorViewerProps) {
  const { scope, path, content, truncated } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const [dark, setDark] = useState(() => isDarkScheme())
  const [editOpen, setEditOpen] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle')
  const language = useMemo(() => monacoLanguageForPath(path), [path])

  useEffect(() => subscribeColorScheme(() => { setDark(isDarkScheme()) }), [])
  useEffect(() => {
    applyDshMonacoTheme(monaco, dark)
    monaco.editor.setTheme(dark ? DSH_DARK_THEME : DSH_LIGHT_THEME)
  }, [dark])

  // Read-only editor; recreated on a file switch (path/content swap).
  useEffect(() => {
    const host = hostRef.current
    if (host === null || content === undefined) return
    ensureMonacoEnvironment()
    applyDshMonacoTheme(monaco, isDarkScheme())
    const model = monaco.editor.createModel(content, language, monaco.Uri.parse(`inmemory://view${path}`))
    const editor = monaco.editor.create(host, {
      model,
      readOnly: true,
      automaticLayout: true,
      fontFamily: 'var(--ds-font-family-code)',
      fontSize: 13,
      tabSize: 2,
      wordWrap: 'on',
      minimap: { enabled: false },
      folding: true,
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      scrollBeyondLastLine: false,
      padding: { top: 8, bottom: 8 },
      renderLineHighlight: 'none',
      occurrencesHighlight: 'off',
      selectionHighlight: true,
      smoothScrolling: true,
      fixedOverflowWidgets: true,
    })
    editorRef.current = editor
    return () => {
      editor.dispose()
      model.dispose()
      editorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, content])

  const onSaved = (text: string): void => {
    setSaveState('saved')
    const model = editorRef.current?.getModel()
    if (model !== undefined && model !== null && model.getValue() !== text) {
      model.setValue(text)
    }
  }

  return (
    <div className={css.root}>
      <div className={css.toolbar}>
        <button
          type="button"
          className={css.editButton}
          onClick={() => { setEditOpen(true); setSaveState('idle') }}
        >
          <IconEditOutline16 size={14} />
          <span>{t('edit')}</span>
        </button>
        {saveState === 'saved' && <span className={css.savedLabel}>{t('saved')}</span>}
        {saveState === 'failed' && <span className={css.failedLabel}>{t('saveFailed')}</span>}
      </div>
      {truncated === true && <div className={css.banner}>{t('truncation')}</div>}
      <div className={css.readHost} ref={hostRef} />
      {editOpen && (
        <MonacoEditWindow
          scope={scope}
          path={path}
          content={editorRef.current?.getValue() ?? content ?? ''}
          truncated={truncated === true}
          onSaved={onSaved}
          onClose={() => { setEditOpen(false) }}
        />
      )}
    </div>
  )
}