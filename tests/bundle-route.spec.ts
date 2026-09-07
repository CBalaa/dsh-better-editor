/**
 * Host bundle-route tests: the /better-editor/bundle handler serves the
 * editor chunk and the five monaco workers, enforces the name allowlist (no
 * traversal), gates non-GET/HEAD methods, and ETag-304s unchanged artifacts.
 */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBundleRouteHandler } from '../src/index.ts'

interface FakeRes {
  status: number
  headers: Record<string, string>
  body: string
  writeHead(status: number, headers?: Record<string, string>): void
  end(body?: string | Buffer): void
}

function fakeRes(): FakeRes {
  return {
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers = {}) { this.status = status; this.headers = headers },
    end(body) { if (body !== undefined) this.body = body.toString() },
  } as FakeRes
}

function req(method: string, url: string, headers: Record<string, string> = {}) {
  return { method, url, headers } as { method: string; url: string; headers: Record<string, string> }
}

function setup(): { handler: ReturnType<typeof createBundleRouteHandler>; dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'better-editor-route-'))
  writeFileSync(join(dir, 'client-editor.js'), 'globalThis.__betterEditorChunks__ && 0;')
  writeFileSync(join(dir, 'monaco-worker-editor.js'), 'self.onmessage = () => {};')
  const handler = createBundleRouteHandler(() => true, dir)
  return { handler, dir, cleanup: () => { rmSync(dir, { recursive: true, force: true }) } }
}

describe('/better-editor/bundle route', () => {
  it('serves the editor chunk with JS content type + no-cache + ETag', async () => {
    const { handler, cleanup } = setup()
    try {
      const res = fakeRes()
      await handler(req('GET', '/better-editor/bundle/client-editor.js'), res as never)
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('text/javascript; charset=utf-8')
      expect(res.headers['cache-control']).toBe('no-cache')
      expect(res.headers.etag).toMatch(/^"[0-9a-f]{12}"$/)
      expect(res.body).toContain('__betterEditorChunks__')
    } finally {
      cleanup()
    }
  })

  it('serves an allowlisted monaco worker', async () => {
    const { handler, cleanup } = setup()
    try {
      const res = fakeRes()
      await handler(req('GET', '/better-editor/bundle/monaco-worker-editor.js'), res as never)
      expect(res.status).toBe(200)
      expect(res.body).toContain('self.onmessage')
    } finally {
      cleanup()
    }
  })

  it('revalidates with 304 when If-None-Match matches', async () => {
    const { handler, cleanup } = setup()
    try {
      const first = fakeRes()
      await handler(req('GET', '/better-editor/bundle/client-editor.js'), first as never)
      const second = fakeRes()
      await handler(req('GET', '/better-editor/bundle/client-editor.js', { 'if-none-match': first.headers.etag! }), second as never)
      expect(second.status).toBe(304)
      expect(second.body).toBe('')
    } finally {
      cleanup()
    }
  })

  it('rejects unknown names (traversal / non-allowlisted workers) with 404', async () => {
    const { handler, cleanup } = setup()
    try {
      for (const url of [
        '/better-editor/bundle/evil.js',
        '/better-editor/bundle/../secret.js',
        '/better-editor/bundle/monaco-worker-rust.js',
        '/better-editor/bundle/client.js',
      ]) {
        const res = fakeRes()
        await handler(req('GET', url), res as never)
        expect(res.status, url).toBe(404)
      }
    } finally {
      cleanup()
    }
  })

  it('gates non-GET/HEAD with 405 and the fence with 403', async () => {
    const { handler, cleanup } = setup()
    try {
      const post = fakeRes()
      await handler(req('POST', '/better-editor/bundle/client-editor.js'), post as never)
      expect(post.status).toBe(405)
    } finally {
      cleanup()
    }
    const dir = mkdtempSync(join(tmpdir(), 'better-editor-fence-'))
    writeFileSync(join(dir, 'client-editor.js'), 'x')
    const fenced = createBundleRouteHandler(() => false, dir)
    try {
      const res = fakeRes()
      await fenced(req('GET', '/better-editor/bundle/client-editor.js'), res as never)
      expect(res.status).toBe(403)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
