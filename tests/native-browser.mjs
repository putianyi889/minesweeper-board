import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { createServer, preview } from 'vite'

/** Native browser checks shared by the Worker and touch fixtures; no Cypress or arbitrary frame waits. */
export async function checkNativeBrowser({ configFile, base = '/', check, timeoutMs = 60_000 }) {
    const candidates = [process.env.WORKER_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)
    let executable
    for (const path of candidates) {
        try { await access(path); executable = path; break } catch { /* try next browser */ }
    }
    assert.ok(executable, 'Set WORKER_TEST_BROWSER to a Chrome/Edge executable.')
    const profile = await mkdtemp(join(tmpdir(), 'board-worker-browser-'))
    const chrome = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    let failDeadline
    const timedOut = new Promise((_, reject) => { failDeadline = reject })
    const deadline = setTimeout(() => failDeadline(new Error('Native browser verification timed out.')), timeoutMs)
    const wait = (promise) => Promise.race([promise, timedOut])
    let socket
    let dev
    let production
    try {
        console.log('Starting headless browser for native verification.')
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
        const call = (method, params = {}) => command(method, params, sessionId)
        const evaluate = async (expression) => {
            const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
            assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails))
            return response.result.value
        }
        const verify = async (url, mode) => {
            const loaded = new Promise((resolve) => events.set(`${sessionId}:Page.loadEventFired`, resolve))
            await command('Page.navigate', { url }, sessionId)
            await wait(loaded)
            console.log(`Checking ${mode}.`)
            const result = await check({ evaluate, call, mode })
            assert.equal(result.passed, true)
            console.log(JSON.stringify({ mode, ...result }))
        }
        dev = await createServer({ configFile, server: { host: '127.0.0.1', port: 0 } })
        await dev.listen()
        await verify(`http://127.0.0.1:${dev.httpServer.address().port}${base}`, 'vite-dev')
        await dev.close()
        dev = undefined
        production = await preview({ configFile, preview: { host: '127.0.0.1', port: 0 } })
        await verify(`http://127.0.0.1:${production.httpServer.address().port}${base}`, 'vite-production')
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
}
