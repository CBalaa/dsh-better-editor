/**
 * /sidebar/api access for the editor (the dsh-better-sidebar host routes are
 * same-origin and public — the reference the built-in TextEditor uses). The
 * viewer's initial content arrives through the FileViewerProps (fetchStrategy
 * 'fsRead'); the edit window reads other files (fs.read), lists directories
 * (fs.tree) for its explorer, and writes saves (fs.write).
 */

export interface SessionScope {
  sessionId: string
  cwd?: string
  repoRoot?: string
}

interface Envelope {
  ok?: boolean
  value?: unknown
  error?: { code?: string; message?: string }
}

/** One directory entry returned by fs.tree. */
export interface FsTreeEntry {
  name: string
  path: string
  isDir: boolean
  isSymlink: boolean
  broken: boolean
  hidden: boolean
}

/** fs.tree result: one directory listing. */
export interface FsTreeResult {
  path: string
  entries: FsTreeEntry[]
  truncated: boolean
}

/** fs.read result: text, or a binary refusal. */
export type FsReadResult =
  | { kind: 'text'; content: string; truncated: boolean }
  | { kind: 'binary'; size: number; truncated: boolean; head: number[] }

/** The shared scope payload (sessionId + optional cwd/repoRoot). */
function scopePayload(scope: SessionScope, extra: Record<string, string> = {}): Record<string, string> {
  const payload: Record<string, string> = { sessionId: scope.sessionId, ...extra }
  if (scope.cwd !== undefined && scope.cwd !== '') payload.cwd = scope.cwd
  if (scope.repoRoot !== undefined && scope.repoRoot !== '') payload.repoRoot = scope.repoRoot
  return payload
}

/** POST one /sidebar/api method and unwrap its {ok, value} envelope. */
async function call<T>(method: string, payload: Record<string, string>): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/sidebar/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }
  const parsed = (await response.json().catch(() => null)) as Envelope | null
  if (!response.ok || parsed === null || parsed.ok !== true) {
    throw new Error(parsed?.error?.message ?? `HTTP ${response.status}`)
  }
  return parsed.value as T
}

/** List a directory (defaults to the session cwd). */
export function fsTree(scope: SessionScope, path?: string): Promise<FsTreeResult> {
  return call<FsTreeResult>('fs.tree', scopePayload(scope, path !== undefined && path !== '' ? { path } : {}))
}

/** Read a file's text content. */
export function fsRead(scope: SessionScope, path: string): Promise<FsReadResult> {
  return call<FsReadResult>('fs.read', scopePayload(scope, { path }))
}

/** Write a file through the sidebar's fenced fs.write route. */
export function fsWrite(scope: SessionScope, path: string, content: string): Promise<void> {
  return call<void>('fs.write', scopePayload(scope, { path, content }))
}
