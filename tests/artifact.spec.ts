/**
 * Built artifact contract: the client bundle registers itself with the DSH
 * module loader under the package-name id and materializes through a require
 * over the module table; the editor chunk assigns its factory to the
 * plugin-owned global (the chunk's monaco body is NOT materialized here —
 * it probes real browser APIs, which the mount e2e covers in chromium).
 * Reads lib/, so run `pnpm build` first; skips when lib/ is missing.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

const libBuilt = existsSync('lib/client.js') && existsSync('lib/client-editor.js')

describe.skipIf(!libBuilt)('built artifacts', () => {
  it('client.js registers the package-name id with the module loader', () => {
    let loadedId: string | undefined
    let factory: ((require: (spec: string) => unknown) => unknown) | undefined
    const g = globalThis as Record<string, unknown>
    g.window = g
    g.__ModuleLoader__ = {
      load: (entry: { id: string; factory: (require: (spec: string) => unknown) => unknown }) => {
        loadedId = entry.id
        factory = entry.factory
      },
    }
    new Function(readFileSync('lib/client.js', 'utf8'))()
    expect(loadedId).toBe('dsh-better-editor')
    expect(typeof factory).toBe('function')
    // Materialize: the module body only needs react's createElement/hooks and
    // react-dom; dsh-better-sidebar is type-only (erased).
    const react = { createElement: () => null, useEffect: () => {}, useState: () => [null, () => {}] }
    const exports = factory!((spec) => {
      if (spec === 'react') return react
      if (spec === 'react/jsx-runtime') return { jsx: react.createElement, jsxs: react.createElement }
      if (spec === 'react-dom') return {}
      if (spec === 'react-dom/client') return {}
      throw new Error(`require("${spec}") missed the module table`)
    }) as { inject: string[]; apply: unknown }
    expect(Array.isArray(exports.inject)).toBe(true)
    expect(exports.inject).toContain('betterSidebar')
    expect(typeof exports.apply).toBe('function')
    delete g.__ModuleLoader__
  })

  it('client-editor.js assigns its factory to the plugin-owned global', () => {
    const g = globalThis as Record<string, unknown>
    g.window = g
    new Function(readFileSync('lib/client-editor.js', 'utf8'))()
    const registry = (g.__betterEditorChunks__ ?? {}) as Record<string, unknown>
    expect(typeof registry.editor).toBe('function')
    delete g.__betterEditorChunks__
  })
})
