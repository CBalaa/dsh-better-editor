/**
 * Icons this plugin needs (the editor viewer's edit button). Inlined SVG —
 * no dependency on dsh-client-ui-primitives (the sidebar seeds it, but a
 * consumer plugin keeps its own glyphs independent).
 */
import type { JSX } from 'react'

interface IconProps {
  size?: number
  className?: string
}

/** Edit-window glyph: a pencil over a baseline, 1.5px stroke currentColor. */
export const IconEditOutline16 = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.9 2.6 13.4 6 6 13.4 2.5 9.9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8.7 3.8 12.2 7.2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M1.5 14.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

/** Viewer inventory glyph: a code frame (settings page icon). */
export const IconCodeOutline16 = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="m5.5 5.5-3 2.5 3 2.5M10.5 5.5l3 2.5-3 2.5M9 3.5 7 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Save glyph: a checkmark (the edit window's save button). */
export const IconCheck16 = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8.5 6.5 12 13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Close glyph: an X, 1.5px stroke currentColor (the edit window's close). */
export const IconClose16 = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)
