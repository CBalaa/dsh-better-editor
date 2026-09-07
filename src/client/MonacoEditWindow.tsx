/**
 * The "edit in window" surface: a resizable, VSCode-shaped workspace modal —
 * a file-explorer pane (left), an editor tab strip, and one Monaco editor that
 * swaps models per open file. Opened from the read-only viewer's edit button.
 * Saves write through /sidebar/api/fs.write; other files load through
 * fs.read/fs.tree. The vscode.dev editing experience: multi-cursor,
 * find/replace, folding, minimap, sticky scroll, Ctrl/Cmd+S.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import * as monaco from 'monaco-editor'
import { fsRead, fsWrite, type SessionScope } from './api.ts'
import { ensureMonacoEnvironment } from './monaco-setup.ts'
import { applyDshMonacoTheme, DSH_DARK_THEME, DSH_LIGHT_THEME } from './monaco-theme.ts'
import { monacoLanguageForPath } from './monaco-lang.ts'
import { isDarkScheme, subscribeColorScheme } from './theme.ts'
import { baseName } from './paths.ts'
import { t } from './locales.ts'
import { IconCheck16, IconClose16, IconSidebar16 } from './icons.tsx'
import { FileExplorer } from './FileExplorer.tsx'
import widgetCss from './monaco-window.module.css'

export interface MonacoEditWindowProps {
  scope: SessionScope
  path: string
  /** The bytes to seed the first tab with (the currently displayed content). */
  content: string
  truncated: boolean
  onSaved: (content: string) => void
  onClose: () => void
}

interface TabState {
  path: string
  truncated: boolean
  dirty: boolean
  saveState: 'idle' | 'saving' | 'saved' | 'failed'
}

interface WindowGeom {
  x: number
  y: number
  w: number
  h: number
}

function modelUriFor(path: string): monaco.Uri {
  return monaco.Uri.parse(`inmemory://editor${path.startsWith('/') ? path : `/${path}`}`)
}

const MIN_WINDOW_W = 560
const MIN_WINDOW_H = 380
const MIN_EXPLORER_W = 160
const MAX_EXPLORER_W = 520
const EDGE = 8

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** Initial window geometry: centered 90vw × 85vh, expressed as top/left. */
function initialGeometry(): WindowGeom {
  return {
    x: Math.round(window.innerWidth * 0.05),
    y: Math.round(window.innerHeight * 0.075),
    w: Math.round(window.innerWidth * 0.9),
    h: Math.round(window.innerHeight * 0.85),
  }
}

