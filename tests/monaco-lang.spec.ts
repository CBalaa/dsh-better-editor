/**
 * monaco-lang tests: path → monaco language id mapping. Pins the extension
 * table and the degrade-to-plaintext contract.
 */
import { describe, expect, it } from 'vitest'
import { extOf, monacoLanguageForPath } from '../src/client/monaco-lang.ts'

describe('extOf', () => {
  it('derives a lowercase extension from a path', () => {
    expect(extOf('/a/b/main.TSX')).toBe('tsx')
    expect(extOf('/a/b/.gitignore')).toBe('gitignore')
    expect(extOf('/a/b/noext')).toBe('')
  })
})

describe('monacoLanguageForPath', () => {
  it('maps common languages to monaco ids', () => {
    expect(monacoLanguageForPath('/a/index.ts')).toBe('typescript')
    expect(monacoLanguageForPath('/a/index.js')).toBe('javascript')
    expect(monacoLanguageForPath('/a/data.json')).toBe('json')
    expect(monacoLanguageForPath('/a/main.py')).toBe('python')
    expect(monacoLanguageForPath('/a/page.html')).toBe('html')
    expect(monacoLanguageForPath('/a/lib.rs')).toBe('rust')
    expect(monacoLanguageForPath('/a/main.c')).toBe('c')
    expect(monacoLanguageForPath('/a/main.cpp')).toBe('cpp')
  })

  it('falls back to plaintext for unknown extensions', () => {
    expect(monacoLanguageForPath('/a/notes.txt')).toBe('plaintext')
    expect(monacoLanguageForPath('/a/Makefile')).toBe('plaintext')
    expect(monacoLanguageForPath('/a/config.toml')).toBe('plaintext')
    expect(monacoLanguageForPath('/a/nginx.conf')).toBe('plaintext')
  })

  it('maps .vue to html (monaco 0.56 dropped the vue grammar)', () => {
    expect(monacoLanguageForPath('/a/App.vue')).toBe('html')
  })
})
