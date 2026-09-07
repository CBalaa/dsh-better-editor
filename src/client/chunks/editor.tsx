/**
 * Lazy chunk entry: the monaco file viewer (read-only view + edit window).
 * Built as lib/client-editor.js and registered under
 * `globalThis.__betterEditorChunks__["editor"]` — fetched only when a text
 * file first opens (see editor-loader.ts). Never import this module from the
 * client bundle: it pulls monaco (~5MB) into the startup path.
 */
export { MonacoFileView } from '../MonacoFileView.tsx'
