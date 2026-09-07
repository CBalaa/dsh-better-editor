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

/** Chevron-right glyph (tree expand; rotated 90° when expanded via CSS). */
export const IconChevronRight16 = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Folder glyph (file explorer directories). */
export const IconFolder16 = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h2.6l1.3 1.6h6.1A1.5 1.5 0 0 1 14.5 5v6.5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-8z" />
  </svg>
)

/** File glyph (file explorer leaves). */
export const IconFile16 = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 1.5h6L12.5 5v8.5a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.2" />
    <path d="M9 1.5V5h3.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

/** Sidebar-toggle glyph (show/hide the explorer). */
export const IconSidebar16 = ({ size = 16, className }: IconProps): JSX.Element => (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 2v12" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)