export function MonacoEditWindow(props: MonacoEditWindowProps): ReactNode {
  const { scope, path, content, truncated, onSaved, onClose } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelsRef = useRef<Map<string, monaco.editor.ITextModel>>(new Map())
  const tabsRef = useRef<TabState[]>([])
  const activePathRef = useRef(path)
  const initialPathRef = useRef(path)
  const savingRef = useRef(false)
  const geomRef = useRef<WindowGeom>(initialGeometry())
  const explorerWidthRef = useRef(240)
  const latestRef = useRef({ onSaved, onClose })
  latestRef.current = { onSaved, onClose }

  const [dark, setDark] = useState(() => isDarkScheme())
  const [tabs, setTabs] = useState<TabState[]>(() => [{ path, truncated, dirty: false, saveState: 'idle' }])
  const [activePath, setActivePath] = useState(path)
  const [position, setPosition] = useState<{ line: number; column: number } | null>(null)
  const [notice, setNotice] = useState('')
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [explorerWidth, setExplorerWidth] = useState(240)
  const [geom, setGeom] = useState<WindowGeom>(initialGeometry)

  useEffect(() => { tabsRef.current = tabs; activePathRef.current = activePath }, [tabs, activePath])
  useEffect(() => { geomRef.current = geom }, [geom])
  useEffect(() => { explorerWidthRef.current = explorerWidth }, [explorerWidth])

  const language = useMemo(() => monacoLanguageForPath(activePath), [activePath])

  useEffect(() => subscribeColorScheme(() => { setDark(isDarkScheme()) }), [])
  useEffect(() => {
    applyDshMonacoTheme(monaco, dark)
    monaco.editor.setTheme(dark ? DSH_DARK_THEME : DSH_LIGHT_THEME)
  }, [dark])

  const getOrCreateModel = useCallback((filePath: string, text: string): monaco.editor.ITextModel => {
    const existing = modelsRef.current.get(filePath)
    if (existing !== undefined) return existing
    const model = monaco.editor.createModel(text, monacoLanguageForPath(filePath), modelUriFor(filePath))
    modelsRef.current.set(filePath, model)
    return model
  }, [])

  const markDirty = useCallback((filePath: string): void => {
    setTabs((prev) => prev.map((t) => (t.path === filePath && !t.dirty ? { ...t, dirty: true } : t)))
  }, [])

  const patchTab = useCallback((filePath: string, patch: Partial<TabState>): void => {
    setTabs((prev) => prev.map((t) => (t.path === filePath ? { ...t, ...patch } : t)))
  }, [])

  const saveTab = useCallback((filePath: string): void => {
    const tab = tabsRef.current.find((t) => t.path === filePath)
    if (tab === undefined || tab.truncated || savingRef.current) return
    const model = modelsRef.current.get(filePath)
    if (model === undefined) return
    savingRef.current = true
    patchTab(filePath, { saveState: 'saving' })
    const value = model.getValue()
    fsWrite(scope, filePath, value).then(() => {
      savingRef.current = false
      patchTab(filePath, { dirty: false, saveState: 'saved' })
      if (filePath === initialPathRef.current) latestRef.current.onSaved(value)
    }).catch((error) => {
      savingRef.current = false
      patchTab(filePath, { saveState: 'failed' })
      setNotice(error instanceof Error ? error.message : String(error))
    })
  }, [scope, patchTab])

  const openFile = useCallback((filePath: string): void => {
    if (tabsRef.current.some((t) => t.path === filePath)) {
      setActivePath(filePath)
      return
    }
    setNotice('')
    fsRead(scope, filePath).then((res) => {
      if (res.kind === 'binary') {
        setNotice(`${filePath}: binary`)
        return
      }
      getOrCreateModel(filePath, res.content)
      setTabs((prev) => [...prev, { path: filePath, truncated: res.truncated, dirty: false, saveState: 'idle' }])
      setActivePath(filePath)
    }).catch((error) => {
      setNotice(error instanceof Error ? error.message : String(error))
    })
  }, [scope, getOrCreateModel])

  const closeTab = useCallback((filePath: string): void => {
    const prev = tabsRef.current
    const tab = prev.find((t) => t.path === filePath)
    if (tab === undefined) return
    if (tab.dirty) {
      const confirmed = typeof window.confirm === 'function' ? window.confirm(t('closeUnsavedConfirm')) : false
      if (!confirmed) return
    }
    const model = modelsRef.current.get(filePath)
    if (model !== undefined) {
      model.dispose()
      modelsRef.current.delete(filePath)
    }
    const next = prev.filter((t) => t.path !== filePath)
    if (next.length === 0) {
      latestRef.current.onClose()
      return
    }
    setTabs(next)
    if (filePath === activePathRef.current) {
      const index = prev.findIndex((t) => t.path === filePath)
      const neighbor = next[Math.min(index, next.length - 1)]
      if (neighbor !== undefined) setActivePath(neighbor.path)
    }
  }, [])

  const requestClose = useCallback((): void => {
    if (tabsRef.current.some((t) => t.dirty)) {
      const confirmed = typeof window.confirm === 'function' ? window.confirm(t('closeUnsavedConfirm')) : false
      if (!confirmed) return
    }
    latestRef.current.onClose()
  }, [])

  // Create the editor once, bound to the first tab's model.
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    ensureMonacoEnvironment()
    applyDshMonacoTheme(monaco, isDarkScheme())
    const firstModel = getOrCreateModel(path, content)
    const editor = monaco.editor.create(host, {
      model: firstModel,
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
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveTab(activePathRef.current))
    const subs = [
      editor.onDidChangeModelContent(() => { markDirty(activePathRef.current) }),
      editor.onDidChangeCursorPosition((event) => {
        setPosition({ line: event.position.lineNumber, column: event.position.column })
      }),
    ]
    editor.focus()
    return () => {
      for (const sub of subs) sub.dispose()
      editor.dispose()
      editorRef.current = null
      for (const model of modelsRef.current.values()) model.dispose()
      modelsRef.current.clear()
    }
    // scope/content/path are stable for the window's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap the editor's model when the active tab changes.
  useEffect(() => {
    const editor = editorRef.current
    const model = modelsRef.current.get(activePath)
    if (editor !== null && editor !== undefined && model !== undefined) editor.setModel(model)
  }, [activePath])

  const startWindowMove = (event: ReactPointerEvent): void => {
    const target = event.target as HTMLElement
    if (target.closest('button') !== null || target.closest(`.${widgetCss.tab}`) !== null) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const start = geomRef.current
    const onMove = (ev: PointerEvent): void => {
      setGeom((prev) => ({
        ...prev,
        x: clamp(start.x + (ev.clientX - startX), EDGE, window.innerWidth - start.w - EDGE),
        y: clamp(start.y + (ev.clientY - startY), EDGE, window.innerHeight - start.h - EDGE),
      }))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startWindowResize = (dir: ResizeDir) => (event: ReactPointerEvent): void => {
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const start = geomRef.current
    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      let { x, y, w, h } = start
      if (dir.includes('e')) w = start.w + dx
      if (dir.includes('s')) h = start.h + dy
      if (dir.includes('w')) { w = start.w - dx; x = start.x + (start.w - w) }
      if (dir.includes('n')) { h = start.h - dy; y = start.y + (start.h - h) }
      w = clamp(w, MIN_WINDOW_W, window.innerWidth - EDGE * 2)
      h = clamp(h, MIN_WINDOW_H, window.innerHeight - EDGE * 2)
      x = clamp(x, EDGE, window.innerWidth - w - EDGE)
      y = clamp(y, EDGE, window.innerHeight - h - EDGE)
      setGeom({ x, y, w, h })
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startExplorerResize = (event: ReactPointerEvent): void => {
    event.preventDefault()
    const startX = event.clientX
    const startW = explorerWidthRef.current
    const onMove = (ev: PointerEvent): void => {
      setExplorerWidth(clamp(startW + (ev.clientX - startX), MIN_EXPLORER_W, MAX_EXPLORER_W))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const activeTab = tabs.find((t) => t.path === activePath)
  const activeDirty = activeTab?.dirty === true
  const activeTruncated = activeTab?.truncated === true
  const saveLabel = activeTab?.saveState === 'saving' ? t('loading')
    : activeTab?.saveState === 'saved' ? t('saved')
      : activeTab?.saveState === 'failed' ? t('saveFailed') : ''

  const resizeHandle = (dir: ResizeDir): ReactNode => (
    <div className={`${widgetCss.rsz} ${widgetCss[`rsz${dir.toUpperCase()}`]}`} onPointerDown={startWindowResize(dir)} />
  )

  return createPortal(
    <div
      className={widgetCss.overlay}
      onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); requestClose() } }}
    >
      <div
        className={widgetCss.window}
        role="dialog"
        aria-modal="true"
        aria-label={baseName(activePath)}
        style={{ left: geom.x, top: geom.y, width: geom.w, height: geom.h }}
        data-dsh-monaco-window
      >
        {resizeHandle('n')}
        {resizeHandle('s')}
        {resizeHandle('e')}
        {resizeHandle('w')}
        {resizeHandle('ne')}
        {resizeHandle('nw')}
        {resizeHandle('se')}
        {resizeHandle('sw')}

        <div className={widgetCss.tabbar} onPointerDown={startWindowMove}>
          <button
            type="button"
            className={`${widgetCss.headerButton} ${explorerOpen ? widgetCss.headerButtonActive : ''}`}
            aria-label={t('explorer')}
            title={t('explorer')}
            onClick={() => { setExplorerOpen((open) => !open) }}
          >
            <IconSidebar16 size={14} />
          </button>
          <div className={widgetCss.tabs}>
            {tabs.map((tab) => (
              <div
                key={tab.path}
                className={`${widgetCss.tab} ${tab.path === activePath ? widgetCss.tabActive : ''}`}
                title={tab.path}
                onClick={() => { setActivePath(tab.path) }}
              >
                {tab.dirty && <span className={widgetCss.dirtyDot} title={t('unsaved')} />}
                <span className={widgetCss.tabTitle}>{baseName(tab.path)}</span>
                <button
                  type="button"
                  className={widgetCss.tabClose}
                  aria-label={t('close')}
                  title={t('close')}
                  onClick={(event) => { event.stopPropagation(); closeTab(tab.path) }}
                >
                  <IconClose16 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className={widgetCss.tabbarActions}>
            {saveLabel !== '' && (
              <span className={activeTab?.saveState === 'failed' ? `${widgetCss.status} ${widgetCss.statusError}` : widgetCss.status}>{saveLabel}</span>
            )}
            <button
              type="button"
              className={widgetCss.headerButton}
              aria-label={t('save')}
              title={`${t('save')} (Ctrl/Cmd+S)`}
              disabled={activeTruncated || !activeDirty}
              onClick={() => { saveTab(activePath) }}
            >
              <IconCheck16 size={14} />
            </button>
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
        </div>

        <div className={widgetCss.body}>
          {explorerOpen && (
            <>
              <div className={widgetCss.explorer} style={{ width: explorerWidth }}>
                <FileExplorer scope={scope} activePath={activePath} onOpenFile={openFile} />
              </div>
              <div className={widgetCss.divider} onPointerDown={startExplorerResize} />
            </>
          )}
          <div className={widgetCss.editorArea}>
            {activeTruncated && <div className={widgetCss.banner}>{t('truncation')}</div>}
            {notice !== '' && <div className={widgetCss.notice}>{notice}</div>}
            <div className={widgetCss.editor} ref={hostRef} />
          </div>
        </div>

        <div className={widgetCss.footer}>
          <span>{language}</span>
          <span>{position === null ? '' : t('position', { line: position.line, column: position.column })}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
