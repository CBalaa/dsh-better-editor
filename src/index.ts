/**
 * dsh-better-editor, node half: serves the browser half's lazy editor chunk
 * (lib/client-editor.js) and the five monaco language workers
 * (lib/monaco-worker-<name>.js) under /better-editor/bundle/*.
 *
 * The DSH module loader serves each plugin's `client.js` but cannot serve
 * arbitrary file names, so — exactly like dsh-better-sidebar's chunk route —
 * this plugin serves its own split bundles here. The route rides the same
 * browser-trust fence as the /api gateway (DNS-rebinding defense), serves
 * only an allowlisted name set (no path traversal), and marks responses
 * `cache-control: no-cache` so revalidations are cheap on refresh/HMR.
 *
 * The plugin's real feature — the VSCode-grade editor — lives entirely in the
 * browser half; this node half only makes its lazy code arrival possible.
 */
import { createHash } from 'node:crypto'
import { stat, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isTrustedApiRequest } from './trust-fence.ts'

/** The static artifacts this route serves (mirror of tsdown.config.ts). */
const CHUNK_NAMES = ['client-editor'] as const
const MONACO_WORKER_NAMES = ['editor', 'typescript', 'json', 'css', 'html'] as const

/** Directory of this host-half module (lib/ — the artifacts live next to it). */
const LIB_DIR = dirname(fileURLToPath(import.meta.url))

/** The request face the route reads (structural subset of IncomingMessage). */
interface HttpRequest {
  url?: string
  method?: string
  headers: Record<string, string | string[] | undefined>
}

/** The response face the route writes (structural subset of ServerResponse). */
interface HttpResponse {
  writeHead(status: number, headers?: Record<string, string>): void
  end(body?: string | Uint8Array): void
}

/** The webServer service face this plugin uses. */
interface WebServer {
  register(route: { kind: 'prefix'; path: string; handler: (req: HttpRequest, res: HttpResponse) => Promise<void> | void }): () => void
}

/** The web runtime's bind-derived trust list (same source the /api gateway uses). */
interface WebRuntime {
  trustedHosts: readonly string[]
}

/** The host context slice this plugin consumes. */
export interface Context {
  webServer: WebServer
  webRuntime: WebRuntime
}

/** The `inject` declarations (Cordis activates these before this plugin). */
export const inject = ['webServer', 'webRuntime'] as const

interface Artifact {
  file: string
  kind: 'chunk' | 'worker'
}

/** Resolve a request name to its artifact, or null when not allowlisted. */
function artifactOf(name: string): Artifact | null {
  if ((CHUNK_NAMES as readonly string[]).includes(name)) {
    return { file: `${name}.js`, kind: 'chunk' }
  }
  const worker = /^monaco-worker-([a-z]+)$/.exec(name)?.[1]
  if (worker !== undefined && (MONACO_WORKER_NAMES as readonly string[]).includes(worker)) {
    return { file: `monaco-worker-${worker}.js`, kind: 'worker' }
  }
  return null
}

/** sha1 content hash shortened to 12 hex chars (same shape as the shell rev). */
function shortHash(input: string | Uint8Array): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12)
}

const etags = new Map<string, { mtimeMs: number; size: number; etag: string }>()

async function etagOf(chunkDir: string, file: string): Promise<string | undefined> {
  const path = join(chunkDir, file)
  const key = `${chunkDir}:${file}`
  try {
    const info = await stat(path)
    const memo = etags.get(key)
    if (memo !== undefined && memo.mtimeMs === info.mtimeMs && memo.size === info.size) return memo.etag
    const etag = `"${shortHash(await readFile(path))}"`
    etags.set(key, { mtimeMs: info.mtimeMs, size: info.size, etag })
    return etag
  } catch {
    return undefined
  }
}

/**
 * Build the /better-editor/bundle route handler.
 * @param fence - the shared browser-trust check (isTrustedApiRequest).
 * @param chunkDir - the directory the artifacts live in (overridable for tests).
 */
export function createBundleRouteHandler(
  fence: (req: HttpRequest) => boolean,
  chunkDir: string = LIB_DIR,
): (req: HttpRequest, res: HttpResponse) => Promise<void> {
  return async (req, res): Promise<void> => {
    if (!fence(req)) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405)
      res.end()
      return
    }
    const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
    const match = /^\/better-editor\/bundle\/([a-z0-9-]+)\.js$/.exec(pathname)
    const name = match?.[1]
    const artifact = name === undefined ? null : artifactOf(name)
    if (artifact === null) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    const etag = await etagOf(chunkDir, artifact.file)
    if (etag === undefined) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { 'cache-control': 'no-cache', etag })
      res.end()
      return
    }
    try {
      const body = await readFile(join(chunkDir, artifact.file))
      res.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-cache',
        etag,
      })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  }
}

/**
 * Plugin body: mount the fenced chunk/worker route. The web runtime's
 * bind-derived trust list is the authoritative source the /api gateway
 * fence derives its list from — read per request from the live service value.
 */
export function apply(ctx: Context): void {
  const fence = (req: HttpRequest): boolean => isTrustedApiRequest(req, ctx.webRuntime.trustedHosts)
  ctx.webServer.register({
    kind: 'prefix',
    path: '/better-editor/bundle',
    handler: createBundleRouteHandler(fence),
  })
}
