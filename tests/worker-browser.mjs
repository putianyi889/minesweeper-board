import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { createServer, preview } from 'vite'

// Native browser/Worker integration; no Cypress, page screenshots or arbitrary frame waits.
const configFile = resolve('tests/fixtures/worker-vite/vite.config.ts')
const candidates = [process.env.WORKER_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)
let executable
for (const path of candidates) {
    try { await access(path); executable = path; break } catch { /* try next browser */ }
}
assert.ok(executable, 'Set WORKER_TEST_BROWSER to a Chrome/Edge executable.')
const bundle = await readFile('dist/worker.js', 'utf8')
assert.ok(!/\b(document|window|HTMLCanvasElement|HTMLImageElement)\b|from\s*["']vue["']/.test(bundle), 'The published Worker bundle contains DOM/Vue dependencies.')
const profile = await mkdtemp(join(tmpdir(), 'board-worker-browser-'))
const chrome = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
let failDeadline
const timedOut = new Promise((_, reject) => { failDeadline = reject })
const deadline = setTimeout(() => failDeadline(new Error('Native Worker verification exceeded 60 seconds.')), 60_000)
const wait = (promise) => Promise.race([promise, timedOut])
let socket
let dev
let production
try {
    console.log('Starting headless browser for native module Worker verification.')
    const endpoint = await wait(new Promise((yes, no) => {
        let stderr = ''
        chrome.stderr.on('data', (data) => {
            stderr += data.toString()
            const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)
            if (match) yes(match[1])
        })
        chrome.once('error', no)
        chrome.once('exit', (code) => no(new Error(`Browser exited before DevTools was available: ${code}`)))
    }))
    console.log('DevTools connected.')
    socket = new WebSocket(endpoint)
    await wait(new Promise((yes, no) => { socket.addEventListener('open', yes, { once: true }); socket.addEventListener('error', no, { once: true }) }))
    let sequence = 0
    const pending = new Map()
    const events = new Map()
    socket.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data)
        if (message.id) {
            const entry = pending.get(message.id)
            pending.delete(message.id)
            if (message.error) entry.reject(new Error(message.error.message))
            else entry.resolve(message.result)
        } else {
            const key = `${message.sessionId}:${message.method}`
            events.get(key)?.(message.params)
            events.delete(key)
        }
    })
    const command = (method, params = {}, sessionId) => wait(new Promise((resolve, reject) => {
        const id = ++sequence
        pending.set(id, { resolve, reject })
        socket.send(JSON.stringify({ id, method, params, sessionId }))
    }))
    const { targetId } = await command('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true })
    await command('Page.enable', {}, sessionId)
    const verify = async (url, mode) => {
        const loaded = new Promise((resolve) => events.set(`${sessionId}:Page.loadEventFired`, resolve))
        await command('Page.navigate', { url }, sessionId)
        await wait(loaded)
        console.log(`Checking ${mode} module Workers.`)
        const response = await command('Runtime.evaluate', { expression: 'window.workerCheck()', awaitPromise: true, returnByValue: true }, sessionId)
        assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails))
        assert.equal(response.result.value.passed, true)
        console.log(JSON.stringify({ mode, ...response.result.value }))
    }
    dev = await createServer({ configFile, server: { host: '127.0.0.1', port: 0 } })
    await dev.listen()
    await verify(`http://127.0.0.1:${dev.httpServer.address().port}/export/`, 'vite-dev')
    await dev.close()
    dev = undefined
    production = await preview({ configFile, preview: { host: '127.0.0.1', port: 0 } })
    await verify(`http://127.0.0.1:${production.httpServer.address().port}/export/`, 'vite-production')
    // Browser shutdown may close the protocol socket before replying.
    void command('Browser.close').catch(() => {})
} finally {
    clearTimeout(deadline)
    socket?.close()
    await dev?.close()
    if (production) await new Promise((resolve) => production.httpServer.close(resolve))
    const exited = new Promise((resolve) => chrome.once('exit', resolve))
    if (chrome.exitCode === null) { chrome.kill(); await exited }
    // Verify the absolute target stays within the named temporary directory before recursive cleanup.
    const inside = relative(resolve(tmpdir()), resolve(profile))
    assert.ok(inside && !inside.startsWith('..') && !isAbsolute(inside) && basename(profile).startsWith('board-worker-browser-'))
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
