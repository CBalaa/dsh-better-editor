/**
 * Monaco themes for the editor: `dsh-dark` / `dsh-light`, defined lazily on
 * first use and re-defined on every color-scheme flip. Syntax hues come from
 * one-dark/one-light (one-dark-palette.ts); surface colors resolve from the
 * app's --dsw-alias-* tokens with family fallbacks (skins keep control).
 *
 * getComputedStyle returns a custom property's DECLARED text ('#fff',
 * 'rgb(…)' etc.), and monaco pushes `editor.foreground`/`editor.background`
 * INTO the token rules — whose parser accepts ONLY `#?[0-9a-f]{6}([0-9a-f]{2})?`.
 * toMonacoColor normalizes shorthand hex and rgb()/rgba() to 6/8-hex; other
 * forms return null and the caller falls back to the opaque family color.
 */
import { effectiveTokenValue } from './theme.ts'
import { ONE_DARK, ONE_LIGHT } from './one-dark-palette.ts'

export const DSH_DARK_THEME = 'dsh-dark'
export const DSH_LIGHT_THEME = 'dsh-light'

/** Minimal monaco surface needed here (the chunk imports the real API). */
export interface MonacoThemeHost {
  editor: {
    defineTheme(id: string, data: unknown): void
    setTheme(id: string): void
  }
}

interface ThemeRule {
  token: string
  foreground?: string
  fontStyle?: string
}

