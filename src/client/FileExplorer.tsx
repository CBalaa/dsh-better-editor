/**
 * File explorer for the edit window: a lazy directory tree over the sidebar's
 * fs.tree route. The root is the session cwd; directories load their children
 * on first expand. Clicking a file asks the parent to open it as an editor
 * tab; directories toggle open/closed.
 */
import { useEffect, useRef, useState, type JSX } from 'react'
import { fsTree, type FsTreeEntry, type SessionScope } from './api.ts'
import { t } from './locales.ts'
import { IconChevronRight16, IconFile16, IconFolder16 } from './icons.tsx'
import css from './monaco-window.module.css'

interface FileExplorerProps {
  scope: SessionScope
  activePath: string
  onOpenFile: (path: string) => void
}

export function FileExplorer({ scope, activePath, onOpenFile }: FileExplorerProps): JSX.Element {
  const [rootPath, setRootPath] = useState('')
  const [dirs, setDirs] = useState<Record<string, FsTreeEntry[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const loadedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    fsTree(scope).then((res) => {
      if (cancelled) return
      setRootPath(res.path)
      setDirs({ [res.path]: res.entries })
      setExpanded({ [res.path]: true })
      loadedRef.current.add(res.path)
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err))
    })
    return () => { cancelled = true }
    // scope is stable for the window's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleDir = (dirPath: string): void => {
    const willExpand = expanded[dirPath] !== true
    setExpanded((prev) => {
      const next = { ...prev }
      if (next[dirPath] === true) delete next[dirPath]
      else next[dirPath] = true
      return next
    })
    if (willExpand && !loadedRef.current.has(dirPath)) {
      loadedRef.current.add(dirPath)
      fsTree(scope, dirPath).then((res) => {
        setDirs((prev) => ({ ...prev, [dirPath]: res.entries }))
      }).catch((err) => {
        loadedRef.current.delete(dirPath)
        // A single directory's listing failure must not blank the whole
        // tree — it just stays expanded-but-empty.
        console.warn(`[dsh-better-editor] list failed: ${dirPath}`, err)
      })
    }
  }

  const renderEntries = (entries: FsTreeEntry[], depth: number): JSX.Element => (
    <>
      {entries.map((entry) => {
        const isOpen = entry.isDir && expanded[entry.path] === true
        const indent = depth * 12 + 8
        return (
          <div key={entry.path}>
            <div
              className={`${css.treeRow} ${activePath === entry.path ? css.treeRowActive : ''}`}
              style={{ paddingLeft: indent }}
              title={entry.path}
              onClick={() => { if (entry.isDir) toggleDir(entry.path); else onOpenFile(entry.path) }}
            >
              <span className={`${css.treeChevron} ${isOpen ? css.treeChevronOpen : ''}`}>
                {entry.isDir ? <IconChevronRight16 size={12} /> : null}
              </span>
              <span className={css.treeIcon}>{entry.isDir ? <IconFolder16 size={14} /> : <IconFile16 size={14} />}</span>
              <span className={css.treeName}>{entry.name}</span>
            </div>
            {isOpen && dirs[entry.path] !== undefined && renderEntries(dirs[entry.path]!, depth + 1)}
          </div>
        )
      })}
    </>
  )

  return (
    <>
      <div className={css.explorerHeader}>{t('explorer')}</div>
      <div className={css.tree}>
        {error !== '' ? (
          <div className={css.treeError}>{error}</div>
        ) : rootPath === '' ? (
          <div className={css.treeEmpty}>{t('loading')}</div>
        ) : dirs[rootPath] === undefined ? (
          <div className={css.treeEmpty}>{t('loadFailed')}</div>
        ) : (
          renderEntries(dirs[rootPath]!, 0)
        )}
      </div>
    </>
  )
}
