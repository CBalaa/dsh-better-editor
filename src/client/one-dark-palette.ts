/**
 * Syntax color families the editor surfaces use: one-dark for the dark
 * scheme, one-light for the light scheme. Same families dsh-better-sidebar's
 * editor/terminal use, re-declared here because the sidebar does not export
 * them as a public API. The palette holds only the syntax hues; surface
 * colors are token-driven (theme.ts → --dsw-alias-*).
 */

/** one-dark family (dark scheme) syntax hues. */
export const ONE_DARK = {
  black: '#282c34',
  gray: '#abb2bf',
  faintGray: '#5c6370',
  white: '#ffffff',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  orange: '#d19a66',
} as const

/** one-light family (light scheme) syntax hues. */
export const ONE_LIGHT = {
  black: '#383a42',
  gray: '#a0a1a7',
  faintGray: '#4f525e',
  white: '#ffffff',
  offWhite: '#fafafa',
  red: '#e45649',
  green: '#50a14f',
  yellow: '#c18401',
  blue: '#0184bc',
  magenta: '#a626a4',
  cyan: '#0997b3',
  orange: '#986801',
} as const
