/**
 * Deep-import shims for the monaco worker bundle entries. monaco-editor's
 * exports map (0.56) exposes the ESM tree via `"./*.js": "./esm/vs/*.js"`,
 * so `monaco-editor/editor/editor.worker.js` resolves for the bundler — but
 * ships no per-file .d.ts for the worker entry points. These side-effect
 * imports need no types; the shims keep `tsc --noEmit` green.
 */
declare module 'monaco-editor/editor/editor.worker.js'
declare module 'monaco-editor/language/typescript/ts.worker.js'
declare module 'monaco-editor/language/json/json.worker.js'
declare module 'monaco-editor/language/css/css.worker.js'
declare module 'monaco-editor/language/html/html.worker.js'
