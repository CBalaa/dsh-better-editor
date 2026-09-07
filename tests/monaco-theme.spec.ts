/**
 * monaco-theme tests: toMonacoColor normalization (the #fff regression — a
 * skin token's shorthand hex would otherwise throw "Illegal value for token
 * color" in monaco's token-rule parser) and the define-once / re-define
 * lifecycle against a stub monaco host.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyDshMonacoTheme,
  resetDshMonacoThemesForTests,
  toMonacoColor,
  DSH_DARK_THEME,
  DSH_LIGHT_THEME,
  type MonacoThemeHost,
} from '../src/client/monaco-theme.ts'

interface Recorded {
  defined: Array<{ id: string; data: { base: string; colors: Record<string, string> } }>
  activated: string[]
}

function stubMonaco(): { monaco: MonacoThemeHost; recorded: Recorded } {
  const recorded: Recorded = { defined: [], activated: [] }
  return {
    monaco: {
      editor: {
        defineTheme: (id, data) => { recorded.defined.push({ id, data: data as Recorded['defined'][number]['data'] }) },
        setTheme: (id) => { recorded.activated.push(id) },
      },
    },
    recorded,
  }
}

afterEach(() => {
  resetDshMonacoThemesForTests()
  delete (globalThis as Record<string, unknown>).document
  delete (globalThis as Record<string, unknown>).getComputedStyle
})

describe('toMonacoColor', () => {
  it('expands shorthand hex to monaco-safe 6/8-hex (the #fff regression)', () => {
    expect(toMonacoColor('#fff')).toBe('#ffffff')
    expect(toMonacoColor('#fff8')).toBe('#ffffff88')
    expect(toMonacoColor('#282c34')).toBe('#282c34')
    expect(toMonacoColor('#282c34ff')).toBe('#282c34ff')
  })

  it('converts rgb()/rgba() to 6/8-hex (comma and space syntax)', () => {
    expect(toMonacoColor('rgb(30, 30, 46)')).toBe('#1e1e2e')
    expect(toMonacoColor('rgb(30 30 46)')).toBe('#1e1e2e')
    expect(toMonacoColor('rgba(200, 200, 200, 0.4)')).toBe('#c8c8c866')
    expect(toMonacoColor('rgb(200 200 200 / 0.4)')).toBe('#c8c8c866')
  })

  it('returns null for unparseable forms (caller falls back)', () => {
    expect(toMonacoColor('')).toBeNull()
    expect(toMonacoColor('transparent')).toBeNull()
    expect(toMonacoColor('var(--x)')).toBeNull()
    expect(toMonacoColor('oklch(0.5 0.1 200)')).toBeNull()
  })
})

describe('applyDshMonacoTheme', () => {
  it('defines both themes on first apply and activates the dark one', () => {
    const { monaco, recorded } = stubMonaco()
    applyDshMonacoTheme(monaco, true)
    expect(recorded.defined.map(entry => entry.id)).toEqual([DSH_DARK_THEME, DSH_LIGHT_THEME])
    expect(recorded.activated).toEqual([DSH_DARK_THEME])
    expect(recorded.defined[0]!.data.colors['editor.background']).toBe('#282c34')
  })

  it('resolves a shorthand-hex skin token without tripping monaco', () => {
    const { monaco, recorded } = stubMonaco()
    globalThis.document = { body: {} } as unknown as Document
    const prop = (name: string): string => ({
      '--dsw-alias-bg-layer-1': '#fff',       // shorthand — the regression case
      '--dsw-alias-label-primary': 'rgba(200, 200, 200, 0.4)', // translucent → fallback
    })[name] ?? ''
    globalThis.getComputedStyle = () => ({ getPropertyValue: prop }) as CSSStyleDeclaration
    applyDshMonacoTheme(monaco, true)
    const dark = recorded.defined[0]!.data
    // '#fff' → normalized to '#ffffff' (not the raw 3-hex that monaco rejects).
    expect(dark.colors['editor.background']).toBe('#ffffff')
    expect(dark.colors['editor.foreground']).toBe('#abb2bf')
  })
})
