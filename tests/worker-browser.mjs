import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { checkNativeBrowser } from './native-browser.mjs'

const bundle = await readFile('dist/worker.js', 'utf8')
assert.ok(!/\b(document|window|HTMLCanvasElement|HTMLImageElement)\b|from\s*["']vue["']/.test(bundle), 'The published Worker bundle contains DOM/Vue dependencies.')
await checkNativeBrowser({
    configFile: resolve('tests/fixtures/worker-vite/vite.config.ts'),
    base: '/export/',
    check: ({ evaluate }) => evaluate('window.workerCheck()'),
})
