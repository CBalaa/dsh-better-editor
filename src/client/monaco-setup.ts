/**
 * MonacoEnvironment wiring. Monaco spawns its language workers through
 * `self.MonacoEnvironment.getWorker`; without an environment it falls back to
 * a bundler probe (`new URL(..., import.meta.url)`) that cannot resolve inside
 * the chunk's CJS closure — the worker would fail and monaco would log errors.
 *
 * The workers are the sibling artifacts lib/monaco-worker-<name>.js, served
 * through the host's /better-editor/bundle route. The available worker names
 * are stamped at build time (__BETTER_EDITOR_WORKERS__); a label outside the
 * list degrades to monaco's no-worker main-thread fallback instead of
 * spawning a worker that can never answer.
 */

/** Compile-time stamp of the worker names tsdown built (tsdown.config.ts). */
declare const __BETTER_EDITOR_WORKERS__: string[]

const STAMPED_WORKERS: readonly string[] =
  typeof __BETTER_EDITOR_WORKERS__ !== 'undefined' ? __BETTER_EDITOR_WORKERS__ : []

/** monaco's worker labels → this plugin's worker artifact names. */
const WORKER_NAME_BY_LABEL: Readonly<Record<string, string>> = {
  editorWorkerService: 'editor',
  typescript: 'typescript',
  javascript: 'typescript',
  json: 'json',
  css: 'css',
  scss: 'css',
  less: 'css',
  html: 'html',
  handlebars: 'html',
  razor: 'html',
}

/** Install the environment exactly once per page (idempotent). */
export function ensureMonacoEnvironment(): void {
  const g = globalThis as { MonacoEnvironment?: unknown }
  if (g.MonacoEnvironment !== undefined) return
  g.MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker | undefined {
      const name = WORKER_NAME_BY_LABEL[label]
      if (name === undefined || !STAMPED_WORKERS.includes(name)) return undefined
      return new Worker(`/better-editor/bundle/monaco-worker-${name}.js`)
    },
  }
}
