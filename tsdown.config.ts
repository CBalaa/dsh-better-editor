/**
 * tsdown build for dsh-better-editor: the host half (lib/index.js, ESM node
 * — serves the editor chunk + monaco workers) plus the browser client bundle
 * (lib/client.js, CJS closure factory), the lazy editor chunk
 * (lib/client-editor.js — monaco + this plugin's viewer UI) and the five
 * monaco web workers (lib/monaco-worker-<name>.js, iife).
 *
 * The client bundle replicates the official DSH client-bundle preset (the
 * same shape dsh-better-sidebar and the Office preview plugin use): externals
 * resolve through the loader module table at runtime (react + react-dom +
 * cordis), everything else inlines; it registers itself via
 * `window.__ModuleLoader__.load({ id, factory })`.
 *
 * The editor chunk mirrors dsh-better-sidebar's chunk bundle: a CJS closure
 * registered on a plugin-owned global (`globalThis.__betterEditorChunks__["editor"]`),
 * fetched lazily through the host's /better-editor/bundle route and
 * materialized with a require over the module-table externals (react) — see
 * src/client/editor-loader.ts. monaco inlines into the chunk (its ~5MB never
 * rides page load); the five language workers are separate classic worker
 * scripts spawned per-language through the same route.
 *
 * The chunk and the workers are minified (monaco is by far the heaviest
 * payload — 8.3MB → 4.95MB); the client bundle stays readable like the
 * reference plugins.
 */
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { basename, dirname, relative, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

const require = createRequire(import.meta.url)

const REPOSITORY_ROOT = fileURLToPath(new URL('.', import.meta.url))

/** Bundle id (= package name; the client-modules compose keys on it). */
const CLIENT_ID = 'dsh-better-editor'

/** Module specifiers the web shell shares into the frozen module table. */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'cordis',
]

/** The subset of the module table the editor chunk requires at runtime. */
const CHUNK_EXTERNALS = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']

/** The monaco worker names (mirror of src/index.ts's allowlist). */
const MONACO_WORKERS = ['editor', 'typescript', 'json', 'css', 'html']

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** The style-injection prologue shared by module css and plain css loads. */
function injectTag(pluginId: string, fileId: string, cssText: string): string {
  const tagId = `${pluginId}/${basename(fileId)}`
  return [
    `const css = ${JSON.stringify(cssText)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
    `  const tag = document.createElement('style');`,
    `  tag.dataset.plugin = ${JSON.stringify(pluginId)};`,
    `  tag.dataset.pluginCss = tagId;`,
    `  tag.textContent = css;`,
    `  document.head.appendChild(tag);`,
    `}`,
  ].join('\n')
}

/** Rebase a physical lib-relative source onto the repository-shaped URL tree. */
function browserSourcePath(source: string, sourcemapPath: string): string {
  if (!source.startsWith('.')) return source
  const physicalSource = resolvePath(dirname(sourcemapPath), source)
  const repositoryPath = relative(REPOSITORY_ROOT, physicalSource).split(sep).join('/')
  return `../../../${repositoryPath}`
}

/** The CSS-inline virtual-module plugin (one <style data-plugin> per file);
 *  codicon.ttf is base64-inlined so the injected <style> stays page-relative. */
function makeCssPlugin(pluginId: string): NonNullable<UserConfig['plugins']> {
  return {
    name: 'dsh-css-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.css')) return null
      let abs: string
      if (source.startsWith('.') || source.startsWith('/') || /^[A-Za-z]:[\\/]/.test(source)) {
        abs = importer === undefined ? source : resolvePath(dirname(importer), source)
      } else {
        abs = require.resolve(source)
      }
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      let source = (await readFile(fileId)).toString('utf8')
      if (/url\(\.\/codicon\.ttf\)/.test(source)) {
        const ttf = readFileSync(resolvePath(dirname(fileId), 'codicon.ttf'))
        source = source.replaceAll(/url\(\.\/codicon\.ttf\)/g, `url(data:font/ttf;base64,${ttf.toString('base64')})`)
      }
      if (fileId.endsWith('.module.css')) {
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: Buffer.from(source),
          cssModules: { pattern: `[hash]_[local]` },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
        return [
          injectTag(pluginId, fileId, code.toString()),
          `export default ${JSON.stringify(classMap)};`,
        ].join('\n')
      }
      return [
        injectTag(pluginId, fileId, source),
        'export default "";',
      ].join('\n')
    },
  }
}

/** The host-half build (lib/index.js, ESM node — the worker/chunk route). */
const hostConfig: UserConfig = {
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}

/** The client bundle build (lib/client.js, CJS closure factory). */
const clientConfig: UserConfig = {
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [...CLIENT_EXTERNALS],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    'import.meta.resolve': 'undefined',
  },
  inputOptions: {
    resolve: { conditionNames: ['browser', 'import', 'require', 'default'] },
  },
  noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  plugins: [makeCssPlugin(CLIENT_ID)],
  outputOptions: {
    entryFileNames: 'client.js',
    sourcemapPathTransform: browserSourcePath,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(CLIENT_ID)}, factory: (require) => {`,
    footer: `return module.exports; } });`,
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    codeSplitting: false,
  },
}

/** The lazy editor chunk (lib/client-editor.js, CJS closure factory). */
const chunkConfig: UserConfig = {
  entry: { editor: 'src/client/chunks/editor.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [...CHUNK_EXTERNALS],
  minify: true,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    'import.meta.resolve': 'undefined',
    '__BETTER_EDITOR_WORKERS__': JSON.stringify(MONACO_WORKERS),
  },
  inputOptions: {
    resolve: { conditionNames: ['browser', 'import', 'require', 'default'] },
  },
  noExternal: (id: string) => (CHUNK_EXTERNALS.includes(id) ? undefined : true),
  plugins: [makeCssPlugin(CLIENT_ID)],
  outputOptions: {
    entryFileNames: 'client-editor.js',
    sourcemapPathTransform: browserSourcePath,
    banner: `globalThis.__betterEditorChunks__ = globalThis.__betterEditorChunks__ || {}; globalThis.__betterEditorChunks__["editor"] = (require) => {`,
    footer: 'return module.exports; };',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    codeSplitting: false,
  },
}

/** One monaco web-worker bundle (lib/monaco-worker-<name>.js, iife). */
function workerConfig(name: string): UserConfig {
  return {
    entry: { worker: `src/client/workers/monaco-${name}.ts` },
    outDir: 'lib',
    format: 'iife',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    minify: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
      'import.meta.resolve': 'undefined',
    },
    inputOptions: {
      resolve: { conditionNames: ['browser', 'import', 'require', 'default'] },
    },
    noExternal: () => true,
    outputOptions: {
      entryFileNames: `monaco-worker-${name}.js`,
      sourcemapPathTransform: browserSourcePath,
      codeSplitting: false,
    },
  }
}

export default [
  hostConfig,
  clientConfig,
  chunkConfig,
  ...MONACO_WORKERS.map(workerConfig),
] satisfies UserConfig[]
