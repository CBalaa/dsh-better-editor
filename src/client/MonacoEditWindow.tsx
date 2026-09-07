/**
 * The "edit in window" surface: a centered modal hosting a Monaco editor over
 * one file. Opened from the read-only viewer's edit button. Saves write
 * through /sidebar/api/fs.write and report back via onSaved so the read view
 * refreshes in place (no host reload). The vscode.dev editing experience:
 * multi-cursor, find/replace, folding, minimap, sticky scroll, Ctrl/Cmd+S.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import * as monaco from 'monaco-editor'
import { fsWrite, type SessionScope } from './api.ts'
import { ensureMonacoEnvironment } from './monaco-setup.ts'
import { applyDshMonacoTheme, DSH_DARK_THEME, DSH_LIGHT_THEME } from './monaco-theme.ts'
import { monacoLanguageForPath } from './monaco-lang.ts'
import { isDarkScheme, subscribeColorScheme } from './theme.ts'
import { baseName, relativeTo } from './paths.ts'
import { t } from './locales.ts'
import { IconCheck16, IconClose16 } from './icons.tsx'
import widgetCss from './monaco-window.module.css'

export interface MonacoEditWindowProps {
  scope: SessionScope
  path: string
  /** The bytes to seed the editor with (the currently displayed content). */
  content: string
  truncated: boolean
  onSaved: (content: string) => void
  onClose: () => void
}

function modelUriFor(path: string): monaco.Uri {
  return monaco.Uri.parse(`inmemory://editor${path.startsWith('/') ? path : `/${path}`}`)
}

export function MonacoEditWindow(props: MonacoEditWindowProps): ReactNode {
  const { scope, path, content, truncated, onSaved, onClose } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const [dark, setDark] = useState(() => isDarkScheme())
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [position, setPosition] = useState<{ line: number; column: number } | null>(null)
  const savingRef = useRef(false)
  const latestRef = useRef({ onSaved, onClose })
  latestRef.current = { onSaved, onClose }
  const saveRef = useRef<() => void>(() => {})

  const language = useMemo(() => monacoLanguageForPath(path), [path])
  const displayPath = useMemo(() => relativeTo(scope.cwd ?? '', path), [scope.cwd, path])

  useEffect(() => subscribeColorScheme(() => { setDark(isDarkScheme()) }), [])
  useEffect(() => {
    applyDshMonacoTheme(monaco, dark)
    monaco.editor.setTheme(dark ? DSH_DARK_THEME : DSH_LIGHT_THEME)
  }, [dark])

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    ensureMonacoEnvironment()
    applyDshMonacoTheme(monaco, isDarkScheme())
    const model = monaco.editor.createModel(content, language, modelUriFor(path))
    const editor = monaco.editor.create(host, {
      model,
      automaticLayout: true,
      fontFamily: 'var(--ds-font-family-code)',
      fontSize: 13,
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      wordWrap: 'on',
      minimap: { enabled: true, maxColumn: 80 },
      stickyScroll: { enabled: true },
      folding: true,
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      multiCursorModifier: 'alt',
      scrollBeyondLastLine: false,
      padding: { top: 8, bottom: 8 },
      renderLineHighlight: 'all',
      occurrencesHighlight: 'singleFile',
      selectionHighlight: true,
      linkedEditing: true,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      fixedOverflowWidgets: true,
    })

    const save = (): void => {
      if (truncated || savingRef.current) return
      savingRef.current = true
      setSaveState('saving')
      fsWrite(scope, path, editor.getValue()).then(() => {
        savingRef.current = false
        setDirty(false)
        setSaveState('saved')
        latestRef.current.onSaved(editor.getValue())
      }).catch(() => {
        savingRef.current = false
        setSaveState('failed')
      })
    }
    saveRef.current = save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, save)

    const subs = [
      editor.onDidChangeModelContent(() => { setDirty(true) }),
      editor.onDidChangeCursorPosition((event) => {
        setPosition({ line: event.position.lineNumber, column: event.position.column })
      }),
    ]
    editor.focus()
    return () => {
      for (const sub of subs) sub.dispose()
      editor.dispose()
      model.dispose()
    }
    // content/scope/path are stable for the window's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const requestClose = (): void => {
    if (dirty) {
      const confirmed = typeof window.confirm === 'function'
        ? window.confirm(t('closeUnsavedConfirm'))
        : false
      if (!confirmed) return
    }
    onClose()
  }

  const saveLabel = saveState === 'saving' ? t('loading')
    : saveState === 'saved' ? t('saved')
      : saveState === 'failed' ? t('saveFailed') : ''

  return createPortal(
    <div
      className={widgetCss.overlay}
      onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); requestClose() } }}
    >
      <div className={widgetCss.window} role="dialog" aria-modal="true" aria-label={baseName(path)} data-dsh-monaco-window>
        <div className={widgetCss.header}>
          <span className={widgetCss.title} title={path}>{displayPath}</span>
          {dirty && <span className={widgetCss.dirtyDot} title={t('unsaved')} />}
          <button
            type="button"
            className={widgetCss.headerButton}
            aria-label={t('save')}
            title={`${t('save')} (Ctrl/Cmd+S)`}
            disabled={truncated || !dirty}
            onClick={() => { saveRef.current() }}
          >
            <IconCheck16 size={14} />
          </button>
          {saveLabel !== '' && (
            <span className={saveState === 'failed' ? `${widgetCss.status} ${widgetCss.statusError}` : widgetCss.status}>{saveLabel}</span>
          )}
          <button
            type="button"
            className={widgetCss.headerButton}
            aria-label={t('close')}
            title={t('close')}
            onClick={requestClose}
          >
            <IconClose16 size={14} />
          </button>
        </div>
        {truncated && <div className={widgetCss.banner}>{t('truncation')}</div>}
        <div className={widgetCss.editor} ref={hostRef} />
        <div className={widgetCss.footer}>
          <span>{language}</span>
          <span>{position === null ? '' : t('position', { line: position.line, column: position.column })}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}