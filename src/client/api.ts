/**
 * /sidebar/api access for the editor (the dsh-better-sidebar host routes are
 * same-origin and public — the reference the built-in TextEditor uses). Only
 * fs.write is needed here: the viewer's initial content arrives through the
 * FileViewerProps (fetchStrategy 'fsRead'); saving writes the whole file back.
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

/** Write a file through the sidebar's fenced fs.write route. */
export async function fsWrite(scope: SessionScope, path: string, content: string): Promise<void> {
  const payload: Record<string, string> = { sessionId: scope.sessionId, path, content }
  if (scope.cwd !== undefined && scope.cwd !== '') payload.cwd = scope.cwd
  if (scope.repoRoot !== undefined && scope.repoRoot !== '') payload.repoRoot = scope.repoRoot
  let response: Response
  try {
    response = await fetch('/sidebar/api/fs.write', {
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
}