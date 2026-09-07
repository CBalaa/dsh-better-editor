/**
 * Lazy chunk loader for the editor chunk (lib/client-editor.js): the monaco
 * editor + this plugin's viewer UI, fetched only when a text file first
 * opens. The chunk is a CJS closure registered on a plugin-owned global
 * (`globalThis.__betterEditorChunks__["editor"]`); its `require` resolves the
 * module-table externals (react/react-dom) through the client module system
 * the shell injects at activation.
 */
import type { ComponentType } from 'react'
import type { FileViewerProps } from 'dsh-better-sidebar'

/** The chunk's exports (the viewer component the descriptor renders). */
export interface EditorChunkExports {
  MonacoFileView: ComponentType<FileViewerProps>
}

/** The chunk script endpoint (served by the host's /better-editor/bundle route). */
const CHUNK_URL = '/better-editor/bundle/client-editor.js'
const REGISTRY_KEY = 'editor'

/** The module-table externals the chunk requires (mirror of CHUNK_EXTERNALS in tsdown.config.ts). */
const CHUNK_EXTERNALS = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'] as const

/** The client module system surface this loader resolves externals through. */
export interface ChunkModuleSystem {
  import(specifier: string): Promise<unknown>
}

let injectedModuleSystem: ChunkModuleSystem | undefined

/** Inject the client module system (the shell's `ctx.modules`). */
export function setEditorModuleSystem(system: ChunkModuleSystem | undefined): void {
  injectedModuleSystem = system
}

let externalsRequire: ((spec: string) => unknown) | undefined

async function buildExternalsRequire(): Promise<(spec: string) => unknown> {
  if (externalsRequire !== undefined) return externalsRequire
  const modules = injectedModuleSystem
  if (modules === undefined) throw new Error('[dsh-better-editor] client module system unavailable')
  const entries = await Promise.all(CHUNK_EXTERNALS.map(async (spec) => {
    try {
      return [spec, await modules.import(spec)] as const
    } catch {
      return [spec, undefined] as const
    }
  }))
  const table = new Map<string, unknown>(entries)
  externalsRequire = (spec: string): unknown => {
    if (!table.has(spec)) throw new Error(`[dsh-better-editor] chunk require('${spec}') missed the module table`)
    return table.get(spec)
  }
  return externalsRequire
}

let cache: Promise<EditorChunkExports> | undefined

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.async = true
    el.src = src
    el.addEventListener('load', () => { el.remove(); resolve() }, { once: true })
    el.addEventListener('error', () => { el.remove(); reject(new Error(`[dsh-better-editor] chunk script ${src} failed to load`)) }, { once: true })
    document.head.append(el)
  })
}

/** Load (once) the editor chunk; a failure clears the cache so a retry re-fetches. */
export function loadEditorChunk(): Promise<EditorChunkExports> {
  cache ??= (async () => {
    await injectScript(CHUNK_URL)
    const registry = (globalThis as unknown as {
      __betterEditorChunks__?: Record<string, ((require: (spec: string) => unknown) => EditorChunkExports) | undefined>
    }).__betterEditorChunks__
    const factory = registry?.[REGISTRY_KEY]
    if (typeof factory !== 'function') {
      throw new Error(`[dsh-better-editor] chunk "${REGISTRY_KEY}" did not register its factory`)
    }
    return factory(await buildExternalsRequire())
  })()
  void cache.catch(() => { cache = undefined })
  return cache
}

/** Test hook: drop the memoized chunk (vitest reuses the module). */
export function resetEditorChunkForTests(): void {
  cache = undefined
  externalsRequire = undefined
}