/** Strip the leading '#': monaco rule foregrounds take bare 6/8-hex. */
const hex = (color: string): string => color.replace(/^#/, '')

const RULES_DARK: readonly ThemeRule[] = [
  { token: 'comment', foreground: hex(ONE_DARK.faintGray), fontStyle: 'italic' },
  { token: 'keyword', foreground: hex(ONE_DARK.magenta) },
  { token: 'string', foreground: hex(ONE_DARK.green) },
  { token: 'string.escape', foreground: hex(ONE_DARK.cyan) },
  { token: 'number', foreground: hex(ONE_DARK.orange) },
  { token: 'number.hex', foreground: hex(ONE_DARK.orange) },
  { token: 'type', foreground: hex(ONE_DARK.yellow) },
  { token: 'type.identifier', foreground: hex(ONE_DARK.yellow) },
  { token: 'class', foreground: hex(ONE_DARK.yellow) },
  { token: 'identifier.class', foreground: hex(ONE_DARK.yellow) },
  { token: 'function', foreground: hex(ONE_DARK.blue) },
  { token: 'variable', foreground: hex(ONE_DARK.red) },
  { token: 'variable.predefined', foreground: hex(ONE_DARK.orange) },
  { token: 'operator', foreground: hex(ONE_DARK.cyan) },
  { token: 'tag', foreground: hex(ONE_DARK.red) },
  { token: 'attribute.name', foreground: hex(ONE_DARK.orange) },
  { token: 'attribute.value', foreground: hex(ONE_DARK.green) },
  { token: 'metatag', foreground: hex(ONE_DARK.yellow) },
  { token: 'annotation', foreground: hex(ONE_DARK.yellow) },
  { token: 'regexp', foreground: hex(ONE_DARK.cyan) },
  { token: 'invalid', foreground: hex(ONE_DARK.white), fontStyle: 'bold' },
]

const RULES_LIGHT: readonly ThemeRule[] = [
  { token: 'comment', foreground: hex(ONE_LIGHT.gray), fontStyle: 'italic' },
  { token: 'keyword', foreground: hex(ONE_LIGHT.magenta) },
  { token: 'string', foreground: hex(ONE_LIGHT.green) },
  { token: 'string.escape', foreground: hex(ONE_LIGHT.cyan) },
  { token: 'number', foreground: hex(ONE_LIGHT.orange) },
  { token: 'number.hex', foreground: hex(ONE_LIGHT.orange) },
  { token: 'type', foreground: hex(ONE_LIGHT.yellow) },
  { token: 'type.identifier', foreground: hex(ONE_LIGHT.yellow) },
  { token: 'class', foreground: hex(ONE_LIGHT.yellow) },
  { token: 'identifier.class', foreground: hex(ONE_LIGHT.yellow) },
  { token: 'function', foreground: hex(ONE_LIGHT.yellow) },
  { token: 'variable', foreground: hex(ONE_LIGHT.red) },
  { token: 'variable.predefined', foreground: hex(ONE_LIGHT.blue) },
  { token: 'operator', foreground: hex(ONE_LIGHT.black) },
  { token: 'tag', foreground: hex(ONE_LIGHT.red) },
  { token: 'attribute.name', foreground: hex(ONE_LIGHT.orange) },
  { token: 'attribute.value', foreground: hex(ONE_LIGHT.green) },
  { token: 'metatag', foreground: hex(ONE_LIGHT.yellow) },
  { token: 'annotation', foreground: hex(ONE_LIGHT.yellow) },
  { token: 'regexp', foreground: hex(ONE_LIGHT.cyan) },
  { token: 'invalid', foreground: hex(ONE_LIGHT.white), fontStyle: 'bold' },
]

/**
 * Normalize a raw CSS color string (a skin token's DECLARED value) to
 * monaco's canonical `#rrggbb` / `#rrggbbaa`, or null when unparseable.
 */
export function toMonacoColor(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  if (s === '') return null
  const hexMatch = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s)
  if (hexMatch !== null) {
    const d = hexMatch[1]!
    if (d.length === 3 || d.length === 4) {
      const expand = (i: number): string => d[i]! + d[i]!
      const rrggbb = expand(0) + expand(1) + expand(2)
      return d.length === 4 ? `#${rrggbb}${expand(3)}` : `#${rrggbb}`
    }
    return `#${d}`
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(s)
  if (fn === null) return null
  const parts = fn[1]!.split(/[,\s/]+/).filter(Boolean)
  if (parts.length < 3) return null
  const r = Number.parseInt(parts[0]!, 10)
  const g = Number.parseInt(parts[1]!, 10)
  const b = Number.parseInt(parts[2]!, 10)
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null
  const hex2 = (n: number): string => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  let out = `#${hex2(r)}${hex2(g)}${hex2(b)}`
  if (parts.length >= 4) {
    const a = Number.parseFloat(parts[3]!)
    if (Number.isFinite(a)) out += hex2(Math.round(a * 255))
  }
  return out
}

/** A token's value, normalized for monaco + guarded against inert values. */
function surface(tokenName: string, fallback: string): string {
  const raw = effectiveTokenValue(tokenName)
  return (raw !== '' ? toMonacoColor(raw) : null) ?? fallback
}

function themeData(dark: boolean): Record<string, unknown> {
  const family = dark ? ONE_DARK : ONE_LIGHT
  return {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: dark ? RULES_DARK : RULES_LIGHT,
    colors: {
      'editor.background': surface('--dsw-alias-bg-layer-1', family.black),
      'editor.foreground': surface('--dsw-alias-label-primary', family.gray),
      'editorCursor.foreground': surface('--dsw-alias-label-primary', family.gray),
      'editorLineNumber.foreground': surface('--dsw-alias-label-tertiary', dark ? ONE_DARK.faintGray : ONE_LIGHT.gray),
      'editorLineNumber.activeForeground': surface('--dsw-alias-label-primary', family.gray),
      'editor.lineHighlightBackground': dark ? '#474747' : '#e4f6d4',
      'editor.selectionBackground': dark ? '#264f78' : '#c9d0d9',
      'editor.inactiveSelectionBackground': dark ? '#1e3f60' : '#dde3ea',
      'editorIndentGuide.background1': dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      'editorIndentGuide.activeBackground1': dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
      'editorWidget.background': surface('--dsw-alias-bg-layer-2', dark ? '#21252b' : '#f3f3f3'),
      'editorWidget.border': surface('--dsw-alias-border-l1', dark ? '#454545' : '#c8c8c8'),
      'editorHoverWidget.background': surface('--dsw-alias-bg-layer-2', dark ? '#21252b' : '#f3f3f3'),
      'editorHoverWidget.border': surface('--dsw-alias-border-l1', dark ? '#454545' : '#c8c8c8'),
      'editorSuggestWidget.background': surface('--dsw-alias-bg-layer-2', dark ? '#21252b' : '#f3f3f3'),
      'editorSuggestWidget.border': surface('--dsw-alias-border-l1', dark ? '#454545' : '#c8c8c8'),
      'input.background': surface('--dsw-alias-bg-layer-1', family.black),
      'input.border': surface('--dsw-alias-border-l1', dark ? '#454545' : '#c8c8c8'),
      'input.foreground': surface('--dsw-alias-label-primary', family.gray),
      'scrollbarSlider.background': dark ? '#424242' : '#bbbbbb',
      'scrollbarSlider.hoverBackground': dark ? '#4f4f4f' : '#a6a6a6',
      'scrollbarSlider.activeBackground': dark ? '#5c5c5c' : '#909090',
    },
  }
}

let defined = false

/** Define (or re-define) the DSH themes and activate the one for the scheme. */
export function applyDshMonacoTheme(monaco: MonacoThemeHost, dark: boolean): void {
  if (!defined) {
    monaco.editor.defineTheme(DSH_DARK_THEME, themeData(true))
    monaco.editor.defineTheme(DSH_LIGHT_THEME, themeData(false))
    defined = true
  } else {
    monaco.editor.defineTheme(dark ? DSH_DARK_THEME : DSH_LIGHT_THEME, themeData(dark))
  }
  monaco.editor.setTheme(dark ? DSH_DARK_THEME : DSH_LIGHT_THEME)
}

/** Test seam: reset the define-once guard. */
export function resetDshMonacoThemesForTests(): void {
  defined = false
}
