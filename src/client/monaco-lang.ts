/**
 * Monaco language resolution: maps an opened file path to the monaco
 * language id for tokenization / language services. A direct extension →
 * monaco-id table (monaco 0.56 basic-languages ids), independent of
 * dsh-better-sidebar's internal lang tables (which are not exported).
 * Unknown / ambiguous extensions degrade to plaintext rather than
 * highlighting wrongly.
 */

/** Extension (lowercase, no dot) → monaco language id. */
const MONACO_IDS: Readonly<Record<string, string>> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript',
  json: 'json', jsonc: 'json',
  md: 'markdown', markdown: 'markdown',
  py: 'python', pyw: 'python',
  html: 'html', htm: 'html',
  css: 'css', xml: 'xml', xsl: 'xml',
  yaml: 'yaml', yml: 'yaml',
  sql: 'sql', java: 'java', cs: 'csharp',
  kt: 'kotlin', kts: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', hxx: 'cpp',
  rs: 'rust', go: 'go', php: 'php',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  dockerfile: 'dockerfile', docker: 'dockerfile',
  ini: 'ini', properties: 'ini', env: 'ini',
  scss: 'scss', less: 'less',
  rb: 'ruby', lua: 'lua', perl: 'perl', pl: 'perl', pm: 'perl',
  r: 'r', dart: 'dart', scala: 'scala', sc: 'scala',
  ps1: 'powershell', psm1: 'powershell',
  proto: 'protobuf', pug: 'pug', tcl: 'tcl',
  clj: 'clojure', cljs: 'clojure', jl: 'julia',
  pas: 'pascal', vb: 'vb', mm: 'objective-c',
  // '.vue' → html (monaco 0.56 dropped the vue grammar; SFC is HTML-shaped).
  vue: 'html',
  // Unmapped monaco 0.56 (degrade to plaintext): toml, nginx/conf, sass,
  // styl, cmake, haskell, erlang, vhdl, tex/stex, diff/patch, groovy.
}

/** Extension of a path (lowercase, no leading dot; '' for none). */
export function extOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot < 0) return ''
  return base.slice(dot + 1).toLowerCase()
}

/** The monaco language id for a path, or 'plaintext' for unknown extensions. */
export function monacoLanguageForPath(path: string): string {
  const ext = extOf(path)
  if (ext === '') return 'plaintext'
  return MONACO_IDS[ext] ?? 'plaintext'
}
