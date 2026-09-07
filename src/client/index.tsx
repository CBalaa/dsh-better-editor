/**
 * Client half of dsh-better-editor: registers ONE file viewer through
 * better-sidebar's `ctx.betterSidebar.registerFileViewer` — a read-only,
 * syntax-highlighted surface plus a Monaco edit window (the vscode.dev
 * engine). The heavy monaco editor + its language workers live in THIS
 * plugin's lazy chunk (lib/client-editor.js) and worker artifacts, keeping
 * better-sidebar's own bundle small.
 *
 * The viewer shadows the sidebar's built-in catch-all `code` viewer: same
 * `exts: []` catch-all, but priority -99 (just above code's -100, and below
 * image/pdf/markdown/html at 0 and binary-download at -50), so known preview
 * types and binary downloads keep their viewers while every other text file
 * opens in this editor.
 */
import { createElement, useEffect, useState, type ComponentType } from 'react'
import type {} from 'dsh-better-sidebar'   // ctx.betterSidebar type merge
import type { Context } from '@deepseek-ai/cordis'
import type { FileViewerDescriptor, FileViewerProps } from 'dsh-better-sidebar'
import { loadEditorChunk, setEditorModuleSystem, type ChunkModuleSystem } from './editor-loader.ts'
import { attachLocale, t } from './locales.ts'
import { IconCodeOutline16 } from './icons.tsx'
import css from './client.module.css'

/** Services required before mounting (provided by the runtime / the sidebar). */
export const inject = ['betterSidebar', 'modules', 'locale']

/** The locale service face t() consults (structural mirror). */
interface LocaleService {
  getSnapshot(): { active: string }
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; Comp: ComponentType<FileViewerProps> }

/** Loads the editor chunk once and renders the viewer (loading/error chrome
 *  while the ~5MB chunk arrives). A descriptor `component` is invoked both as
 *  a plain function and via createElement, so this wrapper keeps its hooks in
 *  the inner component. */
function LazyEditorView(props: FileViewerProps): ReturnType<typeof createElement> {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    loadEditorChunk().then((mod) => {
      if (cancelled) return
      setState({ status: 'ready', Comp: mod.MonacoFileView })
    }).catch((error: unknown) => {
      if (cancelled) return
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
    return () => { cancelled = true }
  }, [])
  if (state.status === 'loading') return createElement('div', { className: css.placeholder }, t('loading'))
  if (state.status === 'error') return createElement('div', { className: css.error }, `${t('loadFailed')}: ${state.message}`)
  return createElement(state.Comp, props)
}

/** The file viewer descriptor (a drop-in replacement for the built-in code viewer). */
const descriptor: FileViewerDescriptor = {
  id: 'better-editor',
  title: () => t('edit'),
  icon: (size: number) => createElement(IconCodeOutline16, { size }),
  exts: [],
  priority: -99,
  fetchStrategy: 'fsRead',
  component: (props) => createElement(LazyEditorView, props),
}

/**
 * Client plugin body.
 * @param ctx - the client cordis context (betterSidebar + modules + locale).
 */
export function apply(ctx: Context): void {
  // The module system the chunk loader resolves its externals through.
  setEditorModuleSystem((ctx as unknown as { modules: ChunkModuleSystem }).modules)
  // The viewer copy follows the DSH locale service (falls back to browser lang).
  attachLocale((ctx as unknown as { locale: LocaleService }).locale)
  // Register through the sidebar's service; the disposer unregisters on fiber
  // disposal (HMR-safe). Skipped when better-sidebar is absent — this plugin
  // is a viewer provider for its editor and does nothing on its own.
  const betterSidebar = (ctx as unknown as {
    betterSidebar?: { registerFileViewer(d: FileViewerDescriptor): () => void }
  }).betterSidebar
  if (betterSidebar === undefined) return
  ctx.effect(() => betterSidebar.registerFileViewer(descriptor), 'dsh-better-editor: file viewer')
}
